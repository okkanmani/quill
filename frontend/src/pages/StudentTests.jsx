import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { logout } from "../api";
import AppShell from "../components/AppShell";
import CompositesList from "../components/CompositesList";
import QuillLoading from "../components/QuillLoading";
import TestsBySubject from "../components/TestsBySubject";
import {
  RESULTS_VIEW_TAB,
  RESULTS_VIEW_TAB_ACTIVE,
  RESULTS_VIEW_TAB_IDLE,
} from "../resultsTypography";
import { useStudentNavLinks } from "../useStudentNavLinks";

function TestsViewTabs({ activeTab }) {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      <Link
        to="/student/tests"
        className={`${RESULTS_VIEW_TAB} ${
          activeTab === "subject" ? RESULTS_VIEW_TAB_ACTIVE : RESULTS_VIEW_TAB_IDLE
        }`}
      >
        Subject tests
      </Link>
      <Link
        to="/student/tests?tab=composite"
        className={`${RESULTS_VIEW_TAB} ${
          activeTab === "composite" ? RESULTS_VIEW_TAB_ACTIVE : RESULTS_VIEW_TAB_IDLE
        }`}
      >
        Composite tests
      </Link>
    </div>
  );
}

export default function StudentTests() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "composite" ? "composite" : "subject";
  const { tests, composites, navLinks, loading, error, testsError, compositesError } =
    useStudentNavLinks();

  const hasContent = tests.length > 0 || composites.length > 0;

  useEffect(() => {
    if (!loading && !error && !hasContent) {
      navigate("/student", { replace: true });
    }
  }, [loading, error, hasContent, navigate]);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  if (!loading && !error && !hasContent) {
    return null;
  }

  return (
    <AppShell navLinks={navLinks} onLogout={handleLogout}>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Tests</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          {activeTab === "composite"
            ? "Multi-subject assessments — complete each timed section, then submit the full assessment from the hub."
            : "Timed, adaptive assessments — one sitting each. Difficulty adjusts as you answer. After submitting, review any questions you missed with notes for follow-up discussion."}
        </p>

        <TestsViewTabs activeTab={activeTab} />

        {loading && <QuillLoading label="Loading tests…" />}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && activeTab === "subject" && testsError ? (
          <p className="text-red-500">{testsError}</p>
        ) : null}

        {!loading && activeTab === "composite" && compositesError ? (
          <p className="text-red-500">{compositesError}</p>
        ) : null}

        {!loading && activeTab === "subject" && tests.length > 0 ? (
          <TestsBySubject
            tests={tests}
            onOpenTest={(id) => navigate(`/student/tests/${id}`)}
            onOpenReview={(reviewId) => navigate(`/student/tests/review/${reviewId}`)}
          />
        ) : null}

        {!loading && activeTab === "composite" ? (
          <CompositesList
            composites={composites}
            onOpenComposite={(id) => navigate(`/student/composites/${id}`)}
          />
        ) : null}

        {!loading && activeTab === "subject" && !testsError && tests.length === 0 ? (
          <p className="text-sm text-slate-600">No subject tests are available yet.</p>
        ) : null}
      </div>
    </AppShell>
  );
}
