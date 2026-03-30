"""Import worksheets from JSON into SQLite (optional tooling — app seeds only if DB is empty)."""

import argparse

from worksheets import (
    init_worksheet_tables,
    merge_worksheets_from_json_files,
    seed_worksheets_from_json_if_empty,
    sync_worksheets_from_json_files,
)

if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Worksheet JSON → SQLite import")
    p.add_argument(
        "--replace-all",
        action="store_true",
        help="Delete ALL worksheets in the DB, then import every JSON file (destructive).",
    )
    p.add_argument(
        "--merge",
        action="store_true",
        help="Upsert each JSON file by id; leave other worksheets in the DB unchanged.",
    )
    args = p.parse_args()

    init_worksheet_tables()
    if args.replace_all:
        sync_worksheets_from_json_files()
        print("Replaced all worksheets from JSON.")
    elif args.merge:
        merge_worksheets_from_json_files()
        print("Merged worksheets from JSON (upsert per file).")
    else:
        if seed_worksheets_from_json_if_empty():
            print("Database was empty — imported worksheets from JSON.")
        else:
            print("Database already has worksheets — skipped import. Use --merge or --replace-all.")
