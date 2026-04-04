import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getResults, logout } from "../api";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppHeader from "../components/AppHeader";
import ResultsBySubject from "../components/ResultsBySubject";

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

      {!loading && !error && results.length === 0 && (
        <p className="text-amber-600">No results yet.</p>
      )}

      {!loading && !error && results.length > 0 && (
        <ResultsBySubject
          results={results}
          openIds={openIds}
          toggleAnswers={toggleAnswers}
        />
      )}
    </div>
  );
}
