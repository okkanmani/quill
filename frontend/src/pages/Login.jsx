import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginAdmin, loginStudent } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [adminStudentName, setAdminStudentName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [showAdminForm, setShowAdminForm] = useState(false);

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
      navigate("/student");
    } catch {
      setError("Invalid name or password.");
    }
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    setError("");
    try {
      const data = await loginAdmin({
        studentName: adminStudentName,
        password: adminPassword,
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("studentName", data.student_name);
      navigate("/admin");
    } catch {
      setError("Invalid student name or admin password.");
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-amber-800 tracking-tight">
          🪶 Quill
        </h1>
        <p className="text-amber-600 mt-2 text-sm">Your learning companion</p>
      </div>

      <div className="flex flex-col gap-6 w-full max-w-sm">
        {!showAdminForm ? (
          <form
            onSubmit={handleStudentLogin}
            className="flex flex-col gap-3"
          >
            <p className="text-amber-800 text-sm font-semibold text-center">
              Student
            </p>
            <input
              type="text"
              autoComplete="username"
              placeholder="Your name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="border border-amber-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={studentPassword}
              onChange={(e) => setStudentPassword(e.target.value)}
              className="border border-amber-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-white text-lg font-semibold py-4 rounded-2xl shadow transition"
            >
              Log in as student
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminLogin} className="flex flex-col gap-3">
            <p className="text-amber-800 text-sm font-semibold text-center">
              Admin
            </p>
            <p className="text-amber-600 text-xs text-center leading-snug">
              Enter a student&apos;s name and your admin password to view that
              student&apos;s worksheets and results.
            </p>
            <input
              type="text"
              placeholder="Student name"
              value={adminStudentName}
              onChange={(e) => setAdminStudentName(e.target.value)}
              className="border border-amber-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <input
              type="password"
              placeholder="Admin password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="border border-amber-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              className="bg-amber-800 hover:bg-amber-900 text-white py-3 rounded-xl text-sm font-semibold transition"
            >
              Log in as admin
            </button>
          </form>
        )}

        {!showAdminForm ? (
          <button
            type="button"
            onClick={() => {
              setShowAdminForm(true);
              setError("");
            }}
            className="text-amber-700 text-sm underline text-center"
          >
            Admin login
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowAdminForm(false);
              setError("");
            }}
            className="text-amber-700 text-sm underline text-center"
          >
            Back to student login
          </button>
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </div>
    </div>
  );
}
