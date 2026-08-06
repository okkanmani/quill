#!/usr/bin/env bash
# Deploy Quill demo walkthrough to Fly.io (quill-*-demo apps).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export FLYCTL_INSTALL="${FLYCTL_INSTALL:-$HOME/.fly}"
export PATH="$FLYCTL_INSTALL/bin:$PATH"

echo "==> Demo backend (quill-backend-demo)"
cd "$ROOT/backend"
fly deploy -c fly.demo.toml

echo "==> Demo frontend (quill-app-demo)"
cd "$ROOT/frontend"
fly deploy -c fly.demo.toml

echo "==> Done. Demo: https://quill-app-demo.fly.dev"
echo "    Admin demo / quill-demo · Student demo + Alex or Sam / quill-demo"
