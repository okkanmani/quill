"""Tests for tier-weighted focus reinforcement rules."""

from focus_reinforcement import (
    REINFORCEMENT_CUTOFF,
    should_trigger_reinforcement,
    weighted_score_totals,
)


def q(stars: int, correct: bool) -> dict:
    return {"stars": stars, "correct": correct}


def test_no_wrong_answers_stays_discussed():
    assert should_trigger_reinforcement([q(2, True), q(3, True)]) is False


def test_easy_wrong_always_reinforces():
    assert should_trigger_reinforcement([q(1, True), q(1, False), q(3, True)]) is True


def test_only_hard_wrong_stays_discussed():
    questions = [q(2, True), q(2, True), q(2, True), q(3, False), q(3, True)]
    assert should_trigger_reinforcement(questions) is False


def test_weighted_cutoff_at_seventy_five_percent():
    # 3 easy + 1 medium + 1 hard => max 6.5; medium and hard wrong => 3.0 earned => ~46%
    below_cutoff = [
        q(1, True),
        q(1, True),
        q(1, True),
        q(2, False),
        q(3, False),
    ]
    earned, maximum = weighted_score_totals(below_cutoff)
    assert earned == 3.0
    assert maximum == 6.5
    assert should_trigger_reinforcement(below_cutoff, cutoff=REINFORCEMENT_CUTOFF) is True

    # Medium correct with only hard wrong => 6.0 / 6.5 => above 75%
    passing = [
        q(1, True),
        q(1, True),
        q(1, True),
        q(2, True),
        q(3, False),
    ]
    assert should_trigger_reinforcement(passing, cutoff=REINFORCEMENT_CUTOFF) is False


def test_mixed_wrong_uses_weighted_cutoff():
    questions = [q(2, True), q(2, False), q(3, True)]
    assert should_trigger_reinforcement(questions, cutoff=0.75) is True
