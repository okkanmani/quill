/** Label for admin shell header: account name and viewed student (if any). */
export function formatAdminHeaderTrail() {
  const admin = localStorage.getItem("adminName");
  const student = localStorage.getItem("studentName");
  if (admin && student) return `${admin} · ${student}`;
  if (admin) return `${admin} · …`;
  return student || "—";
}
