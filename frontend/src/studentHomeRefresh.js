import { useEffect } from "react";

export const STUDENT_HOME_REFRESH_EVENT = "quill:student-home-refresh";
const STUDENT_HOME_REFRESH_KEY = "quill:student-home-refresh";

/** Call after worksheet/test submission so Home can refresh if it is open. */
export function notifyStudentHomeRefresh() {
  window.dispatchEvent(new CustomEvent(STUDENT_HOME_REFRESH_EVENT));
  try {
    localStorage.setItem(STUDENT_HOME_REFRESH_KEY, String(Date.now()));
  } catch {
    // ignore private mode / quota errors
  }
}

/**
 * Refetch student home when activity changes (submit) or the tab becomes active again.
 * Pass a silent reload for background updates (no loading spinner).
 */
export function useStudentHomeRefresh(reload) {
  useEffect(() => {
    const onRefresh = () => reload();
    const onVisibility = () => {
      if (document.visibilityState === "visible") reload();
    };
    const onPageShow = (event) => {
      if (event.persisted) reload();
    };
    const onFocus = () => reload();
    const onStorage = (event) => {
      if (event.key === STUDENT_HOME_REFRESH_KEY) reload();
    };

    window.addEventListener(STUDENT_HOME_REFRESH_EVENT, onRefresh);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(STUDENT_HOME_REFRESH_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [reload]);
}
