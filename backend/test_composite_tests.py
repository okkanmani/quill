import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import db
from composite_tests import (
    create_composite_test,
    delete_composite_test_result,
    get_composite_hub,
    is_worksheet_in_locked_composite,
    list_composite_test_results,
    list_composites_for_student,
    lock_composite_for_admin_students,
    start_composite_attempt,
    submit_composite,
    unlock_composite_for_admin_students,
)
from tests import delete_test_attempt, get_or_start_test_session, list_test_results, list_tests, submit_test


def _seed_test_data() -> tuple[int, str]:
    conn = db.connect()
    try:
        admin_row = conn.execute("SELECT id FROM admins ORDER BY id LIMIT 1").fetchone()
        if not admin_row:
            conn.execute(
                "INSERT INTO admins (name, password_hash) VALUES ('admin', 'hash')"
            )
            admin_id = int(conn.execute("SELECT last_insert_rowid()").fetchone()[0])
        else:
            admin_id = int(admin_row["id"])

        student_name = "Alex"
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

        for ws_id, title, subject in (
            ("test-math", "Math test", "math"),
            ("test-engl", "English test", "english"),
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
                VALUES (?, ?, ?, 1, '[]', 0, 1, 30, 1, 1, 0, ?)
                """,
                (ws_id, title, subject, admin_id),
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
        return admin_id, student_name
    finally:
        conn.close()


class CompositeTestsTest(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self._db_path = Path(self._tmpdir.name) / "test.db"
        self._patch = patch.object(db, "DB_PATH", self._db_path)
        self._patch.start()
        db.init_schema()
        self.admin_id, self.student_name = _seed_test_data()

    def tearDown(self):
        self._patch.stop()
        self._tmpdir.cleanup()

    def test_requires_at_least_two_sections(self):
        with self.assertRaisesRegex(ValueError, "at least two"):
            create_composite_test(
                self.admin_id,
                title="Solo",
                section_worksheet_ids=["test-math"],
            )

    def test_create_composite_and_hub(self):
        created = create_composite_test(
            self.admin_id,
            title="Benchmark",
            section_worksheet_ids=["test-math", "test-engl"],
        )
        self.assertEqual(len(created["sections"]), 2)
        hub = start_composite_attempt(self.student_name, created["id"])
        self.assertTrue(hub["attempt_id"])
        self.assertEqual(len(hub["sections"]), 2)
        self.assertEqual(hub["sections"][0]["status"], "not_started")

    def test_list_composites_for_student(self):
        created = create_composite_test(
            self.admin_id,
            title="Benchmark",
            section_worksheet_ids=["test-math", "test-engl"],
        )
        listed = list_composites_for_student(self.student_name)
        match = next(item for item in listed if item["id"] == created["id"])
        self.assertEqual(match["title"], "Benchmark")
        self.assertEqual(match["section_count"], 2)

    def test_standalone_result_persists_when_composite_starts(self):
        created = create_composite_test(
            self.admin_id,
            title="Benchmark",
            section_worksheet_ids=["test-math", "test-engl"],
        )
        get_or_start_test_session(self.student_name, "test-math", resume=True)
        from tests import list_tests, save_test_answer

        save_test_answer(self.student_name, "test-math", slot=1, given="A")
        submit_test(self.student_name, "test-math")

        standalone = next(
            t for t in list_tests(self.student_name, admin_id=self.admin_id) if t["id"] == "test-math"
        )
        self.assertTrue(standalone["done"])

        hub = start_composite_attempt(self.student_name, created["id"])
        math_section = next(s for s in hub["sections"] if s["worksheet_id"] == "test-math")
        self.assertEqual(math_section["status"], "not_started")

        get_or_start_test_session(
            self.student_name,
            "test-math",
            resume=True,
            composite_attempt_id=hub["attempt_id"],
        )
        save_test_answer(
            self.student_name,
            "test-math",
            slot=1,
            given="A",
            composite_attempt_id=hub["attempt_id"],
        )
        submit_test(self.student_name, "test-math", composite_attempt_id=hub["attempt_id"])

        standalone_after = next(
            t for t in list_tests(self.student_name, admin_id=self.admin_id) if t["id"] == "test-math"
        )
        self.assertTrue(standalone_after["done"])

        hub_after = get_composite_hub(self.student_name, created["id"])
        math_after = next(s for s in hub_after["sections"] if s["worksheet_id"] == "test-math")
        self.assertEqual(math_after["status"], "completed")

    def test_composite_lock_propagates_to_worksheet(self):
        created = create_composite_test(
            self.admin_id,
            title="Benchmark",
            section_worksheet_ids=["test-math", "test-engl"],
        )
        lock_composite_for_admin_students(self.admin_id, created["id"], locked=True)
        self.assertTrue(is_worksheet_in_locked_composite(self.student_name, "test-math"))
        unlock_composite_for_admin_students(self.admin_id, created["id"])
        self.assertFalse(is_worksheet_in_locked_composite(self.student_name, "test-math"))

    def _complete_section(self, worksheet_id: str, composite_attempt_id: int):
        get_or_start_test_session(
            self.student_name,
            worksheet_id,
            resume=True,
            composite_attempt_id=composite_attempt_id,
        )
        from tests import save_test_answer

        save_test_answer(
            self.student_name,
            worksheet_id,
            slot=1,
            given="A",
            composite_attempt_id=composite_attempt_id,
        )
        return submit_test(
            self.student_name,
            worksheet_id,
            composite_attempt_id=composite_attempt_id,
        )

    def test_submit_composite_aggregates_scores_and_reviews(self):
        created = create_composite_test(
            self.admin_id,
            title="Benchmark",
            section_worksheet_ids=["test-math", "test-engl"],
        )
        hub = start_composite_attempt(self.student_name, created["id"])
        attempt_id = hub["attempt_id"]

        with patch("tests._weighted_test_score", return_value=(3.0, 4.0)):
            self._complete_section("test-math", attempt_id)
            self._complete_section("test-engl", attempt_id)

        result = submit_composite(self.student_name, created["id"])
        self.assertTrue(result["completed_at"])
        self.assertEqual(result["overall"]["weighted_score"], 6.0)
        self.assertEqual(result["overall"]["max_weighted_score"], 8.0)

        results = list_composite_test_results(self.student_name)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["sections"][0]["status"], "completed")
        self.assertIn("result", results[0]["sections"][0])
        section_result = results[0]["sections"][0]["result"]
        self.assertEqual(section_result["id"], results[0]["sections"][0]["attempt_id"])
        self.assertTrue(section_result["answers"])

        hub_after = get_composite_hub(self.student_name, created["id"])
        self.assertTrue(hub_after["can_submit"] is False)
        self.assertIsNotNone(hub_after["completed_at"])

    def test_delete_composite_test_result_removes_attempt_and_sections(self):
        created = create_composite_test(
            self.admin_id,
            title="Benchmark",
            section_worksheet_ids=["test-math", "test-engl"],
        )
        hub = start_composite_attempt(self.student_name, created["id"])
        attempt_id = hub["attempt_id"]

        with patch("tests._weighted_test_score", return_value=(3.0, 4.0)):
            self._complete_section("test-math", attempt_id)
            self._complete_section("test-engl", attempt_id)

        submit_composite(self.student_name, created["id"])
        results = list_composite_test_results(self.student_name)
        self.assertEqual(len(results), 1)
        composite_attempt_id = results[0]["id"]

        self.assertTrue(
            delete_composite_test_result(composite_attempt_id, self.student_name)
        )
        self.assertEqual(list_composite_test_results(self.student_name), [])

        conn = db.connect()
        try:
            section_rows = conn.execute(
                "SELECT id FROM test_attempts WHERE composite_attempt_id = ?",
                (composite_attempt_id,),
            ).fetchall()
            self.assertEqual(section_rows, [])
        finally:
            conn.close()

    def test_delete_test_attempt_removes_standalone_result(self):
        get_or_start_test_session(self.student_name, "test-math", resume=True)
        with patch("tests._weighted_test_score", return_value=(2.0, 4.0)):
            from tests import save_test_answer

            save_test_answer(self.student_name, "test-math", slot=1, given="A")
            submit_test(self.student_name, "test-math")

        results = list_test_results(self.student_name)
        self.assertEqual(len(results), 1)
        attempt_id = results[0]["id"]

        self.assertTrue(delete_test_attempt(attempt_id, self.student_name))
        self.assertEqual(list_test_results(self.student_name), [])
        self.assertFalse(delete_test_attempt(attempt_id, self.student_name))


class LegacyTestAttemptsMigrationTest(unittest.TestCase):
    """Simulate staging DB: test_attempts without composite_attempt_id."""

    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self._db_path = Path(self._tmpdir.name) / "test.db"
        self._patch = patch.object(db, "DB_PATH", self._db_path)
        self._patch.start()

    def tearDown(self):
        self._patch.stop()
        self._tmpdir.cleanup()

    def test_init_schema_migrates_legacy_test_attempts(self):
        conn = db.connect()
        try:
            conn.executescript(
                """
                CREATE TABLE worksheets (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    scratchpad INTEGER NOT NULL DEFAULT 1,
                    passages TEXT NOT NULL DEFAULT '[]',
                    sort_ts INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE test_attempts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student TEXT NOT NULL,
                    worksheet_id TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    completed_at TEXT,
                    locked INTEGER NOT NULL DEFAULT 0,
                    sitting_count INTEGER NOT NULL DEFAULT 20,
                    sequence TEXT NOT NULL DEFAULT '[]',
                    answers TEXT NOT NULL DEFAULT '{}',
                    weighted_score REAL,
                    max_weighted_score REAL,
                    duration_seconds INTEGER,
                    analyzed_at TEXT,
                    UNIQUE (student, worksheet_id)
                );
                """
            )
            conn.commit()
        finally:
            conn.close()

        db.init_schema()

        conn = db.connect()
        try:
            cols = {
                row[1] for row in conn.execute("PRAGMA table_info(test_attempts)")
            }
            self.assertIn("composite_attempt_id", cols)
            indexes = {
                row[0]
                for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='test_attempts'"
                )
            }
            self.assertIn("idx_test_attempts_composite", indexes)
            self.assertIn("idx_test_attempts_standalone", indexes)
        finally:
            conn.close()


if __name__ == "__main__":
    unittest.main()
