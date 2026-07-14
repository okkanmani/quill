const backPillClass =
  "inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-bold bg-indigo-700 text-white hover:bg-indigo-800 border border-indigo-800 shadow-sm transition";

/**
 * Minimal top bar for focus views (worksheet) — no section navigation.
 * Main app sections use AppShell with a left sidebar instead.
 */
export default function AppHeader({
  onBack,
  trailing,
  onLogout,
  className = "",
}) {
  return (
    <header
      className={`flex justify-between items-start gap-6 mb-8 ${className}`.trim()}
    >
      <div className="min-w-0 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-800">🪶 Quill</h1>
        {onBack ? (
          <button type="button" onClick={onBack} className={backPillClass}>
            ← Back
          </button>
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
