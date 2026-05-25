import { useEffect, useState } from "react";
import { listAdminStudents, switchAdminStudent } from "../api";

/**
 * Lets an admin change which student’s worksheets/results they are viewing (same JWT admin_id).
 */
export default function AdminStudentSwitcher() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const current = localStorage.getItem("studentName") || "";

  useEffect(() => {
    listAdminStudents()
      .then((data) => setStudents(data.students || []))
      .catch(() => setErr("Could not load students."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || students.length !== 1) return;
    const only = students[0].name;
    if (current) return;
    switchAdminStudent(only)
      .then((data) => {
        localStorage.setItem("token", data.token);
        localStorage.setItem("studentName", data.student_name);
        if (data.admin_name) localStorage.setItem("adminName", data.admin_name);
        window.location.reload();
      })
      .catch(() => setErr("Could not select your student."));
  }, [loading, students, current]);

  async function onChange(name) {
    if (!name || name === current) return;
    setErr("");
    try {
      const data = await switchAdminStudent(name);
      localStorage.setItem("token", data.token);
      localStorage.setItem("studentName", data.student_name);
      if (data.admin_name) localStorage.setItem("adminName", data.admin_name);
      window.location.reload();
    } catch {
      setErr("Could not switch student.");
    }
  }

  if (loading || students.length === 0) return null;
  if (students.length === 1 && !current) return null;
  if (students.length === 1 && current === students[0].name) return null;

  const selectValue =
    current && students.some((s) => s.name === current) ? current : "";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor="admin-student-switch" className="text-slate-800 font-medium">
        Viewing results for
      </label>
      <select
        id="admin-student-switch"
        value={selectValue}
        onChange={(e) => onChange(e.target.value)}
        className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-950 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        {!selectValue ? (
          <option value="" disabled>
            Choose a student…
          </option>
        ) : null}
        {students.map((s) => (
          <option key={s.id} value={s.name}>
            {s.name}
          </option>
        ))}
      </select>
      {err ? <span className="text-red-600">{err}</span> : null}
    </div>
  );
}
