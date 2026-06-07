import json
import datetime
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import bcrypt
from jose import jwt

from app.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MINUTES
from app.database import get_db
from app.review_engine import upsert_quiz_items

router = APIRouter(prefix="/api/parents", tags=["parents"])


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class EditLessonRequest(BaseModel):
    lesson: dict


class SettingsUpdateRequest(BaseModel):
    auto_approve: bool


def _validate_lesson_payload(lesson: dict) -> None:
    if not isinstance(lesson, dict):
        raise HTTPException(status_code=400, detail="Lesson must be an object")
    if not isinstance(lesson.get("title"), str) or not lesson["title"].strip():
        raise HTTPException(status_code=400, detail="lesson.title required")
    if not isinstance(lesson.get("blocks"), list):
        raise HTTPException(status_code=400, detail="lesson.blocks must be a list")
    if not isinstance(lesson.get("quiz"), list):
        raise HTTPException(status_code=400, detail="lesson.quiz must be a list")
    for i, q in enumerate(lesson["quiz"]):
        if not isinstance(q, dict):
            raise HTTPException(status_code=400, detail=f"quiz[{i}] must be object")
        if not isinstance(q.get("question"), str) or not q["question"].strip():
            raise HTTPException(status_code=400, detail=f"quiz[{i}].question required")
        if not isinstance(q.get("options"), list) or len(q["options"]) < 2:
            raise HTTPException(status_code=400, detail=f"quiz[{i}].options needs >=2")
        if not isinstance(q.get("correct"), int) or not (0 <= q["correct"] < len(q["options"])):
            raise HTTPException(status_code=400, detail=f"quiz[{i}].correct out of range")


def verify_token(request: Request):
    token = request.headers.get("X-Parent-Token", "")
    if not token:
        raise HTTPException(status_code=403, detail="Token required")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid or expired token")


@router.post("/login")
async def parent_login(req: LoginRequest):
    with get_db() as conn:
        settings = conn.execute("SELECT parent_username, parent_password_hash FROM settings LIMIT 1").fetchone()

    if not settings:
        raise HTTPException(status_code=500, detail="Settings not configured")

    if req.username != settings["parent_username"]:
        raise HTTPException(status_code=403, detail="Usuario ou senha incorretos")

    if not bcrypt.checkpw(req.password.encode(), settings["parent_password_hash"].encode()):
        raise HTTPException(status_code=403, detail="Usuario ou senha incorretos")

    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=JWT_EXPIRE_MINUTES)
    token = jwt.encode({"role": "parent", "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)

    return {"success": True, "token": token}


@router.get("/dashboard")
async def parent_dashboard(_=Depends(verify_token)):
    with get_db() as conn:
        children = conn.execute("SELECT id, name, age, avatar_emoji FROM children ORDER BY id").fetchall()

        result = []
        for child in children:
            # Get sessions
            sessions = conn.execute(
                """SELECT s.id, s.topic, s.started_at, s.duration_sec, s.stars_earned, s.status,
                          ss.comprehension, ss.correct_answers, ss.total_questions, ss.weak_points, ss.recommendations
                   FROM sessions s
                   LEFT JOIN session_summaries ss ON s.id = ss.session_id
                   WHERE s.child_id = ? AND s.status = 'completed'
                   ORDER BY s.started_at DESC
                   LIMIT 20""",
                (child["id"],),
            ).fetchall()

            total_study_time = sum(s["duration_sec"] or 0 for s in sessions) // 60
            total_stars = sum(s["stars_earned"] or 0 for s in sessions)

            # Collect all weak points
            all_weak_points = []
            for s in sessions:
                if s["weak_points"]:
                    try:
                        wps = json.loads(s["weak_points"])
                        all_weak_points.extend(wps)
                    except (json.JSONDecodeError, TypeError):
                        pass

            # Count common errors
            from collections import Counter
            error_counts = Counter(all_weak_points)
            common_errors = [e for e, _ in error_counts.most_common(3)]

            # Recent sessions formatted
            recent = []
            for s in sessions[:10]:
                total_q = s["total_questions"] or 0
                correct_q = s["correct_answers"] or 0
                pct = int(correct_q / total_q * 100) if total_q > 0 else 0
                recent.append({
                    "id": s["id"],
                    "topic": s["topic"],
                    "date": s["started_at"],
                    "duration_min": max(1, (s["duration_sec"] or 0) // 60),
                    "comprehension": s["comprehension"] or "medio",
                    "correct_pct": pct,
                    "stars": s["stars_earned"] or 0,
                })

            # Average comprehension
            comprehensions = [s["comprehension"] for s in sessions if s["comprehension"]]
            if comprehensions:
                score_map = {"alto": 3, "medio": 2, "baixo": 1}
                avg_score = sum(score_map.get(c, 2) for c in comprehensions) / len(comprehensions)
                avg_comp = "alto" if avg_score >= 2.5 else "medio" if avg_score >= 1.5 else "baixo"
            else:
                avg_comp = "sem dados"

            # Get latest recommendations
            latest_recs = []
            for s in sessions[:3]:
                if s["recommendations"]:
                    try:
                        recs = json.loads(s["recommendations"])
                        latest_recs.extend(recs)
                    except (json.JSONDecodeError, TypeError):
                        pass
            latest_recs = list(dict.fromkeys(latest_recs))[:3]  # Deduplicate, max 3

            result.append({
                "id": child["id"],
                "name": child["name"],
                "age": child["age"],
                "avatar_emoji": child["avatar_emoji"],
                "total_sessions": len(sessions),
                "total_study_time_min": total_study_time,
                "total_stars": total_stars,
                "avg_comprehension": avg_comp,
                "recent_sessions": recent,
                "common_errors": common_errors,
                "recommendations": latest_recs,
            })

        # Weekly chart data
        today = datetime.date.today()
        start_of_week = today - datetime.timedelta(days=today.weekday())
        day_names = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]

        weekly_chart = []
        for i in range(7):
            day = start_of_week + datetime.timedelta(days=i)
            day_data = {"day": day_names[i]}
            for child in children:
                count = conn.execute(
                    """SELECT COUNT(*) as c FROM sessions
                       WHERE child_id = ? AND date(started_at) = ? AND status = 'completed'""",
                    (child["id"], day.isoformat()),
                ).fetchone()
                day_data[child["name"].lower()] = count["c"]
            weekly_chart.append(day_data)

    return {
        "children": result,
        "weekly_chart": weekly_chart,
    }


@router.get("/sessions/{session_id}")
async def session_detail(session_id: int, _=Depends(verify_token)):
    with get_db() as conn:
        session = conn.execute(
            """SELECT s.*, c.name as child_name, c.age as child_age,
                      ss.summary_text, ss.comprehension, ss.weak_points,
                      ss.recommendations, ss.total_questions, ss.correct_answers
               FROM sessions s
               JOIN children c ON s.child_id = c.id
               LEFT JOIN session_summaries ss ON s.id = ss.session_id
               WHERE s.id = ?""",
            (session_id,),
        ).fetchone()

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Get quiz responses
        responses = conn.execute(
            """SELECT question_index, question_text, correct_answer, child_answer, is_correct, attempt_number
               FROM quiz_responses WHERE session_id = ? ORDER BY question_index, attempt_number""",
            (session_id,),
        ).fetchall()

    weak_points = []
    recommendations = []
    if session["weak_points"]:
        try:
            weak_points = json.loads(session["weak_points"])
        except (json.JSONDecodeError, TypeError):
            pass
    if session["recommendations"]:
        try:
            recommendations = json.loads(session["recommendations"])
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "id": session["id"],
        "child_name": session["child_name"],
        "child_age": session["child_age"],
        "topic": session["topic"],
        "input_type": session["input_type"],
        "started_at": session["started_at"],
        "ended_at": session["ended_at"],
        "duration_min": max(1, (session["duration_sec"] or 0) // 60),
        "status": session["status"],
        "stars_earned": session["stars_earned"],
        "summary_text": session["summary_text"],
        "comprehension": session["comprehension"],
        "total_questions": session["total_questions"],
        "correct_answers": session["correct_answers"],
        "weak_points": weak_points,
        "recommendations": recommendations,
        "quiz_responses": [
            {
                "question_index": r["question_index"],
                "question_text": r["question_text"],
                "correct_answer": r["correct_answer"],
                "child_answer": r["child_answer"],
                "is_correct": r["is_correct"],
                "attempt": r["attempt_number"],
            }
            for r in responses
        ],
    }


@router.get("/pending")
async def list_pending(_=Depends(verify_token)):
    """B4: lessons awaiting parent approval."""
    with get_db() as conn:
        rows = conn.execute(
            """SELECT s.id, s.child_id, s.topic, s.started_at, s.lesson_json,
                      s.lesson_edited, c.name AS child_name, c.avatar_emoji
               FROM sessions s JOIN children c ON s.child_id = c.id
               WHERE s.approval_status='draft' AND s.status='ready'
                     AND s.lesson_json IS NOT NULL
               ORDER BY s.started_at DESC"""
        ).fetchall()

    pending = []
    for r in rows:
        try:
            lesson = json.loads(r["lesson_json"])
        except (json.JSONDecodeError, TypeError):
            lesson = None
        pending.append({
            "session_id": r["id"],
            "child_id": r["child_id"],
            "child_name": r["child_name"],
            "avatar_emoji": r["avatar_emoji"],
            "topic": r["topic"],
            "started_at": r["started_at"],
            "edited": bool(r["lesson_edited"]),
            "title": (lesson or {}).get("title", r["topic"]),
            "quiz_count": len((lesson or {}).get("quiz", []) or []),
            "block_count": len((lesson or {}).get("blocks", []) or []),
        })
    return {"pending": pending}


@router.get("/sessions/{session_id}/lesson-draft")
async def get_lesson_draft(session_id: int, _=Depends(verify_token)):
    """B4: full lesson JSON for the editor view (works on any approval state)."""
    with get_db() as conn:
        row = conn.execute(
            """SELECT s.id, s.child_id, s.topic, s.status, s.approval_status,
                      s.lesson_json, s.lesson_edited, s.approved_at,
                      c.name AS child_name, c.age AS child_age, c.avatar_emoji
               FROM sessions s JOIN children c ON s.child_id = c.id
               WHERE s.id = ?""",
            (session_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    lesson = json.loads(row["lesson_json"]) if row["lesson_json"] else None
    return {
        "session_id": row["id"],
        "child_id": row["child_id"],
        "child_name": row["child_name"],
        "child_age": row["child_age"],
        "avatar_emoji": row["avatar_emoji"],
        "topic": row["topic"],
        "status": row["status"],
        "approval_status": row["approval_status"],
        "approved_at": row["approved_at"],
        "edited": bool(row["lesson_edited"]),
        "lesson": lesson,
    }


@router.patch("/sessions/{session_id}/lesson")
async def edit_lesson(session_id: int, req: EditLessonRequest, _=Depends(verify_token)):
    """B4: parent edits the lesson before approval."""
    _validate_lesson_payload(req.lesson)
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, approval_status FROM sessions WHERE id=?", (session_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        conn.execute(
            "UPDATE sessions SET lesson_json=?, lesson_edited=1 WHERE id=?",
            (json.dumps(req.lesson, ensure_ascii=False), session_id),
        )
        conn.commit()
    return {"success": True, "edited": True}


@router.post("/sessions/{session_id}/approve")
async def approve_lesson(session_id: int, _=Depends(verify_token)):
    """B4: approve a draft lesson and seed its quiz into the Leitner queue."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, child_id, lesson_json, approval_status FROM sessions WHERE id=?",
            (session_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        if row["approval_status"] == "approved":
            return {"success": True, "already_approved": True}
        if not row["lesson_json"]:
            raise HTTPException(status_code=400, detail="Lesson not generated yet")
        try:
            lesson = json.loads(row["lesson_json"])
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Stored lesson is malformed")

        conn.execute(
            "UPDATE sessions SET approval_status='approved', approved_by='parent', "
            "approved_at=CURRENT_TIMESTAMP WHERE id=?",
            (session_id,),
        )
        upsert_quiz_items(conn, row["child_id"], session_id, lesson.get("quiz", []))
        conn.commit()
    return {"success": True}


@router.get("/settings")
async def get_settings(_=Depends(verify_token)):
    """B4: read parent-facing settings (auto_approve toggle)."""
    with get_db() as conn:
        row = conn.execute("SELECT auto_approve FROM settings LIMIT 1").fetchone()
    return {"auto_approve": bool(row and row["auto_approve"])}


@router.patch("/settings")
async def update_settings(req: SettingsUpdateRequest, _=Depends(verify_token)):
    """B4: toggle auto_approve."""
    with get_db() as conn:
        row = conn.execute("SELECT id FROM settings LIMIT 1").fetchone()
        if not row:
            raise HTTPException(status_code=500, detail="Settings row missing")
        conn.execute(
            "UPDATE settings SET auto_approve=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (1 if req.auto_approve else 0, row["id"]),
        )
        conn.commit()
    return {"success": True, "auto_approve": req.auto_approve}


@router.post("/change-password")
async def change_password(req: ChangePasswordRequest, _=Depends(verify_token)):
    with get_db() as conn:
        settings = conn.execute("SELECT parent_password_hash FROM settings LIMIT 1").fetchone()

    if not settings or not bcrypt.checkpw(req.old_password.encode(), settings["parent_password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Senha atual incorreta")

    new_hash = bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt()).decode()
    with get_db() as conn:
        conn.execute(
            "UPDATE settings SET parent_password_hash = ?, updated_at = CURRENT_TIMESTAMP",
            (new_hash,),
        )
        conn.commit()

    return {"success": True}
