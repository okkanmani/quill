#!/usr/bin/env python3
"""Delete learn resource images from Tigris (S3-compatible).

Examples (from backend/, with the same env as uvicorn):

  # Dry-run: list objects for one section
  python scripts/purge_learn_assets.py --admin-id 1 --subject math-test-g5 --section test-image

  # Delete all images for that section
  python scripts/purge_learn_assets.py --admin-id 1 --subject math-test-g5 --section test-image --confirm

  # Delete every learn image for a subject (all sections)
  python scripts/purge_learn_assets.py --admin-id 1 --subject math-test-g5 --confirm

  # Custom prefix (must start with learn/<admin_id>/)
  python scripts/purge_learn_assets.py --prefix learn/1/math-test-g5/ --confirm

Load env from .env_local:

  python scripts/purge_learn_assets.py --env-file .env_local --admin-id 1 --subject math-test-g5 --section test-image
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def _load_env_file(path: Path) -> None:
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def main() -> int:
    parser = argparse.ArgumentParser(description="List or delete learn images in Tigris.")
    parser.add_argument("--env-file", type=Path, help="Dotenv file (e.g. .env_local)")
    parser.add_argument("--admin-id", type=int, help="Admin id (learn/ prefix)")
    parser.add_argument("--subject", help="Learn subject_key")
    parser.add_argument("--section", help="Learn section_id (optional; omit to wipe whole subject)")
    parser.add_argument("--prefix", help="Explicit prefix under learn/ (overrides subject/section)")
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Actually delete (default is dry-run list only)",
    )
    args = parser.parse_args()

    if args.env_file:
        _load_env_file(args.env_file)

    from learn_storage import (
        delete_learn_objects_under_prefix,
        learn_section_object_prefix,
        list_learn_object_keys,
        storage_configured,
    )

    if not storage_configured():
        print("Tigris is not configured (BUCKET_NAME, AWS_* env).", file=sys.stderr)
        return 1

    if args.prefix:
        prefix = args.prefix.lstrip("/")
    elif args.admin_id is not None and args.subject:
        subject = args.subject.strip().lower()
        if args.section:
            prefix = learn_section_object_prefix(
                admin_id=args.admin_id,
                subject_key=subject,
                section_id=args.section,
            )
        else:
            prefix = f"learn/{int(args.admin_id)}/{subject}/"
    else:
        parser.error("Provide --prefix or (--admin-id and --subject).")

    keys = list_learn_object_keys(prefix)
    if not keys:
        print(f"No objects under {prefix}")
        return 0

    print(f"{'DELETE' if args.confirm else 'DRY-RUN'} {len(keys)} object(s) under {prefix}:")
    for key in keys:
        print(f"  {key}")

    if not args.confirm:
        print("\nRe-run with --confirm to delete.")
        return 0

    deleted = delete_learn_objects_under_prefix(prefix, require_safe_prefix=True)
    print(f"\nDeleted {deleted} object(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
