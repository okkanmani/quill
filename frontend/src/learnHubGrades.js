/** Grade metadata for Learn hub collections (mirrors backend _grade_from_subject). */

export function learnSubjectGrade(subject) {
  if (!subject) return 0;
  const raw = subject.grade;
  if (typeof raw === "number" && raw > 0) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return parseInt(raw.trim(), 10);
  }
  for (const field of [subject.description, subject.title]) {
    const match = String(field || "").match(/Grade\s+(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  const key = subject.key || subject.subject_key || "";
  const keyMatch = String(key).match(/-g(\d+)(?:$|-)/i);
  if (keyMatch) return parseInt(keyMatch[1], 10);
  return 0;
}

export function flattenHubSubjects(entries) {
  const out = [];
  for (const entry of entries || []) {
    if (entry.type === "subject") out.push(entry);
    else if (entry.type === "group") {
      for (const subject of entry.subjects || []) out.push(subject);
    }
  }
  return out;
}

export function sortedGradesFromSubjects(subjects) {
  const set = new Set();
  for (const subject of subjects || []) {
    const grade = learnSubjectGrade(subject);
    if (grade > 0) set.add(grade);
  }
  return [...set].sort((a, b) => a - b);
}

export function filterHubEntriesByGrade(entries, grade) {
  const target = Number(grade);
  if (!target) return entries || [];

  return (entries || [])
    .map((entry) => {
      if (entry.type === "subject") {
        return learnSubjectGrade(entry) === target ? entry : null;
      }
      if (entry.type === "group") {
        const subjects = (entry.subjects || []).filter(
          (subject) => learnSubjectGrade(subject) === target,
        );
        if (subjects.length === 0) return null;
        return { ...entry, subjects };
      }
      return entry;
    })
    .filter(Boolean);
}

export function preferredStudentGrade() {
  const raw =
    localStorage.getItem("studentGrade") || localStorage.getItem("grade") || "";
  const parsed = parseInt(String(raw).trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolveLearnHubGrade(gradeParam, availableGrades, preferredGrade = null) {
  if (!availableGrades?.length) return null;
  const parsed = parseInt(String(gradeParam || "").trim(), 10);
  if (availableGrades.includes(parsed)) return parsed;
  const preferred = preferredGrade ?? preferredStudentGrade();
  if (preferred && availableGrades.includes(preferred)) return preferred;
  return availableGrades[0];
}

export function learnSubjectCurriculum(subject) {
  const fromField = String(subject?.curriculum || "").trim();
  if (fromField) return fromField;
  const desc = String(subject?.description || subject?.subject_description || "");
  const match = desc.match(/^Grade\s+\d+\s*[·•]\s*(.+)$/i);
  if (match) return match[1].trim();
  return "";
}

export function curriculumKey(curriculum) {
  return String(curriculum || "")
    .trim()
    .toLowerCase();
}

export function sortedCurriculaFromSubjects(subjects) {
  const byKey = new Map();
  for (const subject of subjects || []) {
    const label = learnSubjectCurriculum(subject);
    const key = curriculumKey(label);
    if (key) byKey.set(key, label);
  }
  return [...byKey.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

export function subjectMatchesCurriculum(subject, curriculumLabel) {
  if (!curriculumLabel) return true;
  return curriculumKey(learnSubjectCurriculum(subject)) === curriculumKey(curriculumLabel);
}

export function filterHubEntriesByCurriculum(entries, curriculumLabel) {
  if (!curriculumLabel) return entries || [];

  return (entries || [])
    .map((entry) => {
      if (entry.type === "subject") {
        return subjectMatchesCurriculum(entry, curriculumLabel) ? entry : null;
      }
      if (entry.type === "group") {
        const subjects = (entry.subjects || []).filter((subject) =>
          subjectMatchesCurriculum(subject, curriculumLabel),
        );
        if (subjects.length === 0) return null;
        return { ...entry, subjects };
      }
      return entry;
    })
    .filter(Boolean);
}

export function filterHubEntriesByGradeAndCurriculum(entries, grade, curriculumLabel) {
  let next = entries || [];
  if (grade) next = filterHubEntriesByGrade(next, grade);
  if (curriculumLabel) next = filterHubEntriesByCurriculum(next, curriculumLabel);
  return next;
}

export function resolveLearnHubCurriculum(
  curriculumParam,
  availableCurricula,
  preferredCurriculum = null,
) {
  if (!availableCurricula?.length) return null;
  const raw = decodeURIComponent(String(curriculumParam || "").trim());
  const key = curriculumKey(raw);
  if (key) {
    const match = availableCurricula.find((c) => curriculumKey(c) === key);
    if (match) return match;
  }
  const preferred = String(preferredCurriculum || "").trim();
  if (preferred) {
    const prefMatch = availableCurricula.find(
      (c) => curriculumKey(c) === curriculumKey(preferred),
    );
    if (prefMatch) return prefMatch;
  }
  return availableCurricula[0];
}

export function preferredStudentCurriculum() {
  return (
    localStorage.getItem("studentCurriculum") ||
    localStorage.getItem("curriculum") ||
    ""
  );
}

export function learnHubSearchParams({ grade, curriculum }) {
  const params = new URLSearchParams();
  if (grade != null) params.set("grade", String(grade));
  if (curriculum) params.set("curriculum", curriculum);
  return params;
}

/** Hide auto "Grade N · curriculum" lines; keep only custom collection copy. */
export function learnHubCollectionBlurb(description) {
  const text = String(description || "").trim();
  if (!text) return "";
  if (/^Grade\s+\d+(?:\s*[·•]\s*.+)?$/i.test(text)) return "";
  return text
    .replace(/^Grade\s+\d+\s*[·•]\s*/i, "")
    .replace(/\s*[·•]\s*Grade\s+\d+\s*$/i, "")
    .trim();
}

/** @deprecated use learnHubCollectionBlurb */
export function learnHubDescriptionWithoutGrade(description) {
  return learnHubCollectionBlurb(description);
}
