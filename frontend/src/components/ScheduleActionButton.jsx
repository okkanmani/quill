import {
  ROW_ACTION_BUTTON_CLASS,
  ROW_ACTION_ICON_CLASS,
  ICON_ACTION_ACTIVE_CLASS,
} from "./rowActionButtonStyles";

/** Compact schedule/reschedule control — calendar icon. */
export default function ScheduleActionButton({
  onClick,
  label = "Schedule unlock",
  disabled = false,
  active = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`${ROW_ACTION_BUTTON_CLASS} disabled:opacity-50 ${
        active ? ICON_ACTION_ACTIVE_CLASS : "hover:bg-slate-50 hover:text-slate-900"
      }`}
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
        <path d="M16 2v4" />
        <path d="M8 2v4" />
        <path d="M3 10h18" />
        <path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2" />
        <path d="M12 14v3" />
        <path d="M12 11v.01" />
      </svg>
    </button>
  );
}
