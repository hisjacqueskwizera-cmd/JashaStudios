from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass
from typing import Protocol

import httpx

OPENAI_IMAGE_EDIT_URL = "https://api.openai.com/v1/images/edits"
MAX_IMAGE_DATA_URL_LENGTH = 20_971_520


class ProviderNotConfigured(RuntimeError):
    """Raised when no production image-generation provider is configured."""


class ProviderError(RuntimeError):
    """Base class for safe, user-independent provider failures."""


class ProviderUnavailable(ProviderError):
    """The provider is temporarily unavailable or rate limited."""


class ProviderTimeout(ProviderUnavailable):
    """The provider did not respond within the configured timeout."""


class ProviderRejected(ProviderError):
    """The provider rejected the request."""


class ProviderResponseError(ProviderError):
    """The provider returned an invalid or incomplete image response."""


@dataclass(frozen=True)
class GeneratedImage:
    data: bytes
    model: str
    mime_type: str


class ImageGenerationProvider(Protocol):
    async def generate(
        self,
        *,
        captured_image: bytes,
        reference_image: bytes,
        prompt: str,
        identity_preservation: str,
        safety_identifier: str | None = None,
    ) -> GeneratedImage:
        """Return generated image bytes and provider metadata."""
        ...


def _image_data_url(data: bytes) -> str:
    encoded = base64.b64encode(data).decode("ascii")
    data_url = f"data:image/jpeg;base64,{encoded}"
    if len(data_url) > MAX_IMAGE_DATA_URL_LENGTH:
        raise ProviderRejected("Prepared image is too large for the provider image-reference limit.")
    return data_url


class OpenAIImageGenerationProvider:
    """OpenAI Images API adapter using two ordered image references."""

    def __init__(self, *, api_key: str, model: str, timeout_seconds: float = 240) -> None:
        if not api_key:
            raise ProviderNotConfigured("OpenAI image generation credentials are not configured.")
        self._api_key = api_key
        self.model = model
        self._timeout = httpx.Timeout(timeout_seconds, connect=15)

    async def generate(
        self,
        *,
        captured_image: bytes,
        reference_image: bytes,
        prompt: str,
        identity_preservation: str,
        safety_identifier: str | None = None,
    ) -> GeneratedImage:
        full_prompt = (
            "Create one photorealistic professional photograph. The first input image is the "
            "customer's photograph and is the sole source of the customer's identity. Preserve "
            "that person's recognizable facial structure, eyes, nose, mouth, skin characteristics, "
            "hairline, hairstyle and natural body proportions. Do not transfer the reference "
            "person's identity or facial features. The second input image is a visual-style and "
            "composition reference only. Recreate its photographic treatment: scene/background, "
            "lighting direction and softness, shadows, depth, framing, camera perspective, color "
            "grading and overall mood. Match its pose and composition only where anatomically "
            "natural and consistent with the customer's captured body; do not warp anatomy or "
            "invent details. Keep hands, fingers, clothing and accessories realistic. If exact "
            "identity or anatomy cannot be maintained, favor the customer's original appearance "
            "over an aggressive transformation. The result must look like a real photograph.\n\n"
            f"Identity preservation priority: {identity_preservation}\n"
            f"Additional studio direction: {prompt}"
        )
        if len(full_prompt) > 32_000:
            raise ProviderRejected("The transformation prompt exceeds the provider limit.")

        payload: dict[str, object] = {
            "model": self.model,
            "images": [
                {"image_url": _image_data_url(captured_image)},
                {"image_url": _image_data_url(reference_image)},
            ],
            "prompt": full_prompt,
            "quality": "high",
            "size": "auto",
            "output_format": "webp",
            "output_compression": 90,
            "n": 1,
            "moderation": "auto",
        }
        if safety_identifier:
            payload["safety_identifier"] = safety_identifier

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    OPENAI_IMAGE_EDIT_URL,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json=payload,
                )
        except httpx.TimeoutException as exc:
            raise ProviderTimeout("Image generation timed out.") from exc
        except httpx.RequestError as exc:
            raise ProviderUnavailable("Image generation provider could not be reached.") from exc

        if response.status_code == 429 or response.status_code >= 500:
            raise ProviderUnavailable("Image generation provider is temporarily unavailable.")
        if response.status_code >= 400:
            raise ProviderRejected("Image generation provider rejected the transformation request.")

        try:
            body = response.json()
            encoded = body["data"][0]["b64_json"]
            image_bytes = base64.b64decode(encoded, validate=True)
        except (ValueError, TypeError, KeyError, IndexError, binascii.Error) as exc:
            raise ProviderResponseError("Image generation provider returned an invalid image payload.") from exc

        if not image_bytes:
            raise ProviderResponseError("Image generation provider returned an empty image.")
        return GeneratedImage(data=image_bytes, model=self.model, mime_type="image/webp")
