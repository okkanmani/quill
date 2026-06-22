import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getLearnSubjects } from "../api";
import LearnChrome from "../components/LearnChrome";

function SubjectCard({ subject }) {
  return (
    <Link
      to={`/student/learn/${subject.key}`}
      className="block rounded-xl border border-slate-200 bg-slate-50/80 p-4 hover:border-indigo-400 hover:bg-white hover:shadow-sm transition"
    >
      <p className="text-base font-semibold text-slate-900">{subject.title}</p>
      {subject.description ? (
        <p className="text-slate-600 text-sm mt-1.5 leading-relaxed line-clamp-3">
          {subject.description}
        </p>
      ) : null}
    </Link>
  );
}

export default function LearnHub() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedGroups, setExpandedGroups] = useState(() => new Set(["math"]));
  const isAdmin = localStorage.getItem("role") === "admin";

  useEffect(() => {
    getLearnSubjects()
      .then((data) => setEntries(data.entries || []))
      .catch(() => setError("Could not load learning topics."))
      .finally(() => setLoading(false));
  }, []);

  function toggleGroup(id) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <LearnChrome
      onBack={() => navigate(isAdmin ? "/admin/worksheets" : "/student")}
    >
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-950 mb-2">Learning resources</h1>
        <p className="text-slate-700 text-sm mb-8 leading-relaxed">
          Reference pages you can read before worksheets.
        </p>

        {loading && <p className="text-slate-600">Loading…</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {!loading && !error && entries.length === 0 && (
          <p className="text-slate-600">No topics yet.</p>
        )}

        <div className="flex flex-col gap-4">
          {entries.map((entry) => {
            if (entry.type === "subject") {
              return (
                <SubjectCard key={entry.key} subject={entry} />
              );
            }

            const open = expandedGroups.has(entry.id);
            return (
              <div
                key={entry.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(entry.id)}
                  aria-expanded={open}
                  className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 hover:bg-slate-50/80 transition"
                >
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-slate-900">{entry.title}</p>
                    {entry.description ? (
                      <p className="text-slate-600 text-sm mt-1.5 leading-relaxed">
                        {entry.description}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className="text-slate-500 text-lg leading-none shrink-0 pt-0.5"
                    aria-hidden
                  >
                    {open ? "−" : "+"}
                  </span>
                </button>
                {open ? (
                  <div className="px-5 pb-5 pt-0 flex flex-col gap-3 border-t border-slate-100">
                    {entry.subjects?.map((s) => (
                      <SubjectCard key={s.key} subject={s} />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </LearnChrome>
  );
}
