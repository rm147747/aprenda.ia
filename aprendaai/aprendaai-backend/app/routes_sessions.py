import json
import os
import time
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from pydantic import BaseModel

from app.config import UPLOAD_DIR, ALLOWED_EXTENSIONS, MAX_FILE_SIZE, AUDIO_EXTENSIONS
from app.database import get_db
from app.extraction import extract_content
from app.ai_service import generate_lesson, generate_review, generate_parent_summary
from app.review_engine import upsert_quiz_items, apply_session_answer

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class QuizResponseRequest(BaseModel):
    question_index: int
    selected_option: int


class CompleteSessionRequest(BaseModel):
    quiz_results: list[dict]


class ReviewRequest(BaseModel):
    wrong_question_indices: list[int]


@router.post("")
async def create_session(
    child_id: int = Form(...),
    topic: str = Form(""),
    files: list[UploadFile] = File([]),
):
    """Create a new study session. Accepts topic text and/or multiple file uploads."""
    if not topic and not files:
        raise HTTPException(status_code=400, detail="Envie um tema ou um arquivo")

    # Get child info
    with get_db() as conn:
        child = conn.execute(
            "SELECT id, name, age FROM children WHERE id = ?", (child_id,)
        ).fetchone()
        if not child:
            raise HTTPException(status_code=404, detail="Child not found")

    input_type = "text"
    file_paths = []
    extracted_text = topic

    # Handle file uploads (multiple files)
    for idx, file in enumerate(files):
        if not file.filename:
            continue

        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Tipo de arquivo {ext} nao suportado. Use PDF, DOCX, JPG ou PNG.",
            )

        # Save file
        timestamp = int(time.time())
        safe_name = f"{timestamp}_{child_id}_{idx}{ext}"
        current_file_path = str(UPLOAD_DIR / safe_name)

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Arquivo muito grande (maximo 10MB)")

        with open(current_file_path, "wb") as f:
            f.write(content)

        file_paths.append(current_file_path)

        # Determine input type for this file
        if ext == ".pdf":
            current_type = "pdf"
        elif ext in (".doc", ".docx"):
            current_type = "docx"
        elif ext in (".jpg", ".jpeg", ".png"):
            current_type = "image"
        elif ext in AUDIO_EXTENSIONS:
            current_type = "audio"
        else:
            current_type = "text"

        # Use the first non-image file type as the main input_type
        if idx == 0 or current_type not in ("image",):
            input_type = current_type

        # Extract text from file
        try:
            file_text = extract_content(current_file_path, current_type)
            if file_text:
                if extracted_text and extracted_text.strip():
                    extracted_text = f"{extracted_text}\n\n{file_text}"
                else:
                    extracted_text = file_text
        except Exception as e:
            # If extraction fails and we have no content yet, raise error
            if not extracted_text or not extracted_text.strip():
                raise HTTPException(
                    status_code=500,
                    detail=f"Erro ao extrair conteudo do arquivo: {str(e)}",
                )

    if not extracted_text or not extracted_text.strip():
        raise HTTPException(status_code=400, detail="Nao foi possivel extrair conteudo do arquivo. Tente outro arquivo ou digite o tema manualmente.")

    # Store file paths as JSON if multiple files
    stored_file_path = json.dumps(file_paths) if file_paths else None

    # Create session in DB
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO sessions (child_id, topic, input_type, original_file, extracted_text, status)
               VALUES (?, ?, ?, ?, ?, 'processing')""",
            (child_id, topic or "Arquivo enviado", input_type, stored_file_path, extracted_text),
        )
        session_id = cursor.lastrowid
        conn.commit()

    # Generate lesson — use low temperature when material was provided
    has_material = len(file_paths) > 0
    try:
        lesson = generate_lesson(child["name"], child["age"], extracted_text, has_material=has_material)
        lesson_json = json.dumps(lesson, ensure_ascii=False)

        with get_db() as conn:
            auto = conn.execute("SELECT auto_approve FROM settings LIMIT 1").fetchone()
            auto_approve = bool(auto and auto["auto_approve"])
            if auto_approve:
                conn.execute(
                    "UPDATE sessions SET lesson_json=?, status='ready', "
                    "approval_status='approved', approved_by='parent', "
                    "approved_at=CURRENT_TIMESTAMP WHERE id=?",
                    (lesson_json, session_id),
                )
                # Final lesson → seed Leitner queue now
                upsert_quiz_items(conn, child_id, session_id, lesson.get("quiz", []))
            else:
                conn.execute(
                    "UPDATE sessions SET lesson_json=?, status='ready', "
                    "approval_status='draft' WHERE id=?",
                    (lesson_json, session_id),
                )
                # Defer seeding to the parent approve endpoint — edits may change quiz
            conn.commit()
    except Exception as e:
        with get_db() as conn:
            conn.execute(
                "UPDATE sessions SET status = 'error' WHERE id = ?",
                (session_id,),
            )
            conn.commit()
        raise HTTPException(status_code=500, detail=f"Failed to generate lesson: {str(e)}")

    return {"session_id": session_id, "status": "ready"}


@router.get("/{session_id}/lesson")
async def get_lesson(session_id: int):
    """Get the generated lesson for a session."""
    with get_db() as conn:
        session = conn.execute(
            "SELECT id, status, lesson_json, topic, approval_status FROM sessions WHERE id = ?",
            (session_id,),
        ).fetchone()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session["status"] == "processing":
        return {"session_id": session_id, "status": "processing", "lesson": None}

    if session["status"] == "error":
        return {"session_id": session_id, "status": "error", "lesson": None}

    # B3: hide drafts from the child — frontend renders a friendly waiting screen
    if (session["approval_status"] or "draft") != "approved":
        return {
            "session_id": session_id,
            "status": "awaiting_approval",
            "topic": session["topic"],
            "lesson": None,
        }

    lesson = json.loads(session["lesson_json"]) if session["lesson_json"] else None
    return {
        "session_id": session_id,
        "status": session["status"],
        "topic": session["topic"],
        "lesson": lesson,
    }


@router.post("/{session_id}/quiz-response")
async def submit_quiz_response(session_id: int, req: QuizResponseRequest):
    """Submit a single quiz response."""
    with get_db() as conn:
        session = conn.execute(
            "SELECT lesson_json, child_id, approval_status FROM sessions WHERE id = ?",
            (session_id,),
        ).fetchone()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # B3: 403 hard — closes the loophole if approval is revoked mid-session
    if (session["approval_status"] or "draft") != "approved":
        raise HTTPException(status_code=403, detail="Lesson awaiting parent approval")

    lesson = json.loads(session["lesson_json"])
    quiz = lesson.get("quiz", [])

    if req.question_index >= len(quiz):
        raise HTTPException(status_code=400, detail="Invalid question index")

    question = quiz[req.question_index]
    is_correct = req.selected_option == question["correct"]

    # Save response
    with get_db() as conn:
        # Check attempt number
        existing = conn.execute(
            """SELECT COUNT(*) as count FROM quiz_responses
               WHERE session_id = ? AND question_index = ?""",
            (session_id, req.question_index),
        ).fetchone()
        attempt_number = existing["count"] + 1

        conn.execute(
            """INSERT INTO quiz_responses
               (session_id, question_index, question_text, correct_answer, child_answer, is_correct, attempt_number)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                session_id,
                req.question_index,
                question["question"],
                question["correct"],
                req.selected_option,
                is_correct,
                attempt_number,
            ),
        )
        # A3: schedule next review in the Leitner queue (1st attempt only)
        apply_session_answer(
            conn, session["child_id"], question["question"], is_correct, attempt_number
        )
        conn.commit()

    return {
        "is_correct": is_correct,
        "correct_answer": question["correct"],
        "explanation": question.get("explanation", ""),
        "feedback": question.get("feedback_correct", "Muito bem! 🌟") if is_correct else question.get("feedback_wrong", "Quase! Tente novamente."),
    }


@router.post("/{session_id}/complete")
async def complete_session(session_id: int, req: CompleteSessionRequest):
    """Complete a session and generate parent summary."""
    with get_db() as conn:
        session = conn.execute(
            """SELECT s.id, s.child_id, s.topic, s.extracted_text, s.lesson_json, s.started_at,
                      c.name as child_name, c.age as child_age
               FROM sessions s JOIN children c ON s.child_id = c.id
               WHERE s.id = ?""",
            (session_id,),
        ).fetchone()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    total_questions = len(req.quiz_results)
    correct_answers = sum(1 for r in req.quiz_results if r.get("is_correct"))
    wrong_indices = [r["question_index"] for r in req.quiz_results if not r.get("is_correct")]

    # Calculate duration
    import datetime
    started = datetime.datetime.fromisoformat(session["started_at"])
    duration_sec = int((datetime.datetime.now() - started).total_seconds())
    duration_min = max(1, duration_sec // 60)

    # Calculate stars
    stars = len(req.quiz_results)  # 1 star per question answered
    if correct_answers == total_questions and total_questions > 0:
        stars += 1  # Bonus star for perfect score

    needs_review = len(wrong_indices) >= 2

    # Get wrong question details for summary
    lesson = json.loads(session["lesson_json"]) if session["lesson_json"] else {}
    quiz = lesson.get("quiz", [])
    wrong_details = ""
    for idx in wrong_indices:
        if idx < len(quiz):
            wrong_details += f"- {quiz[idx]['question']}\n"

    # Generate parent summary
    try:
        summary = generate_parent_summary(
            child_name=session["child_name"],
            child_age=session["child_age"],
            topic=session["topic"],
            duration_min=duration_min,
            total_questions=total_questions,
            correct_answers=correct_answers,
            wrong_details=wrong_details,
        )
    except Exception:
        # Fallback summary if AI fails
        pct = int((correct_answers / total_questions * 100)) if total_questions > 0 else 0
        level = "alto" if pct >= 80 else "medio" if pct >= 50 else "baixo"
        summary = {
            "summary_text": f"{session['child_name']} estudou {session['topic']} por {duration_min} minutos. Acertou {correct_answers} de {total_questions} questoes ({pct}%).",
            "comprehension_level": level,
            "weak_points": [],
            "recommendations": ["Continuar praticando o tema"],
        }

    # Update session
    with get_db() as conn:
        conn.execute(
            """UPDATE sessions SET status = 'completed', ended_at = CURRENT_TIMESTAMP,
               duration_sec = ?, stars_earned = ? WHERE id = ?""",
            (duration_sec, stars, session_id),
        )

        # Save summary
        conn.execute(
            """INSERT OR REPLACE INTO session_summaries
               (session_id, total_questions, correct_answers, comprehension, weak_points, recommendations, summary_text)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                session_id,
                total_questions,
                correct_answers,
                summary.get("comprehension_level", "medio"),
                json.dumps(summary.get("weak_points", []), ensure_ascii=False),
                json.dumps(summary.get("recommendations", []), ensure_ascii=False),
                summary.get("summary_text", ""),
            ),
        )
        conn.commit()

    # Get total stars for this child
    with get_db() as conn:
        total_stars_row = conn.execute(
            "SELECT COALESCE(SUM(stars_earned), 0) as total FROM sessions WHERE child_id = ?",
            (session["child_id"],),
        ).fetchone()

    return {
        "session_id": session_id,
        "stars_earned": stars,
        "total_stars": total_stars_row["total"],
        "needs_review": needs_review,
        "summary": summary,
    }


@router.post("/{session_id}/review")
async def generate_session_review(session_id: int, req: ReviewRequest):
    """Generate adaptive review for wrong answers."""
    with get_db() as conn:
        session = conn.execute(
            """SELECT s.id, s.extracted_text, s.lesson_json, s.original_file,
                      c.name as child_name, c.age as child_age
               FROM sessions s JOIN children c ON s.child_id = c.id
               WHERE s.id = ?""",
            (session_id,),
        ).fetchone()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    lesson = json.loads(session["lesson_json"]) if session["lesson_json"] else {}
    quiz = lesson.get("quiz", [])

    wrong_questions = ""
    for idx in req.wrong_question_indices:
        if idx < len(quiz):
            q = quiz[idx]
            wrong_questions += f"- Pergunta: {q['question']}, Resposta correta: {q['options'][q['correct']]}\n"

    has_material = bool(session["original_file"])
    review = generate_review(
        child_name=session["child_name"],
        child_age=session["child_age"],
        wrong_questions=wrong_questions,
        original_content=session["extracted_text"] or "",
        has_material=has_material,
    )

    return {
        "session_id": session_id,
        "review_blocks": review.get("blocks", []),
        "review_quiz": review.get("quiz", []),
        "motivation": review.get("motivation", "Voce consegue! 🌟"),
    }
