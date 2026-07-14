import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getResults, deleteResult, logout } from "../api";
import { formatAdminHeaderTrail } from "../adminSession";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppHeader from "../components/AppHeader";
import AdminStudentSwitcher from "../components/AdminStudentSwitcher";
import AdminStudentBanner from "../components/AdminStudentBanner";
import QuillLoading from "../components/QuillLoading";
import ResultsBySubject from "../components/ResultsBySubject";

export default function AdminHome() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** Which result cards have answers expanded (default: none). */
  const [openIds, setOpenIds] = useState(() => new Set());
  const [deletingResultId, setDeletingResultId] = useState(null);
  const [message, setMessage] = useState("");

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

  async function handleDeleteResult(result) {
    const label = result.title || result.worksheet_id;
    const ok = window.confirm(
      `Delete this submission for “${label}”? This cannot be undone.`,
    );
    if (!ok) return;
    setDeletingResultId(result.id);
    setError("");
    try {
      await deleteResult(result.id);
      setResults((prev) => prev.filter((r) => r.id !== result.id));
      setOpenIds((prev) => {
        const next = new Set(prev);
        next.delete(result.id);
        return next;
      });
      setMessage(`Deleted submission for “${label}”.`);
    } catch (err) {
      setError(err.message || "Could not delete result.");
    } finally {
      setDeletingResultId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <AppHeader
        navLinks={ADMIN_MAIN_NAV}
        trailing={
          <span className="text-slate-800 text-sm font-medium">
            Admin · {formatAdminHeaderTrail()}
          </span>
        }
        onLogout={handleLogout}
      />

      <div className="max-w-3xl">
        <AdminStudentBanner />
        <AdminStudentSwitcher />

        {message && (
          <p className="text-green-700 text-sm mb-4">{message}</p>
        )}

        {loading && <QuillLoading label="Loading results…" />}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && results.length === 0 && (
          <p className="text-slate-600">No results yet.</p>
        )}

        {!loading && !error && results.length > 0 && (
          <ResultsBySubject
            results={results}
            openIds={openIds}
            toggleAnswers={toggleAnswers}
            onDeleteResult={handleDeleteResult}
            deletingResultId={deletingResultId}
            onResultEvaluated={(updated) =>
              setResults((prev) =>
                prev.map((r) => (r.id === updated.id ? updated : r)),
              )
            }
            onAnalysisError={setError}
          />
        )}
      </div>
    </div>
  );
}
