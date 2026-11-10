import asyncio

import pytest

from app.modules.transformation.worker import (
    WorkerServiceError,
    _safe_job_path,
    _validate_worker_lease,
    TransformationWorker,
)


def test_safe_job_path_accepts_owner_project_scoped_path() -> None:
    assert _safe_job_path(
        "user-1/project-1/captures/photo.webp",
        "user-1",
        "project-1",
    ) == "user-1/project-1/captures/photo.webp"


@pytest.mark.parametrize(
    "path",
    [
        "../other-user/photo.webp",
        "/user-1/project-1/photo.webp",
        "user-2/project-1/photo.webp",
        "user-1/project-2/photo.webp",
        "user-1/project-1/../private.webp",
        "user-1\\project-1\\photo.webp",
    ],
)
def test_safe_job_path_rejects_path_traversal_and_cross_owner_assets(path: str) -> None:
    with pytest.raises(WorkerServiceError):
        _safe_job_path(path, "user-1", "project-1")


def test_generated_attempt_path_is_owner_and_project_scoped() -> None:
    path = "user-1/project-1/generated/job-123-attempt-2.webp"
    assert _safe_job_path(path, "user-1", "project-1") == path


@pytest.mark.parametrize(
    ("lease_seconds", "provider_timeout"),
    [(300, 240), (631, 600), (900, 600)],
)
def test_worker_lease_exceeds_provider_timeout(
    lease_seconds: int,
    provider_timeout: float,
) -> None:
    _validate_worker_lease(lease_seconds, provider_timeout)


@pytest.mark.parametrize(
    ("lease_seconds", "provider_timeout"),
    [(300, 270), (300, 300), (60, 240), (630, 600)],
)
def test_worker_lease_rejects_provider_timeout_that_can_outlive_lease(
    lease_seconds: int,
    provider_timeout: float,
) -> None:
    with pytest.raises(ValueError):
        _validate_worker_lease(lease_seconds, provider_timeout)

def test_worker_progress_updates_are_lease_scoped() -> None:
    worker = object.__new__(TransformationWorker)
    worker.worker_id = "worker-1"
    calls: list[tuple[str, dict[str, object]]] = []

    async def rpc(name: str, payload: dict[str, object]):
        calls.append((name, payload))
        return True

    worker._rpc = rpc
    asyncio.run(worker._set_progress("job-1", "segmenting", 45))
    assert calls == [(
        "update_transformation_job_progress",
        {
            "p_job_id": "job-1",
            "p_worker_id": "worker-1",
            "p_stage": "segmenting",
            "p_progress": 45,
        },
    )]


def test_worker_progress_stops_when_lease_is_lost() -> None:
    worker = object.__new__(TransformationWorker)
    worker.worker_id = "worker-1"

    async def rpc(_name: str, _payload: dict[str, object]):
        return False

    worker._rpc = rpc
    with pytest.raises(WorkerServiceError) as error:
        asyncio.run(worker._set_progress("job-1", "uploading", 92))
    assert error.value.code == "job_lease_lost"
