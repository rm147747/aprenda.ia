import os
import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from jose import jwt

from app.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MINUTES

router = APIRouter(prefix="/api/auth", tags=["auth"])

FAMILY_USERNAME = os.getenv("FAMILY_USERNAME", "familiabrandao")
FAMILY_PASSWORD = os.getenv("FAMILY_PASSWORD", "12345")


class FamilyLogin(BaseModel):
    username: str
    password: str


@router.post("/login")
async def family_login(req: FamilyLogin):
    if req.username != FAMILY_USERNAME or req.password != FAMILY_PASSWORD:
        raise HTTPException(status_code=403, detail="Usuario ou senha incorretos")

    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=JWT_EXPIRE_MINUTES * 4)
    token = jwt.encode(
        {"role": "family", "exp": expire},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    return {"success": True, "token": token}


@router.get("/verify")
async def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"valid": True, "role": payload.get("role")}
    except Exception:
        return {"valid": False}
