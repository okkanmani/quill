#!/usr/bin/env bash
# Merge worksheet JSON from the deployed image into SQLite (same as seed --merge).
#
# Required env:
#   QUILL_CRON_SECRET   — must match the backend fly secret QUILL_CRON_SECRET
#   BACKEND_URL         — e.g. https://quill-backend.fly.dev
#
# Optional first argument: comma-separated subjects (e.g. math,english). Omit to merge all.
#
# Schedule with cron (local), GitHub Actions, Fly Machines scheduled, etc.

set -euo pipefail
SUBJECTS_ARG="${1:-}"
URL="${BACKEND_URL:?Set BACKEND_URL}"
SECRET="${QUILL_CRON_SECRET:?Set QUILL_CRON_SECRET}"

QS=""
if [[ -n "$SUBJECTS_ARG" ]]; then
  QS="?subjects=$(printf '%s' "$SUBJECTS_ARG" | sed 's/ /%20/g')"
fi

curl -sS -X POST "${URL}/cron/merge-worksheets${QS}" \
  -H "X-Quill-Cron-Key: ${SECRET}" \
  -H "Accept: application/json" | python3 -m json.tool
