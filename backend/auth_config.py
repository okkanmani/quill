"""Public auth configuration (signup gates, etc.)."""

from __future__ import annotations

import os


def signup_enabled() -> bool:
    """Whether public admin self-registration is allowed."""
    raw = os.environ.get("QUILL_SIGNUP_ENABLED", "1").strip().lower()
    return raw not in ("0", "false", "no", "off")


def public_auth_config() -> dict:
    return {"signup_enabled": signup_enabled()}
