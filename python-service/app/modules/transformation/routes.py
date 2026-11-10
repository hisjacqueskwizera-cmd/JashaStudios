import hmac

from fastapi import APIRouter, File, Header, HTTPException, Response, UploadFile, status

from app.modules.analysis.analyzer import InvalidReferenceImage
from app.modules.transformation.pipeline import (
    prepare_generated_image,
    prepare_transformation,
)
from app.modules.transformation.local_engine import LocalModelUnavailable, transform_photograph
from app.modules.transformation.schemas import TransformationPreparationResponse
from app.settings import get_settings

router = APIRouter(prefix="/v1/transform", tags=["image-transformation"])


def _authorize(api_key: str | None) -> None:
    settings = get_settings()
    if settings.vision_api_key:
        if not api_key or not hmac.compare_digest(api_key, settings.vision_api_key):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid vision API key.")
    elif settings.app_env.lower() in {"production", "prod"}:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transformation API authentication is not configured.",
        )


async def _read_limited(file: UploadFile, limit: int) -> bytes:
    content = await file.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(status_code=413, detail="Image exceeds the configured upload size limit.")
    return content


@router.post("/prepare", response_model=TransformationPreparationResponse)
async def prepare_transformation_request(
    captured_image: UploadFile = File(...),
    reference_image: UploadFile = File(...),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> TransformationPreparationResponse:
    """Validate and prepare a capture/reference pair before a generation job is queued."""
    _authorize(x_api_key)
    settings = get_settings()
    try:
        captured_bytes = await _read_limited(captured_image, settings.max_reference_upload_bytes)
        reference_bytes = await _read_limited(reference_image, settings.max_reference_upload_bytes)
        _, _, response = prepare_transformation(
            captured_bytes,
            reference_bytes,
            settings.max_reference_pixels,
            generation_provider="local_opencv_rembg",
            generation_available=settings.local_transform_enabled,
        )
        return response
    except InvalidReferenceImage as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        await captured_image.close()
        await reference_image.close()


@router.post("/generate")
async def generate_transformation_request(
    captured_image: UploadFile = File(...),
    reference_image: UploadFile = File(...),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> Response:
    """Run the local open-source segmentation and OpenCV composition pipeline."""
    _authorize(x_api_key)
    settings = get_settings()
    if not settings.transformation_enabled or not settings.local_transform_enabled:
        raise HTTPException(status_code=503, detail="Local photo transformation is not enabled.")
    try:
        captured_bytes = await _read_limited(captured_image, settings.max_reference_upload_bytes)
        reference_bytes = await _read_limited(reference_image, settings.max_reference_upload_bytes)
        _, _, readiness = prepare_transformation(
            captured_bytes,
            reference_bytes,
            settings.max_reference_pixels,
            generation_provider="local_opencv_rembg",
            generation_available=True,
        )
        if readiness.status == "retake_recommended":
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "capture_quality_retake_recommended",
                    "message": "Retake the customer photograph before generation.",
                    "quality_flags": readiness.captured_image.quality_flags,
                },
            )
        output_bytes, model_name = transform_photograph(
            captured_bytes, reference_bytes, settings.max_reference_pixels
        )
        output_bytes, _ = prepare_generated_image(output_bytes, settings.max_reference_pixels)
        return Response(
            content=output_bytes,
            media_type="image/webp",
            headers={
                "Cache-Control": "no-store",
                "X-Image-Provider": "local",
                "X-Image-Model": model_name,
                "X-Image-Review-Required": "true",
            },
        )
    except InvalidReferenceImage as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LocalModelUnavailable as exc:
        raise HTTPException(status_code=503, detail="The local open-source segmentation model is unavailable.") from exc
    finally:
        await captured_image.close()
        await reference_image.close()
