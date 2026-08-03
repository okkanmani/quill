"""Multi-subject composite tests built from existing subject test worksheets."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import db
from auth_users import list_students_for_admin
from worksheets import (
    admin_id_for_student_name,
    assert_worksheet_owned_by_admin,
    get_worksheet,
    set_worksheet_access_lock,
)


def composite_lock_source(composite_id: str) -> str:
    return f"composite:{composite_id}"


def ensure_composite_test_schema(conn) -> None:
    ensure_test_attempts_composite_separation(conn)
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS composite_tests (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            admin_id INTEGER NOT NULL,
            sort_ts TEXT NOT NULL,
            scheduled_unlock_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_composite_tests_admin
            ON composite_tests (admin_id, sort_ts DESC);
        CREATE TABLE IF NOT EXISTS composite_test_sections (
            composite_id TEXT NOT NULL,
            worksheet_id TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (composite_id, worksheet_id),
            FOREIGN KEY (composite_id) REFERENCES composite_tests(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_composite_sections_worksheet
            ON composite_test_sections (worksheet_id);
        CREATE TABLE IF NOT EXISTS composite_test_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            composite_id TEXT NOT NULL,
            student TEXT NOT NULL,
            started_at TEXT NOT NULL,
            completed_at TEXT,
            weighted_score REAL,
            max_weighted_score REAL,
            duration_seconds INTEGER,
            UNIQUE (student, composite_id),
            FOREIGN KEY (composite_id) REFERENCES composite_tests(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_composite_attempts_student
            ON composite_test_attempts (student, completed_at DESC);
        CREATE TABLE IF NOT EXISTS student_composite_locks (
            student TEXT NOT NULL,
            composite_id TEXT NOT NULL,
            locked INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT NOT NULL,
            scheduled_unlock_at TEXT,
            PRIMARY KEY (student, composite_id),
            FOREIGN KEY (composite_id) REFERENCES composite_tests(id) ON DELETE CASCADE
        );
        """
    )
    lock_cols = {
        row[1] for row in conn.execute("PRAGMA table_info(student_worksheet_locks)")
    }
    if lock_cols and "lock_source" not in lock_cols:
        conn.execute("ALTER TABLE student_worksheet_locks ADD COLUMN lock_source TEXT")


def ensure_test_attempts_composite_separation(conn) -> None:
    """Allow one standalone and one composite-section attempt per student + worksheet."""
    attempt_cols = {
        row[1] for row in conn.execute("PRAGMA table_info(test_attempts)")
    }
    if not attempt_cols:
        return

    if "composite_attempt_id" not in attempt_cols:
        conn.execute(
            "ALTER TABLE test_attempts ADD COLUMN composite_attempt_id INTEGER"
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_test_attempts_composite
                ON test_attempts (composite_attempt_id)
            """
        )

    table_sql = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='test_attempts'"
    ).fetchone()
    ddl = (table_sql[0] or "") if table_sql else ""
    if "UNIQUE (student, worksheet_id)" in ddl:
        conn.executescript(
            """
            CREATE TABLE test_attempts__sep (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student TEXT NOT NULL,
                worksheet_id TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                locked INTEGER NOT NULL DEFAULT 0,
                sitting_count INTEGER NOT NULL DEFAULT 20,
                sequence TEXT NOT NULL DEFAULT '[]',
                answers TEXT NOT NULL DEFAULT '{}',
                weighted_score REAL,
                max_weighted_score REAL,
                duration_seconds INTEGER,
                analyzed_at TEXT,
                composite_attempt_id INTEGER
            );
            INSERT INTO test_attempts__sep (
                id, student, worksheet_id, started_at, completed_at, locked,
                sitting_count, sequence, answers, weighted_score, max_weighted_score,
                duration_seconds, analyzed_at, composite_attempt_id
            )
            SELECT
                id, student, worksheet_id, started_at, completed_at, locked,
                sitting_count, sequence, answers, weighted_score, max_weighted_score,
                duration_seconds, analyzed_at, composite_attempt_id
            FROM test_attempts;
            DROP TABLE test_attempts;
            ALTER TABLE test_attempts__sep RENAME TO test_attempts;
            CREATE INDEX IF NOT EXISTS idx_test_attempts_student
                ON test_attempts (student, completed_at DESC);
            CREATE INDEX IF NOT EXISTS idx_test_attempts_composite
                ON test_attempts (composite_attempt_id);
            """
        )
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_test_attempts_standalone
            ON test_attempts(student, worksheet_id)
            WHERE composite_attempt_id IS NULL
        """
    )
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_test_attempts_composite_section
            ON test_attempts(student, worksheet_id, composite_attempt_id)
            WHERE composite_attempt_id IS NOT NULL
        """
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_composite_id() -> str:
    return f"composite-{uuid.uuid4().hex[:12]}"


def _parse_json(raw, default):
    if raw is None:
        return default
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return default


def _section_rows(conn, composite_id: str) -> list:
    return conn.execute(
        """
        SELECT cts.worksheet_id, cts.sort_order, w.title, w.subject
        FROM composite_test_sections cts
        JOIN worksheets w ON w.id = cts.worksheet_id
        WHERE cts.composite_id = ?
        ORDER BY cts.sort_order ASC, cts.worksheet_id ASC
        """,
        (composite_id,),
    ).fetchall()


def assert_composite_owned_by_admin(composite_id: str, admin_id: int) -> None:
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT id FROM composite_tests WHERE id = ? AND admin_id = ?",
            (composite_id, admin_id),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise ValueError("Composite test not found.")


def _validate_section_worksheets(admin_id: int, worksheet_ids: list[str]) -> None:
    if len(worksheet_ids) < 2:
        raise ValueError("Select at least two subject tests.")
    if len(set(worksheet_ids)) != len(worksheet_ids):
        raise ValueError("Each subject test can only appear once.")
    for worksheet_id in worksheet_ids:
        assert_worksheet_owned_by_admin(worksheet_id, admin_id)
        ws = get_worksheet(worksheet_id, admin_id=admin_id)
        if not ws or not ws.get("is_test"):
            raise ValueError(f"“{worksheet_id}” is not a test worksheet.")


def _composite_record(conn, row, *, include_sections: bool = True) -> dict:
    out = {
        "id": row["id"],
        "title": row["title"],
        "admin_id": row["admin_id"],
        "scheduled_unlock_at": row["scheduled_unlock_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
    if include_sections:
        out["sections"] = [
            {
                "worksheet_id": sec["worksheet_id"],
                "sort_order": int(sec["sort_order"]),
                "title": sec["title"] or sec["worksheet_id"],
                "subject": sec["subject"] or "general",
            }
            for sec in _section_rows(conn, row["id"])
        ]
    return out


def list_eligible_section_worksheets(admin_id: int) -> list[dict]:
    conn = db.connect()
    try:
        from worksheets import _default_admin_id

        default_admin = _default_admin_id(conn)
        rows = conn.execute(
            """
            SELECT id, title, subject, test_sitting_count, time_limit_minutes,
                   COALESCE(test_adaptive, 0) AS test_adaptive
            FROM worksheets
            WHERE COALESCE(is_test, 0) = 1
              AND (admin_id = ? OR (admin_id IS NULL AND ? = ?))
            ORDER BY subject ASC, title ASC
            """,
            (admin_id, admin_id, default_admin),
        ).fetchall()
        return [
            {
                "id": row["id"],
                "title": row["title"] or row["id"],
                "subject": row["subject"] or "general",
                "test_sitting_count": int(row["test_sitting_count"] or 20),
                "time_limit_minutes": row["time_limit_minutes"],
                "test_adaptive": bool(row["test_adaptive"]),
            }
            for row in rows
        ]
    finally:
        conn.close()


def list_composite_tests(admin_id: int) -> list[dict]:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT * FROM composite_tests
            WHERE admin_id = ?
            ORDER BY sort_ts DESC, title ASC
            """,
            (admin_id,),
        ).fetchall()
        return [_composite_record(conn, row) for row in rows]
    finally:
        conn.close()


def get_composite_test(composite_id: str, admin_id: int) -> dict:
    assert_composite_owned_by_admin(composite_id, admin_id)
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT * FROM composite_tests WHERE id = ?",
            (composite_id,),
        ).fetchone()
        if not row:
            raise ValueError("Composite test not found.")
        return _composite_record(conn, row)
    finally:
        conn.close()


def create_composite_test(
    admin_id: int,
    *,
    title: str,
    section_worksheet_ids: list[str],
    scheduled_unlock_at: str | None = None,
    lock_on_create: bool = False,
) -> dict:
    title = (title or "").strip()
    if not title:
        raise ValueError("Title is required.")
    _validate_section_worksheets(admin_id, section_worksheet_ids)
    composite_id = _new_composite_id()
    now = _now_iso()
    conn = db.connect()
    try:
        conn.execute(
            """
            INSERT INTO composite_tests (
                id, title, admin_id, sort_ts, scheduled_unlock_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                composite_id,
                title,
                admin_id,
                now,
                scheduled_unlock_at,
                now,
                now,
            ),
        )
        for index, worksheet_id in enumerate(section_worksheet_ids):
            conn.execute(
                """
                INSERT INTO composite_test_sections (composite_id, worksheet_id, sort_order)
                VALUES (?, ?, ?)
                """,
                (composite_id, worksheet_id, index),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    if scheduled_unlock_at:
        from test_scheduling import validate_future_unlock_at

        schedule_composite_unlock_for_admin(
            admin_id,
            composite_id,
            validate_future_unlock_at(scheduled_unlock_at),
        )
    elif lock_on_create:
        lock_composite_for_admin_students(admin_id, composite_id, locked=True)

    return get_composite_test(composite_id, admin_id)


def update_composite_test(
    composite_id: str,
    admin_id: int,
    *,
    title: str,
    section_worksheet_ids: list[str],
    scheduled_unlock_at: str | None = None,
    unlock_students_now: bool = False,
) -> dict:
    assert_composite_owned_by_admin(composite_id, admin_id)
    title = (title or "").strip()
    if not title:
        raise ValueError("Title is required.")
    _validate_section_worksheets(admin_id, section_worksheet_ids)
    now = _now_iso()
    conn = db.connect()
    try:
        attempt_count = conn.execute(
            """
            SELECT COUNT(*) AS n FROM composite_test_attempts
            WHERE composite_id = ? AND completed_at IS NOT NULL
            """,
            (composite_id,),
        ).fetchone()["n"]
        if attempt_count:
            current_sections = [
                row["worksheet_id"] for row in _section_rows(conn, composite_id)
            ]
            if current_sections != section_worksheet_ids:
                raise ValueError(
                    "Cannot change sections after students have submitted this composite."
                )
        conn.execute(
            """
            UPDATE composite_tests
            SET title = ?, updated_at = ?, scheduled_unlock_at = ?
            WHERE id = ?
            """,
            (title, now, scheduled_unlock_at, composite_id),
        )
        conn.execute(
            "DELETE FROM composite_test_sections WHERE composite_id = ?",
            (composite_id,),
        )
        for index, worksheet_id in enumerate(section_worksheet_ids):
            conn.execute(
                """
                INSERT INTO composite_test_sections (composite_id, worksheet_id, sort_order)
                VALUES (?, ?, ?)
                """,
                (composite_id, worksheet_id, index),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    if unlock_students_now:
        unlock_composite_for_admin_students(admin_id, composite_id)
    elif scheduled_unlock_at:
        from test_scheduling import validate_future_unlock_at

        schedule_composite_unlock_for_admin(
            admin_id,
            composite_id,
            validate_future_unlock_at(scheduled_unlock_at),
        )

    return get_composite_test(composite_id, admin_id)


def delete_composite_test(composite_id: str, admin_id: int) -> None:
    assert_composite_owned_by_admin(composite_id, admin_id)
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT COUNT(*) AS n FROM composite_test_attempts
            WHERE composite_id = ?
            """,
            (composite_id,),
        ).fetchone()
        if row and int(row["n"]) > 0:
            raise ValueError("Cannot delete a composite that has student attempts.")
        conn.execute("DELETE FROM composite_tests WHERE id = ?", (composite_id,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def is_composite_locked_for_student(
    conn, student_name: str, composite_id: str
) -> bool:
    from test_scheduling import scheduled_unlock_is_due

    row = conn.execute(
        """
        SELECT locked, scheduled_unlock_at FROM student_composite_locks
        WHERE student = ? AND composite_id = ?
        """,
        (student_name, composite_id),
    ).fetchone()
    if not row or int(row["locked"] or 0) == 0:
        return False
    sched = row["scheduled_unlock_at"]
    if sched and scheduled_unlock_is_due(str(sched)):
        return False
    return True


def is_worksheet_in_locked_composite(student_name: str, worksheet_id: str) -> bool:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT cts.composite_id
            FROM composite_test_sections cts
            JOIN student_composite_locks scl
              ON scl.composite_id = cts.composite_id AND scl.student = ?
            WHERE cts.worksheet_id = ? AND scl.locked = 1
            """,
            (student_name, worksheet_id),
        ).fetchall()
        for row in rows:
            if is_composite_locked_for_student(conn, student_name, row["composite_id"]):
                return True
        return False
    finally:
        conn.close()


def _propagate_composite_worksheet_lock(
    student_name: str,
    composite_id: str,
    *,
    locked: bool,
    scheduled_unlock_at: str | None = None,
) -> None:
    source = composite_lock_source(composite_id)
    conn = db.connect()
    try:
        sections = _section_rows(conn, composite_id)
    finally:
        conn.close()
    for sec in sections:
        worksheet_id = sec["worksheet_id"]
        if locked:
            conn = db.connect()
            try:
                existing = conn.execute(
                    """
                    SELECT locked, lock_source FROM student_worksheet_locks
                    WHERE student = ? AND worksheet_id = ?
                    """,
                    (student_name, worksheet_id),
                ).fetchone()
            finally:
                conn.close()
            if (
                existing
                and int(existing["locked"] or 0) == 1
                and (existing["lock_source"] or "") == "admin"
            ):
                continue
            set_worksheet_access_lock(
                student_name,
                worksheet_id,
                locked=True,
                scheduled_unlock_at=scheduled_unlock_at,
                lock_source=source,
            )
        else:
            conn = db.connect()
            try:
                conn.execute(
                    """
                    DELETE FROM student_worksheet_locks
                    WHERE student = ? AND worksheet_id = ? AND lock_source = ?
                    """,
                    (student_name, worksheet_id, source),
                )
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()


def set_composite_lock_for_student(
    student_name: str,
    composite_id: str,
    *,
    locked: bool,
    scheduled_unlock_at: str | None = None,
) -> None:
    updated_at = _now_iso()
    schedule_value = None
    if locked and scheduled_unlock_at:
        from test_scheduling import validate_future_unlock_at

        schedule_value = validate_future_unlock_at(scheduled_unlock_at)
    conn = db.connect()
    try:
        if locked:
            conn.execute(
                """
                INSERT INTO student_composite_locks
                  (student, composite_id, locked, updated_at, scheduled_unlock_at)
                VALUES (?, ?, 1, ?, ?)
                ON CONFLICT(student, composite_id) DO UPDATE SET
                  locked = 1,
                  updated_at = excluded.updated_at,
                  scheduled_unlock_at = excluded.scheduled_unlock_at
                """,
                (student_name, composite_id, updated_at, schedule_value),
            )
        else:
            conn.execute(
                """
                DELETE FROM student_composite_locks
                WHERE student = ? AND composite_id = ?
                """,
                (student_name, composite_id),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    _propagate_composite_worksheet_lock(
        student_name,
        composite_id,
        locked=locked,
        scheduled_unlock_at=schedule_value,
    )


def lock_composite_for_admin_students(
    admin_id: int,
    composite_id: str,
    *,
    locked: bool,
    scheduled_unlock_at: str | None = None,
    student_name: str | None = None,
) -> int:
    assert_composite_owned_by_admin(composite_id, admin_id)
    if student_name:
        set_composite_lock_for_student(
            student_name,
            composite_id,
            locked=locked,
            scheduled_unlock_at=scheduled_unlock_at,
        )
        return 1
    count = 0
    for row in list_students_for_admin(admin_id):
        set_composite_lock_for_student(
            row["name"],
            composite_id,
            locked=locked,
            scheduled_unlock_at=scheduled_unlock_at,
        )
        count += 1
    return count


def schedule_composite_unlock_for_admin(
    admin_id: int,
    composite_id: str,
    unlock_at: str,
    *,
    student_name: str | None = None,
) -> int:
    return lock_composite_for_admin_students(
        admin_id,
        composite_id,
        locked=True,
        scheduled_unlock_at=unlock_at,
        student_name=student_name,
    )


def unlock_composite_for_admin_students(
    admin_id: int,
    composite_id: str,
    *,
    student_name: str | None = None,
) -> int:
    return lock_composite_for_admin_students(
        admin_id,
        composite_id,
        locked=False,
        student_name=student_name,
    )


def assert_composite_accessible(student_name: str, composite_id: str) -> None:
    conn = db.connect()
    try:
        if is_composite_locked_for_student(conn, student_name, composite_id):
            raise ValueError(
                "This composite assessment is locked. Ask your teacher to unlock it."
            )
    finally:
        conn.close()


def _active_composite_attempt_id(
    conn, student_name: str, worksheet_id: str
) -> int | None:
    row = conn.execute(
        """
        SELECT cta.id
        FROM composite_test_attempts cta
        JOIN composite_test_sections cts ON cts.composite_id = cta.composite_id
        WHERE cta.student = ?
          AND cts.worksheet_id = ?
          AND cta.completed_at IS NULL
        LIMIT 1
        """,
        (student_name, worksheet_id),
    ).fetchone()
    return int(row["id"]) if row else None


def assert_worksheet_not_blocked_by_active_composite(
    student_name: str, worksheet_id: str, *, composite_attempt_id: int | None
) -> None:
    if composite_attempt_id is not None:
        return
    conn = db.connect()
    try:
        active = _active_composite_attempt_id(conn, student_name, worksheet_id)
    finally:
        conn.close()
    if active:
        raise ValueError(
            "Continue this subject test from the composite assessment hub."
        )


def validate_composite_attempt_link(
    student_name: str,
    worksheet_id: str,
    composite_attempt_id: int,
) -> None:
    conn = db.connect()
    try:
        attempt = conn.execute(
            """
            SELECT id, composite_id, student, completed_at
            FROM composite_test_attempts
            WHERE id = ?
            """,
            (composite_attempt_id,),
        ).fetchone()
        if not attempt or attempt["student"] != student_name:
            raise ValueError("Composite attempt not found.")
        if attempt["completed_at"]:
            raise ValueError("This composite assessment was already submitted.")
        section = conn.execute(
            """
            SELECT 1 FROM composite_test_sections
            WHERE composite_id = ? AND worksheet_id = ?
            """,
            (attempt["composite_id"], worksheet_id),
        ).fetchone()
        if not section:
            raise ValueError("This test is not part of that composite assessment.")
        assert_composite_accessible(student_name, attempt["composite_id"])
    finally:
        conn.close()


def start_composite_attempt(student_name: str, composite_id: str) -> dict:
    assert_composite_accessible(student_name, composite_id)
    conn = db.connect()
    try:
        existing = conn.execute(
            """
            SELECT * FROM composite_test_attempts
            WHERE student = ? AND composite_id = ?
            """,
            (student_name, composite_id),
        ).fetchone()
        if existing:
            if existing["completed_at"]:
                raise ValueError("This composite assessment was already submitted.")
            return get_composite_hub(student_name, composite_id)
        started_at = _now_iso()
        cur = conn.execute(
            """
            INSERT INTO composite_test_attempts (composite_id, student, started_at)
            VALUES (?, ?, ?)
            """,
            (composite_id, student_name, started_at),
        )
        conn.commit()
        attempt_id = cur.lastrowid
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    hub = get_composite_hub(student_name, composite_id)
    hub["attempt_id"] = attempt_id
    return hub


def _section_status(conn, student_name: str, composite_attempt_id: int, worksheet_id: str) -> dict:
    row = None
    if composite_attempt_id:
        row = conn.execute(
            """
            SELECT id, started_at, completed_at, locked, weighted_score, max_weighted_score,
                   duration_seconds, composite_attempt_id
            FROM test_attempts
            WHERE student = ? AND worksheet_id = ? AND composite_attempt_id = ?
            """,
            (student_name, worksheet_id, composite_attempt_id),
        ).fetchone()
    ws = get_worksheet(worksheet_id)
    base = {
        "worksheet_id": worksheet_id,
        "title": (ws or {}).get("title") or worksheet_id,
        "subject": (ws or {}).get("subject") or "general",
        "time_limit_minutes": (ws or {}).get("time_limit_minutes"),
        "weighted_score": None,
        "max_weighted_score": None,
        "duration_seconds": None,
    }
    if not row:
        return {**base, "status": "not_started", "attempt_id": None}
    if row["completed_at"]:
        return {
            **base,
            "status": "completed",
            "attempt_id": row["id"],
            "weighted_score": float(row["weighted_score"] or 0),
            "max_weighted_score": float(row["max_weighted_score"] or 0),
            "duration_seconds": row["duration_seconds"],
        }
    return {**base, "status": "in_progress", "attempt_id": row["id"]}


def get_composite_hub(student_name: str, composite_id: str) -> dict:
    conn = db.connect()
    try:
        composite = conn.execute(
            "SELECT * FROM composite_tests WHERE id = ?",
            (composite_id,),
        ).fetchone()
        if not composite:
            raise ValueError("Composite test not found.")
        attempt = conn.execute(
            """
            SELECT * FROM composite_test_attempts
            WHERE student = ? AND composite_id = ?
            """,
            (student_name, composite_id),
        ).fetchone()
        sections = [
            _section_status(
                conn,
                student_name,
                attempt["id"] if attempt else 0,
                sec["worksheet_id"],
            )
            for sec in _section_rows(conn, composite_id)
        ]
    finally:
        conn.close()

    scores_visible = bool(attempt and attempt["completed_at"])
    if not scores_visible:
        for section in sections:
            section["weighted_score"] = None
            section["max_weighted_score"] = None
            section["duration_seconds"] = None

    all_complete = bool(sections) and all(
        s["status"] == "completed" for s in sections
    )
    any_started = any(s["status"] != "not_started" for s in sections)
    can_submit = bool(attempt) and all_complete and not attempt["completed_at"]

    overall = None
    if scores_visible and attempt and attempt["completed_at"]:
        overall = {
            "weighted_score": float(attempt["weighted_score"] or 0),
            "max_weighted_score": float(attempt["max_weighted_score"] or 0),
            "duration_seconds": attempt["duration_seconds"],
            "completed_at": attempt["completed_at"],
        }

    return {
        "composite_id": composite_id,
        "title": composite["title"],
        "attempt_id": attempt["id"] if attempt else None,
        "started_at": attempt["started_at"] if attempt else None,
        "completed_at": attempt["completed_at"] if attempt else None,
        "all_complete": all_complete,
        "any_started": any_started,
        "can_submit": can_submit,
        "overall": overall,
        "sections": sections,
    }


def list_composites_for_student(student_name: str) -> list[dict]:
    admin_id = admin_id_for_student_name(student_name)
    if admin_id is None:
        return []
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT ct.*
            FROM composite_tests ct
            WHERE ct.admin_id = ?
            ORDER BY ct.sort_ts DESC, ct.title ASC
            """,
            (admin_id,),
        ).fetchall()
        out = []
        for row in rows:
            locked = is_composite_locked_for_student(conn, student_name, row["id"])
            hub = get_composite_hub(student_name, row["id"])
            out.append(
                {
                    "id": row["id"],
                    "title": row["title"],
                    "locked": locked,
                    "scheduled_unlock_at": row["scheduled_unlock_at"],
                    "section_count": len(hub["sections"]),
                    "attempt_id": hub["attempt_id"],
                    "completed_at": hub["completed_at"],
                    "can_submit": hub["can_submit"],
                    "all_complete": hub["all_complete"],
                    "overall": hub["overall"],
                }
            )
        return out
    finally:
        conn.close()


def submit_composite(student_name: str, composite_id: str) -> dict:
    hub = get_composite_hub(student_name, composite_id)
    if not hub["attempt_id"]:
        raise ValueError("Start the composite assessment before submitting.")
    if hub["completed_at"]:
        raise ValueError("This composite assessment was already submitted.")
    if not hub["all_complete"]:
        raise ValueError("Complete every subject test before submitting.")

    from tests import create_test_review_for_attempt

    conn = db.connect()
    try:
        attempt = conn.execute(
            """
            SELECT * FROM composite_test_attempts
            WHERE id = ? AND student = ?
            """,
            (hub["attempt_id"], student_name),
        ).fetchone()
        if not attempt:
            raise ValueError("Composite attempt not found.")

        total_weighted = 0.0
        total_max = 0.0
        total_duration = 0
        review_ids = []
        for section in hub["sections"]:
            child = conn.execute(
                """
                SELECT id, weighted_score, max_weighted_score, duration_seconds,
                       composite_attempt_id
                FROM test_attempts
                WHERE student = ? AND worksheet_id = ? AND completed_at IS NOT NULL
                  AND composite_attempt_id = ?
                """,
                (student_name, section["worksheet_id"], hub["attempt_id"]),
            ).fetchone()
            if not child:
                raise ValueError("Complete every subject test before submitting.")
            total_weighted += float(child["weighted_score"] or 0)
            total_max += float(child["max_weighted_score"] or 0)
            total_duration += int(child["duration_seconds"] or 0)
            review_id = create_test_review_for_attempt(conn, child["id"], student_name)
            if review_id:
                review_ids.append(review_id)

        completed_at = _now_iso()
        conn.execute(
            """
            UPDATE composite_test_attempts
            SET completed_at = ?, weighted_score = ?, max_weighted_score = ?,
                duration_seconds = ?
            WHERE id = ?
            """,
            (completed_at, total_weighted, total_max, total_duration, attempt["id"]),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    result = get_composite_hub(student_name, composite_id)
    result["review_ids"] = review_ids
    return result


def abandon_composite_sitting(student_name: str, composite_id: str) -> dict:
    """Auto-submit any in-progress composite sections when the student leaves the hub."""
    hub = get_composite_hub(student_name, composite_id)
    if not hub.get("attempt_id"):
        return hub
    if hub.get("completed_at"):
        raise ValueError("This composite assessment was already submitted.")

    from tests import submit_test

    attempt_id = int(hub["attempt_id"])
    for section in hub.get("sections") or []:
        if section.get("status") != "in_progress":
            continue
        try:
            submit_test(
                student_name,
                section["worksheet_id"],
                composite_attempt_id=attempt_id,
                force_partial=True,
            )
        except ValueError as exc:
            msg = str(exc)
            if "No test attempt" in msg or "already submitted" in msg.lower():
                continue
            raise

    return get_composite_hub(student_name, composite_id)


def unlock_composite_sitting(
    admin_id: int,
    *,
    composite_id: str,
    student_name: str,
) -> None:
    assert_composite_owned_by_admin(composite_id, admin_id)
    conn = db.connect()
    try:
        attempt = conn.execute(
            """
            SELECT id FROM composite_test_attempts
            WHERE composite_id = ? AND student = ? AND completed_at IS NULL
            """,
            (composite_id, student_name),
        ).fetchone()
        if not attempt:
            raise ValueError("No in-progress composite sitting to unlock.")
        attempt_id = attempt["id"]
        conn.execute(
            "DELETE FROM test_attempts WHERE composite_attempt_id = ?",
            (attempt_id,),
        )
        conn.execute(
            "DELETE FROM composite_test_attempts WHERE id = ?",
            (attempt_id,),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_composite_test_results(student_name: str) -> list[dict]:
    from tests import _TEST_RESULT_SELECT, build_test_result_record

    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT cta.*, ct.title
            FROM composite_test_attempts cta
            JOIN composite_tests ct ON ct.id = cta.composite_id
            WHERE cta.student = ? AND cta.completed_at IS NOT NULL
            ORDER BY cta.completed_at DESC
            """,
            (student_name,),
        ).fetchall()
        records = []
        for row in rows:
            hub = get_composite_hub(student_name, row["composite_id"])
            sections = []
            for section in hub["sections"]:
                sec = dict(section)
                attempt_id = sec.get("attempt_id")
                if attempt_id and sec.get("status") == "completed":
                    attempt_row = conn.execute(
                        f"""
                        {_TEST_RESULT_SELECT}
                        WHERE ta.id = ? AND ta.student = ? AND ta.completed_at IS NOT NULL
                        """,
                        (attempt_id, student_name),
                    ).fetchone()
                    if attempt_row:
                        sec["result"] = build_test_result_record(attempt_row)
                sections.append(sec)
            records.append(
                {
                    "id": row["id"],
                    "composite_id": row["composite_id"],
                    "title": row["title"],
                    "completed_at": row["completed_at"],
                    "weighted_score": float(row["weighted_score"] or 0),
                    "max_weighted_score": float(row["max_weighted_score"] or 0),
                    "duration_seconds": row["duration_seconds"],
                    "sections": sections,
                    "content_badge": "Composite test",
                }
            )
        return records
    finally:
        conn.close()


def delete_composite_test_result(composite_attempt_id: int, student_name: str) -> bool:
    """Delete a completed composite test result and its section attempts."""
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id FROM composite_test_attempts
            WHERE id = ? AND student = ? AND completed_at IS NOT NULL
            """,
            (composite_attempt_id, student_name),
        ).fetchone()
        if not row:
            return False
        conn.execute(
            "DELETE FROM test_attempts WHERE composite_attempt_id = ?",
            (composite_attempt_id,),
        )
        conn.execute(
            "DELETE FROM composite_test_attempts WHERE id = ?",
            (composite_attempt_id,),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
