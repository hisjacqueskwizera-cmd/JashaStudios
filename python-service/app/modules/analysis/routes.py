import hmac
from fastapi import APIRouter, File, Header, HTTPException, UploadFile, status
from app.modules.analysis.analyzer import InvalidReferenceImage, analyze_reference, decode_reference_image
from app.modules.analysis.schemas import ReferenceAnalysisResponse
from app.settings import get_settings

router = APIRouter(prefix="/v1/analyze", tags=["reference-analysis"])

def _authorize(api_key: str | None) -> None:
    settings = get_settings()
    if settings.vision_api_key:
        if not api_key or not hmac.compare_digest(api_key, settings.vision_api_key):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid vision API key.")
    elif settings.app_env.lower() in {"production", "prod"}:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Vision API authentication is not configured.")

@router.post("/reference", response_model=ReferenceAnalysisResponse)
async def analyze_reference_image(
    file: UploadFile = File(...),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> ReferenceAnalysisResponse:
    """Analyze a reference image using deterministic computer-vision features."""
    _authorize(x_api_key)
    settings = get_settings()
    content = await file.read(settings.max_reference_upload_bytes + 1)
    if len(content) > settings.max_reference_upload_bytes:
        raise HTTPException(status_code=413, detail="Reference image exceeds the upload size limit.")
    try:
        image, image_format = decode_reference_image(content, settings.max_reference_pixels)
        return analyze_reference(image, image_format)
    except InvalidReferenceImage as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        await file.close()
