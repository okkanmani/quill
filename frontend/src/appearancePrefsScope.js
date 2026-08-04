/** Scope theme/font prefs per signed-in user (admin vs each student). */

function sanitizeKeyPart(value) {
  return String(value || "default").replace(/:/g, "_");
}

/**
 * Stable localStorage scope for appearance prefs.
 * - Admin alone: admin:{adminName}
 * - Admin viewing a student: student:{studentName}
 * - Student login: student:{name}
 * - Signed out: guest
 */
export function getAppearancePrefsUserKey() {
  try {
    if (!localStorage.getItem("token")) return "guest";

    const role = localStorage.getItem("role");
    const studentName = localStorage.getItem("studentName");

    if (role === "admin") {
      if (studentName) {
        return `student:${sanitizeKeyPart(studentName)}`;
      }
      return `admin:${sanitizeKeyPart(localStorage.getItem("adminName"))}`;
    }

    return `student:${sanitizeKeyPart(localStorage.getItem("name"))}`;
  } catch {
    return "guest";
  }
}

export function scopedAppearanceStorageKey(baseKey) {
  return `${baseKey}:${getAppearancePrefsUserKey()}`;
}

export function readScopedAppearanceValue(baseKey) {
  try {
    const scopedKey = scopedAppearanceStorageKey(baseKey);
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

export function writeScopedAppearanceValue(baseKey, value) {
  try {
    localStorage.setItem(scopedAppearanceStorageKey(baseKey), value);
  } catch {
    /* ignore quota / private mode */
  }
}
