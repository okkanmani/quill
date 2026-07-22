"""Passage entities for reading-comprehension question bank items."""

from __future__ import annotations

import json
import secrets
import string
from datetime import datetime, timezone

import db

from question_bank import VALID_SUBJECTS, _normalize_subject, _now_iso

_PASSAGE_CODE_ALPHABET = string.ascii_lowercase + string.digits


def ensure_question_bank_passage_schema(conn) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS question_bank_passages (
            id TEXT PRIMARY KEY,
            admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
            subject TEXT NOT NULL DEFAULT 'english',
            title TEXT NOT NULL DEFAULT '',
            body TEXT NOT NULL DEFAULT '',
            chart_json TEXT,
            table_json TEXT,
            source TEXT NOT NULL DEFAULT 'manual',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_question_bank_passages_admin
            ON question_bank_passages (admin_id, subject);
        """
    )
    item_cols = {row[1] for row in conn.execute("PRAGMA table_info(question_bank_items)")}
    if "passage_id" not in item_cols:
        conn.execute(
            "ALTER TABLE question_bank_items ADD COLUMN passage_id TEXT"
        )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_question_bank_passage
            ON question_bank_items (admin_id, passage_id)
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_question_bank_prompt_passage
            ON question_bank_items (admin_id, subject, passage_id, prompt_key)
        """
    )


def _random_code(length: int = 6) -> str:
    return "".join(secrets.choice(_PASSAGE_CODE_ALPHABET) for _ in range(length))


def generate_passage_id(subject: str = "english") -> str:
    subject = _normalize_subject(subject)
    for _ in range(32):
        passage_id = f"bankpass_{subject}{_random_code()}"
        conn = db.connect()
        try:
            exists = conn.execute(
                "SELECT 1 FROM question_bank_passages WHERE id = ?", (passage_id,)
            ).fetchone()
        finally:
            conn.close()
        if not exists:
            return passage_id
    raise RuntimeError("Could not allocate a unique passage id.")


def _row_to_passage(row, *, question_count: int = 0) -> dict:
    chart = None
    table = None
    if row["chart_json"]:
        try:
            chart = json.loads(row["chart_json"])
        except json.JSONDecodeError:
            chart = None
    if row["table_json"]:
        try:
            table = json.loads(row["table_json"])
        except json.JSONDecodeError:
            table = None
    out = {
        "id": row["id"],
        "subject": row["subject"],
        "title": row["title"] or "",
        "body": row["body"] or "",
        "source": row["source"] or "manual",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "question_count": question_count,
    }
    if chart is not None:
        out["chart"] = chart
    if table is not None:
        out["table"] = table
    return out


def list_question_bank_passages(
    *,
    admin_id: int,
    subject: str = "english",
) -> list[dict]:
    subject = _normalize_subject(subject)
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT p.id, p.subject, p.title, p.body, p.chart_json, p.table_json,
                   p.source, p.created_at, p.updated_at,
                   (
                     SELECT COUNT(*) FROM question_bank_items q
                     WHERE q.passage_id = p.id AND q.admin_id = p.admin_id
                   ) AS question_count
            FROM question_bank_passages p
            WHERE p.admin_id = ? AND p.subject = ?
            ORDER BY p.updated_at DESC, p.id ASC
            """,
            (admin_id, subject),
        ).fetchall()
        return [
            _row_to_passage(row, question_count=int(row["question_count"] or 0))
            for row in rows
        ]
    finally:
        conn.close()


def get_question_bank_passage(passage_id: str, *, admin_id: int) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT p.id, p.subject, p.title, p.body, p.chart_json, p.table_json,
                   p.source, p.created_at, p.updated_at,
                   (
                     SELECT COUNT(*) FROM question_bank_items q
                     WHERE q.passage_id = p.id AND q.admin_id = p.admin_id
                   ) AS question_count
            FROM question_bank_passages p
            WHERE p.id = ? AND p.admin_id = ?
            """,
            (passage_id, admin_id),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    return _row_to_passage(row, question_count=int(row["question_count"] or 0))


def create_question_bank_passage(*, admin_id: int, data: dict) -> dict:
    subject = _normalize_subject(data.get("subject", "english"))
    title = str(data.get("title") or "").strip()
    body = str(data.get("body") or "").strip()
    if not title:
        raise ValueError(["Passage title is required."])
    if not body:
        raise ValueError(["Passage text is required."])
    source = str(data.get("source") or "manual").strip().lower()
    if source not in {"manual", "ai", "imported"}:
        source = "manual"
    chart_json = None
    table_json = None
    if data.get("chart") is not None:
        chart_json = json.dumps(data["chart"])
    if data.get("table") is not None:
        table_json = json.dumps(data["table"])
    passage_id = generate_passage_id(subject)
    now = _now_iso()
    conn = db.connect()
    try:
        conn.execute(
            """
            INSERT INTO question_bank_passages (
                id, admin_id, subject, title, body, chart_json, table_json,
                source, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                passage_id,
                admin_id,
                subject,
                title,
                body,
                chart_json,
                table_json,
                source,
                now,
                now,
            ),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return get_question_bank_passage(passage_id, admin_id=admin_id)  # type: ignore[arg-type]


def update_question_bank_passage(
    passage_id: str, *, admin_id: int, data: dict
) -> dict:
    existing = get_question_bank_passage(passage_id, admin_id=admin_id)
    if not existing:
        raise ValueError(["Passage not found."])
    title = str(data.get("title", existing["title"]) or "").strip()
    body = str(data.get("body", existing["body"]) or "").strip()
    if not title:
        raise ValueError(["Passage title is required."])
    if not body:
        raise ValueError(["Passage text is required."])
    chart = data.get("chart", existing.get("chart"))
    table = data.get("table", existing.get("table"))
    chart_json = json.dumps(chart) if chart is not None else None
    table_json = json.dumps(table) if table is not None else None
    now = _now_iso()
    conn = db.connect()
    try:
        cur = conn.execute(
            """
            UPDATE question_bank_passages
            SET title = ?, body = ?, chart_json = ?, table_json = ?, updated_at = ?
            WHERE id = ? AND admin_id = ?
            """,
            (title, body, chart_json, table_json, now, passage_id, admin_id),
        )
        if cur.rowcount == 0:
            raise ValueError(["Passage not found."])
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return get_question_bank_passage(passage_id, admin_id=admin_id)  # type: ignore[arg-type]


def delete_question_bank_passage(passage_id: str, *, admin_id: int) -> bool:
    conn = db.connect()
    try:
        conn.execute(
            "DELETE FROM question_bank_items WHERE passage_id = ? AND admin_id = ?",
            (passage_id, admin_id),
        )
        cur = conn.execute(
            "DELETE FROM question_bank_passages WHERE id = ? AND admin_id = ?",
            (passage_id, admin_id),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def assert_passage_owned(passage_id: str, *, admin_id: int) -> None:
    if not get_question_bank_passage(passage_id, admin_id=admin_id):
        raise ValueError(["Passage not found."])
