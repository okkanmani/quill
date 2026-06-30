import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginAdmin, loginStudent, signupAdmin } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [adminStudentName, setAdminStudentName] = useState("");
  const [adminAccountName, setAdminAccountName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [error, setError] = useState("");
  const [screen, setScreen] = useState("student");
  /** When screen === "admin": sign in via student name + password, or admin name + password. */
  const [adminLoginMode, setAdminLoginMode] = useState("byStudent");
  const [signupBusy, setSignupBusy] = useState(false);

  async function handleStudentLogin(e) {
    e.preventDefault();
    setError("");
    try {
      const data = await loginStudent({
        name: studentName,
        password: studentPassword,
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);
      localStorage.removeItem("studentName");
      localStorage.removeItem("adminName");
      if (data.grade != null) localStorage.setItem("grade", String(data.grade));
      else localStorage.removeItem("grade");
      navigate("/student");
    } catch {
      setError("Invalid name or password.");
    }
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    setError("");
    try {
      const data =
        adminLoginMode === "byStudent"
          ? await loginAdmin({
              studentName: adminStudentName.trim(),
              password: adminPassword,
            })
          : await loginAdmin({
              adminName: adminAccountName.trim(),
              password: adminPassword,
            });
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      if (data.admin_name) {
        localStorage.setItem("adminName", data.admin_name);
      }
      if (data.student_name) {
        localStorage.setItem("studentName", data.student_name);
      } else {
        localStorage.removeItem("studentName");
      }
      if (data.grade != null) localStorage.setItem("studentGrade", String(data.grade));
      else localStorage.removeItem("studentGrade");
      navigate("/admin");
    } catch {
      setError(
        adminLoginMode === "byStudent"
          ? "Invalid student name or admin password."
          : "Invalid admin name or password.",
      );
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
      setSignupPassword("");
      setScreen("admin");
      setAdminLoginMode("byAccount");
      setAdminAccountName(signupName.trim());
      setSignupName("");
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

      <div className="flex flex-col gap-6 w-full max-w-sm">
        {screen === "student" && (
          <form
            onSubmit={handleStudentLogin}
            className="flex flex-col gap-3"
          >
            <p className="text-slate-800 text-sm font-semibold text-center">
              Student
            </p>
            <input
              type="text"
              autoComplete="username"
              placeholder="Your name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={studentPassword}
              onChange={(e) => setStudentPassword(e.target.value)}
              className="border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="submit"
              className="bg-indigo-500 hover:bg-slate-600 text-white text-lg font-semibold py-4 rounded-2xl shadow transition"
            >
              Log in as student
            </button>
          </form>
        )}

        {screen === "admin" && (
          <form onSubmit={handleAdminLogin} className="flex flex-col gap-3">
            <p className="text-slate-800 text-sm font-semibold text-center">
              Admin
            </p>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setAdminLoginMode("byStudent");
                  setError("");
                }}
                className={`flex-1 py-2.5 transition ${
                  adminLoginMode === "byStudent"
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                Student + password
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminLoginMode("byAccount");
                  setError("");
                }}
                className={`flex-1 py-2.5 transition ${
                  adminLoginMode === "byAccount"
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                Admin name + password
              </button>
            </div>
            {adminLoginMode === "byStudent" ? (
              <>
                <p className="text-slate-600 text-xs text-center leading-snug">
                  Enter a student&apos;s name and your admin password to view
                  that student&apos;s worksheets and results.
                </p>
                <input
                  type="text"
                  placeholder="Student name"
                  value={adminStudentName}
                  onChange={(e) => setAdminStudentName(e.target.value)}
                  className="border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </>
            ) : (
              <>
                <p className="text-slate-600 text-xs text-center leading-snug">
                  Use the admin name you chose at sign-up. Then add students on
                  the Students page.
                </p>
                <input
                  type="text"
                  autoComplete="username"
                  placeholder="Admin name"
                  value={adminAccountName}
                  onChange={(e) => setAdminAccountName(e.target.value)}
                  className="border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </>
            )}
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold transition"
            >
              Log in as admin
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
              {signupBusy ? "Creating…" : "Create admin"}
            </button>
          </form>
        )}

        {screen === "student" && (
          <div className="flex flex-col gap-2 items-center">
            <button
              type="button"
              onClick={() => {
                setScreen("admin");
                setError("");
              }}
              className="text-slate-700 text-sm underline text-center"
            >
              Admin login
            </button>
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
          </div>
        )}

        {screen === "admin" && (
          <button
            type="button"
            onClick={() => {
              setScreen("student");
              setError("");
            }}
            className="text-slate-700 text-sm underline text-center"
          >
            Back to student login
          </button>
        )}

        {screen === "signup" && (
          <button
            type="button"
            onClick={() => {
              setScreen("student");
              setError("");
            }}
            className="text-slate-700 text-sm underline text-center"
          >
            Back to student login
          </button>
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </div>
    </div>
  );
}
