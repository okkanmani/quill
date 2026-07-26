import { Link } from "react-router-dom";
import {
  ROW_ACTION_BUTTON_CLASS,
  ROW_ACTION_ICON_CLASS,
  ICON_ACTION_ACTIVE_CLASS,
} from "./rowActionButtonStyles";

/** Compact edit control — icon only, sized to match RecycleBinButton. */
export default function EditActionButton({
  onClick,
  label = "Edit",
  disabled = false,
  active = false,
  to,
}) {
  const className = `${ROW_ACTION_BUTTON_CLASS} ${
    active
      ? ICON_ACTION_ACTIVE_CLASS
      : "hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700"
  }`;

  const icon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={ROW_ACTION_ICON_CLASS}
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
