/** Worksheets with sort_ts within this window show under Latest. */
export const LATEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function isLatestWorksheet(ws, now = Date.now()) {
  const ts = ws?.sort_ts;
  if (typeof ts !== "number" || Number.isNaN(ts) || ts <= 0) return false;
  return now - ts <= LATEST_WINDOW_MS;
}

export function filterLatestWorksheets(worksheets, now = Date.now()) {
  return worksheets.filter((ws) => isLatestWorksheet(ws, now));
}
