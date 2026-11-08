from typing import Protocol


class ProviderNotConfigured(RuntimeError):
    """Raised when no production image-generation provider is configured."""


class ImageGenerationProvider(Protocol):
    """Provider boundary; implementations must preserve input provenance and report model IDs."""

    async def generate(
        self,
        *,
        captured_image: bytes,
        reference_image: bytes,
        prompt: str,
        identity_preservation: str,
    ) -> bytes:
        """Return generated image bytes or raise a typed provider error."""
        ...
