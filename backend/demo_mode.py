"""Demo environment: block unsafe mutations and expose config for the walkthrough app."""

from __future__ import annotations

import os

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

DEMO_BLOCK_MESSAGE = (
    "This action is disabled in the Quill demo. "
    "In your own account you can create content, run AI tools, and manage students."
)


def is_demo_mode() -> bool:
    return os.environ.get("QUILL_DEMO_MODE", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def demo_public_config() -> dict:
    return {
        "enabled": is_demo_mode(),
        "signup_disabled": is_demo_mode(),
        "ai_enabled": False,
        "admin_name": "demo",
        "student_names": ["Alex", "Sam"],
        "password_hint": "quill-demo",
    }


def _method_path(request: Request) -> tuple[str, str]:
    return request.method.upper(), request.url.path.rstrip("/") or "/"


def _mutation_allowed(method: str, path: str) -> bool:
    if method in ("GET", "HEAD", "OPTIONS"):
        return True

    allowed_exact = {
        ("POST", "/auth/admin/login"),
        ("POST", "/auth/student/login"),
        ("POST", "/auth/logout"),
        ("POST", "/results"),
        ("POST", "/admin/session/student"),
        ("DELETE", "/admin/session/student"),
    }
    if (method, path) in allowed_exact:
        return True

    if method == "PUT" and path.startswith("/worksheets/") and path.endswith("/draft"):
        return True

    if method == "POST" and path.startswith("/worksheets/") and path.endswith("/timed-session"):
        return True

    if method == "PUT" and "/notes/" in path and path.startswith("/learn/"):
        return True

    if method == "PUT" and "/highlights/" in path and path.startswith("/learn/"):
        return True

    return False


class DemoModeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not is_demo_mode():
            return await call_next(request)

        method, path = _method_path(request)

        if not _mutation_allowed(method, path):
            return JSONResponse(
                status_code=403,
                content={"detail": DEMO_BLOCK_MESSAGE, "demo": True},
            )

        return await call_next(request)
