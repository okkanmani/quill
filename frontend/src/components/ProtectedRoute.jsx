import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getMe } from "../api";

export default function ProtectedRoute({ role, children }) {
  const [status, setStatus] = useState(() => {
    // synchronous check first - no token means denied immediately
    const token = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role");
    if (!token || !storedRole) return "denied";
    const allowed = Array.isArray(role)
      ? role.includes(storedRole)
      : storedRole === role;
    return allowed ? "allowed" : "checking";
  });

  useEffect(() => {
    if (status !== "checking") return;
    getMe()
      .then((session) => {
        const allowed = Array.isArray(role)
          ? role.includes(session.role)
          : session.role === role;
        setStatus(allowed ? "allowed" : "denied");
      })
      .catch(() => {
        localStorage.clear();
        setStatus("denied");
      });
  }, [role]);

  if (status === "checking") return null;
  if (status === "denied") return <Navigate to="/" />;
  return children;
}
