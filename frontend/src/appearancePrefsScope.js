/** Scope theme/font prefs per signed-in user (admin vs each student). */

export const AppearanceScope = {
  ACTIVE: "active",
  ADMIN: "admin",
  STUDENT: "student",
};

function sanitizeKeyPart(value) {
  return String(value || "default").replace(/:/g, "_");
}

function isSignedIn() {
  try {
    return Boolean(localStorage.getItem("token"));
  } catch {
    return false;
  }
}

/**
 * Resolve the localStorage user segment for appearance prefs.
 * - ADMIN: always the family admin account (settings page)
 * - STUDENT: the student account (student settings)
 * - ACTIVE: follows who signed in — admin session uses admin prefs even while
 *   a student is selected for worksheet/data context
 */
export function resolveAppearanceUserKey(scope = AppearanceScope.ACTIVE) {
  if (!isSignedIn()) return null;

  const role = localStorage.getItem("role");
  const adminName = sanitizeKeyPart(localStorage.getItem("adminName"));
  const studentName = sanitizeKeyPart(localStorage.getItem("studentName"));
  const name = sanitizeKeyPart(localStorage.getItem("name"));

  if (scope === AppearanceScope.ADMIN) {
    return `admin:${adminName}`;
  }

  if (scope === AppearanceScope.STUDENT) {
    if (role === "admin" && studentName) {
      return `student:${studentName}`;
    }
    return `student:${name}`;
  }

  if (role === "admin") {
    return `admin:${adminName}`;
  }

  return `student:${name}`;
}

export function scopedAppearanceStorageKey(baseKey, scope = AppearanceScope.ACTIVE) {
  const userKey = resolveAppearanceUserKey(scope);
  if (!userKey) return null;
  return `${baseKey}:${userKey}`;
}

export function readScopedAppearanceValue(
  baseKey,
  scope = AppearanceScope.ACTIVE,
) {
  try {
    const scopedKey = scopedAppearanceStorageKey(baseKey, scope);
    if (!scopedKey) return null;

    const scoped = localStorage.getItem(scopedKey);
    if (scoped != null) return scoped;

    const legacy = localStorage.getItem(baseKey);
    if (legacy != null) {
      localStorage.setItem(scopedKey, legacy);
      return legacy;
    }
  } catch {
    /* ignore quota / private mode */
  }
  return null;
}

export function writeScopedAppearanceValue(
  baseKey,
  value,
  scope = AppearanceScope.ACTIVE,
) {
  try {
    const scopedKey = scopedAppearanceStorageKey(baseKey, scope);
    if (!scopedKey) return;
    localStorage.setItem(scopedKey, value);
  } catch {
    /* ignore quota / private mode */
  }
}
