"""RC adaptive v2: stratified question composition and weighted routing."""

import random
import unittest

from rc_adaptive_picking import (
    RULE_COMPLEX_T2_T3_MIX,
    RULE_COMPLEX_T3_ONLY,
    RULE_EASY_T1_ONLY,
    RULE_EASY_T2_ONLY,
    RULE_START_EASY_HEAVY_T2,
    pick_rc_questions_composed,
    resolve_rc_v2_slot_plan,
)
from tests import (
    RC_PASSAGE_COMPLEX,
    RC_PASSAGE_EASY,
    _assign_through_slot_rc_v2,
    _build_rc_passage_answer,
    _question_lookup,
    _question_tier,
    _uses_rc_adaptive_v2,
    _weighted_test_score,
    validate_test_worksheet_data,
)


def _sample_worksheet():
    return {
        "subject": "english",
        "english_type": "reading_comprehension",
        "is_test": True,
        "test_adaptive": True,
        "test_sitting_count": 2,
        "test_rc_questions_per_passage": 4,
        "timed": True,
        "time_limit_minutes": 25,
        "passages": [
            {"id": "easy_a", "tier": 1, "title": "Easy A", "text": "Body " * 40},
            {"id": "easy_b", "tier": 1, "title": "Easy B", "text": "Body " * 40},
            {"id": "complex_a", "tier": 2, "title": "Complex A", "text": "Body " * 40},
            {"id": "complex_b", "tier": 2, "title": "Complex B", "text": "Body " * 40},
        ],
        "questions": [],
    }


def _add_bank(ws, passage_id, tiers):
    for i, star in enumerate(tiers, start=1):
        ws["questions"].append(
            {
                "id": f"{passage_id}_q{i}",
                "passage_id": passage_id,
                "stars": star,
                "prompt": f"Q{i}",
                "answer": "A",
                "choices": ["A", "B", "C", "D"],
                "area": "main idea",
            }
        )


def _balanced_banks(ws):
    _add_bank(ws, "easy_a", [1, 1, 2, 2, 1, 2, 2, 1])
    _add_bank(ws, "easy_b", [1, 2, 1, 2, 2, 1, 2, 1])
    _add_bank(ws, "complex_a", [2, 2, 3, 3, 2, 3, 2, 3])
    _add_bank(ws, "complex_b", [2, 3, 2, 3, 3, 2, 3, 2])


class RcAdaptiveV2Test(unittest.TestCase):
    def test_rc_v2_validation_and_assignment(self):
        ws = _sample_worksheet()
        _balanced_banks(ws)

        self.assertTrue(_uses_rc_adaptive_v2(ws))
        self.assertEqual(validate_test_worksheet_data(ws), [])

        sequence = [None, None]
        rng = random.Random(42)
        sequence = _assign_through_slot_rc_v2(
            sequence, {}, ws, 2, 1, rng, adaptive=True
        )
        self.assertEqual(len(sequence[0]["question_ids"]), 4)
        self.assertEqual(sequence[0]["tier"], RC_PASSAGE_EASY)
        self.assertEqual(sequence[0]["composition_rule"], RULE_START_EASY_HEAVY_T2)

    def test_resolve_rc_v2_slot_plan_thresholds(self):
        self.assertEqual(
            resolve_rc_v2_slot_plan(slot=1, prev_answer=None),
            (RC_PASSAGE_EASY, RULE_START_EASY_HEAVY_T2),
        )

        low = {"weighted_pct": 0.40}
        self.assertEqual(
            resolve_rc_v2_slot_plan(slot=2, prev_answer=low),
            (RC_PASSAGE_EASY, RULE_EASY_T1_ONLY),
        )

        mid = {"weighted_pct": 0.65}
        self.assertEqual(
            resolve_rc_v2_slot_plan(slot=2, prev_answer=mid),
            (RC_PASSAGE_EASY, RULE_EASY_T2_ONLY),
        )

        high = {"weighted_pct": 0.80}
        self.assertEqual(
            resolve_rc_v2_slot_plan(slot=2, prev_answer=high),
            (RC_PASSAGE_COMPLEX, RULE_COMPLEX_T2_T3_MIX),
        )

        top = {"weighted_pct": 0.90}
        self.assertEqual(
            resolve_rc_v2_slot_plan(slot=2, prev_answer=top),
            (RC_PASSAGE_COMPLEX, RULE_COMPLEX_T3_ONLY),
        )

    def test_pick_rc_questions_composed_start_heavy_t2(self):
        ws = _sample_worksheet()
        _add_bank(ws, "easy_a", [1, 1, 2, 2, 1, 2, 2, 1])
        qmap = {"easy_a": ws["questions"]}
        rng = random.Random(7)
        ids, meta = pick_rc_questions_composed(
            "easy_a",
            4,
            qmap,
            lambda q: _question_tier(q, ws),
            passage_tier=RC_PASSAGE_EASY,
            composition_rule=RULE_START_EASY_HEAVY_T2,
            rng=rng,
        )
        self.assertEqual(len(ids), 4)
        self.assertEqual(meta["actual_tier_counts"]["2"], 3)
        self.assertEqual(meta["actual_tier_counts"]["1"], 1)
        self.assertFalse(meta["fallback_used"])

    def test_pick_rc_questions_composed_fallback_when_uneven_bank(self):
        ws = _sample_worksheet()
        _add_bank(ws, "easy_a", [2, 2, 2, 2, 2, 2, 2, 1])
        qmap = {"easy_a": ws["questions"]}
        rng = random.Random(3)
        ids, meta = pick_rc_questions_composed(
            "easy_a",
            4,
            qmap,
            lambda q: _question_tier(q, ws),
            passage_tier=RC_PASSAGE_EASY,
            composition_rule=RULE_EASY_T1_ONLY,
            rng=rng,
        )
        self.assertEqual(len(ids), 4)
        self.assertTrue(meta["fallback_used"])
        self.assertEqual(meta["actual_tier_counts"]["1"], 1)
        self.assertEqual(meta["actual_tier_counts"]["2"], 3)

    def test_rc_v2_weighted_scoring(self):
        ws = _sample_worksheet()
        _balanced_banks(ws)

        entry = {
            "passage_id": "easy_a",
            "tier": 1,
            "question_ids": ["easy_a_q1", "easy_a_q2", "easy_a_q3", "easy_a_q4"],
        }
        responses = {
            "easy_a_q1": "A",
            "easy_a_q2": "A",
            "easy_a_q3": "A",
            "easy_a_q4": "B",
        }
        answer = _build_rc_passage_answer(entry, responses, _question_lookup(ws), ws)
        weighted, maximum = _weighted_test_score(
            ws, [entry], {"1": answer}, sitting_count=1
        )
        self.assertGreater(answer["weighted_pct"], 0)
        self.assertLess(weighted, maximum)


if __name__ == "__main__":
    unittest.main()
