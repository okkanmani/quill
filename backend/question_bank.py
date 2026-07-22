"""Tenant-scoped reusable MCQ bank for tests and future worksheets."""

from __future__ import annotations

import difflib
import json
import re
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


def normalize_prompt_key(prompt: str) -> str:
    """Exact-match key for duplicate checks; fuzzy matching can build on this later."""
    return str(prompt or "").strip().lower()


def ensure_question_bank_schema(conn) -> None:
    """Add prompt_key column, backfill, and index for duplicate lookups."""
    cols = {row[1] for row in conn.execute("PRAGMA table_info(question_bank_items)")}
    if not cols:
        return
    if "prompt_key" not in cols:
        conn.execute(
            "ALTER TABLE question_bank_items ADD COLUMN prompt_key TEXT NOT NULL DEFAULT ''"
        )
    rows = conn.execute(
        "SELECT id, prompt, prompt_key FROM question_bank_items WHERE prompt_key = ''"
    ).fetchall()
    for row in rows:
        conn.execute(
            "UPDATE question_bank_items SET prompt_key = ? WHERE id = ?",
            (normalize_prompt_key(row["prompt"]), row["id"]),
        )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_question_bank_prompt_key
            ON question_bank_items (admin_id, subject, prompt_key)
        """
    )


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
    out = {
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
    passage_id = row["passage_id"] if "passage_id" in row.keys() else None
    if passage_id:
        out["passage_id"] = passage_id
    return out


def list_question_bank_items(
    *,
    admin_id: int,
    subject: str | None = None,
    stars: int | None = None,
    area: str | None = None,
    passage_id: str | None = None,
    standalone_only: bool = False,
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
    if passage_id:
        clauses.append("passage_id = ?")
        params.append(passage_id.strip())
    elif standalone_only:
        clauses.append("(passage_id IS NULL OR passage_id = '')")
    where = " AND ".join(clauses)
    conn = db.connect()
    try:
        rows = conn.execute(
            f"""
            SELECT id, subject, stars, area, prompt, choices, answer, source,
                   created_at, updated_at, passage_id
            FROM question_bank_items
            WHERE {where}
            ORDER BY subject ASC, stars ASC, updated_at DESC, id ASC
            """,
            params,
        ).fetchall()
        return [_row_to_item(row) for row in rows]
    finally:
        conn.close()


def list_question_bank_areas(
    *,
    admin_id: int,
    subject: str,
    query: str | None = None,
    limit: int = 25,
) -> list[str]:
    """Distinct topic areas for autocomplete, scoped to admin + subject."""
    subject = _normalize_subject(subject)
    limit = max(1, min(int(limit), 50))
    clauses = [
        "admin_id = ?",
        "subject = ?",
        "TRIM(COALESCE(area, '')) != ''",
    ]
    params: list = [admin_id, subject]
    needle = str(query or "").strip().lower()
    if needle:
        clauses.append("LOWER(area) LIKE ?")
        params.append(f"%{needle}%")
    where = " AND ".join(clauses)
    conn = db.connect()
    try:
        rows = conn.execute(
            f"""
            SELECT MIN(area) AS area
            FROM question_bank_items
            WHERE {where}
            GROUP BY LOWER(TRIM(area))
            ORDER BY LOWER(TRIM(area)) ASC
            LIMIT ?
            """,
            (*params, limit),
        ).fetchall()
        return [str(row["area"]).strip() for row in rows if row["area"]]
    finally:
        conn.close()


def normalize_area_key(area: str) -> str:
    return re.sub(r"\s+", " ", str(area or "").strip().lower())


def lookup_question_bank_areas(
    *,
    admin_id: int,
    subject: str,
    query: str | None = None,
) -> dict:
    """Substring matches for the dropdown plus fuzzy near-match hints."""
    query = str(query or "").strip()
    areas = list_question_bank_areas(
        admin_id=admin_id,
        subject=subject,
        query=query or None,
    )
    if not query:
        return {"areas": areas, "near_matches": [], "case_variant": None}

    all_areas = list_question_bank_areas(
        admin_id=admin_id,
        subject=subject,
        query=None,
        limit=200,
    )
    query_key = normalize_area_key(query)
    case_variant = next(
        (
            area
            for area in all_areas
            if normalize_area_key(area) == query_key and area != query
        ),
        None,
    )

    shown_keys = {normalize_area_key(area) for area in areas}
    candidates = [
        area
        for area in all_areas
        if normalize_area_key(area) != query_key
        and normalize_area_key(area) not in shown_keys
    ]
    near_matches = difflib.get_close_matches(query, candidates, n=3, cutoff=0.72)

    return {
        "areas": areas,
        "near_matches": near_matches,
        "case_variant": case_variant,
    }


def find_question_bank_item_by_prompt_key(
    *,
    admin_id: int,
    subject: str,
    prompt: str,
    exclude_id: str | None = None,
    passage_id: str | None = None,
) -> dict | None:
    prompt_key = normalize_prompt_key(prompt)
    if not prompt_key:
        return None
    subject = _normalize_subject(subject)
    clauses = ["admin_id = ?", "subject = ?", "prompt_key = ?"]
    params: list = [admin_id, subject, prompt_key]
    if passage_id:
        clauses.append("passage_id = ?")
        params.append(passage_id)
    else:
        clauses.append("(passage_id IS NULL OR passage_id = '')")
    if exclude_id:
        clauses.append("id != ?")
        params.append(exclude_id)
    conn = db.connect()
    try:
        row = conn.execute(
            f"""
            SELECT id, subject, stars, area, prompt, choices, answer, source,
                   created_at, updated_at, passage_id
            FROM question_bank_items
            WHERE {" AND ".join(clauses)}
            LIMIT 1
            """,
            params,
        ).fetchone()
    finally:
        conn.close()
    return _row_to_item(row) if row else None


def get_question_bank_item(item_id: str, *, admin_id: int) -> dict | None:
    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id, subject, stars, area, prompt, choices, answer, source,
                   created_at, updated_at, passage_id
            FROM question_bank_items
            WHERE id = ? AND admin_id = ?
            """,
            (item_id, admin_id),
        ).fetchone()
    finally:
        conn.close()
    return _row_to_item(row) if row else None


def create_question_bank_item(
    *,
    admin_id: int,
    data: dict,
    skip_duplicates: bool = True,
) -> dict:
    subject = _normalize_subject(data.get("subject", "general"))
    errors = _validate_question_payload(data)
    if errors:
        raise ValueError(errors)
    prompt = str(data["prompt"]).strip()
    prompt_key = normalize_prompt_key(prompt)
    passage_id = str(data.get("passage_id") or "").strip() or None
    if passage_id:
        from question_bank_passages import assert_passage_owned

        assert_passage_owned(passage_id, admin_id=admin_id)
    if skip_duplicates:
        existing = find_question_bank_item_by_prompt_key(
            admin_id=admin_id,
            subject=subject,
            prompt=prompt,
            passage_id=passage_id,
        )
        if existing:
            return {**existing, "duplicate": True}
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
                id, admin_id, subject, stars, area, prompt, prompt_key, choices,
                answer, source, created_at, updated_at, passage_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item_id,
                admin_id,
                subject,
                int(data["stars"]),
                area,
                prompt,
                prompt_key,
                choices_json,
                str(data["answer"]).strip(),
                source,
                now,
                now,
                passage_id,
            ),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    item = get_question_bank_item(item_id, admin_id=admin_id)
    return {**item, "duplicate": False}  # type: ignore[arg-type, dict-item]


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
        "passage_id": data.get("passage_id", existing.get("passage_id")),
    }
    errors = _validate_question_payload(merged)
    if errors:
        raise ValueError(errors)
    subject = _normalize_subject(merged["subject"])
    prompt = str(merged["prompt"]).strip()
    prompt_key = normalize_prompt_key(prompt)
    passage_id = str(merged.get("passage_id") or "").strip() or None
    if passage_id:
        from question_bank_passages import assert_passage_owned

        assert_passage_owned(passage_id, admin_id=admin_id)
    duplicate = find_question_bank_item_by_prompt_key(
        admin_id=admin_id,
        subject=subject,
        prompt=prompt,
        exclude_id=item_id,
        passage_id=passage_id,
    )
    if duplicate:
        raise ValueError(["A question with this prompt already exists in the bank."])
    now = _now_iso()
    area = str(merged.get("area") or "").strip()
    choices_json = json.dumps([str(c).strip() for c in merged["choices"]])
    conn = db.connect()
    try:
        cur = conn.execute(
            """
            UPDATE question_bank_items
            SET subject = ?, stars = ?, area = ?, prompt = ?, prompt_key = ?,
                choices = ?, answer = ?, updated_at = ?, passage_id = ?
            WHERE id = ? AND admin_id = ?
            """,
            (
                subject,
                int(merged["stars"]),
                area,
                prompt,
                prompt_key,
                choices_json,
                str(merged["answer"]).strip(),
                now,
                passage_id,
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
    seen_prompt_keys: set[str] = set()
    skipped_duplicate_count = 0
    for index, raw in enumerate(questions):
        payload = question_dict_from_builder(raw, subject=subject)
        item_errors = _validate_question_payload(payload)
        if item_errors:
            errors.extend(f"Question {index + 1}: {msg}" for msg in item_errors)
            continue
        prompt_key = normalize_prompt_key(payload.get("prompt", ""))
        if prompt_key in seen_prompt_keys:
            skipped_duplicate_count += 1
            continue
        try:
            item = create_question_bank_item(
                admin_id=admin_id,
                data={**payload, "source": source},
                skip_duplicates=True,
            )
            if item.get("duplicate"):
                skipped_duplicate_count += 1
                continue
            seen_prompt_keys.add(prompt_key)
            created.append(item)
        except ValueError as exc:
            msgs = exc.args[0] if exc.args else ["Invalid question."]
            if isinstance(msgs, list):
                errors.extend(f"Question {index + 1}: {msg}" for msg in msgs)
            else:
                errors.append(f"Question {index + 1}: {msgs}")
    if errors and not created and skipped_duplicate_count == 0:
        raise ValueError(errors)
    return {
        "created_count": len(created),
        "skipped_duplicate_count": skipped_duplicate_count,
        "items": created,
        "errors": errors,
    }


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
        "passage_id": str(raw.get("passage_id") or raw.get("passageId") or "").strip() or None,
    }


def save_worksheet_question_to_bank(*, admin_id: int, data: dict) -> dict:
    """Save one worksheet MCQ to the bank, creating a passage when needed."""
    subject = _normalize_subject(data.get("subject", "general"))
    stars = data.get("stars")
    if not isinstance(stars, int) or stars not in VALID_STARS:
        raise ValueError(["stars must be 1, 2, or 3."])
    question = data.get("question") or {}
    passage_data = data.get("passage")
    source = str(data.get("source") or "imported").strip().lower()
    if source not in VALID_SOURCES:
        source = "imported"

    item_data = {
        "subject": subject,
        "stars": stars,
        "prompt": question.get("prompt"),
        "choices": question.get("choices"),
        "answer": question.get("answer"),
        "area": question.get("area") or "",
        "source": source,
    }

    created_passage = False
    passage = None
    if passage_data:
        from question_bank_passages import find_or_create_question_bank_passage

        passage, created_passage = find_or_create_question_bank_passage(
            admin_id=admin_id,
            data={**passage_data, "subject": subject, "source": source},
        )
        item_data["passage_id"] = passage["id"]

    item = create_question_bank_item(
        admin_id=admin_id,
        data=item_data,
        skip_duplicates=True,
    )
    return {
        "item": item,
        "duplicate": bool(item.get("duplicate")),
        "created_passage": created_passage,
        "passage": passage,
    }


def save_worksheet_context_to_bank(*, admin_id: int, data: dict) -> dict:
    """Save a worksheet passage/data set and all its MCQs to the bank."""
    subject = _normalize_subject(data.get("subject", "general"))
    stars = data.get("stars")
    if not isinstance(stars, int) or stars not in VALID_STARS:
        raise ValueError(["stars must be 1, 2, or 3."])
    passage_data = data.get("passage")
    raw_questions = data.get("questions") or []
    source = str(data.get("source") or "imported").strip().lower()
    if source not in VALID_SOURCES:
        source = "imported"
    if not isinstance(passage_data, dict):
        raise ValueError(["passage is required."])
    if not isinstance(raw_questions, list) or not raw_questions:
        raise ValueError(["At least one question is required."])

    from question_bank_passages import find_or_create_question_bank_passage

    passage, created_passage = find_or_create_question_bank_passage(
        admin_id=admin_id,
        data={**passage_data, "subject": subject, "source": source},
    )

    created: list[dict] = []
    skipped_duplicate_count = 0
    errors: list[str] = []
    seen_prompt_keys: set[str] = set()

    for index, raw in enumerate(raw_questions):
        payload = {
            "subject": subject,
            "stars": int(raw.get("stars") or stars),
            "prompt": raw.get("prompt"),
            "choices": raw.get("choices"),
            "answer": raw.get("answer"),
            "area": raw.get("area") or "",
            "source": source,
            "passage_id": passage["id"],
        }
        item_errors = _validate_question_payload(payload)
        if item_errors:
            errors.extend(f"Question {index + 1}: {msg}" for msg in item_errors)
            continue
        prompt_key = normalize_prompt_key(payload.get("prompt", ""))
        if prompt_key in seen_prompt_keys:
            skipped_duplicate_count += 1
            continue
        item = create_question_bank_item(
            admin_id=admin_id,
            data=payload,
            skip_duplicates=True,
        )
        if item.get("duplicate"):
            skipped_duplicate_count += 1
            continue
        seen_prompt_keys.add(prompt_key)
        created.append(item)

    if errors and not created and skipped_duplicate_count == 0:
        raise ValueError(errors)

    return {
        "passage": passage,
        "created_passage": created_passage,
        "created_count": len(created),
        "skipped_duplicate_count": skipped_duplicate_count,
        "items": created,
        "errors": errors,
    }
