import pytest

from app.modules.transformation.worker import WorkerServiceError, _safe_job_path


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
