/** Admin-only resource code (e.g. MATH-WS-0042) — read-only label, not shown until published. */
export default function AdminResourceCodeLabel({ code, className = "" }) {
  if (!code) return null;

  return (
    <p
      className={`text-xs font-medium text-slate-400 tabular-nums tracking-wide select-text ${className}`}
    >
      {code}
    </p>
  );
}
