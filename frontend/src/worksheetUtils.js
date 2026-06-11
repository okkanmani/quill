import { isWorksheetDone } from "./subjectUtils";

/** Keep in sync with backend LATEST_WINDOW_MS (14 days). Used only if API omits is_latest. */
export const LATEST_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export const LATEST_WINDOW_LABEL = "14 days";

export function isLatestWorksheet(ws, now = Date.now()) {
  if (typeof ws?.is_latest === "boolean") {
    return ws.is_latest;
  }
  const ts = ws?.sort_ts;
  if (typeof ts !== "number" || Number.isNaN(ts) || ts <= 0) return false;
  return now - ts <= LATEST_WINDOW_MS;
}

export function filterLatestWorksheets(worksheets, now = Date.now()) {
  return worksheets.filter((ws) => isLatestWorksheet(ws, now));
}

/** Latest worksheets the student has not submitted yet. */
export function filterLatestUndoneWorksheets(worksheets, now = Date.now()) {
  return worksheets.filter(
    (ws) => isLatestWorksheet(ws, now) && !isWorksheetDone(ws),
  );
}
