# Jasha Studios — Architecture

## Product workflow
The desktop is the studio control room. The smartphone is the capture device and later pose-guidance screen.

## System boundaries

| Layer | Responsibility | Foundation |
|---|---|---|
| Next.js App Router | Authenticated desktop workspace, pairing APIs and mobile pages | Next.js 15 / React 19 / TypeScript |
| UI system | Accessible reusable interface | Tailwind CSS v4, shadcn/ui-compatible setup, Lucide |
| PWA | Installable app shell | Web manifest and service worker |
| Supabase | Authentication, PostgreSQL, storage and owner-scoped workflow records | Migrations and RLS; live setup must be verified |
| FastAPI | Computer vision and image processing | Reference image analysis endpoint |
| Python CV | Image analysis, pose, segmentation and quality | OpenCV, NumPy, Pillow; MediaPipe model setup pending |
| Pairing | Temporary phone-to-session link | SHA-256 hashed challenge, narrow Postgres RPCs, QR fragment and explicit phone confirmation |
| Worker / queue | Long-running AI jobs | Planned; Redis/Celery not activated |
| C++ extensions | Profile-proven performance-critical operations | Deferred until profiling demonstrates need |
| Hosting | Web app, API and GPU worker deployment | Planned |

## Pairing security model
- Desktop server generates a 256-bit random challenge and stores only its SHA-256 hash.
- QR code carries the challenge in a URL fragment; the fragment is not sent in the initial HTTP request.
- Challenge lifetime is five minutes; studio session lifetime is two hours.
- Phone must explicitly confirm. A Postgres function atomically consumes the challenge and creates the paired-device record.
- Owner reads and management use Supabase RLS and authenticated security-definer functions.
- Public claim/confirm functions expose no user/project information and accept only the challenge hash.
- Service-role credentials are not required for pairing.
- Camera capture and pose coaching are separate future phases.

## Database foundation
Migrations create profiles, projects, references and analyses, studio backgrounds and sessions, pairing challenges and paired devices, session events, captures, processing jobs, generated images, subscriptions, credit ledger, payments, notifications and audit logs. RLS is enabled on private records.

## Security baseline
- Secrets are kept server-side and excluded from Git.
- Public Supabase publishable key is safe for client use only with RLS and narrow RPC grants.
- Service-role keys must never use a NEXT_PUBLIC_ prefix.
- CORS origins are explicitly configured.
- Pairing challenge hashes are stored, not raw secrets.
- Private media uses short-lived signed URLs.
- Health endpoints report liveness only, not model/database readiness.

## Deferred decisions
- Redis/Celery and GPU deployment will be selected when model workloads are defined.
- Model choice must be benchmarked on consented evaluation images.
- C++/pybind11 will be introduced only after profiling proves a performance bottleneck.
