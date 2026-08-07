#!/usr/bin/env bash
# Create a pilot family admin on Fly (production by default).
set -euo pipefail

export FLYCTL_INSTALL="${FLYCTL_INSTALL:-$HOME/.fly}"
export PATH="$FLYCTL_INSTALL/bin:$PATH"

APP="${QUILL_BACKEND_APP:-quill-backend}"

usage() {
  cat <<EOF
Usage: $(basename "$0") --name ADMIN_NAME --password PASSWORD

Create a family admin for the private pilot. Sign-up is disabled on production;
use this script to provision accounts manually.

Students can be added by the admin in the app, or via pilot-add-student.sh.

Environment:
  QUILL_BACKEND_APP   Fly backend app (default: quill-backend)

Examples:
  $(basename "$0") --name smith --password 'their-secure-password'
  QUILL_BACKEND_APP=quill-backend-staging $(basename "$0") --name test --password 'secret'
EOF
}

NAME=""
PASSWORD=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) NAME="$2"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$NAME" || -z "$PASSWORD" ]]; then
  echo "Error: --name and --password are required." >&2
  usage >&2
  exit 1
fi

esc_name=${NAME//\'/\'\\\'\'}
esc_pass=${PASSWORD//\'/\'\\\'\'}

echo "==> Creating admin '$NAME' on $APP"
fly ssh console -a "$APP" -C \
  "QUILL_DATA_DIR=/data /app/.venv/bin/python /app/manage_users.py add-admin --name '$esc_name' --password '$esc_pass'"
