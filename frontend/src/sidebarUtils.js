export const SIDEBAR_COLLAPSED_STORAGE_KEY = "quillSidebarCollapsed";

export function getStoredSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setStoredSidebarCollapsed(collapsed) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
  return collapsed;
}
