from contextlib import asynccontextmanager
from pathlib import Path
import os

from dotenv import load_dotenv

# Load .env before anything else
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from app.database import init_db
from app.routes_auth import router as auth_router
from app.routes_children import router as children_router
from app.routes_sessions import router as sessions_router
from app.routes_parents import router as parents_router
from app.routes_review import router as review_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Aprenda.AI", lifespan=lifespan)

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

app.include_router(auth_router)
app.include_router(children_router)
app.include_router(sessions_router)
app.include_router(parents_router)
app.include_router(review_router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


from starlette.exceptions import HTTPException as StarletteHTTPException

# Serve frontend static files if the dist directory exists
frontend_dist = Path(__file__).parent.parent / "static"
if frontend_dist.exists():
    @app.get("/")
    async def serve_index():
        return FileResponse(str(frontend_dist / "index.html"))

    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="static-assets")

    @app.exception_handler(404)
    async def spa_fallback(request, exc):
        path = request.url.path
        if path.startswith("/api/") or path == "/healthz":
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        file_path = frontend_dist / path.lstrip("/")
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dist / "index.html"))
