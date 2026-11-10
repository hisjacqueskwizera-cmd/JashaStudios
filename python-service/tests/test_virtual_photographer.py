from app.modules.analysis.photographer import PoseLandmark, VirtualPhotographerRequest, coach_pose


def make_pose():
    points = [PoseLandmark(x=0.5, y=0.5, visibility=1) for _ in range(33)]
    points[11] = PoseLandmark(x=0.42, y=0.25)
    points[12] = PoseLandmark(x=0.58, y=0.25)
    points[13] = PoseLandmark(x=0.36, y=0.38)
    points[14] = PoseLandmark(x=0.64, y=0.38)
    points[15] = PoseLandmark(x=0.32, y=0.5)
    points[16] = PoseLandmark(x=0.68, y=0.5)
    points[23] = PoseLandmark(x=0.45, y=0.52)
    points[24] = PoseLandmark(x=0.55, y=0.52)
    points[25] = PoseLandmark(x=0.44, y=0.72)
    points[26] = PoseLandmark(x=0.56, y=0.72)
    points[27] = PoseLandmark(x=0.43, y=0.92)
    points[28] = PoseLandmark(x=0.57, y=0.92)
    return points


def test_virtual_photographer_scores_identical_pose_as_perfect():
    points = make_pose()
    result = coach_pose(VirtualPhotographerRequest(reference_landmarks=points, captured_landmarks=points))
    assert result.status == "coaching"
    assert result.similarity_score == 100
    assert result.instructions


def test_virtual_photographer_gives_actionable_hand_guidance():
    reference = make_pose()
    captured = make_pose()
    captured[15] = PoseLandmark(x=0.32, y=0.72)
    result = coach_pose(VirtualPhotographerRequest(reference_landmarks=reference, captured_landmarks=captured))
    assert result.status == "coaching"
    assert any("Raise your left hand" in tip for tip in result.instructions)


def test_virtual_photographer_handles_missing_landmarks():
    reference = make_pose()
    captured = make_pose()
    captured[15] = PoseLandmark(x=0.32, y=0.72, visibility=0.1)
    result = coach_pose(VirtualPhotographerRequest(reference_landmarks=reference, captured_landmarks=captured))
    assert result.status == "no_person_detected"
    assert result.similarity_score is None
