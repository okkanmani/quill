"""Tests for learn markdown image resolution."""

import base64
from unittest.mock import patch

from learn_images import resolve_learn_markdown_images

_TINY_PNG = base64.b64encode(
    bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
        "0000000a49444154789c6300010000050001b80a0a0000000049454e44ae426082"
    )
).decode()


def test_resolve_learn_markdown_images_uploads_and_replaces():
    data_url = f"data:image/png;base64,{_TINY_PNG}"
    md = f"Hello\n\n![Chart]({data_url})\n"
    with patch("learn_images.storage_configured", return_value=True), patch(
        "learn_images.upload_learn_object",
        return_value="https://bucket.fly.storage.tigris.dev/learn/1/math/foo/abc.png",
    ) as upload:
        out = resolve_learn_markdown_images(
            md,
            admin_id=1,
            subject_key="math-g5-ncert",
            section_id="fractions",
        )
    upload.assert_called_once()
    assert "data:image" not in out
    assert "fly.storage.tigris.dev" in out
    assert "![Chart](" in out


def test_resolve_learn_markdown_images_with_learn_title():
    data_url = f"data:image/png;base64,{_TINY_PNG}"
    md = f'![Chart]({data_url} "learn:medium:block:landscape")'
    with patch("learn_images.storage_configured", return_value=True), patch(
        "learn_images.upload_learn_object",
        return_value="https://example.com/learn/assets/learn/1/a/b/c.png",
    ):
        out = resolve_learn_markdown_images(
            md,
            admin_id=1,
            subject_key="math",
            section_id="sec",
        )
    assert "data:image" not in out
    assert 'learn:medium:block:landscape' in out


def test_resolve_learn_markdown_images_noop_without_data_urls():
    md = "![x](https://example.com/a.png)"
    with patch("learn_images.storage_configured", return_value=False):
        assert (
            resolve_learn_markdown_images(
                md, admin_id=1, subject_key="math", section_id="a"
            )
            == md
        )
