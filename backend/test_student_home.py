"""Tests for student home alert baseline logic."""

from datetime import datetime, timedelta, timezone

from student_home import _alert_baseline, _is_after_baseline, _parse_iso


def test_alert_baseline_uses_last_seen_when_set():
    last_seen = datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert _alert_baseline(last_seen) == last_seen


def test_alert_baseline_falls_back_to_lookback_window():
    baseline = _alert_baseline(None)
    now = datetime.now(timezone.utc)
    assert now - baseline <= timedelta(days=14, seconds=5)


def test_is_after_baseline():
    baseline = datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert _is_after_baseline(_parse_iso("2026-01-02T00:00:00+00:00"), baseline)
    assert not _is_after_baseline(_parse_iso("2025-12-31T00:00:00+00:00"), baseline)
