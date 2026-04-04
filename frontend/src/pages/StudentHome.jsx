import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getWorksheets, logout } from "../api";
import AppHeader from "../components/AppHeader";
import WorksheetsBySubject from "../components/WorksheetsBySubject";

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
      <AppHeader
        trailing={
          <span className="text-amber-800 text-sm font-medium">
            Hi, {name}!
          </span>
        }
        onLogout={handleLogout}
      />

      <div className="max-w-3xl">
        <h2 className="text-xl font-semibold text-amber-900 mb-4">
          Your Worksheets
        </h2>

        {loading && <p className="text-amber-600">Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && worksheets.length === 0 && (
          <p className="text-amber-600">No worksheets yet. Check back soon!</p>
        )}

        {!loading && !error && worksheets.length > 0 && (
          <WorksheetsBySubject
            worksheets={worksheets}
            onOpenWorksheet={(id) => navigate(`/student/worksheet/${id}`)}
          />
        )}
      </div>
    </div>
  );
}
