from __future__ import annotations

from math import atan2, degrees, hypot
from typing import Literal

from pydantic import BaseModel, Field

TRACKED = (11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28)


class PoseLandmark(BaseModel):
    x: float = Field(ge=-1, le=2)
    y: float = Field(ge=-1, le=2)
    z: float = Field(default=0, ge=-2, le=2)
    visibility: float = Field(default=1, ge=0, le=1)


class VirtualPhotographerRequest(BaseModel):
    reference_landmarks: list[PoseLandmark] = Field(min_length=33, max_length=33)
    captured_landmarks: list[PoseLandmark] = Field(min_length=33, max_length=33)


class VirtualPhotographerResponse(BaseModel):
    status: Literal["coaching", "no_person_detected"]
    similarity_score: int | None = Field(default=None, ge=0, le=100)
    instructions: list[str]
    confidence: float = Field(ge=0, le=1)
    engine: str = "python-virtual-photographer"


def _normalized(points: list[PoseLandmark]) -> dict[int, tuple[float, float]]:
    center_x = sum(points[index].x for index in (11, 12, 23, 24)) / 4
    center_y = sum(points[index].y for index in (11, 12, 23, 24)) / 4
    shoulder_width = hypot(points[11].x - points[12].x, points[11].y - points[12].y)
    torso_height = hypot(
        (points[11].x + points[12].x - points[23].x - points[24].x) / 2,
        (points[11].y + points[12].y - points[23].y - points[24].y) / 2,
    )
    scale = max(shoulder_width, torso_height, 0.08)
    return {
        index: ((points[index].x - center_x) / scale, (points[index].y - center_y) / scale)
        for index in TRACKED
    }


def _line_angle(a: PoseLandmark, b: PoseLandmark) -> float:
    return degrees(atan2(b.y - a.y, b.x - a.x))


def coach_pose(request: VirtualPhotographerRequest) -> VirtualPhotographerResponse:
    reference = request.reference_landmarks
    captured = request.captured_landmarks
    if any(reference[i].visibility < 0.35 or captured[i].visibility < 0.35 for i in TRACKED):
        return VirtualPhotographerResponse(
            status="no_person_detected",
            similarity_score=None,
            instructions=["Step back and keep your shoulders, hips, arms and legs visible in the camera frame."],
            confidence=0.0,
        )

    ref_norm = _normalized(reference)
    cap_norm = _normalized(captured)
    mean_error = sum(
        hypot(cap_norm[i][0] - ref_norm[i][0], cap_norm[i][1] - ref_norm[i][1])
        for i in TRACKED
    ) / len(TRACKED)
    score = max(0, min(100, round((1 - mean_error / 1.35) * 100)))

    tips: list[str] = []
    for index, side in ((15, "left"), (16, "right")):
        delta = captured[index].y - reference[index].y
        if delta > 0.14:
            tips.append(f"Raise your {side} hand slightly.")
        elif delta < -0.14:
            tips.append(f"Lower your {side} hand slightly.")

    current_center = sum(captured[i].x for i in (11, 12, 23, 24)) / 4
    reference_center = sum(reference[i].x for i in (11, 12, 23, 24)) / 4
    if current_center - reference_center > 0.08:
        tips.append("Move a little to your left to match the framing.")
    elif reference_center - current_center > 0.08:
        tips.append("Move a little to your right to match the framing.")

    shoulder_delta = _line_angle(captured[11], captured[12]) - _line_angle(reference[11], reference[12])
    if abs(shoulder_delta) > 12:
        tips.append("Adjust your shoulders to match the reference angle.")

    if not tips:
        if score >= 88:
            tips.append("Excellent match. Hold still while the photograph is taken.")
        elif score >= 72:
            tips.append("Very close. Make a small adjustment and hold the pose.")
        else:
            tips.append("Adjust your arm and leg positions to get closer to the reference pose.")

    return VirtualPhotographerResponse(
        status="coaching",
        similarity_score=score,
        instructions=tips[:3],
        confidence=round(sum(captured[i].visibility for i in TRACKED) / len(TRACKED), 3),
    )
