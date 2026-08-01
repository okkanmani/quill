export const LAST_ACTIVITY_KEY = "quillLastActivityAt";

/** Sign out after this much inactivity (ms). */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** Show a warning this long before idle sign-out (ms). */
export const IDLE_WARNING_MS = 2 * 60 * 1000;

const SESSION_KEYS = [
  "token",
  "role",
  "name",
  "studentName",
  "adminName",
  "grade",
  "studentGrade",
  "studentCurriculum",
  "curriculum",
  LAST_ACTIVITY_KEY,
];

let sessionExpiredHandler = null;
let handlingExpired = false;

export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler;
}

export function clearSession() {
  SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem("token"));
}

export function touchActivity() {
  if (!isAuthenticated()) return;
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function getLastActivityAt() {
  return Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
}

export function msUntilIdleSignOut() {
  const last = getLastActivityAt();
  if (!last) return IDLE_TIMEOUT_MS;
  return Math.max(0, IDLE_TIMEOUT_MS - (Date.now() - last));
}

export async function handleSessionExpired(reason) {
  if (handlingExpired || !sessionExpiredHandler) return;
  handlingExpired = true;
  try {
    await sessionExpiredHandler({ reason });
  } finally {
    handlingExpired = false;
  }
}
