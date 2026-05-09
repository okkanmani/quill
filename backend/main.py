import os
import sqlite3
from contextlib import asynccontextmanager

from auth import context_student_name, create_admin_token, create_student_token, verify_token
from auth_users import (
    add_admin,
    add_student,
    authenticate_admin_by_name,
    authenticate_admin_for_student,
    authenticate_student,
    get_admin_name,
    get_student_by_admin_and_name,
    list_students_for_admin,
)
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from learn_content import get_subject, list_subjects
from worksheets import (
    delete_worksheet,
    get_worksheet,
    init_worksheet_tables,
    list_results,
    list_worksheets,
    merge_worksheets_from_json_files,
    save_result,
    seed_worksheets_from_json_if_empty,
)


class SubmitResultRequest(BaseModel):
    worksheet_id: str
    title: str
    score: int
    total: int
    answers: list


class StudentLoginRequest(BaseModel):
    name: str
    password: str


class AdminLoginRequest(BaseModel):
    """Use ``student_name`` to view a student's data, or ``admin_name`` to sign in (e.g. after signup)."""

    password: str
    student_name: str | None = None
    admin_name: str | None = None


class CreateAdminSignupRequest(BaseModel):
    name: str
    password: str


class CreateStudentRequest(BaseModel):
    name: str
    password: str


class SwitchAdminStudentRequest(BaseModel):
    student_name: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_worksheet_tables()
    seed_worksheets_from_json_if_empty()
    if os.environ.get("MERGE_WORKSHEETS_JSON_ON_START") == "1":
        merge_worksheets_from_json_files()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://quill-app.fly.dev",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:8000",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _payload(authorization: str) -> dict:
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return payload


def _student_context_name(payload: dict) -> str:
    """Student name for worksheets/results; admins must have selected a student."""
    if payload.get("role") == "student":
        return payload["name"]
    if payload.get("role") == "admin":
        sn = payload.get("student_name")
        if not sn:
            raise HTTPException(
                status_code=400,
                detail="Choose a student first: open Students, add one if needed, then pick them from the menu.",
            )
        return sn
    raise HTTPException(status_code=403, detail="Invalid role")


@app.post("/auth/student/login")
def student_login(req: StudentLoginRequest):
    row = authenticate_student(req.name, req.password)
    if not row:
        raise HTTPException(status_code=401, detail="Invalid name or password")
    token = create_student_token(row["id"], row["name"])
    return {"token": token, "role": "student", "name": row["name"]}


@app.post("/auth/admin/signup")
def admin_signup(req: CreateAdminSignupRequest):
    name = req.name.strip()
    if not name or not req.password:
        raise HTTPException(
            status_code=400, detail="Admin name and password are required"
        )
    try:
        aid = add_admin(name, req.password)
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="That admin name is already taken",
        )
    return {"id": aid, "name": name}


@app.post("/auth/admin/login")
def admin_login(req: AdminLoginRequest):
    stu = (req.student_name or "").strip()
    adm = (req.admin_name or "").strip()
    if stu:
        row = authenticate_admin_for_student(stu, req.password)
        if not row:
            raise HTTPException(
                status_code=401,
                detail="Invalid student name or admin password",
            )
        an = get_admin_name(row["admin_id"])
        token = create_admin_token(
            row["admin_id"],
            row["student_id"],
            row["student_name"],
            admin_name=an,
        )
        return {
            "token": token,
            "role": "admin",
            "student_name": row["student_name"],
            "admin_name": an,
            "needs_student": False,
        }
    if adm:
        row = authenticate_admin_by_name(adm, req.password)
        if not row:
            raise HTTPException(
                status_code=401,
                detail="Invalid admin name or password",
            )
        token = create_admin_token(
            row["admin_id"],
            None,
            None,
            admin_name=row["admin_name"],
        )
        return {
            "token": token,
            "role": "admin",
            "student_name": None,
            "admin_name": row["admin_name"],
            "needs_student": True,
        }
    raise HTTPException(
        status_code=400,
        detail="Provide student name or admin name with your password",
    )


@app.post("/auth/logout")
def logout():
    return {"message": "Logged out"}


@app.get("/auth/me")
def me(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] == "student":
        return {"role": "student", "name": payload["name"]}
    an = payload.get("admin_name") or get_admin_name(payload["admin_id"])
    return {
        "role": "admin",
        "student_name": payload.get("student_name"),
        "admin_name": an,
        "needs_student": not bool(payload.get("student_name")),
    }


@app.get("/worksheets")
def get_worksheets(authorization: str = Header(...)):
    payload = _payload(authorization)
    who = _student_context_name(payload)
    return list_worksheets(student_name=who)


@app.get("/worksheets/{worksheet_id}")
def get_worksheet_by_id(worksheet_id: str, authorization: str = Header(...)):
    if not verify_token(authorization.replace("Bearer ", "")):
        raise HTTPException(status_code=401, detail="Not authenticated")
    worksheet = get_worksheet(worksheet_id)
    if not worksheet:
        raise HTTPException(status_code=404, detail="Worksheet not found")
    return worksheet


@app.delete("/worksheets/{worksheet_id}")
def remove_worksheet(worksheet_id: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if not delete_worksheet(worksheet_id):
        raise HTTPException(status_code=404, detail="Worksheet not found")
    return {"message": "Worksheet deleted"}


@app.post("/results")
def submit_result(req: SubmitResultRequest, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can submit results")
    result = {
        "worksheet_id": req.worksheet_id,
        "title": req.title,
        "student": context_student_name(payload),
        "score": req.score,
        "total": req.total,
        "answers": req.answers,
    }
    save_result(result)
    return {"message": "Result saved"}


@app.get("/results")
def get_results(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    return list_results(who)


@app.get("/learn/subjects")
def learn_subjects(authorization: str = Header(...)):
    _payload(authorization)
    return {"subjects": list_subjects()}


@app.get("/learn/{subject_key}")
def learn_subject(subject_key: str, authorization: str = Header(...)):
    _payload(authorization)
    data = get_subject(subject_key)
    if not data:
        raise HTTPException(status_code=404, detail="Subject not found")
    return data


@app.get("/admin/students")
def admin_list_students(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return {"students": list_students_for_admin(payload["admin_id"])}


@app.post("/admin/students")
def admin_create_student(req: CreateStudentRequest, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    name = req.name.strip()
    if not name or not req.password:
        raise HTTPException(status_code=400, detail="Name and password required")
    try:
        sid = add_student(payload["admin_id"], name, req.password)
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="A student with that name already exists for your account",
        )
    return {"id": sid, "name": name}


@app.post("/admin/session/student")
def admin_switch_student_context(
    req: SwitchAdminStudentRequest, authorization: str = Header(...)
):
    """Re-issue admin JWT viewing a different student under the same admin."""
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    row = get_student_by_admin_and_name(payload["admin_id"], req.student_name)
    if not row:
        raise HTTPException(status_code=404, detail="Student not found")
    an = payload.get("admin_name") or get_admin_name(payload["admin_id"])
    token = create_admin_token(
        payload["admin_id"],
        row["id"],
        row["name"],
        admin_name=an,
    )
    return {
        "token": token,
        "student_name": row["name"],
        "admin_name": an,
        "needs_student": False,
    }


@app.post("/cron/merge-worksheets")
def cron_merge_worksheets(
    x_quill_cron_key: str | None = Header(None, alias="X-Quill-Cron-Key"),
    subjects: str | None = Query(
        None,
        description="Comma-separated subjects (e.g. math,english). Omit to merge all.",
    ),
):
    """Scheduled job: merge worksheet JSON from disk into SQLite. Requires QUILL_CRON_SECRET."""
    secret = os.environ.get("QUILL_CRON_SECRET", "").strip()
    if not secret or (x_quill_cron_key or "").strip() != secret:
        raise HTTPException(status_code=401, detail="Invalid or missing cron key")
    subj_set = None
    if subjects is not None and subjects.strip():
        subj_set = frozenset(
            x.strip().lower() for x in subjects.split(",") if x.strip()
        )
    stats = merge_worksheets_from_json_files(subjects=subj_set)
    return stats
