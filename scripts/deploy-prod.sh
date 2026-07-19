#!/usr/bin/env bash
# Deploy Quill to Fly.io PRODUCTION (quill-backend, quill-app). Requires main branch.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export FLYCTL_INSTALL="${FLYCTL_INSTALL:-$HOME/.fly}"
export PATH="$FLYCTL_INSTALL/bin:$PATH"

BRANCH="$(git -C "$ROOT" branch --show-current)"
if [[ "$BRANCH" != "main" ]]; then
  echo "Refusing prod deploy: on branch '$BRANCH' (must be main)."
  exit 1
fi

if [[ "${DEPLOY_PROD:-}" != "1" ]]; then
  read -r -p "Deploy PRODUCTION from main? [y/N] " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "==> Production backend (quill-backend)"
cd "$ROOT/backend"
fly deploy

echo "==> Production frontend (quill-app)"
cd "$ROOT/frontend"
fly deploy

echo "==> Done. Production: https://quill-app.fly.dev"
