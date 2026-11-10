# Implementation Status

Updated: 2026-11-08

## Phase 1 — Project foundation
- [x] Repository and Next.js / React / TypeScript / Tailwind scaffold
- [x] shadcn/ui-compatible setup, Lucide icons and PWA shell
- [x] Zod environment validation
- [x] FastAPI service shell and health endpoint
- [x] Python module boundaries and CI
- [x] Initial Supabase schema, relationships, indexes and baseline RLS

## Phase 2 — Authentication and user accounts
- [x] Supabase SSR foundation, email/password sign-up and sign-in, cookie refresh and sign-out
- [ ] Live authentication tested against the user's Supabase project
- [ ] Password reset and account settings

## Phase 3 — Desktop dashboard and project management
- [x] Responsive dashboard, project list, create/rename/archive/restore, search and filters
- [x] Owner-scoped server actions and project RLS write policies
- [ ] Live project CRUD verified against Supabase

## Phase 4 — Studio backgrounds and reference library
- [x] Project-specific reference library and private customer backgrounds
- [x] Admin-published studio preset catalog integration
- [x] Owner-scoped upload, selection and deletion; file signature and size validation
- [x] Private storage policies and signed preview URLs
- [ ] Apply migration and verify real Storage operations
- [ ] Publish initial preset images

## Phase 5 — Python reference-image analysis
- [x] Versioned FastAPI reference-image analysis endpoint
- [x] JPEG/PNG/WebP validation, EXIF normalization, upload and pixel limits
- [x] Lighting, exposure, contrast, color palette and composition feature extraction
- [x] Basic sharpness and image-quality checks
- [x] Explicit pose-model readiness status; no fabricated landmarks
- [x] Optional API-key authentication and production fail-closed behavior
- [x] Unit and API tests added
- [ ] Validate with representative portrait, full-body and studio references
- [ ] Configure and validate server-side MediaPipe Pose Landmarker model asset
- [ ] Persist analysis for owned reference images and connect project workspace

## Phase 6 — Secure QR device pairing
- [x] Cryptographically random five-minute QR challenge
- [x] SHA-256 hash-only challenge storage
- [x] Owner-checked session creation and challenge revocation functions
- [x] Phone-side claim and explicit confirmation flow
- [x] Atomic single-use confirmation and paired-device registration
- [x] Desktop QR display, polling status and disconnect control
- [x] Same-origin, payload validation and no-store API protections
- [x] Pairing migration and setup documentation
- [ ] Apply Phase 6 migration to live Supabase
- [ ] Verify physical phone pairing and revocation using reachable HTTPS
- [ ] Add production edge rate limiting and monitoring

## Phase 7 — Smartphone camera studio
- [x] Mobile camera route with permission handling, live preview and front/rear camera selection
- [x] Capture, retake, approve and upload retry workflow
- [x] Random per-device bearer credential issued only after explicit pairing confirmation; only SHA-256 hash stored in Postgres
- [x] Same-origin capture API, device/session authorization, file signature and size validation
- [x] Private Storage upload, captured-image metadata and rollback on metadata failure
- [x] Desktop capture inbox with owner-checked signed previews and four-second polling
- [x] Setup and physical-device test documentation
- [ ] Apply Phase 7 migration and configure server-only SUPABASE_SECRET_KEY
- [ ] Verify phone camera permissions, upload and desktop sync on a reachable HTTPS deployment
- [ ] Add production rate limiting, abuse monitoring and device/browser QA

## Phase 8 — Real-time pose coach
- [x] Browser-side MediaPipe Pose Landmarker integration with GPU-to-CPU fallback
- [x] Live pose skeleton overlay on the smartphone camera preview
- [x] Authenticated retrieval of the selected project reference through the paired-device credential
- [x] Local reference-pose inference and normalized landmark similarity score
- [x] Live arm-height and horizontal-position coaching prompts
- [x] On-device inference; camera frames are not streamed to the vision API for pose tracking
- [x] No database migration required
- [ ] Verify CDN/model loading on supported mobile browsers and networks
- [ ] Calibrate similarity scoring and prompts against diverse body types, poses and camera orientations
- [ ] Add reference pose analysis to the desktop reference workspace and persist reusable pose metadata

## Phase 9 — Local open-source photo transformation
- [x] Safe capture/reference preprocessing with EXIF normalization and aspect-ratio-preserving resize
- [x] Deterministic OpenCV quality checks and retake recommendations
- [x] Local open-source rembg/U2Net segmentation and OpenCV scene-compositing engine
- [x] Reference background reconstruction using inpainting
- [x] Reference subject placement and scale matching while retaining customer foreground pixels
- [x] Restrained LAB colour treatment and WebP output validation
- [x] Worker and FastAPI transformation routes no longer require paid external AI credentials
- [x] Added lease-scoped worker progress reporting and non-retryable invalid-image handling
- [x] Added RLS-protected Supabase Realtime subscriptions for captures, phone pairing and processing-job updates
- [x] Mocked tests for provider request, input ordering, error mapping and output validation
- [x] Durable job schema, queue RPCs, worker runtime and desktop workflow scaffold
- [x] Owner-scoped generated-image storage policy and attempt-specific output paths
- [ ] Install rembg CPU dependencies and validate U2Net model download/runtime on the target host
- [ ] Apply Phase 9 queue migration to staging/live Supabase
- [ ] Run real local transformation smoke tests using consented portraits and reference scenes
- [ ] Evaluate segmentation edges, subject placement, background inpainting and identity pixel preservation
- [ ] Benchmark CPU time and memory; use GPU only if target workloads require it

## Phase 10 — Gallery and desktop synchronization
- [x] Authenticated account-wide gallery for customer captures and generated-image records
- [x] Owner-scoped metadata queries with private ten-minute signed media previews
- [x] Filters for all photos, phone captures and AI results
- [x] Automatic ten-second refresh while the gallery tab is visible, visibility-return refresh and manual refresh
- [x] Project links, timestamps, dimensions and file sizes
- [ ] Verify gallery access and signed URL expiry against live Supabase
- [ ] Verify newly uploaded phone captures appear without a page reload on deployed HTTPS
- [ ] Verify generated outputs appear after Phase 9 is enabled

## Phase 11 — Payments, credits and subscriptions (deferred / out of scope)
- [x] Existing billing schema and code retained for future use
- [x] Customer-facing billing navigation removed from the current MVP
- [ ] No checkout, payment gateway, payment webhooks, credit purchases or subscription collection will be implemented in this release

## Phase 12 — Admin dashboard
- [x] Admin-only route guarded by Supabase app_metadata.role
- [x] Platform metrics for users, projects, captures, generated images and processing jobs
- [x] Customer directory with account status and project counts
- [x] Suspend/reactivate accounts through Supabase Auth ban state and profile status
- [x] Transformation-job monitoring
- [x] Administrator audit trail for account and operational changes
- [x] Billing and credit controls removed from the current MVP
- [x] Admin role is never assignable from the customer-facing UI
- [ ] Apply Phase 12 migrations and assign the first administrator in Supabase
- [ ] Verify admin permission boundaries and operational actions against staging
- [ ] Add user search/pagination and richer operational filters

## Phase 13 — Security, testing and quality assurance
- [x] Active-account RLS enforcement for owner data and private customer storage
- [x] Block suspended accounts from existing paired-device authorization and new QR challenge creation
- [x] Apply active-account checks to project writes and direct administrator table/storage policies
- [x] Add baseline security headers and bounded camera upload request checks
- [x] Add Python security-contract regression tests
- [x] Confirm latest Phase 13 frontend CI checks pass (GitHub Actions run 42517406671)
- [ ] Apply migration 011 in staging and run cross-account/RLS/Storage integration tests
- [ ] Verify suspension with already-issued browser sessions and paired phones
- [ ] Configure shared edge rate limits and validate CSP with MediaPipe/WASM
- [ ] Complete physical mobile QA and secret-rotation/history-cleanup verification

## Phase 14 — Production deployment
- [x] Add non-root Python API Docker image and runtime-only dependency installation
- [x] Add production readiness endpoint and Docker image CI build
- [x] Document Vercel frontend, Python container, Supabase release gates, environment variables and rollback
- [ ] Link Vercel project and configure protected preview/production environments
- [ ] Select Python container host and configure HTTPS ingress/secrets
- [ ] Apply migrations and validate all flows in staging
- [ ] Complete production smoke tests and approve release

## Remaining phases
15. Performance, realism and cost optimization

## Validation discipline
GitHub Actions is authoritative for frontend type-check, lint, build and Python tests. Live Supabase migrations, auth, storage, payment webhooks, physical QR scanning, MediaPipe model loading and deployed-device behavior are not considered verified until tested against the user's environment. Paid image-generation providers are not part of this release; local U2Net/OpenCV transformation must be tested on the target host.
