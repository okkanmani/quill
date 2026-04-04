#!/usr/bin/env python3
"""Create admins and students in SQLite (after schema init)."""

import argparse

import db
from auth_users import add_admin, add_student


def main() -> None:
    p = argparse.ArgumentParser(description="Manage Quill admins and students")
    sub = p.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("add-admin", help="Create an admin")
    a.add_argument("--password", required=True)

    s = sub.add_parser("add-student", help="Create a student under an admin")
    s.add_argument("--admin-id", type=int, required=True)
    s.add_argument("--name", required=True)
    s.add_argument("--password", required=True)

    args = p.parse_args()
    db.init_schema()
    if args.cmd == "add-admin":
        aid = add_admin(args.password)
        print(f"Created admin id={aid}")
    else:
        sid = add_student(args.admin_id, args.name, args.password)
        print(f"Created student id={sid} name={args.name!r}")


if __name__ == "__main__":
    main()
