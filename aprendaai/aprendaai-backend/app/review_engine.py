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
