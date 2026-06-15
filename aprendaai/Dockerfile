FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY aprendaai-frontend/package.json aprendaai-frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY aprendaai-frontend/ ./
RUN npm run build

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends gcc curl && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir poetry==1.8.5
WORKDIR /app
COPY aprendaai-backend/pyproject.toml ./
RUN poetry config virtualenvs.create false && poetry lock --no-interaction && poetry install --no-dev --no-interaction --no-ansi
COPY aprendaai-backend/ ./
COPY --from=frontend-builder /app/frontend/dist ./static/
RUN mkdir -p /data /data/uploads
ENV DATA_DIR=/data
ENV PYTHONUNBUFFERED=1
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -f http://localhost:8000/healthz || exit 1
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
