import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getResults, logout } from "../api";
import { formatAdminHeaderTrail } from "../adminSession";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppHeader from "../components/AppHeader";
import AdminStudentSwitcher from "../components/AdminStudentSwitcher";
import {
  focusAreasAnalysis,
  formatFocusAreaList,
} from "../analysisUtils";

function FocusAreaRow({ focus }) {
  return (
    <div className="mt-4 first:mt-3">
      <p className="text-sm font-semibold text-slate-900">{focus.area}</p>
      <div className="mt-2 flex flex-col gap-2">
        {focus.examples.map((example, index) => (
          <div
            key={`${focus.area}-${index}`}
            className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
          >
            <p className="text-sm text-slate-800 leading-relaxed">
              <span className="font-medium text-slate-600">
                Example{focus.examples.length > 1 ? ` ${index + 1}` : ""} —{" "}
              </span>
              {example.question}
            </p>
            {example.answer !== "" && example.answer != null ? (
              <p className="text-sm text-red-800 mt-2">
                <span className="font-medium">Student answered: </span>
                {example.answer}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SubjectBlock({ subject }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-4">
      <p className="text-lg font-semibold text-slate-900">{subject.subjectLabel}</p>
      <p className="text-sm text-slate-700 mt-3 leading-relaxed">
        <span className="font-semibold text-slate-900">Area to focus</span>
        {" — "}
        {formatFocusAreaList(subject.areasToFocus)}
      </p>
      {subject.focusAreas
        ?.filter((f) => f.examples?.length)
        .map((focus) => (
          <FocusAreaRow key={focus.area} focus={focus} />
        ))}
    </div>
  );
}

export default function AdminAnalysis() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    getResults()
      .then((data) => {
        setError("");
        setResults(data);
      })
      .catch(() => setError("Could not load analysis data."))
      .finally(() => setLoading(false));
  }, []);

  const bySubject = useMemo(() => focusAreasAnalysis(results), [results]);
  const uploadedCount = results.filter((r) => r.focus_evaluation).length;

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  const studentName = localStorage.getItem("studentName");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-40 border-b border-slate-200/90 bg-slate-50/95 backdrop-blur-sm shadow-sm supports-[backdrop-filter]:bg-slate-50/85">
        <div className="px-6 pt-6 pb-4">
          <AppHeader
            navLinks={ADMIN_MAIN_NAV}
            onBack={() => navigate("/admin")}
            className="!mb-0"
            trailing={
              <span className="text-slate-800 text-sm font-medium">
                Admin · {formatAdminHeaderTrail()}
              </span>
            }
            onLogout={handleLogout}
          />
        </div>
      </div>

      <div className="px-6 pb-6 pt-4">
        <div className="max-w-3xl">
          <AdminStudentSwitcher />

          <h1 className="text-2xl font-bold text-slate-950 mb-2">Analysis</h1>
          <p className="text-slate-700 text-sm mb-8 leading-relaxed">
            {studentName
              ? `Focus areas for ${studentName} — from evaluated worksheet JSON uploads.`
              : "Focus areas from evaluated worksheet JSON uploads."}
            {" "}
            Download a result on the Results page, fill in{" "}
            <code className="text-xs bg-slate-100 px-1 rounded">area</code> on
            each question, then upload the JSON back on that result.
          </p>

          {loading && <p className="text-slate-600">Loading…</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}

          {!loading && !error && results.length === 0 && (
            <p className="text-slate-600">
              No submissions yet — analysis will appear after worksheets are graded.
            </p>
          )}

          {!loading && !error && results.length > 0 && uploadedCount === 0 && (
            <p className="text-slate-600">
              No evaluated JSON uploads yet — download a worksheet result, fill in{" "}
              <code className="text-xs bg-slate-100 px-1 rounded">area</code>, and
              upload it from the Results page.
            </p>
          )}

          {!loading && !error && bySubject.length > 0 && (
            <div className="flex flex-col gap-4">
              {bySubject.map((subject) => (
                <SubjectBlock key={subject.subjectKey} subject={subject} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
