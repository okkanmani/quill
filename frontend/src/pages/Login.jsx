import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loginAdmin, loginStudent, signupAdmin, touchActivity } from "../api";
import QuillLoading from "../components/QuillLoading";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const signedOut = searchParams.get("signedOut");
  const [adminName, setAdminName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [password, setPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [error, setError] = useState("");
  const [screen, setScreen] = useState("login");
  const [loginBusy, setLoginBusy] = useState(false);
  const [signupBusy, setSignupBusy] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    const trimmedAdmin = adminName.trim();
    const trimmedStudent = studentName.trim();
    if (!trimmedAdmin) {
      setError("Admin name is required.");
      return;
    }
    setLoginBusy(true);
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
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role);
        if (data.admin_name) {
          localStorage.setItem("adminName", data.admin_name);
        }
        localStorage.removeItem("studentName");
        localStorage.removeItem("studentGrade");
        localStorage.removeItem("grade");
        localStorage.removeItem("name");
        touchActivity();
        navigate("/admin");
      }
    } catch {
      setError(
        trimmedStudent
          ? "Invalid admin name, student name, or password."
          : "Invalid admin name or password.",
      );
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setSignupBusy(true);
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
      setScreen("login");
      setError("");
    } catch (ex) {
      setError(ex.message || "Could not create admin account.");
    } finally {
      setSignupBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-slate-800 tracking-tight">
          🪶 Quill
        </h1>
        <p className="text-slate-600 mt-2 text-sm">Your learning companion</p>
      </div>

      <div className="relative flex flex-col gap-6 w-full max-w-sm">
        {(loginBusy || signupBusy) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-50/90 backdrop-blur-sm">
            <QuillLoading
              label={signupBusy ? "Creating account…" : "Logging in…"}
            />
          </div>
        )}

        {screen === "login" && (
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <p className="text-slate-800 text-sm font-semibold text-center">
              Sign in
            </p>
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
              className="border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="text"
              autoComplete="username"
              placeholder="Student name (optional)"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="submit"
              disabled={loginBusy}
              className="bg-indigo-500 hover:bg-indigo-600 text-white text-lg font-semibold py-4 rounded-2xl shadow transition disabled:opacity-50"
            >
              Log in
            </button>
          </form>
        )}

        {screen === "signup" && (
          <form onSubmit={handleSignup} className="flex flex-col gap-3">
            <p className="text-slate-800 text-sm font-semibold text-center">
              Create admin account
            </p>
            <p className="text-slate-600 text-xs text-center leading-snug">
              Choose a unique admin name and password. You can verify by email
              later; for now this only creates your account in the database.
            </p>
            <input
              type="text"
              autoComplete="username"
              placeholder="Admin name"
              value={signupName}
              onChange={(e) => setSignupName(e.target.value)}
              required
              className="border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              required
              className="border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="submit"
              disabled={signupBusy}
              className="bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold transition disabled:opacity-50"
            >
              Create admin
            </button>
          </form>
        )}

        {screen === "login" && (
          <button
            type="button"
            onClick={() => {
              setScreen("signup");
              setError("");
            }}
            className="text-slate-700 text-sm underline text-center"
          >
            Sign up as admin
          </button>
        )}

        {screen === "signup" && (
          <button
            type="button"
            onClick={() => {
              setScreen("login");
              setError("");
            }}
            className="text-slate-700 text-sm underline text-center"
          >
            Back to sign in
          </button>
        )}

        {signedOut === "idle" ? (
          <p className="text-sm text-slate-700 text-center rounded-xl border border-slate-200 bg-white px-4 py-3">
            You were signed out due to inactivity.
          </p>
        ) : null}
        {signedOut === "expired" ? (
          <p className="text-sm text-slate-700 text-center rounded-xl border border-slate-200 bg-white px-4 py-3">
            Your session expired. Please sign in again.
          </p>
        ) : null}
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </div>
    </div>
  );
}
