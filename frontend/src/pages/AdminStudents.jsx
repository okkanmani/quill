import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createAdminStudent,
  deleteAdminStudent,
  listAdminStudents,
  logout,
  switchAdminStudent,
  updateAdminStudent,
} from "../api";
import { formatAdminHeaderTrail } from "../adminSession";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";
import QuillLoading from "../components/QuillLoading";
import { GRADE_OPTIONS } from "../questionBuilderUtils";

function StudentEditForm({ student, onCancel, onSaved, onError }) {
  const [name, setName] = useState(student.name);
  const [grade, setGrade] = useState(student.grade ?? 5);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(student.name);
    setGrade(student.grade ?? 5);
    setPassword("");
    setConfirmPassword("");
  }, [student]);

  async function handleSubmit(event) {
    event.preventDefault();
    onError("");

    const trimmedName = name.trim();
    const nameChanged = trimmedName !== student.name;
    const gradeChanged =
      student.grade == null || Number(grade) !== Number(student.grade);
    const passwordChanged = Boolean(password);

    if (!trimmedName) {
      onError("Student name cannot be empty.");
      return;
    }
    if (!nameChanged && !gradeChanged && !passwordChanged) {
      onError("Change the name, grade, and/or password to update.");
      return;
    }
    if (passwordChanged && password.length < 4) {
      onError("Password must be at least 4 characters.");
      return;
    }
    if (passwordChanged && password !== confirmPassword) {
      onError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const payload = {};
      if (nameChanged) payload.name = trimmedName;
      if (gradeChanged) payload.grade = Number(grade);
      if (passwordChanged) payload.password = password;

      const updated = await updateAdminStudent(student.id, payload);
      if (updated.token) {
        localStorage.setItem("token", updated.token);
        if (updated.student_name) {
          localStorage.setItem("studentName", updated.student_name);
        }
        if (updated.grade != null) {
          localStorage.setItem("studentGrade", String(updated.grade));
        }
      } else if (
        student.name === localStorage.getItem("studentName") &&
        updated.grade != null
      ) {
        localStorage.setItem("studentGrade", String(updated.grade));
      }
      onSaved(updated);
    } catch (ex) {
      onError(ex.message || "Could not update student.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <label className="block text-sm font-semibold text-slate-800">
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </label>

      <label className="block text-sm font-semibold text-slate-800">
        Grade
        <select
          value={grade}
          onChange={(e) => setGrade(Number(e.target.value))}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          {GRADE_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-semibold text-slate-800">
        New password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="Leave blank to keep current"
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </label>

      <label className="block text-sm font-semibold text-slate-800">
        Confirm new password
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="Leave blank to keep current"
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-2 text-sm"
        >
          {saving ? "Updating…" : "Update"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold rounded-xl px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AdminStudents() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [grade, setGrade] = useState(5);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);

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
        grade: Number(grade),
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
        if (sw.grade != null) {
          localStorage.setItem("studentGrade", String(sw.grade));
        }
      }
      await load();
    } catch (ex) {
      setError(ex.message || "Could not create student.");
    } finally {
      setCreating(false);
    }
  }

  function handleStudentUpdated(updated) {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === updated.id ? { ...s, name: updated.name, grade: updated.grade } : s,
      ),
    );
    setEditingId(null);
    setError("");
  }

  async function handleDelete(student) {
    const ok = window.confirm(
      `Delete “${student.name}”? This removes their account and all their worksheet results.`,
    );
    if (!ok) return;
    setError("");
    try {
      const result = await deleteAdminStudent(student.id);
      if (result.token) {
        localStorage.setItem("token", result.token);
        localStorage.removeItem("studentName");
      }
      if (editingId === student.id) {
        setEditingId(null);
      }
      await load();
    } catch (ex) {
      setError(ex.message || "Could not delete student.");
    }
  }

  return (
    <AppShell
      navLinks={ADMIN_MAIN_NAV}
      trailing={`Admin · ${formatAdminHeaderTrail()}`}
      onLogout={handleLogout}
    >
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Students</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
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
            <select
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
              className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm bg-white"
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={creating}
              className="bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {creating ? "Adding…" : "Add student"}
            </button>
          </form>
        </div>

        {loading && <QuillLoading label="Loading students…" />}
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
                <li key={s.id} className="px-4 py-3 text-slate-900">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Grade {s.grade ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {s.name === localStorage.getItem("studentName") ? (
                        <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5">
                          Current view
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                        className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-sm font-semibold rounded-xl px-3 py-1.5 transition"
                      >
                        {editingId === s.id ? "Close" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s)}
                        className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-sm font-semibold rounded-xl px-3 py-1.5 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {editingId === s.id ? (
                    <StudentEditForm
                      student={s}
                      onCancel={() => setEditingId(null)}
                      onSaved={handleStudentUpdated}
                      onError={setError}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}
