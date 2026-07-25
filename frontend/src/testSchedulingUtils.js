/** Local datetime-local value (YYYY-MM-DDTHH:mm) → ISO UTC string for API. */
export function localDatetimeInputToIso(value) {
  if (!value || !String(value).trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** ISO UTC → value for datetime-local in the user's timezone. */
export function isoToLocalDatetimeInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isoToLocalDateInput(iso) {
  const combined = isoToLocalDatetimeInput(iso);
  return combined ? combined.slice(0, 10) : "";
}

export function isoToLocalTimeInput(iso) {
  const combined = isoToLocalDatetimeInput(iso);
  return combined ? combined.slice(11, 16) : "";
}

export function localDateAndTimeToIso(dateStr, timeStr) {
  if (!dateStr?.trim() || !timeStr?.trim()) return null;
  return localDatetimeInputToIso(`${dateStr.trim()}T${timeStr.trim()}`);
}

export function formatScheduledUnlockLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Default: next calendar day at 9:00 local. */
export function defaultScheduledUnlockLocalInput() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return isoToLocalDatetimeInput(d.toISOString());
}
