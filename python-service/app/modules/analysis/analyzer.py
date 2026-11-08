from __future__ import annotations
from collections import Counter
from io import BytesIO
import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from app.modules.analysis.schemas import (
    ColorAnalysis, CompositionAnalysis, ImageMetadata, LightingAnalysis,
    PoseAnalysis, QualityAnalysis, ReferenceAnalysisResponse,
)

SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP"}
REGIONS = ("top_left", "top_center", "top_right", "middle_left", "center", "middle_right", "bottom_left", "bottom_center", "bottom_right")

class InvalidReferenceImage(ValueError):
    """Raised when an uploaded reference cannot be safely decoded."""

def decode_reference_image(data: bytes, max_pixels: int) -> tuple[Image.Image, str]:
    if not data:
        raise InvalidReferenceImage("The uploaded file is empty.")
    try:
        with Image.open(BytesIO(data)) as source:
            image_format = (source.format or "").upper()
            if image_format not in SUPPORTED_FORMATS:
                raise InvalidReferenceImage("Only JPEG, PNG and WebP reference images are supported.")
            width, height = source.size
            if width < 64 or height < 64:
                raise InvalidReferenceImage("The reference image must be at least 64 × 64 pixels.")
            if width * height > max_pixels:
                raise InvalidReferenceImage("The reference image dimensions exceed the configured pixel limit.")
            source.verify()
        with Image.open(BytesIO(data)) as source:
            return ImageOps.exif_transpose(source).convert("RGB"), image_format
    except InvalidReferenceImage:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise InvalidReferenceImage("The uploaded file is not a valid supported image.") from exc

def _hex_color(rgb: tuple[int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)

def _dominant_colors(image: Image.Image) -> list[str]:
    sample = image.copy()
    sample.thumbnail((256, 256))
    quantized = sample.quantize(colors=5, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette() or []
    colors: list[str] = []
    for index, _ in Counter(quantized.getdata()).most_common(5):
        offset = index * 3
        if offset + 2 < len(palette):
            colors.append(_hex_color(tuple(palette[offset:offset + 3])))
    return colors

def analyze_reference(image: Image.Image, image_format: str) -> ReferenceAnalysisResponse:
    rgb = np.asarray(image, dtype=np.uint8)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    height, width = gray.shape
    ratio = round(width / height, 4)
    orientation = "landscape" if ratio > 1.05 else "portrait" if ratio < 0.95 else "square"

    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))
    under = float(np.mean(gray < 20))
    over = float(np.mean(gray > 235))
    exposure = "underexposed" if brightness < 75 or under > 0.35 else "overexposed" if brightness > 190 or over > 0.25 else "balanced"

    luminance: list[float] = []
    edges = cv2.Canny(gray, 80, 160)
    edge_density: dict[str, float] = {}
    for row in range(3):
        for col in range(3):
            y0, y1 = row * height // 3, (row + 1) * height // 3
            x0, x1 = col * width // 3, (col + 1) * width // 3
            luminance.append(float(np.mean(gray[y0:y1, x0:x1])))
            edge_density[REGIONS[row * 3 + col]] = round(float(np.mean(edges[y0:y1, x0:x1]) / 255), 4)
    bright_region = REGIONS[int(np.argmax(luminance))]
    shadow_region = REGIONS[int(np.argmin(luminance))]
    visual_region = max(edge_density, key=edge_density.get)

    saturation = float(np.mean(hsv[:, :, 1]))
    channel_means = np.mean(rgb.reshape(-1, 3), axis=0)
    delta = float(channel_means[0] - channel_means[2])
    temperature = "warm" if delta > 10 else "cool" if delta < -10 else "neutral"

    sharpness = round(min(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 1000.0), 2)
    flags: list[str] = []
    recommendations: list[str] = []
    if sharpness < 35:
        flags.append("low_sharpness")
        recommendations.append("Use a sharper, in-focus reference if fine detail matters.")
    if exposure != "balanced":
        flags.append(exposure)
        recommendations.append("Review exposure before using this reference as a lighting target.")
    if contrast < 25:
        flags.append("low_contrast")
        recommendations.append("Check whether the reference intentionally uses soft, low-contrast lighting.")
    if over > 0.12:
        flags.append("highlight_clipping_risk")
        recommendations.append("Important highlight detail may be clipped.")
    if not recommendations:
        recommendations.append("No major issue was found by these basic technical checks.")

    framing = ("wide_landscape" if ratio >= 1.7 else "landscape" if ratio > 1.05
               else "square" if orientation == "square" else "tall_portrait" if ratio <= 0.7 else "portrait")
    color_description = f"{temperature.capitalize()} overall color cast with {'muted' if saturation < 55 else 'moderate' if saturation < 115 else 'vivid'} saturation."
    return ReferenceAnalysisResponse(
        analysis_version="1.0.0",
        image=ImageMetadata(width=width, height=height, aspect_ratio=ratio, orientation=orientation, format=image_format),
        lighting=LightingAnalysis(
            average_brightness=round(brightness, 2), contrast=round(contrast, 2), exposure=exposure,
            estimated_brightest_region=bright_region, estimated_shadow_region=shadow_region,
            notes=[
                f"Image luminance is highest in the {bright_region.replace('_', ' ')} region.",
                f"Image luminance is lowest in the {shadow_region.replace('_', ' ')} region.",
                "These image-space estimates do not identify a physical lamp or prove incident-light direction.",
            ],
        ),
        color=ColorAnalysis(
            average_saturation=round(saturation, 2), color_temperature=temperature,
            dominant_colors=_dominant_colors(image), palette_description=color_description,
        ),
        composition=CompositionAnalysis(
            framing=framing, visual_weight_region=visual_region, edge_density_by_region=edge_density,
            notes=[
                f"Image orientation is {orientation} with {framing.replace('_', ' ')} framing.",
                f"Highest edge activity is in the {visual_region.replace('_', ' ')} region; this is not person detection.",
            ],
        ),
        quality=QualityAnalysis(sharpness_score=sharpness, quality_flags=flags, recommendations=recommendations),
        pose=PoseAnalysis(
            status="model_not_configured", landmarks=[],
            notes=["No pose model is configured. Do not use this result as pose guidance."],
        ),
        summary=[
            f"{framing.replace('_', ' ').capitalize()} composition ({width} × {height}).",
            f"{exposure.capitalize()} exposure with {contrast:.1f} grayscale contrast.",
            color_description,
            "Body-pose landmarks are unavailable until a validated pose model and model asset are configured.",
        ],
    )
