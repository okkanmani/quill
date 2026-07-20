#!/usr/bin/env python3
"""Seed learn_sections with quick-brown-fox filler for pagination testing."""

from __future__ import annotations

import argparse

import db
from learn_content import publish_learn_section

SUBJECT_KEY = "math-ontario-g6"
SUBJECT_TITLE = "Math"
SUBJECT_DESCRIPTION = "Grade 6 · Ontario (test material)"


def fox_lines(line_count: int) -> str:
    sentence = (
        "The quick brown fox jumps over the lazy dog while "
        "five dozen liquor jugs pack my box with bright vexed worms."
    )
    return "\n".join(f"{index + 1}. {sentence}" for index in range(line_count))


def fox_section(title: str, line_count: int, *, heading: str) -> str:
    body = fox_lines(line_count)
    return f"# {heading}\n\n{body}\n"


def clear_collection(subject_key: str, *, admin_id: int) -> int:
    conn = db.connect()
    try:
        cur = conn.execute(
            "DELETE FROM learn_sections WHERE subject_key = ? AND admin_id = ?",
            (subject_key, admin_id),
        )
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


def seed(*, replace: bool, admin_id: int) -> None:
    if replace:
        removed = clear_collection(SUBJECT_KEY, admin_id=admin_id)
        if removed:
            print(f"Removed {removed} existing row(s) for {SUBJECT_KEY}.")

    sections = [
        ("fox-intro", "Fox intro", fox_section("Fox intro", 24, heading="Warm-up"), 24),
        (
            "fox-long-read",
            "Fox long read",
            fox_section("Fox long read", 96, heading="Long practice read"),
            96,
        ),
        (
            "fox-appendix",
            "Fox appendix",
            fox_section("Fox appendix", 44, heading="Extra examples"),
            44,
        ),
    ]

    for section_id_hint, title, markdown, line_count in sections:
        result = publish_learn_section(
            subject_key=SUBJECT_KEY,
            section_title=title,
            markdown=markdown,
            subject_title=SUBJECT_TITLE,
            subject_description=SUBJECT_DESCRIPTION,
            grade=6,
            curriculum="Ontario",
            admin_id=admin_id,
        )
        print(
            f"Published {result['title']} ({line_count} lines) → "
            f"{result['learn_url']}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete existing sections for the test collection first.",
    )
    args = parser.parse_args()
    db.init_schema()
    conn = db.connect()
    try:
        default_admin = conn.execute("SELECT MIN(id) AS id FROM admins").fetchone()
        admin_id = int(default_admin["id"]) if default_admin and default_admin["id"] is not None else 1
    finally:
        conn.close()
    seed(replace=args.replace, admin_id=admin_id)
    print(f"\nOpen /student/learn/{SUBJECT_KEY} to preview line-based pages.")


if __name__ == "__main__":
    main()
