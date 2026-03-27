import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "data" / "app.db"


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
                subject TEXT NOT NULL
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
        conn.commit()
    finally:
        conn.close()
