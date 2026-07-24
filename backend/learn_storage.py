"""Tigris (S3-compatible) uploads for learning resource images."""

from __future__ import annotations

import os
from functools import lru_cache


def storage_configured() -> bool:
    return bool(
        (os.environ.get("BUCKET_NAME") or "").strip()
        and (os.environ.get("AWS_ACCESS_KEY_ID") or "").strip()
        and (os.environ.get("AWS_SECRET_ACCESS_KEY") or "").strip()
        and (os.environ.get("AWS_ENDPOINT_URL_S3") or "").strip()
    )


def public_url_for_key(key: str) -> str:
    """URL stored in markdown for <img src> (browser does not send auth headers)."""
    key = key.lstrip("/")
    direct = (os.environ.get("LEARN_ASSETS_PUBLIC_BASE_URL") or "").strip().rstrip("/")
    if direct:
        return f"{direct}/{key}"
    api_base = (os.environ.get("QUILL_PUBLIC_API_URL") or "http://localhost:8000").strip()
    api_base = api_base.rstrip("/")
    return f"{api_base}/learn/assets/{key}"


def fetch_learn_object(key: str) -> tuple[bytes, str]:
    if not storage_configured():
        raise RuntimeError("Learn image storage is not configured.")
    key = key.lstrip("/")
    if not _is_safe_learn_object_key(key):
        raise ValueError("Invalid learn asset key.")
    client = _s3_client()
    bucket = os.environ["BUCKET_NAME"].strip()
    resp = client.get_object(Bucket=bucket, Key=key)
    body = resp["Body"].read()
    content_type = resp.get("ContentType") or "application/octet-stream"
    return body, content_type


def _is_safe_learn_object_key(key: str) -> bool:
    import re

    return bool(
        re.match(
            r"^learn/\d+/[a-z0-9-]+/[a-z0-9-]+/[a-f0-9]+\.(jpg|jpeg|png|gif|webp)$",
            key,
            re.IGNORECASE,
        )
    )


@lru_cache(maxsize=1)
def _s3_client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=os.environ["AWS_ENDPOINT_URL_S3"].strip(),
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"].strip(),
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"].strip(),
        region_name=(os.environ.get("AWS_REGION") or "auto").strip(),
    )


def upload_learn_object(*, key: str, body: bytes, content_type: str) -> str:
    if not storage_configured():
        raise RuntimeError("Learn image storage is not configured.")
    client = _s3_client()
    bucket = os.environ["BUCKET_NAME"].strip()
    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=body,
        ContentType=content_type,
    )
    return public_url_for_key(key)


def learn_section_object_prefix(*, admin_id: int, subject_key: str, section_id: str) -> str:
    subject_key = (subject_key or "").strip().lower()
    section_id = (section_id or "").strip().lower()
    return f"learn/{int(admin_id)}/{subject_key}/{section_id}/"


def _is_safe_learn_delete_prefix(prefix: str) -> bool:
    import re

    prefix = (prefix or "").lstrip("/")
    if not prefix.endswith("/"):
        prefix = f"{prefix}/"
    return bool(re.match(r"^learn/\d+/[a-z0-9-]+/[a-z0-9-]+/$", prefix, re.IGNORECASE)) or bool(
        re.match(r"^learn/\d+/[a-z0-9-]+/$", prefix, re.IGNORECASE)
    )


def list_learn_object_keys(prefix: str) -> list[str]:
    if not storage_configured():
        raise RuntimeError("Learn image storage is not configured.")
    prefix = (prefix or "").lstrip("/")
    if not prefix.endswith("/"):
        prefix = f"{prefix}/"
    if not prefix.startswith("learn/"):
        raise ValueError("Prefix must start with learn/.")
    client = _s3_client()
    bucket = os.environ["BUCKET_NAME"].strip()
    keys: list[str] = []
    token = None
    while True:
        kwargs = {"Bucket": bucket, "Prefix": prefix}
        if token:
            kwargs["ContinuationToken"] = token
        resp = client.list_objects_v2(**kwargs)
        for item in resp.get("Contents") or []:
            key = item.get("Key")
            if key and _is_safe_learn_object_key(key):
                keys.append(key)
        if not resp.get("IsTruncated"):
            break
        token = resp.get("NextContinuationToken")
    return keys


def delete_learn_objects(keys: list[str]) -> int:
    if not keys:
        return 0
    if not storage_configured():
        raise RuntimeError("Learn image storage is not configured.")
    for key in keys:
        if not _is_safe_learn_object_key(key):
            raise ValueError(f"Refusing to delete unsafe key: {key}")
    client = _s3_client()
    bucket = os.environ["BUCKET_NAME"].strip()
    deleted = 0
    for i in range(0, len(keys), 1000):
        batch = keys[i : i + 1000]
        client.delete_objects(
            Bucket=bucket,
            Delete={"Objects": [{"Key": key} for key in batch], "Quiet": True},
        )
        deleted += len(batch)
    return deleted


def delete_learn_objects_under_prefix(prefix: str, *, require_safe_prefix: bool = True) -> int:
    prefix = (prefix or "").lstrip("/")
    if not prefix.endswith("/"):
        prefix = f"{prefix}/"
    if require_safe_prefix and not _is_safe_learn_delete_prefix(prefix):
        raise ValueError(f"Unsafe or invalid learn prefix: {prefix}")
    keys = list_learn_object_keys(prefix)
    return delete_learn_objects(keys)
