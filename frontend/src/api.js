import {
  clearSession,
  handleSessionExpired,
  isAuthenticated,
  touchActivity,
} from "./sessionAuth";
import { parseDemoBlockedPayload } from "./demoMode";
import { notifyStudentHomeRefresh } from "./studentHomeRefresh";

const BASE_URL = import.meta.env.VITE_API_URL;

function getToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

async function apiFetch(url, options = {}) {
  const urlStr = typeof url === "string" ? url : url.toString();
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (
    !headers.has("Content-Type") &&
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(urlStr, { ...options, headers });
  if (
    res.status === 401 &&
    token &&
    !urlStr.includes("/auth/login") &&
    !urlStr.includes("/auth/signup")
  ) {
    const errBody = await res.clone().json().catch(() => ({}));
    const detail = typeof errBody.detail === "string" ? errBody.detail : "";
    if (!detail || detail.toLowerCase().includes("not authenticated")) {
      await handleSessionExpired("expired");
    }
  }
  return res;
}

export { touchActivity };

// --- Auth ---

export async function loginAdmin({ adminName, password }) {
  const res = await fetch(`${BASE_URL}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_name: adminName, password }),
  });
  if (!res.ok) throw new Error("Invalid admin login");
  return res.json();
}

export async function signupAdmin({ name, password }) {
  const res = await fetch(`${BASE_URL}/auth/admin/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Sign up failed";
    throw new Error(msg);
  }
  return res.json();
}

export async function loginStudent({ adminName, name, password }) {
  const res = await fetch(`${BASE_URL}/auth/student/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_name: adminName, name, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json();
}

export async function logout() {
  if (BASE_URL && isAuthenticated()) {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: "POST",
        headers: authHeaders(),
      });
    } catch {
      // Still clear the session — JWT is discarded client-side; backend may be down.
    }
  }
  clearSession();
  applyLoginAppearance();
}

export async function getMe() {
  const res = await apiFetch(`${BASE_URL}/auth/me`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

async function parseApiError(res, fallback) {
  const err = await res.json().catch(() => ({}));
  const demoMessage = parseDemoBlockedPayload(err);
  if (demoMessage) return demoMessage;
  const d = err.detail;
  return typeof d === "string" ? d : fallback;
}

export async function updateAdminAccount(payload) {
  const res = await apiFetch(`${BASE_URL}/auth/admin/account`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Could not update account"));
  }
  return res.json();
}

// --- Worksheets ---

export async function getWorksheets() {
  const res = await apiFetch(`${BASE_URL}/worksheets`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch worksheets");
  return res.json();
}

export async function getWorksheet(id) {
  const res = await apiFetch(`${BASE_URL}/worksheets/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to fetch worksheet";
    const error = new Error(msg);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function deleteWorksheet(id) {
  const res = await apiFetch(`${BASE_URL}/worksheets/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete worksheet");
  return res.json();
}

export async function restoreWorksheet(id, { data, sortTs, sectionId }) {
  const res = await apiFetch(`${BASE_URL}/admin/worksheets/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data,
      sort_ts: sortTs ?? null,
      admin_section_id: sectionId ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail;
    const msg = Array.isArray(detail)
      ? detail.join(" ")
      : detail || "Failed to restore worksheet";
    throw new Error(msg);
  }
  return res.json();
}

export async function restoreWorksheetSections({ sections, assignments }) {
  const res = await apiFetch(`${BASE_URL}/admin/worksheet-sections/restore`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sections, assignments: assignments ?? [] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to restore sections");
  }
  return res.json();
}

export async function getWorksheetCollections() {
  const res = await apiFetch(`${BASE_URL}/worksheet-collections`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch worksheet collections");
  return res.json();
}

export async function getAdminWorksheetSections() {
  const res = await apiFetch(`${BASE_URL}/admin/worksheet-sections`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch worksheet sections");
  return res.json();
}

export async function createAdminWorksheetSection({ title, parentId = null }) {
  const res = await apiFetch(`${BASE_URL}/admin/worksheet-sections`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, parent_id: parentId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create section");
  }
  return res.json();
}

export async function deleteWorksheetCollection(sectionId) {
  const res = await apiFetch(
    `${BASE_URL}/admin/worksheet-sections/${encodeURIComponent(sectionId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete section");
  }
  return res.json();
}

export async function organizeUnassignedWorksheets() {
  const res = await apiFetch(
    `${BASE_URL}/admin/worksheet-sections/organize-unassigned`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to organize worksheets");
  }
  return res.json();
}

export async function moveWorksheetCollection(sectionId, parentId) {
  const res = await apiFetch(
    `${BASE_URL}/admin/worksheet-sections/${encodeURIComponent(sectionId)}/parent`,
    {
      method: "PUT",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ parent_id: parentId }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to move section");
  }
  return res.json();
}

export async function assignWorksheetSection(worksheetId, payload) {
  const res = await apiFetch(`${BASE_URL}/admin/worksheets/${worksheetId}/section`, {
    method: "PUT",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      section_id: payload.sectionId ?? null,
      new_section_title: payload.newSectionTitle ?? null,
      new_section_parent_id: payload.newSectionParentId ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to move worksheet");
  }
  return res.json();
}

export async function uploadWorksheet(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch(`${BASE_URL}/admin/worksheets/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to upload worksheet";
    if (typeof d === "string") msg = d;
    else if (Array.isArray(d)) msg = d.join(" ");
    throw new Error(msg);
  }
  return res.json();
}

export async function validateWorksheetJson(data) {
  const res = await apiFetch(`${BASE_URL}/admin/worksheets/validate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const error = new Error("Validation failed");
    if (Array.isArray(d)) {
      error.details = d;
    } else if (typeof d === "string") {
      error.details = [d];
    } else {
      error.details = ["Validation failed"];
    }
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function updateWorksheetTitle(worksheetId, title) {
  const res = await apiFetch(
    `${BASE_URL}/admin/worksheets/${encodeURIComponent(worksheetId)}/title`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ title }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to rename worksheet";
    if (typeof d === "string") msg = d;
    else if (Array.isArray(d)) msg = d.join(" ");
    throw new Error(msg);
  }
  return res.json();
}

export async function updateWorksheetFromBuilder(worksheetId, payload) {
  const res = await apiFetch(`${BASE_URL}/admin/worksheets/${worksheetId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to update worksheet";
    if (typeof d === "string") msg = d;
    else if (Array.isArray(d)) msg = d.join(" ");
    throw new Error(msg);
  }
  return res.json();
}

export async function previewAdminResourceCode({
  subject,
  isTest = false,
  timed = false,
  forLearn = false,
  englishType = "",
} = {}) {
  const params = new URLSearchParams({
    subject: subject || "math",
    is_test: isTest ? "true" : "false",
    timed: timed ? "true" : "false",
    for_learn: forLearn ? "true" : "false",
  });
  if (englishType) {
    params.set("english_type", englishType);
  }
  const res = await apiFetch(
    `${BASE_URL}/admin/resource-code/preview?${params.toString()}`,
    { headers: authHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    throw new Error(typeof d === "string" ? d : "Failed to preview resource code");
  }
  return res.json();
}

export async function createWorksheetFromBuilder(payload) {
  const res = await apiFetch(`${BASE_URL}/admin/worksheets/create`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to create worksheet";
    if (typeof d === "string") msg = d;
    else if (Array.isArray(d)) msg = d.join(" ");
    throw new Error(msg);
  }
  return res.json();
}

export async function getAdminLearnLinkOptions(worksheetSubject) {
  const params = new URLSearchParams({
    worksheet_subject: worksheetSubject,
  });
  const res = await apiFetch(
    `${BASE_URL}/admin/learn/link-options?${params.toString()}`,
    { headers: authHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    throw new Error(typeof d === "string" ? d : "Failed to load learning resources");
  }
  return res.json();
}

export async function submitResult(result) {
  const res = await apiFetch(`${BASE_URL}/results`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(result),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to submit result";
    throw new Error(msg);
  }
  notifyStudentHomeRefresh();
  return res.json();
}

export async function getWorksheetMyResult(worksheetId) {
  const res = await apiFetch(`${BASE_URL}/worksheets/${worksheetId}/my-result`, {
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch submission");
  return res.json();
}

export async function getWorksheetDraft(worksheetId) {
  const res = await apiFetch(`${BASE_URL}/worksheets/${worksheetId}/draft`, {
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch saved progress");
  return res.json();
}

export async function saveWorksheetDraft(worksheetId, answers) {
  const res = await apiFetch(`${BASE_URL}/worksheets/${worksheetId}/draft`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to save progress";
    throw new Error(msg);
  }
  return res.json();
}

export async function getTimedSession(worksheetId, resume = false) {
  const url = new URL(`${BASE_URL}/worksheets/${worksheetId}/timed-session`);
  if (resume) url.searchParams.set("resume", "1");
  const res = await apiFetch(url, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to start timed session";
    const error = new Error(msg);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export function lockTimedWorksheet(worksheetId) {
  const token = getToken();
  if (!token || !BASE_URL) return;
  fetch(`${BASE_URL}/worksheets/${worksheetId}/lock-timed`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    keepalive: true,
  }).catch(() => {});
}

export async function unlockTimedWorksheet(worksheetId) {
  const res = await apiFetch(
    `${BASE_URL}/admin/worksheets/${worksheetId}/unlock-timed`,
    { method: "POST", headers: authHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to unlock";
    throw new Error(msg);
  }
  return res.json();
}

export async function unlockGiftedTrackWeek(week) {
  const res = await apiFetch(`${BASE_URL}/admin/gifted-track/unlock-week`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ week }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to unlock week";
    throw new Error(msg);
  }
  return res.json();
}

export async function lockGiftedTrackWeek(week) {
  const res = await apiFetch(`${BASE_URL}/admin/gifted-track/lock-week`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ week }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to lock week";
    throw new Error(msg);
  }
  return res.json();
}

export async function setWorksheetAccessLock(worksheetId, locked) {
  const res = await apiFetch(
    `${BASE_URL}/admin/worksheets/${worksheetId}/access-lock`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ locked }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to update lock";
    throw new Error(msg);
  }
  return res.json();
}

export async function clearWorksheetAccessLock(worksheetId) {
  const res = await apiFetch(
    `${BASE_URL}/admin/worksheets/${worksheetId}/clear-access-lock`,
    { method: "POST", headers: authHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to clear lock";
    throw new Error(msg);
  }
  return res.json();
}

export async function evaluateResult(resultId, marks) {
  const res = await apiFetch(`${BASE_URL}/results/${resultId}/evaluate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ marks }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to save marks";
    throw new Error(msg);
  }
  return res.json();
}

export async function getResults() {
  const res = await apiFetch(`${BASE_URL}/results`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch results");
  return res.json();
}

export async function getFocusAreasDiscussed() {
  const res = await apiFetch(`${BASE_URL}/focus-areas/discussed`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch discussed focus areas");
  return res.json();
}

export async function markFocusAreaDiscussed({ subject, area }) {
  const res = await apiFetch(`${BASE_URL}/focus-areas/discussed`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ subject, area }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to mark focus area discussed";
    throw new Error(msg);
  }
  return res.json();
}

export async function getWritingSubmissions() {
  const res = await apiFetch(`${BASE_URL}/writing/submissions`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch writing submissions");
  return res.json();
}

export async function submitWriting({ title, body }) {
  const res = await apiFetch(`${BASE_URL}/writing/submissions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ title, body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to submit writing";
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteWritingSubmission(submissionId) {
  const res = await apiFetch(`${BASE_URL}/writing/submissions/${submissionId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to delete writing";
    throw new Error(msg);
  }
  return res.json();
}

export async function gradeWritingSubmission(submissionId, { grade, feedback = "" }) {
  const res = await apiFetch(`${BASE_URL}/writing/submissions/${submissionId}/grade`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ grade, feedback }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to save grade";
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteResult(resultId) {
  const res = await apiFetch(`${BASE_URL}/results/${resultId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to delete result";
    throw new Error(msg);
  }
  return res.json();
}

export async function uploadFocusEvaluation(resultId, payload) {
  const res = await apiFetch(`${BASE_URL}/results/${resultId}/focus-evaluation`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to upload evaluation";
    throw new Error(msg);
  }
  return res.json();
}

export async function analyzeResultForFocus(resultId) {
  const res = await apiFetch(`${BASE_URL}/results/${resultId}/analyze`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to analyze result";
    throw new Error(msg);
  }
  return res.json();
}

export async function getAdminHome() {
  const res = await apiFetch(`${BASE_URL}/admin/home`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load admin home");
  return res.json();
}

export async function getStudentHome() {
  const res = await apiFetch(`${BASE_URL}/student/home`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load student home");
  return res.json();
}

export async function listAdminStudents() {
  const res = await apiFetch(`${BASE_URL}/admin/students`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to list students");
  return res.json();
}

export async function createAdminStudent({ name, password, grade, curriculum }) {
  const body = { name, password, grade };
  if (curriculum) body.curriculum = curriculum;
  const res = await apiFetch(`${BASE_URL}/admin/students`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg =
      typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg).join(" ") : "Failed to create student";
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteAdminStudent(studentId) {
  const res = await apiFetch(`${BASE_URL}/admin/students/${studentId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to delete student";
    throw new Error(msg);
  }
  return res.json();
}

export async function updateAdminStudent(studentId, payload) {
  const res = await apiFetch(`${BASE_URL}/admin/students/${studentId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to update student";
    throw new Error(msg);
  }
  return res.json();
}

export async function generateWorksheetDraft(payload) {
  const res = await apiFetch(`${BASE_URL}/admin/worksheets/generate-draft`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to generate worksheet draft";
    if (typeof d === "string") msg = d;
    throw new Error(msg);
  }
  return res.json();
}

export async function generateTestDraft(payload) {
  const res = await apiFetch(`${BASE_URL}/admin/tests/generate-draft`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to generate test draft";
    if (typeof d === "string") msg = d;
    throw new Error(msg);
  }
  return res.json();
}

export async function createTestFromBuilder(payload) {
  const res = await apiFetch(`${BASE_URL}/admin/tests/create`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to publish test";
    if (typeof d === "string") msg = d;
    else if (Array.isArray(d)) msg = d.join(" ");
    throw new Error(msg);
  }
  return res.json();
}

export async function scheduleTestUnlock(worksheetId, { unlockAt, studentName }) {
  const body = { unlock_at: unlockAt };
  if (studentName) body.student_name = studentName;
  const res = await apiFetch(`${BASE_URL}/admin/tests/${worksheetId}/schedule-unlock`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to schedule unlock";
    if (typeof d === "string") msg = d;
    else if (Array.isArray(d)) msg = d.join(" ");
    throw new Error(msg);
  }
  return res.json();
}

export async function updateTestFromBuilder(worksheetId, payload) {
  const res = await apiFetch(`${BASE_URL}/admin/tests/${worksheetId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to save test";
    if (typeof d === "string") msg = d;
    else if (Array.isArray(d)) msg = d.join(" ");
    throw new Error(msg);
  }
  return res.json();
}

function formatApiDetail(d, fallback) {
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.join(" ");
  return fallback;
}

export async function listQuestionBank({ subject, stars, area, passageId, standaloneOnly } = {}) {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (stars != null) params.set("stars", String(stars));
  if (area) params.set("area", area);
  if (passageId) params.set("passage_id", passageId);
  if (standaloneOnly) params.set("standalone_only", "true");
  const qs = params.toString();
  const res = await apiFetch(
    `${BASE_URL}/admin/question-bank${qs ? `?${qs}` : ""}`,
    { headers: authHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatApiDetail(err.detail, "Could not load question bank."));
  }
  const data = await res.json();
  return data.items || [];
}

export async function listQuestionBankAreas({ subject, q } = {}) {
  const params = new URLSearchParams({ subject });
  if (q?.trim()) params.set("q", q.trim());
  const res = await apiFetch(
    `${BASE_URL}/admin/question-bank/areas?${params.toString()}`,
    { headers: authHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatApiDetail(err.detail, "Could not load topic areas."));
  }
  const data = await res.json();
  return {
    areas: data.areas || [],
    nearMatches: data.near_matches || [],
    caseVariant: data.case_variant || null,
  };
}

export async function createQuestionBankItem(payload) {
  const res = await apiFetch(`${BASE_URL}/admin/question-bank`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatApiDetail(err.detail, "Could not save question."));
  }
  return res.json();
}

export async function bulkSaveQuestionBank({ subject, source = "manual", questions }) {
  const res = await apiFetch(`${BASE_URL}/admin/question-bank/bulk`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ subject, source, questions }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatApiDetail(err.detail, "Could not save questions to bank."));
  }
  return res.json();
}

export async function saveWorksheetQuestionToBank(payload) {
  const res = await apiFetch(`${BASE_URL}/admin/question-bank/from-worksheet`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatApiDetail(err.detail, "Could not save question to bank."));
  }
  return res.json();
}

export async function saveWorksheetContextToBank(payload) {
  const res = await apiFetch(`${BASE_URL}/admin/question-bank/from-worksheet-context`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatApiDetail(err.detail, "Could not save to question bank."));
  }
  return res.json();
}

export async function updateQuestionBankItem(itemId, payload) {
  const res = await apiFetch(`${BASE_URL}/admin/question-bank/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatApiDetail(err.detail, "Could not update question."));
  }
  return res.json();
}

export async function deleteQuestionBankItem(itemId) {
  const res = await apiFetch(`${BASE_URL}/admin/question-bank/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatApiDetail(err.detail, "Could not delete question."));
  }
  return res.json();
}

export async function listQuestionBankPassages({ subject = "english" } = {}) {
  const params = new URLSearchParams({ subject });
  const res = await apiFetch(
    `${BASE_URL}/admin/question-bank/passages?${params.toString()}`,
    { headers: authHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatApiDetail(err.detail, "Could not load passages."));
  }
  const data = await res.json();
  return data.passages || [];
}

export async function getQuestionBankPassage(passageId) {
  const res = await apiFetch(
    `${BASE_URL}/admin/question-bank/passages/${encodeURIComponent(passageId)}`,
    { headers: authHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatApiDetail(err.detail, "Could not load passage."));
  }
  return res.json();
}

export async function createQuestionBankPassage(payload) {
  const res = await apiFetch(`${BASE_URL}/admin/question-bank/passages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatApiDetail(err.detail, "Could not create passage."));
  }
  return res.json();
}

export async function updateQuestionBankPassage(passageId, payload) {
  const res = await apiFetch(
    `${BASE_URL}/admin/question-bank/passages/${encodeURIComponent(passageId)}`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatApiDetail(err.detail, "Could not save passage."));
  }
  return res.json();
}

export async function deleteQuestionBankPassage(passageId) {
  const res = await apiFetch(
    `${BASE_URL}/admin/question-bank/passages/${encodeURIComponent(passageId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatApiDetail(err.detail, "Could not delete passage."));
  }
  return res.json();
}

export async function generateFocusDiscussionReference(payload) {
  const res = await apiFetch(`${BASE_URL}/admin/analysis/generate-discussion-reference`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to generate discussion reference";
    if (typeof d === "string") msg = d;
    throw new Error(msg);
  }
  return res.json();
}

export async function generateFocusPracticeWorksheet(payload) {
  const res = await apiFetch(`${BASE_URL}/admin/analysis/generate-focus-practice`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to generate focus practice worksheet";
    if (typeof d === "string") msg = d;
    throw new Error(msg);
  }
  return res.json();
}

export async function saveManualFocusPracticeWorksheet(payload) {
  const res = await apiFetch(`${BASE_URL}/admin/analysis/save-manual-focus-practice`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to save manual practice worksheet";
    if (typeof d === "string") msg = d;
    else if (Array.isArray(d)) msg = d.join(" ");
    throw new Error(msg);
  }
  return res.json();
}

export async function getRevisionAnalysisRecords() {
  const res = await apiFetch(`${BASE_URL}/admin/analysis/revision-records`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch revision analysis records");
  return res.json();
}

export async function getAnalysisPracticeResults() {
  const res = await apiFetch(`${BASE_URL}/admin/analysis/practice-results`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch analysis practice results");
  return res.json();
}

export async function getPracticeResults() {
  const res = await apiFetch(`${BASE_URL}/admin/practice-results`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch practice results");
  return res.json();
}

export async function getRevisionWorksheets() {
  const res = await apiFetch(`${BASE_URL}/revision`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch revision worksheets");
  return res.json();
}

export async function getRevisionWorksheet(revisionId) {
  const res = await apiFetch(`${BASE_URL}/revision/${revisionId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch revision worksheet");
  return res.json();
}

export async function completeRevisionWorksheet(revisionId, { score, total, answers }) {
  const res = await apiFetch(`${BASE_URL}/revision/${revisionId}/complete`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ score, total, answers }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to save revision result";
    throw new Error(msg);
  }
  return res.json();
}

// --- Tests ---

export async function getTests() {
  const res = await apiFetch(`${BASE_URL}/tests`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch tests");
  return res.json();
}

export async function getTestResults() {
  const res = await apiFetch(`${BASE_URL}/tests/results`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch test results");
  return res.json();
}

export async function getAdminTestResults() {
  const res = await apiFetch(`${BASE_URL}/admin/test-results`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch test results");
  return res.json();
}

export async function markTestAttemptAnalyzed(attemptId) {
  const res = await apiFetch(
    `${BASE_URL}/admin/test-results/${attemptId}/mark-analyzed`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  );
  if (!res.ok) throw new Error("Failed to mark test as analyzed");
  return res.json();
}

export async function deleteTestResult(attemptId) {
  const res = await apiFetch(`${BASE_URL}/admin/test-results/${attemptId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to delete test result";
    throw new Error(msg);
  }
  return res.json();
}

export async function evaluateTestResult(attemptId, marks) {
  const res = await apiFetch(`${BASE_URL}/admin/test-results/${attemptId}/evaluate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ marks }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to save test marks";
    throw new Error(msg);
  }
  return res.json();
}

// --- Composite tests ---

async function readApiError(res, fallback) {
  const err = await res.json().catch(() => ({}));
  const d = err.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.join(" ");
  return fallback;
}

export async function listEligibleCompositeWorksheets() {
  const res = await apiFetch(`${BASE_URL}/admin/composite-tests/eligible-worksheets`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch eligible subject tests");
  return res.json();
}

export async function listCompositeTests() {
  const res = await apiFetch(`${BASE_URL}/admin/composite-tests`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch composite tests");
  return res.json();
}

export async function getCompositeTest(compositeId) {
  const res = await apiFetch(`${BASE_URL}/admin/composite-tests/${compositeId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readApiError(res, "Composite test not found"));
  return res.json();
}

export async function createCompositeTest(payload) {
  const res = await apiFetch(`${BASE_URL}/admin/composite-tests`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiError(res, "Failed to create composite test"));
  return res.json();
}

export async function updateCompositeTest(compositeId, payload) {
  const res = await apiFetch(`${BASE_URL}/admin/composite-tests/${compositeId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiError(res, "Failed to update composite test"));
  return res.json();
}

export async function deleteCompositeTest(compositeId) {
  const res = await apiFetch(`${BASE_URL}/admin/composite-tests/${compositeId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readApiError(res, "Failed to delete composite test"));
  return res.json();
}

export async function lockCompositeTest(compositeId, { studentName, scheduledUnlockAt } = {}) {
  const body = {};
  if (studentName) body.student_name = studentName;
  if (scheduledUnlockAt) body.scheduled_unlock_at = scheduledUnlockAt;
  const res = await apiFetch(`${BASE_URL}/admin/composite-tests/${compositeId}/lock`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res, "Failed to lock composite test"));
  return res.json();
}

export async function unlockCompositeTest(compositeId, { studentName } = {}) {
  const body = {};
  if (studentName) body.student_name = studentName;
  const res = await apiFetch(`${BASE_URL}/admin/composite-tests/${compositeId}/unlock`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res, "Failed to unlock composite test"));
  return res.json();
}

export async function unlockCompositeSitting({ compositeId, studentName }) {
  const res = await apiFetch(`${BASE_URL}/admin/composite-attempts/unlock`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      composite_id: compositeId,
      student_name: studentName,
    }),
  });
  if (!res.ok) throw new Error(await readApiError(res, "Failed to unlock composite sitting"));
  return res.json();
}

export async function getAdminCompositeTestResults() {
  const res = await apiFetch(`${BASE_URL}/admin/composite-test-results`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch composite test results");
  return res.json();
}

export async function deleteCompositeTestResult(compositeAttemptId) {
  const res = await apiFetch(
    `${BASE_URL}/admin/composite-test-results/${compositeAttemptId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to delete composite test result";
    throw new Error(msg);
  }
  return res.json();
}

// --- Student composite tests ---

export async function getComposites() {
  const res = await apiFetch(`${BASE_URL}/composites`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch composite tests");
  return res.json();
}

export async function getCompositeHub(compositeId) {
  const res = await apiFetch(`${BASE_URL}/composites/${encodeURIComponent(compositeId)}/hub`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const error = new Error(typeof d === "string" ? d : "Failed to load composite assessment");
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function startCompositeAttempt(compositeId) {
  const res = await apiFetch(`${BASE_URL}/composites/${encodeURIComponent(compositeId)}/start`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const error = new Error(typeof d === "string" ? d : "Failed to start composite assessment");
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function submitCompositeAttempt(compositeId) {
  const res = await apiFetch(`${BASE_URL}/composites/${encodeURIComponent(compositeId)}/submit`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    throw new Error(typeof d === "string" ? d : "Failed to submit composite assessment");
  }
  return res.json();
}

export async function abandonCompositeAttempt(compositeId) {
  const res = await apiFetch(`${BASE_URL}/composites/${encodeURIComponent(compositeId)}/abandon`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    throw new Error(typeof d === "string" ? d : "Failed to leave assessment");
  }
  notifyStudentHomeRefresh();
  return res.json();
}

export async function getTestReviews() {
  const res = await apiFetch(`${BASE_URL}/tests/reviews`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch test reviews");
  return res.json();
}

export async function getTestReview(reviewId) {
  const res = await apiFetch(`${BASE_URL}/tests/reviews/${reviewId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch test review");
  return res.json();
}

export async function saveTestReviewNotes(reviewId, questions) {
  const res = await apiFetch(`${BASE_URL}/tests/reviews/${reviewId}/notes`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ questions }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to save review notes";
    throw new Error(msg);
  }
  return res.json();
}

export async function completeTestReview(reviewId) {
  const res = await apiFetch(`${BASE_URL}/tests/reviews/${reviewId}/complete`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to complete review";
    throw new Error(msg);
  }
  return res.json();
}

export async function getTestSession(
  worksheetId,
  { slot, resume = true, preview = false, compositeAttemptId } = {},
) {
  const params = new URLSearchParams();
  if (slot != null) params.set("slot", String(slot));
  params.set("resume", resume ? "1" : "0");
  if (preview) params.set("preview", "1");
  if (compositeAttemptId != null) {
    params.set("composite_attempt_id", String(compositeAttemptId));
  }
  const res = await apiFetch(
    `${BASE_URL}/tests/${worksheetId}/session?${params.toString()}`,
    { headers: authHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const error = new Error(typeof d === "string" ? d : "Failed to load test session");
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function startTestSession(
  worksheetId,
  { slot, resume = false, compositeAttemptId } = {},
) {
  const params = new URLSearchParams();
  if (slot != null) params.set("slot", String(slot));
  params.set("resume", resume ? "1" : "0");
  if (compositeAttemptId != null) {
    params.set("composite_attempt_id", String(compositeAttemptId));
  }
  const res = await apiFetch(
    `${BASE_URL}/tests/${worksheetId}/session?${params.toString()}`,
    { method: "POST", headers: authHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const error = new Error(typeof d === "string" ? d : "Failed to start test");
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function saveTestAnswer(
  worksheetId,
  { slot, given, responses, compositeAttemptId },
) {
  const params = new URLSearchParams();
  if (compositeAttemptId != null) {
    params.set("composite_attempt_id", String(compositeAttemptId));
  }
  const query = params.toString();
  const body = { slot };
  if (responses && typeof responses === "object") {
    body.responses = responses;
  } else {
    body.given = given ?? "";
  }
  const res = await apiFetch(
    `${BASE_URL}/tests/${worksheetId}/answer${query ? `?${query}` : ""}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    throw new Error(typeof d === "string" ? d : "Failed to save answer");
  }
  return res.json();
}

export async function saveTestScratchpad(
  worksheetId,
  { slot, scratchpad, work_text, work_mode, compositeAttemptId },
) {
  const params = new URLSearchParams();
  if (compositeAttemptId != null) {
    params.set("composite_attempt_id", String(compositeAttemptId));
  }
  const query = params.toString();
  const body = { slot, scratchpad };
  if (work_text !== undefined) body.work_text = work_text;
  if (work_mode !== undefined) body.work_mode = work_mode;
  const res = await apiFetch(
    `${BASE_URL}/tests/${worksheetId}/scratchpad${query ? `?${query}` : ""}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    throw new Error(typeof d === "string" ? d : "Failed to save scratchpad");
  }
  return res.json();
}

export async function submitTest(worksheetId, { compositeAttemptId, partial = false } = {}) {
  const params = new URLSearchParams();
  if (compositeAttemptId != null) {
    params.set("composite_attempt_id", String(compositeAttemptId));
  }
  if (partial) {
    params.set("partial", "1");
  }
  const query = params.toString();
  const res = await apiFetch(
    `${BASE_URL}/tests/${worksheetId}/submit${query ? `?${query}` : ""}`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    throw new Error(typeof d === "string" ? d : "Failed to submit test");
  }
  notifyStudentHomeRefresh();
  return res.json();
}

export async function lockTestAttempt(worksheetId, { compositeAttemptId } = {}) {
  const params = new URLSearchParams();
  if (compositeAttemptId != null) {
    params.set("composite_attempt_id", String(compositeAttemptId));
  }
  const query = params.toString();
  const res = await apiFetch(
    `${BASE_URL}/tests/${worksheetId}/lock${query ? `?${query}` : ""}`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  );
  if (!res.ok) return;
  return res.json();
}

export async function unlockTestAttempt(worksheetId) {
  const res = await apiFetch(`${BASE_URL}/admin/tests/${worksheetId}/unlock`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    throw new Error(typeof d === "string" ? d : "Failed to unlock test");
  }
  return res.json();
}

export async function generateAndPublishLearnResource(payload) {
  const res = await apiFetch(`${BASE_URL}/admin/learn/generate-and-publish`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to generate learning resource";
    if (typeof d === "string") msg = d;
    throw new Error(msg);
  }
  return res.json();
}

export async function publishLearnResource(payload) {
  const res = await apiFetch(`${BASE_URL}/admin/learn/publish`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to publish learning resource";
    if (typeof d === "string") msg = d;
    throw new Error(msg);
  }
  return res.json();
}

export async function getAdminSettings() {
  const res = await apiFetch(`${BASE_URL}/admin/settings`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load settings");
  return res.json();
}

export async function saveAdminPreferences(preferences) {
  const res = await apiFetch(`${BASE_URL}/admin/settings/preferences`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(preferences),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to save preferences";
    throw new Error(msg);
  }
  return res.json();
}

export async function saveAdminOpenAiKey(apiKey) {
  const res = await apiFetch(`${BASE_URL}/admin/settings/openai-key`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    const msg = typeof d === "string" ? d : "Failed to save API key";
    throw new Error(msg);
  }
  return res.json();
}

export async function clearAdminOpenAiKey() {
  const res = await apiFetch(`${BASE_URL}/admin/settings/openai-key`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to remove API key");
  return res.json();
}

export async function switchAdminStudent(studentName) {
  const res = await apiFetch(`${BASE_URL}/admin/session/student`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ student_name: studentName }),
  });
  if (!res.ok) throw new Error("Failed to switch student");
  return res.json();
}

export async function clearAdminStudentContext() {
  const res = await apiFetch(`${BASE_URL}/admin/session/student`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to clear student selection");
  return res.json();
}

// --- Learning material (Markdown) ---

export async function getLearnSubjects() {
  const res = await apiFetch(`${BASE_URL}/learn/subjects`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch learning subjects");
  return res.json();
}

export async function getLearnSubject(subjectKey) {
  const res = await apiFetch(
    `${BASE_URL}/learn/${encodeURIComponent(subjectKey)}`,
    {
      headers: authHeaders(),
    },
  );
  if (!res.ok) throw new Error("Failed to fetch learning material");
  return res.json();
}

export async function getLearnPageNotes(subjectKey) {
  const res = await apiFetch(
    `${BASE_URL}/learn/${encodeURIComponent(subjectKey)}/notes`,
    { headers: authHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    throw new Error(typeof d === "string" ? d : "Failed to load notes");
  }
  return res.json();
}

export async function saveLearnPageNote(subjectKey, sectionId, pageIndex, body) {
  const res = await apiFetch(
    `${BASE_URL}/learn/${encodeURIComponent(subjectKey)}/${encodeURIComponent(sectionId)}/notes/${pageIndex}`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ body }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    throw new Error(typeof d === "string" ? d : "Failed to save notes");
  }
  return res.json();
}

export async function generateLearnPageNote(
  subjectKey,
  sectionId,
  pageIndex,
  { pageMarkdown, sectionTitle, subjectTitle },
) {
  const res = await apiFetch(
    `${BASE_URL}/learn/${encodeURIComponent(subjectKey)}/${encodeURIComponent(sectionId)}/notes/${pageIndex}/generate`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        page_markdown: pageMarkdown,
        section_title: sectionTitle,
        subject_title: subjectTitle,
      }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    throw new Error(typeof d === "string" ? d : "Failed to generate notes");
  }
  return res.json();
}

export async function getLearnPageHighlights(subjectKey) {
  const res = await apiFetch(
    `${BASE_URL}/learn/${encodeURIComponent(subjectKey)}/highlights`,
    { headers: authHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    throw new Error(typeof d === "string" ? d : "Failed to load highlights");
  }
  return res.json();
}

export async function saveLearnPageHighlights(
  subjectKey,
  sectionId,
  pageIndex,
  highlights,
) {
  const res = await apiFetch(
    `${BASE_URL}/learn/${encodeURIComponent(subjectKey)}/${encodeURIComponent(sectionId)}/highlights/${pageIndex}`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ highlights }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    throw new Error(typeof d === "string" ? d : "Failed to save highlights");
  }
  return res.json();
}

export async function updateLearnSection(subjectKey, sectionId, payload) {
  const res = await apiFetch(
    `${BASE_URL}/admin/learn/${encodeURIComponent(subjectKey)}/${encodeURIComponent(sectionId)}`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to update learning resource";
    if (typeof d === "string") msg = d;
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteLearnSection(subjectKey, sectionId) {
  const res = await apiFetch(
    `${BASE_URL}/admin/learn/${encodeURIComponent(subjectKey)}/${encodeURIComponent(sectionId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to delete learning resource";
    if (typeof d === "string") msg = d;
    throw new Error(msg);
  }
  return res.json();
}

export async function reorderLearnHubCollections(scope, subjectKeys) {
  const res = await apiFetch(`${BASE_URL}/admin/learn/hub/reorder`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ scope, subject_keys: subjectKeys }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to reorder collections";
    if (typeof d === "string") msg = d;
    throw new Error(msg);
  }
  return res.json();
}

export async function reorderLearnSections(subjectKey, sectionIds) {
  const res = await apiFetch(
    `${BASE_URL}/admin/learn/${encodeURIComponent(subjectKey)}/reorder`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ section_ids: sectionIds }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail;
    let msg = "Failed to reorder sections";
    if (typeof d === "string") msg = d;
    throw new Error(msg);
  }
  return res.json();
}

export async function getAdminLearnSections() {
  const res = await apiFetch(`${BASE_URL}/admin/learn/sections`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch published learning resources");
  return res.json();
}
