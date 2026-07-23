"""Focus-area chips — needs addressing & reinforcement (admin home preview)."""

from __future__ import annotations

from datetime import datetime, timezone

from focus_discussion import list_focus_areas_discussed
from revision import list_revision_analysis_records, list_revision_worksheets
from worksheets import build_focus_evaluation_from_result, list_results

HOME_FOCUS_CHIP_PREVIEW = 5


def _normalize_subject(subject: str) -> str:
    return (subject or "").strip().lower() or "general"


def _normalize_area(area: str) -> str:
    return (area or "").strip().lower()


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


def _analysis_timestamp(result: dict, evaluation: dict | None = None) -> str:
    if evaluation and evaluation.get("uploaded_at"):
        return str(evaluation["uploaded_at"])
    if result.get("evaluated_at"):
        return str(result["evaluated_at"])
    if result.get("submitted_at"):
        return str(result["submitted_at"])
    return ""


def _questions_for_result(result: dict) -> list[dict]:
    evaluation = result.get("focus_evaluation")
    if isinstance(evaluation, dict):
        questions = evaluation.get("questions")
        if isinstance(questions, list) and questions:
            return [q for q in questions if isinstance(q, dict)]

    if result.get("status") == "pending":
        return []
    try:
        built = build_focus_evaluation_from_result(result)
    except ValueError:
        return []
    questions = built.get("questions")
    return [q for q in questions if isinstance(q, dict)] if isinstance(questions, list) else []


def _ingest_wrong_question(
    entries: dict[tuple[str, str], dict],
    *,
    subject: str,
    question: dict,
    timestamp: str,
    from_timed: bool,
    result_id,
    question_id,
) -> None:
    area = _normalize_area(str(question.get("area") or ""))
    if not area:
        return
    if question.get("correct") is not False:
        return

    subject_key = _normalize_subject(subject)
    key = (subject_key, area)
    if key not in entries:
        entries[key] = {
            "subject": subject_key,
            "area": area,
            "wrong_count": 0,
            "wrong_keys": set(),
            "latest_at": "",
            "from_timed": False,
        }
    entry = entries[key]

    dedupe = f"{result_id}:{question_id or question.get('question_id') or question.get('question')}"
    if dedupe not in entry["wrong_keys"]:
        entry["wrong_keys"].add(dedupe)
        entry["wrong_count"] += 1

    ts = str(timestamp or "")
    if ts and ts > entry["latest_at"]:
        entry["latest_at"] = ts
        entry["from_timed"] = bool(from_timed)
    elif ts and ts == entry["latest_at"] and from_timed:
        entry["from_timed"] = True


def _collect_focus_entries(student_name: str) -> dict[tuple[str, str], dict]:
    entries: dict[tuple[str, str], dict] = {}

    for result in list_results(student_name):
        if result.get("status") == "pending":
            continue
        evaluation = result.get("focus_evaluation")
        subject = _normalize_subject(
            (evaluation or {}).get("subject") or result.get("subject") or "general"
        )
        timestamp = _analysis_timestamp(result, evaluation if isinstance(evaluation, dict) else None)
        from_timed = bool(result.get("is_timed"))
        result_id = result.get("id")

        for question in _questions_for_result(result):
            _ingest_wrong_question(
                entries,
                subject=subject,
                question=question,
                timestamp=timestamp,
                from_timed=from_timed,
                result_id=result_id,
                question_id=question.get("question_id"),
            )

    for revision in list_revision_analysis_records(student_name):
        subject = _normalize_subject(revision.get("subject") or "general")
        timestamp = str(revision.get("completed_at") or "")
        for question in revision.get("questions") or []:
            if not isinstance(question, dict):
                continue
            q = dict(question)
            if not q.get("area"):
                q["area"] = revision.get("focus_area") or ""
            _ingest_wrong_question(
                entries,
                subject=subject,
                question=q,
                timestamp=timestamp,
                from_timed=False,
                result_id=revision.get("revision_id"),
                question_id=q.get("question_id"),
            )

    return entries


def _needs_reinforcing(
    subject: str,
    area: str,
    discussed_at: str,
    last_reinforced_at: str | None,
) -> bool:
    if not discussed_at:
        return False
    if not last_reinforced_at:
        return False
    return last_reinforced_at > discussed_at


def _revision_url_by_area(student_name: str) -> dict[tuple[str, str], str]:
    urls: dict[tuple[str, str], str] = {}
    for rev in list_revision_worksheets(student_name):
        if rev.get("done"):
            continue
        subject = _normalize_subject(rev.get("subject") or "general")
        area = _normalize_area(rev.get("focus_area") or "")
        if not area:
            continue
        key = (subject, area)
        if key not in urls:
            urls[key] = f"/student/revision/{rev['id']}"
    return urls


def _chip_sort_key(chip: dict) -> tuple:
    ts = _parse_iso(chip.get("latest_at"))
    ts_val = ts.timestamp() if ts else 0.0
    wrong = int(chip.get("wrong_count") or 0)
    if chip.get("from_timed"):
        return (0, -ts_val, -wrong, chip.get("subject") or "", chip.get("area") or "")
    return (1, -wrong, -ts_val, chip.get("subject") or "", chip.get("area") or "")


def _serialize_chip(entry: dict, *, kind: str, reinforcement_count: int = 0) -> dict:
    return {
        "kind": kind,
        "subject": entry["subject"],
        "area": entry["area"],
        "wrong_count": int(entry.get("wrong_count") or 0),
        "reinforcement_count": int(reinforcement_count or 0),
        "latest_at": entry.get("latest_at") or "",
        "from_timed": bool(entry.get("from_timed")),
        "revision_url": entry.get("revision_url"),
    }


def build_student_focus_chips(student_name: str) -> dict:
    entries = _collect_focus_entries(student_name)
    discussed_rows = list_focus_areas_discussed(student_name)
    discussed_map = {
        (_normalize_subject(row["subject"]), _normalize_area(row["area"])): row
        for row in discussed_rows
    }
    revision_urls = _revision_url_by_area(student_name)

    needs_addressing: list[dict] = []
    needs_reinforcing: list[dict] = []

    all_keys = set(entries.keys()) | set(discussed_map.keys())
    for key in all_keys:
        subject, area = key
        if not area:
            continue
        entry = entries.get(key) or {
            "subject": subject,
            "area": area,
            "wrong_count": 0,
            "latest_at": "",
            "from_timed": False,
        }
        entry = {**entry, "revision_url": revision_urls.get(key)}
        discussed = discussed_map.get(key)
        discussed_at = (discussed or {}).get("discussed_at") or ""
        last_reinforced_at = (discussed or {}).get("last_reinforced_at")
        reinforcement_count = int((discussed or {}).get("reinforcement_count") or 0)

        if not discussed_at:
            if int(entry.get("wrong_count") or 0) <= 0:
                continue
            needs_addressing.append(
                _serialize_chip(entry, kind="needs_addressing", reinforcement_count=0)
            )
        elif _needs_reinforcing(subject, area, discussed_at, last_reinforced_at):
            needs_reinforcing.append(
                _serialize_chip(
                    entry,
                    kind="needs_reinforcing",
                    reinforcement_count=max(reinforcement_count, 1),
                )
            )

    needs_addressing.sort(key=_chip_sort_key)
    needs_reinforcing.sort(key=_chip_sort_key)

    combined = needs_addressing + needs_reinforcing
    combined.sort(key=_chip_sort_key)

    return {
        "preview": combined[:HOME_FOCUS_CHIP_PREVIEW],
        "total_count": len(combined),
        "needs_addressing_count": len(needs_addressing),
        "needs_reinforcing_count": len(needs_reinforcing),
        "chips": combined,
    }


def build_admin_focus_chip_preview(
    student_names: list[str],
    *,
    preview_limit: int = HOME_FOCUS_CHIP_PREVIEW,
) -> dict:
    combined: list[dict] = []
    needs_addressing_total = 0
    needs_reinforcing_total = 0

    for student_name in student_names:
        data = build_student_focus_chips(student_name)
        needs_addressing_total += data["needs_addressing_count"]
        needs_reinforcing_total += data["needs_reinforcing_count"]
        for chip in data["chips"]:
            combined.append({**chip, "student_name": student_name})

    combined.sort(key=_chip_sort_key)

    return {
        "preview": combined[:preview_limit],
        "total_count": len(combined),
        "needs_addressing_count": needs_addressing_total,
        "needs_reinforcing_count": needs_reinforcing_total,
        "chips": combined,
    }
