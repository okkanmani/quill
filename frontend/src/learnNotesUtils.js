export const LEARN_NOTES_COLLAPSED_STORAGE_KEY = "quillLearnNotesCollapsed";

export function getStoredLearnNotesCollapsed() {
  try {
    return localStorage.getItem(LEARN_NOTES_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setStoredLearnNotesCollapsed(collapsed) {
  try {
    localStorage.setItem(LEARN_NOTES_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
  return collapsed;
}
