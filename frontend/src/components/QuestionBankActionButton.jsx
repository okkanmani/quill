import {
  ROW_ACTION_BUTTON_CLASS,
  ROW_ACTION_ICON_CLASS,
} from "./rowActionButtonStyles";

/** Compact save-to-bank control — icon only, sized to match other row actions. */
export default function QuestionBankActionButton({
  onClick,
  label = "Add to question bank",
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`${ROW_ACTION_BUTTON_CLASS} hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700`}
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
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="M12 7v6" />
        <path d="M9 10h6" />
      </svg>
    </button>
  );
}
