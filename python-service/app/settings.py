from functools import lru_cache
import os
from pydantic import BaseModel, Field


class Settings(BaseModel):
    app_env: str = Field(default="development", alias="APP_ENV")
    cors_origins_raw: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")
    vision_api_key: str = Field(default="", alias="VISION_API_KEY")
    transformation_enabled: bool = Field(default=False, alias="TRANSFORMATION_ENABLED")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_image_model: str = Field(default="gpt-image-2.5-sunburst", alias="OPENAI_IMAGE_MODEL")
    openai_image_timeout_seconds: float = Field(default=240, ge=30, le=600, alias="OPENAI_IMAGE_TIMEOUT_SECONDS")
    max_reference_upload_bytes: int = Field(default=15 * 1024 * 1024, alias="MAX_REFERENCE_UPLOAD_BYTES")
    max_reference_pixels: int = Field(default=40_000_000, alias="MAX_REFERENCE_PIXELS")
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_secret_key: str = Field(default="", alias="SUPABASE_SECRET_KEY")
    transformation_worker_id: str = Field(default="", alias="TRANSFORMATION_WORKER_ID")
    transformation_poll_interval_seconds: float = Field(default=3, ge=1, le=60, alias="TRANSFORMATION_POLL_INTERVAL_SECONDS")
    transformation_job_lease_seconds: int = Field(default=300, ge=60, le=900, alias="TRANSFORMATION_JOB_LEASE_SECONDS")
    transformation_max_attempts: int = Field(default=3, ge=1, le=10, alias="TRANSFORMATION_MAX_ATTEMPTS")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings.model_validate({
        "APP_ENV": os.getenv("APP_ENV", "development"),
        "CORS_ORIGINS": os.getenv("CORS_ORIGINS", "http://localhost:3000"),
        "VISION_API_KEY": os.getenv("VISION_API_KEY", ""),
        "TRANSFORMATION_ENABLED": os.getenv("TRANSFORMATION_ENABLED", "false"),
        "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", ""),
        "OPENAI_IMAGE_MODEL": os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-2.5-sunburst"),
        "OPENAI_IMAGE_TIMEOUT_SECONDS": os.getenv("OPENAI_IMAGE_TIMEOUT_SECONDS", "240"),
        "MAX_REFERENCE_UPLOAD_BYTES": os.getenv("MAX_REFERENCE_UPLOAD_BYTES", str(15 * 1024 * 1024)),
        "MAX_REFERENCE_PIXELS": os.getenv("MAX_REFERENCE_PIXELS", "40000000"),
        "SUPABASE_URL": os.getenv("SUPABASE_URL", ""),
        "SUPABASE_SECRET_KEY": os.getenv("SUPABASE_SECRET_KEY", ""),
        "TRANSFORMATION_WORKER_ID": os.getenv("TRANSFORMATION_WORKER_ID", ""),
        "TRANSFORMATION_POLL_INTERVAL_SECONDS": os.getenv("TRANSFORMATION_POLL_INTERVAL_SECONDS", "3"),
        "TRANSFORMATION_JOB_LEASE_SECONDS": os.getenv("TRANSFORMATION_JOB_LEASE_SECONDS", "300"),
        "TRANSFORMATION_MAX_ATTEMPTS": os.getenv("TRANSFORMATION_MAX_ATTEMPTS", "3"),
    })
