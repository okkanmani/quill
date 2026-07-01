import os
import sqlite3
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent
_data_dir = os.environ.get("QUILL_DATA_DIR", "").strip()
DB_PATH = (
    Path(_data_dir) / "app.db"
    if _data_dir
    else _backend_dir / "data" / "app.db"
)


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_schema() -> None:
    conn = connect()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS worksheets (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                subject TEXT NOT NULL,
                scratchpad INTEGER NOT NULL DEFAULT 1,
                passages TEXT NOT NULL DEFAULT '[]',
                sort_ts INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS worksheet_questions (
                worksheet_id TEXT NOT NULL,
                sort_order INTEGER NOT NULL,
                payload TEXT NOT NULL,
                PRIMARY KEY (worksheet_id, sort_order),
                FOREIGN KEY (worksheet_id) REFERENCES worksheets(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                worksheet_id TEXT NOT NULL,
                title TEXT NOT NULL,
                student TEXT NOT NULL,
                score INTEGER NOT NULL DEFAULT -1,
                total INTEGER NOT NULL,
                answers TEXT NOT NULL,
                submitted_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'evaluated',
                evaluated_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_results_submitted_at ON results (submitted_at DESC);
            """
        )
        cols = {row[1] for row in conn.execute("PRAGMA table_info(worksheets)")}
        if "scratchpad" not in cols:
            conn.execute(
                "ALTER TABLE worksheets ADD COLUMN scratchpad INTEGER NOT NULL DEFAULT 1"
            )
        if "passages" not in cols:
            conn.execute(
                "ALTER TABLE worksheets ADD COLUMN passages TEXT NOT NULL DEFAULT '[]'"
            )
        if "sort_ts" not in cols:
            conn.execute(
                "ALTER TABLE worksheets ADD COLUMN sort_ts INTEGER NOT NULL DEFAULT 0"
            )
        if "learn_subject" not in cols:
            conn.execute("ALTER TABLE worksheets ADD COLUMN learn_subject TEXT")
        if "learn_section" not in cols:
            conn.execute("ALTER TABLE worksheets ADD COLUMN learn_section TEXT")
        if "content_badge" not in cols:
            conn.execute("ALTER TABLE worksheets ADD COLUMN content_badge TEXT")
        if "evaluation" not in cols:
            conn.execute(
                "ALTER TABLE worksheets ADD COLUMN evaluation TEXT NOT NULL DEFAULT 'auto'"
            )
        if "is_timed" not in cols:
            conn.execute(
                "ALTER TABLE worksheets ADD COLUMN is_timed INTEGER NOT NULL DEFAULT 0"
            )
        if "time_limit_minutes" not in cols:
            conn.execute("ALTER TABLE worksheets ADD COLUMN time_limit_minutes INTEGER")
        if "is_math_enrichment" not in cols:
            conn.execute(
                "ALTER TABLE worksheets ADD COLUMN is_math_enrichment INTEGER NOT NULL DEFAULT 0"
            )
        if "is_gifted_track" not in cols:
            conn.execute(
                "ALTER TABLE worksheets ADD COLUMN is_gifted_track INTEGER NOT NULL DEFAULT 0"
            )
        if "gifted_track_week" not in cols:
            conn.execute("ALTER TABLE worksheets ADD COLUMN gifted_track_week INTEGER")
        result_cols = {row[1] for row in conn.execute("PRAGMA table_info(results)")}
        if "status" not in result_cols:
            conn.execute(
                "ALTER TABLE results ADD COLUMN status TEXT NOT NULL DEFAULT 'evaluated'"
            )
        if "evaluated_at" not in result_cols:
            conn.execute("ALTER TABLE results ADD COLUMN evaluated_at TEXT")
        timed_cols = {row[1] for row in conn.execute("PRAGMA table_info(timed_attempts)")}
        if timed_cols and "locked" not in timed_cols:
            conn.execute(
                "ALTER TABLE timed_attempts ADD COLUMN locked INTEGER NOT NULL DEFAULT 0"
            )
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                password_hash TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
                UNIQUE (admin_id, name)
            );
            CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
            CREATE TABLE IF NOT EXISTS worksheet_drafts (
                student TEXT NOT NULL,
                worksheet_id TEXT NOT NULL,
                answers TEXT NOT NULL DEFAULT '{}',
                saved_at TEXT NOT NULL,
                PRIMARY KEY (student, worksheet_id)
            );
            CREATE TABLE IF NOT EXISTS timed_attempts (
                student TEXT NOT NULL,
                worksheet_id TEXT NOT NULL,
                started_at TEXT NOT NULL,
                locked INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (student, worksheet_id)
            );
            """
        )
        admin_cols = {row[1] for row in conn.execute("PRAGMA table_info(admins)")}
        if "name" not in admin_cols:
            conn.execute("ALTER TABLE admins ADD COLUMN name TEXT")
        if "openai_api_key_enc" not in admin_cols:
            conn.execute("ALTER TABLE admins ADD COLUMN openai_api_key_enc TEXT")
        orphans = conn.execute(
            """
            SELECT id FROM admins
            WHERE name IS NULL OR TRIM(name) = ''
            ORDER BY id
            """
        ).fetchall()
        for i, row in enumerate(orphans):
            nm = "admin" if i == 0 else f"admin_{row['id']}"
            conn.execute("UPDATE admins SET name = ? WHERE id = ?", (nm, row["id"]))
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_name ON admins(name)"
        )
        student_cols = {row[1] for row in conn.execute("PRAGMA table_info(students)")}
        if "grade" not in student_cols:
            conn.execute("ALTER TABLE students ADD COLUMN grade INTEGER")
        from auth_users import migrate_legacy_from_auth_json

        migrate_legacy_from_auth_json(conn)
        conn.commit()
    finally:
        conn.close()
