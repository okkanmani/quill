import { useEffect } from "react";

/** Default toast lifetime (within 3–5s). */
export const TOAST_AUTO_DISMISS_MS = 4000;

export function useAutoDismissToast(message, setMessage, ms = TOAST_AUTO_DISMISS_MS) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(""), ms);
    return () => window.clearTimeout(id);
  }, [message, setMessage, ms]);
}
