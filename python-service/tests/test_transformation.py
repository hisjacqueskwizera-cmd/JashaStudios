import asyncio
from base64 import b64encode
from io import BytesIO

import httpx
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
from app.modules.transformation.providers import (
    OPENAI_IMAGE_EDIT_URL,
    OpenAIImageGenerationProvider,
    ProviderRejected,
    ProviderResponseError,
    ProviderTimeout,
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
        generation_provider="openai",
        generation_available=True,
    )
    assert result.generation_provider == "openai"
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
                "openai_api_key": "test-key",
                "openai_image_model": "gpt-image-2.5-sunburst",
                "openai_image_timeout_seconds": 240,
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
    assert payload["generation_provider"] == "openai"
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


def test_openai_provider_sends_capture_first_and_returns_webp(monkeypatch: pytest.MonkeyPatch) -> None:
    expected = image_bytes((640, 800))
    captured_payload: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == OPENAI_IMAGE_EDIT_URL
        assert request.headers["Authorization"] == "Bearer test-key"
        captured_payload.update(__import__("json").loads(request.content))
        return httpx.Response(200, json={"data": [{"b64_json": b64encode(expected).decode("ascii")}]})

    original_client = httpx.AsyncClient
    monkeypatch.setattr(
        "app.modules.transformation.providers.httpx.AsyncClient",
        lambda **kwargs: original_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    provider = OpenAIImageGenerationProvider(api_key="test-key", model="gpt-image-2.5-sunburst")
    result = asyncio.run(provider.generate(
        captured_image=b"customer-capture",
        reference_image=b"style-reference",
        prompt="studio portrait",
        identity_preservation="preserve identity",
        safety_identifier="a" * 64,
    ))
    payload = captured_payload
    assert result.data == expected
    assert result.mime_type == "image/webp"
    assert result.model == "gpt-image-2.5-sunburst"
    images = payload["images"]
    assert isinstance(images, list) and len(images) == 2
    assert images[0]["image_url"].endswith(b64encode(b"customer-capture").decode("ascii"))
    assert images[1]["image_url"].endswith(b64encode(b"style-reference").decode("ascii"))
    assert payload["safety_identifier"] == "a" * 64
    assert payload["quality"] == "high"


def test_openai_provider_rejects_provider_http_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    original_client = httpx.AsyncClient

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": {"message": "private provider detail"}})

    monkeypatch.setattr(
        "app.modules.transformation.providers.httpx.AsyncClient",
        lambda **kwargs: original_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    provider = OpenAIImageGenerationProvider(api_key="test-key", model="gpt-image-2.5-sunburst")
    with pytest.raises(ProviderRejected):
        asyncio.run(provider.generate(
            captured_image=b"capture",
            reference_image=b"reference",
            prompt="test",
            identity_preservation="preserve",
        ))


def test_openai_provider_rejects_invalid_image_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    original_client = httpx.AsyncClient

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": [{"b64_json": "not-base64!"}]})

    monkeypatch.setattr(
        "app.modules.transformation.providers.httpx.AsyncClient",
        lambda **kwargs: original_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    provider = OpenAIImageGenerationProvider(api_key="test-key", model="gpt-image-2.5-sunburst")
    with pytest.raises(ProviderResponseError):
        asyncio.run(provider.generate(
            captured_image=b"capture",
            reference_image=b"reference",
            prompt="test",
            identity_preservation="preserve",
        ))


def test_openai_provider_maps_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    original_client = httpx.AsyncClient

    def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out")

    monkeypatch.setattr(
        "app.modules.transformation.providers.httpx.AsyncClient",
        lambda **kwargs: original_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    provider = OpenAIImageGenerationProvider(api_key="test-key", model="gpt-image-2.5-sunburst")
    with pytest.raises(ProviderTimeout):
        asyncio.run(provider.generate(
            captured_image=b"capture",
            reference_image=b"reference",
            prompt="test",
            identity_preservation="preserve",
        ))
