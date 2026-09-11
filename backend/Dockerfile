# Multi-stage lean Dockerfile for Snowman Backend on Render Free Tier (512MB RAM limit)
FROM python:3.11-slim as builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final minimal runtime image
FROM python:3.11-slim

WORKDIR /app

# Install minimal audio processing runtime dependencies (ffmpeg, libgomp1 for faster-whisper CTranslate2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV PORT=8765
ENV WHISPER_MODEL_SIZE=tiny

# Copy backend application code
COPY app ./app
COPY config ./config
COPY run_backend.py ./run_backend.py

EXPOSE 8765

CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8765}"]
