"""Resolve pasted data-URL images in learn markdown to Tigris public URLs."""

from __future__ import annotations

import base64
import binascii
import re
import uuid

from learn_storage import (
    delete_learn_objects_under_prefix,
    learn_section_object_prefix,
    public_url_for_key,
    storage_configured,
    upload_learn_object,
)

MAX_LEARN_IMAGES = 20
MAX_LEARN_IMAGE_BYTES = 5 * 1024 * 1024

# Optional markdown title after data URL:  ![alt](data:image/png;base64,ABC "learn:medium:block")
_DATA_IMAGE_RE = re.compile(
    r"!\[([^\]]*)\]\("
    r"data:image/(jpeg|jpg|png|gif|webp);base64,([A-Za-z0-9+/=\s]+?)"
    r'(?:\s+"([^"]*)")?\)',
    re.IGNORECASE,
)

_MIME_TO_EXT = {
    "jpeg": "jpg",
    "jpg": "jpg",
    "png": "png",
    "gif": "gif",
    "webp": "webp",
}


def markdown_has_pending_learn_images(markdown: str) -> bool:
    return bool(_DATA_IMAGE_RE.search(markdown or ""))


def resolve_learn_markdown_images(
    markdown: str,
    *,
    admin_id: int,
    subject_key: str,
    section_id: str,
) -> str:
    text = markdown or ""
    matches = list(_DATA_IMAGE_RE.finditer(text))
    if not matches:
        return text
    if not storage_configured():
        raise ValueError(
            "This resource includes pasted images, but image storage is not "
            "configured on the server."
        )
    if len(matches) > MAX_LEARN_IMAGES:
        raise ValueError(f"Too many images in this resource (max {MAX_LEARN_IMAGES}).")

    subject_key = (subject_key or "").strip().lower()
    section_id = (section_id or "").strip().lower()
    upload_cache: dict[str, str] = {}

    def _upload_b64(mime_subtype: str, b64_raw: str) -> str:
        ext = _MIME_TO_EXT.get(mime_subtype.lower())
        if not ext:
            raise ValueError(f"Unsupported image type: image/{mime_subtype}")
        b64_clean = re.sub(r"\s+", "", b64_raw)
        cache_key = f"{mime_subtype}:{b64_clean[:64]}"
        if cache_key in upload_cache:
            return upload_cache[cache_key]
        try:
            body = base64.b64decode(b64_clean, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("A pasted image could not be decoded.") from exc
        if len(body) > MAX_LEARN_IMAGE_BYTES:
            mb = MAX_LEARN_IMAGE_BYTES // (1024 * 1024)
            raise ValueError(f"Each image must be {mb} MB or smaller.")
        content_type = f"image/{mime_subtype.lower()}"
        if content_type == "image/jpg":
            content_type = "image/jpeg"
        object_key = (
            f"learn/{admin_id}/{subject_key}/{section_id}/{uuid.uuid4().hex}.{ext}"
        )
        url = upload_learn_object(key=object_key, body=body, content_type=content_type)
        upload_cache[cache_key] = url
        return url

    def _replacer(match: re.Match) -> str:
        alt = match.group(1)
        mime_subtype = match.group(2)
        b64_raw = match.group(3)
        title = match.group(4)
        url = _upload_b64(mime_subtype, b64_raw)
        title_part = f' "{title}"' if title else ""
        return f"![{alt}]({url}{title_part})"

    return _DATA_IMAGE_RE.sub(_replacer, text)


_TIGRIS_MARKDOWN_IMG_RE = re.compile(
    r"(!\[[^\]]*\]\()https://[^/]+\.fly\.storage\.tigris\.dev/(learn/[^)]+)(\))",
    re.IGNORECASE,
)

_LEARN_ASSET_KEY_IN_MARKDOWN_RE = re.compile(
    r"!\[[^\]]*\]\((?:https://[^/]+\.fly\.storage\.tigris\.dev/|https?://[^/]+/learn/assets/)(learn/[^)]+)\)",
    re.IGNORECASE,
)


def learn_asset_keys_in_markdown(markdown: str) -> set[str]:
    return set(_LEARN_ASSET_KEY_IN_MARKDOWN_RE.findall(markdown or ""))


def purge_learn_section_assets(*, admin_id: int, subject_key: str, section_id: str) -> int:
    """Delete all Tigris objects for one learn section folder."""
    if not storage_configured():
        return 0
    prefix = learn_section_object_prefix(
        admin_id=admin_id,
        subject_key=subject_key,
        section_id=section_id,
    )
    return delete_learn_objects_under_prefix(prefix)


def rewrite_learn_markdown_asset_urls(markdown: str) -> str:
    """Map direct Tigris URLs (often 403 when bucket is private) to API proxy URLs."""

    def _replacer(match: re.Match) -> str:
        prefix, key, suffix = match.groups()
        return f"{prefix}{public_url_for_key(key)}{suffix}"

    return _TIGRIS_MARKDOWN_IMG_RE.sub(_replacer, markdown or "")


def rewrite_learn_subject_asset_urls(subject: dict | None) -> dict | None:
    if not subject:
        return subject
    for section in subject.get("sections") or []:
        md = section.get("markdown")
        if md:
            section["markdown"] = rewrite_learn_markdown_asset_urls(md)
    for group in subject.get("groups") or []:
        for section in group.get("sections") or []:
            md = section.get("markdown")
            if md:
                section["markdown"] = rewrite_learn_markdown_asset_urls(md)
    return subject
