#!/usr/bin/env bash
# Create a pilot student under an admin on Fly (production by default).
set -euo pipefail

export FLYCTL_INSTALL="${FLYCTL_INSTALL:-$HOME/.fly}"
export PATH="$FLYCTL_INSTALL/bin:$PATH"

APP="${QUILL_BACKEND_APP:-quill-backend}"

usage() {
  cat <<EOF
Usage: $(basename "$0") --admin-id ID --name STUDENT_NAME --password PASSWORD

Create a student under an existing admin (optional — admins can add students in the app).

Environment:
  QUILL_BACKEND_APP   Fly backend app (default: quill-backend)

Examples:
  $(basename "$0") --admin-id 2 --name Alex --password 'student-password'
EOF
}

ADMIN_ID=""
NAME=""
PASSWORD=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --admin-id) ADMIN_ID="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$ADMIN_ID" || -z "$NAME" || -z "$PASSWORD" ]]; then
  echo "Error: --admin-id, --name, and --password are required." >&2
  usage >&2
  exit 1
fi

esc_name=${NAME//\'/\'\\\'\'}
esc_pass=${PASSWORD//\'/\'\\\'\'}

echo "==> Creating student '$NAME' (admin id $ADMIN_ID) on $APP"
fly ssh console -a "$APP" -C \
  "QUILL_DATA_DIR=/data /app/.venv/bin/python /app/manage_users.py add-student --admin-id $ADMIN_ID --name '$esc_name' --password '$esc_pass'"
