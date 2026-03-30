import os
from contextlib import asynccontextmanager

from auth import create_token, get_student_name, verify_admin, verify_token
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_worksheet_tables()
    seed_worksheets_from_json_if_empty()
    # After the first seed, new JSON in the image is skipped unless you merge (see fly.toml comment).
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


class AdminLoginRequest(BaseModel):
    password: str


@app.post("/auth/admin/login")
def admin_login(req: AdminLoginRequest):
    if not verify_admin(req.password):
        raise HTTPException(status_code=401, detail="Invalid password")
    token = create_token("admin")
    return {"token": token, "role": "admin"}


@app.post("/auth/student/login")
def student_login():
    token = create_token("student")
    name = get_student_name()
    return {"token": token, "role": "student", "name": name}


@app.post("/auth/logout")
def logout():
    # JWT is stateless - client just discards the token
    return {"message": "Logged out"}


@app.get("/auth/me")
def me(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"role": payload["role"]}


@app.get("/worksheets")
def get_worksheets(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if payload["role"] == "student":
        return list_worksheets(student_name=get_student_name())
    return list_worksheets(student_name=None)


@app.get("/worksheets/{worksheet_id}")
def get_worksheet_by_id(worksheet_id: str, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="Not authenticated")
    worksheet = get_worksheet(worksheet_id)
    if not worksheet:
        raise HTTPException(status_code=404, detail="Worksheet not found")
    return worksheet


@app.delete("/worksheets/{worksheet_id}")
def remove_worksheet(worksheet_id: str, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload or payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if not delete_worksheet(worksheet_id):
        raise HTTPException(status_code=404, detail="Worksheet not found")
    return {"message": "Worksheet deleted"}


@app.post("/results")
def submit_result(req: SubmitResultRequest, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    result = {
        "worksheet_id": req.worksheet_id,
        "title": req.title,
        "student": get_student_name(),
        "score": req.score,
        "total": req.total,
        "answers": req.answers,
    }
    save_result(result)
    return {"message": "Result saved"}


@app.get("/results")
def get_results(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload or payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return list_results()
