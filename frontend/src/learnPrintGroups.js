/** Filter learn groups to a single section for section-scoped PDF export. */
export function groupsForSection(groups, sectionId) {
  const id = String(sectionId || "").trim();
  if (!id) return [];

  for (const group of groups || []) {
    const section = (group.sections || []).find((row) => row.id === id);
    if (section) {
      return [{ ...group, sections: [section] }];
    }
  }
  return [];
}

export function countLearnSections(groups) {
  let n = 0;
  for (const group of groups || []) {
    n += (group.sections || []).length;
  }
  return n;
}

/** e.g. "Grade 6 · Ontario" */
export function formatLearnGradeCurriculum(grade, curriculum) {
  const parts = [];
  if (grade != null && grade !== "") {
    parts.push(`Grade ${grade}`);
  }
  const cur = String(curriculum || "").trim();
  if (cur) {
    parts.push(cur);
  }
  return parts.join(" · ");
}
