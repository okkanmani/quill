import {
  ROW_ACTION_BUTTON_CLASS,
  ROW_ACTION_ICON_CLASS,
} from "./rowActionButtonStyles";

/** Compact move control — icon only, sized to match EditActionButton. */
export default function MoveActionButton({
  onClick,
  label = "Move to section",
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`${ROW_ACTION_BUTTON_CLASS} hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700`}
    >
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
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <path d="M2 12h7" />
        <path d="M5 9l3 3-3 3" />
      </svg>
    </button>
  );
}
