import { NavLink, matchPath, useLocation } from "react-router-dom";

const backPillClass =
  "inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-bold bg-amber-900 text-amber-50 hover:bg-amber-950 border border-amber-950 shadow-sm transition";

const adminNavShellClass =
  "inline-flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-amber-300/90 bg-amber-100 px-4 py-2.5 shadow-sm";
const adminNavTitleClass = "text-base font-bold text-amber-950";
const adminNavLinkClass =
  "text-base font-medium text-amber-800 underline underline-offset-2 decoration-amber-500/70 hover:text-amber-950 hover:decoration-amber-700";

function AdminSectionNav({ navLinks }) {
  const { pathname } = useLocation();

  return (
    <nav
      className={adminNavShellClass}
      aria-label="Admin sections"
    >
      {navLinks.map(({ to, label, end }) => {
        const isActive = matchPath({ path: to, end: end ?? false }, pathname);
        if (isActive) {
          return (
            <span key={to} className={adminNavTitleClass} aria-current="page">
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
        <h1 className="text-2xl font-bold text-amber-800">🪶 Quill</h1>
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
            className="text-sm font-semibold text-amber-800 hover:underline px-1 py-1"
          >
            Log out
          </button>
        ) : null}
      </div>
    </header>
  );
}
