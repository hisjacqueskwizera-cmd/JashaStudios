from __future__ import annotations

from io import BytesIO
from functools import lru_cache

import cv2
import numpy as np
from PIL import Image

from app.modules.analysis.analyzer import InvalidReferenceImage, decode_reference_image

MAX_OUTPUT_DIMENSION = 2048


class LocalModelUnavailable(RuntimeError):
    """The open-source foreground model is not installed or cannot be loaded."""


@lru_cache(maxsize=1)
def _segmentation_session():
    try:
        from rembg import new_session
        return new_session("u2net")
    except ImportError as exc:
        raise LocalModelUnavailable("Install rembg[cpu] to enable local subject segmentation.") from exc
    except Exception as exc:
        raise LocalModelUnavailable("The U2Net model could not be loaded.") from exc


def _rgba_cutout(data: bytes, max_pixels: int) -> Image.Image:
    image, _ = decode_reference_image(data, max_pixels)
    source = BytesIO()
    image.save(source, format="PNG")
    try:
        from rembg import remove

        result = remove(source.getvalue(), session=_segmentation_session(), alpha_matting=False)
        cutout = Image.open(BytesIO(result)).convert("RGBA")
        cutout.load()
        return cutout
    except ImportError as exc:
        raise LocalModelUnavailable(
            "Install the open-source rembg CPU model dependencies to enable local subject segmentation."
        ) from exc
    except Exception as exc:
        raise LocalModelUnavailable(
            "The local segmentation model could not be loaded. Check model access and available memory."
        ) from exc


def _subject_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = np.asarray(image.getchannel("A"), dtype=np.uint8)
    ys, xs = np.where(alpha > 24)
    if len(xs) < 100 or len(ys) < 100:
        raise InvalidReferenceImage("A clear foreground subject could not be separated from the background.")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def _reference_background(reference: Image.Image, reference_cutout: Image.Image) -> Image.Image:
    rgb = np.asarray(reference.convert("RGB"), dtype=np.uint8)
    alpha = np.asarray(reference_cutout.getchannel("A"), dtype=np.uint8)
    mask = np.where(alpha > 18, 255, 0).astype(np.uint8)
    kernel = np.ones((9, 9), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=2)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    # Inpaint only the reference subject region to retain the original scene as a backdrop.
    background = cv2.inpaint(bgr, mask, 9, cv2.INPAINT_TELEA)
    return Image.fromarray(cv2.cvtColor(background, cv2.COLOR_BGR2RGB)).convert("RGBA")


def _restrained_scene_grade(image: Image.Image, reference: Image.Image) -> Image.Image:
    """Apply a restrained global luminance/colour grade without face synthesis or warping."""
    out = np.asarray(image.convert("RGB"), dtype=np.float32)
    ref = np.asarray(reference.convert("RGB").resize(image.size), dtype=np.float32)
    out_lab = cv2.cvtColor(out.astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    ref_lab = cv2.cvtColor(ref.astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    for channel in range(3):
        source = out_lab[:, :, channel]
        target = ref_lab[:, :, channel]
        source_std = max(float(source.std()), 1.0)
        target_std = max(float(target.std()), 1.0)
        matched = (source - float(source.mean())) * min(target_std / source_std, 1.25)
        matched += float(target.mean())
        out_lab[:, :, channel] = source * 0.78 + matched * 0.22
    # Convert back using uint8 LAB encoding; float LAB uses a different numeric range.
    graded = cv2.cvtColor(np.clip(out_lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)
    return Image.fromarray(graded, mode="RGB").convert("RGBA")


def transform_photograph(
    captured_bytes: bytes,
    reference_bytes: bytes,
    max_pixels: int,
) -> tuple[bytes, str]:
    """
    Build a fully local, non-generative studio composite.

    The customer's captured pixels remain the foreground identity source. The reference
    supplies the scene, subject scale/placement, and restrained colour treatment. This
    is deliberately described as compositing, not generative identity-preserving AI.
    """
    try:
        captured, _ = decode_reference_image(captured_bytes, max_pixels)
        reference, _ = decode_reference_image(reference_bytes, max_pixels)
        captured_cutout = _rgba_cutout(captured_bytes, max_pixels)
        reference_cutout = _rgba_cutout(reference_bytes, max_pixels)

        capture_box = _subject_bounds(captured_cutout)
        reference_box = _subject_bounds(reference_cutout)
        background = _reference_background(reference, reference_cutout)

            target_width = max(1, reference_box[2] - reference_box[0])
        target_height = max(1, reference_box[3] - reference_box[1])
        source_subject = captured_cutout.crop(capture_box)

        # Preserve the source subject's aspect ratio; fit inside the reference subject box.
        scale = min(target_width / source_subject.width, target_height / source_subject.height)
        new_size = (
            max(1, round(source_subject.width * scale)),
            max(1, round(source_subject.height * scale)),
        )
        subject = source_subject.resize(new_size, Image.Resampling.LANCZOS)
        x = reference_box[0] + (target_width - new_size[0]) // 2
        y = reference_box[1] + (target_height - new_size[1]) // 2
        background.alpha_composite(subject, (x, y))

        graded = _restrained_scene_grade(background, reference)
        graded.thumbnail((MAX_OUTPUT_DIMENSION, MAX_OUTPUT_DIMENSION), Image.Resampling.LANCZOS)
        output = BytesIO()
        graded.convert("RGB").save(output, format="WEBP", quality=92, method=5)
        return output.getvalue(), "rembg-u2net+opencv-composite"
    except InvalidReferenceImage:
        raise
    except LocalModelUnavailable:
        raise
    except Exception as exc:
        raise RuntimeError("Local photo transformation failed. Retake the image or retry the job.") from exc
