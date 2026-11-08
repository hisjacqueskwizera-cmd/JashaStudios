from fastapi.testclient import TestClient

from app.main import app, settings

client = TestClient(app)


def test_health_endpoint_returns_service_status() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "jasha-vision-api"


def test_readiness_endpoint_returns_ready_in_development() -> None:
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"


def test_production_readiness_requires_internal_api_key(monkeypatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "vision_api_key", "")

    response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["detail"] == "Service configuration incomplete."
