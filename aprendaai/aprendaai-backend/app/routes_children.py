from fastapi import APIRouter
from app.database import get_db

router = APIRouter(prefix="/api/children", tags=["children"])


@router.get("")
async def list_children():
    with get_db() as conn:
        rows = conn.execute("SELECT id, name, age, avatar_emoji FROM children ORDER BY id").fetchall()
        children = [
            {
                "id": row["id"],
                "name": row["name"],
                "age": row["age"],
                "avatar_emoji": row["avatar_emoji"],
            }
            for row in rows
        ]
    return {"children": children}


@router.get("/{child_id}")
async def get_child(child_id: int):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, name, age, avatar_emoji FROM children WHERE id = ?",
            (child_id,),
        ).fetchone()
        if not row:
            return {"error": "Child not found"}, 404

        # Get total stars
        stars = conn.execute(
            "SELECT COALESCE(SUM(stars_earned), 0) as total FROM sessions WHERE child_id = ?",
            (child_id,),
        ).fetchone()

        # Get session count
        sessions = conn.execute(
            "SELECT COUNT(*) as count FROM sessions WHERE child_id = ? AND status = 'completed'",
            (child_id,),
        ).fetchone()

    return {
        "id": row["id"],
        "name": row["name"],
        "age": row["age"],
        "avatar_emoji": row["avatar_emoji"],
        "total_stars": stars["total"],
        "total_sessions": sessions["count"],
    }
