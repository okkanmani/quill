import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api";
import {
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
  LAST_ACTIVITY_KEY,
  handleSessionExpired,
  isAuthenticated,
  msUntilIdleSignOut,
  setSessionExpiredHandler,
  touchActivity,
} from "../sessionAuth";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"];

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function AutoSignOut({ children }) {
  const navigate = useNavigate();
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const signOut = useCallback(
    async (reason) => {
      setWarningOpen(false);
      await logout();
      navigate(`/?signedOut=${reason}`, { replace: true });
    },
    [navigate],
  );

  useEffect(() => {
    setSessionExpiredHandler(({ reason }) => signOut(reason));
    return () => setSessionExpiredHandler(null);
  }, [signOut]);

  useEffect(() => {
    if (!isAuthenticated()) {
      setWarningOpen(false);
      return undefined;
    }

    touchActivity();

    const onActivity = () => {
      touchActivity();
      setWarningOpen(false);
    };

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });

    const onStorage = (event) => {
      if (event.key !== LAST_ACTIVITY_KEY) return;
      if (!isAuthenticated()) {
        setWarningOpen(false);
        return;
      }
      const remaining = msUntilIdleSignOut();
      if (remaining > IDLE_WARNING_MS) {
        setWarningOpen(false);
      }
    };
    window.addEventListener("storage", onStorage);

    const intervalId = window.setInterval(() => {
      if (!isAuthenticated()) {
        setWarningOpen(false);
        return;
      }

      const remaining = msUntilIdleSignOut();
      if (remaining <= 0) {
        handleSessionExpired("idle");
        return;
      }

      if (remaining <= IDLE_WARNING_MS) {
        setWarningOpen(true);
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else {
        setWarningOpen(false);
      }
    }, 1000);

    const onVisibility = () => {
      if (document.visibilityState !== "visible" || !isAuthenticated()) return;
      if (msUntilIdleSignOut() <= 0) {
        handleSessionExpired("idle");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity);
      });
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      {children}
      {warningOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auto-signout-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 id="auto-signout-title" className="text-lg font-bold text-slate-900">
              Still there?
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              You will be signed out in{" "}
              <span className="font-semibold text-slate-900">
                {formatCountdown(secondsLeft)}
              </span>{" "}
              due to inactivity.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => signOut("idle")}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Sign out now
              </button>
              <button
                type="button"
                onClick={() => {
                  touchActivity();
                  setWarningOpen(false);
                }}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition"
              >
                Stay signed in
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
