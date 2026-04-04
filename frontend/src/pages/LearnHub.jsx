import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getLearnSubjects } from "../api";
import LearnChrome from "../components/LearnChrome";
import { formatSubjectLabel } from "../components/SubjectBadge";

export default function LearnHub() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isAdmin = localStorage.getItem("role") === "admin";

  useEffect(() => {
    getLearnSubjects()
      .then((data) => setSubjects(data.subjects || []))
      .catch(() => setError("Could not load learning topics."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <LearnChrome
      onBack={() => navigate(isAdmin ? "/admin/worksheets" : "/student")}
    >
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-amber-950 mb-2">Learning materials</h1>
        <p className="text-amber-700 text-sm mb-8 leading-relaxed">
          Draft reference pages (Markdown). More subjects can be added under{" "}
          <code className="text-xs bg-amber-100 px-1 rounded">backend/data/learn/</code>.
        </p>

        {loading && <p className="text-amber-600">Loading…</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {!loading && !error && subjects.length === 0 && (
          <p className="text-amber-600">No topics yet.</p>
        )}

        <div className="flex flex-col gap-4">
          {subjects.map((s) => (
            <Link
              key={s.key}
              to={`/student/learn/${s.key}`}
              className="block rounded-2xl border border-amber-200 bg-white p-5 shadow-sm hover:border-amber-400 hover:shadow-md transition"
            >
              <p className="text-lg font-semibold text-amber-900">
                {formatSubjectLabel(s.key)}
              </p>
              {s.description ? (
                <p className="text-amber-600 text-sm mt-2 leading-relaxed">
                  {s.description}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </LearnChrome>
  );
}
