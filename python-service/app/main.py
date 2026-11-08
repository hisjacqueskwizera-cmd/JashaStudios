from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.modules.analysis.routes import router as reference_analysis_router
from app.settings import get_settings

settings = get_settings()
app = FastAPI(title="Jasha Studios Vision API", version="0.2.0", description="Computer vision service for Jasha Studios.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-API-Key"],
)
app.include_router(reference_analysis_router)

@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    """Liveness endpoint. Does not imply database or model readiness."""
    return {"status": "ok", "service": "jasha-vision-api", "environment": settings.app_env}
