import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getWorksheets, logout } from "../api";

export default function StudentHome() {
  console.log("StudentHome rendered");
  const navigate = useNavigate();
  const [worksheets, setWorksheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const name = localStorage.getItem("name");

  useEffect(() => {
    getWorksheets()
      .then(setWorksheets)
      .catch(() => setError("Could not load worksheets."))
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
            <p className="text-amber-900 font-semibold text-lg">{ws.title}</p>
            <p className="text-amber-500 text-sm mt-1 capitalize">
              {ws.subject} · {ws.question_count} questions
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
