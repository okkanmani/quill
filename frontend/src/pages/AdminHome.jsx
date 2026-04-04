import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getResults, logout } from "../api";

export default function AdminHome() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** Which result cards have answers expanded (default: none). */
  const [openIds, setOpenIds] = useState(() => new Set());

  useEffect(() => {
    getResults()
      .then(setResults)
      .catch(() => setError("Could not load results."))
      .finally(() => setLoading(false));
  }, []);

  function toggleAnswers(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-amber-50 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-amber-800">🪶 Quill</h1>
        <div className="flex items-center gap-4">
          <Link
            to="/admin/worksheets"
            className="text-amber-700 text-sm underline hover:text-amber-900"
          >
            Worksheets
          </Link>
          <span className="text-amber-700 text-sm">
            Admin · {localStorage.getItem("studentName") || "—"}
          </span>
          <button
            onClick={handleLogout}
            className="text-amber-600 text-sm underline"
          >
            Logout
          </button>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-amber-900 mb-6">Results</h2>

      {loading && <p className="text-amber-600">Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && results.length === 0 && (
        <p className="text-amber-600">No results yet.</p>
      )}

      <div className="flex flex-col gap-4 max-w-3xl">
        {results.map((r) => {
          const expanded = openIds.has(r.id);
          return (
            <div
              key={r.id}
              className="bg-white border border-amber-200 rounded-2xl shadow-sm overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleAnswers(r.id)}
                aria-expanded={expanded}
                className="w-full text-left p-5 hover:bg-amber-50/60 transition flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-amber-900 font-semibold text-lg">
                    {r.title || r.worksheet_id}
                  </p>
                  {r.student ? (
                    <p className="text-amber-600 text-sm mt-1">{r.student}</p>
                  ) : null}
                  <p className="text-amber-400 text-xs mt-2">
                    Submitted: {new Date(r.submitted_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                  <span
                    className={`inline-flex text-sm font-semibold px-3 py-1 rounded-full ${
                      r.score === r.total
                        ? "bg-green-100 text-green-700"
                        : r.score >= r.total / 2
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {r.score} / {r.total}
                  </span>
                  <span className="text-amber-600 text-xs font-semibold underline underline-offset-2">
                    {expanded ? "Hide answers" : "Show answers"}
                  </span>
                </div>
              </button>

              {expanded ? (
                <div className="border-t border-amber-100 px-5 pb-5 pt-4 bg-amber-50/30">
                  <ul className="flex flex-col gap-4">
                    {r.answers.map((a, index) => (
                      <li
                        key={a.question_id}
                        className="rounded-xl bg-white border border-amber-100 p-4 shadow-sm"
                      >
                        <p className="text-amber-800 text-sm font-medium leading-snug">
                          <span className="text-amber-500 font-normal">
                            {index + 1}.{" "}
                          </span>
                          {a.prompt}
                        </p>
                        <div className="mt-3 flex flex-col gap-1.5 text-sm sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                          <span className="text-amber-600 shrink-0">Response:</span>
                          <span className="text-amber-900 font-medium break-words min-w-0">
                            {a.given === "" || a.given == null
                              ? "(empty)"
                              : `"${a.given}"`}
                          </span>
                          <span
                            className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                              a.correct
                                ? "bg-green-50 text-green-800 border-green-200"
                                : "bg-red-50 text-red-800 border-red-200"
                            }`}
                          >
                            {a.correct ? "Correct" : "Incorrect"}
                          </span>
                        </div>
                        {!a.correct && a.expected != null && a.expected !== "" ? (
                          <p className="mt-2 text-sm text-amber-900">
                            <span className="text-red-700 font-semibold">
                              Correct answer:{" "}
                            </span>
                            {a.expected}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
