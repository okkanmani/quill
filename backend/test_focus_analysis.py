"""Tests for student focus chip aggregation."""

from focus_analysis import _chip_sort_key, _needs_reinforcing


def test_needs_reinforcing_when_last_reinforced_after_discussed():
    assert _needs_reinforcing(
        "math",
        "fractions",
        "2026-01-01T00:00:00+00:00",
        "2026-01-02T00:00:00+00:00",
    )


def test_not_reinforcing_without_last_reinforced():
    assert not _needs_reinforcing(
        "math",
        "fractions",
        "2026-01-01T00:00:00+00:00",
        None,
    )


def test_chip_sort_prefers_recent_timed():
    timed_recent = {
        "from_timed": True,
        "latest_at": "2026-06-01T00:00:00+00:00",
        "wrong_count": 1,
        "subject": "math",
        "area": "a",
    }
    untimed_many = {
        "from_timed": False,
        "latest_at": "2026-01-01T00:00:00+00:00",
        "wrong_count": 10,
        "subject": "math",
        "area": "b",
    }
    ordered = sorted([untimed_many, timed_recent], key=_chip_sort_key)
    assert ordered[0]["area"] == "a"


def test_chip_sort_untimed_by_wrong_count():
    low = {
        "from_timed": False,
        "latest_at": "2026-06-01T00:00:00+00:00",
        "wrong_count": 1,
        "subject": "math",
        "area": "a",
    }
    high = {
        "from_timed": False,
        "latest_at": "2026-01-01T00:00:00+00:00",
        "wrong_count": 5,
        "subject": "math",
        "area": "b",
    }
    ordered = sorted([low, high], key=_chip_sort_key)
    assert ordered[0]["area"] == "b"
