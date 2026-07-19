#!/usr/bin/env bash
# Deploy Quill to Fly.io STAGING (quill-*-staging apps).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export FLYCTL_INSTALL="${FLYCTL_INSTALL:-$HOME/.fly}"
export PATH="$FLYCTL_INSTALL/bin:$PATH"

echo "==> Staging backend (quill-backend-staging)"
cd "$ROOT/backend"
fly deploy -c fly.staging.toml

echo "==> Staging frontend (quill-app-staging)"
cd "$ROOT/frontend"
fly deploy -c fly.staging.toml

echo "==> Done. Staging: https://quill-app-staging.fly.dev"
