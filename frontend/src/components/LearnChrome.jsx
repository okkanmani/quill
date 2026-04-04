import { useNavigate } from "react-router-dom";
import { logout } from "../api";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppHeader from "./AppHeader";

/**
 * Shared shell for /student/learn/* — header differs for student vs admin.
 */
export default function LearnChrome({ onBack, children }) {
  const navigate = useNavigate();
  const isAdmin = localStorage.getItem("role") === "admin";
  const name = localStorage.getItem("name");
  const studentName = localStorage.getItem("studentName");

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <div className="sticky top-0 z-40 border-b border-amber-200/90 bg-amber-50/95 backdrop-blur-sm shadow-sm supports-[backdrop-filter]:bg-amber-50/85">
        <div className="px-6 pt-6 pb-4">
          <AppHeader
            navLinks={isAdmin ? ADMIN_MAIN_NAV : []}
            onBack={onBack}
            className="!mb-0"
            trailing={
              <span className="text-amber-800 text-sm font-medium">
                {isAdmin ? `Admin · ${studentName || "—"}` : `Hi, ${name}!`}
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
