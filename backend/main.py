import json
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
    delete_student,
    get_admin_name,
    get_student_by_admin_and_name,
    get_student_profile,
    list_students_for_admin,
    update_student_grade,
)
from admin_secrets import (
    admin_openai_key_configured,
    clear_admin_openai_api_key,
    resolve_openai_api_key,
    set_admin_openai_api_key,
)
from ai_worksheet import generate_worksheet_draft
from ai_learn import generate_learn_resource
from fastapi import FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from learn_content import (
    delete_learn_section,
    get_subject,
    learn_collection_key,
    list_admin_learn_sections,
    list_learn_hub,
    list_subjects,
    publish_learn_section,
    reorder_learn_sections,
    update_learn_section,
)
from focus_discussion import list_focus_areas_discussed, mark_focus_area_discussed
from writing import (
    delete_writing_submission,
    grade_writing_submission,
    list_writing_submissions,
    save_writing_submission,
)
from worksheets import (
    assert_worksheet_accessible,
    attach_areas_to_answers,
    clear_worksheet_access_lock,
    create_worksheet_from_builder,
    delete_worksheet,
    delete_result,
    evaluate_result,
    get_or_start_timed_session,
    get_student_result_for_worksheet,
    get_worksheet,
    get_worksheet_draft,
    init_worksheet_tables,
    list_results,
    list_worksheets,
    lock_timed_worksheet,
    merge_worksheets_from_json_files,
    save_result,
    save_focus_evaluation,
    analyze_result_for_focus,
    save_worksheet_draft,
    seed_worksheets_from_json_if_empty,
    set_worksheet_access_lock,
    student_has_result_for_worksheet,
    lock_gifted_track_week,
    unlock_gifted_track_week,
    unlock_timed_worksheet,
    upsert_worksheet_from_data,
    worksheet_id_from_filename,
    strip_reference_answers_for_student,
)


class SubmitResultRequest(BaseModel):
    worksheet_id: str
    title: str
    score: int | None = None
    total: int
    answers: list


class SubmitWritingRequest(BaseModel):
    title: str
    body: str


class GradeWritingRequest(BaseModel):
    grade: str
    feedback: str = ""


class EvaluateResultRequest(BaseModel):
    marks: list


class FocusEvaluationRequest(BaseModel):
    export_version: int | None = None
    result_id: int | None = None
    worksheet_id: str | None = None
    title: str | None = None
    subject: str | None = None
    questions: list


class MarkFocusAreaDiscussedRequest(BaseModel):
    subject: str
    area: str


class SaveDraftRequest(BaseModel):
    answers: dict


class WorksheetBuilderQuestionRequest(BaseModel):
    prompt: str
    choices: list[str] | None = None
    correct_index: int | None = None
    answer: str | None = None
    area: str | None = None


class CreateWorksheetBuilderRequest(BaseModel):
    title: str
    subject: str
    stars: int
    format: str
    question_count: int
    timed: bool = False
    time_limit_minutes: int | None = None
    questions: list[WorksheetBuilderQuestionRequest]


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
    grade: int


class UpdateStudentRequest(BaseModel):
    grade: int


class GenerateWorksheetDraftRequest(BaseModel):
    subject: str
    grade: int
    stars: int
    format: str
    question_count: int | None = None
    custom_prompt: str = ""


class AdminOpenAiKeyRequest(BaseModel):
    api_key: str


class GenerateLearnResourceRequest(BaseModel):
    subject: str
    grade: int
    curriculum: str
    section_title: str
    custom_prompt: str = ""


class UpdateLearnSectionRequest(BaseModel):
    title: str
    markdown: str


class ReorderLearnSectionsRequest(BaseModel):
    section_ids: list[str]


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


def _raise_if_access_locked(exc: ValueError) -> None:
    msg = str(exc)
    if "locked" in msg.lower():
        raise HTTPException(status_code=423, detail=msg)
    raise HTTPException(status_code=400, detail=msg)


@app.post("/auth/student/login")
def student_login(req: StudentLoginRequest):
    row = authenticate_student(req.name, req.password)
    if not row:
        raise HTTPException(status_code=401, detail="Invalid name or password")
    token = create_student_token(row["id"], row["name"])
    out = {"token": token, "role": "student", "name": row["name"]}
    if row.get("grade") is not None:
        out["grade"] = row["grade"]
    return out


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
        out = {"role": "student", "name": payload["name"]}
        profile = get_student_profile(payload.get("student_id"))
        if profile and profile.get("grade") is not None:
            out["grade"] = profile["grade"]
        return out
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
    payload = _payload(authorization)
    if payload.get("role") == "student":
        try:
            assert_worksheet_accessible(payload["name"], worksheet_id)
        except ValueError as exc:
            _raise_if_access_locked(exc)
    worksheet = get_worksheet(worksheet_id)
    if not worksheet:
        raise HTTPException(status_code=404, detail="Worksheet not found")
    if payload.get("role") == "student":
        worksheet = strip_reference_answers_for_student(worksheet)
    return worksheet


@app.get("/worksheets/{worksheet_id}/my-result")
def get_worksheet_my_result(worksheet_id: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    who = (
        payload["name"]
        if payload.get("role") == "student"
        else _student_context_name(payload)
    )
    result = get_student_result_for_worksheet(who, worksheet_id)
    if not result:
        raise HTTPException(status_code=404, detail="No submission yet")
    if payload.get("role") == "student" and result.get("status") == "pending":
        for a in result.get("answers") or []:
            a.pop("expected", None)
            a.pop("correct", None)
    return result


@app.delete("/worksheets/{worksheet_id}")
def remove_worksheet(worksheet_id: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if not delete_worksheet(worksheet_id):
        raise HTTPException(status_code=404, detail="Worksheet not found")
    return {"message": "Worksheet deleted"}


@app.post("/admin/worksheets/upload")
async def admin_upload_worksheet(
    file: UploadFile = File(...),
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    ws_id = worksheet_id_from_filename(file.filename or "")
    if not ws_id:
        raise HTTPException(
            status_code=400,
            detail="Filename must be questions_N.json (e.g. questions_54.json).",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="File must be valid UTF-8 JSON.")

    try:
        result = upsert_worksheet_from_data(ws_id, data)
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid worksheet data."]
        if isinstance(errors, list):
            detail = errors
        else:
            detail = [str(errors)]
        raise HTTPException(status_code=400, detail=detail)

    return result


@app.post("/admin/worksheets/create")
def admin_create_worksheet_from_builder(
    req: CreateWorksheetBuilderRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return create_worksheet_from_builder(req.model_dump())
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid worksheet data."]
        if isinstance(errors, list):
            detail = errors
        else:
            detail = [str(errors)]
        raise HTTPException(status_code=400, detail=detail)


@app.post("/admin/worksheets/generate-draft")
def admin_generate_worksheet_draft(
    req: GenerateWorksheetDraftRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        api_key = resolve_openai_api_key(payload["admin_id"])
        if not api_key:
            raise HTTPException(
                status_code=400,
                detail="Add your OpenAI API key under Admin → Settings.",
            )
        return generate_worksheet_draft(
            subject=req.subject,
            grade=req.grade,
            stars=req.stars,
            fmt=req.format,
            question_count=req.question_count,
            custom_prompt=req.custom_prompt,
            api_key=api_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/admin/learn/generate-and-publish")
def admin_generate_learn_resource(
    req: GenerateLearnResourceRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        api_key = resolve_openai_api_key(payload["admin_id"])
        if not api_key:
            raise HTTPException(
                status_code=400,
                detail="Add your OpenAI API key under Admin → Settings.",
            )
        draft = generate_learn_resource(
            subject=req.subject,
            grade=req.grade,
            curriculum=req.curriculum,
            section_title=req.section_title,
            custom_prompt=req.custom_prompt,
            api_key=api_key,
        )
        subject_key = learn_collection_key(
            subject=req.subject,
            grade=req.grade,
            curriculum=req.curriculum,
        )
        subject_labels = {
            "math": "Math",
            "english": "English",
            "science": "Science",
            "data": "Data analysis",
            "general": "General",
        }
        subj_label = subject_labels.get(req.subject.strip().lower(), req.subject)
        return publish_learn_section(
            subject_key=subject_key,
            section_title=draft["section_title"],
            markdown=draft["markdown"],
            subject_title=subj_label,
            subject_description=f"Grade {req.grade} · {req.curriculum.strip()}",
            grade=req.grade,
            curriculum=req.curriculum,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/admin/learn/sections")
def admin_list_learn_sections(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return {"sections": list_admin_learn_sections()}


@app.put("/admin/learn/{subject_key}/reorder")
def admin_reorder_learn_sections(
    subject_key: str,
    req: ReorderLearnSectionsRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return reorder_learn_sections(
            subject_key=subject_key,
            section_ids=req.section_ids,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.put("/admin/learn/{subject_key}/{section_id}")
def admin_update_learn_section(
    subject_key: str,
    section_id: str,
    req: UpdateLearnSectionRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return update_learn_section(
            subject_key=subject_key,
            section_id=section_id,
            title=req.title,
            markdown=req.markdown,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.delete("/admin/learn/{subject_key}/{section_id}")
def admin_delete_learn_section(
    subject_key: str,
    section_id: str,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return delete_learn_section(subject_key=subject_key, section_id=section_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/admin/settings")
def admin_get_settings(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    ai_disabled = os.environ.get("QUILL_AI_ENABLED", "").strip().lower() in (
        "0",
        "false",
        "no",
    )
    return {
        "openai_key_configured": admin_openai_key_configured(payload["admin_id"]),
        "ai_enabled": not ai_disabled,
    }


@app.put("/admin/settings/openai-key")
def admin_set_openai_key(
    req: AdminOpenAiKeyRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        set_admin_openai_api_key(payload["admin_id"], req.api_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"message": "OpenAI API key saved.", "openai_key_configured": True}


@app.delete("/admin/settings/openai-key")
def admin_clear_openai_key(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    clear_admin_openai_api_key(payload["admin_id"])
    return {"message": "OpenAI API key removed.", "openai_key_configured": False}


@app.get("/worksheets/{worksheet_id}/draft")
def get_worksheet_draft_route(worksheet_id: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can load drafts")
    try:
        assert_worksheet_accessible(payload["name"], worksheet_id)
    except ValueError as exc:
        _raise_if_access_locked(exc)
    draft = get_worksheet_draft(payload["name"], worksheet_id)
    if not draft:
        raise HTTPException(status_code=404, detail="No saved progress")
    return draft


@app.put("/worksheets/{worksheet_id}/draft")
def save_worksheet_draft_route(
    worksheet_id: str, req: SaveDraftRequest, authorization: str = Header(...)
):
    payload = _payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can save drafts")
    try:
        return save_worksheet_draft(payload["name"], worksheet_id, req.answers)
    except ValueError as exc:
        msg = str(exc)
        if "locked" in msg.lower():
            raise HTTPException(status_code=423, detail=msg)
        raise HTTPException(status_code=400, detail=msg)


@app.post("/worksheets/{worksheet_id}/timed-session")
def start_timed_session_route(
    worksheet_id: str,
    resume: bool = False,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can start timed sessions")
    try:
        return get_or_start_timed_session(payload["name"], worksheet_id, resume=resume)
    except ValueError as exc:
        msg = str(exc)
        if "locked" in msg.lower():
            raise HTTPException(status_code=423, detail=msg)
        code = 409 if "already submitted" in msg else 400
        raise HTTPException(status_code=code, detail=msg)


@app.get("/worksheets/{worksheet_id}/timed-session")
def get_timed_session_route(
    worksheet_id: str,
    resume: bool = False,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can access timed sessions")
    try:
        return get_or_start_timed_session(payload["name"], worksheet_id, resume=resume)
    except ValueError as exc:
        msg = str(exc)
        if "locked" in msg.lower():
            raise HTTPException(status_code=423, detail=msg)
        code = 409 if "already submitted" in msg else 400
        raise HTTPException(status_code=code, detail=msg)


@app.post("/worksheets/{worksheet_id}/lock-timed")
def lock_timed_worksheet_route(worksheet_id: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can lock timed worksheets")
    lock_timed_worksheet(payload["name"], worksheet_id)
    return {"message": "Locked"}


@app.post("/admin/worksheets/{worksheet_id}/unlock-timed")
def admin_unlock_timed_worksheet(worksheet_id: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    try:
        unlock_timed_worksheet(who, worksheet_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"message": "Unlocked"}


class UnlockGiftedWeekRequest(BaseModel):
    week: int


class WorksheetAccessLockRequest(BaseModel):
    locked: bool


class LockGiftedWeekRequest(BaseModel):
    week: int


@app.post("/admin/gifted-track/lock-week")
def admin_lock_gifted_track_week(
    req: LockGiftedWeekRequest, authorization: str = Header(...)
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    try:
        lock_gifted_track_week(who, req.week)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"message": f"Week {req.week} locked."}


@app.post("/admin/gifted-track/unlock-week")
def admin_unlock_gifted_track_week(
    req: UnlockGiftedWeekRequest, authorization: str = Header(...)
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    try:
        through = unlock_gifted_track_week(who, req.week)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"message": f"Week {req.week} unlocked.", "gifted_track_unlocked_through_week": through}


@app.post("/admin/worksheets/{worksheet_id}/access-lock")
def admin_set_worksheet_access_lock(
    worksheet_id: str,
    req: WorksheetAccessLockRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    try:
        if req.locked:
            set_worksheet_access_lock(who, worksheet_id, locked=True)
        else:
            set_worksheet_access_lock(who, worksheet_id, locked=False)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"message": "Locked" if req.locked else "Unlocked"}


@app.post("/admin/worksheets/{worksheet_id}/clear-access-lock")
def admin_clear_worksheet_access_lock(
    worksheet_id: str, authorization: str = Header(...)
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    clear_worksheet_access_lock(who, worksheet_id)
    return {"message": "Access override cleared"}


@app.post("/results")
def submit_result(req: SubmitResultRequest, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can submit results")

    worksheet = get_worksheet(req.worksheet_id)
    if not worksheet:
        raise HTTPException(status_code=404, detail="Worksheet not found")

    student = context_student_name(payload)
    try:
        assert_worksheet_accessible(student, req.worksheet_id)
    except ValueError as exc:
        _raise_if_access_locked(exc)
    if student_has_result_for_worksheet(student, req.worksheet_id):
        raise HTTPException(status_code=409, detail="You already submitted this worksheet")

    manual = worksheet.get("evaluation") == "manual"
    answer_by_qid = {
        a.get("question_id"): a
        for a in req.answers
        if isinstance(a, dict) and a.get("question_id")
    }

    if manual:
        answers_payload = []
        for q in worksheet.get("questions") or []:
            qid = q.get("id")
            entry = answer_by_qid.get(qid) or {}
            if not isinstance(entry, dict):
                entry = {"given": entry}
            mode = entry.get("response_mode")
            if mode not in ("text", "scratchpad"):
                mode = "scratchpad" if entry.get("scratchpad") else "text"
            row = {
                "question_id": qid,
                "prompt": q.get("prompt", ""),
                "given": entry.get("given", "") or "",
                "correct": None,
                "expected": q.get("answer", ""),
                "response_mode": mode,
            }
            if entry.get("scratchpad"):
                row["scratchpad"] = entry["scratchpad"]
            if isinstance(q.get("area"), str) and q.get("area").strip():
                row["area"] = q["area"]
            answers_payload.append(row)
        result = {
            "worksheet_id": req.worksheet_id,
            "title": req.title,
            "student": student,
            "score": None,
            "total": req.total,
            "answers": attach_areas_to_answers(worksheet, answers_payload),
            "status": "pending",
        }
    else:
        answers_payload = attach_areas_to_answers(worksheet, req.answers)
        score = req.score if req.score is not None else 0
        result = {
            "worksheet_id": req.worksheet_id,
            "title": req.title,
            "student": student,
            "score": score,
            "total": req.total,
            "answers": answers_payload,
            "status": "evaluated",
        }

    save_result(result)
    return {"message": "Result saved", "status": result["status"]}


@app.post("/results/{result_id}/evaluate")
def evaluate_submission(
    result_id: int, req: EvaluateResultRequest, authorization: str = Header(...)
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    try:
        updated = evaluate_result(result_id, who, req.marks)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return updated


@app.post("/results/{result_id}/focus-evaluation")
def upload_focus_evaluation(
    result_id: int, req: FocusEvaluationRequest, authorization: str = Header(...)
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    try:
        updated = save_focus_evaluation(result_id, who, req.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not updated:
        raise HTTPException(status_code=404, detail="Result not found")
    return updated


@app.post("/results/{result_id}/analyze")
def analyze_result_focus(result_id: int, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    try:
        updated = analyze_result_for_focus(result_id, who)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not updated:
        raise HTTPException(status_code=404, detail="Result not found")
    return updated


@app.get("/focus-areas/discussed")
def get_focus_areas_discussed(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    return list_focus_areas_discussed(who)


@app.post("/focus-areas/discussed")
def mark_focus_area_discussed_route(
    req: MarkFocusAreaDiscussedRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    try:
        return mark_focus_area_discussed(who, req.subject, req.area)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.delete("/results/{result_id}")
def remove_result(result_id: int, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    if not delete_result(result_id, who):
        raise HTTPException(status_code=404, detail="Result not found")
    return {"message": "Result deleted"}


@app.get("/results")
def get_results(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") == "student":
        return list_results(payload["name"], for_student_view=True)
    if payload.get("role") == "admin":
        who = _student_context_name(payload)
        return list_results(who)
    raise HTTPException(status_code=403, detail="Admin or student only")


@app.get("/writing/submissions")
def get_writing_submissions(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") == "student":
        return list_writing_submissions(payload["name"])
    if payload.get("role") == "admin":
        who = _student_context_name(payload)
        return list_writing_submissions(who)
    raise HTTPException(status_code=403, detail="Admin or student only")


@app.post("/writing/submissions")
def submit_writing(req: SubmitWritingRequest, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can submit writing")
    try:
        return save_writing_submission(
            student=context_student_name(payload),
            title=req.title,
            body=req.body,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.delete("/writing/submissions/{submission_id}")
def delete_writing_submission_route(
    submission_id: int,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    if not delete_writing_submission(submission_id, who):
        raise HTTPException(status_code=404, detail="Writing submission not found")
    return {"message": "Writing submission deleted"}


@app.post("/writing/submissions/{submission_id}/grade")
def grade_writing_submission_route(
    submission_id: int,
    req: GradeWritingRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    try:
        updated = grade_writing_submission(
            submission_id, who, req.grade, req.feedback
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not updated:
        raise HTTPException(status_code=404, detail="Writing submission not found")
    return updated


@app.get("/learn/subjects")
def learn_subjects(authorization: str = Header(...)):
    payload = _payload(authorization)
    hub = list_learn_hub()
    if payload.get("role") == "admin":
        hub["editable_sections"] = list_admin_learn_sections()
    return hub


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
        sid = add_student(payload["admin_id"], name, req.password, req.grade)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="A student with that name already exists for your account",
        )
    return {"id": sid, "name": name, "grade": req.grade}


@app.patch("/admin/students/{student_id}")
def admin_update_student(
    student_id: int,
    req: UpdateStudentRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        updated = update_student_grade(payload["admin_id"], student_id, req.grade)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not updated:
        raise HTTPException(status_code=404, detail="Student not found")
    return updated


@app.delete("/admin/students/{student_id}")
def admin_delete_student(student_id: int, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    deleted = delete_student(payload["admin_id"], student_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Student not found")
    out: dict = {"message": "Student deleted", "deleted": deleted}
    if payload.get("student_id") == student_id or payload.get("student_name") == deleted["name"]:
        an = payload.get("admin_name") or get_admin_name(payload["admin_id"])
        out["token"] = create_admin_token(
            payload["admin_id"],
            None,
            None,
            admin_name=an,
        )
        out["needs_student"] = True
    return out


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
        "grade": row.get("grade"),
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
