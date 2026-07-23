"""RC adaptive v2: easy/complex passages, question banks, weighted thresholds."""

import random

from tests import (
    RC_PASSAGE_COMPLEX,
    RC_PASSAGE_EASY,
    _assign_through_slot_rc_v2,
    _build_rc_passage_answer,
    _next_rc_passage_tier,
    _question_lookup,
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


def _add_bank(ws, passage_id, passage_tier, tiers):
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


def test_rc_v2_validation_and_assignment():
    ws = _sample_worksheet()
    _add_bank(ws, "easy_a", 1, [1, 1, 2, 2, 1, 2, 2, 1])
    _add_bank(ws, "easy_b", 1, [1, 2, 1, 2, 2, 1, 2, 1])
    _add_bank(ws, "complex_a", 2, [2, 2, 3, 3, 2, 3, 2, 3])
    _add_bank(ws, "complex_b", 2, [2, 3, 2, 3, 3, 2, 3, 2])

    assert _uses_rc_adaptive_v2(ws)
    assert validate_test_worksheet_data(ws) == []

    sequence = [None, None]
    rng = random.Random(42)
    sequence = _assign_through_slot_rc_v2(
        sequence, {}, ws, 2, 2, rng, adaptive=True
    )
    assert len(sequence[0]["question_ids"]) == 4
    assert sequence[0]["tier"] == RC_PASSAGE_EASY


def test_rc_v2_weighted_scoring_and_thresholds():
    assert _next_rc_passage_tier(RC_PASSAGE_EASY, 0.80) == RC_PASSAGE_COMPLEX
    assert _next_rc_passage_tier(RC_PASSAGE_EASY, 0.79) == RC_PASSAGE_EASY
    assert _next_rc_passage_tier(RC_PASSAGE_COMPLEX, 0.69) == RC_PASSAGE_EASY
    assert _next_rc_passage_tier(RC_PASSAGE_COMPLEX, 0.70) == RC_PASSAGE_COMPLEX

    ws = _sample_worksheet()
    _add_bank(ws, "easy_a", 1, [1, 1, 2, 2, 1, 2, 2, 1])
    _add_bank(ws, "easy_b", 1, [1, 2, 1, 2, 2, 1, 2, 1])
    _add_bank(ws, "complex_a", 2, [2, 2, 3, 3, 2, 3, 2, 3])
    _add_bank(ws, "complex_b", 2, [2, 3, 2, 3, 3, 2, 3, 2])

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
    weighted, maximum = _weighted_test_score(ws, [entry], {"1": answer}, sitting_count=1)
    assert answer["weighted_pct"] > 0
    assert weighted < maximum
