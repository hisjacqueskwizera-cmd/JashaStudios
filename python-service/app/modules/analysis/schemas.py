from typing import Literal
from pydantic import BaseModel, Field

class ImageMetadata(BaseModel):
    width: int
    height: int
    aspect_ratio: float
    orientation: Literal["landscape", "portrait", "square"]
    format: str

class LightingAnalysis(BaseModel):
    average_brightness: float = Field(ge=0, le=255)
    contrast: float = Field(ge=0, le=128)
    exposure: Literal["underexposed", "balanced", "overexposed"]
    estimated_brightest_region: str
    estimated_shadow_region: str
    notes: list[str]

class ColorAnalysis(BaseModel):
    average_saturation: float = Field(ge=0, le=255)
    color_temperature: Literal["warm", "neutral", "cool"]
    dominant_colors: list[str]
    palette_description: str

class CompositionAnalysis(BaseModel):
    framing: str
    visual_weight_region: str
    edge_density_by_region: dict[str, float]
    notes: list[str]

class QualityAnalysis(BaseModel):
    sharpness_score: float = Field(ge=0)
    quality_flags: list[str]
    recommendations: list[str]

class PoseAnalysis(BaseModel):
    status: Literal["model_not_configured", "detected", "no_person_detected", "analysis_failed"]
    model: str | None = None
    landmarks: list[dict[str, float | int | str]] = Field(default_factory=list)
    notes: list[str]

class ReferenceAnalysisResponse(BaseModel):
    analysis_version: str
    image: ImageMetadata
    lighting: LightingAnalysis
    color: ColorAnalysis
    composition: CompositionAnalysis
    quality: QualityAnalysis
    pose: PoseAnalysis
    summary: list[str]
