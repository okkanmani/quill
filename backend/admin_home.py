"""Admin home dashboard — overview across all students for one admin account."""

from __future__ import annotations

from datetime import datetime, timezone

import db
from auth_users import list_students_for_admin
from focus_discussion import list_focus_areas_discussed
from revision import list_revision_analysis_records
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
            SELECT submitted_at AS ts FROM writing_submissions WHERE student = ?
        )
        """,
        (student_name, student_name, student_name),
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


def _attention_items_for_student(student_name: str, *, limit: int = 4) -> list[dict]:
    discussed_rows = list_focus_areas_discussed(student_name)
    discussed_keys = {
        _discussed_key(row["subject"], row["area"]) for row in discussed_rows
    }
    area_keys, key_subject = _collect_focus_area_keys(student_name)

    items: list[dict] = []
    for subject, area in sorted(area_keys):
        key = (subject, area)
        if key in discussed_keys:
            continue
        items.append(
            {
                "kind": "needs_addressing",
                "subject": key_subject.get(key, subject),
                "area": area,
            }
        )

    for row in discussed_rows:
        reinforced_at = row.get("last_reinforced_at")
        discussed_at = row.get("discussed_at")
        if not (
            reinforced_at
            and discussed_at
            and reinforced_at > discussed_at
        ):
            continue
        subject = str(row.get("subject") or "general").strip().lower()
        area = str(row.get("area") or "").strip().lower()
        if not area:
            continue
        items.append(
            {
                "kind": "reinforcement",
                "subject": subject,
                "area": area,
                "count": int(row.get("reinforcement_count") or 1),
            }
        )

    return items[:limit]


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
        if not ws.get("is_test"):
            continue
        if ws.get("done"):
            continue
        if not ws.get("access_locked"):
            continue
        pending.append(
            {
                "student_name": student_name,
                "worksheet_id": ws["id"],
                "title": ws.get("title") or ws["id"],
                "kind": "test_locked",
            }
        )
    return pending


def build_admin_home(admin_id: int, selected_student: str | None = None) -> dict:
    students_raw = list_students_for_admin(admin_id)
    conn = db.connect()
    try:
        student_cards = []
        all_activity: list[dict] = []
        all_pending: list[dict] = []

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
                    "attention_items": _attention_items_for_student(name),
                    "is_selected": bool(selected_student and name == selected_student),
                }
            )
            all_activity.extend(_recent_activity_for_student(conn, name))
            all_pending.extend(_pending_locked_for_student(name, admin_id=admin_id))

        all_activity.sort(key=lambda item: item.get("at") or "", reverse=True)
        return {
            "students": student_cards,
            "recent_activity": all_activity[:12],
            "pending": all_pending[:8],
        }
    finally:
        conn.close()
