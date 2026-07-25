/** Shared sizing for compact icon-only row actions (worksheets admin, collection toolbar). */
export const ROW_ACTION_BUTTON_CLASS =
  "inline-flex shrink-0 items-center justify-center rounded-lg border w-7 h-7 bg-slate-50 border-slate-200 text-slate-500 disabled:opacity-40 disabled:pointer-events-none transition";

export const ROW_ACTION_ICON_CLASS = "w-[14px] h-[14px]";

/** Icon-only control base (compose with idle/active/hover utility classes). */
export const ICON_ACTION_BUTTON_CLASS = `${ROW_ACTION_BUTTON_CLASS} bg-white text-slate-600 border-slate-200`;

export const ICON_ACTION_IDLE_CLASS =
  "hover:border-indigo-200 hover:text-indigo-800 hover:bg-white";

export const ICON_ACTION_ACTIVE_CLASS =
  "bg-indigo-100 text-indigo-900 border-indigo-300";

/** Numbered question picker (worksheet, test, builders). */
export const QUESTION_INDEX_BUTTON_CLASS =
  "shrink-0 w-7 h-7 rounded-full border text-xs font-bold transition";

/** Locked worksheet/test padlock badge (non-button). */
export const LOCK_STATUS_BADGE_CLASS =
  "shrink-0 inline-flex items-center justify-center rounded-full border w-7 h-7";
