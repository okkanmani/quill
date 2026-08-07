import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createAdminStudent,
  deleteAdminStudent,
  getLearnSubjects,
  listAdminStudents,
  logout,
  switchAdminStudent,
  updateAdminStudent,
} from "../api";
import { applyStudentSessionPrefs } from "../adminSession";
import { ADMIN_MAIN_NAV } from "../adminNav";
import AppShell from "../components/AppShell";
import QuillLoading from "../components/QuillLoading";
import EditActionButton from "../components/EditActionButton";
import RecycleBinButton from "../components/RecycleBinButton";
import { GRADE_OPTIONS } from "../questionBuilderUtils";
import {
  flattenHubSubjects,
  sortedCurriculaFromSubjects,
} from "../learnHubGrades";
import {
  ADMIN_HUB_INLINE_ERROR,
  ADMIN_HUB_PAGE_INTRO,
  CREATE_FIELD_LABEL,
  CREATE_FIELD_INPUT,
  CREATE_FIELD_SELECT,
  CREATE_OUTLINE_BUTTON,
  CREATE_PUBLISH_BUTTON,
  WS_BODY,
  WS_CARD_DETAIL,
  WS_CARD_TITLE,
  WS_EYEBROW,
  WS_PAGE_HEADING,
} from "../adminHubTypography";

function StudentEditForm({ student, curriculumOptions, onCancel, onSaved, onError }) {
  const [name, setName] = useState(student.name);
  const [grade, setGrade] = useState(student.grade ?? 5);
  const [curriculum, setCurriculum] = useState(student.curriculum || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(student.name);
    setGrade(student.grade ?? 5);
    setCurriculum(student.curriculum || "");
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
    const curriculumChanged = (student.curriculum || "") !== (curriculum || "");
    const passwordChanged = Boolean(password);

    if (!trimmedName) {
      onError("Student name cannot be empty.");
      return;
    }
    if (!nameChanged && !gradeChanged && !curriculumChanged && !passwordChanged) {
      onError("Change the name, grade, curriculum, and/or password to update.");
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
      if (curriculumChanged) payload.curriculum = curriculum.trim();
      if (passwordChanged) payload.password = password;

      const updated = await updateAdminStudent(student.id, payload);
      if (updated.token) {
        localStorage.setItem("token", updated.token);
        if (updated.student_name) {
          localStorage.setItem("studentName", updated.student_name);
        }
        applyStudentSessionPrefs({
          grade: updated.grade,
          curriculum: updated.curriculum ?? "",
        });
      } else if (student.name === localStorage.getItem("studentName")) {
        applyStudentSessionPrefs({
          grade: updated.grade,
          curriculum: updated.curriculum ?? "",
        });
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
      <label className={CREATE_FIELD_LABEL}>
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={CREATE_FIELD_INPUT}
        />
      </label>

      <label className={CREATE_FIELD_LABEL}>
        Grade
        <select
          value={grade}
          onChange={(e) => setGrade(Number(e.target.value))}
          className={CREATE_FIELD_SELECT}
        >
          {GRADE_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </label>

      <label className={CREATE_FIELD_LABEL}>
        Curriculum
        <select
          value={curriculum}
          onChange={(e) => setCurriculum(e.target.value)}
          className={CREATE_FIELD_SELECT}
        >
          <option value="">No preference</option>
          {curriculumOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className={CREATE_FIELD_LABEL}>
        New password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="Leave blank to keep current"
          className={CREATE_FIELD_INPUT}
        />
      </label>

      <label className={CREATE_FIELD_LABEL}>
        Confirm new password
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="Leave blank to keep current"
          className={CREATE_FIELD_INPUT}
        />
      </label>

      <div className="flex flex-wrap gap-3 pt-1">
        <button type="submit" disabled={saving} className={CREATE_PUBLISH_BUTTON}>
          {saving ? "Updating…" : "Update"}
        </button>
        <button type="button" onClick={onCancel} className={CREATE_OUTLINE_BUTTON}>
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
  const [curriculum, setCurriculum] = useState("");
  const [curriculumOptions, setCurriculumOptions] = useState([]);
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
    getLearnSubjects()
      .then((data) => {
        const subjects = flattenHubSubjects(data.entries || []);
        setCurriculumOptions(sortedCurriculaFromSubjects(subjects));
      })
      .catch(() => setCurriculumOptions([]));
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
        curriculum: curriculum.trim() || undefined,
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
        applyStudentSessionPrefs({
          grade: sw.grade,
          curriculum: sw.curriculum ?? created.curriculum ?? "",
        });
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
        s.id === updated.id
          ? {
              ...s,
              name: updated.name,
              grade: updated.grade,
              curriculum: updated.curriculum || "",
            }
          : s,
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
      onLogout={handleLogout}
    >
      <div className="max-w-3xl">
        <h1 className={`${WS_PAGE_HEADING} mb-1`}>Students</h1>
        <p className={`${ADMIN_HUB_PAGE_INTRO} mb-6`}>
          Each student belongs to your admin account. They log in with their name and
          password on the home page. Names must be unique among your students.
        </p>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-8">
          <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200">
            <h2 className={WS_EYEBROW}>Add a student</h2>
          </div>
          <form onSubmit={handleCreate} className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className={CREATE_FIELD_LABEL}>
                Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="off"
                  placeholder="Student name"
                  className={CREATE_FIELD_INPUT}
                />
              </label>
              <label className={CREATE_FIELD_LABEL}>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Login password"
                  className={CREATE_FIELD_INPUT}
                />
              </label>
              <label className={CREATE_FIELD_LABEL}>
                Grade
                <select
                  value={grade}
                  onChange={(e) => setGrade(Number(e.target.value))}
                  className={CREATE_FIELD_SELECT}
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={CREATE_FIELD_LABEL}>
                Curriculum
                <select
                  value={curriculum}
                  onChange={(e) => setCurriculum(e.target.value)}
                  className={CREATE_FIELD_SELECT}
                >
                  <option value="">No preference</option>
                  {curriculumOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" disabled={creating} className={CREATE_PUBLISH_BUTTON}>
              {creating ? "Adding…" : "Add student"}
            </button>
          </form>
        </div>

        {loading && <QuillLoading page label="Loading students…" />}
        {error && <p className={ADMIN_HUB_INLINE_ERROR}>{error}</p>}

        {!loading && students.length === 0 && !error && (
          <p className={WS_BODY}>No students yet. Add one above.</p>
        )}

        {!loading && students.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200">
              <h2 className={WS_EYEBROW}>
                Your students ({students.length})
              </h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {students.map((s) => (
                <li key={s.id} className="px-4 py-3 text-slate-900">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`${WS_CARD_TITLE} truncate`}>{s.name}</p>
                      <p className={`${WS_CARD_DETAIL} mt-0.5`}>
                        Grade {s.grade ?? "—"}
                        {s.curriculum ? ` · ${s.curriculum}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      {s.name === localStorage.getItem("studentName") ? (
                        <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5">
                          Current view
                        </span>
                      ) : null}
                      <EditActionButton
                        active={editingId === s.id}
                        onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                        label={
                          editingId === s.id
                            ? `Close editor for ${s.name}`
                            : `Edit ${s.name}`
                        }
                      />
                      <RecycleBinButton
                        onClick={() => handleDelete(s)}
                        label={`Delete ${s.name}`}
                      />
                    </div>
                  </div>

                  {editingId === s.id ? (
                    <StudentEditForm
                      student={s}
                      curriculumOptions={curriculumOptions}
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
