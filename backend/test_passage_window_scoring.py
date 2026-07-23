"""Passage-window data tests score per question using context tier."""

from tests import (
    _build_rc_passage_answer,
    _is_data_passage_test,
    _question_lookup,
    _weighted_test_score,
    build_ordered_test_slots,
)


def _sample_data_worksheet():
    return {
        "subject": "data",
        "passages": [
            {
                "id": "p1",
                "tier": 3,
                "title": "Sales",
                "chart": {"type": "bar", "title": "Sales", "labels": ["A"], "values": [1]},
            },
        ],
        "questions": [
            {
                "id": "q1",
                "passage_id": "p1",
                "prompt": "Q1",
                "answer": "A",
                "choices": ["A", "B"],
                "area": "read_values",
            },
            {
                "id": "q2",
                "passage_id": "p1",
                "prompt": "Q2",
                "answer": "A",
                "choices": ["A", "B"],
                "area": "read_values",
            },
            {
                "id": "q3",
                "passage_id": "p1",
                "prompt": "Q3",
                "answer": "A",
                "choices": ["A", "B"],
                "area": "read_values",
            },
            {
                "id": "q4",
                "passage_id": "p1",
                "prompt": "Q4",
                "answer": "A",
                "choices": ["A", "B"],
                "area": "read_values",
            },
        ],
    }


def test_data_passage_scores_each_question_by_context_tier():
    ws = _sample_data_worksheet()
    assert _is_data_passage_test(ws)
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

    assert weighted == 6.0
    assert max_weighted == 8.0

    slots = build_ordered_test_slots(sequence, answers, sitting_count=1)
    assert len(slots) == 4
    assert all(slot["tier"] == 3 for slot in slots)
