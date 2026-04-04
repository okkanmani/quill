import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { deleteWorksheet, getWorksheets, logout } from "../api";
import SubjectBadge from "../components/SubjectBadge";

export default function AdminWorksheets() {
  const navigate = useNavigate();
  const location = useLocation();
  const [worksheets, setWorksheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function loadWorksheets() {
    setLoading(true);
    getWorksheets()
      .then((data) => {
        setError("");
        setWorksheets(data);
      })
      .catch(() => setError("Could not load worksheets."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadWorksheets();
  }, [location.key]);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  async function handleDelete(ws) {
    const ok = window.confirm(
      `Delete “${ws.title}”? This removes it from the database. It will not come back unless you import it again from JSON.`,
    );
    if (!ok) return;
    try {
      await deleteWorksheet(ws.id);
      setError("");
      setWorksheets((prev) => prev.filter((w) => w.id !== ws.id));
    } catch {
      setError("Could not delete worksheet.");
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-amber-800">🪶 Quill</h1>
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="text-amber-700 text-sm underline hover:text-amber-900"
          >
            Results
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

      <h2 className="text-xl font-semibold text-amber-900 mb-4">Worksheets</h2>

      {loading && <p className="text-amber-600">Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && worksheets.length === 0 && (
        <p className="text-amber-600">No worksheets.</p>
      )}

      <div className="flex flex-col gap-4">
        {worksheets.map((ws) => (
          <div
            key={ws.id}
            className="flex flex-col sm:flex-row gap-3 sm:items-stretch"
          >
            <button
              type="button"
              onClick={() => navigate(`/student/worksheet/${ws.id}`)}
              className="flex-1 bg-white border border-amber-200 rounded-2xl p-5 text-left shadow-sm hover:shadow-md hover:border-amber-400 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-amber-900 font-semibold text-lg">{ws.title}</p>
                {ws.done === true || ws.done === 1 ? (
                  <span className="shrink-0 inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                    Done
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <SubjectBadge subject={ws.subject} />
                <span className="text-amber-500 text-sm">
                  {ws.question_count} questions
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleDelete(ws)}
              className="sm:w-28 shrink-0 bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-sm font-semibold rounded-2xl px-4 py-3 transition"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
