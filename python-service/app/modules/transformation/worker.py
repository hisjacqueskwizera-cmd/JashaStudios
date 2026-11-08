from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import socket
from io import BytesIO
from typing import Any
from urllib.parse import quote
from uuid import uuid4

import httpx
from PIL import Image

from app.modules.transformation.pipeline import prepare_generated_image, prepare_transformation
from app.modules.transformation.providers import (
    OpenAIImageGenerationProvider,
    ProviderError,
    ProviderUnavailable,
)
from app.settings import get_settings

logger = logging.getLogger("jasha.transformation.worker")
BUCKET = "studio-assets"


class WorkerServiceError(RuntimeError):
    def __init__(self, message: str, *, retryable: bool = True, code: str = "worker_service_error") -> None:
        super().__init__(message)
        self.retryable = retryable
        self.code = code


def _safe_job_path(path: Any, user_id: str, project_id: str) -> str:
    if not isinstance(path, str) or not path or path.startswith("/") or "\\" in path:
        raise WorkerServiceError("Invalid private asset path.", retryable=False, code="invalid_asset_path")
    if ".." in path.split("/") or not path.startswith(f"{user_id}/{project_id}/"):
        raise WorkerServiceError("Asset path is outside the job owner scope.", retryable=False, code="invalid_asset_path")
    return path


class TransformationWorker:
    def __init__(self) -> None:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_secret_key or not settings.openai_api_key:
            raise RuntimeError("Worker requires SUPABASE_URL, SUPABASE_SECRET_KEY and OPENAI_API_KEY.")
        self.settings = settings
        self.worker_id = settings.transformation_worker_id or f"{socket.gethostname()}-{uuid4().hex[:12]}"
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(60, connect=15),
            headers={
                "apikey": settings.supabase_secret_key,
                "Authorization": f"Bearer {settings.supabase_secret_key}",
            },
        )
        self.provider = OpenAIImageGenerationProvider(
            api_key=settings.openai_api_key,
            model=settings.openai_image_model,
            timeout_seconds=settings.openai_image_timeout_seconds,
        )

    async def close(self) -> None:
        await self.client.aclose()

    def _url(self, suffix: str) -> str:
        return f"{self.settings.supabase_url.rstrip('/')}{suffix}"

    async def _rpc(self, name: str, payload: dict[str, Any]) -> Any:
        try:
            response = await self.client.post(self._url(f"/rest/v1/rpc/{name}"), json=payload)
        except httpx.RequestError as exc:
            raise WorkerServiceError("Could not reach the job database.") from exc
        if response.status_code >= 500 or response.status_code in {408, 429}:
            raise WorkerServiceError("The job database is temporarily unavailable.")
        if response.is_error:
            raise WorkerServiceError("The job database rejected a worker operation.", retryable=False)
        return response.json()

    async def _download(self, path: str) -> bytes:
        url = self._url(f"/storage/v1/object/{BUCKET}/{quote(path, safe='/')}")
        try:
            response = await self.client.get(url)
        except httpx.RequestError as exc:
            raise WorkerServiceError("Could not download a private input image.") from exc
        if response.status_code in {408, 429} or response.status_code >= 500:
            raise WorkerServiceError("Private image storage is temporarily unavailable.")
        if response.is_error:
            raise WorkerServiceError("A private input image could not be found.", retryable=False, code="input_asset_missing")
        if not response.content or len(response.content) > self.settings.max_reference_upload_bytes:
            raise WorkerServiceError("An input image is empty or exceeds the upload limit.", retryable=False, code="invalid_input_asset")
        return response.content

    async def _upload(self, path: str, content: bytes) -> None:
        url = self._url(f"/storage/v1/object/{BUCKET}/{quote(path, safe='/')}")
        try:
            response = await self.client.post(
                url,
                content=content,
                headers={"Content-Type": "image/webp", "x-upsert": "false"},
            )
        except httpx.RequestError as exc:
            raise WorkerServiceError("Could not publish the generated image.") from exc
        if response.status_code in {408, 429} or response.status_code >= 500:
            raise WorkerServiceError("Private image storage is temporarily unavailable.")
        if response.is_error:
            raise WorkerServiceError("Generated image storage rejected the output.", retryable=False, code="output_storage_rejected")

    async def _delete(self, path: str) -> None:
        url = self._url(f"/storage/v1/object/{BUCKET}/{quote(path, safe='/')}")
        try:
            await self.client.delete(url)
        except httpx.RequestError:
            logger.warning("Could not clean up unpublished output for %s", path)

    async def run_once(self) -> bool:
        claimed = await self._rpc("claim_transformation_job", {
            "p_worker_id": self.worker_id,
            "p_lease_seconds": self.settings.transformation_job_lease_seconds,
            "p_max_attempts": self.settings.transformation_max_attempts,
        })
        if not isinstance(claimed, list) or not claimed:
            return False
        await self._process(claimed[0])
        return True

    async def _process(self, job: dict[str, Any]) -> None:
        job_id = str(job.get("id", ""))
        user_id = str(job.get("user_id", ""))
        project_id = str(job.get("project_id", ""))
        output_path: str | None = None
        attempt_count = int(job.get("attempt_count", 1))
        try:
            snapshot = job.get("input_snapshot") or {}
            capture = snapshot.get("captured_image") or {}
            reference = snapshot.get("reference_image") or {}
            capture_path = _safe_job_path(capture.get("storage_path"), user_id, project_id)
            reference_path = _safe_job_path(reference.get("storage_path"), user_id, project_id)
            captured_bytes, reference_bytes = await asyncio.gather(
                self._download(capture_path), self._download(reference_path)
            )
            captured, style_reference, readiness = prepare_transformation(
                captured_bytes, reference_bytes, self.settings.max_reference_pixels,
                generation_provider="openai", generation_available=True,
            )
            if readiness.status == "retake_recommended":
                raise WorkerServiceError(
                    "The capture needs to be retaken before transformation.",
                    retryable=False, code="capture_quality_retake_recommended",
                )

            style_notes = (job.get("transformation_settings") or {}).get("style_notes", "")
            prompt = (
                "Match the reference photograph's photographic style, scene, lighting, shadows, "
                "framing, composition, palette and mood. Maintain a realistic professional-photo finish."
            )
            if isinstance(style_notes, str) and style_notes.strip():
                prompt += f" Additional direction: {style_notes.strip()[:1000]}"

            generated = await self.provider.generate(
                captured_image=captured.data,
                reference_image=style_reference.data,
                prompt=prompt,
                identity_preservation=(
                    "The customer's face and identity are the highest priority. Never replace "
                    "or blend the customer's face with the reference subject."
                ),
                safety_identifier=hashlib.sha256(user_id.encode("utf-8")).hexdigest(),
            )
            output_bytes, _ = prepare_generated_image(generated.data, self.settings.max_reference_pixels)
            with Image.open(BytesIO(output_bytes)) as output_image:
                width, height = output_image.size

            output_path = f"{user_id}/{project_id}/generated/{job_id}.webp"
            await self._upload(output_path, output_bytes)
            completed = await self._rpc("complete_transformation_job", {
                "p_job_id": job_id, "p_worker_id": self.worker_id,
                "p_storage_path": output_path, "p_byte_size": len(output_bytes),
                "p_width": width, "p_height": height,
                "p_provider": "openai", "p_model": generated.model,
            })
            if completed is not True:
                await self._delete(output_path)
                logger.info("Job %s was cancelled or its lease was lost before publishing.", job_id)
            else:
                logger.info("Transformation job %s completed (%sx%s).", job_id, width, height)
        except ProviderError as exc:
            if output_path:
                await self._delete(output_path)
            await self._record_failure(
                job_id, "provider_unavailable" if isinstance(exc, ProviderUnavailable) else "provider_rejected",
                isinstance(exc, ProviderUnavailable), attempt_count,
            )
        except WorkerServiceError as exc:
            if output_path:
                await self._delete(output_path)
            await self._record_failure(job_id, exc.code, exc.retryable, attempt_count)
        except Exception:
            if output_path:
                await self._delete(output_path)
            logger.exception("Unexpected transformation worker error for job %s", job_id)
            await self._record_failure(job_id, "worker_unexpected_error", True, attempt_count)

    async def _record_failure(self, job_id: str, code: str, retryable: bool, attempt_count: int) -> None:
        try:
            await self._rpc("fail_transformation_job", {
                "p_job_id": job_id, "p_worker_id": self.worker_id,
                "p_error_code": code, "p_retryable": retryable,
                "p_retry_seconds": min(900, 15 * (2 ** max(0, attempt_count - 1))),
                "p_max_attempts": self.settings.transformation_max_attempts,
            })
        except Exception:
            logger.exception("Could not record failure for transformation job %s", job_id)


async def run_worker() -> None:
    settings = get_settings()
    worker = TransformationWorker()
    logger.info("Transformation worker %s started.", worker.worker_id)
    try:
        while True:
            try:
                claimed = await worker.run_once()
                if not claimed:
                    await asyncio.sleep(settings.transformation_poll_interval_seconds)
            except Exception:
                logger.exception("Transformation worker polling failed.")
                await asyncio.sleep(settings.transformation_poll_interval_seconds)
    finally:
        await worker.close()


if __name__ == "__main__":
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    asyncio.run(run_worker())
