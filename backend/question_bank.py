"""Tenant-scoped reusable MCQ bank for tests and future worksheets."""

from __future__ import annotations

import json
import secrets
import string
from datetime import datetime, timezone

import db

VALID_SUBJECTS = frozenset({"math", "english", "science", "data", "general"})
VALID_SOURCES = frozenset({"manual", "ai", "imported"})
_BANK_CODE_ALPHABET = string.ascii_lowercase + string.digits
VALID_STARS = frozenset({1, 2, 3})


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_subject(subject: str) -> str:
    s = str(subject or "general").strip().lower()
    if s not in VALID_SUBJECTS:
        raise ValueError(
            f"subject must be one of: {', '.join(sorted(VALID_SUBJECTS))}."
        )
    return s


def _random_code(length: int = 6) -> str:
    return "".join(secrets.choice(_BANK_CODE_ALPHABET) for _ in range(length))


def generate_bank_item_id(subject: str) -> str:
    subject = _normalize_subject(subject)
    for _ in range(32):
        item_id = f"bank_{subject}{_random_code()}"
        conn = db.connect()
        try:
            exists = conn.execute(
                "SELECT 1 FROM question_bank_items WHERE id = ?", (item_id,)
            ).fetchone()
        finally:
            conn.close()
        if not exists:
            return item_id
    raise RuntimeError("Could not allocate a unique question bank id.")


def _validate_question_payload(data: dict) -> list[str]:
    errors: list[str] = []
    prompt = data.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        errors.append("prompt is required.")
    stars = data.get("stars")
    if not isinstance(stars, int) or stars not in VALID_STARS:
        errors.append("stars must be 1, 2, or 3.")
    choices = data.get("choices")
    if not isinstance(choices, list) or len(choices) != 4:
        errors.append("choices must be an array of exactly 4 strings.")
    elif not all(isinstance(c, str) and c.strip() for c in choices):
        errors.append("each choice must be a non-empty string.")
    answer = data.get("answer")
    if not isinstance(answer, str) or not answer.strip():
        errors.append("answer is required.")
    elif isinstance(choices, list) and answer.strip() not in {
        str(c).strip() for c in choices
    }:
        errors.append("answer must match one of the choices.")
    return errors


def _row_to_item(row) -> dict:
    choices = json.loads(row["choices"] or "[]")
    return {
        "id": row["id"],
        "subject": row["subject"],
        "stars": int(row["stars"]),
        "area": row["area"] or "",
        "prompt": row["prompt"],
        "choices": choices,
        "answer": row["answer"],
        "source": row["source"] or "manual",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_question_bank_items(
    *,
    admin_id: int,
    subject: str | None = None,
    stars: int | None = None,
    area: str | None = None,
) -> list[dict]:
    clauses = ["admin_id = ?"]
    params: list = [admin_id]
    if subject:
        clauses.append("subject = ?")
        params.append(_normalize_subject(subject))
    if stars is not None:
        if stars not in VALID_STARS:
            raise ValueError("stars filter must be 1, 2, or 3.")
        clauses.append("stars = ?")
        params.append(stars)
    if area and area.strip():
        clauses.append("LOWER(area) LIKE ?")
        params.append(f"%{area.strip().lower()}%")
    where = " AND ".join(clauses)
    conn = db.connect()
    try:
        rows = conn.execute(
            f"""
            SELECT id, subject, stars, area, prompt, choices, answer, source,
                   created_at, updated_at
            FROM question_bank_items
            WHERE {where}
            ORDER BY subject ASC, stars ASC, updated_at DESC, id ASC
            """,
            params,
        ).fetchall()
        return [_row_to_item(row) for row in rows]
    finally:
        conn.close()


def get_question_bank_item(item_id: str, *, admin_id: int) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id, subject, stars, area, prompt, choices, answer, source,
                   created_at, updated_at
            FROM question_bank_items
            WHERE id = ? AND admin_id = ?
            """,
            (item_id, admin_id),
        ).fetchone()
    finally:
        conn.close()
    return _row_to_item(row) if row else None


def create_question_bank_item(*, admin_id: int, data: dict) -> dict:
    subject = _normalize_subject(data.get("subject", "general"))
    errors = _validate_question_payload(data)
    if errors:
        raise ValueError(errors)
    source = str(data.get("source") or "manual").strip().lower()
    if source not in VALID_SOURCES:
        source = "manual"
    item_id = generate_bank_item_id(subject)
    now = _now_iso()
    area = str(data.get("area") or "").strip()
    choices_json = json.dumps([str(c).strip() for c in data["choices"]])
    conn = db.connect()
    try:
        conn.execute(
            """
            INSERT INTO question_bank_items (
                id, admin_id, subject, stars, area, prompt, choices, answer,
                source, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item_id,
                admin_id,
                subject,
                int(data["stars"]),
                area,
                str(data["prompt"]).strip(),
                choices_json,
                str(data["answer"]).strip(),
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
    return get_question_bank_item(item_id, admin_id=admin_id)  # type: ignore[arg-type]


def update_question_bank_item(item_id: str, *, admin_id: int, data: dict) -> dict:
    existing = get_question_bank_item(item_id, admin_id=admin_id)
    if not existing:
        raise ValueError(["Question bank item not found."])
    merged = {
        **existing,
        **data,
        "subject": data.get("subject", existing["subject"]),
        "stars": data.get("stars", existing["stars"]),
        "prompt": data.get("prompt", existing["prompt"]),
        "choices": data.get("choices", existing["choices"]),
        "answer": data.get("answer", existing["answer"]),
        "area": data.get("area", existing["area"]),
    }
    errors = _validate_question_payload(merged)
    if errors:
        raise ValueError(errors)
    subject = _normalize_subject(merged["subject"])
    now = _now_iso()
    area = str(merged.get("area") or "").strip()
    choices_json = json.dumps([str(c).strip() for c in merged["choices"]])
    conn = db.connect()
    try:
        cur = conn.execute(
            """
            UPDATE question_bank_items
            SET subject = ?, stars = ?, area = ?, prompt = ?, choices = ?,
                answer = ?, updated_at = ?
            WHERE id = ? AND admin_id = ?
            """,
            (
                subject,
                int(merged["stars"]),
                area,
                str(merged["prompt"]).strip(),
                choices_json,
                str(merged["answer"]).strip(),
                now,
                item_id,
                admin_id,
            ),
        )
        if cur.rowcount == 0:
            raise ValueError(["Question bank item not found."])
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return get_question_bank_item(item_id, admin_id=admin_id)  # type: ignore[arg-type]


def delete_question_bank_item(item_id: str, *, admin_id: int) -> bool:
    conn = db.connect()
    try:
        cur = conn.execute(
            "DELETE FROM question_bank_items WHERE id = ? AND admin_id = ?",
            (item_id, admin_id),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def bulk_create_question_bank_items(
    *,
    admin_id: int,
    subject: str,
    questions: list[dict],
    source: str = "manual",
) -> dict:
    subject = _normalize_subject(subject)
    source = str(source or "manual").strip().lower()
    if source not in VALID_SOURCES:
        source = "manual"
    if not questions:
        raise ValueError(["At least one question is required."])
    created: list[dict] = []
    errors: list[str] = []
    for index, raw in enumerate(questions):
        payload = question_dict_from_builder(raw, subject=subject)
        item_errors = _validate_question_payload(payload)
        if item_errors:
            errors.extend(f"Question {index + 1}: {msg}" for msg in item_errors)
            continue
        try:
            created.append(
                create_question_bank_item(
                    admin_id=admin_id,
                    data={**payload, "source": source},
                )
            )
        except ValueError as exc:
            msgs = exc.args[0] if exc.args else ["Invalid question."]
            if isinstance(msgs, list):
                errors.extend(f"Question {index + 1}: {msg}" for msg in msgs)
            else:
                errors.append(f"Question {index + 1}: {msgs}")
    if errors and not created:
        raise ValueError(errors)
    return {"created_count": len(created), "items": created, "errors": errors}


def question_dict_from_builder(raw: dict, *, subject: str) -> dict:
    """Normalize test-builder or worksheet question shapes for the bank."""
    choices = raw.get("choices")
    if not isinstance(choices, list):
        choices = []
    choices = [str(c).strip() for c in choices[:4]]
    while len(choices) < 4:
        choices.append("")
    answer = raw.get("answer")
    if not answer and "correctIndex" in raw:
        idx = int(raw.get("correctIndex") or 0)
        if 0 <= idx < len(choices):
            answer = choices[idx]
    stars = raw.get("stars")
    if stars is None and raw.get("tier") is not None:
        stars = raw.get("tier")
    return {
        "subject": subject,
        "stars": int(stars or 2),
        "area": str(raw.get("area") or "").strip(),
        "prompt": str(raw.get("prompt") or "").strip(),
        "choices": choices,
        "answer": str(answer or "").strip(),
    }
