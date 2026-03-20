import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginAdmin, loginStudent } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showAdminForm, setShowAdminForm] = useState(false);

  async function handleStudentLogin() {
    try {
      const data = await loginStudent();
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);
      navigate("/student");
    } catch {
      setError("Something went wrong. Try again.");
    }
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    try {
      const data = await loginAdmin(password);
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      navigate("/admin");
    } catch {
      setError("Invalid password.");
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-amber-800 tracking-tight">
          🪶 Quill
        </h1>
        <p className="text-amber-600 mt-2 text-sm">Your learning companion</p>
      </div>

      <div className="flex flex-col gap-4 w-72">
        {/* Student login */}
        <button
          onClick={handleStudentLogin}
          className="bg-amber-500 hover:bg-amber-600 text-white text-lg font-semibold py-4 rounded-2xl shadow transition"
        >
          I'm a Student 🎒
        </button>

        {/* Admin toggle */}
        {!showAdminForm ? (
          <button
            onClick={() => setShowAdminForm(true)}
            className="text-amber-700 text-sm underline text-center"
          >
            Admin login
          </button>
        ) : (
          <form onSubmit={handleAdminLogin} className="flex flex-col gap-3">
            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-amber-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              className="bg-amber-800 hover:bg-amber-900 text-white py-3 rounded-xl text-sm font-semibold transition"
            >
              Login as Admin
            </button>
          </form>
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </div>
    </div>
  );
}
