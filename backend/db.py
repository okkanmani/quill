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
                score INTEGER NOT NULL,
                total INTEGER NOT NULL,
                answers TEXT NOT NULL,
                submitted_at TEXT NOT NULL
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
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            """
        )
        from auth_users import migrate_legacy_from_auth_json

        migrate_legacy_from_auth_json(conn)
        conn.commit()
    finally:
        conn.close()
