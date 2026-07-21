import { useNavigate } from "react-router-dom";
import { logout } from "../api";
import { ADMIN_MAIN_NAV } from "../adminNav";
import { useStudentNavLinks } from "../useStudentNavLinks";
import AppShell from "./AppShell";

/** Shared shell for /student/learn/* — sidebar differs for student vs admin. */
export default function LearnChrome({ onBack, children }) {
  const navigate = useNavigate();
  const isAdmin = localStorage.getItem("role") === "admin";
  const { navLinks: studentNavLinks } = useStudentNavLinks();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <AppShell
      navLinks={isAdmin ? ADMIN_MAIN_NAV : studentNavLinks}
      onBack={onBack}
      onLogout={handleLogout}
    >
      {children}
    </AppShell>
  );
}
