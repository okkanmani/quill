import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

SECRET_KEY = os.environ.get("JWT_SECRET", "quill-secret-key-change-this-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30


def create_student_token(student_id: int, name: str) -> str:
    payload = {
        "role": "student",
        "student_id": student_id,
        "name": name,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_admin_token(admin_id: int, student_id: int, student_name: str) -> str:
    payload = {
        "role": "admin",
        "admin_id": admin_id,
        "student_id": student_id,
        "student_name": student_name,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def context_student_name(payload: dict) -> str:
    """Name stored in results.student for the current session."""
    role = payload.get("role")
    if role == "student":
        return payload["name"]
    if role == "admin":
        return payload["student_name"]
    raise ValueError("invalid token role")
