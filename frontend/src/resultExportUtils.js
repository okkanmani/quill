import { normalizeSubjectKey } from "./subjectUtils";

export const RESULT_EXPORT_VERSION = 1;

function answerText(ans) {
  const given = ans?.given;
  if (typeof given === "string" && given.trim()) return given.trim();
  if (ans?.response_mode === "scratchpad" || ans?.scratchpad) {
    return "[scratchpad response]";
  }
  return given ?? "";
}

function exportRowFromAnswer(ans, worksheetQuestion) {
  const difficulty =
    typeof ans?.stars === "number"
      ? ans.stars
      : typeof worksheetQuestion?.stars === "number"
        ? worksheetQuestion.stars
        : null;

  const row = {
    question: ans?.prompt ?? "",
    answer: answerText(ans),
    difficulty_level: difficulty,
    area: "",
  };

  if (ans?.question_id) row.question_id = ans.question_id;
  if (typeof ans?.correct === "boolean") row.correct = ans.correct;
  if (ans?.expected != null && String(ans.expected).trim()) {
    row.expected = String(ans.expected).trim();
  } else if (worksheetQuestion?.answer != null && String(worksheetQuestion.answer).trim()) {
    row.expected = String(worksheetQuestion.answer).trim();
  }
  if (Array.isArray(worksheetQuestion?.choices) && worksheetQuestion.choices.length) {
    row.choices = worksheetQuestion.choices.map((c) => String(c));
  }

  return row;
}

function worksheetQuestionMap(worksheet) {
  const out = new Map();
  for (const q of worksheet?.questions || []) {
    if (q?.id) out.set(q.id, q);
  }
  return out;
}

/** Per-worksheet export for teacher or AI to fill in `area` on each question. */
export function buildResultExportPayload(result, worksheet = null) {
  const subject = normalizeSubjectKey(result?.subject);
  const byId = worksheetQuestionMap(worksheet);
  return {
    export_version: RESULT_EXPORT_VERSION,
    result_id: result?.id ?? null,
    student: result?.student ?? null,
    worksheet_id: result?.worksheet_id ?? null,
    title: result?.title ?? null,
    subject,
    submitted_at: result?.submitted_at ?? null,
    questions: (result?.answers || []).map((ans) =>
      exportRowFromAnswer(ans, byId.get(ans?.question_id)),
    ),
  };
}

function safeFilenamePart(value) {
  return String(value || "export")
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadResultJson(result, worksheet = null) {
  const payload = buildResultExportPayload(result, worksheet);
  const stamp = (result?.submitted_at || new Date().toISOString()).slice(0, 10);
  const name = safeFilenamePart(result?.student || "student");
  const ws = safeFilenamePart(result?.worksheet_id || "worksheet");
  downloadJson(payload, `quill-result_${name}_${ws}_${stamp}.json`);
}

export async function readJsonFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}

export function validateFocusEvaluationUpload(data, result) {
  const errors = [];
  if (!data || typeof data !== "object") {
    return ["File must contain a JSON object."];
  }
  if (data.result_id == null) {
    errors.push("result_id is required.");
  } else if (result && Number(data.result_id) !== Number(result.id)) {
    errors.push("result_id does not match this worksheet submission.");
  }
  if (
    result &&
    typeof data.worksheet_id === "string" &&
    data.worksheet_id.trim() &&
    data.worksheet_id !== result.worksheet_id
  ) {
    errors.push("worksheet_id does not match this worksheet submission.");
  }
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    errors.push("questions must be a non-empty array.");
    return errors;
  }
  const hasArea = data.questions.some(
    (q) => typeof q?.area === "string" && q.area.trim(),
  );
  if (!hasArea) {
    errors.push("At least one question must have a non-empty area.");
  }
  return errors;
}

export function resolveResultForEvaluationUpload(data, results) {
  if (!data || typeof data !== "object") {
    return { error: "File must contain a JSON object." };
  }
  if (data.result_id == null) {
    return { error: "JSON must include result_id." };
  }
  const result = (results || []).find(
    (r) => Number(r.id) === Number(data.result_id),
  );
  if (!result) {
    return { error: "No matching submission found for the selected student." };
  }
  if (result.status === "pending") {
    return { error: "That worksheet is still awaiting grading." };
  }
  const errors = validateFocusEvaluationUpload(data, result);
  if (errors.length) {
    return { error: errors.join(" ") };
  }
  return { result };
}
