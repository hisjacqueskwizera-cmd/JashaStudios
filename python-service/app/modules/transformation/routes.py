import hashlib
import hmac
import re

from fastapi import APIRouter, File, Form, Header, HTTPException, Response, UploadFile, status

from app.modules.analysis.analyzer import InvalidReferenceImage
from app.modules.transformation.pipeline import (
    prepare_generated_image,
    prepare_transformation,
)
from app.modules.transformation.providers import (
    OpenAIImageGenerationProvider,
    ProviderError,
    ProviderNotConfigured,
    ProviderTimeout,
)
from app.modules.transformation.schemas import TransformationPreparationResponse
from app.settings import get_settings

router = APIRouter(prefix="/v1/transform", tags=["image-transformation"])
SAFETY_IDENTIFIER_PATTERN = re.compile(r"^[0-9a-f]{64}$")


def _authorize(api_key: str | None) -> None:
    settings = get_settings()
    if settings.vision_api_key:
        if not api_key or not hmac.compare_digest(api_key, settings.vision_api_key):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid vision API key.")
    elif settings.app_env.lower() in {"production", "prod"}:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transformation API authentication is not configured.",
        )


async def _read_limited(file: UploadFile, limit: int) -> bytes:
    content = await file.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(status_code=413, detail="Image exceeds the configured upload size limit.")
    return content


def _provider():
    settings = get_settings()
    if not settings.openai_api_key:
        raise ProviderNotConfigured("OpenAI image generation is not configured.")
    return OpenAIImageGenerationProvider(
        api_key=settings.openai_api_key,
        model=settings.openai_image_model,
        timeout_seconds=settings.openai_image_timeout_seconds,
    )


@router.post("/prepare", response_model=TransformationPreparationResponse)
async def prepare_transformation_request(
    captured_image: UploadFile = File(...),
    reference_image: UploadFile = File(...),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> TransformationPreparationResponse:
    """Validate and prepare a capture/reference pair before a generation job is queued."""
    _authorize(x_api_key)
    settings = get_settings()
    try:
        captured_bytes = await _read_limited(captured_image, settings.max_reference_upload_bytes)
        reference_bytes = await _read_limited(reference_image, settings.max_reference_upload_bytes)
        _, _, response = prepare_transformation(
            captured_bytes,
            reference_bytes,
            settings.max_reference_pixels,
            generation_provider="openai" if settings.openai_api_key else "not_configured",
            generation_available=bool(settings.openai_api_key),
        )
        return response
    except InvalidReferenceImage as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        await captured_image.close()
        await reference_image.close()


@router.post("/generate")
async def generate_transformation_request(
    captured_image: UploadFile = File(...),
    reference_image: UploadFile = File(...),
    style_notes: str = Form(default="", max_length=1000),
    safety_identifier: str | None = Form(default=None, max_length=64),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> Response:
    """Internal synchronous provider adapter; production job workers will call this boundary."""
    _authorize(x_api_key)
    settings = get_settings()
    if safety_identifier and not SAFETY_IDENTIFIER_PATTERN.fullmatch(safety_identifier):
        raise HTTPException(status_code=422, detail="Safety identifier must be a SHA-256 hex digest.")

    try:
        captured_bytes = await _read_limited(captured_image, settings.max_reference_upload_bytes)
        reference_bytes = await _read_limited(reference_image, settings.max_reference_upload_bytes)
        captured, reference, readiness = prepare_transformation(
            captured_bytes,
            reference_bytes,
            settings.max_reference_pixels,
            generation_provider="openai" if settings.openai_api_key else "not_configured",
            generation_available=bool(settings.openai_api_key),
        )
        if not settings.openai_api_key:
            raise HTTPException(status_code=503, detail="Image generation provider is not configured.")
        if readiness.status == "retake_recommended":
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "capture_quality_retake_recommended",
                    "message": "Retake the customer photograph before generation.",
                    "quality_flags": readiness.captured_image.quality_flags,
                },
            )

        provider = _provider()
        prompt = (
            "Match the reference photograph's photographic style, scene, lighting, shadows, "
            "framing, composition, palette and mood. Maintain a realistic professional-photo finish."
        )
        if style_notes.strip():
            prompt += f" Additional direction: {style_notes.strip()}"

        hashed_safety_id = safety_identifier
        generated = await provider.generate(
            captured_image=captured.data,
            reference_image=reference.data,
            prompt=prompt,
            identity_preservation=(
                "Highest priority. The customer's face and identity must remain recognizable. "
                "Do not replace or blend the customer's face with the reference subject."
            ),
            safety_identifier=hashed_safety_id,
        )
        output_bytes, _ = prepare_generated_image(generated.data, settings.max_reference_pixels)
        return Response(
            content=output_bytes,
            media_type="image/webp",
            headers={
                "Cache-Control": "no-store",
                "X-Image-Provider": "openai",
                "X-Image-Model": generated.model,
                "X-Image-Review-Required": "true",
            },
        )
    except InvalidReferenceImage as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ProviderNotConfigured as exc:
        raise HTTPException(status_code=503, detail="Image generation provider is not configured.") from exc
    except ProviderTimeout as exc:
        raise HTTPException(status_code=504, detail="Image generation timed out. The job may be retried.") from exc
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    finally:
        await captured_image.close()
        await reference_image.close()
