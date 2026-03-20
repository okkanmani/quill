import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getResults, logout } from "../api";

export default function AdminHome() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getResults()
      .then(setResults)
      .catch(() => setError("Could not load results."))
      .finally(() => setLoading(false));
  }, []);

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
          <span className="text-amber-700 text-sm">Admin</span>
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

      <div className="flex flex-col gap-4">
        {results.map((r) => (
          <div
            key={r.worksheet_id}
            className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm"
          >
            {/* Per question breakdown */}
            <div className="flex justify-between items-center mb-4">
              <p className="text-amber-900 font-semibold text-lg">
                {r.title || r.worksheet_id}
              </p>
              <span
                className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  r.score === r.total
                    ? "bg-green-100 text-green-700"
                    : r.score >= r.total / 2
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {r.score} / {r.total}
              </span>
            </div>
            {/* Worksheet title and score */}
            <div className="flex justify-between items-center mb-4">
              <p className="text-amber-900 font-semibold text-lg">
                {r.answers.map((a) => (
                  <div
                    key={a.question_id}
                    className="flex justify-between items-center text-sm gap-4"
                  >
                    <span className="text-amber-700 flex-1">{a.prompt}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-amber-500">"{a.given}"</span>
                      <span>{a.correct ? "✅" : "❌"}</span>
                    </div>
                  </div>
                ))}
              </p>
              <span
                className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  r.score === r.total
                    ? "bg-green-100 text-green-700"
                    : r.score >= r.total / 2
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {r.score} / {r.total}
              </span>
            </div>

            {/* Submitted at */}
            <p className="text-amber-400 text-xs mt-4">
              Submitted: {new Date(r.submitted_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
