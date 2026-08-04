#!/usr/bin/env python3
"""One-time fix for ENCR-coded reading-comprehension worksheets.

Usage:
  cd backend && .venv/bin/python scripts/recode_misclassified_english_rc.py
  cd backend && .venv/bin/python scripts/recode_misclassified_english_rc.py --apply
  cd backend && .venv/bin/python scripts/recode_misclassified_english_rc.py --admin-id 1 --apply

Defaults to dry-run. Use --apply to write changes.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import db
from admin_resource_codes import (  # noqa: E402
    _default_admin_id,
    recode_misclassified_english_rc_worksheets,
)


def _admin_ids(conn, explicit: int | None) -> list[int]:
    if explicit is not None:
        return [explicit]
    rows = conn.execute(
        """
        SELECT DISTINCT COALESCE(admin_id, ?) AS admin_id FROM worksheets
        UNION
        SELECT DISTINCT COALESCE(admin_id, ?) AS admin_id FROM learn_sections
        """,
        (_default_admin_id(conn), _default_admin_id(conn)),
    ).fetchall()
    ids = sorted({int(row["admin_id"]) for row in rows if row["admin_id"] is not None})
    return ids or [_default_admin_id(conn)]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Recode ENCR-* admin codes to ENRC-* for reading-comprehension worksheets."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes (default is dry-run).",
    )
    parser.add_argument(
        "--admin-id",
        type=int,
        default=None,
        help="Limit to one admin tenant (default: all admins with content).",
    )
    args = parser.parse_args()

    conn = db.connect()
    try:
        totals = {"count": 0, "changes": []}
        for admin_id in _admin_ids(conn, args.admin_id):
            result = recode_misclassified_english_rc_worksheets(
                conn,
                admin_id,
                dry_run=not args.apply,
            )
            totals["count"] += result["count"]
            for change in result["changes"]:
                totals["changes"].append({**change, "admin_id": admin_id})

        if args.apply:
            conn.commit()
            print(f"Applied {totals['count']} recode(s).")
        else:
            print(f"Dry run: {totals['count']} worksheet(s) would be recoded.")
            if totals["count"] == 0:
                print("Nothing to do.")
            else:
                print("Re-run with --apply to update production codes.")

        if totals["changes"]:
            print(json.dumps(totals["changes"], indent=2))
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
