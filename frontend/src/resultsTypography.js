/** Admin + student Results pages (aligned with Worksheets admin scale). */

export {
  WS_PAGE_HEADING as RESULTS_PAGE_HEADING,
  WS_BODY as RESULTS_BODY,
  WS_BODY_MUTED as RESULTS_BODY_MUTED,
  WS_CARD_TITLE as RESULTS_ROW_TITLE,
  WS_CARD_DETAIL as RESULTS_ROW_DETAIL,
  WS_SECTION_TITLE as RESULTS_GROUP_TITLE,
  WS_EYEBROW as RESULTS_SORT_LABEL,
} from "./worksheetAdminTypography";

export const RESULTS_PAGE_INTRO = "text-sm text-slate-600 leading-relaxed";

export const RESULTS_CATEGORY_TITLE = "text-sm font-bold text-slate-900";

/** Worksheet vs test view (matches Create hub tabs) */
export const RESULTS_VIEW_TAB =
  "rounded-xl px-4 py-2 text-sm font-semibold transition";

export const RESULTS_VIEW_TAB_ACTIVE = "bg-indigo-600 text-white";

export const RESULTS_VIEW_TAB_IDLE =
  "bg-slate-100 text-slate-700 hover:bg-slate-200";

export const RESULTS_PENDING_BANNER =
  "text-sm font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2";

export const RESULTS_ITEM_SHELL =
  "flex-1 min-w-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden";

export const RESULTS_ITEM_SHELL_PENDING =
  "flex-1 min-w-0 bg-white border border-amber-300 rounded-xl shadow-sm overflow-hidden";

export const RESULTS_ITEM_HEADER =
  "w-full text-left px-4 py-3 hover:bg-slate-50/60 transition flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start sm:gap-4";

export const RESULTS_ITEM_TOGGLE =
  "text-xs font-semibold text-slate-600 underline underline-offset-2";

export const RESULTS_ANSWER_PROMPT =
  "text-sm font-medium text-slate-800 leading-snug";

export const RESULTS_ANSWER_BODY = "text-sm text-slate-600";

export const RESULTS_ERROR = "text-sm text-red-600";

export const RESULTS_EMPTY = "text-sm text-slate-600";

export const RESULTS_SUBTITLE = "text-sm text-indigo-600 capitalize mt-0.5";

export const RESULTS_SUBTITLE_TEAL = "text-sm text-teal-700 capitalize mt-0.5";

export const RESULTS_STATUS_OK = "text-xs font-medium text-emerald-700 mt-1";

export const RESULTS_SCORE_BADGE =
  "inline-flex text-xs font-semibold px-2.5 py-1 rounded-full tabular-nums";
