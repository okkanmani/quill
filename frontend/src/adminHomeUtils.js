import { formatAreaLabel } from "./analysisUtils";
import { normalizeSubjectKey } from "./subjectUtils";

export function focusSelectionKey(subject, area) {
  return `${normalizeSubjectKey(subject)}::${String(area || "").trim().toLowerCase()}`;
}

export function activityKindLabel(item) {
  if (item.kind === "test_completed") return "Test";
  if (item.kind === "worksheet_completed") return "Worksheet";
  if (item.kind === "reinforcement_flagged") return "Reinforcement";
  if (item.kind === "test_locked") return "Test";
  return "Activity";
}

export function activityKindBadgeClass(item) {
  if (item.kind === "test_completed" || item.kind === "test_locked") {
    return "bg-violet-100 text-violet-900 border-violet-200";
  }
  if (item.kind === "reinforcement_flagged") {
    return "bg-amber-100 text-amber-900 border-amber-200";
  }
  return "bg-sky-100 text-sky-900 border-sky-200";
}

export function attentionKindBadgeClass(item) {
  if (item.kind === "reinforcement") {
    return "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100";
  }
  return "bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100";
}

export function activityTitle(item) {
  if (item.kind === "reinforcement_flagged") {
    return formatAreaLabel(item.area) || "Focus area";
  }
  return item.title || "Untitled";
}

export function activityDestination(item) {
  if (item.kind === "worksheet_completed" && item.result_id != null) {
    return `/admin/results?result=${encodeURIComponent(item.result_id)}`;
  }
  if (item.kind === "test_completed" && item.attempt_id != null) {
    return `/admin/results?view=tests&attempt=${encodeURIComponent(item.attempt_id)}`;
  }
  if (item.kind === "reinforcement_flagged" && item.subject && item.area) {
    return `/admin/analysis?focus=${encodeURIComponent(focusSelectionKey(item.subject, item.area))}`;
  }
  if (item.kind === "test_locked") {
    return "/admin/worksheets";
  }
  return null;
}

export function resultIdsMatch(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

export async function navigateForStudent(
  navigate,
  studentName,
  path,
  { switchStudent, currentStudentName = localStorage.getItem("studentName") || "" } = {},
) {
  if (studentName && studentName !== currentStudentName && switchStudent) {
    await switchStudent(studentName);
  }
  navigate(path);
}
