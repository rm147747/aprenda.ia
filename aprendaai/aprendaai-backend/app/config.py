import os
from pathlib import Path

# Database
DATA_DIR = Path(os.getenv("DATA_DIR", "/data"))
DB_PATH = DATA_DIR / "app.db" if DATA_DIR.exists() else Path("app.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

# OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = "gpt-4o"

# Upload
UPLOAD_DIR = DATA_DIR / "uploads" if DATA_DIR.exists() else Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Auth
PARENT_DEFAULT_USERNAME = "123"
PARENT_DEFAULT_PASSWORD = "123"
JWT_SECRET = os.getenv("JWT_SECRET", "aprendaai-secret-key-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60

# Allowed file types
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".mp3", ".wav", ".webm", ".ogg", ".m4a"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "audio/mpeg",
    "audio/wav",
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".webm", ".ogg", ".m4a"}
