from functools import lru_cache
import os

from pydantic import BaseModel, Field


class Settings(BaseModel):
    app_env: str = Field(default="development", alias="APP_ENV")
    cors_origins_raw: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    values = {
        "APP_ENV": os.getenv("APP_ENV", "development"),
        "CORS_ORIGINS": os.getenv("CORS_ORIGINS", "http://localhost:3000"),
    }
    return Settings.model_validate(values)
