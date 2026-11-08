from typing import Literal

from pydantic import BaseModel, Field


class ImageQualityReport(BaseModel):
    width: int = Field(ge=64)
    height: int = Field(ge=64)
    format: Literal["JPEG", "PNG", "WEBP"]
    sharpness_score: float = Field(ge=0)
    average_brightness: float = Field(ge=0, le=255)
    contrast: float = Field(ge=0, le=128)
    quality_flags: list[str]
    recommendations: list[str]


class TransformationPreparationResponse(BaseModel):
    status: Literal["ready_for_generation", "retake_recommended"]
    generation_provider: str
    generation_available: bool
    captured_image: ImageQualityReport
    reference_image: ImageQualityReport
    notes: list[str]
