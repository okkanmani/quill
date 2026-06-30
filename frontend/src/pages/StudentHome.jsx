import { useNavigate } from "react-router-dom";
import { logout } from "../api";
import AppHeader from "../components/AppHeader";
import WorksheetsByMode from "../components/WorksheetsByMode";
import { useStudentNavLinks } from "../useStudentNavLinks";

export default function StudentHome() {
  const navigate = useNavigate();
  const name = localStorage.getItem("name");
  const { worksheets, navLinks, loading, error } = useStudentNavLinks();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <AppHeader
        navLinks={navLinks}
        trailing={
          <span className="text-slate-800 text-sm font-medium">
            Hi, {name}!
          </span>
        }
        onLogout={handleLogout}
      />

      <div className="max-w-3xl">
        {loading && <p className="text-slate-600">Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && worksheets.length === 0 && (
          <p className="text-slate-600">No worksheets yet. Check back soon!</p>
        )}

        {!loading && !error && worksheets.length > 0 && (
          <WorksheetsByMode
            worksheets={worksheets}
            onOpenWorksheet={(id) => navigate(`/student/worksheet/${id}`)}
          />
        )}
      </div>
    </div>
  );
}
