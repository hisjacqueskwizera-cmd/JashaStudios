# Local Photo Transformation

## Implemented in the current MVP branch

Jasha Studios now has a local, non-generative photo transformation path. It does not call a paid image-generation API.

- FastAPI exposes `POST /v1/transform/prepare` for safe input validation and quality diagnostics.
- FastAPI exposes `POST /v1/transform/generate` for local transformation when `TRANSFORMATION_ENABLED=true` and `LOCAL_TRANSFORM_ENABLED=true`.
- The background worker claims queued jobs from Supabase and processes them without an external AI provider.
- A worker-only, lease-scoped RPC reports real processing milestones (download, analysis, segmentation, validation and upload) to the desktop UI; stale or cancelled workers cannot update progress.
- The local engine uses the open-source rembg U2Net model to segment the customer and reference subjects.
- OpenCV inpaints the reference subject region to create a scene plate.
- The customer's segmented pixels are scaled and positioned into the reference subject bounds while retaining their source identity pixels.
- A restrained LAB colour treatment aligns the scene without face generation or body warping.
- Results are normalized to WebP and stored in the user's private project path by the existing worker.
- The model session is cached within the worker process.

## Honest capability boundary

This is a real computer-vision compositing workflow, not a diffusion-based generative model. It can recreate a scene/background, approximate subject scale and placement, and apply restrained colour treatment. It does not synthesize a new pose, generate missing body parts, relight a person with physically accurate lighting, or guarantee that a complex reference can be reproduced. The original captured subject pixels remain the identity source. Results still require human review.

For best results, capture the customer against a simple background with good separation, use a reference with one clearly visible person, and avoid large pose or camera-angle differences.

## Runtime requirements

- Python 3.11.
- OpenCV, Pillow and NumPy.
- `rembg[cpu]` and its ONNX Runtime CPU dependency.
- Sufficient memory for U2Net inference; CPU processing may take several seconds or longer.
- The first U2Net model load may need outbound network access to download model weights.
- Set `LOCAL_TRANSFORM_ENABLED=true` and `TRANSFORMATION_ENABLED=true` on the API/worker host.
- Set `SUPABASE_URL` and server-only `SUPABASE_SECRET_KEY` for the background worker.

## Verification

Run `python -m pytest` from `python-service/`. Tests cover image preparation, API validation and a deterministic compositor test with a mocked segmentation mask. Before pitching live processing, run the worker against a configured staging Supabase project using consented capture/reference pairs and evaluate mask edges, scene inpainting, subject placement, CPU time and memory. Do not claim generative AI reconstruction or perfect identity/lighting fidelity.
