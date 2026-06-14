# Stage 1: build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY aprendaai/aprendaai-frontend/package.json aprendaai/aprendaai-frontend/package-lock.json ./
RUN npm ci
COPY aprendaai/aprendaai-frontend/ ./
RUN npm run build

# Stage 2: backend + embedded frontend
FROM python:3.12-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

RUN pip install --no-cache-dir poetry==1.8.4

COPY aprendaai/aprendaai-backend/pyproject.toml aprendaai/aprendaai-backend/poetry.lock ./
RUN poetry install --only main --no-root

COPY aprendaai/aprendaai-backend/app ./app
COPY --from=frontend-builder /app/dist ./static

ENV PORT=8080
EXPOSE 8080

CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
