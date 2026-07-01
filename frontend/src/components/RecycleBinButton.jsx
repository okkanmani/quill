/** Compact delete control — icon only, sized to match worksheet row actions. */
export default function RecycleBinButton({
  onClick,
  label = "Delete worksheet",
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="inline-flex shrink-0 items-center justify-center rounded-xl border w-9 h-9 bg-slate-50 border-slate-200 text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-700 disabled:opacity-40 disabled:pointer-events-none transition"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-[17px] h-[17px]"
        aria-hidden
      >
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    </button>
  );
}
