"""Student home dashboard — alerts and notifications for one student."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import db
from learn_content import list_admin_learn_sections
from revision import list_revision_worksheets
from tests import list_tests
from worksheets import _is_latest_sort_ts, list_worksheets
from writing import list_writing_submissions

FIRST_VISIT_LOOKBACK_DAYS = 14


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


def _sort_ts_to_dt(sort_ts: int | None) -> datetime | None:
    if not sort_ts or int(sort_ts) <= 0:
        return None
    try:
        return datetime.fromtimestamp(int(sort_ts) / 1000, tz=timezone.utc)
    except (OSError, OverflowError, ValueError):
        return None


def _is_after_baseline(at: datetime | None, baseline: datetime) -> bool:
    if at is None:
        return False
    return at > baseline


def _alert_baseline(last_seen: datetime | None) -> datetime:
    if last_seen is not None:
        return last_seen
    return datetime.now(timezone.utc) - timedelta(days=FIRST_VISIT_LOOKBACK_DAYS)


def get_student_home_last_seen(student_name: str) -> datetime | None:
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT home_last_seen_at FROM students WHERE name = ?",
            (student_name,),
        ).fetchone()
        if not row:
            return None
        return _parse_iso(row["home_last_seen_at"])
    finally:
        conn.close()


def touch_student_home_last_seen(student_name: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    conn = db.connect()
    try:
        conn.execute(
            "UPDATE students SET home_last_seen_at = ? WHERE name = ?",
            (now, student_name),
        )
        conn.commit()
    finally:
        conn.close()


def _learn_alerts(*, admin_id: int, baseline: datetime) -> list[dict]:
    alerts: list[dict] = []
    for section in list_admin_learn_sections(admin_id=admin_id):
        created = _parse_iso(section.get("created_at"))
        if not _is_after_baseline(created, baseline):
            continue
        subject_key = section["subject_key"]
        section_id = section["section_id"]
        subject_title = section.get("subject_title") or subject_key.replace("-", " ").title()
        alerts.append(
            {
                "kind": "learn_section_new",
                "title": section.get("title") or "New section",
                "subtitle": subject_title,
                "at": section.get("created_at"),
                "url": f"/student/learn/{subject_key}#{section_id}",
                "subject_key": subject_key,
                "section_id": section_id,
            }
        )
    alerts.sort(key=lambda item: item.get("at") or "", reverse=True)
    return alerts


def _worksheet_alerts(
    worksheets: list[dict], *, baseline: datetime, seen_keys: set[str]
) -> list[dict]:
    alerts: list[dict] = []
    for ws in worksheets:
        if ws.get("is_test"):
            continue
        ws_id = ws["id"]
        title = ws.get("title") or ws_id
        sort_at = _sort_ts_to_dt(ws.get("sort_ts"))
        sort_iso = sort_at.isoformat() if sort_at else None

        if ws.get("has_draft") and not ws.get("done"):
            key = f"continue:{ws_id}"
            if key not in seen_keys:
                seen_keys.add(key)
                alerts.append(
                    {
                        "kind": "worksheet_continue",
                        "title": title,
                        "subtitle": "Pick up where you left off",
                        "at": ws.get("draft_saved_at") or sort_iso,
                        "url": f"/student/worksheet/{ws_id}",
                        "worksheet_id": ws_id,
                    }
                )
            continue

        if (
            ws.get("timed_started")
            and not ws.get("done")
            and not ws.get("timed_locked")
        ):
            key = f"continue:{ws_id}"
            if key not in seen_keys:
                seen_keys.add(key)
                alerts.append(
                    {
                        "kind": "worksheet_continue",
                        "title": title,
                        "subtitle": "Timed worksheet in progress",
                        "at": sort_iso,
                        "url": f"/student/worksheet/{ws_id}",
                        "worksheet_id": ws_id,
                    }
                )
            continue

        if ws.get("done"):
            continue

        if ws.get("access_locked"):
            continue

        if _is_after_baseline(sort_at, baseline) or ws.get("is_latest"):
            key = f"new:{ws_id}"
            if key not in seen_keys:
                seen_keys.add(key)
                alerts.append(
                    {
                        "kind": "worksheet_new",
                        "title": title,
                        "subtitle": "New worksheet",
                        "at": sort_iso,
                        "url": f"/student/worksheet/{ws_id}",
                        "worksheet_id": ws_id,
                    }
                )
    return alerts


def _test_alerts(tests: list[dict], *, baseline: datetime, seen_keys: set[str]) -> list[dict]:
    alerts: list[dict] = []
    for test in tests:
        test_id = test["id"]
        title = test.get("title") or test_id
        sort_at = _sort_ts_to_dt(test.get("sort_ts"))
        sort_iso = sort_at.isoformat() if sort_at else None

        if test.get("access_locked") and not test.get("done"):
            sort_ts = int(test.get("sort_ts") or 0)
            if _is_latest_sort_ts(sort_ts) or _is_after_baseline(sort_at, baseline):
                key = f"locked:{test_id}"
                if key not in seen_keys:
                    seen_keys.add(key)
                    alerts.append(
                        {
                            "kind": "test_locked",
                            "title": title,
                            "subtitle": "Waiting to be unlocked",
                            "at": sort_iso,
                            "url": "/student/tests",
                            "worksheet_id": test_id,
                        }
                    )
            continue

        if test.get("done"):
            continue

        if _is_after_baseline(sort_at, baseline):
            key = f"new:{test_id}"
            if key not in seen_keys:
                seen_keys.add(key)
                alerts.append(
                    {
                        "kind": "test_ready",
                        "title": title,
                        "subtitle": "New test ready",
                        "at": sort_iso,
                        "url": f"/student/tests/{test_id}",
                        "worksheet_id": test_id,
                    }
                )
    return alerts


def _revision_alerts(revisions: list[dict], *, baseline: datetime) -> list[dict]:
    alerts: list[dict] = []
    for rev in revisions:
        if rev.get("done"):
            continue
        created = _parse_iso(rev.get("created_at"))
        if not _is_after_baseline(created, baseline):
            continue
        rev_id = rev["id"]
        alerts.append(
            {
                "kind": "revision_new",
                "title": rev.get("title") or "Revision practice",
                "subtitle": rev.get("focus_area") or "Revision",
                "at": rev.get("created_at"),
                "url": f"/student/revision/{rev_id}",
                "revision_id": rev_id,
            }
        )
    return alerts


def _writing_alerts(submissions: list[dict], *, baseline: datetime) -> list[dict]:
    alerts: list[dict] = []
    for item in submissions:
        evaluated = _parse_iso(item.get("evaluated_at"))
        if not item.get("grade") or not _is_after_baseline(evaluated, baseline):
            continue
        alerts.append(
            {
                "kind": "writing_feedback",
                "title": item.get("title") or "Writing",
                "subtitle": f"Graded {item['grade']}",
                "at": item.get("evaluated_at"),
                "url": "/student/writing",
                "writing_id": item["id"],
            }
        )
    return alerts


def _sort_alerts(alerts: list[dict]) -> list[dict]:
    priority = {
        "worksheet_continue": 0,
        "test_continue": 0,
        "worksheet_new": 1,
        "test_ready": 1,
        "learn_section_new": 2,
        "revision_new": 2,
        "writing_feedback": 3,
        "test_locked": 4,
    }

    def sort_key(item: dict) -> tuple:
        at = _parse_iso(item.get("at"))
        ts = at.timestamp() if at else 0
        return (priority.get(item.get("kind"), 5), -ts)

    return sorted(alerts, key=sort_key)


def build_student_home(student_name: str, *, admin_id: int) -> dict:
    last_seen = get_student_home_last_seen(student_name)
    baseline = _alert_baseline(last_seen)

    worksheets = list_worksheets(student_name, admin_id=admin_id)
    tests = list_tests(student_name, admin_id=admin_id)
    revisions = list_revision_worksheets(student_name)
    writing = list_writing_submissions(student_name)

    seen_keys: set[str] = set()
    alerts: list[dict] = []
    alerts.extend(_learn_alerts(admin_id=admin_id, baseline=baseline))
    alerts.extend(_worksheet_alerts(worksheets, baseline=baseline, seen_keys=seen_keys))
    alerts.extend(_test_alerts(tests, baseline=baseline, seen_keys=seen_keys))
    alerts.extend(_revision_alerts(revisions, baseline=baseline))
    alerts.extend(_writing_alerts(writing, baseline=baseline))
    alerts = _sort_alerts(alerts)

    open_worksheets = sum(
        1
        for ws in worksheets
        if not ws.get("is_test") and not ws.get("done") and not ws.get("access_locked")
    )
    open_tests = sum(
        1
        for test in tests
        if not test.get("done") and not test.get("access_locked")
    )

    touch_student_home_last_seen(student_name)

    return {
        "student_name": student_name,
        "alerts": alerts[:20],
        "summary": {
            "open_worksheets": open_worksheets,
            "open_tests": open_tests,
            "alert_count": len(alerts),
        },
    }
