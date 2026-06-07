import sqlite3
from contextlib import contextmanager
from app.config import DB_PATH


def get_db_path() -> str:
    return str(DB_PATH)


def init_db():
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS children (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER NOT NULL,
            avatar_emoji TEXT DEFAULT '🧒',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_id INTEGER NOT NULL,
            topic TEXT NOT NULL,
            input_type TEXT NOT NULL DEFAULT 'text',
            original_file TEXT,
            extracted_text TEXT,
            lesson_json TEXT,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ended_at TIMESTAMP,
            duration_sec INTEGER,
            status TEXT DEFAULT 'processing',
            stars_earned INTEGER DEFAULT 0,
            FOREIGN KEY (child_id) REFERENCES children(id)
        );

        CREATE TABLE IF NOT EXISTS quiz_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            question_index INTEGER NOT NULL,
            question_text TEXT NOT NULL,
            correct_answer INTEGER NOT NULL,
            child_answer INTEGER NOT NULL,
            is_correct BOOLEAN NOT NULL,
            attempt_number INTEGER DEFAULT 1,
            answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        );

        CREATE TABLE IF NOT EXISTS session_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL UNIQUE,
            total_questions INTEGER,
            correct_answers INTEGER,
            comprehension TEXT,
            weak_points TEXT,
            recommendations TEXT,
            summary_text TEXT,
            generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_username TEXT NOT NULL,
            parent_password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP
        );
    """)

    # B1: approval gate columns (idempotent migration)
    def _add_col(table: str, col_def: str):
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col_def}")
        except sqlite3.OperationalError as e:
            if "duplicate column" not in str(e).lower():
                raise

    # Detect the one moment when approval_status doesn't yet exist — that's the migration boundary.
    # SQLite's ADD COLUMN with DEFAULT 'draft' would otherwise lock pre-existing history behind the gate.
    sessions_cols = {r[1] for r in cursor.execute("PRAGMA table_info(sessions)").fetchall()}
    is_gate_migration = "approval_status" not in sessions_cols

    _add_col("sessions", "approval_status TEXT DEFAULT 'draft'")
    _add_col("sessions", "approved_by TEXT")
    _add_col("sessions", "approved_at TIMESTAMP")
    _add_col("sessions", "lesson_edited INTEGER DEFAULT 0")
    _add_col("settings", "auto_approve INTEGER DEFAULT 0")

    if is_gate_migration:
        cursor.execute(
            "UPDATE sessions SET approval_status='approved' "
            "WHERE status IN ('completed', 'ready', 'error')"
        )

    # Seed children if empty
    cursor.execute("SELECT COUNT(*) FROM children")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            "INSERT INTO children (name, age, avatar_emoji) VALUES (?, ?, ?)",
            [
                ("Raphaela", 10, "👧"),
                ("Francisco", 8, "👦"),
                ("Antonio", 7, "🧒"),
            ],
        )

    # Seed settings if empty
    cursor.execute("SELECT COUNT(*) FROM settings")
    if cursor.fetchone()[0] == 0:
        import bcrypt
        from app.config import PARENT_DEFAULT_USERNAME, PARENT_DEFAULT_PASSWORD
        password_hash = bcrypt.hashpw(PARENT_DEFAULT_PASSWORD.encode(), bcrypt.gensalt()).decode()
        cursor.execute(
            "INSERT INTO settings (parent_username, parent_password_hash) VALUES (?, ?)",
            (PARENT_DEFAULT_USERNAME, password_hash),
        )

    conn.commit()
    conn.close()


@contextmanager
def get_db():
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
