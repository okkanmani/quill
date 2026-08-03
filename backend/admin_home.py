"""Admin home dashboard — overview across all students for one admin account."""

from __future__ import annotations

from datetime import datetime, timezone

import db

# Max rows returned per home section (Quick actions on the client is uncapped).
HOME_SECTION_LIST_LIMIT = 5
from auth_users import list_students_for_admin
from focus_analysis import build_admin_focus_chip_preview
from focus_discussion import list_focus_areas_discussed
from revision import list_revision_analysis_records
from test_scheduling import list_scheduled_test_unlocks, scheduled_unlock_is_future
from worksheets import list_results, list_worksheets


def _parse_iso(ts: str | None) -> datetime | None:
    if not ts or not str(ts).strip():
        return None
    raw = str(ts).strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _student_last_activity_at(conn, student_name: str) -> str | None:
    row = conn.execute(
        """
        SELECT MAX(ts) AS last_at FROM (
            SELECT submitted_at AS ts FROM results WHERE student = ?
            UNION ALL
            SELECT completed_at AS ts FROM test_attempts
                WHERE student = ? AND completed_at IS NOT NULL
            UNION ALL
            SELECT completed_at AS ts FROM composite_test_attempts
                WHERE student = ? AND completed_at IS NOT NULL
            UNION ALL
            SELECT submitted_at AS ts FROM writing_submissions WHERE student = ?
        )
        """,
        (student_name, student_name, student_name, student_name),
    ).fetchone()
    return row["last_at"] if row and row["last_at"] else None


def _discussed_key(subject: str, area: str) -> tuple[str, str]:
    return (str(subject or "").strip().lower(), str(area or "").strip().lower())


def _collect_focus_area_keys(student_name: str) -> tuple[set[tuple[str, str]], dict[tuple[str, str], str]]:
    """Return (area_keys, key_to_subject) from focus evaluations and revision records."""
    area_keys: set[tuple[str, str]] = set()
    key_subject: dict[tuple[str, str], str] = {}

    for result in list_results(student_name):
        evaluation = result.get("focus_evaluation")
        if not isinstance(evaluation, dict):
            continue
        subject = str(
            evaluation.get("subject") or result.get("subject") or "general"
        ).strip().lower()
        for question in evaluation.get("questions") or []:
            if not isinstance(question, dict):
                continue
            area = str(question.get("area") or "").strip().lower()
            if not area:
                continue
            key = (subject, area)
            area_keys.add(key)
            key_subject[key] = subject

    for revision in list_revision_analysis_records(student_name):
        subject = str(revision.get("subject") or "general").strip().lower()
        for question in revision.get("questions") or []:
            if not isinstance(question, dict):
                continue
            area = str(question.get("area") or "").strip().lower()
            if not area:
                continue
            key = (subject, area)
            area_keys.add(key)
            key_subject[key] = subject

    return area_keys, key_subject


def _focus_health_counts(student_name: str) -> tuple[int, int]:
    """Return (needs_addressing_count, reinforcement_count) for a student."""
    discussed_rows = list_focus_areas_discussed(student_name)
    discussed_keys = {
        _discussed_key(row["subject"], row["area"]) for row in discussed_rows
    }
    area_keys, _ = _collect_focus_area_keys(student_name)

    needs_addressing = sum(1 for key in area_keys if key not in discussed_keys)
    reinforcement = sum(
        1
        for row in discussed_rows
        if row.get("last_reinforced_at")
        and row.get("discussed_at")
        and row["last_reinforced_at"] > row["discussed_at"]
    )
    return needs_addressing, reinforcement


def _recent_activity_for_student(conn, student_name: str, *, limit: int = 8) -> list[dict]:
    events: list[dict] = []

    rows = conn.execute(
        """
        SELECT r.id, r.worksheet_id, r.title, r.submitted_at
        FROM results r
        JOIN worksheets w ON w.id = r.worksheet_id
        WHERE r.student = ?
          AND r.submitted_at IS NOT NULL
          AND COALESCE(w.is_test, 0) = 0
        ORDER BY r.submitted_at DESC
        LIMIT ?
        """,
        (student_name, limit),
    ).fetchall()
    for row in rows:
        events.append(
            {
                "student_name": student_name,
                "kind": "worksheet_completed",
                "title": row["title"] or "Worksheet",
                "worksheet_id": row["worksheet_id"],
                "result_id": row["id"],
                "at": row["submitted_at"],
            }
        )

    test_rows = conn.execute(
        """
        SELECT w.id AS worksheet_id, w.title, ta.id AS attempt_id, ta.completed_at
        FROM test_attempts ta
        JOIN worksheets w ON w.id = ta.worksheet_id
        WHERE ta.student = ? AND ta.completed_at IS NOT NULL
          AND ta.composite_attempt_id IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM test_attempts section_ta
            JOIN composite_test_attempts cta ON cta.id = section_ta.composite_attempt_id
            WHERE section_ta.student = ta.student
              AND section_ta.worksheet_id = ta.worksheet_id
              AND section_ta.completed_at IS NOT NULL
              AND cta.completed_at IS NOT NULL
          )
        ORDER BY ta.completed_at DESC
        LIMIT ?
        """,
        (student_name, limit),
    ).fetchall()
    for row in test_rows:
        events.append(
            {
                "student_name": student_name,
                "kind": "test_completed",
                "title": row["title"] or "Test",
                "worksheet_id": row["worksheet_id"],
                "attempt_id": row["attempt_id"],
                "at": row["completed_at"],
            }
        )

    composite_rows = conn.execute(
        """
        SELECT cta.id AS attempt_id, cta.completed_at, cta.weighted_score,
               cta.max_weighted_score, ct.id AS composite_id, ct.title
        FROM composite_test_attempts cta
        JOIN composite_tests ct ON ct.id = cta.composite_id
        WHERE cta.student = ? AND cta.completed_at IS NOT NULL
        ORDER BY cta.completed_at DESC
        LIMIT ?
        """,
        (student_name, limit),
    ).fetchall()
    for row in composite_rows:
        weighted = row["weighted_score"]
        max_weighted = row["max_weighted_score"]
        events.append(
            {
                "student_name": student_name,
                "kind": "composite_test_completed",
                "title": row["title"] or "Composite test",
                "composite_id": row["composite_id"],
                "attempt_id": row["attempt_id"],
                "weighted_score": float(weighted) if weighted is not None else None,
                "max_weighted_score": float(max_weighted) if max_weighted is not None else None,
                "at": row["completed_at"],
            }
        )

    for row in list_focus_areas_discussed(student_name):
        reinforced_at = row.get("last_reinforced_at")
        discussed_at = row.get("discussed_at")
        if (
            reinforced_at
            and discussed_at
            and reinforced_at > discussed_at
        ):
            subject = str(row.get("subject") or "general").strip().lower()
            area = str(row.get("area") or "").strip().lower()
            if not area:
                continue
            events.append(
                {
                    "student_name": student_name,
                    "kind": "reinforcement_flagged",
                    "subject": subject,
                    "area": area,
                    "at": reinforced_at,
                }
            )

    events.sort(key=lambda item: item.get("at") or "", reverse=True)
    return events[:limit]


def _pending_locked_for_student(
    student_name: str, *, admin_id: int
) -> list[dict]:
    pending: list[dict] = []
    for ws in list_worksheets(student_name, admin_id=admin_id):
        if ws.get("done"):
            continue

        lock_type = None
        if ws.get("access_locked"):
            conn = db.connect()
            try:
                row = conn.execute(
                    """
                    SELECT scheduled_unlock_at FROM student_worksheet_locks
                    WHERE student = ? AND worksheet_id = ? AND locked = 1
                    """,
                    (student_name, ws["id"]),
                ).fetchone()
                sched = (
                    row["scheduled_unlock_at"]
                    if row and row["scheduled_unlock_at"]
                    else None
                )
            finally:
                conn.close()
            if sched and scheduled_unlock_is_future(sched):
                continue
            lock_type = "access"
        elif ws.get("is_test") and (
            ws.get("attempt_locked") or ws.get("attempt_started")
        ):
            lock_type = "test_attempt"
        elif (
            ws.get("timed")
            and not ws.get("is_test")
            and (ws.get("timed_locked") or ws.get("timed_started"))
        ):
            lock_type = "timed_attempt"

        if not lock_type:
            continue

        entry: dict = {
            "student_name": student_name,
            "worksheet_id": ws["id"],
            "title": ws.get("title") or ws["id"],
            "kind": "test_locked" if ws.get("is_test") else "worksheet_locked",
            "lock_type": lock_type,
            "is_test": bool(ws.get("is_test")),
        }
        if lock_type == "test_attempt":
            entry["attempt_locked"] = bool(ws.get("attempt_locked"))
        if ws.get("lock_reason"):
            entry["lock_reason"] = ws["lock_reason"]
        pending.append(entry)
    return pending


def build_admin_home(admin_id: int, selected_student: str | None = None) -> dict:
    students_raw = list_students_for_admin(admin_id)
    conn = db.connect()
    try:
        student_cards = []
        all_activity: list[dict] = []
        all_pending: list[dict] = []
        scheduled_tests = list_scheduled_test_unlocks(
            admin_id,
            student_name=selected_student if selected_student else None,
        )
        activity_limit = HOME_SECTION_LIST_LIMIT

        for student in students_raw:
            name = student["name"]
            last_at = _student_last_activity_at(conn, name)
            needs_addressing, reinforcement = _focus_health_counts(name)
            student_cards.append(
                {
                    "id": student["id"],
                    "name": name,
                    "grade": student.get("grade"),
                    "last_activity_at": last_at,
                    "needs_addressing_count": needs_addressing,
                    "reinforcement_count": reinforcement,
                    "is_selected": bool(selected_student and name == selected_student),
                }
            )
            if selected_student and name != selected_student:
                continue
            all_activity.extend(
                _recent_activity_for_student(conn, name, limit=activity_limit)
            )
            all_pending.extend(_pending_locked_for_student(name, admin_id=admin_id))

        all_activity.sort(key=lambda item: item.get("at") or "", reverse=True)

        chip_students = (
            [selected_student]
            if selected_student
            else [student["name"] for student in students_raw]
        )
        focus_chips = build_admin_focus_chip_preview(chip_students)

        recent_total = len(all_activity)
        pending_total = len(all_pending)
        scheduled_total = len(scheduled_tests)

        return {
            "students": student_cards,
            "selected_student": selected_student,
            "recent_activity": all_activity[:HOME_SECTION_LIST_LIMIT],
            "recent_activity_total": recent_total,
            "pending": all_pending[:HOME_SECTION_LIST_LIMIT],
            "pending_total": pending_total,
            "scheduled_tests": scheduled_tests[:HOME_SECTION_LIST_LIMIT],
            "scheduled_tests_total": scheduled_total,
            "focus_chips": focus_chips,
        }
    finally:
        conn.close()
