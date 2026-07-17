import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getMe } from "../api";
import { clearSession } from "../sessionAuth";
import QuillLoading from "./QuillLoading";

export default function ProtectedRoute({ role, children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setStatus("denied");
      return;
    }

    getMe()
      .then((session) => {
        const allowed = Array.isArray(role)
          ? role.includes(session.role)
          : session.role === role;
        setStatus(allowed ? "allowed" : "denied");
      })
      .catch(() => {
        clearSession();
        setStatus("denied");
      });
  }, [role]);

  if (status === "checking") {
    return <QuillLoading fullscreen label="Loading…" />;
  }
  if (status === "denied") return <Navigate to="/" />;
  return children;
}
