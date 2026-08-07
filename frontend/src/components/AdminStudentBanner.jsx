import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { listAdminStudents, switchAdminStudent } from "../api";
import { applyStudentSessionPrefs } from "../adminSession";
import { ADMIN_STUDENT_BANNER_COPY } from "../adminStudentBannerCopy";
import QuillLoading from "./QuillLoading";

/**
 * Prompts admin to choose (or add) a student before viewing student-scoped pages.
 */
export default function AdminStudentBanner({ context = "results", centered = false }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const current = localStorage.getItem("studentName") || "";
  const copy = ADMIN_STUDENT_BANNER_COPY[context] || ADMIN_STUDENT_BANNER_COPY.results;

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
        applyStudentSessionPrefs({
          grade: data.grade,
          curriculum: data.curriculum ?? "",
        });
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
      applyStudentSessionPrefs({
        grade: data.grade,
        curriculum: data.curriculum ?? "",
      });
      window.location.reload();
    } catch {
      setErr("Could not switch student.");
    }
  }

  if (loading) {
    return (
      <div className={centered ? "flex justify-center" : "mb-4"}>
        <QuillLoading size="sm" label="" showLabel={false} />
      </div>
    );
  }

  if (current) return null;

  const shellClass = centered
    ? "w-full max-w-md rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/80 px-5 py-6 shadow-sm text-center"
    : "mb-6 rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/80 px-5 py-5 shadow-sm";

  if (students.length === 0) {
    return (
      <div className={shellClass}>
        <p className="text-amber-950 font-semibold">{copy.title}</p>
        <p className="text-amber-900 text-sm mt-1.5 leading-relaxed">{copy.emptyDescription}</p>
        <Link
          to="/admin/students"
          className={`inline-flex rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-950 transition ${
            centered ? "mt-4" : "mt-3"
          }`}
        >
          Go to Students
        </Link>
      </div>
    );
  }

  const description =
    students.length > 1 ? copy.description : copy.singleDescription;

  return (
    <div className={shellClass}>
      <p className="text-amber-950 font-semibold text-lg">{copy.title}</p>
      <p className="text-amber-900 text-sm mt-1.5 leading-relaxed">{description}</p>
      <div
        className={`mt-4 flex flex-wrap items-center gap-2 ${
          centered ? "justify-center" : ""
        }`}
      >
        <label htmlFor={`admin-student-banner-${context}`} className="sr-only">
          Select student
        </label>
        <select
          id={`admin-student-banner-${context}`}
          defaultValue=""
          onChange={(e) => onSelect(e.target.value)}
          className="quill-field-select border border-amber-300 rounded-xl px-3 py-2 bg-white text-slate-950 font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
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
