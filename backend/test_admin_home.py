import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import db
from admin_home import _recent_activity_for_student
from composite_tests import create_composite_test, start_composite_attempt, submit_composite
from tests import get_or_start_test_session, save_test_answer, submit_test


def _seed(admin_id: int, student_name: str) -> None:
    conn = db.connect()
    try:
        student_row = conn.execute(
            "SELECT name FROM students WHERE admin_id = ? AND name = ?",
            (admin_id, student_name),
        ).fetchone()
        if not student_row:
            conn.execute(
                """
                INSERT INTO students (admin_id, name, password_hash)
                VALUES (?, ?, 'hash')
                """,
                (admin_id, student_name),
            )
        for ws_id, title in (
            ("test-math", "Math test"),
            ("test-engl", "English test"),
        ):
            if conn.execute(
                "SELECT 1 FROM worksheets WHERE id = ?", (ws_id,)
            ).fetchone():
                continue
            conn.execute(
                """
                INSERT INTO worksheets (
                    id, title, subject, scratchpad, passages, sort_ts,
                    is_timed, time_limit_minutes, is_test, test_sitting_count,
                    test_adaptive, admin_id
                )
                VALUES (?, ?, 'math', 1, '[]', 0, 1, 30, 1, 1, 0, ?)
                """,
                (ws_id, title, admin_id),
            )
            conn.execute(
                """
                INSERT INTO worksheet_questions (worksheet_id, sort_order, payload)
                VALUES (?, 0, ?)
                """,
                (
                    ws_id,
                    json.dumps(
                        {
                            "id": f"{ws_id}-q1",
                            "prompt": "Sample?",
                            "choices": ["A", "B", "C"],
                            "answer": "A",
                        }
                    ),
                ),
            )
        conn.commit()
    finally:
        conn.close()


class AdminHomeRecentActivityTest(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self._db_path = Path(self._tmpdir.name) / "test.db"
        self._patch = patch.object(db, "DB_PATH", self._db_path)
        self._patch.start()
        db.init_schema()
        conn = db.connect()
        try:
            admin_row = conn.execute(
                "SELECT id FROM admins ORDER BY id LIMIT 1"
            ).fetchone()
            if admin_row:
                self.admin_id = int(admin_row["id"])
            else:
                conn.execute(
                    "INSERT INTO admins (name, password_hash) VALUES ('admin', 'hash')"
                )
                self.admin_id = int(
                    conn.execute("SELECT last_insert_rowid()").fetchone()[0]
                )
            conn.commit()
        finally:
            conn.close()
        self.student_name = "Alex"
        _seed(self.admin_id, self.student_name)

    def tearDown(self):
        self._patch.stop()
        self._tmpdir.cleanup()

    def test_composite_submit_shows_one_activity_entry(self):
        created = create_composite_test(
            self.admin_id,
            title="Benchmark",
            section_worksheet_ids=["test-math", "test-engl"],
        )
        hub = start_composite_attempt(self.student_name, created["id"])
        attempt_id = hub["attempt_id"]

        for ws_id in ("test-math", "test-engl"):
            get_or_start_test_session(
                self.student_name,
                ws_id,
                resume=True,
                composite_attempt_id=attempt_id,
            )
            save_test_answer(
                self.student_name,
                ws_id,
                slot=1,
                given="A",
                composite_attempt_id=attempt_id,
            )
            submit_test(
                self.student_name,
                ws_id,
                composite_attempt_id=attempt_id,
            )

        submit_composite(self.student_name, created["id"])

        conn = db.connect()
        try:
            activity = _recent_activity_for_student(conn, self.student_name, limit=20)
        finally:
            conn.close()

        kinds = [item["kind"] for item in activity]
        self.assertEqual(kinds.count("composite_test_completed"), 1)
        self.assertNotIn("test_completed", kinds)

    def test_hides_standalone_duplicate_when_composite_section_exists(self):
        created = create_composite_test(
            self.admin_id,
            title="Benchmark",
            section_worksheet_ids=["test-math", "test-engl"],
        )

        get_or_start_test_session(self.student_name, "test-math", resume=True)
        save_test_answer(self.student_name, "test-math", slot=1, given="A")
        submit_test(self.student_name, "test-math")

        hub = start_composite_attempt(self.student_name, created["id"])
        attempt_id = hub["attempt_id"]
        get_or_start_test_session(
            self.student_name,
            "test-math",
            resume=True,
            composite_attempt_id=attempt_id,
        )
        save_test_answer(
            self.student_name,
            "test-math",
            slot=1,
            given="A",
            composite_attempt_id=attempt_id,
        )
        submit_test(
            self.student_name,
            "test-math",
            composite_attempt_id=attempt_id,
        )
        get_or_start_test_session(
            self.student_name,
            "test-engl",
            resume=True,
            composite_attempt_id=attempt_id,
        )
        save_test_answer(
            self.student_name,
            "test-engl",
            slot=1,
            given="A",
            composite_attempt_id=attempt_id,
        )
        submit_test(
            self.student_name,
            "test-engl",
            composite_attempt_id=attempt_id,
        )
        submit_composite(self.student_name, created["id"])

        conn = db.connect()
        try:
            activity = _recent_activity_for_student(conn, self.student_name, limit=20)
        finally:
            conn.close()

        test_titles = [
            item["title"]
            for item in activity
            if item["kind"] == "test_completed"
        ]
        self.assertNotIn("Math test", test_titles)
        composite = next(
            item for item in activity if item["kind"] == "composite_test_completed"
        )
        self.assertEqual(composite["title"], "Benchmark")


if __name__ == "__main__":
    unittest.main()
