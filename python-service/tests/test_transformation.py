from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.modules.transformation.pipeline import (
    MAX_OUTPUT_DIMENSION,
    prepare_image,
    prepare_transformation,
)

client = TestClient(app)


def image_bytes(size: tuple[int, int] = (900, 1200), color: tuple[int, int, int] = (110, 125, 140)) -> bytes:
    image = Image.new("RGB", size, color)
    output = BytesIO()
    image.save(output, format="JPEG")
    return output.getvalue()


def test_prepare_image_normalizes_to_jpeg_without_upscaling() -> None:
    prepared = prepare_image(image_bytes((1600, 1200)), 5_000_000)
    with Image.open(BytesIO(prepared.data)) as output:
        assert output.format == "JPEG"
        assert output.size == (1600, 1200)
    assert prepared.report.width == 1600
    assert prepared.report.height == 1200


def test_prepare_image_caps_long_edge_without_cropping() -> None:
    prepared = prepare_image(image_bytes((3000, 2000)), 10_000_000)
    with Image.open(BytesIO(prepared.data)) as output:
        assert max(output.size) == MAX_OUTPUT_DIMENSION
        assert output.size == (MAX_OUTPUT_DIMENSION, 1365)


def test_prepare_transformation_never_claims_generation_is_available() -> None:
    _, _, result = prepare_transformation(
        image_bytes(),
        image_bytes((1200, 900), (90, 100, 120)),
        5_000_000,
    )
    assert result.generation_provider == "not_configured"
    assert result.generation_available is False
    assert result.status in {"ready_for_generation", "retake_recommended"}
    assert any("not face recognition" in note for note in result.notes)


def test_prepare_endpoint_returns_quality_and_provider_readiness() -> None:
    response = client.post(
        "/v1/transform/prepare",
        files={
            "captured_image": ("capture.jpg", image_bytes(), "image/jpeg"),
            "reference_image": ("reference.jpg", image_bytes((1200, 900)), "image/jpeg"),
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["generation_provider"] == "not_configured"
    assert payload["generation_available"] is False
    assert payload["captured_image"]["format"] == "JPEG"


def test_prepare_endpoint_rejects_invalid_capture() -> None:
    response = client.post(
        "/v1/transform/prepare",
        files={
            "captured_image": ("capture.jpg", b"invalid", "image/jpeg"),
            "reference_image": ("reference.jpg", image_bytes(), "image/jpeg"),
        },
    )
    assert response.status_code == 422


def test_prepare_endpoint_requires_configured_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.modules.transformation import routes

    monkeypatch.setattr(
        routes,
        "get_settings",
        lambda: type(
            "Settings",
            (),
            {
                "vision_api_key": "expected-secret",
                "app_env": "development",
                "max_reference_upload_bytes": 15 * 1024 * 1024,
                "max_reference_pixels": 40_000_000,
            },
        )(),
    )
    response = client.post(
        "/v1/transform/prepare",
        files={
            "captured_image": ("capture.jpg", image_bytes(), "image/jpeg"),
            "reference_image": ("reference.jpg", image_bytes(), "image/jpeg"),
        },
    )
    assert response.status_code == 401
