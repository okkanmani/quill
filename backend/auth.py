import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
from jose import JWTError, jwt

AUTH_FILE = Path(__file__).parent / "data" / "auth.json"

SECRET_KEY = "quill-secret-key-change-this-in-production"
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30


def load_auth() -> dict:
    with open(AUTH_FILE) as f:
        return json.load(f)


def verify_admin(password: str) -> bool:
    auth = load_auth()
    hashed = auth["admin"]["password_hash"].encode()
    return bcrypt.checkpw(password.encode(), hashed)


def get_student_name() -> str:
    auth = load_auth()
    return auth["student"]["name"]


def create_token(role: str) -> str:
    payload = {
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
