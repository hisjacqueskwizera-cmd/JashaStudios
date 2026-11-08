# Phase 5 — Python reference-image analysis

## Objective
Provide a versioned FastAPI endpoint that converts a customer-supplied reference image into structured visual features for later pose coaching and image transformation.

## Implemented
- `POST /v1/analyze/reference` accepts JPEG, PNG or WebP as multipart field `file`.
- Validates decoded format, minimum dimensions, maximum pixel count and upload byte limit; applies EXIF orientation and RGB normalization.
- Returns versioned dimensions/orientation, framing, spatial brightness, exposure, contrast, coarse color cast, saturation, dominant colors, regional edge density and basic sharpness/quality flags.
- Reports pose as `model_not_configured` until a supported MediaPipe Pose Landmarker model asset is installed and validated.
- Optional `X-API-Key` authentication. If `VISION_API_KEY` is set it is required. In production, the service fails closed if the key is missing.
- Does not persist customer images; processing is in memory.

## Run locally
From the repository root:
```powershell
cd python-service
python -m venv .venv
.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
$env:VISION_API_KEY = "use-a-long-random-local-secret"
uvicorn app.main:app --reload --port 8000
```
For local development the key may be omitted. Never expose it in browser JavaScript; the Next.js server must call this service.

## Request
```powershell
curl.exe -X POST "http://127.0.0.1:8000/v1/analyze/reference" -H "X-API-Key: $env:VISION_API_KEY" -F "file=@C:\\path\\to\\reference.jpg"
```

## Interpretation limits
- Brightest/darkest regions and color cast are image-level estimates; they do not identify physical light fixtures or prove incident-light direction.
- Edge density is a visual-complexity proxy, not semantic composition or subject detection.
- Laplacian sharpness is affected by texture and resolution.
- Pose landmarks are not fabricated. Configure and validate MediaPipe Pose Landmarker before pose-specific instructions.
- Analysis is not yet persisted to Supabase or connected to the desktop project UI; integration must enforce authenticated project ownership.

## Security and operations
- Default maximum upload: 15 MiB; decoded image limit: 40 megapixels.
- Set a long random `VISION_API_KEY` and `APP_ENV=production` outside local development.
- Deploy behind TLS, trusted proxy timeouts and rate limiting before public exposure.
