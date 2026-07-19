"""Resolve the admin (tenant) for the current JWT session."""

from __future__ import annotations

from auth_users import get_student_admin_id


def resolve_admin_id(payload: dict) -> int:
    """Return admins.id for a student or admin JWT payload."""
    role = payload.get("role")
    if role == "admin":
        admin_id = payload.get("admin_id")
        if admin_id is None:
            raise ValueError("admin token missing admin_id")
        return int(admin_id)
    if role == "student":
        student_id = payload.get("student_id")
        if student_id is None:
            raise ValueError("student token missing student_id")
        admin_id = get_student_admin_id(int(student_id))
        if admin_id is None:
            raise ValueError("unknown student_id")
        return int(admin_id)
    raise ValueError("invalid token role")
