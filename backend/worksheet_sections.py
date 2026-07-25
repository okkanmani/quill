"""Admin-defined nested worksheet collections (folders)."""

from __future__ import annotations

import re
import sqlite3
import uuid
from datetime import datetime, timezone

import db


def ensure_worksheet_section_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS admin_worksheet_sections (
            id TEXT PRIMARY KEY,
            admin_id INTEGER NOT NULL,
            mode_key TEXT NOT NULL DEFAULT '',
            title TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS admin_worksheet_section_members (
            worksheet_id TEXT PRIMARY KEY,
            section_id TEXT NOT NULL,
            admin_id INTEGER NOT NULL,
            FOREIGN KEY (worksheet_id) REFERENCES worksheets(id) ON DELETE CASCADE,
            FOREIGN KEY (section_id) REFERENCES admin_worksheet_sections(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_admin_worksheet_section_members_section
            ON admin_worksheet_section_members (section_id);
        """
    )
    cols = {
        row[1] for row in conn.execute("PRAGMA table_info(admin_worksheet_sections)")
    }
    if "parent_id" not in cols:
        conn.execute("ALTER TABLE admin_worksheet_sections ADD COLUMN parent_id TEXT")
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_admin_worksheet_sections_admin_mode
            ON admin_worksheet_sections (admin_id, mode_key, sort_order)
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_admin_worksheet_sections_admin_parent
            ON admin_worksheet_sections (admin_id, parent_id, sort_order)
        """
    )


DEFAULT_ROOT_COLLECTIONS: tuple[tuple[str, str, int], ...] = (
    ("Practice", "practice", 0),
    ("Timed", "timed", 1),
    ("Math Enrichment", "enrichment", 2),
    ("Thinking Quest", "gifted", 3),
    ("Tests", "tests", 4),
)


def _is_root_row(row) -> bool:
    parent = row["parent_id"] if row else None
    return parent is None or not str(parent).strip()


def ensure_default_root_collections(conn: sqlite3.Connection, admin_id: int) -> None:
    """Ensure standard top-level collections exist; safe to call repeatedly."""
    created_at = datetime.now(timezone.utc).isoformat()
    for title, mode_key, sort_order in DEFAULT_ROOT_COLLECTIONS:
        section_id = f"collection-{mode_key}"
        conn.execute(
            """
            INSERT OR IGNORE INTO admin_worksheet_sections
                (id, admin_id, mode_key, title, sort_order, created_at, parent_id)
            VALUES (?, ?, ?, ?, ?, ?, NULL)
            """,
            (section_id, admin_id, mode_key, title, sort_order, created_at),
        )


def _purge_worksheet_assignments_to_roots(conn: sqlite3.Connection, admin_id: int) -> None:
    conn.execute(
        """
        DELETE FROM admin_worksheet_section_members
        WHERE admin_id = ? AND section_id IN (
            SELECT id FROM admin_worksheet_sections
            WHERE admin_id = ? AND (parent_id IS NULL OR parent_id = '')
        )
        """,
        (admin_id, admin_id),
    )


def _assert_section_can_hold_worksheets(
    conn: sqlite3.Connection, admin_id: int, section_id: str
) -> None:
    row = _fetch_section(conn, admin_id, section_id)
    if not row:
        raise ValueError("Collection not found.")
    if _is_root_row(row):
        raise ValueError(
            "Worksheets cannot be placed in a top-level collection. "
            "Add a sub-collection (e.g. Math under Practice) and move the worksheet there."
        )


def _slug_base(title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (title or "").strip().lower()).strip("-")
    return base[:48] or "section"


def _normalize_parent_id(parent_id: str | None) -> str | None:
    if parent_id is None:
        return None
    cleaned = (parent_id or "").strip()
    return cleaned or None


def _fetch_section(conn: sqlite3.Connection, admin_id: int, section_id: str):
    return conn.execute(
        """
        SELECT id, admin_id, mode_key, title, sort_order, created_at, parent_id
        FROM admin_worksheet_sections
        WHERE id = ? AND admin_id = ?
        """,
        (section_id, admin_id),
    ).fetchone()


def _validate_parent(conn: sqlite3.Connection, admin_id: int, parent_id: str | None) -> None:
    if parent_id is None:
        return
    row = _fetch_section(conn, admin_id, parent_id)
    if not row:
        raise ValueError("Parent collection not found.")


def _next_sort_order(
    conn: sqlite3.Connection, admin_id: int, parent_id: str | None
) -> int:
    if parent_id is None:
        row = conn.execute(
            """
            SELECT COALESCE(MAX(sort_order), -1)
            FROM admin_worksheet_sections
            WHERE admin_id = ? AND (parent_id IS NULL OR parent_id = '')
            """,
            (admin_id,),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT COALESCE(MAX(sort_order), -1)
            FROM admin_worksheet_sections
            WHERE admin_id = ? AND parent_id = ?
            """,
            (admin_id, parent_id),
        ).fetchone()
    return int(row[0]) + 1


def _section_payload(row) -> dict:
    parent = row["parent_id"]
    if parent is not None and not str(parent).strip():
        parent = None
    return {
        "id": row["id"],
        "mode_key": row["mode_key"] or "",
        "title": row["title"],
        "sort_order": row["sort_order"],
        "created_at": row["created_at"],
        "parent_id": parent,
        "is_top_level": _is_root_row(row),
    }


def list_sections_for_admin(admin_id: int) -> dict:
    conn = db.connect()
    try:
        ensure_worksheet_section_schema(conn)
        ensure_default_root_collections(conn, admin_id)
        _purge_worksheet_assignments_to_roots(conn, admin_id)
        migrate_subject_folder_titles(conn, admin_id)
        conn.commit()
        rows = conn.execute(
            """
            SELECT id, mode_key, title, sort_order, created_at, parent_id
            FROM admin_worksheet_sections
            WHERE admin_id = ?
            ORDER BY sort_order, title, id
            """,
            (admin_id,),
        ).fetchall()
        assignments = get_assignment_map(conn, admin_id)
        return {
            "sections": [_section_payload(r) for r in rows],
            "assignments": assignments,
        }
    finally:
        conn.close()


def get_assignment_map(conn: sqlite3.Connection, admin_id: int) -> dict[str, str]:
    ensure_worksheet_section_schema(conn)
    rows = conn.execute(
        """
        SELECT worksheet_id, section_id
        FROM admin_worksheet_section_members
        WHERE admin_id = ?
        """,
        (admin_id,),
    ).fetchall()
    return {r["worksheet_id"]: r["section_id"] for r in rows}


def enrich_worksheets_with_section_ids(
    conn: sqlite3.Connection, admin_id: int, items: list[dict]
) -> None:
    mapping = get_assignment_map(conn, admin_id)
    for item in items:
        sid = mapping.get(item["id"])
        if sid:
            item["admin_section_id"] = sid


def create_section(
    *, admin_id: int, title: str, parent_id: str | None = None
) -> dict:
    title = (title or "").strip()
    if not title:
        raise ValueError("Collection name is required.")
    parent_id = _normalize_parent_id(parent_id)

    conn = db.connect()
    try:
        ensure_worksheet_section_schema(conn)
        _validate_parent(conn, admin_id, parent_id)
        section_id = f"{_slug_base(title)}-{uuid.uuid4().hex[:8]}"
        created_at = datetime.now(timezone.utc).isoformat()
        sort_order = _next_sort_order(conn, admin_id, parent_id)
        conn.execute(
            """
            INSERT INTO admin_worksheet_sections
                (id, admin_id, mode_key, title, sort_order, created_at, parent_id)
            VALUES (?, ?, '', ?, ?, ?, ?)
            """,
            (section_id, admin_id, title, sort_order, created_at, parent_id),
        )
        conn.commit()
        return {
            "id": section_id,
            "mode_key": "",
            "title": title,
            "sort_order": sort_order,
            "created_at": created_at,
            "parent_id": parent_id,
        }
    finally:
        conn.close()


def _assert_worksheet_owned(conn: sqlite3.Connection, worksheet_id: str, admin_id: int):
    from worksheets import _default_admin_id

    default_admin = _default_admin_id(conn)
    row = conn.execute(
        """
        SELECT id FROM worksheets
        WHERE id = ? AND (admin_id = ? OR (admin_id IS NULL AND ? = ?))
        """,
        (worksheet_id, admin_id, admin_id, default_admin),
    ).fetchone()
    if not row:
        raise ValueError("Worksheet not found.")


def assign_worksheet_section(
    *,
    admin_id: int,
    worksheet_id: str,
    section_id: str | None,
    new_section_title: str | None = None,
    new_section_parent_id: str | None = None,
    mode_key: str | None = None,  # deprecated; ignored
) -> dict:
    del mode_key
    conn = db.connect()
    try:
        ensure_worksheet_section_schema(conn)
        _assert_worksheet_owned(conn, worksheet_id, admin_id)

        target_section_id = (section_id or "").strip() or None
        new_title = (new_section_title or "").strip()
        new_parent_id = _normalize_parent_id(new_section_parent_id)

        if new_title:
            if new_parent_id is None:
                raise ValueError(
                    "New folders that hold worksheets must be created inside a collection, "
                    "not at the top level."
                )
            created = create_section(
                admin_id=admin_id, title=new_title, parent_id=new_parent_id
            )
            target_section_id = created["id"]
        elif target_section_id is None:
            conn.execute(
                """
                DELETE FROM admin_worksheet_section_members
                WHERE worksheet_id = ? AND admin_id = ?
                """,
                (worksheet_id, admin_id),
            )
            conn.commit()
            return {"worksheet_id": worksheet_id, "admin_section_id": None}

        if not _fetch_section(conn, admin_id, target_section_id):
            raise ValueError("Collection not found.")

        _assert_section_can_hold_worksheets(conn, admin_id, target_section_id)

        conn.execute(
            """
            INSERT INTO admin_worksheet_section_members (worksheet_id, section_id, admin_id)
            VALUES (?, ?, ?)
            ON CONFLICT(worksheet_id) DO UPDATE SET
                section_id = excluded.section_id,
                admin_id = excluded.admin_id
            """,
            (worksheet_id, target_section_id, admin_id),
        )
        conn.commit()
        return {"worksheet_id": worksheet_id, "admin_section_id": target_section_id}
    finally:
        conn.close()


def _descendant_section_ids(
    conn: sqlite3.Connection, admin_id: int, section_id: str
) -> set[str]:
    rows = conn.execute(
        """
        SELECT id, parent_id FROM admin_worksheet_sections WHERE admin_id = ?
        """,
        (admin_id,),
    ).fetchall()
    by_parent: dict[str, list[str]] = {}
    for row in rows:
        pid = row["parent_id"]
        if pid and str(pid).strip():
            by_parent.setdefault(str(pid), []).append(row["id"])
    found: set[str] = set()
    stack = [section_id]
    while stack:
        cur = stack.pop()
        for child_id in by_parent.get(cur, []):
            if child_id not in found:
                found.add(child_id)
                stack.append(child_id)
    return found


def move_section(
    *, admin_id: int, section_id: str, parent_id: str | None
) -> dict:
    section_id = (section_id or "").strip()
    parent_id = _normalize_parent_id(parent_id)
    if not section_id:
        raise ValueError("Collection id is required.")

    conn = db.connect()
    try:
        ensure_worksheet_section_schema(conn)
        row = _fetch_section(conn, admin_id, section_id)
        if not row:
            raise ValueError("Collection not found.")

        if parent_id == section_id:
            raise ValueError("A collection cannot be moved into itself.")

        if parent_id:
            _validate_parent(conn, admin_id, parent_id)
            blocked = _descendant_section_ids(conn, admin_id, section_id)
            if parent_id in blocked:
                raise ValueError(
                    "A collection cannot be moved into its own sub-collection."
                )

        sort_order = _next_sort_order(conn, admin_id, parent_id)
        conn.execute(
            """
            UPDATE admin_worksheet_sections
            SET parent_id = ?, sort_order = ?
            WHERE id = ? AND admin_id = ?
            """,
            (parent_id, sort_order, section_id, admin_id),
        )

        if parent_id is None:
            conn.execute(
                """
                DELETE FROM admin_worksheet_section_members
                WHERE admin_id = ? AND section_id = ?
                """,
                (admin_id, section_id),
            )

        conn.commit()
        updated = _fetch_section(conn, admin_id, section_id)
        return _section_payload(updated)
    finally:
        conn.close()


ROOT_SECTION_BY_KIND = {
    "practice": "collection-practice",
    "timed": "collection-timed",
    "enrichment": "collection-enrichment",
    "gifted": "collection-gifted",
    "tests": "collection-tests",
}


def _worksheet_kind(row) -> str:
    if bool(row["is_test"]):
        return "tests"
    if bool(row["is_gifted_track"]):
        return "gifted"
    if bool(row["is_math_enrichment"]):
        return "enrichment"
    if bool(row["is_timed"]):
        return "timed"
    return "practice"


def _folder_title_for_worksheet(row) -> str:
    if bool(row["is_gifted_track"]):
        week = row["gifted_track_week"]
        if week is not None:
            try:
                w = int(week)
                if w > 0:
                    return f"Week {w}"
            except (TypeError, ValueError):
                pass
    subject = (row["subject"] or "").strip().lower() or "general"
    if subject == "data":
        return "Data analysis"
    if subject == "social studies":
        return "Social studies"
    return subject[:1].upper() + subject[1:] if subject else "General"


def _find_child_section_by_title(
    conn: sqlite3.Connection, admin_id: int, parent_id: str, title: str
) -> str | None:
    row = conn.execute(
        """
        SELECT id FROM admin_worksheet_sections
        WHERE admin_id = ? AND parent_id = ?
          AND lower(trim(title)) = lower(trim(?))
        """,
        (admin_id, parent_id, title),
    ).fetchone()
    return row["id"] if row else None


def _create_child_section_in_conn(
    conn: sqlite3.Connection, admin_id: int, parent_id: str, title: str
) -> str:
    existing = _find_child_section_by_title(conn, admin_id, parent_id, title)
    if existing:
        return existing
    section_id = f"{_slug_base(title)}-{uuid.uuid4().hex[:8]}"
    created_at = datetime.now(timezone.utc).isoformat()
    sort_order = _next_sort_order(conn, admin_id, parent_id)
    conn.execute(
        """
        INSERT INTO admin_worksheet_sections
            (id, admin_id, mode_key, title, sort_order, created_at, parent_id)
        VALUES (?, ?, '', ?, ?, ?, ?)
        """,
        (section_id, admin_id, title, sort_order, created_at, parent_id),
    )
    return section_id


def migrate_subject_folder_titles(conn: sqlite3.Connection, admin_id: int) -> int:
    """Normalize math/english folder titles to Math/English for display consistency."""
    rows = conn.execute(
        """
        SELECT id, title FROM admin_worksheet_sections
        WHERE admin_id = ? AND parent_id IS NOT NULL AND parent_id != ''
        """,
        (admin_id,),
    ).fetchall()
    updated = 0
    for row in rows:
        raw = (row["title"] or "").strip()
        if not raw or raw.lower().startswith("week "):
            continue
        key = raw.lower()
        if key == "data":
            new_title = "Data analysis"
        elif key == "social studies":
            new_title = "Social studies"
        else:
            new_title = key[:1].upper() + key[1:] if key else raw
        if new_title != raw:
            conn.execute(
                """
                UPDATE admin_worksheet_sections SET title = ?
                WHERE id = ? AND admin_id = ?
                """,
                (new_title, row["id"], admin_id),
            )
            updated += 1
    return updated


def organize_unassigned_worksheets(*, admin_id: int) -> dict:
    """Create sub-collections under Practice/Timed/… and assign unassigned worksheets."""
    from worksheets import _default_admin_id

    conn = db.connect()
    try:
        ensure_worksheet_section_schema(conn)
        ensure_default_root_collections(conn, admin_id)
        default_admin = _default_admin_id(conn)

        rows = conn.execute(
            """
            SELECT w.id, w.subject, w.is_timed, w.is_math_enrichment,
                   w.is_gifted_track, w.gifted_track_week, w.is_test
            FROM worksheets w
            WHERE (w.admin_id = ? OR (w.admin_id IS NULL AND ? = ?))
              AND w.id NOT IN (
                SELECT worksheet_id FROM admin_worksheet_section_members
                WHERE admin_id = ?
              )
            """,
            (admin_id, admin_id, default_admin, admin_id),
        ).fetchall()

        assigned_count = 0
        sections_created = 0
        folder_cache: dict[tuple[str, str], str] = {}

        for row in rows:
            kind = _worksheet_kind(row)
            root_id = ROOT_SECTION_BY_KIND.get(kind)
            if not root_id or not _fetch_section(conn, admin_id, root_id):
                continue

            folder_title = _folder_title_for_worksheet(row)
            cache_key = (root_id, folder_title.strip().lower())
            if cache_key not in folder_cache:
                before = _find_child_section_by_title(
                    conn, admin_id, root_id, folder_title
                )
                section_id = _create_child_section_in_conn(
                    conn, admin_id, root_id, folder_title
                )
                if not before:
                    sections_created += 1
                folder_cache[cache_key] = section_id
            target_section_id = folder_cache[cache_key]

            conn.execute(
                """
                INSERT INTO admin_worksheet_section_members
                    (worksheet_id, section_id, admin_id)
                VALUES (?, ?, ?)
                ON CONFLICT(worksheet_id) DO UPDATE SET
                    section_id = excluded.section_id,
                    admin_id = excluded.admin_id
                """,
                (row["id"], target_section_id, admin_id),
            )
            assigned_count += 1

        conn.commit()
        return {
            "assigned_count": assigned_count,
            "sections_created": sections_created,
            "worksheet_count": len(rows),
        }
    finally:
        conn.close()


BUILTIN_ROOT_SECTION_IDS = frozenset(ROOT_SECTION_BY_KIND.values())


def delete_section(*, admin_id: int, section_id: str) -> dict:
    section_id = (section_id or "").strip()
    if not section_id:
        raise ValueError("Collection id is required.")
    if section_id in BUILTIN_ROOT_SECTION_IDS:
        raise ValueError("Built-in collections (Practice, Timed, …) cannot be deleted.")

    conn = db.connect()
    try:
        ensure_worksheet_section_schema(conn)
        if not _fetch_section(conn, admin_id, section_id):
            raise ValueError("Collection not found.")

        descendants = _descendant_section_ids(conn, admin_id, section_id)
        to_remove = list(descendants) + [section_id]

        for sid in to_remove:
            conn.execute(
                """
                DELETE FROM admin_worksheet_section_members
                WHERE admin_id = ? AND section_id = ?
                """,
                (admin_id, sid),
            )
            conn.execute(
                """
                DELETE FROM admin_worksheet_sections
                WHERE admin_id = ? AND id = ?
                """,
                (admin_id, sid),
            )

        conn.commit()
        return {
            "deleted_id": section_id,
            "deleted_count": len(to_remove),
            "worksheets_unassigned": True,
        }
    finally:
        conn.close()
