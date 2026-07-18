import {
  clearSession,
  handleSessionExpired,
  isAuthenticated,
  touchActivity,
} from "./sessionAuth";

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
  if (res.status === 401 && token && !urlStr.includes("/auth/login") && !urlStr.includes("/auth/signup")) {
    await handleSessionExpired("expired");
  }
  return res;
}

export { touchActivity };

// --- Auth ---

export async function loginAdmin({ studentName, adminName, password }) {
  const body = { password };
  if (studentName) body.student_name = studentName;
  if (adminName) body.admin_name = adminName;
  const res = await fetch(`${BASE_URL}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

export async function loginStudent({ name, password }) {
  const res = await fetch(`${BASE_URL}/auth/student/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, password }),
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

export async function listAdminStudents() {
  const res = await apiFetch(`${BASE_URL}/admin/students`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to list students");
  return res.json();
}

export async function createAdminStudent({ name, password, grade }) {
  const res = await apiFetch(`${BASE_URL}/admin/students`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name, password, grade }),
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
