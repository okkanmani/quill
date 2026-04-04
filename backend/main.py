import os
from contextlib import asynccontextmanager

from auth import context_student_name, create_admin_token, create_student_token, verify_token
from auth_users import authenticate_admin_for_student, authenticate_student
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
    student_name: str
    password: str


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


@app.post("/auth/student/login")
def student_login(req: StudentLoginRequest):
    row = authenticate_student(req.name, req.password)
    if not row:
        raise HTTPException(status_code=401, detail="Invalid name or password")
    token = create_student_token(row["id"], row["name"])
    return {"token": token, "role": "student", "name": row["name"]}


@app.post("/auth/admin/login")
def admin_login(req: AdminLoginRequest):
    row = authenticate_admin_for_student(req.student_name, req.password)
    if not row:
        raise HTTPException(
            status_code=401,
            detail="Invalid student name or admin password",
        )
    token = create_admin_token(
        row["admin_id"], row["student_id"], row["student_name"]
    )
    return {
        "token": token,
        "role": "admin",
        "student_name": row["student_name"],
    }


@app.post("/auth/logout")
def logout():
    return {"message": "Logged out"}


@app.get("/auth/me")
def me(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] == "student":
        return {"role": "student", "name": payload["name"]}
    return {"role": "admin", "student_name": payload["student_name"]}


@app.get("/worksheets")
def get_worksheets(authorization: str = Header(...)):
    payload = _payload(authorization)
    who = context_student_name(payload)
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
    who = context_student_name(payload)
    return list_results(who)
