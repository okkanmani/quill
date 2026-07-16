"""Load Markdown learning material from backend/data/learn/<subject>/ and SQLite."""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import db

LEARN_DIR = Path(__file__).parent / "data" / "learn"


def _slugify(text: str, *, max_len: int = 60) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower().strip())
    return s.strip("-")[:max_len] or "section"


def _normalize_subject_key(key: str) -> str:
    return _slugify(key, max_len=80)


def _db_subject_catalog() -> dict[str, dict]:
    """subject_key → {title, description} from newest row per key."""
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT subject_key, subject_title, subject_description, grade, curriculum, created_at
            FROM learn_sections
            ORDER BY created_at DESC
            """
        ).fetchall()
        out: dict[str, dict] = {}
        for row in rows:
            key = row["subject_key"]
            if key in out:
                continue
            title = row["subject_title"] or key.replace("-", " ").title()
            desc = row["subject_description"] or ""
            if row["grade"] and row["curriculum"]:
                desc = desc or f"Grade {row['grade']} · {row['curriculum']}"
            out[key] = {
                "key": key,
                "title": title,
                "description": desc,
                "grade": row["grade"],
                "created_at": row["created_at"],
            }
        return out
    finally:
        conn.close()


def _hub_order_map(scope: str) -> dict[str, int]:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT subject_key, sort_order
            FROM learn_hub_order
            WHERE scope = ?
            ORDER BY sort_order ASC
            """,
            (scope.strip(),),
        ).fetchall()
        return {row["subject_key"]: int(row["sort_order"]) for row in rows}
    finally:
        conn.close()


def _grade_from_subject(meta: dict) -> int:
    grade = meta.get("grade")
    if isinstance(grade, int) and grade > 0:
        return grade
    for field in (meta.get("description") or "", meta.get("title") or ""):
        match = re.search(r"Grade\s+(\d+)", field, re.IGNORECASE)
        if match:
            return int(match.group(1))
    key = meta.get("key") or ""
    match = re.search(r"-g(\d+)(?:$|-)", key)
    if match:
        return int(match.group(1))
    return 0


def _default_subject_sort_key(meta: dict) -> tuple:
    return (-_grade_from_subject(meta), meta.get("created_at") or "", meta.get("key") or "")


def _sort_subjects_for_scope(scope: str, subjects: list[dict]) -> list[dict]:
    order_map = _hub_order_map(scope)
    if order_map:
        return sorted(
            subjects,
            key=lambda meta: (
                order_map.get(meta["key"], 10_000),
                meta.get("key") or "",
            ),
        )
    return sorted(subjects, key=_default_subject_sort_key)


def _belongs_to_learn_group(subject_key: str, group_id: str, explicit_items: list) -> bool:
    if subject_key in explicit_items:
        return True
    if subject_key == group_id:
        return True
    prefix = f"{group_id}-"
    return subject_key.startswith(prefix)


def _subjects_for_group(
    *,
    group_id: str,
    explicit_items: list,
    subjects_by_key: dict[str, dict],
    placed_keys: set[str],
) -> list[dict]:
    subjects: list[dict] = []
    seen: set[str] = set()
    for ref in explicit_items:
        key = ref if isinstance(ref, str) else ref.get("key")
        if not key or key in seen or key not in subjects_by_key:
            continue
        subjects.append(subjects_by_key[key])
        seen.add(key)
        placed_keys.add(key)
    for key, meta in subjects_by_key.items():
        if key in seen:
            continue
        if _belongs_to_learn_group(key, group_id, explicit_items):
            subjects.append(meta)
            seen.add(key)
            placed_keys.add(key)
    return _sort_subjects_for_scope(group_id, subjects)


def _db_sections(subject_key: str) -> list[dict]:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT section_id, title, markdown, group_id, group_title
            FROM learn_sections
            WHERE subject_key = ?
            ORDER BY sort_order ASC, id ASC
            """,
            (subject_key,),
        ).fetchall()
        return [
            {
                "id": row["section_id"],
                "title": row["title"],
                "markdown": row["markdown"],
                "group_id": row["group_id"] or "main",
                "group_title": row["group_title"] or "Sections",
            }
            for row in rows
        ]
    finally:
        conn.close()


def list_admin_learn_sections() -> list[dict]:
    conn = db.connect()
    try:
        rows = conn.execute(
            """
            SELECT subject_key, section_id, title, subject_title, subject_description, created_at
            FROM learn_sections
            ORDER BY subject_key ASC, sort_order ASC, id ASC
            """
        ).fetchall()
        return [
            {
                "subject_key": row["subject_key"],
                "section_id": row["section_id"],
                "title": row["title"],
                "subject_title": row["subject_title"]
                or row["subject_key"].replace("-", " ").title(),
                "subject_description": row["subject_description"] or "",
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    finally:
        conn.close()


def list_subjects() -> list[dict]:
    out: list[dict] = []
    if LEARN_DIR.is_dir():
        for d in sorted(LEARN_DIR.iterdir()):
            if not d.is_dir():
                continue
            man = d / "manifest.json"
            if not man.exists():
                continue
            with open(man, encoding="utf-8") as f:
                m = json.load(f)
            out.append(
                {
                    "key": d.name,
                    "title": m.get("title", d.name),
                    "description": m.get("description", ""),
                }
            )
    db_catalog = _db_subject_catalog()
    keys = {s["key"] for s in out}
    for key, meta in db_catalog.items():
        if key not in keys:
            out.append(meta)
    out.sort(key=lambda s: s["key"])
    return out


def learn_collection_key(*, subject: str, grade: int, curriculum: str) -> str:
    return _normalize_subject_key(f"{subject}-{curriculum}-g{grade}")


def _fs_subject_meta(subject_key: str) -> dict | None:
    subj_dir = LEARN_DIR / subject_key.strip().lower()
    man_path = subj_dir / "manifest.json"
    if not man_path.exists():
        return None
    with open(man_path, encoding="utf-8") as f:
        manifest = json.load(f)
    return {
        "title": manifest.get("title", subject_key),
        "description": manifest.get("description", ""),
    }


def list_learn_hub() -> dict:
    """Hub layout for Learn landing page (flat subjects or grouped)."""
    subjects_by_key = {s["key"]: s for s in list_subjects()}
    hub_path = LEARN_DIR / "hub.json"
    if not hub_path.is_file():
        subjects = _sort_subjects_for_scope(
            "__root__", list(subjects_by_key.values())
        )
        return {
            "entries": [{"type": "subject", **s} for s in subjects]
        }

    with open(hub_path, encoding="utf-8") as f:
        raw = json.load(f)

    placed_keys: set[str] = set()
    entries: list[dict] = []
    for item in raw.get("entries", []):
        kind = item.get("type", "subject")
        if kind == "group":
            group_id = item.get("id", "")
            explicit_items = item.get("items", [])
            group_subjects = _subjects_for_group(
                group_id=group_id,
                explicit_items=explicit_items,
                subjects_by_key=subjects_by_key,
                placed_keys=placed_keys,
            )
            if group_subjects:
                entries.append(
                    {
                        "type": "group",
                        "id": group_id,
                        "title": item.get("title", ""),
                        "description": item.get("description", ""),
                        "subjects": group_subjects,
                    }
                )
        elif kind == "subject":
            key = item.get("key")
            if key and key in subjects_by_key and key not in placed_keys:
                placed_keys.add(key)
                entries.append({"type": "subject", **subjects_by_key[key]})

    root_subjects = [
        meta
        for key, meta in subjects_by_key.items()
        if key not in placed_keys
    ]
    root_subjects = _sort_subjects_for_scope("__root__", root_subjects)
    for meta in root_subjects:
        entries.append({"type": "subject", **meta})

    if not entries:
        subjects = _sort_subjects_for_scope(
            "__root__", list(subjects_by_key.values())
        )
        return {
            "entries": [{"type": "subject", **s} for s in subjects]
        }

    return {"entries": entries}


def reorder_learn_hub_collections(*, scope: str, subject_keys: list[str]) -> dict:
    scope = scope.strip()
    if not scope:
        raise ValueError("Hub scope is required.")
    ordered = [key.strip().lower() for key in subject_keys if (key or "").strip()]
    if not ordered:
        raise ValueError("Collection order is required.")
    if len(set(ordered)) != len(ordered):
        raise ValueError("Duplicate collections in order list.")

    hub = list_learn_hub()
    expected = []
    for entry in hub.get("entries", []):
        if entry.get("type") == "group" and entry.get("id") == scope:
            expected = [subject["key"] for subject in entry.get("subjects", [])]
            break
        if entry.get("type") == "subject" and scope == "__root__":
            expected.append(entry["key"])
    if not expected:
        raise ValueError("No collections found for this hub section.")
    if set(ordered) != set(expected):
        raise ValueError(
            "Collection order must include every item in this hub section."
        )

    conn = db.connect()
    try:
        conn.execute("DELETE FROM learn_hub_order WHERE scope = ?", (scope,))
        for index, subject_key in enumerate(ordered):
            conn.execute(
                """
                INSERT INTO learn_hub_order (scope, subject_key, sort_order)
                VALUES (?, ?, ?)
                """,
                (scope, subject_key, index),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {"scope": scope, "subject_keys": ordered}


def _is_hidden_learn_group(group_id: str, group_title: str) -> bool:
    gid = (group_id or "").strip().lower()
    gtitle = (group_title or "").strip()
    if gid in ("main", "ai-generated"):
        return True
    if not gtitle or gtitle.lower() in ("sections", "ai generated"):
        return True
    return False


def _ungrouped_bucket(groups_out: list, by_group: dict) -> dict:
    key = ""
    if key not in by_group:
        bucket = {"id": "", "title": "", "sections": []}
        groups_out.append(bucket)
        by_group[key] = bucket
    return by_group[key]
def _merge_db_sections(subject_key: str, groups_out: list, flat_sections: list) -> None:
    db_secs = _db_sections(subject_key)
    if not db_secs:
        return
    by_group: dict[str, dict] = {}
    for g in groups_out:
        gid = g.get("id") or ""
        by_group[gid] = g
    for sec in db_secs:
        gid = sec.pop("group_id", "main")
        gtitle = sec.pop("group_title", "")
        loaded = {**sec, "source": "db", "group_id": gid, "group_title": gtitle}
        if _is_hidden_learn_group(gid, gtitle):
            bucket = _ungrouped_bucket(groups_out, by_group)
            bucket["sections"].append(loaded)
        else:
            if gid not in by_group:
                bucket = {"id": gid, "title": gtitle, "sections": []}
                groups_out.append(bucket)
                by_group[gid] = bucket
            by_group[gid]["sections"].append(loaded)
        flat_sections.append(loaded)


def publish_learn_section(
    *,
    subject_key: str,
    section_title: str,
    markdown: str,
    subject_title: str | None = None,
    subject_description: str | None = None,
    group_id: str = "main",
    group_title: str = "",
    grade: int | None = None,
    curriculum: str | None = None,
) -> dict:
    subject_key = _normalize_subject_key(subject_key)
    if not subject_key:
        raise ValueError("Learn collection key is required.")
    section_title = (section_title or "").strip()
    markdown = (markdown or "").strip()
    if not section_title:
        raise ValueError("Section title is required.")
    if not markdown:
        raise ValueError("Markdown content is required.")

    base_id = _slugify(section_title)
    section_id = base_id
    conn = db.connect()
    try:
        existing_ids = {
            row[0]
            for row in conn.execute(
                "SELECT section_id FROM learn_sections WHERE subject_key = ?",
                (subject_key,),
            ).fetchall()
        }
        n = 2
        while section_id in existing_ids:
            section_id = f"{base_id}-{n}"
            n += 1

        fs_meta = _fs_subject_meta(subject_key)
        if fs_meta and not subject_title:
            subject_title = fs_meta.get("title")
        if fs_meta and not subject_description:
            subject_description = fs_meta.get("description")

        if not subject_title:
            subject_title = subject_key.replace("-", " ").title()
        if not subject_description and grade and curriculum:
            subject_description = f"Grade {grade} · {curriculum}"

        created_at = datetime.now(timezone.utc).isoformat()
        sort_row = conn.execute(
            "SELECT COALESCE(MAX(sort_order), -1) FROM learn_sections WHERE subject_key = ?",
            (subject_key,),
        ).fetchone()
        sort_order = int(sort_row[0]) + 1
        conn.execute(
            """
            INSERT INTO learn_sections (
                subject_key, section_id, title, markdown,
                group_id, group_title, subject_title, subject_description,
                grade, curriculum, created_at, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                subject_key,
                section_id,
                section_title,
                markdown,
                (group_id or "main").strip() or "main",
                (group_title or "").strip(),
                subject_title,
                subject_description,
                grade,
                (curriculum or "").strip() or None,
                created_at,
                sort_order,
            ),
        )
        if subject_title or subject_description:
            conn.execute(
                """
                UPDATE learn_sections
                SET subject_title = ?, subject_description = ?
                WHERE subject_key = ?
                """,
                (subject_title, subject_description, subject_key),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "subject_key": subject_key,
        "section_id": section_id,
        "title": section_title,
        "learn_url": f"/student/learn/{subject_key}#{section_id}",
    }


def update_learn_section(
    *,
    subject_key: str,
    section_id: str,
    title: str,
    markdown: str,
) -> dict:
    subject_key = subject_key.strip().lower()
    section_id = section_id.strip().lower()
    title = (title or "").strip()
    markdown = (markdown or "").strip()
    if not title:
        raise ValueError("Section title is required.")
    if not markdown:
        raise ValueError("Markdown content is required.")

    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id FROM learn_sections
            WHERE subject_key = ? AND section_id = ?
            """,
            (subject_key, section_id),
        ).fetchone()
        if not row:
            raise ValueError("Learning resource not found or not editable.")

        existing_ids = {
            row[0]
            for row in conn.execute(
                "SELECT section_id FROM learn_sections WHERE subject_key = ?",
                (subject_key,),
            ).fetchall()
        }
        base_id = _slugify(title)
        next_section_id = section_id
        if base_id and base_id != section_id:
            candidate = base_id
            n = 2
            while candidate in existing_ids and candidate != section_id:
                candidate = f"{base_id}-{n}"
                n += 1
            if candidate not in existing_ids or candidate == section_id:
                next_section_id = candidate

        conn.execute(
            """
            UPDATE learn_sections
            SET section_id = ?, title = ?, markdown = ?
            WHERE subject_key = ? AND section_id = ?
            """,
            (next_section_id, title, markdown, subject_key, section_id),
        )
        conn.commit()
        section_id = next_section_id
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "subject_key": subject_key,
        "section_id": section_id,
        "title": title,
        "learn_url": f"/student/learn/{subject_key}#{section_id}",
    }


def delete_learn_section(*, subject_key: str, section_id: str) -> dict:
    subject_key = subject_key.strip().lower()
    section_id = section_id.strip().lower()

    conn = db.connect()
    try:
        row = conn.execute(
            """
            SELECT id FROM learn_sections
            WHERE subject_key = ? AND section_id = ?
            """,
            (subject_key, section_id),
        ).fetchone()
        if not row:
            raise ValueError("Learning resource not found or not deletable.")

        conn.execute(
            "DELETE FROM learn_sections WHERE subject_key = ? AND section_id = ?",
            (subject_key, section_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {"subject_key": subject_key, "section_id": section_id}


def reorder_learn_sections(*, subject_key: str, section_ids: list[str]) -> dict:
    subject_key = subject_key.strip().lower()
    ordered = [sid.strip().lower() for sid in section_ids if (sid or "").strip()]
    if not ordered:
        raise ValueError("Section order is required.")
    if len(set(ordered)) != len(ordered):
        raise ValueError("Duplicate sections in order list.")

    conn = db.connect()
    try:
        db_ids = {
            row[0]
            for row in conn.execute(
                "SELECT section_id FROM learn_sections WHERE subject_key = ?",
                (subject_key,),
            ).fetchall()
        }
        if not db_ids:
            raise ValueError("No published sections found for this collection.")
        if set(ordered) != db_ids:
            raise ValueError(
                "Section order must include every published section in this collection."
            )
        for index, section_id in enumerate(ordered):
            conn.execute(
                """
                UPDATE learn_sections
                SET sort_order = ?
                WHERE subject_key = ? AND section_id = ?
                """,
                (index, subject_key, section_id),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {"subject_key": subject_key, "section_ids": ordered}


def _load_section(subj_dir: Path, sec: dict) -> dict | None:
    fid = sec.get("file")
    if not fid:
        return None
    path = subj_dir / fid
    if not path.is_file():
        return None
    body = path.read_text(encoding="utf-8")
    sid = sec.get("id", Path(fid).stem)
    return {
        "id": sid,
        "title": sec.get("title", sid),
        "markdown": body,
        "source": "file",
    }


def _load_fs_subject(subject: str) -> dict | None:
    subj_dir = LEARN_DIR / subject.strip().lower()
    man_path = subj_dir / "manifest.json"
    if not man_path.exists():
        return None
    with open(man_path, encoding="utf-8") as f:
        manifest = json.load(f)

    groups_out: list[dict] = []
    flat_sections: list[dict] = []

    raw_groups = manifest.get("groups")
    if raw_groups:
        for g in raw_groups:
            gid = (g.get("id") or "").strip()
            gtitle = (g.get("title") or "").strip()
            bucket: list[dict] = []
            for sec in g.get("sections", []):
                loaded = _load_section(subj_dir, sec)
                if not loaded:
                    continue
                loaded = {**loaded, "group_id": gid, "group_title": gtitle, "source": "file"}
                bucket.append(loaded)
                flat_sections.append(loaded)
            if bucket:
                groups_out.append({"id": gid, "title": gtitle, "sections": bucket})
    else:
        for sec in manifest.get("sections", []):
            loaded = _load_section(subj_dir, sec)
            if loaded:
                loaded = {**loaded, "source": "file"}
                flat_sections.append(loaded)
        if flat_sections:
            groups_out.append(
                {"id": "", "title": "", "sections": flat_sections},
            )

    return {
        "key": subj_dir.name,
        "title": manifest.get("title", subject),
        "description": manifest.get("description", ""),
        "groups": groups_out,
        "sections": flat_sections,
    }


def _learn_subject_matches_worksheet(learn_key: str, worksheet_subject: str) -> bool:
    worksheet_subject = (worksheet_subject or "").strip().lower()
    learn_key = (learn_key or "").strip().lower()
    if not worksheet_subject or not learn_key:
        return False
    return learn_key == worksheet_subject or learn_key.startswith(f"{worksheet_subject}-")


def list_learn_link_options(worksheet_subject: str) -> list[dict]:
    """Flatten learn sections for worksheets whose subject matches a collection key."""
    worksheet_subject = (worksheet_subject or "").strip().lower()
    if not worksheet_subject:
        return []

    options: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for meta in list_subjects():
        subject_key = meta["key"]
        if not _learn_subject_matches_worksheet(subject_key, worksheet_subject):
            continue
        subject_data = get_subject(subject_key)
        if not subject_data:
            continue
        subject_title = subject_data.get("title") or subject_key
        for section in subject_data.get("sections") or []:
            section_id = (section.get("id") or "").strip().lower()
            if not section_id:
                continue
            pair = (subject_key, section_id)
            if pair in seen:
                continue
            seen.add(pair)
            section_title = section.get("title") or section_id
            options.append(
                {
                    "learn_subject": subject_key,
                    "learn_section": section_id,
                    "label": f"{subject_title} › {section_title}",
                }
            )
    options.sort(key=lambda item: item["label"].lower())
    return options


def get_subject(subject: str) -> dict | None:
    subject = subject.strip().lower()
    data = _load_fs_subject(subject)
    if data:
        _merge_db_sections(subject, data["groups"], data["sections"])
        return data

    catalog = _db_subject_catalog()
    db_secs = _db_sections(subject)
    if subject not in catalog and not db_secs:
        return None

    meta = catalog.get(
        subject,
        {"key": subject, "title": subject.replace("-", " ").title(), "description": ""},
    )
    groups_out: list[dict] = []
    flat_sections: list[dict] = []
    _merge_db_sections(subject, groups_out, flat_sections)
    if not flat_sections:
        return None

    return {
        "key": subject,
        "title": meta.get("title", subject),
        "description": meta.get("description", ""),
        "groups": groups_out,
        "sections": flat_sections,
    }
