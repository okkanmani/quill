/** Persist grade/curriculum for Learn hub defaults and admin context. */
export function applyStudentSessionPrefs({ grade, curriculum } = {}) {
  if (grade != null && grade !== "") {
    localStorage.setItem("studentGrade", String(grade));
    localStorage.setItem("grade", String(grade));
  } else if (grade === null) {
    localStorage.removeItem("studentGrade");
    localStorage.removeItem("grade");
  }

  const cleanedCurriculum = String(curriculum ?? "").trim();
  if (cleanedCurriculum) {
    localStorage.setItem("studentCurriculum", cleanedCurriculum);
    localStorage.setItem("curriculum", cleanedCurriculum);
  } else if (curriculum !== undefined) {
    localStorage.removeItem("studentCurriculum");
    localStorage.removeItem("curriculum");
  }
}

/** Label for admin shell header: account name and viewed student (if any). */
export function formatAdminHeaderTrail() {
  const admin = localStorage.getItem("adminName");
  const student = localStorage.getItem("studentName");
  const grade = localStorage.getItem("studentGrade");
  const studentLabel =
    student && grade ? `${student} (Gr. ${grade})` : student;
  if (admin && studentLabel) return `${admin} · ${studentLabel}`;
  if (admin) return `${admin} · …`;
  return studentLabel || "—";
}

/** Sidebar footer: primary line (account) and secondary line (student name). */
export function getShellFooterLines() {
  const role = localStorage.getItem("role");
  if (role === "admin") {
    const admin = localStorage.getItem("adminName") || "Admin";
    const student = localStorage.getItem("studentName");
    const grade = localStorage.getItem("studentGrade");
    let line2 = null;
    if (student) {
      line2 = grade ? `${student} (Gr. ${grade})` : student;
    }
    return { line1: admin, line2 };
  }
  const name = localStorage.getItem("name");
  return { line1: name ? "Hi!" : null, line2: name };
}
