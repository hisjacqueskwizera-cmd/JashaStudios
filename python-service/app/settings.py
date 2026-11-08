from functools import lru_cache
import os
from pydantic import BaseModel, Field

class Settings(BaseModel):
    app_env: str = Field(default="development", alias="APP_ENV")
    cors_origins_raw: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")
    vision_api_key: str = Field(default="", alias="VISION_API_KEY")
    max_reference_upload_bytes: int = Field(default=15 * 1024 * 1024, alias="MAX_REFERENCE_UPLOAD_BYTES")
    max_reference_pixels: int = Field(default=40_000_000, alias="MAX_REFERENCE_PIXELS")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings.model_validate({
        "APP_ENV": os.getenv("APP_ENV", "development"),
        "CORS_ORIGINS": os.getenv("CORS_ORIGINS", "http://localhost:3000"),
        "VISION_API_KEY": os.getenv("VISION_API_KEY", ""),
        "MAX_REFERENCE_UPLOAD_BYTES": os.getenv("MAX_REFERENCE_UPLOAD_BYTES", str(15 * 1024 * 1024)),
        "MAX_REFERENCE_PIXELS": os.getenv("MAX_REFERENCE_PIXELS", "40000000"),
    })
