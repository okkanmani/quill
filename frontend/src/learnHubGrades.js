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

export function resolveLearnHubGrade(gradeParam, availableGrades) {
  if (!availableGrades?.length) return null;
  const parsed = parseInt(String(gradeParam || "").trim(), 10);
  if (availableGrades.includes(parsed)) return parsed;
  return availableGrades[0];
}

/** Hub card blurb: drop grade (tabs show grade); keep curriculum or custom copy. */
export function learnHubDescriptionWithoutGrade(description) {
  const text = String(description || "").trim();
  if (!text) return "";

  const autoLine = text.match(/^Grade\s+\d+(?:\s*[·•]\s*(.+))?$/i);
  if (autoLine) {
    return (autoLine[1] || "").trim();
  }

  return text
    .replace(/^Grade\s+\d+\s*[·•]\s*/i, "")
    .replace(/\s*[·•]\s*Grade\s+\d+\s*$/i, "")
    .trim();
}
