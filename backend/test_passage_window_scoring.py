"""Passage-window test scoring uses per-question weights from context tier."""

from tests import (
    _build_rc_passage_answer,
    _question_lookup,
    _weighted_test_score,
    build_ordered_test_slots,
)


def _sample_worksheet():
    return {
        "subject": "english",
        "english_type": "reading_comprehension",
        "passages": [
            {"id": "p1", "tier": 3, "title": "Passage", "text": "Body text here."},
        ],
        "questions": [
            {
                "id": "q1",
                "passage_id": "p1",
                "prompt": "Q1",
                "answer": "A",
                "choices": ["A", "B"],
                "area": "main_idea",
            },
            {
                "id": "q2",
                "passage_id": "p1",
                "prompt": "Q2",
                "answer": "A",
                "choices": ["A", "B"],
                "area": "detail",
            },
            {
                "id": "q3",
                "passage_id": "p1",
                "prompt": "Q3",
                "answer": "A",
                "choices": ["A", "B"],
                "area": "inference",
            },
            {
                "id": "q4",
                "passage_id": "p1",
                "prompt": "Q4",
                "answer": "A",
                "choices": ["A", "B"],
                "area": "vocabulary",
            },
        ],
    }


def test_passage_window_scores_each_question_by_context_tier():
    ws = _sample_worksheet()
    sequence = [
        {
            "slot": 1,
            "passage_id": "p1",
            "tier": 1,
            "question_ids": ["q1", "q2", "q3", "q4"],
        }
    ]
    lookup = _question_lookup(ws)
    responses = {"q1": "A", "q2": "A", "q3": "A", "q4": "B"}
    answers = {
        "1": _build_rc_passage_answer(
            sequence[0],
            responses,
            lookup,
            ws,
        )
    }

    weighted, max_weighted = _weighted_test_score(
        ws, sequence, answers, sitting_count=1
    )

    assert answers["1"]["correct"] is True
    assert weighted == 6.0
    assert max_weighted == 8.0

    slots = build_ordered_test_slots(sequence, answers, sitting_count=1)
    assert len(slots) == 4
    assert all(slot["tier"] == 3 for slot in slots)
    assert [slot["correct"] for slot in slots] == [True, True, True, False]
