import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getResults, getRevisionWorksheets, getWorksheets, getWritingSubmissions, logout } from "../api";
import { buildStudentNavLinks } from "../adminNav";
import AppShell from "../components/AppShell";
import QuillLoading from "../components/QuillLoading";
import ResultsBySubject from "../components/ResultsBySubject";
import ResultsAnswerAside from "../components/ResultsAnswerAside";
import WritingResultsSection from "../components/WritingResultsSection";
import { filterLatestUndoneWorksheets } from "../worksheetUtils";
import { normalizeSubjectKey } from "../subjectUtils";
import {
  RESULTS_EMPTY,
  RESULTS_ERROR,
  RESULTS_PAGE_HEADING,
  RESULTS_PAGE_INTRO,
} from "../resultsTypography";
import {
  RESULTS_LIST_WIDTH_CLASS,
  RESULTS_SPLIT_GRID_CLASS,
  RESULTS_SPLIT_WIDTH_CLASS,
} from "../resultsLayout";

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
    setOpenIds((prev) => (prev.has(id) ? new Set() : new Set([id])));
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
  const openResultId = openIds.size > 0 ? [...openIds][0] : null;
  const selectedResult = openResultId
    ? results.find((result) => result.id === openResultId) ?? null
    : null;
  const hasAnswerSelection = Boolean(selectedResult);

  function closeAnswerPanel() {
    setOpenIds(new Set());
  }

  function handleWorksheetSubjectCollapse(subjectKey) {
    const openId = openIds.size > 0 ? [...openIds][0] : null;
    if (!openId) return;
    const match = results.find((result) => result.id === openId);
    if (
      match &&
      normalizeSubjectKey(match.subject) === subjectKey
    ) {
      setOpenIds(new Set());
    }
  }

  return (
    <AppShell
      navLinks={navLinks}
      onLogout={handleLogout}
    >
      <div
        className={
          hasAnswerSelection ? RESULTS_SPLIT_WIDTH_CLASS : RESULTS_LIST_WIDTH_CLASS
        }
      >
        <h1 className={`${RESULTS_PAGE_HEADING} mb-1`}>Your results</h1>
        <p className={`${RESULTS_PAGE_INTRO} mb-6`}>
          Scores and feedback from completed worksheets and writing assignments.
        </p>

        {loading && <QuillLoading label="Loading results…" />}
        {error && <p className={RESULTS_ERROR}>{error}</p>}

        {!loading && !error && !hasAny && (
          <p className={RESULTS_EMPTY}>No results yet.</p>
        )}

        {!loading && !error && hasAny ? (
          <div
            className={
              hasAnswerSelection && results.length > 0
                ? RESULTS_SPLIT_GRID_CLASS
                : "lg:grid lg:grid-cols-1 lg:gap-6 lg:items-start"
            }
          >
            <div className="min-w-0 flex flex-col gap-3">
              {results.length > 0 ? (
                <ResultsBySubject
                  variant="student"
                  results={results}
                  openIds={openIds}
                  toggleAnswers={toggleAnswers}
                  onSubjectCollapse={handleWorksheetSubjectCollapse}
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
              {results.length > 0 ? (
                <ResultsAnswerAside
                  className="lg:hidden"
                  worksheetResult={selectedResult}
                  isAdmin={false}
                  onClose={closeAnswerPanel}
                />
              ) : null}
            </div>
            {results.length > 0 ? (
              <ResultsAnswerAside
                className="hidden lg:block"
                worksheetResult={selectedResult}
                isAdmin={false}
                onClose={closeAnswerPanel}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
