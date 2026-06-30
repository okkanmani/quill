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
