import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getWorksheets, logout } from "../api";
import SubjectBadge from "../components/SubjectBadge";

export default function StudentHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const [worksheets, setWorksheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const name = localStorage.getItem("name");

  useEffect(() => {
    setLoading(true);
    getWorksheets()
      .then(setWorksheets)
      .catch(() => setError("Could not load worksheets."))
      .finally(() => setLoading(false));
  }, [location.key]);

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
          <span className="text-amber-700 text-sm">Hi, {name}!</span>
          <button
            onClick={handleLogout}
            className="text-amber-600 text-sm underline"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Title */}
      <h2 className="text-xl font-semibold text-amber-900 mb-4">
        Your Worksheets
      </h2>

      {/* States */}
      {loading && <p className="text-amber-600">Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {/* Worksheet list */}
      {!loading && !error && worksheets.length === 0 && (
        <p className="text-amber-600">No worksheets yet. Check back soon!</p>
      )}

      <div className="flex flex-col gap-4">
        {worksheets.map((ws) => (
          <button
            key={ws.id}
            onClick={() => navigate(`/student/worksheet/${ws.id}`)}
            className="bg-white border border-amber-200 rounded-2xl p-5 text-left shadow-sm hover:shadow-md hover:border-amber-400 transition"
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
        ))}
      </div>
    </div>
  );
}
