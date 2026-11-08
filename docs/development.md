# Development Guide

## Prerequisites

- Node.js 20.9+ (recommended for Next.js 15)
- npm 10+
- Python 3.11+

## Frontend

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Python vision service

Linux/macOS:

```bash
cd python-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Windows PowerShell:

```powershell
cd python-service
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Run tests from `python-service`:

```bash
python -m pytest
```

Health check: http://127.0.0.1:8000/health

## Environment

Copy `.env.example` to `.env.local` for Next.js. Do not commit `.env.local`. The initial app shell does not require Supabase credentials. Configure the Python process environment separately.

## Current limits

The foundation preview is not a functioning photography workflow. Authentication, persisted projects, reference uploads/analysis, QR pairing, camera capture, pose coaching, AI transformation, billing and admin features are not implemented in Phase 1.
