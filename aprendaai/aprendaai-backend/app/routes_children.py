from fastapi import APIRouter, Query
from app.database import get_db
from app.review_engine import due_items, due_count

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


@router.get("/{child_id}/due")
async def get_due(child_id: int, limit: int = Query(10, ge=1, le=50)):
    """A4: Leitner queue items currently due for this child."""
    with get_db() as conn:
        items = due_items(conn, child_id, limit)
        count = due_count(conn, child_id)
    return {"items": items, "count_due": count}
