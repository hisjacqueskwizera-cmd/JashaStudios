# Phase 9 — Hybrid AI Photo Transformation

## Scope of this increment

This commit establishes the safe transformation-preparation foundation. It does not claim to generate an AI-edited photograph yet.

## Implemented

- A FastAPI `POST /v1/transform/prepare` endpoint validates both the customer's captured image and the selected reference image.
- Both files are bounded by the configured upload and pixel limits, decoded by Pillow, checked against supported JPEG/PNG/WebP formats, and EXIF-normalized.
- Preparation resizes images only when their longest edge exceeds 2048 pixels. It preserves aspect ratio and does not crop or overwrite the original stored uploads.
- Deterministic OpenCV checks report sharpness, brightness, contrast, resolution flags and retake recommendations.
- A provider protocol defines the future asynchronous generation boundary. No fake provider or mock production image output is registered.
- The endpoint requires the existing internal vision API key when configured and fails closed in production if authentication is not configured.
- The processing-jobs migration adds idempotency, immutable input/settings snapshots, worker leases, retry scheduling and cancellation-request metadata. Existing RLS remains in force; browser clients do not gain write access.
- Unit and API tests cover normalization, resizing, image validation, provider readiness and API-key protection.

## Not implemented yet

- No image-generation provider is configured or called.
- No person-segmentation model, face/identity-preservation model, relighting model or generative background model is selected.
- No GPU worker, Redis queue or Celery worker is deployed.
- No customer transformation job is created or charged from the desktop UI.
- No generated output is published to customer storage.

## Why the provider is intentionally not fabricated

The platform must not return the input photo as if it were transformed, or label a synthetic test result as customer output. A real provider adapter must be selected, benchmarked on consented images, and configured with server-side credentials before generation is enabled.

## Verification

Run the Python service tests with `python -m pytest` from `python-service/`. GitHub Actions remains authoritative for frontend TypeScript, ESLint, Next.js production build and Python tests. Apply the migration to a non-production Supabase environment first; do not run `db reset` against live data.
