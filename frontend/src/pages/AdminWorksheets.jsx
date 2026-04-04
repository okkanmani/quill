import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { deleteWorksheet, getWorksheets, logout } from "../api";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppHeader from "../components/AppHeader";
import WorksheetsBySubject from "../components/WorksheetsBySubject";

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
      <AppHeader
        navLinks={ADMIN_MAIN_NAV}
        trailing={
          <span className="text-amber-800 text-sm font-medium">
            Admin · {localStorage.getItem("studentName") || "—"}
          </span>
        }
        onLogout={handleLogout}
      />

      {loading && <p className="text-amber-600">Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && worksheets.length === 0 && (
        <p className="text-amber-600">No worksheets.</p>
      )}

      {!loading && !error && worksheets.length > 0 && (
        <WorksheetsBySubject
          worksheets={worksheets}
          onOpenWorksheet={(id) => navigate(`/student/worksheet/${id}`)}
          renderSideAction={(ws) => (
            <button
              type="button"
              onClick={() => handleDelete(ws)}
              className="sm:w-28 shrink-0 bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-sm font-semibold rounded-2xl px-4 py-3 transition"
            >
              Delete
            </button>
          )}
        />
      )}
    </div>
  );
}
