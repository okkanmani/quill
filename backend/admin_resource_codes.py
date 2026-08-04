"""Admin-only human-readable resource codes (e.g. MATH-WS-0042, MATH-WS-0042T)."""

from __future__ import annotations

import re

import db

SUBJECT_CODES: dict[str, str] = {
    "math": "MATH",
    "science": "SCIE",
    "data": "DATA",
    "social studies": "SOCS",
    "social-studies": "SOCS",
    "general": "GENR",
}

# Longest prefixes first for learn subject_key slugs like math-g5-ncert.
_SUBJECT_PREFIXES: tuple[tuple[str, str], ...] = (
    ("social-studies", "SOCS"),
    ("social studies", "SOCS"),
    ("science", "SCIE"),
    ("math", "MATH"),
    ("data", "DATA"),
    ("general", "GENR"),
)

ADMIN_CODE_RE = re.compile(
    r"^(MATH|ENGL|ENCR|ENRC|SCIE|DATA|SOCS|GENR)-(WS|TS|LR)-\d{4}T?$"
)


def _normalize_english_type(english_type: str | None) -> str:
    return (english_type or "").strip().lower()


def subject_to_code(subject: str, *, english_type: str | None = None) -> str:
    key = (subject or "general").strip().lower().replace("_", "-")
    if not key:
        key = "general"
    if key == "english" or key.startswith("english-"):
        if _normalize_english_type(english_type) == "reading_comprehension":
            return "ENRC"
        return "ENCR"
    if key in SUBJECT_CODES:
        return SUBJECT_CODES[key]
    for prefix, code in _SUBJECT_PREFIXES:
        if key == prefix or key.startswith(f"{prefix}-"):
            return code
    return "GENR"


def worksheet_type_code(*, is_test: bool) -> str:
    return "TS" if is_test else "WS"


def format_admin_code(
    subject_code: str,
    type_code: str,
    seq: int,
    *,
    timed_suffix: bool = False,
) -> str:
    code = f"{subject_code}-{type_code}-{int(seq):04d}"
    if timed_suffix:
        code += "T"
    return code


def preview_admin_code(
    conn,
    admin_id: int,
    subject: str,
    *,
    is_test: bool = False,
    is_timed: bool = False,
    for_learn: bool = False,
    english_type: str | None = None,
) -> str:
    """Return the code that would be assigned on next publish (does not increment)."""
    subject_code = subject_to_code(subject, english_type=english_type)
    if for_learn:
        type_code = "LR"
        timed_suffix = False
    else:
        type_code = worksheet_type_code(is_test=is_test)
        timed_suffix = bool(is_timed and not is_test)

    row = conn.execute(
        """
        SELECT next_seq FROM admin_resource_counters
        WHERE admin_id = ? AND subject_code = ? AND type_code = ?
        """,
        (admin_id, subject_code, type_code),
    ).fetchone()
    seq = int(row["next_seq"]) if row else 1
    return format_admin_code(
        subject_code, type_code, seq, timed_suffix=timed_suffix
    )


def ensure_admin_resource_code_schema(conn) -> None:
    worksheet_cols = {
        row[1] for row in conn.execute("PRAGMA table_info(worksheets)")
    }
    if "admin_code" not in worksheet_cols:
        conn.execute("ALTER TABLE worksheets ADD COLUMN admin_code TEXT")

    learn_cols = {
        row[1] for row in conn.execute("PRAGMA table_info(learn_sections)")
    }
    if learn_cols and "admin_code" not in learn_cols:
        conn.execute("ALTER TABLE learn_sections ADD COLUMN admin_code TEXT")

    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS admin_resource_counters (
            admin_id INTEGER NOT NULL,
            subject_code TEXT NOT NULL,
            type_code TEXT NOT NULL,
            next_seq INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY (admin_id, subject_code, type_code)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_worksheets_admin_code
            ON worksheets (admin_id, admin_code)
            WHERE admin_code IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_learn_sections_admin_code
            ON learn_sections (admin_id, admin_code)
            WHERE admin_code IS NOT NULL;
        """
    )
    backfill_admin_codes(conn)


def _default_admin_id(conn) -> int:
    row = conn.execute("SELECT MIN(id) AS id FROM admins").fetchone()
    if row and row["id"] is not None:
        return int(row["id"])
    return 1


def _next_seq_from_code(code: str) -> int | None:
    m = re.match(r"^[A-Z]{4}-(?:WS|TS|LR)-(\d{4})T?$", code or "")
    if not m:
        return None
    return int(m.group(1))


def _sync_counter(
    conn,
    admin_id: int,
    subject_code: str,
    type_code: str,
    used_seq: int,
) -> None:
    row = conn.execute(
        """
        SELECT next_seq FROM admin_resource_counters
        WHERE admin_id = ? AND subject_code = ? AND type_code = ?
        """,
        (admin_id, subject_code, type_code),
    ).fetchone()
    next_needed = used_seq + 1
    if row is None:
        conn.execute(
            """
            INSERT INTO admin_resource_counters
                (admin_id, subject_code, type_code, next_seq)
            VALUES (?, ?, ?, ?)
            """,
            (admin_id, subject_code, type_code, next_needed),
        )
    elif int(row["next_seq"]) < next_needed:
        conn.execute(
            """
            UPDATE admin_resource_counters
            SET next_seq = ?
            WHERE admin_id = ? AND subject_code = ? AND type_code = ?
            """,
            (next_needed, admin_id, subject_code, type_code),
        )


def allocate_admin_code(
    conn,
    admin_id: int,
    subject: str,
    *,
    is_test: bool = False,
    is_timed: bool = False,
    for_learn: bool = False,
    english_type: str | None = None,
) -> str:
    subject_code = subject_to_code(subject, english_type=english_type)
    if for_learn:
        type_code = "LR"
        timed_suffix = False
    else:
        type_code = worksheet_type_code(is_test=is_test)
        timed_suffix = bool(is_timed and not is_test)

    conn.execute(
        """
        INSERT INTO admin_resource_counters (admin_id, subject_code, type_code, next_seq)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(admin_id, subject_code, type_code) DO NOTHING
        """,
        (admin_id, subject_code, type_code),
    )
    row = conn.execute(
        """
        SELECT next_seq FROM admin_resource_counters
        WHERE admin_id = ? AND subject_code = ? AND type_code = ?
        """,
        (admin_id, subject_code, type_code),
    ).fetchone()
    seq = int(row["next_seq"])
    code = format_admin_code(
        subject_code, type_code, seq, timed_suffix=timed_suffix
    )
    conn.execute(
        """
        UPDATE admin_resource_counters
        SET next_seq = next_seq + 1
        WHERE admin_id = ? AND subject_code = ? AND type_code = ?
        """,
        (admin_id, subject_code, type_code),
    )
    return code


def backfill_admin_codes(conn) -> None:
    admin_ids = [
        int(row["admin_id"])
        for row in conn.execute(
            """
            SELECT DISTINCT COALESCE(admin_id, ?) AS admin_id FROM worksheets
            UNION
            SELECT DISTINCT COALESCE(admin_id, ?) AS admin_id FROM learn_sections
            """,
            (_default_admin_id(conn), _default_admin_id(conn)),
        ).fetchall()
    ]
    if not admin_ids:
        admin_ids = [_default_admin_id(conn)]

    for admin_id in admin_ids:
        _backfill_worksheet_codes(conn, admin_id)
        _backfill_learn_codes(conn, admin_id)


def _resolved_english_type_for_row(conn, row) -> str | None:
    from worksheets import resolve_worksheet_english_type

    return resolve_worksheet_english_type(
        conn,
        row["id"],
        subject=row["subject"],
        db_english_type=row["english_type"],
        passages_json=row["passages"] if "passages" in row.keys() else None,
    )


def _persist_inferred_english_type(
    conn, worksheet_id: str, db_value: str | None, resolved: str | None
) -> None:
    if not resolved:
        return
    if isinstance(db_value, str) and db_value.strip():
        return
    conn.execute(
        "UPDATE worksheets SET english_type = ? WHERE id = ?",
        (resolved, worksheet_id),
    )


def _backfill_worksheet_codes(conn, admin_id: int) -> None:
    default_admin = _default_admin_id(conn)
    rows = conn.execute(
        """
        SELECT id, subject, is_test, is_timed, admin_code, english_type, passages
        FROM worksheets
        WHERE (admin_id = ? OR (admin_id IS NULL AND ? = ?))
          AND (admin_code IS NULL OR trim(admin_code) = '')
        ORDER BY sort_ts ASC, id ASC
        """,
        (admin_id, admin_id, default_admin),
    ).fetchall()
    for row in rows:
        english_type = _resolved_english_type_for_row(conn, row)
        _persist_inferred_english_type(
            conn, row["id"], row["english_type"], english_type
        )
        code = allocate_admin_code(
            conn,
            admin_id,
            row["subject"],
            is_test=bool(row["is_test"]),
            is_timed=bool(row["is_timed"]),
            english_type=english_type,
        )
        conn.execute(
            "UPDATE worksheets SET admin_code = ? WHERE id = ?",
            (code, row["id"]),
        )

    assigned = conn.execute(
        """
        SELECT admin_code FROM worksheets
        WHERE (admin_id = ? OR (admin_id IS NULL AND ? = ?))
          AND admin_code IS NOT NULL AND trim(admin_code) != ''
        """,
        (admin_id, admin_id, default_admin),
    ).fetchall()
    for row in assigned:
        code = row["admin_code"]
        if not ADMIN_CODE_RE.fullmatch(code or ""):
            continue
        parts = code.split("-")
        subject_code, type_code = parts[0], parts[1]
        seq = _next_seq_from_code(code)
        if seq is not None:
            _sync_counter(conn, admin_id, subject_code, type_code, seq)


def _backfill_learn_codes(conn, admin_id: int) -> None:
    default_admin = _default_admin_id(conn)
    rows = conn.execute(
        """
        SELECT id, subject_key, admin_code
        FROM learn_sections
        WHERE (admin_id = ? OR (admin_id IS NULL AND ? = ?))
          AND (admin_code IS NULL OR trim(admin_code) = '')
        ORDER BY created_at ASC, id ASC
        """,
        (admin_id, admin_id, default_admin),
    ).fetchall()
    for row in rows:
        code = allocate_admin_code(
            conn,
            admin_id,
            row["subject_key"],
            for_learn=True,
        )
        conn.execute(
            "UPDATE learn_sections SET admin_code = ? WHERE id = ?",
            (code, row["id"]),
        )

    assigned = conn.execute(
        """
        SELECT admin_code FROM learn_sections
        WHERE (admin_id = ? OR (admin_id IS NULL AND ? = ?))
          AND admin_code IS NOT NULL AND trim(admin_code) != ''
        """,
        (admin_id, admin_id, default_admin),
    ).fetchall()
    for row in assigned:
        code = row["admin_code"]
        if not ADMIN_CODE_RE.fullmatch(code or ""):
            continue
        parts = code.split("-")
        subject_code, type_code = parts[0], parts[1]
        seq = _next_seq_from_code(code)
        if seq is not None:
            _sync_counter(conn, admin_id, subject_code, type_code, seq)


def _english_worksheet_rows_for_admin(conn, admin_id: int) -> list:
    default_admin = _default_admin_id(conn)
    return conn.execute(
        """
        SELECT id, title, subject, is_test, is_timed, admin_code, english_type, passages
        FROM worksheets
        WHERE (admin_id = ? OR (admin_id IS NULL AND ? = ?))
          AND lower(subject) = 'english'
          AND admin_code IS NOT NULL
          AND trim(admin_code) != ''
          AND admin_code LIKE 'ENCR-%'
        ORDER BY sort_ts ASC, id ASC
        """,
        (admin_id, admin_id, default_admin),
    ).fetchall()


def find_misclassified_english_rc_worksheets(conn, admin_id: int) -> list[dict]:
    """English RC worksheets that were coded under ENCR instead of ENRC."""
    matches: list[dict] = []
    for row in _english_worksheet_rows_for_admin(conn, admin_id):
        english_type = _resolved_english_type_for_row(conn, row)
        if english_type != "reading_comprehension":
            continue
        matches.append(
            {
                "id": row["id"],
                "title": row["title"],
                "old_code": str(row["admin_code"]).strip(),
                "english_type": english_type,
                "is_test": bool(row["is_test"]),
                "is_timed": bool(row["is_timed"]),
            }
        )
    return matches


def recode_misclassified_english_rc_worksheets(
    conn, admin_id: int, *, dry_run: bool = True
) -> dict:
    """
    One-time fix: reassign ENCR-* codes to ENRC-* for reading-comprehension worksheets.
    """
    planned = find_misclassified_english_rc_worksheets(conn, admin_id)
    if dry_run:
        return {"dry_run": True, "count": len(planned), "changes": planned}

    applied: list[dict] = []
    for item in planned:
        row = conn.execute(
            """
            SELECT id, subject, is_test, is_timed, admin_code, english_type, passages
            FROM worksheets WHERE id = ?
            """,
            (item["id"],),
        ).fetchone()
        if not row:
            continue
        old_code = str(row["admin_code"] or "").strip()
        if not old_code.startswith("ENCR-"):
            continue

        english_type = _resolved_english_type_for_row(conn, row)
        if english_type != "reading_comprehension":
            continue

        conn.execute(
            "UPDATE worksheets SET admin_code = NULL, english_type = ? WHERE id = ?",
            (english_type, row["id"]),
        )
        new_code = allocate_admin_code(
            conn,
            admin_id,
            row["subject"],
            is_test=bool(row["is_test"]),
            is_timed=bool(row["is_timed"]),
            english_type=english_type,
        )
        conn.execute(
            "UPDATE worksheets SET admin_code = ? WHERE id = ?",
            (new_code, row["id"]),
        )
        applied.append(
            {
                "id": row["id"],
                "title": item.get("title") or row["id"],
                "old_code": old_code,
                "new_code": new_code,
            }
        )

    assigned = conn.execute(
        """
        SELECT admin_code FROM worksheets
        WHERE (admin_id = ? OR (admin_id IS NULL AND ? = ?))
          AND admin_code IS NOT NULL AND trim(admin_code) != ''
        """,
        (admin_id, admin_id, _default_admin_id(conn)),
    ).fetchall()
    for row in assigned:
        code = row["admin_code"]
        if not ADMIN_CODE_RE.fullmatch(code or ""):
            continue
        parts = code.split("-")
        subject_code, type_code = parts[0], parts[1]
        seq = _next_seq_from_code(code)
        if seq is not None:
            _sync_counter(conn, admin_id, subject_code, type_code, seq)

    return {"dry_run": False, "count": len(applied), "changes": applied}
