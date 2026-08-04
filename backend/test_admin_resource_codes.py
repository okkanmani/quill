import sqlite3
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import db
from admin_resource_codes import (
    ADMIN_CODE_RE,
    allocate_admin_code,
    ensure_admin_resource_code_schema,
    format_admin_code,
    preview_admin_code,
    recode_misclassified_english_rc_worksheets,
    subject_to_code,
)
from worksheets import infer_english_type_from_worksheet_content


class AdminResourceCodesTest(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self._db_path = Path(self._tmpdir.name) / "test.db"
        self._patch = patch.object(db, "DB_PATH", self._db_path)
        self._patch.start()
        conn = db.connect()
        try:
            conn.executescript(
                """
                CREATE TABLE admins (id INTEGER PRIMARY KEY, username TEXT NOT NULL);
                INSERT INTO admins (id, username) VALUES (1, 'admin');
                CREATE TABLE worksheets (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    scratchpad INTEGER NOT NULL DEFAULT 1,
                    passages TEXT NOT NULL DEFAULT '[]',
                    sort_ts INTEGER NOT NULL DEFAULT 0,
                    is_timed INTEGER NOT NULL DEFAULT 0,
                    is_test INTEGER NOT NULL DEFAULT 0,
                    english_type TEXT,
                    admin_id INTEGER,
                    admin_code TEXT
                );
                CREATE TABLE worksheet_questions (
                    worksheet_id TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    payload TEXT NOT NULL
                );
                CREATE TABLE learn_sections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subject_key TEXT NOT NULL,
                    section_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    markdown TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    admin_id INTEGER
                );
                """
            )
            conn.commit()
        finally:
            conn.close()
        conn = db.connect()
        try:
            ensure_admin_resource_code_schema(conn)
            conn.commit()
        finally:
            conn.close()

    def tearDown(self):
        self._patch.stop()
        self._tmpdir.cleanup()

    def test_subject_to_code_normalizes_keys(self):
        self.assertEqual(subject_to_code("math"), "MATH")
        self.assertEqual(subject_to_code("english"), "ENCR")
        self.assertEqual(subject_to_code("science"), "SCIE")
        self.assertEqual(subject_to_code("data"), "DATA")
        self.assertEqual(subject_to_code("social studies"), "SOCS")
        self.assertEqual(subject_to_code("social-studies"), "SOCS")
        self.assertEqual(subject_to_code("general"), "GENR")
        self.assertEqual(subject_to_code("math-g5-ncert"), "MATH")

    def test_format_admin_code(self):
        self.assertEqual(format_admin_code("MATH", "WS", 42), "MATH-WS-0042")
        self.assertEqual(
            format_admin_code("MATH", "WS", 42, timed_suffix=True),
            "MATH-WS-0042T",
        )

    def test_allocate_sequential_worksheet_codes(self):
        conn = db.connect()
        try:
            ws = allocate_admin_code(conn, 1, "math", is_test=False, is_timed=False)
            ts = allocate_admin_code(conn, 1, "math", is_test=True)
            timed = allocate_admin_code(conn, 1, "math", is_timed=True)
            lr = allocate_admin_code(conn, 1, "math", for_learn=True)
            conn.commit()
        finally:
            conn.close()
        self.assertEqual(ws, "MATH-WS-0001")
        self.assertEqual(ts, "MATH-TS-0001")
        self.assertEqual(timed, "MATH-WS-0002T")
        self.assertEqual(lr, "MATH-LR-0001")
        self.assertTrue(ADMIN_CODE_RE.fullmatch(ws))
        self.assertTrue(ADMIN_CODE_RE.fullmatch(timed))

    def test_subject_to_code_english_types(self):
        self.assertEqual(subject_to_code("english"), "ENCR")
        self.assertEqual(
            subject_to_code("english", english_type="critical_reasoning"), "ENCR"
        )
        self.assertEqual(
            subject_to_code("english", english_type="reading_comprehension"), "ENRC"
        )

    def test_preview_admin_code(self):
        conn = db.connect()
        try:
            preview = preview_admin_code(conn, 1, "math", is_test=False, is_timed=False)
            conn.commit()
        finally:
            conn.close()
        self.assertEqual(preview, "MATH-WS-0001")

    def test_backfill_assigns_missing_codes(self):
        conn = db.connect()
        try:
            conn.execute(
                """
                INSERT INTO worksheets
                    (id, title, subject, is_timed, is_test, admin_id, sort_ts, english_type)
                VALUES ('questions_1', 'A', 'math', 0, 0, 1, 1, NULL),
                       ('questions_2', 'B', 'english', 1, 0, 1, 2, 'reading_comprehension'),
                       ('questions_3', 'C', 'english', 0, 1, 1, 3, 'critical_reasoning')
                """
            )
            conn.execute(
                """
                INSERT INTO learn_sections
                    (subject_key, section_id, title, markdown, created_at, admin_id)
                VALUES ('science', 'intro', 'Intro', 'Hello', '2026-01-01', 1)
                """
            )
            conn.commit()
            from admin_resource_codes import backfill_admin_codes

            backfill_admin_codes(conn)
            conn.commit()
            rows = conn.execute(
                "SELECT id, admin_code FROM worksheets ORDER BY sort_ts"
            ).fetchall()
            self.assertEqual(rows[0]["admin_code"], "MATH-WS-0001")
            self.assertEqual(rows[1]["admin_code"], "ENRC-WS-0001T")
            self.assertEqual(rows[2]["admin_code"], "ENCR-TS-0001")
            learn = conn.execute(
                "SELECT admin_code FROM learn_sections WHERE section_id = 'intro'"
            ).fetchone()
            self.assertEqual(learn["admin_code"], "SCIE-LR-0001")
        finally:
            conn.close()

    def test_infer_reading_comprehension_from_multiple_questions_per_passage(self):
        passages = [{"id": "p1", "title": "Passage", "body": "word " * 120}]
        questions = [
            {"prompt": "Q1", "passage_id": "p1", "type": "multiple_choice"},
            {"prompt": "Q2", "passage_id": "p1", "type": "multiple_choice"},
        ]
        self.assertEqual(
            infer_english_type_from_worksheet_content(
                subject="english", passages=passages, questions=questions
            ),
            "reading_comprehension",
        )

    def test_backfill_infers_enrc_for_legacy_rc_worksheet(self):
        conn = db.connect()
        try:
            passages = json.dumps([{"id": "p1", "title": "Passage", "body": "word " * 120}])
            conn.execute(
                """
                INSERT INTO worksheets
                    (id, title, subject, is_timed, is_test, admin_id, sort_ts, english_type, passages)
                VALUES ('questions_rc_legacy', 'Legacy RC', 'english', 0, 0, 1, 1, NULL, ?)
                """,
                (passages,),
            )
            conn.execute(
                """
                INSERT INTO worksheet_questions (worksheet_id, sort_order, payload)
                VALUES
                    ('questions_rc_legacy', 0, '{"prompt":"Q1","passage_id":"p1","type":"multiple_choice"}'),
                    ('questions_rc_legacy', 1, '{"prompt":"Q2","passage_id":"p1","type":"multiple_choice"}')
                """
            )
            conn.commit()
            from admin_resource_codes import backfill_admin_codes

            backfill_admin_codes(conn)
            conn.commit()
            row = conn.execute(
                """
                SELECT admin_code, english_type FROM worksheets WHERE id = 'questions_rc_legacy'
                """
            ).fetchone()
            self.assertEqual(row["admin_code"], "ENRC-WS-0001")
            self.assertEqual(row["english_type"], "reading_comprehension")
        finally:
            conn.close()

    def test_recode_misclassified_english_rc_worksheet(self):
        conn = db.connect()
        try:
            passages = json.dumps([{"id": "p1", "title": "Passage", "body": "word " * 120}])
            conn.execute(
                """
                INSERT INTO worksheets
                    (id, title, subject, is_timed, is_test, admin_id, sort_ts, english_type, passages, admin_code)
                VALUES ('questions_rc_wrong', 'Wrong code', 'english', 0, 0, 1, 1, NULL, ?, 'ENCR-WS-0099')
                """,
                (passages,),
            )
            conn.execute(
                """
                INSERT INTO worksheet_questions (worksheet_id, sort_order, payload)
                VALUES
                    ('questions_rc_wrong', 0, '{"prompt":"Q1","passage_id":"p1","type":"multiple_choice"}'),
                    ('questions_rc_wrong', 1, '{"prompt":"Q2","passage_id":"p1","type":"multiple_choice"}')
                """
            )
            conn.commit()
            preview = recode_misclassified_english_rc_worksheets(conn, 1, dry_run=True)
            self.assertEqual(preview["count"], 1)
            self.assertEqual(preview["changes"][0]["old_code"], "ENCR-WS-0099")

            result = recode_misclassified_english_rc_worksheets(conn, 1, dry_run=False)
            conn.commit()
            row = conn.execute(
                """
                SELECT admin_code, english_type FROM worksheets WHERE id = 'questions_rc_wrong'
                """
            ).fetchone()
            self.assertEqual(result["count"], 1)
            self.assertTrue(str(row["admin_code"]).startswith("ENRC-WS-"))
            self.assertEqual(row["english_type"], "reading_comprehension")
        finally:
            conn.close()


if __name__ == "__main__":
    unittest.main()
