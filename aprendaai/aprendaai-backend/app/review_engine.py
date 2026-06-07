"""Leitner spaced-repetition engine.

Boxes 0..4 with growing intervals (days). An item the child gets right
moves up one box; an item missed drops back to box 0 and is due again
immediately.
"""
import hashlib
import json
import re

# Days until next review per box.
BOX_INTERVALS_DAYS = [0, 1, 3, 7, 16]
MAX_BOX = len(BOX_INTERVALS_DAYS) - 1


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower().strip())


def concept_key(child_id: int, question_text: str) -> str:
    """Stable identifier for a question, scoped per child."""
    digest = hashlib.sha1(f"{child_id}:{_normalize(question_text)}".encode("utf-8"))
    return digest.hexdigest()


def _schedule_correct(conn, item_id: int, current_box: int) -> tuple[int, str]:
    new_box = min(current_box + 1, MAX_BOX)
    interval = f"+{BOX_INTERVALS_DAYS[new_box]} days"
    conn.execute(
        "UPDATE review_items SET box=?, next_review_at=datetime('now', ?), "
        "last_result='correct', updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (new_box, interval, item_id),
    )
    return new_box, interval


def _schedule_wrong(conn, item_id: int) -> None:
    conn.execute(
        "UPDATE review_items SET box=0, lapses=lapses+1, "
        "next_review_at=CURRENT_TIMESTAMP, last_result='wrong', "
        "updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (item_id,),
    )


def apply_session_answer(
    conn, child_id: int, question_text: str, is_correct: bool, attempt_number: int = 1
) -> bool:
    """Move the matching review_item up or down a box.

    Only the first attempt of a question within a session updates the schedule —
    retries inside the same exposure would otherwise reinforce/reset the box
    on the same immediate practice.
    """
    if attempt_number != 1:
        return False
    ck = concept_key(child_id, question_text)
    row = conn.execute(
        "SELECT id, box FROM review_items WHERE child_id=? AND concept_key=?",
        (child_id, ck),
    ).fetchone()
    if not row:
        return False
    if is_correct:
        _schedule_correct(conn, row["id"], row["box"])
    else:
        _schedule_wrong(conn, row["id"])
    return True


def upsert_quiz_items(conn, child_id: int, session_id: int, quiz: list[dict]) -> int:
    """Insert quiz questions into review_items, ignoring duplicates.

    Repeated concepts keep their existing box/schedule (we don't reset progress).
    Returns the number of newly inserted rows.
    """
    inserted = 0
    for q in quiz:
        question_text = q.get("question") or ""
        if not question_text.strip():
            continue
        options = q.get("options") or []
        correct = int(q.get("correct", 0))
        ck = concept_key(child_id, question_text)
        cursor = conn.execute(
            "INSERT OR IGNORE INTO review_items "
            "(child_id, source_session_id, concept_key, prompt, options_json, correct_option) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                child_id,
                session_id,
                ck,
                question_text,
                json.dumps(options, ensure_ascii=False),
                correct,
            ),
        )
        if cursor.rowcount > 0:
            inserted += 1
    return inserted
