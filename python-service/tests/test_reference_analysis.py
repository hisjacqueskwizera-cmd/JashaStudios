from io import BytesIO
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from app.main import app
from app.modules.analysis.analyzer import InvalidReferenceImage, analyze_reference, decode_reference_image

client = TestClient(app)

def image_bytes(size: tuple[int, int] = (300, 400)) -> bytes:
    image = Image.new("RGB", size, (120, 100, 80))
    output = BytesIO()
    image.save(output, format="JPEG")
    return output.getvalue()

def test_decode_reference_image() -> None:
    image, fmt = decode_reference_image(image_bytes(), 1_000_000)
    assert image.size == (300, 400)
    assert image.mode == "RGB"
    assert fmt == "JPEG"

def test_rejects_empty_and_invalid_files() -> None:
    with pytest.raises(InvalidReferenceImage):
        decode_reference_image(b"", 1_000_000)
    with pytest.raises(InvalidReferenceImage):
        decode_reference_image(b"not an image", 1_000_000)

def test_rejects_images_over_pixel_limit() -> None:
    with pytest.raises(InvalidReferenceImage, match="pixel limit"):
        decode_reference_image(image_bytes(), 100)

def test_analyzer_returns_bounded_metrics_and_explicit_pose_status() -> None:
    image, fmt = decode_reference_image(image_bytes(), 1_000_000)
    result = analyze_reference(image, fmt)
    assert result.image.orientation == "portrait"
    assert 0 <= result.lighting.average_brightness <= 255
    assert result.pose.status == "model_not_configured"
    assert result.pose.landmarks == []
    assert result.color.dominant_colors

def test_reference_endpoint_returns_structured_analysis() -> None:
    response = client.post("/v1/analyze/reference", files={"file": ("reference.jpg", image_bytes(), "image/jpeg")})
    assert response.status_code == 200
    payload = response.json()
    assert payload["analysis_version"] == "1.0.0"
    assert payload["image"]["orientation"] == "portrait"
    assert payload["pose"]["status"] == "model_not_configured"

def test_reference_endpoint_rejects_invalid_file() -> None:
    response = client.post("/v1/analyze/reference", files={"file": ("reference.jpg", b"invalid", "image/jpeg")})
    assert response.status_code == 422

def test_reference_endpoint_rejects_oversized_upload(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.modules.analysis import routes
    monkeypatch.setattr(routes, "get_settings", lambda: type("Settings", (), {
        "vision_api_key": "", "app_env": "development", "max_reference_upload_bytes": 8, "max_reference_pixels": 1_000_000
    })())
    response = client.post("/v1/analyze/reference", files={"file": ("reference.jpg", image_bytes(), "image/jpeg")})
    assert response.status_code == 413

def test_configured_api_key_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.modules.analysis import routes
    monkeypatch.setattr(routes, "get_settings", lambda: type("Settings", (), {
        "vision_api_key": "expected-secret", "app_env": "development",
        "max_reference_upload_bytes": 15 * 1024 * 1024, "max_reference_pixels": 40_000_000
    })())
    denied = client.post("/v1/analyze/reference", files={"file": ("reference.jpg", image_bytes(), "image/jpeg")})
    allowed = client.post("/v1/analyze/reference", headers={"X-API-Key": "expected-secret"},
                          files={"file": ("reference.jpg", image_bytes(), "image/jpeg")})
    assert denied.status_code == 401
    assert allowed.status_code == 200
