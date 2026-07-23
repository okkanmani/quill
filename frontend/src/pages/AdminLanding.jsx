import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getAdminHome,
  logout,
  switchAdminStudent,
  clearAdminStudentContext,
  unlockTestAttempt,
  unlockTimedWorksheet,
  setWorksheetAccessLock,
  clearWorksheetAccessLock,
} from "../api";
import { ADMIN_MAIN_NAV } from "../adminNav";
import {
  activityDestination,
  activityKindBadgeClass,
  activityKindLabel,
  activityTitle,
} from "../adminHomeUtils";
import AppShell from "../components/AppShell";
import AdminStudentRoster from "../components/AdminStudentRoster";
import QuillLoading from "../components/QuillLoading";
import WorksheetLockButton from "../components/WorksheetLockButton";

function formatRelativeTime(iso) {
  if (!iso) return "No activity yet";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Recently";
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ActivityKindBadge({ item }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${activityKindBadgeClass(item)}`}
    >
      {activityKindLabel(item)}
    </span>
  );
}

function ActivityRow({ item, onNavigate, switchingStudent, showStudentName = true }) {
  const destination = activityDestination(item);
  const content = (
    <>
      <div className="min-w-0 flex items-center gap-2 flex-wrap">
        <ActivityKindBadge item={item} />
        <span className="text-sm text-slate-800 truncate">
          {showStudentName ? (
            <>
              <span className="font-medium text-slate-900">{item.student_name}</span>
              <span className="text-slate-500"> · </span>
            </>
          ) : null}
          <span>{activityTitle(item)}</span>
        </span>
      </div>
      <span className="text-xs text-slate-500 shrink-0">{formatRelativeTime(item.at)}</span>
    </>
  );

  if (!destination) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={Boolean(switchingStudent)}
      onClick={() => onNavigate(item.student_name, destination)}
      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-left hover:bg-slate-50 hover:border-slate-300 transition disabled:opacity-60"
    >
      {content}
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2.5">
      {children}
    </p>
  );
}

function pendingBadgeLabel(item) {
  if (item.lock_type === "access") return "Locked";
  if (item.is_test) return "Test";
  return "Timed";
}

function pendingStatusLine(item, scopedToStudent) {
  const parts = [];
  if (item.lock_type === "access") {
    parts.push("Access locked");
  } else if (item.lock_type === "test_attempt") {
    parts.push(item.attempt_locked ? "Sitting locked" : "Test in progress");
  } else {
    parts.push("Timed attempt locked");
  }
  if (!scopedToStudent) parts.push(item.student_name);
  parts.push("awaiting unlock");
  return parts.join(" · ");
}

function pendingUnlockLabel(item) {
  if (item.lock_type === "access") return `Unlock access to ${item.title}`;
  if (item.lock_type === "test_attempt") return `Reset test sitting for ${item.title}`;
  return `Reset timed attempt for ${item.title}`;
}

function pendingUnlockConfirm(item) {
  if (item.lock_type === "access") {
    return `Unlock access to “${item.title}” for ${item.student_name}?`;
  }
  if (item.is_test) {
    return `Reset test sitting for “${item.title}” (${item.student_name})? The student can start again from scratch.`;
  }
  return `Unlock “${item.title}” for ${item.student_name}? They can start this timed worksheet again from scratch.`;
}

function pendingLockVariant(item) {
  if (item.lock_type === "access") return "access";
  if (item.lock_type === "test_attempt" || item.lock_type === "timed_attempt") return "timed";
  return "neutral";
}

export default function AdminLanding() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [switchingStudent, setSwitchingStudent] = useState("");
  const [unlockingKey, setUnlockingKey] = useState("");

  async function refreshHome() {
    const next = await getAdminHome();
    setData(next);
  }

  useEffect(() => {
    refreshHome()
      .catch(() => setError("Could not load home dashboard."))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  async function handleSelectStudent(name) {
    const current = localStorage.getItem("studentName") || "";
    if (!name) return;
    if (name === current) {
      setSwitchingStudent(name);
      setError("");
      try {
        const cleared = await clearAdminStudentContext();
        localStorage.setItem("token", cleared.token);
        localStorage.removeItem("studentName");
        localStorage.removeItem("studentGrade");
        window.location.reload();
      } catch {
        setError("Could not clear student selection.");
        setSwitchingStudent("");
      }
      return;
    }
    setSwitchingStudent(name);
    setError("");
    try {
      const switched = await switchAdminStudent(name);
      localStorage.setItem("token", switched.token);
      localStorage.setItem("studentName", switched.student_name);
      if (switched.admin_name) localStorage.setItem("adminName", switched.admin_name);
      if (switched.grade != null) {
        localStorage.setItem("studentGrade", String(switched.grade));
      } else {
        localStorage.removeItem("studentGrade");
      }
      window.location.reload();
    } catch {
      setError("Could not switch student.");
      setSwitchingStudent("");
    }
  }

  async function handleUnlockPending(item) {
    const key = `${item.student_name}-${item.worksheet_id}`;
    const ok = window.confirm(pendingUnlockConfirm(item));
    if (!ok) return;

    setUnlockingKey(key);
    setError("");
    const current = localStorage.getItem("studentName") || "";
    try {
      if (item.student_name && item.student_name !== current) {
        await handleSelectStudentWithoutReload(item.student_name);
      }

      if (item.lock_type === "access") {
        if (item.lock_reason === "admin") {
          await clearWorksheetAccessLock(item.worksheet_id);
        } else {
          await setWorksheetAccessLock(item.worksheet_id, false);
        }
      } else if (item.lock_type === "test_attempt") {
        await unlockTestAttempt(item.worksheet_id);
      } else if (item.lock_type === "timed_attempt") {
        await unlockTimedWorksheet(item.worksheet_id);
      }

      await refreshHome();
    } catch (err) {
      setError(err.message || "Could not unlock worksheet.");
    } finally {
      setUnlockingKey("");
    }
  }

  async function handleNavigateForStudent(studentName, path) {
    setError("");
    const current = localStorage.getItem("studentName") || "";
    try {
      if (studentName && studentName !== current) {
        setSwitchingStudent(studentName);
        await handleSelectStudentWithoutReload(studentName);
        setSwitchingStudent("");
      }
      navigate(path);
    } catch {
      setError("Could not open that item.");
      setSwitchingStudent("");
    }
  }

  async function handleSelectStudentWithoutReload(name) {
    const switched = await switchAdminStudent(name);
    localStorage.setItem("token", switched.token);
    localStorage.setItem("studentName", switched.student_name);
    if (switched.admin_name) localStorage.setItem("adminName", switched.admin_name);
    if (switched.grade != null) {
      localStorage.setItem("studentGrade", String(switched.grade));
    } else {
      localStorage.removeItem("studentGrade");
    }
  }

  const students = data?.students || [];
  const recentActivity = data?.recent_activity || [];
  const pending = data?.pending || [];
  const selectedStudent = data?.selected_student || localStorage.getItem("studentName") || "";
  const scopedToStudent = Boolean(selectedStudent);
  const activitySectionLabel = scopedToStudent
    ? `Recent activity · ${selectedStudent}`
    : "Recent activity · all students";
  const pendingSectionLabel = scopedToStudent
    ? `Pending · ${selectedStudent}`
    : "Pending";

  return (
    <AppShell navLinks={ADMIN_MAIN_NAV} onLogout={handleLogout}>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Home</h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          {scopedToStudent
            ? `Overview for ${selectedStudent}. Click their name again to view all students.`
            : "Overview of your students, recent activity, and items that need attention."}
        </p>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? <QuillLoading label="Loading home…" /> : null}

        {!loading && !error && students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
            <p className="text-slate-700 text-sm mb-4">Add a student to get started.</p>
            <Link
              to="/admin/students"
              className="inline-flex rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 transition"
            >
              Go to Students
            </Link>
          </div>
        ) : null}

        {!loading && !error && students.length > 0 ? (
          <div className="flex flex-col gap-6">
            <section>
              <SectionLabel>Students</SectionLabel>
              <AdminStudentRoster
                students={students}
                selectedName={selectedStudent}
                onSelectStudent={handleSelectStudent}
                onNavigateForStudent={handleNavigateForStudent}
                switchingStudent={switchingStudent}
              />
            </section>

            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
              <section>
                <SectionLabel>{activitySectionLabel}</SectionLabel>
                {recentActivity.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    {scopedToStudent
                      ? `No recent activity for ${selectedStudent} yet.`
                      : "No recent activity yet."}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {recentActivity.map((item, index) => (
                      <ActivityRow
                        key={`${item.kind}-${item.student_name}-${item.at}-${index}`}
                        item={item}
                        onNavigate={handleNavigateForStudent}
                        switchingStudent={switchingStudent}
                        showStudentName={!scopedToStudent}
                      />
                    ))}
                  </div>
                )}
              </section>

              <div className="flex flex-col gap-5">
                <section>
                  <SectionLabel>Quick actions</SectionLabel>
                  <div className="flex flex-col gap-2">
                    <Link
                      to="/admin/create/worksheet"
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
                    >
                      + New worksheet
                    </Link>
                    <Link
                      to="/admin/create/learn"
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
                    >
                      + New learning resource
                    </Link>
                    <Link
                      to="/admin/worksheets"
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
                    >
                      Unlock a test
                    </Link>
                  </div>
                </section>

                <section>
                  <SectionLabel>{pendingSectionLabel}</SectionLabel>
                  {pending.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-3.5 py-4 text-sm text-slate-500">
                      {scopedToStudent
                        ? `Nothing waiting for unlock for ${selectedStudent}.`
                        : "Nothing waiting for unlock."}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {pending.map((item) => {
                        const itemKey = `${item.student_name}-${item.worksheet_id}`;
                        return (
                          <div
                            key={itemKey}
                            className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3.5 py-2.5 flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-violet-100 text-violet-900 border-violet-200">
                                  {pendingBadgeLabel(item)}
                                </span>
                                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {pendingStatusLine(item, scopedToStudent)}
                              </p>
                            </div>
                            <WorksheetLockButton
                              locked
                              variant={pendingLockVariant(item)}
                              label={pendingUnlockLabel(item)}
                              disabled={Boolean(unlockingKey)}
                              onClick={() => handleUnlockPending(item)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
