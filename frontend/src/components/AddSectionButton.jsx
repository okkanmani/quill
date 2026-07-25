import {
  ROW_ACTION_BUTTON_CLASS,
  ROW_ACTION_ICON_CLASS,
} from "./rowActionButtonStyles";

/** Compact add-section control — icon only, sized to match EditActionButton. */
export default function AddSectionButton({
  onClick,
  label = "Add section",
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
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </button>
  );
}
