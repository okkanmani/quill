import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  listAdminStudents,
  loginAdmin,
  loginStudent,
  signupAdmin,
  switchAdminStudent,
  touchActivity,
} from "../api";
import QuillLoading from "../components/QuillLoading";

const TAB_SIGN_IN = "sign-in";
const TAB_SIGN_UP = "sign-up";

async function persistAdminSession(data) {
  localStorage.setItem("token", data.token);
  localStorage.setItem("role", data.role);
  if (data.admin_name) {
    localStorage.setItem("adminName", data.admin_name);
  }
  localStorage.removeItem("studentName");
  localStorage.removeItem("studentGrade");
  localStorage.removeItem("grade");
  localStorage.removeItem("name");
}

async function navigateAfterAdminLogin(navigate) {
  try {
    const { students } = await listAdminStudents();
    const list = students || [];
    if (list.length === 0) {
      navigate("/admin/students");
      return;
    }
    if (list.length === 1) {
      const switched = await switchAdminStudent(list[0].name);
      localStorage.setItem("token", switched.token);
      localStorage.setItem("studentName", switched.student_name);
      if (switched.admin_name) localStorage.setItem("adminName", switched.admin_name);
      if (switched.grade != null) {
        localStorage.setItem("studentGrade", String(switched.grade));
      } else {
        localStorage.removeItem("studentGrade");
      }
    }
    navigate("/admin");
  } catch {
    navigate("/admin");
  }
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const signedOut = searchParams.get("signedOut");
  const [activeTab, setActiveTab] = useState(TAB_SIGN_IN);
  const [adminName, setAdminName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [password, setPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    const trimmedAdmin = adminName.trim();
    const trimmedStudent = studentName.trim();
    if (!trimmedAdmin) {
      setError("Admin name is required.");
      return;
    }
    setBusy(true);
    try {
      if (trimmedStudent) {
        const data = await loginStudent({
          adminName: trimmedAdmin,
          name: trimmedStudent,
          password,
        });
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role);
        localStorage.setItem("name", data.name);
        localStorage.removeItem("studentName");
        localStorage.removeItem("adminName");
        if (data.grade != null) localStorage.setItem("grade", String(data.grade));
        else localStorage.removeItem("grade");
        touchActivity();
        navigate("/student");
      } else {
        const data = await loginAdmin({
          adminName: trimmedAdmin,
          password,
        });
        await persistAdminSession(data);
        touchActivity();
        await navigateAfterAdminLogin(navigate);
      }
    } catch {
      setError(
        trimmedStudent
          ? "Invalid admin name, student name, or password."
          : "Invalid admin name or password.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signupAdmin({
        name: signupName.trim(),
        password: signupPassword,
      });
      setAdminName(signupName.trim());
      setStudentName("");
      setPassword("");
      setSignupPassword("");
      setSignupName("");
      setActiveTab(TAB_SIGN_IN);
      setError("");
    } catch (ex) {
      setError(ex.message || "Could not create admin account.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-slate-800 tracking-tight">
          🪶 Quill
        </h1>
        <p className="text-slate-600 mt-2 text-sm">Your learning companion</p>
      </div>

      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {busy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 backdrop-blur-sm">
            <QuillLoading label={activeTab === TAB_SIGN_UP ? "Creating account…" : "Logging in…"} />
          </div>
        ) : null}

        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveTab(TAB_SIGN_IN);
              setError("");
            }}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              activeTab === TAB_SIGN_IN
                ? "bg-indigo-50 text-indigo-900 border-b-2 border-indigo-600"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab(TAB_SIGN_UP);
              setError("");
            }}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              activeTab === TAB_SIGN_UP
                ? "bg-indigo-50 text-indigo-900 border-b-2 border-indigo-600"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Sign up
          </button>
        </div>

        <div className="p-5">
          {activeTab === TAB_SIGN_IN ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <p className="text-slate-600 text-xs text-center leading-snug">
                Enter your family admin name. Add a student name to sign in as a
                student, or leave it blank for admin access.
              </p>
              <input
                type="text"
                autoComplete="organization"
                placeholder="Admin name"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                required
                className={inputClass}
              />
              <input
                type="text"
                autoComplete="username"
                placeholder="Student name (optional)"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className={inputClass}
              />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClass}
              />
              <button
                type="submit"
                disabled={busy}
                className="bg-indigo-500 hover:bg-indigo-600 text-white text-lg font-semibold py-4 rounded-2xl shadow transition disabled:opacity-50"
              >
                Log in
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="flex flex-col gap-3">
              <p className="text-slate-600 text-xs text-center leading-snug">
                Choose a unique admin name and password for your family account.
              </p>
              <input
                type="text"
                autoComplete="username"
                placeholder="Admin name"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                required
                className={inputClass}
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                required
                className={inputClass}
              />
              <button
                type="submit"
                disabled={busy}
                className="bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold transition disabled:opacity-50"
              >
                Create admin account
              </button>
            </form>
          )}

          {signedOut === "idle" ? (
            <p className="text-sm text-slate-700 text-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mt-4">
              You were signed out due to inactivity.
            </p>
          ) : null}
          {signedOut === "expired" ? (
            <p className="text-sm text-slate-700 text-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mt-4">
              Your session expired. Please sign in again.
            </p>
          ) : null}
          {error ? (
            <p className="text-red-500 text-sm text-center mt-4">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
