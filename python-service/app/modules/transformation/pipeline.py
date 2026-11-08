from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

import cv2
import numpy as np
from PIL import Image

from app.modules.analysis.analyzer import InvalidReferenceImage, decode_reference_image
from app.modules.transformation.schemas import (
    ImageQualityReport,
    TransformationPreparationResponse,
)

MAX_OUTPUT_DIMENSION = 2048
JPEG_QUALITY = 94


@dataclass(frozen=True)
class PreparedImage:
    """Normalized in-memory image; originals remain untouched in private storage."""

    data: bytes
    report: ImageQualityReport


def _quality_report(image: Image.Image, image_format: str) -> ImageQualityReport:
    rgb = np.asarray(image, dtype=np.uint8)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    flags: list[str] = []
    recommendations: list[str] = []

    if min(image.size) < 480:
        flags.append("low_resolution")
        recommendations.append("Retake or upload a higher-resolution photograph for better detail.")
    if sharpness < 25:
        flags.append("low_sharpness")
        recommendations.append("The photograph may be out of focus; use a stable camera and retake if possible.")
    if brightness < 45:
        flags.append("underexposed")
        recommendations.append("Add soft, even light before capturing the photograph.")
    elif brightness > 220:
        flags.append("overexposed")
        recommendations.append("Reduce strong highlights or exposure before capturing the photograph.")
    if contrast < 16:
        flags.append("low_contrast")
        recommendations.append("Check whether the flat contrast is intentional before transformation.")
    if not recommendations:
        recommendations.append("No major technical image-quality warning was detected.")

    return ImageQualityReport(
        width=image.width,
        height=image.height,
        format=image_format,  # type: ignore[arg-type]
        sharpness_score=round(min(sharpness, 1000.0), 2),
        average_brightness=round(brightness, 2),
        contrast=round(contrast, 2),
        quality_flags=flags,
        recommendations=recommendations,
    )


def prepare_image(data: bytes, max_pixels: int) -> PreparedImage:
    """Decode safely, apply EXIF orientation, resize without cropping, and normalize."""
    image, image_format = decode_reference_image(data, max_pixels)
    image.thumbnail(
        (MAX_OUTPUT_DIMENSION, MAX_OUTPUT_DIMENSION),
        Image.Resampling.LANCZOS,
    )
    output = BytesIO()
    image.save(output, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return PreparedImage(
        data=output.getvalue(),
        report=_quality_report(image, image_format),
    )


def prepare_generated_image(data: bytes, max_pixels: int) -> tuple[bytes, ImageQualityReport]:
    """Validate provider output and normalize it to WebP before any storage step."""
    image, image_format = decode_reference_image(data, max_pixels)
    image.thumbnail((MAX_OUTPUT_DIMENSION, MAX_OUTPUT_DIMENSION), Image.Resampling.LANCZOS)
    output = BytesIO()
    image.save(output, format="WEBP", quality=92, method=5)
    return output.getvalue(), _quality_report(image, image_format)


def prepare_transformation(
    captured_image: bytes,
    reference_image: bytes,
    max_pixels: int,
    *,
    generation_provider: str = "not_configured",
    generation_available: bool = False,
) -> tuple[PreparedImage, PreparedImage, TransformationPreparationResponse]:
    """Prepare a capture/reference pair and return honest readiness diagnostics."""
    captured = prepare_image(captured_image, max_pixels)
    reference = prepare_image(reference_image, max_pixels)

    blocking_capture_flags = {
        "low_resolution",
        "low_sharpness",
        "underexposed",
        "overexposed",
    }
    retake_recommended = bool(
        blocking_capture_flags.intersection(captured.report.quality_flags)
    )
    response = TransformationPreparationResponse(
        status="retake_recommended" if retake_recommended else "ready_for_generation",
        generation_provider=generation_provider,
        generation_available=generation_available,
        captured_image=captured.report,
        reference_image=reference.report,
        notes=[
            "Input images were decoded, EXIF-normalized and resized without cropping.",
            "Original uploads are not modified by this preparation step.",
            "Quality metrics are heuristic checks, not face recognition or identity verification.",
            "A configured provider does not guarantee identity preservation; review every generated result.",
        ],
    )
    return captured, reference, response
