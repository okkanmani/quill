import os
import re
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
        if "duration_seconds" not in result_cols:
            conn.execute("ALTER TABLE results ADD COLUMN duration_seconds INTEGER")
        if "status" not in result_cols:
            conn.execute(
                "ALTER TABLE results ADD COLUMN status TEXT NOT NULL DEFAULT 'evaluated'"
            )
        if "evaluated_at" not in result_cols:
            conn.execute("ALTER TABLE results ADD COLUMN evaluated_at TEXT")
        if "focus_evaluation" not in result_cols:
            conn.execute("ALTER TABLE results ADD COLUMN focus_evaluation TEXT")
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
        if "plan" not in admin_cols:
            conn.execute(
                "ALTER TABLE admins ADD COLUMN plan TEXT NOT NULL DEFAULT 'standard'"
            )
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
        if "gifted_track_unlocked_through_week" not in student_cols:
            conn.execute(
                "ALTER TABLE students ADD COLUMN gifted_track_unlocked_through_week INTEGER NOT NULL DEFAULT 1"
            )
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS student_worksheet_locks (
                student TEXT NOT NULL,
                worksheet_id TEXT NOT NULL,
                locked INTEGER NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (student, worksheet_id)
            );
            CREATE TABLE IF NOT EXISTS student_gifted_week_locks (
                student TEXT NOT NULL,
                week INTEGER NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (student, week)
            );
            CREATE TABLE IF NOT EXISTS writing_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                word_count INTEGER NOT NULL DEFAULT 0,
                submitted_at TEXT NOT NULL,
                grade TEXT,
                feedback TEXT,
                evaluated_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_writing_submissions_student
                ON writing_submissions (student, submitted_at DESC);
            CREATE TABLE IF NOT EXISTS focus_area_discussed (
                student TEXT NOT NULL,
                subject TEXT NOT NULL,
                area TEXT NOT NULL,
                discussed_at TEXT NOT NULL,
                PRIMARY KEY (student, subject, area)
            );
            CREATE INDEX IF NOT EXISTS idx_focus_area_discussed_student
                ON focus_area_discussed (student);
            CREATE TABLE IF NOT EXISTS student_revision_worksheets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student TEXT NOT NULL,
                subject TEXT NOT NULL,
                focus_area TEXT NOT NULL,
                title TEXT NOT NULL,
                payload TEXT NOT NULL,
                discussed_at TEXT,
                created_at TEXT NOT NULL,
                completed_at TEXT,
                score INTEGER,
                total INTEGER NOT NULL DEFAULT 5
            );
            CREATE INDEX IF NOT EXISTS idx_revision_worksheets_student
                ON student_revision_worksheets (student, created_at DESC);
            CREATE TABLE IF NOT EXISTS learn_sections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject_key TEXT NOT NULL,
                section_id TEXT NOT NULL,
                title TEXT NOT NULL,
                markdown TEXT NOT NULL,
                group_id TEXT NOT NULL DEFAULT 'main',
                group_title TEXT NOT NULL DEFAULT 'Sections',
                subject_title TEXT,
                subject_description TEXT,
                grade INTEGER,
                curriculum TEXT,
                created_at TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                UNIQUE(subject_key, section_id)
            );
            CREATE INDEX IF NOT EXISTS idx_learn_sections_subject
                ON learn_sections (subject_key);
            """
        )
        learn_cols = {
            row[1] for row in conn.execute("PRAGMA table_info(learn_sections)")
        }
        if learn_cols and "sort_order" not in learn_cols:
            conn.execute(
                "ALTER TABLE learn_sections ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"
            )
            conn.execute("UPDATE learn_sections SET sort_order = id")
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS learn_hub_order (
                scope TEXT NOT NULL,
                subject_key TEXT NOT NULL,
                sort_order INTEGER NOT NULL,
                PRIMARY KEY (scope, subject_key)
            );
            CREATE TABLE IF NOT EXISTS learn_page_notes (
                student TEXT NOT NULL,
                subject_key TEXT NOT NULL,
                section_id TEXT NOT NULL,
                page_index INTEGER NOT NULL DEFAULT 0,
                body TEXT NOT NULL DEFAULT '',
                ai_used INTEGER NOT NULL DEFAULT 0,
                saved_at TEXT NOT NULL,
                PRIMARY KEY (student, subject_key, section_id, page_index)
            );
            CREATE INDEX IF NOT EXISTS idx_learn_page_notes_student
                ON learn_page_notes (student, subject_key);
            CREATE TABLE IF NOT EXISTS learn_page_highlights (
                student TEXT NOT NULL,
                subject_key TEXT NOT NULL,
                section_id TEXT NOT NULL,
                page_index INTEGER NOT NULL DEFAULT 0,
                highlights TEXT NOT NULL DEFAULT '[]',
                saved_at TEXT NOT NULL,
                PRIMARY KEY (student, subject_key, section_id, page_index)
            );
            CREATE INDEX IF NOT EXISTS idx_learn_page_highlights_student
                ON learn_page_highlights (student, subject_key);
            """
        )
        writing_cols = {
            row[1] for row in conn.execute("PRAGMA table_info(writing_submissions)")
        }
        if writing_cols:
            if "grade" not in writing_cols:
                conn.execute("ALTER TABLE writing_submissions ADD COLUMN grade TEXT")
            if "evaluated_at" not in writing_cols:
                conn.execute(
                    "ALTER TABLE writing_submissions ADD COLUMN evaluated_at TEXT"
                )
            if "feedback" not in writing_cols:
                conn.execute("ALTER TABLE writing_submissions ADD COLUMN feedback TEXT")
        revision_cols = {
            row[1]
            for row in conn.execute("PRAGMA table_info(student_revision_worksheets)")
        }
        if revision_cols and "answers" not in revision_cols:
            conn.execute(
                "ALTER TABLE student_revision_worksheets ADD COLUMN answers TEXT"
            )
        focus_discussion_cols = {
            row[1] for row in conn.execute("PRAGMA table_info(focus_area_discussed)")
        }
        if focus_discussion_cols:
            if "reinforcement_count" not in focus_discussion_cols:
                conn.execute(
                    "ALTER TABLE focus_area_discussed ADD COLUMN reinforcement_count INTEGER NOT NULL DEFAULT 0"
                )
            if "last_reinforced_at" not in focus_discussion_cols:
                conn.execute(
                    "ALTER TABLE focus_area_discussed ADD COLUMN last_reinforced_at TEXT"
                )
        from auth_users import migrate_legacy_from_auth_json

        migrate_legacy_from_auth_json(conn)

        default_admin_row = conn.execute("SELECT MIN(id) AS id FROM admins").fetchone()
        default_admin_id = (
            int(default_admin_row["id"]) if default_admin_row and default_admin_row["id"] is not None else None
        )
        worksheet_cols = {
            row[1] for row in conn.execute("PRAGMA table_info(worksheets)")
        }
        if "admin_id" not in worksheet_cols:
            conn.execute(
                "ALTER TABLE worksheets ADD COLUMN admin_id INTEGER REFERENCES admins(id)"
            )
            if default_admin_id is not None:
                conn.execute(
                    "UPDATE worksheets SET admin_id = ? WHERE admin_id IS NULL",
                    (default_admin_id,),
                )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_worksheets_admin ON worksheets (admin_id)"
            )
        learn_section_cols = {
            row[1] for row in conn.execute("PRAGMA table_info(learn_sections)")
        }
        if learn_section_cols and "admin_id" not in learn_section_cols:
            conn.execute(
                "ALTER TABLE learn_sections ADD COLUMN admin_id INTEGER REFERENCES admins(id)"
            )
            if default_admin_id is not None:
                conn.execute(
                    "UPDATE learn_sections SET admin_id = ? WHERE admin_id IS NULL",
                    (default_admin_id,),
                )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_learn_sections_admin ON learn_sections (admin_id)"
            )

        highlight_tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        if "learn_page_highlights" not in highlight_tables:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS learn_page_highlights (
                    student TEXT NOT NULL,
                    subject_key TEXT NOT NULL,
                    section_id TEXT NOT NULL,
                    page_index INTEGER NOT NULL DEFAULT 0,
                    highlights TEXT NOT NULL DEFAULT '[]',
                    saved_at TEXT NOT NULL,
                    PRIMARY KEY (student, subject_key, section_id, page_index)
                );
                CREATE INDEX IF NOT EXISTS idx_learn_page_highlights_student
                    ON learn_page_highlights (student, subject_key);
                """
            )

        _migrate_learn_sections_per_tenant_unique(conn)
        if default_admin_id is not None:
            _migrate_learn_hub_order_admin_scopes(conn, default_admin_id)

        conn.commit()
    finally:
        conn.close()


def _is_admin_scoped_hub_scope(scope: str) -> bool:
    if not scope or not scope.startswith("a"):
        return False
    rest = scope[1:]
    colon = rest.find(":")
    if colon <= 0:
        return False
    return rest[:colon].isdigit()


def _migrate_learn_sections_per_tenant_unique(conn: sqlite3.Connection) -> None:
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='learn_sections'"
    ).fetchone()
    if not row or not row[0]:
        return
    ddl = re.sub(r"\s+", "", row[0])
    if "UNIQUE(admin_id,subject_key,section_id)" in ddl:
        return
    if "UNIQUE(subject_key,section_id)" not in ddl:
        return
    conn.executescript(
        """
        CREATE TABLE learn_sections_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_key TEXT NOT NULL,
            section_id TEXT NOT NULL,
            title TEXT NOT NULL,
            markdown TEXT NOT NULL,
            group_id TEXT NOT NULL DEFAULT 'main',
            group_title TEXT NOT NULL DEFAULT 'Sections',
            subject_title TEXT,
            subject_description TEXT,
            grade INTEGER,
            curriculum TEXT,
            created_at TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            admin_id INTEGER REFERENCES admins(id),
            UNIQUE(admin_id, subject_key, section_id)
        );
        INSERT INTO learn_sections_new (
            id, subject_key, section_id, title, markdown,
            group_id, group_title, subject_title, subject_description,
            grade, curriculum, created_at, sort_order, admin_id
        )
        SELECT
            id, subject_key, section_id, title, markdown,
            group_id, group_title, subject_title, subject_description,
            grade, curriculum, created_at, sort_order, admin_id
        FROM learn_sections;
        DROP TABLE learn_sections;
        ALTER TABLE learn_sections_new RENAME TO learn_sections;
        CREATE INDEX IF NOT EXISTS idx_learn_sections_subject
            ON learn_sections (subject_key);
        CREATE INDEX IF NOT EXISTS idx_learn_sections_admin
            ON learn_sections (admin_id);
        """
    )


def _migrate_learn_hub_order_admin_scopes(
    conn: sqlite3.Connection, default_admin_id: int
) -> None:
    rows = conn.execute(
        "SELECT scope, subject_key FROM learn_hub_order"
    ).fetchall()
    for row in rows:
        scope = row["scope"]
        if _is_admin_scoped_hub_scope(scope):
            continue
        new_scope = f"a{default_admin_id}:{scope}"
        conn.execute(
            """
            UPDATE learn_hub_order
            SET scope = ?
            WHERE scope = ? AND subject_key = ?
            """,
            (new_scope, scope, row["subject_key"]),
        )
