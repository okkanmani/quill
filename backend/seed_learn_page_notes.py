#!/usr/bin/env python3
"""Seed sample learn page notes for local UI testing (no OpenAI key required)."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

import db
from learn_content import get_subject

LINES_PER_PAGE = 38
DEFAULT_STUDENT = "Yayien"
DEFAULT_SUBJECT = "math-ontario-g6"


def split_markdown_by_lines(markdown: str, lines_per_page: int = LINES_PER_PAGE) -> list[str]:
    text = (markdown or "").replace("\r\n", "\n")
    if not text.strip():
        return []

    lines = text.split("\n")
    pages: list[str] = []
    start = 0

    while start < len(lines):
        end = min(start + lines_per_page, len(lines))
        if end < len(lines):
            min_break = start + max(1, int(lines_per_page * 0.65))
            break_at = end
            for i in range(end - 1, min_break - 1, -1):
                if lines[i].strip() == "":
                    break_at = i + 1
                    break
            end = break_at

        chunk = "\n".join(lines[start:end]).strip()
        if chunk:
            pages.append(chunk)

        start = end
        while start < len(lines) and lines[start].strip() == "":
            start += 1

    return pages if pages else [text.strip()]


def dummy_body(section_title: str, page_index: int, total_pages: int) -> str:
    page_label = f"page {page_index + 1} of {total_pages}"
    return (
        f"• Sample notes for “{section_title}” ({page_label})\n"
        "• Key idea: practice the steps shown on this page.\n"
        "• Remember: read the examples carefully before moving on.\n"
        "• Tip: try explaining this page out loud in your own words."
    )


def seed_notes(
    *,
    student: str,
    subject_key: str,
    mark_ai_used: bool,
    replace: bool,
) -> int:
    db.init_schema()
    conn = db.connect()
    try:
        row = conn.execute("SELECT MIN(id) AS id FROM admins").fetchone()
        admin_id = int(row["id"]) if row and row["id"] is not None else 1
    finally:
        conn.close()
    subject = get_subject(subject_key, admin_id=admin_id)
    if not subject:
        raise SystemExit(f"Subject not found: {subject_key}")

    groups = subject.get("groups") or []
    if not groups:
        groups = [{"sections": subject.get("sections") or []}]

    saved_at = datetime.now(timezone.utc).isoformat()
    conn = db.connect()
    inserted = 0
    try:
        if replace:
            conn.execute(
                "DELETE FROM learn_page_notes WHERE student = ? AND subject_key = ?",
                (student, subject_key),
            )

        for group in groups:
            for section in group.get("sections") or []:
                section_id = section["id"]
                section_title = section.get("title") or section_id
                chunks = split_markdown_by_lines(section.get("markdown") or "")
                for page_index, _chunk in enumerate(chunks):
                    conn.execute(
                        """
                        INSERT INTO learn_page_notes
                            (student, subject_key, section_id, page_index, body, ai_used, saved_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(student, subject_key, section_id, page_index) DO UPDATE SET
                            body = excluded.body,
                            ai_used = excluded.ai_used,
                            saved_at = excluded.saved_at
                        """,
                        (
                            student,
                            subject_key,
                            section_id,
                            page_index,
                            dummy_body(section_title, page_index, len(chunks)),
                            1 if mark_ai_used else 0,
                            saved_at,
                        ),
                    )
                    inserted += 1
        conn.commit()
    finally:
        conn.close()
    return inserted


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--student", default=DEFAULT_STUDENT)
    parser.add_argument("--subject", default=DEFAULT_SUBJECT)
    parser.add_argument(
        "--ai-used",
        action="store_true",
        help="Mark notes as AI-generated (hides Generate button). Default leaves Generate available.",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace existing notes for this student/subject.",
    )
    args = parser.parse_args()

    count = seed_notes(
        student=args.student.strip(),
        subject_key=args.subject.strip(),
        mark_ai_used=args.ai_used,
        replace=args.replace,
    )
    print(
        f"Seeded {count} note(s) for {args.student!r} on {args.subject!r} "
        f"(ai_used={'yes' if args.ai_used else 'no'})."
    )


if __name__ == "__main__":
    main()
