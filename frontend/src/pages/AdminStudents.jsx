import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAdminStudent, listAdminStudents, logout, switchAdminStudent } from "../api";
import { formatAdminHeaderTrail } from "../adminSession";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppHeader from "../components/AppHeader";

export default function AdminStudents() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    listAdminStudents()
      .then((data) => {
        setError("");
        setStudents(data.students || []);
      })
      .catch(() => setError("Could not load students."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const created = await createAdminStudent({
        name: name.trim(),
        password,
      });
      setName("");
      setPassword("");
      if (!localStorage.getItem("studentName")) {
        const sw = await switchAdminStudent(created.name);
        localStorage.setItem("token", sw.token);
        localStorage.setItem("studentName", sw.student_name);
        if (sw.admin_name) {
          localStorage.setItem("adminName", sw.admin_name);
        }
      }
      await load();
    } catch (ex) {
      setError(ex.message || "Could not create student.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <AppHeader
        navLinks={ADMIN_MAIN_NAV}
        trailing={
          <span className="text-slate-800 text-sm font-medium">
            Admin · {formatAdminHeaderTrail()}
          </span>
        }
        onLogout={handleLogout}
      />

      <div className="max-w-3xl">
        <p className="text-slate-700 text-sm mb-6 leading-relaxed">
          Each student belongs to your admin account. They log in with their name and
          password on the home page. Names must be unique among your students.
        </p>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-slate-950 mb-3">Add a student</h2>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row flex-wrap gap-3">
            <input
              type="text"
              placeholder="Student name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="flex-1 min-w-[10rem] border border-slate-300 rounded-xl px-4 py-2.5 text-sm"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="flex-1 min-w-[10rem] border border-slate-300 rounded-xl px-4 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={creating}
              className="bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {creating ? "Adding…" : "Add student"}
            </button>
          </form>
        </div>

        {loading && <p className="text-slate-600">Loading…</p>}
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {!loading && students.length === 0 && !error && (
          <p className="text-slate-600">No students yet. Add one above.</p>
        )}

        {!loading && students.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Your students ({students.length})
              </h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {students.map((s) => (
                <li
                  key={s.id}
                  className="px-4 py-3 text-slate-900 font-medium flex items-center justify-between gap-2"
                >
                  <span>{s.name}</span>
                  {s.name === localStorage.getItem("studentName") ? (
                    <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5">
                      Current view
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
