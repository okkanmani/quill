"""Per-student text highlights on learn resource pages."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import db

ALLOWED_COLORS = frozenset({"orange", "green", "blue"})


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_highlight(item: dict) -> dict | None:
    if not isinstance(item, dict):
        return None
    color = (item.get("color") or "").strip().lower()
    exact = item.get("exact")
    if color not in ALLOWED_COLORS or not isinstance(exact, str) or not exact.strip():
        return None
    highlight_id = (item.get("id") or "").strip()
    if not highlight_id:
        return None
    prefix = item.get("prefix") if isinstance(item.get("prefix"), str) else ""
    suffix = item.get("suffix") if isinstance(item.get("suffix"), str) else ""
    return {
        "id": highlight_id,
        "color": color,
        "exact": exact,
        "prefix": prefix[:120],
        "suffix": suffix[:120],
    }


def _normalize_highlights(raw) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out = []
    seen = set()
    for item in raw:
        normalized = _normalize_highlight(item)
        if not normalized or normalized["id"] in seen:
            continue
        seen.add(normalized["id"])
        out.append(normalized)
    return out


def _row_to_dict(row) -> dict:
    try:
        parsed = json.loads(row["highlights"] or "[]")
    except json.JSONDecodeError:
        parsed = []
    return {
        "section_id": row["section_id"],
        "page_index": int(row["page_index"]),
        "highlights": _normalize_highlights(parsed),
        "saved_at": row["saved_at"],
    }


def list_highlights_for_subject(student: str, subject_key: str) -> list[dict]:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT section_id, page_index, highlights, saved_at
            FROM learn_page_highlights
            WHERE student = ? AND subject_key = ?
            ORDER BY section_id, page_index
            """,
            (student, subject_key),
        ).fetchall()
    finally:
        conn.close()
    return [_row_to_dict(row) for row in rows]


def save_highlights(
    student: str,
    subject_key: str,
    section_id: str,
    page_index: int,
    highlights: list,
) -> dict:
    if page_index < 0:
        raise ValueError("page_index must be >= 0")
    section_id = (section_id or "").strip()
    if not section_id:
        raise ValueError("section_id is required.")
    normalized = _normalize_highlights(highlights)
    saved_at = _now_iso()
    payload = json.dumps(normalized)
    conn = db.connect()
    try:
        conn.execute(
            """
            INSERT INTO learn_page_highlights
                (student, subject_key, section_id, page_index, highlights, saved_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(student, subject_key, section_id, page_index) DO UPDATE SET
                highlights = excluded.highlights,
                saved_at = excluded.saved_at
            """,
            (student, subject_key, section_id, page_index, payload, saved_at),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT section_id, page_index, highlights, saved_at
            FROM learn_page_highlights
            WHERE student = ? AND subject_key = ? AND section_id = ? AND page_index = ?
            """,
            (student, subject_key, section_id, page_index),
        ).fetchone()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return _row_to_dict(row)
