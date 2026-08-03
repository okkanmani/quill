import json
import os
import sqlite3
from contextlib import asynccontextmanager

from auth import context_student_name, create_admin_token, create_student_token, verify_token
from auth_users import (
    add_admin,
    add_student,
    authenticate_admin_by_name,
    authenticate_student,
    delete_student,
    get_admin_name,
    get_student_by_admin_and_name,
    get_student_admin_id,
    get_student_profile,
    list_students_for_admin,
    update_student_grade,
    update_student_by_admin,
    update_admin_account,
)
from admin_home import build_admin_home
from student_home import build_student_home
from tenancy import resolve_admin_id
from admin_secrets import (
    admin_openai_key_configured,
    clear_admin_openai_api_key,
    resolve_openai_api_key,
    set_admin_openai_api_key,
)
from admin_preferences import (
    expert_json_warning_enabled,
    set_expert_json_warning_enabled,
)
from ai_worksheet import generate_worksheet_draft, generate_test_draft
from ai_learn import generate_learn_resource
from ai_focus_discussion import generate_focus_discussion_reference
from focus_practice import (
    build_manual_focus_practice_worksheet,
    generate_focus_practice_worksheet,
)
from fastapi import FastAPI, File, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from learn_notes import (
    generate_and_save_note,
    list_notes_for_subject,
    save_note,
)
from learn_highlights import (
    list_highlights_for_subject,
    save_highlights,
)
from learn_storage import fetch_learn_object
from learn_content import (
    delete_learn_section,
    get_subject,
    learn_collection_key,
    list_admin_learn_sections,
    list_learn_hub,
    list_learn_link_options,
    list_subjects,
    publish_learn_section,
    reorder_learn_hub_collections,
    reorder_learn_sections,
    update_learn_section,
)
from focus_discussion import list_focus_areas_discussed, mark_focus_area_discussed
from revision import (
    complete_revision_worksheet,
    get_revision_worksheet,
    list_revision_analysis_records,
    list_revision_practice_display_records,
    list_practice_results,
    list_revision_worksheets,
    save_revision_worksheet,
)
from tests import (
    complete_test_review,
    delete_test_attempt,
    get_or_start_test_session,
    get_test_review,
    list_test_results,
    list_test_reviews,
    list_tests,
    mark_test_attempt_analyzed,
    lock_test_attempt,
    save_test_answer,
    save_test_review_notes,
    save_test_scratchpad,
    submit_test,
    unlock_test_attempt,
)
from composite_tests import (
    abandon_composite_sitting,
    create_composite_test,
    delete_composite_test,
    delete_composite_test_result,
    get_composite_hub,
    get_composite_test,
    list_composite_test_results,
    list_composite_tests,
    list_composites_for_student,
    list_eligible_section_worksheets,
    lock_composite_for_admin_students,
    schedule_composite_unlock_for_admin,
    start_composite_attempt,
    submit_composite,
    unlock_composite_for_admin_students,
    unlock_composite_sitting,
    update_composite_test,
)
from question_bank_passages import (
    create_question_bank_passage,
    delete_question_bank_passage,
    get_question_bank_passage,
    list_question_bank_passages,
    update_question_bank_passage,
)
from question_bank import (
    bulk_create_question_bank_items,
    create_question_bank_item,
    delete_question_bank_item,
    get_question_bank_item,
    list_question_bank_items,
    list_question_bank_areas,
    lookup_question_bank_areas,
    save_worksheet_question_to_bank,
    save_worksheet_context_to_bank,
    update_question_bank_item,
)
from writing import (
    delete_writing_submission,
    grade_writing_submission,
    list_writing_submissions,
    save_writing_submission,
)
from worksheets import (
    assert_worksheet_accessible,
    assert_worksheet_owned_by_admin,
    attach_areas_to_answers,
    clear_worksheet_access_lock,
    create_worksheet_from_builder,
    create_test_from_builder,
    set_worksheet_access_lock_for_admin_students,
    update_worksheet_from_builder,
    update_worksheet_title,
    update_test_from_builder,
    delete_worksheet,
    delete_result,
    evaluate_result,
    generate_worksheet_id,
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
    validate_worksheet_data,
    strip_reference_answers_for_student,
    restore_worksheet,
)
from worksheet_sections import (
    assign_worksheet_section,
    create_section,
    list_sections_for_admin,
    move_section,
    organize_unassigned_worksheets,
    delete_section,
    restore_sections,
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


class WorksheetBuilderPassageRequest(BaseModel):
    id: str | None = None
    title: str
    body: str
    tier: int | None = None
    stars: int | None = None
    chart: dict | None = None
    table: dict | None = None


class WorksheetBuilderQuestionRequest(BaseModel):
    prompt: str
    choices: list[str] | None = None
    correct_index: int | None = None
    answer: str | None = None
    area: str | None = None
    passage_id: str | None = None


class CreateWorksheetBuilderRequest(BaseModel):
    title: str
    subject: str
    stars: int
    format: str
    question_count: int
    timed: bool = False
    time_limit_minutes: int | None = None
    english_type: str | None = None
    passages: list[WorksheetBuilderPassageRequest] | None = None
    learn_subject: str | None = None
    learn_section: str | None = None
    content_badge: str | None = None
    lock_on_create: bool = False
    scratchpad: bool | None = None
    questions: list[WorksheetBuilderQuestionRequest]


class WorksheetTitlePatchRequest(BaseModel):
    title: str


class StudentLoginRequest(BaseModel):
    admin_name: str
    name: str
    password: str


class AdminLoginRequest(BaseModel):
    admin_name: str
    password: str


class CreateAdminSignupRequest(BaseModel):
    name: str
    password: str


class CreateStudentRequest(BaseModel):
    name: str
    password: str
    grade: int
    curriculum: str | None = None


class UpdateStudentRequest(BaseModel):
    name: str | None = None
    grade: int | None = None
    password: str | None = None
    curriculum: str | None = None


class UpdateAccountRequest(BaseModel):
    current_password: str
    name: str | None = None
    new_password: str | None = None


class GenerateWorksheetDraftPassageSpec(BaseModel):
    id: str | None = None
    question_count: int
    prompt: str = ""
    min_words: int | None = None


class GenerateWorksheetDraftRequest(BaseModel):
    subject: str
    grade: int
    stars: int
    format: str
    question_count: int | None = None
    custom_prompt: str = ""
    english_type: str | None = None
    min_words: int | None = None
    passage_specs: list[GenerateWorksheetDraftPassageSpec] | None = None


class GenerateTestDraftRequest(BaseModel):
    subject: str
    grade: int
    sitting_count: int
    adaptive: bool = True
    custom_prompt: str = ""
    english_type: str | None = None
    questions_per_passage: int | None = None
    min_words: int | None = None


class TestBuilderQuestionRequest(BaseModel):
    id: str | None = None
    type: str = "multiple_choice"
    stars: int
    prompt: str
    choices: list[str]
    answer: str
    hint: bool = False
    area: str | None = None
    passage_id: str | None = None


class CreateTestBuilderRequest(BaseModel):
    title: str
    subject: str
    test_sitting_count: int
    test_adaptive: bool = True
    time_limit_minutes: int
    questions: list[TestBuilderQuestionRequest]
    passages: list[WorksheetBuilderPassageRequest] | None = None
    english_type: str | None = None
    test_rc_questions_per_passage: int | None = None
    content_badge: str | None = "Test"
    lock_on_create: bool = False
    scheduled_unlock_at: str | None = None
    unlock_students_now: bool = False


class TestScheduleUnlockRequest(BaseModel):
    unlock_at: str
    student_name: str | None = None


class CreateCompositeTestRequest(BaseModel):
    title: str
    section_worksheet_ids: list[str]
    lock_on_create: bool = False
    scheduled_unlock_at: str | None = None


class UpdateCompositeTestRequest(BaseModel):
    title: str
    section_worksheet_ids: list[str]
    scheduled_unlock_at: str | None = None
    unlock_students_now: bool = False


class CompositeLockRequest(BaseModel):
    student_name: str | None = None
    scheduled_unlock_at: str | None = None


class CompositeUnlockSittingRequest(BaseModel):
    composite_id: str
    student_name: str


class QuestionBankItemRequest(BaseModel):
    subject: str
    stars: int
    prompt: str
    choices: list[str]
    answer: str
    area: str | None = ""
    source: str | None = "manual"
    passage_id: str | None = None


class QuestionBankPassageRequest(BaseModel):
    subject: str = "english"
    title: str
    body: str
    chart: dict | None = None
    table: dict | None = None
    source: str | None = "manual"


class QuestionBankBulkRequest(BaseModel):
    subject: str
    source: str | None = "manual"
    questions: list[TestBuilderQuestionRequest]


class WorksheetQuestionBankQuestionRequest(BaseModel):
    prompt: str
    choices: list[str]
    answer: str
    area: str | None = ""


class WorksheetQuestionBankPassageRequest(BaseModel):
    title: str
    body: str | None = ""
    chart: dict | None = None
    table: dict | None = None


class WorksheetQuestionBankSaveRequest(BaseModel):
    subject: str
    stars: int
    source: str | None = "imported"
    question: WorksheetQuestionBankQuestionRequest
    passage: WorksheetQuestionBankPassageRequest | None = None


class WorksheetContextBankSaveRequest(BaseModel):
    subject: str
    stars: int
    source: str | None = "imported"
    passage: WorksheetQuestionBankPassageRequest
    questions: list[WorksheetQuestionBankQuestionRequest]


class AdminOpenAiKeyRequest(BaseModel):
    api_key: str


class AdminPreferencesRequest(BaseModel):
    expert_json_warning_enabled: bool


class GenerateLearnResourceRequest(BaseModel):
    subject: str
    grade: int
    curriculum: str
    section_title: str
    topic: str = ""
    custom_prompt: str = ""


class FocusDiscussionExample(BaseModel):
    question: str
    answer: str = ""
    expected: str = ""
    choices: list[str] | None = None


class GenerateFocusDiscussionReferenceRequest(BaseModel):
    subject: str
    area: str
    examples: list[FocusDiscussionExample]
    grade: int | None = None


class GenerateFocusPracticeRequest(BaseModel):
    subject: str
    area: str
    examples: list[FocusDiscussionExample] | None = None
    grade: int | None = None
    use_ai: bool = False


class ManualFocusPracticeQuestionRequest(BaseModel):
    prompt: str
    choices: list[str]
    answer: str
    stars: int = 2
    hint: bool | None = None
    hint_context: str | None = None


class SaveManualFocusPracticeRequest(BaseModel):
    subject: str
    area: str
    questions: list[ManualFocusPracticeQuestionRequest]
    grade: int | None = None
    title: str | None = None


class CompleteRevisionRequest(BaseModel):
    score: int
    total: int
    answers: list[dict] | None = None


class TestAnswerRequest(BaseModel):
    slot: int
    given: str = ""
    responses: dict[str, str] | None = None


class TestScratchpadRequest(BaseModel):
    slot: int
    scratchpad: str = ""
    work_text: str | None = None
    work_mode: str | None = None


class TestReviewNotesRequest(BaseModel):
    questions: list[dict]


class PublishLearnResourceRequest(BaseModel):
    subject: str
    grade: int
    curriculum: str
    section_title: str
    topic: str = ""
    markdown: str


class UpdateLearnSectionRequest(BaseModel):
    title: str
    markdown: str
    topic: str = ""


class ReorderLearnSectionsRequest(BaseModel):
    section_ids: list[str]


class ReorderLearnHubRequest(BaseModel):
    scope: str
    subject_keys: list[str]


class SaveLearnNoteRequest(BaseModel):
    body: str = ""


class GenerateLearnNoteRequest(BaseModel):
    page_markdown: str
    section_title: str = ""
    subject_title: str = ""


class SaveLearnHighlightsRequest(BaseModel):
    highlights: list = []


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
        "https://quill-app-staging.fly.dev",
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


def _learn_notes_student(payload: dict) -> str:
    """Student whose learn notes are being viewed or edited."""
    if payload.get("role") == "student":
        return payload["name"]
    if payload.get("role") == "admin" and payload.get("student_name"):
        return payload["student_name"]
    raise HTTPException(
        status_code=403,
        detail="Notes are available for students, or for admins after choosing a student.",
    )


def _learn_notes_admin_id(payload: dict) -> int | None:
    if payload.get("role") == "student":
        return get_student_admin_id(payload.get("student_id"))
    if payload.get("role") == "admin":
        return payload.get("admin_id")
    return None


def _raise_if_access_locked(exc: ValueError) -> None:
    msg = str(exc)
    if "locked" in msg.lower():
        raise HTTPException(status_code=423, detail=msg)
    raise HTTPException(status_code=400, detail=msg)


def _admin_id(payload: dict) -> int:
    try:
        return resolve_admin_id(payload)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


def _raise_if_worksheet_not_found(exc: ValueError) -> None:
    raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/auth/student/login")
def student_login(req: StudentLoginRequest):
    row = authenticate_student(req.admin_name, req.name, req.password)
    if not row:
        raise HTTPException(
            status_code=401,
            detail="Invalid admin name, student name, or password",
        )
    token = create_student_token(row["id"], row["name"])
    out = {"token": token, "role": "student", "name": row["name"]}
    if row.get("grade") is not None:
        out["grade"] = row["grade"]
    if row.get("curriculum"):
        out["curriculum"] = row["curriculum"]
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
    adm = req.admin_name.strip()
    if not adm:
        raise HTTPException(status_code=400, detail="Admin name is required")
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
        if profile and profile.get("curriculum"):
            out["curriculum"] = profile["curriculum"]
        return out
    an = payload.get("admin_name") or get_admin_name(payload["admin_id"])
    return {
        "role": "admin",
        "student_name": payload.get("student_name"),
        "admin_name": an,
        "needs_student": not bool(payload.get("student_name")),
    }


@app.put("/auth/admin/account")
def update_admin_account_route(
    req: UpdateAccountRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        updated = update_admin_account(
            payload["admin_id"],
            current_password=req.current_password,
            name=req.name,
            new_password=req.new_password,
        )
    except ValueError as exc:
        msg = str(exc)
        status = 409 if "taken" in msg.lower() else 400
        raise HTTPException(status_code=status, detail=msg)
    token = create_admin_token(
        payload["admin_id"],
        payload.get("student_id"),
        payload.get("student_name"),
        admin_name=updated["name"],
    )
    return {
        "token": token,
        "role": "admin",
        "admin_name": updated["name"],
        "student_name": payload.get("student_name"),
        "message": "Account updated.",
    }


@app.get("/worksheets")
def get_worksheets(authorization: str = Header(...)):
    payload = _payload(authorization)
    admin_id = _admin_id(payload)
    if payload.get("role") == "student":
        who = payload["name"]
    elif payload.get("role") == "admin":
        who = payload.get("student_name") or None
    else:
        raise HTTPException(status_code=403, detail="Invalid role")
    return list_worksheets(student_name=who, admin_id=admin_id)


@app.get("/worksheets/{worksheet_id}")
def get_worksheet_by_id(worksheet_id: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    admin_id = _admin_id(payload)
    if payload.get("role") == "student":
        try:
            assert_worksheet_accessible(payload["name"], worksheet_id, admin_id=admin_id)
        except ValueError as exc:
            _raise_if_access_locked(exc)
    worksheet = get_worksheet(worksheet_id, admin_id=admin_id)
    if not worksheet:
        raise HTTPException(status_code=404, detail="Worksheet not found")
    if payload.get("role") == "student" and worksheet.get("is_test"):
        raise HTTPException(
            status_code=403,
            detail="Open this test from the Tests page.",
        )
    if payload.get("role") == "student":
        worksheet = strip_reference_answers_for_student(worksheet)
        worksheet.pop("admin_code", None)
    elif worksheet.get("is_test"):
        from test_scheduling import summarize_test_unlock_schedule

        worksheet["unlock_schedule"] = summarize_test_unlock_schedule(
            admin_id, worksheet_id
        )
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
    if not delete_worksheet(worksheet_id, admin_id=_admin_id(payload)):
        raise HTTPException(status_code=404, detail="Worksheet not found")
    return {"message": "Worksheet deleted"}


class RestoreWorksheetRequest(BaseModel):
    data: dict
    admin_section_id: str | None = None
    sort_ts: int | None = None


@app.post("/admin/worksheets/{worksheet_id}/restore")
async def admin_restore_worksheet(
    worksheet_id: str,
    req: RestoreWorksheetRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if not isinstance(req.data, dict):
        raise HTTPException(status_code=400, detail="Worksheet data must be an object.")
    try:
        return restore_worksheet(
            worksheet_id,
            req.data,
            admin_id=_admin_id(payload),
            admin_section_id=req.admin_section_id,
            sort_ts=req.sort_ts,
        )
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid worksheet data."]
        if isinstance(errors, list):
            detail = errors
        else:
            detail = [str(errors)]
        raise HTTPException(status_code=400, detail=detail)


class RestoreWorksheetSectionsRequest(BaseModel):
    sections: list[dict]
    assignments: list[dict] | None = None


@app.post("/admin/worksheet-sections/restore")
def admin_restore_worksheet_sections(
    req: RestoreWorksheetSectionsRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return restore_sections(
            admin_id=_admin_id(payload),
            sections=req.sections,
            assignments=req.assignments,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/admin/worksheets/upload")
async def admin_upload_worksheet(
    file: UploadFile = File(...),
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="Upload must be a .json file.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="File must be valid UTF-8 JSON.")

    subject = data.get("subject", "general")
    try:
        ws_id = generate_worksheet_id(subject)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        result = upsert_worksheet_from_data(ws_id, data, admin_id=_admin_id(payload))
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid worksheet data."]
        if isinstance(errors, list):
            detail = errors
        else:
            detail = [str(errors)]
        raise HTTPException(status_code=400, detail=detail)

    return result


@app.post("/admin/worksheets/validate")
async def admin_validate_worksheet(
    request: Request,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    try:
        data = await request.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail=["Request body must be valid JSON."])

    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail=["JSON must be an object."])

    errors = validate_worksheet_data(data)
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    questions = data.get("questions") or []
    return {
        "valid": True,
        "title": data.get("title"),
        "subject": str(data.get("subject", "general")).strip().lower(),
        "question_count": len(questions),
        "is_test": data.get("is_test") is True,
    }


@app.get("/admin/learn/link-options")
def admin_learn_link_options(
    worksheet_subject: str,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return {"options": list_learn_link_options(worksheet_subject, admin_id=_admin_id(payload))}


@app.get("/admin/resource-code/preview")
def admin_preview_resource_code(
    subject: str,
    authorization: str = Header(...),
    is_test: bool = False,
    timed: bool = False,
    for_learn: bool = False,
    english_type: str | None = None,
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    import db
    from admin_resource_codes import preview_admin_code

    conn = db.connect()
    try:
        preview = preview_admin_code(
            conn,
            _admin_id(payload),
            subject,
            is_test=is_test,
            is_timed=timed,
            for_learn=for_learn,
            english_type=english_type,
        )
    finally:
        conn.close()
    return {"preview": preview}


@app.post("/admin/worksheets/create")
def admin_create_worksheet_from_builder(
    req: CreateWorksheetBuilderRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    body = req.model_dump()
    lock_on_create = bool(body.pop("lock_on_create", False))
    try:
        result = create_worksheet_from_builder(body, admin_id=_admin_id(payload))
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid worksheet data."]
        if isinstance(errors, list):
            detail = errors
        else:
            detail = [str(errors)]
        raise HTTPException(status_code=400, detail=detail)
    if lock_on_create:
        locked_count = set_worksheet_access_lock_for_admin_students(
            payload["admin_id"],
            result["id"],
            locked=True,
        )
        result["locked_for_students"] = locked_count
    return result


@app.put("/admin/worksheets/{worksheet_id}")
def admin_update_worksheet_from_builder(
    worksheet_id: str,
    req: CreateWorksheetBuilderRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    body = req.model_dump()
    body.pop("lock_on_create", None)
    try:
        return update_worksheet_from_builder(
            worksheet_id, body, admin_id=_admin_id(payload)
        )
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid worksheet data."]
        if isinstance(errors, list):
            detail = errors
        else:
            detail = [str(errors)]
        raise HTTPException(status_code=400, detail=detail)


@app.patch("/admin/worksheets/{worksheet_id}/title")
def admin_patch_worksheet_title(
    worksheet_id: str,
    req: WorksheetTitlePatchRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return update_worksheet_title(
            worksheet_id,
            req.title,
            admin_id=_admin_id(payload),
        )
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid title."]
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
        body = req.model_dump()
        return generate_worksheet_draft(
            subject=req.subject,
            grade=req.grade,
            stars=req.stars,
            fmt=req.format,
            question_count=req.question_count,
            custom_prompt=req.custom_prompt,
            english_type=body.get("english_type") or "",
            min_words=req.min_words,
            passage_specs=(
                [spec.model_dump() for spec in req.passage_specs]
                if req.passage_specs
                else None
            ),
            api_key=api_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/admin/tests/create")
def admin_create_test_from_builder(
    req: CreateTestBuilderRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    body = req.model_dump()
    lock_on_create = bool(body.pop("lock_on_create", False))
    scheduled_unlock_at = body.pop("scheduled_unlock_at", None)
    try:
        result = create_test_from_builder(body, admin_id=_admin_id(payload))
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid test data."]
        if isinstance(errors, list):
            detail = errors
        else:
            detail = [str(errors)]
        raise HTTPException(status_code=400, detail=detail)
    if scheduled_unlock_at:
        from test_scheduling import schedule_test_unlock_for_admin

        try:
            locked_count = schedule_test_unlock_for_admin(
                payload["admin_id"],
                result["id"],
                scheduled_unlock_at,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        result["locked_for_students"] = locked_count
        result["scheduled_unlock_at"] = scheduled_unlock_at
    elif lock_on_create:
        locked_count = set_worksheet_access_lock_for_admin_students(
            payload["admin_id"],
            result["id"],
            locked=True,
        )
        result["locked_for_students"] = locked_count
    return result


@app.post("/admin/tests/{worksheet_id}/schedule-unlock")
def admin_schedule_test_unlock(
    worksheet_id: str,
    req: TestScheduleUnlockRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    from test_scheduling import schedule_test_unlock_for_admin

    try:
        count = schedule_test_unlock_for_admin(
            _admin_id(payload),
            worksheet_id,
            req.unlock_at,
            student_name=req.student_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "message": "Scheduled unlock updated.",
        "students_affected": count,
        "unlock_at": req.unlock_at,
    }


@app.put("/admin/tests/{worksheet_id}")
def admin_update_test_from_builder(
    worksheet_id: str,
    req: CreateTestBuilderRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    body = req.model_dump()
    body.pop("lock_on_create", None)
    scheduled_unlock_at = body.pop("scheduled_unlock_at", None)
    unlock_students_now = bool(body.pop("unlock_students_now", False))
    try:
        result = update_test_from_builder(
            worksheet_id, body, admin_id=_admin_id(payload)
        )
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid test data."]
        if isinstance(errors, list):
            detail = errors
        else:
            detail = [str(errors)]
        raise HTTPException(status_code=400, detail=detail)
    admin_id = _admin_id(payload)
    if scheduled_unlock_at:
        from test_scheduling import schedule_test_unlock_for_admin

        try:
            count = schedule_test_unlock_for_admin(
                admin_id,
                worksheet_id,
                scheduled_unlock_at,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        result["locked_for_students"] = count
        result["scheduled_unlock_at"] = scheduled_unlock_at
    elif unlock_students_now:
        count = set_worksheet_access_lock_for_admin_students(
            admin_id,
            worksheet_id,
            locked=False,
        )
        result["unlocked_for_students"] = count
    return result


@app.get("/admin/composite-tests/eligible-worksheets")
def admin_list_eligible_composite_sections(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return list_eligible_section_worksheets(_admin_id(payload))


@app.get("/admin/composite-tests")
def admin_list_composite_tests(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return list_composite_tests(_admin_id(payload))


@app.post("/admin/composite-tests")
def admin_create_composite_test(
    req: CreateCompositeTestRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return create_composite_test(
            _admin_id(payload),
            title=req.title,
            section_worksheet_ids=req.section_worksheet_ids,
            scheduled_unlock_at=req.scheduled_unlock_at,
            lock_on_create=req.lock_on_create,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/admin/composite-tests/{composite_id}")
def admin_get_composite_test(composite_id: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return get_composite_test(composite_id, _admin_id(payload))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.put("/admin/composite-tests/{composite_id}")
def admin_update_composite_test(
    composite_id: str,
    req: UpdateCompositeTestRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return update_composite_test(
            composite_id,
            _admin_id(payload),
            title=req.title,
            section_worksheet_ids=req.section_worksheet_ids,
            scheduled_unlock_at=req.scheduled_unlock_at,
            unlock_students_now=req.unlock_students_now,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.delete("/admin/composite-tests/{composite_id}")
def admin_delete_composite_test(composite_id: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        delete_composite_test(composite_id, _admin_id(payload))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"message": "Composite test deleted."}


@app.post("/admin/composite-tests/{composite_id}/lock")
def admin_lock_composite_test(
    composite_id: str,
    req: CompositeLockRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        if req.scheduled_unlock_at:
            from test_scheduling import validate_future_unlock_at

            count = schedule_composite_unlock_for_admin(
                _admin_id(payload),
                composite_id,
                validate_future_unlock_at(req.scheduled_unlock_at),
                student_name=req.student_name,
            )
        else:
            count = lock_composite_for_admin_students(
                _admin_id(payload),
                composite_id,
                locked=True,
                student_name=req.student_name,
            )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"students_affected": count}


@app.post("/admin/composite-tests/{composite_id}/unlock")
def admin_unlock_composite_test(
    composite_id: str,
    req: CompositeLockRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        count = unlock_composite_for_admin_students(
            _admin_id(payload),
            composite_id,
            student_name=req.student_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"students_affected": count}


@app.post("/admin/composite-attempts/unlock")
def admin_unlock_composite_sitting(
    req: CompositeUnlockSittingRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        unlock_composite_sitting(
            _admin_id(payload),
            composite_id=req.composite_id,
            student_name=req.student_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"message": "Composite sitting reset."}


@app.get("/admin/composite-test-results")
def admin_composite_test_results(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    return list_composite_test_results(who)


@app.delete("/admin/composite-test-results/{composite_attempt_id}")
def remove_admin_composite_test_result(
    composite_attempt_id: int, authorization: str = Header(...)
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    if not delete_composite_test_result(composite_attempt_id, who):
        raise HTTPException(status_code=404, detail="Composite test result not found")
    return {"message": "Composite test result deleted"}


@app.post("/admin/tests/generate-draft")
def admin_generate_test_draft(
    req: GenerateTestDraftRequest,
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
        return generate_test_draft(
            subject=req.subject,
            grade=req.grade,
            sitting_count=req.sitting_count,
            adaptive=req.adaptive,
            custom_prompt=req.custom_prompt,
            api_key=api_key,
            english_type=req.english_type or "",
            questions_per_passage=req.questions_per_passage,
            min_words=req.min_words,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/admin/question-bank")
def admin_list_question_bank(
    authorization: str = Header(...),
    subject: str | None = None,
    stars: int | None = None,
    area: str | None = None,
    passage_id: str | None = None,
    standalone_only: bool = False,
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        items = list_question_bank_items(
            admin_id=_admin_id(payload),
            subject=subject,
            stars=stars,
            area=area,
            passage_id=passage_id,
            standalone_only=standalone_only,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"items": items}


@app.get("/admin/question-bank/passages")
def admin_list_question_bank_passages(
    authorization: str = Header(...),
    subject: str = Query(default="english"),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        passages = list_question_bank_passages(
            admin_id=_admin_id(payload),
            subject=subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"passages": passages}


@app.post("/admin/question-bank/passages")
def admin_create_question_bank_passage(
    req: QuestionBankPassageRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return create_question_bank_passage(
            admin_id=_admin_id(payload),
            data=req.model_dump(),
        )
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid passage."]
        detail = errors if isinstance(errors, list) else [str(errors)]
        raise HTTPException(status_code=400, detail=detail)


@app.get("/admin/question-bank/passages/{passage_id}")
def admin_get_question_bank_passage(
    passage_id: str,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    passage = get_question_bank_passage(passage_id, admin_id=_admin_id(payload))
    if not passage:
        raise HTTPException(status_code=404, detail="Passage not found")
    items = list_question_bank_items(
        admin_id=_admin_id(payload),
        passage_id=passage_id,
    )
    return {"passage": passage, "items": items}


@app.put("/admin/question-bank/passages/{passage_id}")
def admin_update_question_bank_passage(
    passage_id: str,
    req: QuestionBankPassageRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return update_question_bank_passage(
            passage_id,
            admin_id=_admin_id(payload),
            data=req.model_dump(),
        )
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid passage."]
        detail = errors if isinstance(errors, list) else [str(errors)]
        raise HTTPException(status_code=400, detail=detail)


@app.delete("/admin/question-bank/passages/{passage_id}")
def admin_delete_question_bank_passage(
    passage_id: str,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if not delete_question_bank_passage(passage_id, admin_id=_admin_id(payload)):
        raise HTTPException(status_code=404, detail="Passage not found")
    return {"message": "Deleted"}


@app.get("/admin/question-bank/areas")
def admin_list_question_bank_areas(
    authorization: str = Header(...),
    subject: str = Query(...),
    q: str | None = Query(default=None),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return lookup_question_bank_areas(
            admin_id=_admin_id(payload),
            subject=subject,
            query=q,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/admin/question-bank")
def admin_create_question_bank_item(
    req: QuestionBankItemRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        item = create_question_bank_item(
            admin_id=_admin_id(payload),
            data=req.model_dump(),
        )
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid question."]
        if isinstance(errors, list):
            detail = errors
        else:
            detail = [str(errors)]
        raise HTTPException(status_code=400, detail=detail)
    return item


@app.post("/admin/question-bank/bulk")
def admin_bulk_create_question_bank(
    req: QuestionBankBulkRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        result = bulk_create_question_bank_items(
            admin_id=_admin_id(payload),
            subject=req.subject,
            questions=[q.model_dump() for q in req.questions],
            source=req.source or "manual",
        )
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid questions."]
        if isinstance(errors, list):
            detail = errors
        else:
            detail = [str(errors)]
        raise HTTPException(status_code=400, detail=detail)
    return result


@app.post("/admin/question-bank/from-worksheet")
def admin_save_worksheet_question_to_bank(
    req: WorksheetQuestionBankSaveRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return save_worksheet_question_to_bank(
            admin_id=_admin_id(payload),
            data=req.model_dump(),
        )
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid question."]
        if isinstance(errors, list):
            detail = errors
        else:
            detail = [str(errors)]
        raise HTTPException(status_code=400, detail=detail)


@app.post("/admin/question-bank/from-worksheet-context")
def admin_save_worksheet_context_to_bank(
    req: WorksheetContextBankSaveRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return save_worksheet_context_to_bank(
            admin_id=_admin_id(payload),
            data=req.model_dump(),
        )
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid context."]
        if isinstance(errors, list):
            detail = errors
        else:
            detail = [str(errors)]
        raise HTTPException(status_code=400, detail=detail)


@app.put("/admin/question-bank/{item_id}")
def admin_update_question_bank_item(
    item_id: str,
    req: QuestionBankItemRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return update_question_bank_item(
            item_id,
            admin_id=_admin_id(payload),
            data=req.model_dump(),
        )
    except ValueError as exc:
        errors = exc.args[0] if exc.args else ["Invalid question."]
        if isinstance(errors, list):
            detail = errors
        else:
            detail = [str(errors)]
        raise HTTPException(status_code=400, detail=detail)


@app.delete("/admin/question-bank/{item_id}")
def admin_delete_question_bank_item(
    item_id: str,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if not delete_question_bank_item(item_id, admin_id=_admin_id(payload)):
        raise HTTPException(status_code=404, detail="Question bank item not found")
    return {"message": "Deleted"}


@app.post("/admin/analysis/generate-discussion-reference")
def admin_generate_focus_discussion_reference(
    req: GenerateFocusDiscussionReferenceRequest,
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
        reference = generate_focus_discussion_reference(
            subject=req.subject,
            area=req.area,
            examples=[example.model_dump() for example in req.examples],
            grade=req.grade,
            api_key=api_key,
        )
        return {"reference": reference}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/admin/analysis/generate-focus-practice")
def admin_generate_focus_practice(
    req: GenerateFocusPracticeRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        if req.use_ai:
            api_key = resolve_openai_api_key(payload["admin_id"])
            if not api_key:
                raise HTTPException(
                    status_code=400,
                    detail="Add your OpenAI API key under Admin → Settings.",
                )
        else:
            api_key = None
        worksheet = generate_focus_practice_worksheet(
            subject=req.subject,
            area=req.area,
            grade=req.grade,
            examples=(
                [example.model_dump() for example in req.examples]
                if req.examples
                else None
            ),
            use_ai=req.use_ai,
            api_key=api_key,
        )
        who = _student_context_name(payload)
        saved = save_revision_worksheet(student=who, worksheet=worksheet)
        worksheet["revision_id"] = saved["id"]
        return worksheet
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/admin/analysis/save-manual-focus-practice")
def admin_save_manual_focus_practice(
    req: SaveManualFocusPracticeRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        worksheet = build_manual_focus_practice_worksheet(
            subject=req.subject,
            area=req.area,
            grade=req.grade,
            title=req.title,
            questions=[question.model_dump() for question in req.questions],
        )
        who = _student_context_name(payload)
        saved = save_revision_worksheet(student=who, worksheet=worksheet)
        worksheet["revision_id"] = saved["id"]
        return worksheet
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
            topic=req.topic,
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
            topic=req.topic,
            admin_id=_admin_id(payload),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/admin/learn/publish")
def admin_publish_learn_resource(
    req: PublishLearnResourceRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
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
            section_title=req.section_title,
            markdown=req.markdown,
            subject_title=subj_label,
            subject_description=f"Grade {req.grade} · {req.curriculum.strip()}",
            grade=req.grade,
            curriculum=req.curriculum,
            topic=req.topic,
            admin_id=_admin_id(payload),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/admin/learn/sections")
def admin_list_learn_sections(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return {"sections": list_admin_learn_sections(admin_id=_admin_id(payload))}


@app.put("/admin/learn/hub/reorder")
def admin_reorder_learn_hub(
    req: ReorderLearnHubRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return reorder_learn_hub_collections(
            scope=req.scope,
            subject_keys=req.subject_keys,
            admin_id=_admin_id(payload),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


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
            admin_id=_admin_id(payload),
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
            topic=req.topic,
            admin_id=_admin_id(payload),
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
        return delete_learn_section(
            subject_key=subject_key,
            section_id=section_id,
            admin_id=_admin_id(payload),
        )
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
        "expert_json_warning_enabled": expert_json_warning_enabled(payload["admin_id"]),
    }


@app.put("/admin/settings/preferences")
def admin_set_preferences(
    req: AdminPreferencesRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    set_expert_json_warning_enabled(
        payload["admin_id"], req.expert_json_warning_enabled
    )
    return {
        "expert_json_warning_enabled": req.expert_json_warning_enabled,
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
        assert_worksheet_accessible(
            payload["name"], worksheet_id, admin_id=_admin_id(payload)
        )
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
        assert_worksheet_owned_by_admin(worksheet_id, _admin_id(payload))
    except ValueError as exc:
        _raise_if_worksheet_not_found(exc)
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
    admin_id = _admin_id(payload)
    try:
        assert_worksheet_owned_by_admin(worksheet_id, admin_id)
    except ValueError as exc:
        _raise_if_worksheet_not_found(exc)
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
    try:
        assert_worksheet_owned_by_admin(worksheet_id, _admin_id(payload))
    except ValueError as exc:
        _raise_if_worksheet_not_found(exc)
    clear_worksheet_access_lock(who, worksheet_id)
    return {"message": "Access override cleared"}


class CreateWorksheetSectionRequest(BaseModel):
    title: str
    parent_id: str | None = None


class AssignWorksheetSectionRequest(BaseModel):
    section_id: str | None = None
    new_section_title: str | None = None
    new_section_parent_id: str | None = None
    mode_key: str | None = None


@app.get("/worksheet-collections")
def get_worksheet_collections(authorization: str = Header(...)):
    payload = _payload(authorization)
    role = payload.get("role")
    if role not in ("admin", "student"):
        raise HTTPException(status_code=403, detail="Forbidden")
    return list_sections_for_admin(_admin_id(payload))


@app.get("/admin/worksheet-sections")
def admin_list_worksheet_sections(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return list_sections_for_admin(_admin_id(payload))


@app.post("/admin/worksheet-sections")
def admin_create_worksheet_section(
    req: CreateWorksheetSectionRequest, authorization: str = Header(...)
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return create_section(
            admin_id=_admin_id(payload),
            title=req.title,
            parent_id=req.parent_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.delete("/admin/worksheet-sections/{section_id}")
def admin_delete_worksheet_section(
    section_id: str, authorization: str = Header(...)
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return delete_section(admin_id=_admin_id(payload), section_id=section_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/admin/worksheet-sections/organize-unassigned")
def admin_organize_unassigned_worksheets(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return organize_unassigned_worksheets(admin_id=_admin_id(payload))


class MoveWorksheetSectionRequest(BaseModel):
    parent_id: str | None = None


@app.put("/admin/worksheet-sections/{section_id}/parent")
def admin_move_worksheet_section(
    section_id: str,
    req: MoveWorksheetSectionRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        return move_section(
            admin_id=_admin_id(payload),
            section_id=section_id,
            parent_id=req.parent_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.put("/admin/worksheets/{worksheet_id}/section")
def admin_assign_worksheet_section(
    worksheet_id: str,
    req: AssignWorksheetSectionRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        assert_worksheet_owned_by_admin(worksheet_id, _admin_id(payload))
    except ValueError as exc:
        _raise_if_worksheet_not_found(exc)
    try:
        return assign_worksheet_section(
            admin_id=_admin_id(payload),
            worksheet_id=worksheet_id,
            section_id=req.section_id,
            new_section_title=req.new_section_title,
            new_section_parent_id=req.new_section_parent_id,
            mode_key=req.mode_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/results")
def submit_result(req: SubmitResultRequest, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students can submit results")

    worksheet = get_worksheet(req.worksheet_id, admin_id=_admin_id(payload))
    if not worksheet:
        raise HTTPException(status_code=404, detail="Worksheet not found")

    student = context_student_name(payload)
    try:
        assert_worksheet_accessible(student, req.worksheet_id, admin_id=_admin_id(payload))
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


@app.get("/admin/analysis/revision-records")
def get_revision_analysis_records(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    return list_revision_analysis_records(who)


@app.get("/admin/analysis/practice-results")
def get_revision_practice_display_records(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    return list_revision_practice_display_records(who)


@app.get("/admin/practice-results")
def get_practice_results(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    return list_practice_results(who)


@app.get("/revision")
def get_revision_worksheets(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") == "student":
        return list_revision_worksheets(payload["name"])
    if payload.get("role") == "admin":
        who = _student_context_name(payload)
        return list_revision_worksheets(who)
    raise HTTPException(status_code=403, detail="Admin or student only")


@app.get("/revision/{revision_id}")
def get_revision_worksheet_by_id(
    revision_id: int,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") == "student":
        who = payload["name"]
    elif payload.get("role") == "admin":
        who = _student_context_name(payload)
    else:
        raise HTTPException(status_code=403, detail="Admin or student only")
    worksheet = get_revision_worksheet(revision_id, who)
    if not worksheet:
        raise HTTPException(status_code=404, detail="Revision worksheet not found")
    return worksheet


@app.patch("/revision/{revision_id}/complete")
def complete_revision_worksheet_route(
    revision_id: int,
    req: CompleteRevisionRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") == "student":
        who = payload["name"]
    elif payload.get("role") == "admin":
        who = _student_context_name(payload)
    else:
        raise HTTPException(status_code=403, detail="Admin or student only")
    try:
        result = complete_revision_worksheet(
            revision_id,
            who,
            score=req.score,
            total=req.total,
            answers=req.answers,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not result:
        raise HTTPException(status_code=404, detail="Revision worksheet not found")
    return result


def _test_context_name(payload: dict) -> str:
    if payload.get("role") == "student":
        return payload["name"]
    if payload.get("role") == "admin":
        return _student_context_name(payload)
    raise HTTPException(status_code=403, detail="Admin or student only")


def _composite_context_name(payload: dict) -> str:
    return _test_context_name(payload)


@app.get("/tests")
def get_tests(authorization: str = Header(...)):
    payload = _payload(authorization)
    who = _test_context_name(payload)
    return list_tests(who, admin_id=resolve_admin_id(payload))


@app.get("/tests/results")
def get_test_results(authorization: str = Header(...)):
    payload = _payload(authorization)
    who = _test_context_name(payload)
    return list_test_results(who)


@app.get("/admin/test-results")
def get_admin_test_results(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    return list_test_results(who)


@app.post("/admin/test-results/{attempt_id}/mark-analyzed")
def mark_admin_test_result_analyzed(
    attempt_id: int, authorization: str = Header(...)
):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    result = mark_test_attempt_analyzed(attempt_id, who)
    if not result:
        raise HTTPException(status_code=404, detail="Test result not found")
    return result


@app.delete("/admin/test-results/{attempt_id}")
def remove_admin_test_result(attempt_id: int, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    if not delete_test_attempt(attempt_id, who):
        raise HTTPException(status_code=404, detail="Test result not found")
    return {"message": "Test result deleted"}


@app.get("/tests/reviews")
def get_test_reviews(authorization: str = Header(...)):
    payload = _payload(authorization)
    who = _test_context_name(payload)
    return list_test_reviews(who)


@app.get("/tests/reviews/{review_id}")
def get_test_review_route(review_id: int, authorization: str = Header(...)):
    payload = _payload(authorization)
    who = _test_context_name(payload)
    review = get_test_review(review_id, who)
    if not review:
        raise HTTPException(status_code=404, detail="Review session not found")
    return review


@app.put("/tests/reviews/{review_id}/notes")
def save_test_review_notes_route(
    review_id: int,
    req: TestReviewNotesRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    who = _test_context_name(payload)
    try:
        return save_test_review_notes(review_id, who, questions=req.questions)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.patch("/tests/reviews/{review_id}/complete")
def complete_test_review_route(review_id: int, authorization: str = Header(...)):
    payload = _payload(authorization)
    who = _test_context_name(payload)
    try:
        return complete_test_review(review_id, who)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/composites")
def list_composites_route(authorization: str = Header(...)):
    payload = _payload(authorization)
    who = _composite_context_name(payload)
    return list_composites_for_student(who)


@app.get("/composites/{composite_id}/hub")
def composite_hub_route(composite_id: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    who = _composite_context_name(payload)
    try:
        return get_composite_hub(who, composite_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/composites/{composite_id}/start")
def start_composite_route(composite_id: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    who = _composite_context_name(payload)
    try:
        return start_composite_attempt(who, composite_id)
    except ValueError as exc:
        msg = str(exc)
        if "locked" in msg.lower():
            raise HTTPException(status_code=423, detail=msg)
        raise HTTPException(status_code=400, detail=msg)


@app.post("/composites/{composite_id}/submit")
def submit_composite_route(composite_id: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    who = _composite_context_name(payload)
    try:
        return submit_composite(who, composite_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/composites/{composite_id}/abandon")
def abandon_composite_route(composite_id: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can abandon composites")
    who = _composite_context_name(payload)
    try:
        return abandon_composite_sitting(who, composite_id)
    except ValueError as exc:
        msg = str(exc)
        if "locked" in msg.lower():
            raise HTTPException(status_code=423, detail=msg)
        raise HTTPException(status_code=400, detail=msg)


@app.get("/tests/{worksheet_id}/session")
def get_test_session_route(
    worksheet_id: str,
    authorization: str = Header(...),
    slot: int | None = Query(default=None),
    resume: int = Query(default=1),
    preview: int = Query(default=0),
    composite_attempt_id: int | None = Query(default=None),
):
    payload = _payload(authorization)
    who = _test_context_name(payload)
    preview_mode = bool(preview) and payload.get("role") == "admin"
    try:
        return get_or_start_test_session(
            who,
            worksheet_id,
            target_slot=slot,
            resume=bool(resume),
            preview=preview_mode,
            composite_attempt_id=composite_attempt_id,
        )
    except ValueError as exc:
        msg = str(exc)
        if "locked" in msg.lower() or "access" in msg.lower():
            raise HTTPException(status_code=423, detail=msg)
        raise HTTPException(status_code=400, detail=msg)


@app.post("/tests/{worksheet_id}/session")
def start_test_session_route(
    worksheet_id: str,
    authorization: str = Header(...),
    slot: int | None = Query(default=None),
    resume: int = Query(default=0),
    composite_attempt_id: int | None = Query(default=None),
):
    payload = _payload(authorization)
    who = _test_context_name(payload)
    try:
        return get_or_start_test_session(
            who,
            worksheet_id,
            target_slot=slot,
            resume=bool(resume),
            composite_attempt_id=composite_attempt_id,
        )
    except ValueError as exc:
        msg = str(exc)
        if "locked" in msg.lower() or "access" in msg.lower():
            raise HTTPException(status_code=423, detail=msg)
        raise HTTPException(status_code=400, detail=msg)


@app.patch("/tests/{worksheet_id}/answer")
def save_test_answer_route(
    worksheet_id: str,
    req: TestAnswerRequest,
    authorization: str = Header(...),
    composite_attempt_id: int | None = Query(default=None),
):
    payload = _payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can answer tests")
    try:
        return save_test_answer(
            payload["name"],
            worksheet_id,
            slot=req.slot,
            given=req.given,
            responses=req.responses,
            composite_attempt_id=composite_attempt_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.patch("/tests/{worksheet_id}/scratchpad")
def save_test_scratchpad_route(
    worksheet_id: str,
    req: TestScratchpadRequest,
    authorization: str = Header(...),
    composite_attempt_id: int | None = Query(default=None),
):
    payload = _payload(authorization)
    who = _test_context_name(payload)
    try:
        return save_test_scratchpad(
            who,
            worksheet_id,
            slot=req.slot,
            scratchpad=req.scratchpad,
            work_text=req.work_text,
            work_mode=req.work_mode,
            composite_attempt_id=composite_attempt_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/tests/{worksheet_id}/submit")
def submit_test_route(
    worksheet_id: str,
    authorization: str = Header(...),
    composite_attempt_id: int | None = Query(default=None),
    partial: int = Query(default=0),
):
    payload = _payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can submit tests")
    try:
        return submit_test(
            payload["name"],
            worksheet_id,
            composite_attempt_id=composite_attempt_id,
            force_partial=bool(partial),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/tests/{worksheet_id}/lock")
def lock_test_route(
    worksheet_id: str,
    authorization: str = Header(...),
    composite_attempt_id: int | None = Query(default=None),
):
    payload = _payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can lock tests")
    lock_test_attempt(
        payload["name"],
        worksheet_id,
        composite_attempt_id=composite_attempt_id,
    )
    return {"message": "Test locked"}


@app.post("/admin/tests/{worksheet_id}/unlock")
def admin_unlock_test_route(worksheet_id: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    who = _student_context_name(payload)
    try:
        unlock_test_attempt(who, worksheet_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"message": "Test attempt reset"}


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
    admin_id = resolve_admin_id(payload)
    hub = list_learn_hub(admin_id=admin_id)
    if payload.get("role") == "admin":
        hub["editable_sections"] = list_admin_learn_sections(admin_id=admin_id)
    return hub


@app.get("/learn/assets/{asset_path:path}")
def serve_learn_asset(asset_path: str):
    """Serve learn images from Tigris when the bucket is not public-read."""
    key = asset_path.lstrip("/")
    try:
        body, content_type = fetch_learn_object(key)
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found")
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Learn image storage is not configured")
    except Exception:
        raise HTTPException(status_code=404, detail="Not found")
    return Response(
        content=body,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/learn/{subject_key}")
def learn_subject(subject_key: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    data = get_subject(subject_key, admin_id=resolve_admin_id(payload))
    if not data:
        raise HTTPException(status_code=404, detail="Subject not found")
    return data


@app.get("/learn/{subject_key}/notes")
def learn_subject_notes(subject_key: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    student = _learn_notes_student(payload)
    notes = list_notes_for_subject(student, subject_key)
    return {"notes": notes}


@app.put("/learn/{subject_key}/{section_id}/notes/{page_index}")
def save_learn_page_note(
    subject_key: str,
    section_id: str,
    page_index: int,
    req: SaveLearnNoteRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can save notes")
    try:
        note = save_note(
            payload["name"],
            subject_key,
            section_id,
            page_index,
            req.body,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return note


@app.post("/learn/{subject_key}/{section_id}/notes/{page_index}/generate")
def generate_learn_page_note(
    subject_key: str,
    section_id: str,
    page_index: int,
    req: GenerateLearnNoteRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can generate notes")
    admin_id = _learn_notes_admin_id(payload)
    if not admin_id:
        raise HTTPException(status_code=400, detail="Student account not found.")
    api_key = resolve_openai_api_key(admin_id)
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Ask your teacher to add an OpenAI API key under Admin → Settings.",
        )
    try:
        note = generate_and_save_note(
            student=payload["name"],
            subject_key=subject_key,
            section_id=section_id,
            page_index=page_index,
            page_markdown=req.page_markdown,
            section_title=req.section_title,
            subject_title=req.subject_title,
            api_key=api_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return note


@app.get("/learn/{subject_key}/highlights")
def learn_subject_highlights(subject_key: str, authorization: str = Header(...)):
    payload = _payload(authorization)
    student = _learn_notes_student(payload)
    highlights = list_highlights_for_subject(student, subject_key)
    return {"highlights": highlights}


@app.put("/learn/{subject_key}/{section_id}/highlights/{page_index}")
def save_learn_page_highlights(
    subject_key: str,
    section_id: str,
    page_index: int,
    req: SaveLearnHighlightsRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can save highlights")
    try:
        saved = save_highlights(
            payload["name"],
            subject_key,
            section_id,
            page_index,
            req.highlights,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return saved


@app.get("/admin/home")
def admin_home_dashboard(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    selected = payload.get("student_name")
    return build_admin_home(payload["admin_id"], selected_student=selected)


@app.get("/student/home")
def student_home_dashboard(authorization: str = Header(...)):
    payload = _payload(authorization)
    if payload.get("role") not in ("student", "admin"):
        raise HTTPException(status_code=403, detail="Student only")
    if payload.get("role") == "admin":
        raise HTTPException(
            status_code=403,
            detail="Student home is for student accounts.",
        )
    student_name = payload["name"]
    admin_id = get_student_admin_id(payload.get("student_id"))
    if admin_id is None:
        raise HTTPException(status_code=400, detail="Student account not found")
    return build_student_home(student_name, admin_id=admin_id)


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
        sid = add_student(
            payload["admin_id"],
            name,
            req.password,
            req.grade,
            curriculum=req.curriculum,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="A student with that name already exists for your account",
        )
    out = {"id": sid, "name": name, "grade": req.grade}
    cleaned_curriculum = (req.curriculum or "").strip()
    if cleaned_curriculum:
        out["curriculum"] = cleaned_curriculum
    return out


@app.patch("/admin/students/{student_id}")
def admin_update_student(
    student_id: int,
    req: UpdateStudentRequest,
    authorization: str = Header(...),
):
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if req.name is None and req.grade is None and req.password is None and req.curriculum is None:
        raise HTTPException(status_code=400, detail="No changes to save.")
    try:
        updated = update_student_by_admin(
            payload["admin_id"],
            student_id,
            name=req.name,
            grade=req.grade,
            password=req.password,
            curriculum=req.curriculum,
        )
    except ValueError as exc:
        msg = str(exc)
        status = 409 if "already exists" in msg.lower() else 400
        raise HTTPException(status_code=status, detail=msg)
    if not updated:
        raise HTTPException(status_code=404, detail="Student not found")
    out = dict(updated)
    if payload.get("student_id") == student_id:
        an = payload.get("admin_name") or get_admin_name(payload["admin_id"])
        out["token"] = create_admin_token(
            payload["admin_id"],
            updated["id"],
            updated["name"],
            admin_name=an,
        )
        out["student_name"] = updated["name"]
        if updated.get("grade") is not None:
            out["grade"] = updated["grade"]
        if updated.get("curriculum"):
            out["curriculum"] = updated["curriculum"]
    return out


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
        "curriculum": row.get("curriculum"),
    }


@app.delete("/admin/session/student")
def admin_clear_student_context(authorization: str = Header(...)):
    """Re-issue admin JWT without an active student context."""
    payload = _payload(authorization)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    an = payload.get("admin_name") or get_admin_name(payload["admin_id"])
    token = create_admin_token(payload["admin_id"], None, None, admin_name=an)
    return {
        "token": token,
        "student_name": None,
        "admin_name": an,
        "needs_student": True,
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
