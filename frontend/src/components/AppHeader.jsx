import { NavLink, matchPath, useLocation } from "react-router-dom";

const backPillClass =
  "inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-bold bg-indigo-700 text-white hover:bg-indigo-800 border border-indigo-800 shadow-sm transition";

const adminNavShellClass =
  "inline-flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-slate-300/90 bg-slate-100 px-4 py-2.5 shadow-sm";
const adminNavTitleClass = "text-base font-bold text-slate-950";
const adminNavLinkClass =
  "text-base font-medium text-slate-800 underline underline-offset-2 decoration-indigo-500/70 hover:text-slate-950 hover:decoration-slate-700";

function AdminSectionNav({ navLinks }) {
  const { pathname } = useLocation();

  return (
    <nav
      className={adminNavShellClass}
      aria-label="Admin sections"
    >
      {navLinks.map(({ to, label, end, disabled }) => {
        const isActive = matchPath({ path: to, end: end ?? false }, pathname);
        if (isActive) {
          return (
            <span key={to} className={adminNavTitleClass} aria-current="page">
              {label}
            </span>
          );
        }
        if (disabled) {
          return (
            <span
              key={to}
              aria-disabled="true"
              className="text-base font-medium text-slate-400 cursor-not-allowed select-none"
              title="No new worksheets in the last week"
            >
              {label}
            </span>
          );
        }
        return (
          <NavLink key={to} to={to} end={end ?? false} className={adminNavLinkClass}>
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}

/**
 * Left: Quill logo; row below: optional Back; optional admin section nav (active = title text).
 * Right: trailing + Log out (top-aligned with the logo row).
 */
export default function AppHeader({
  navLinks = [],
  onBack,
  trailing,
  onLogout,
  className = "",
}) {
  const subRow = onBack || navLinks.length > 0;

  return (
    <header
      className={`flex justify-between items-start gap-6 mb-8 ${className}`.trim()}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-800">🪶 Quill</h1>
        {subRow ? (
          <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-2">
            {onBack ? (
              <button type="button" onClick={onBack} className={backPillClass}>
                ← Back
              </button>
            ) : null}
            {navLinks.length > 0 ? <AdminSectionNav navLinks={navLinks} /> : null}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-3 shrink-0 pt-0.5">
        {trailing}
        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className="text-sm font-semibold text-slate-800 hover:underline px-1 py-1"
          >
            Log out
          </button>
        ) : null}
      </div>
    </header>
  );
}
