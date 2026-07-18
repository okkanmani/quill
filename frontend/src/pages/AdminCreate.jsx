import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout } from "../api";
import { formatAdminHeaderTrail } from "../adminSession";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";

const CREATE_TABS = [
  { to: "/admin/create/worksheet", label: "Question builder" },
  { to: "/admin/create/upload", label: "Upload JSON" },
  { to: "/admin/create/learn", label: "Learning resource" },
];

export default function AdminCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const isWorksheetBuilder = /\/admin\/create\/worksheet/.test(location.pathname);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <AppShell
      navLinks={ADMIN_MAIN_NAV}
      trailing={`Admin · ${formatAdminHeaderTrail()}`}
      onLogout={handleLogout}
      mainClassName="pb-28"
    >
      <div className={isWorksheetBuilder ? "max-w-none" : "max-w-3xl mx-auto"}>
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Create</h1>
        <p className="text-slate-600 text-sm mb-5 leading-relaxed">
          Build worksheets, upload JSON, or generate learning resources for students.
        </p>

        <nav
          className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-3"
          aria-label="Create sections"
        >
          {CREATE_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <Outlet />
      </div>
    </AppShell>
  );
}
