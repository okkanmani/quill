import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { logout } from "../api";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";
import AdminTestsCompositePanel from "../components/AdminTestsCompositePanel";
import AdminWorksheetLibraryPage from "./AdminWorksheetLibraryPage";
import { WS_PAGE_HEADING } from "../worksheetAdminTypography";
import {
  RESULTS_VIEW_TAB,
  RESULTS_VIEW_TAB_ACTIVE,
  RESULTS_VIEW_TAB_IDLE,
} from "../resultsTypography";

function TestsViewTabs({ activeTab }) {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      <Link
        to="/admin/tests"
        className={`${RESULTS_VIEW_TAB} ${
          activeTab === "subject" ? RESULTS_VIEW_TAB_ACTIVE : RESULTS_VIEW_TAB_IDLE
        }`}
      >
        Subject tests
      </Link>
      <Link
        to="/admin/tests?tab=composite"
        className={`${RESULTS_VIEW_TAB} ${
          activeTab === "composite" ? RESULTS_VIEW_TAB_ACTIVE : RESULTS_VIEW_TAB_IDLE
        }`}
      >
        Composite tests
      </Link>
    </div>
  );
}

export default function AdminTests() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "composite" ? "composite" : "subject";

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <AppShell navLinks={ADMIN_MAIN_NAV} onLogout={handleLogout} mainClassName="pb-16">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <h1 className={WS_PAGE_HEADING}>Tests</h1>
          {activeTab === "subject" ? (
            <Link
              to="/admin/create/test"
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 transition"
            >
              New subject test
            </Link>
          ) : null}
        </div>

        <TestsViewTabs activeTab={activeTab} />

        {activeTab === "subject" ? (
          <AdminWorksheetLibraryPage variant="tests" embedded />
        ) : (
          <AdminTestsCompositePanel />
        )}
      </div>
    </AppShell>
  );
}
