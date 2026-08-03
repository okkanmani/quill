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


def test_enrich_test_answers_with_passages_attaches_context():
    from tests import _enrich_test_answers_with_passages

    ws = _sample_data_worksheet()
    answers = {
        "1": {
            "passage_id": "p1",
            "tier": 1,
            "responses": {"q1": "A"},
            "questions": [
                {
                    "question_id": "q1",
                    "prompt": "Q1",
                    "given": "A",
                    "expected": "A",
                    "correct": True,
                }
            ],
        }
    }
    enriched = _enrich_test_answers_with_passages(answers, ws)
    assert len(enriched) == 1
    assert enriched[0]["passage"]["id"] == "p1"
    assert enriched[0]["passage"]["title"] == "Sales"
    assert enriched[0]["questions"][0]["prompt"] == "Q1"


def test_finalize_partial_regular_test_marks_missing_answers_incorrect():
    from tests import _finalize_answers_for_submit

    ws = {
        "subject": "math",
        "questions": [
            {
                "id": "q1",
                "prompt": "2+2?",
                "answer": "4",
                "choices": ["3", "4"],
                "stars": 2,
            },
            {
                "id": "q2",
                "prompt": "3+3?",
                "answer": "6",
                "choices": ["5", "6"],
                "stars": 2,
            },
        ],
    }
    sequence = [
        {"slot": 1, "question_id": "q1", "tier": 2},
        {"slot": 2, "question_id": "q2", "tier": 2},
    ]
    answers = {
        "1": {
            "given": "4",
            "correct": True,
            "question_id": "q1",
            "tier": 2,
            "prompt": "2+2?",
            "expected": "4",
            "choices": ["3", "4"],
            "area": "",
        }
    }
    finalized = _finalize_answers_for_submit(
        ws,
        sequence,
        answers,
        sitting_count=2,
        force_partial=True,
    )
    assert finalized["1"]["correct"] is True
    assert finalized["2"]["correct"] is False
    assert finalized["2"]["given"] == ""

