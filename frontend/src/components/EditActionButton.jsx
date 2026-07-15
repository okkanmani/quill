import { Link } from "react-router-dom";

/** Compact edit control — icon only, sized to match RecycleBinButton. */
export default function EditActionButton({
  onClick,
  label = "Edit",
  disabled = false,
  to,
}) {
  const className =
    "inline-flex shrink-0 items-center justify-center rounded-xl border w-9 h-9 bg-slate-50 border-slate-200 text-slate-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 disabled:opacity-40 disabled:pointer-events-none transition";

  const icon = (
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );

  if (to) {
    return (
      <Link to={to} title={label} aria-label={label} className={className}>
        {icon}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={className}
    >
      {icon}
    </button>
  );
}
