import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api";
import AppShell from "../components/AppShell";
import QuillLoading from "../components/QuillLoading";
import WorksheetsBySubject from "../components/WorksheetsBySubject";
import { useStudentNavLinks } from "../useStudentNavLinks";
import { LATEST_WINDOW_LABEL } from "../worksheetUtils";

export default function StudentLatest() {
  const navigate = useNavigate();
  const name = localStorage.getItem("name");
  const { latest, navLinks, loading, error } = useStudentNavLinks();

  useEffect(() => {
    if (!loading && latest.length === 0) {
      navigate("/student", { replace: true });
    }
  }, [loading, latest.length, navigate]);

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
        <h2 className="text-xl font-semibold text-slate-900 mb-1">Latest</h2>
        <p className="text-slate-600 text-sm mb-6">
          {`New worksheets from the last ${LATEST_WINDOW_LABEL} that you have not finished yet.`}
        </p>

        {loading && <QuillLoading label="Loading latest worksheets…" />}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && latest.length > 0 && (
          <WorksheetsBySubject
            worksheets={latest}
            onOpenWorksheet={(id) => navigate(`/student/worksheet/${id}`)}
          />
        )}
      </div>
    </AppShell>
  );
}
