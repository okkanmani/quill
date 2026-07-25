"""Scheduled access unlock for tests (and other worksheets)."""

from __future__ import annotations

from datetime import datetime, timezone

import db
from auth_users import list_students_for_admin


def parse_unlock_at(raw: str | None) -> datetime | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def scheduled_unlock_is_due(unlock_at: str | None, *, now: datetime | None = None) -> bool:
    dt = parse_unlock_at(unlock_at)
    if dt is None:
        return False
    now = now or datetime.now(timezone.utc)
    return dt <= now


def scheduled_unlock_is_future(unlock_at: str | None, *, now: datetime | None = None) -> bool:
    dt = parse_unlock_at(unlock_at)
    if dt is None:
        return False
    now = now or datetime.now(timezone.utc)
    return dt > now


def validate_future_unlock_at(unlock_at: str) -> str:
    dt = parse_unlock_at(unlock_at)
    if dt is None:
        raise ValueError("unlock_at must be a valid ISO date/time.")
    now = datetime.now(timezone.utc)
    if dt <= now:
        raise ValueError("Scheduled unlock must be in the future.")
    return dt.isoformat()


def get_scheduled_unlock_map(conn, student_name: str) -> dict[str, str | None]:
    rows = conn.execute(
        """
        SELECT worksheet_id, scheduled_unlock_at
        FROM student_worksheet_locks
        WHERE student = ?
        """,
        (student_name,),
    ).fetchall()
    out: dict[str, str | None] = {}
    for row in rows:
        raw = row["scheduled_unlock_at"]
        out[row["worksheet_id"]] = str(raw).strip() if raw else None
    return out


def materialize_due_scheduled_unlocks(conn, student_name: str) -> None:
    """Clear access lock rows whose scheduled unlock time has passed."""
    now_iso = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """
        DELETE FROM student_worksheet_locks
        WHERE student = ?
          AND locked = 1
          AND scheduled_unlock_at IS NOT NULL
          AND scheduled_unlock_at <= ?
        """,
        (student_name, now_iso),
    )


def list_scheduled_test_unlocks(
    admin_id: int, *, student_name: str | None = None
) -> list[dict]:
    from worksheets import _default_admin_id

    conn = db.connect()
    try:
        default_admin = _default_admin_id(conn)
        now_iso = datetime.now(timezone.utc).isoformat()
        params: list = [admin_id, now_iso, admin_id, default_admin, admin_id]
        student_clause = ""
        if student_name:
            student_clause = " AND swl.student = ?"
            params.append(student_name)

        rows = conn.execute(
            f"""
            SELECT swl.student, swl.worksheet_id, swl.scheduled_unlock_at, w.title
            FROM student_worksheet_locks swl
            JOIN worksheets w ON w.id = swl.worksheet_id
            JOIN students s ON s.name = swl.student AND s.admin_id = ?
            WHERE swl.locked = 1
              AND swl.scheduled_unlock_at IS NOT NULL
              AND swl.scheduled_unlock_at > ?
              AND COALESCE(w.is_test, 0) = 1
              AND (w.admin_id = ? OR (w.admin_id IS NULL AND ? = ?))
              {student_clause}
            ORDER BY swl.scheduled_unlock_at ASC, swl.student ASC, w.title ASC
            """,
            params,
        ).fetchall()
        return [
            {
                "student_name": row["student"],
                "worksheet_id": row["worksheet_id"],
                "title": row["title"] or row["worksheet_id"],
                "scheduled_unlock_at": row["scheduled_unlock_at"],
            }
            for row in rows
        ]
    finally:
        conn.close()


def schedule_test_unlock_for_admin(
    admin_id: int,
    worksheet_id: str,
    unlock_at: str,
    *,
    student_name: str | None = None,
) -> int:
    from worksheets import assert_worksheet_owned_by_admin, set_worksheet_access_lock

    unlock_iso = validate_future_unlock_at(unlock_at)
    assert_worksheet_owned_by_admin(worksheet_id, admin_id)

    if student_name:
        set_worksheet_access_lock(
            student_name,
            worksheet_id,
            locked=True,
            scheduled_unlock_at=unlock_iso,
        )
        return 1

    count = 0
    for row in list_students_for_admin(admin_id):
        set_worksheet_access_lock(
            row["name"],
            worksheet_id,
            locked=True,
            scheduled_unlock_at=unlock_iso,
        )
        count += 1
    return count


def summarize_test_unlock_schedule(admin_id: int, worksheet_id: str) -> dict:
    """How student access locks look for this test (admin edit UI)."""
    students = list_students_for_admin(admin_id)
    if not students:
        return {"mode": "unlocked", "scheduled_unlock_at": None}

    conn = db.connect()
    try:
        states: list[tuple[int, str | None]] = []
        for row in students:
            lock_row = conn.execute(
                """
                SELECT locked, scheduled_unlock_at FROM student_worksheet_locks
                WHERE student = ? AND worksheet_id = ?
                """,
                (row["name"], worksheet_id),
            ).fetchone()
            if not lock_row:
                states.append((0, None))
            else:
                sched = lock_row["scheduled_unlock_at"]
                states.append(
                    (
                        int(lock_row["locked"]),
                        str(sched).strip() if sched else None,
                    )
                )
    finally:
        conn.close()

    if all(locked == 0 for locked, _ in states):
        return {"mode": "unlocked", "scheduled_unlock_at": None}

    locked_states = [(locked, sched) for locked, sched in states if locked == 1]
    if not locked_states:
        return {"mode": "unlocked", "scheduled_unlock_at": None}

    future_scheduled = [
        sched
        for locked, sched in locked_states
        if sched and scheduled_unlock_is_future(sched)
    ]
    if (
        len(future_scheduled) == len(locked_states)
        and len(set(future_scheduled)) == 1
    ):
        return {"mode": "scheduled", "scheduled_unlock_at": future_scheduled[0]}

    return {"mode": "locked", "scheduled_unlock_at": None}
