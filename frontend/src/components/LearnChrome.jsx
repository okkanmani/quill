import { useNavigate } from "react-router-dom";
import { logout } from "../api";
import { formatAdminHeaderTrail } from "../adminSession";
import { ADMIN_MAIN_NAV } from "../adminNav";
import { useStudentNavLinks } from "../useStudentNavLinks";
import AppHeader from "./AppHeader";

/**
 * Shared shell for /student/learn/* — header differs for student vs admin.
 */
export default function LearnChrome({ onBack, children }) {
  const navigate = useNavigate();
  const isAdmin = localStorage.getItem("role") === "admin";
  const name = localStorage.getItem("name");
  const { navLinks: studentNavLinks } = useStudentNavLinks();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-40 border-b border-slate-200/90 bg-slate-50/95 backdrop-blur-sm shadow-sm supports-[backdrop-filter]:bg-slate-50/85">
        <div className="px-6 pt-6 pb-4">
          <AppHeader
            navLinks={isAdmin ? ADMIN_MAIN_NAV : studentNavLinks}
            onBack={onBack}
            className="!mb-0"
            trailing={
              <span className="text-slate-800 text-sm font-medium">
                {isAdmin ? `Admin · ${formatAdminHeaderTrail()}` : `Hi, ${name}!`}
              </span>
            }
            onLogout={handleLogout}
          />
        </div>
      </div>
      <div className="px-6 pb-6 pt-4">{children}</div>
    </div>
  );
}
