from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.modules.transformation.pipeline import (
    MAX_OUTPUT_DIMENSION,
    prepare_generated_image,
    prepare_image,
    prepare_transformation,
)

client = TestClient(app)


def image_bytes(size: tuple[int, int] = (900, 1200), color: tuple[int, int, int] = (110, 125, 140)) -> bytes:
    image = Image.new("RGB", size, color)
    output = BytesIO()
    image.save(output, format="JPEG", quality=95)
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


def test_prepare_transformation_reports_provider_readiness() -> None:
    _, _, result = prepare_transformation(
        image_bytes(),
        image_bytes((1200, 900), (90, 100, 120)),
        5_000_000,
        generation_provider="local_opencv_rembg",
        generation_available=True,
    )
    assert result.generation_provider == "local_opencv_rembg"
    assert result.generation_available is True
    assert result.status in {"ready_for_generation", "retake_recommended"}
    assert any("not face recognition" in note for note in result.notes)


def test_prepare_transformation_defaults_to_unconfigured() -> None:
    _, _, result = prepare_transformation(image_bytes(), image_bytes(), 5_000_000)
    assert result.generation_provider == "not_configured"
    assert result.generation_available is False


def test_prepare_generated_image_validates_and_normalizes_webp() -> None:
    output, report = prepare_generated_image(image_bytes((1100, 900)), 5_000_000)
    with Image.open(BytesIO(output)) as image:
        assert image.format == "WEBP"
        assert image.size == (1100, 900)
    assert report.width == 1100


def test_prepare_endpoint_returns_quality_and_provider_readiness() -> None:
    from app.modules.transformation import routes

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        routes,
        "get_settings",
        lambda: type(
            "Settings",
            (),
            {
                "vision_api_key": "",
                "local_transform_enabled": True,
                "app_env": "development",
                "max_reference_upload_bytes": 15 * 1024 * 1024,
                "max_reference_pixels": 40_000_000,
            },
        )(),
    )
    try:
        response = client.post(
            "/v1/transform/prepare",
            files={
                "captured_image": ("capture.jpg", image_bytes(), "image/jpeg"),
                "reference_image": ("reference.jpg", image_bytes((1200, 900)), "image/jpeg"),
            },
        )
    finally:
        monkeypatch.undo()
    assert response.status_code == 200
    payload = response.json()
    assert payload["generation_provider"] == "local_opencv_rembg"
    assert payload["generation_available"] is True
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
                "max_reference_pixels": 5_000_000,
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



def test_local_transform_composites_captured_subject_on_reference_scene(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.modules.transformation import local_engine

    capture_bytes = image_bytes((128, 128), (20, 80, 120))
    reference_bytes = image_bytes((128, 128), (150, 120, 90))

    def cutout(data: bytes, _max_pixels: int) -> Image.Image:
        image = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        from PIL import ImageDraw
        draw = ImageDraw.Draw(image)
        if data == capture_bytes:
            draw.rectangle((28, 18, 92, 116), fill=(20, 80, 120, 255))
        else:
            draw.rectangle((40, 14, 88, 112), fill=(150, 120, 90, 255))
        return image

    monkeypatch.setattr(local_engine, "_rgba_cutout", cutout)
    output, model = local_engine.transform_photograph(capture_bytes, reference_bytes, 1_000_000)

    with Image.open(BytesIO(output)) as result:
        assert result.format == "WEBP"
        assert result.size == (128, 128)
    assert model == "rembg-u2net+opencv-composite"


def test_local_transform_rejects_missing_foreground(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.modules.transformation import local_engine
    from app.modules.analysis.analyzer import InvalidReferenceImage

    image_data = image_bytes((128, 128))
    monkeypatch.setattr(local_engine, "_rgba_cutout", lambda *_: Image.new("RGBA", (128, 128), (0, 0, 0, 0)))
    with pytest.raises(InvalidReferenceImage):
        local_engine.transform_photograph(image_data, image_data, 1_000_000)
