# Phase 8 — Real-Time Pose Coach

## Objective
Provide immediate pose guidance on the paired smartphone while keeping the desktop as the studio control room. The phone performs pose inference locally so camera frames do not need to be uploaded to the vision API for continuous tracking.

## Implementation
- src/components/camera/pose-coach.tsx loads the pinned MediaPipe Tasks Vision browser bundle and Pose Landmarker Lite model.
- The model first attempts GPU delegate and falls back to CPU if GPU initialization fails.
- The live camera video is analyzed at a throttled interval and a skeleton is drawn over the preview.
- The phone requests GET /api/camera/reference with its paired-device bearer credential. The endpoint hashes the token, authorizes the active device through the narrow authorize_paired_device RPC, verifies the project owner and selected reference, and streams the private reference image without returning its storage path or a signed storage URL.
- The reference image is analyzed locally. Visible torso, arm and leg landmarks are normalized around the torso to estimate pose similarity. Coaching prompts highlight hand height and horizontal placement differences.
- If no project reference is selected, the live skeleton still works and the UI explains that pose matching is unavailable.

## Runtime assets
The browser loads pinned public assets:
- MediaPipe Tasks Vision 0.10.14 bundle and WASM from jsDelivr.
- Pose Landmarker Lite task model from the official Google MediaPipe model bucket.

The deployment must allow the phone browser to fetch these assets. A later hardening step may self-host versioned assets after license and caching review.

## Security and privacy
- The reference endpoint requires the existing random paired-device bearer credential and validates it using the hash-only database RPC.
- Only the selected reference for that paired session's project and owner can be retrieved.
- The endpoint streams the reference with no-store and does not disclose the private Storage path.
- Live camera frames remain in the browser and are not sent to the FastAPI service for continuous pose tracking.
- The model and similarity score are guidance only. They are not biometric identity verification and do not guarantee a perfect pose match.

## Configuration
No new environment variable or database migration is introduced. The endpoint reuses:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the existing anon-key fallback)
- SUPABASE_SECRET_KEY (server-only; never expose it through NEXT_PUBLIC_ or commit it)

SUPABASE_SECRET_KEY must be a newly rotated secret key and configured in the server runtime. A previously exposed key must not be reused.

## Verification
GitHub Actions checks TypeScript, ESLint, Next.js production build and the Python service test suite. Browser-side model initialization and camera behavior still require physical-device testing over HTTPS, especially on iOS Safari and Android Chrome. CDN access may be blocked by restrictive networks or Content Security Policy; if so, self-host the pinned model and WASM assets.
