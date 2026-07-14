import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getResults, getWorksheets, logout } from "../api";
import { buildStudentNavLinks } from "../adminNav";
import AppShell from "../components/AppShell";
import QuillLoading from "../components/QuillLoading";
import ResultsBySubject from "../components/ResultsBySubject";
import { filterLatestUndoneWorksheets } from "../worksheetUtils";

export default function StudentResults() {
  const navigate = useNavigate();
  const name = localStorage.getItem("name");
  const [results, setResults] = useState([]);
  const [navLinks, setNavLinks] = useState(buildStudentNavLinks(false));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openIds, setOpenIds] = useState(() => new Set());

  useEffect(() => {
    setLoading(true);
    Promise.all([getResults(), getWorksheets()])
      .then(([resultData, worksheets]) => {
        setError("");
        setResults(resultData);
        const latest = filterLatestUndoneWorksheets(worksheets);
        setNavLinks(buildStudentNavLinks(latest.length > 0));
      })
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
    <AppShell
      navLinks={navLinks}
      trailing={`Hi, ${name}!`}
      onLogout={handleLogout}
    >
      <div className="max-w-3xl">
        {loading && <QuillLoading label="Loading results…" />}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && results.length === 0 && (
          <p className="text-slate-600">No results yet.</p>
        )}

        {!loading && !error && results.length > 0 && (
          <ResultsBySubject
            variant="student"
            results={results}
            openIds={openIds}
            toggleAnswers={toggleAnswers}
          />
        )}
      </div>
    </AppShell>
  );
}
