FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system app \
    && useradd --system --gid app --home-dir /app --create-home app

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=app:app app ./app

USER app
EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import os, urllib.request; mode=os.getenv('SERVICE_MODE', 'api'); port=os.getenv('PORT', '10000'); os.kill(1, 0) if mode == 'worker' else urllib.request.urlopen(f'http://127.0.0.1:{port}/health/ready', timeout=3)" || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
