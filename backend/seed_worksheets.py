"""Load worksheet JSON files into SQLite (same logic as app startup). Run manually if needed."""

from worksheets import init_worksheet_tables, sync_worksheets_from_json_files

if __name__ == "__main__":
    init_worksheet_tables()
    sync_worksheets_from_json_files()
    print("Worksheets synced from JSON to SQLite.")
