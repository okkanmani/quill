"""Encrypt and store per-admin secrets (e.g. OpenAI API keys)."""

from __future__ import annotations

import base64
import hashlib
import os
import re

from cryptography.fernet import Fernet, InvalidToken

import db

OPENAI_KEY_RE = re.compile(r"^sk-[A-Za-z0-9_-]{20,}$")


def _fernet() -> Fernet:
    raw = os.environ.get("QUILL_ENCRYPTION_KEY", "").strip()
    if not raw:
        raw = os.environ.get("JWT_SECRET", "quill-secret-key-change-this-in-production")
    key = base64.urlsafe_b64encode(hashlib.sha256(raw.encode()).digest())
    return Fernet(key)


def _validate_openai_key(api_key: str) -> str:
    key = (api_key or "").strip()
    if not key:
        raise ValueError("API key is required.")
    if not OPENAI_KEY_RE.match(key):
        raise ValueError("Invalid OpenAI API key format.")
    return key


def _encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def _decrypt(token: str) -> str | None:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return None


def admin_openai_key_configured(admin_id: int) -> bool:
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT openai_api_key_enc FROM admins WHERE id = ?",
            (admin_id,),
        ).fetchone()
    finally:
        conn.close()
    return bool(row and row["openai_api_key_enc"])


def set_admin_openai_api_key(admin_id: int, api_key: str) -> None:
    key = _validate_openai_key(api_key)
    enc = _encrypt(key)
    conn = db.connect()
    try:
        cur = conn.execute(
            "UPDATE admins SET openai_api_key_enc = ? WHERE id = ?",
            (enc, admin_id),
        )
        if cur.rowcount == 0:
            raise ValueError("Admin not found.")
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def clear_admin_openai_api_key(admin_id: int) -> None:
    conn = db.connect()
    try:
        conn.execute(
            "UPDATE admins SET openai_api_key_enc = NULL WHERE id = ?",
            (admin_id,),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_admin_openai_api_key(admin_id: int) -> str | None:
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT openai_api_key_enc FROM admins WHERE id = ?",
            (admin_id,),
        ).fetchone()
    finally:
        conn.close()
    if not row or not row["openai_api_key_enc"]:
        return None
    return _decrypt(row["openai_api_key_enc"])


def resolve_openai_api_key(admin_id: int) -> str | None:
    """Per-admin key first; optional server fallback for local dev."""
    key = get_admin_openai_api_key(admin_id)
    if key:
        return key
    return os.environ.get("OPENAI_API_KEY", "").strip() or None
