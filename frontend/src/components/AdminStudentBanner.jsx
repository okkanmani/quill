import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { listAdminStudents, switchAdminStudent } from "../api";
import QuillLoading from "./QuillLoading";

/**
 * Prompts admin to choose (or add) a student before viewing results/worksheets.
 */
export default function AdminStudentBanner() {
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
    if (loading || current || students.length !== 1) return;
    const only = students[0].name;
    switchAdminStudent(only)
      .then((data) => {
        localStorage.setItem("token", data.token);
        localStorage.setItem("studentName", data.student_name);
        if (data.admin_name) localStorage.setItem("adminName", data.admin_name);
        if (data.grade != null) localStorage.setItem("studentGrade", String(data.grade));
        window.location.reload();
      })
      .catch(() => setErr("Could not select your student."));
  }, [loading, students, current]);

  async function onSelect(name) {
    if (!name || name === current) return;
    setErr("");
    try {
      const data = await switchAdminStudent(name);
      localStorage.setItem("token", data.token);
      localStorage.setItem("studentName", data.student_name);
      if (data.admin_name) localStorage.setItem("adminName", data.admin_name);
      if (data.grade != null) localStorage.setItem("studentGrade", String(data.grade));
      else localStorage.removeItem("studentGrade");
      window.location.reload();
    } catch {
      setErr("Could not switch student.");
    }
  }

  if (loading) {
    return (
      <div className="mb-4">
        <QuillLoading size="sm" label="" showLabel={false} />
      </div>
    );
  }

  if (current) return null;

  if (students.length === 0) {
    return (
      <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 shadow-sm">
        <p className="text-amber-950 font-semibold">Choose a student to continue</p>
        <p className="text-amber-900 text-sm mt-1 leading-relaxed">
          Add a student profile first, then return here to view their worksheets and
          results.
        </p>
        <Link
          to="/admin/students"
          className="inline-flex mt-3 rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-950 transition"
        >
          Go to Students
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 shadow-sm">
      <p className="text-amber-950 font-semibold">Choose a student to continue</p>
      <p className="text-amber-900 text-sm mt-1 leading-relaxed">
        Pick who you are viewing so worksheets, results, and analysis show the right
        data.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="admin-student-banner" className="sr-only">
          Select student
        </label>
        <select
          id="admin-student-banner"
          defaultValue=""
          onChange={(e) => onSelect(e.target.value)}
          className="border border-amber-300 rounded-xl px-3 py-2 bg-white text-slate-950 font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="" disabled>
            Choose a student…
          </option>
          {students.map((s) => (
            <option key={s.id} value={s.name}>
              {s.grade ? `${s.name} (Gr. ${s.grade})` : s.name}
            </option>
          ))}
        </select>
        <Link
          to="/admin/students"
          className="text-sm font-semibold text-amber-950 underline underline-offset-2 hover:text-amber-900"
        >
          Manage students
        </Link>
      </div>
      {err ? <p className="text-red-700 text-sm mt-2">{err}</p> : null}
    </div>
  );
}
