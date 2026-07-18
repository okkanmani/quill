import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getResults, getRevisionWorksheets, getWorksheets, getWritingSubmissions, logout } from "../api";
import { buildStudentNavLinks } from "../adminNav";
import AppShell from "../components/AppShell";
import QuillLoading from "../components/QuillLoading";
import ResultsBySubject from "../components/ResultsBySubject";
import WritingResultsSection from "../components/WritingResultsSection";
import { filterLatestUndoneWorksheets } from "../worksheetUtils";

export default function StudentResults() {
  const navigate = useNavigate();
  const name = localStorage.getItem("name");
  const [results, setResults] = useState([]);
  const [writing, setWriting] = useState([]);
  const [navLinks, setNavLinks] = useState(buildStudentNavLinks(false));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openIds, setOpenIds] = useState(() => new Set());
  const [openWritingIds, setOpenWritingIds] = useState(() => new Set());

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getResults(),
      getWorksheets(),
      getWritingSubmissions(),
      getRevisionWorksheets().catch(() => []),
    ])
      .then(([resultData, worksheets, writingData, revisionData]) => {
        setError("");
        setResults(resultData);
        setWriting(writingData);
        const latest = filterLatestUndoneWorksheets(worksheets);
        const revisions = Array.isArray(revisionData) ? revisionData : [];
        setNavLinks(buildStudentNavLinks(latest.length > 0, revisions.length > 0));
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

  function toggleWriting(id) {
    setOpenWritingIds((prev) => {
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

  const hasAny = results.length > 0 || writing.length > 0;

  return (
    <AppShell
      navLinks={navLinks}
      trailing={`Hi, ${name}!`}
      onLogout={handleLogout}
    >
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Your results</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Scores and feedback from completed worksheets and writing assignments.
        </p>

        {loading && <QuillLoading label="Loading results…" />}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && !hasAny && (
          <p className="text-slate-600">No results yet.</p>
        )}

        {!loading && !error && hasAny ? (
          <div className="flex flex-col gap-3">
            {results.length > 0 ? (
              <ResultsBySubject
                variant="student"
                results={results}
                openIds={openIds}
                toggleAnswers={toggleAnswers}
              />
            ) : null}
            {writing.length > 0 ? (
              <WritingResultsSection
                variant="student"
                submissions={writing}
                openIds={openWritingIds}
                toggleOpen={toggleWriting}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
