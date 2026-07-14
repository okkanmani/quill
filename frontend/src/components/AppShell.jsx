import { NavLink, matchPath, useLocation } from "react-router-dom";

const backPillClass =
  "inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-bold bg-indigo-700 text-white hover:bg-indigo-800 border border-indigo-800 shadow-sm transition";

function SidebarNav({ navLinks }) {
  const { pathname } = useLocation();

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main sections">
      {navLinks.map(({ to, label, end, disabled }) => {
        const isActive = matchPath({ path: to, end: end ?? false }, pathname);
        if (disabled) {
          return (
            <span
              key={to}
              aria-disabled="true"
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed select-none"
              title="No new worksheets in the last 14 days (or all are done)"
            >
              {label}
            </span>
          );
        }
        if (isActive) {
          return (
            <span
              key={to}
              className="block rounded-lg px-3 py-2.5 text-sm font-semibold bg-indigo-50 text-indigo-900 border border-indigo-100"
              aria-current="page"
            >
              {label}
            </span>
          );
        }
        return (
          <NavLink
            key={to}
            to={to}
            end={end ?? false}
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition"
          >
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}

/**
 * App chrome with a fixed left sidebar for main navigation.
 * Use AppHeader instead for focus views (e.g. active worksheet) with no section nav.
 */
export default function AppShell({
  navLinks = [],
  onBack,
  trailing,
  onLogout,
  mainClassName = "",
  children,
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-52 shrink-0 border-r border-slate-200 bg-white flex flex-col sticky top-0 h-screen">
        <div className="px-4 pt-5 pb-4 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">🪶 Quill</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {navLinks.length > 0 ? <SidebarNav navLinks={navLinks} /> : null}
        </div>

        <div className="shrink-0 px-4 py-4 border-t border-slate-100 space-y-2">
          {trailing ? (
            <div className="text-xs font-medium text-slate-600 leading-snug">{trailing}</div>
          ) : null}
          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="text-sm font-semibold text-slate-800 hover:text-indigo-700 transition"
            >
              Log out
            </button>
          ) : null}
        </div>
      </aside>

      <main className={`flex-1 min-w-0 p-6 ${mainClassName}`.trim()}>
        {onBack ? (
          <div className="mb-4">
            <button type="button" onClick={onBack} className={backPillClass}>
              ← Back
            </button>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
