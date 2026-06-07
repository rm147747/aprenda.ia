from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import get_db
from app.review_engine import answer_item

router = APIRouter(prefix="/api/review-items", tags=["review"])


class AnswerRequest(BaseModel):
    selected_option: int


@router.post("/{item_id}/answer")
async def post_answer(item_id: int, req: AnswerRequest):
    """A5: answer a review item from the daily review queue (out of session)."""
    with get_db() as conn:
        result = answer_item(conn, item_id, req.selected_option)
        if result is None:
            raise HTTPException(status_code=404, detail="Review item not found")
        conn.commit()
    return result
