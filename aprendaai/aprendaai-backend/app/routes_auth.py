from fastapi import APIRouter
from jose import jwt

from app.config import JWT_SECRET, JWT_ALGORITHM

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/verify")
async def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"valid": True, "role": payload.get("role")}
    except Exception:
        return {"valid": False}
