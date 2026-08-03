import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getAdminHome,
  logout,
  switchAdminStudent,
  clearAdminStudentContext,
  unlockTimedWorksheet,
  setWorksheetAccessLock,
  clearWorksheetAccessLock,
  scheduleTestUnlock,
} from "../api";
import { applyStudentSessionPrefs } from "../adminSession";
import {
  formatScheduledUnlockLabel,
  isoToLocalDateInput,
  isoToLocalTimeInput,
  localDateAndTimeToIso,
} from "../testSchedulingUtils";
import { ADMIN_MAIN_NAV } from "../adminNav";
import {
  activityDestination,
  activityKindBadgeClass,
  activityKindLabel,
  activityScoreLine,
  activityTitle,
} from "../adminHomeUtils";
import AppShell from "../components/AppShell";
import AdminStudentRoster from "../components/AdminStudentRoster";
import QuillLoading from "../components/QuillLoading";
import WorksheetLockButton from "../components/WorksheetLockButton";
import PadlockIcon from "../components/PadlockIcon";
import { AdminFocusChipSection } from "../adminFocusChipUtils";
import {
  ROW_ACTION_BUTTON_CLASS,
} from "../components/rowActionButtonStyles";

/** Max list rows per home section (Quick actions excluded). */
const HOME_SECTION_ITEM_LIMIT = 5;

/** List row on admin home (Focus areas keep their own bordered chips). */
const HOME_ROW_CLASS =
  "rounded-xl px-3.5 py-2.5 transition-colors hover:bg-slate-100/90";
const HOME_ROW_BUTTON_CLASS = `${HOME_ROW_CLASS} w-full text-left disabled:opacity-60`;

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
  const scoreLine = activityScoreLine(item);
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
          {scoreLine ? (
            <>
              <span className="text-slate-500"> · </span>
              <span className="font-semibold text-teal-900 tabular-nums">{scoreLine}</span>
            </>
          ) : null}
        </span>
      </div>
      <span className="text-xs text-slate-500 shrink-0">{formatRelativeTime(item.at)}</span>
    </>
  );

  if (!destination) {
    return (
      <div className={`${HOME_ROW_CLASS} flex flex-wrap items-center justify-between gap-2`}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={Boolean(switchingStudent)}
      onClick={() => onNavigate(item.student_name, destination)}
      className={`${HOME_ROW_BUTTON_CLASS} flex flex-wrap items-center justify-between gap-2`}
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

function SectionMoreHint({ shown, total, noun }) {
  if (total <= shown) return null;
  return (
    <p className="text-xs text-slate-500 mt-2">
      Showing {shown} of {total} {noun}.
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
  } else {
    parts.push("Timed attempt locked");
  }
  if (!scopedToStudent) parts.push(item.student_name);
  parts.push("awaiting unlock");
  return parts.join(" · ");
}

function pendingUnlockLabel(item) {
  if (item.lock_type === "access") return `Unlock access to ${item.title}`;
  return `Reset timed attempt for ${item.title}`;
}

function pendingUnlockConfirm(item) {
  if (item.lock_type === "access") {
    return `Unlock access to “${item.title}” for ${item.student_name}?`;
  }
  return `Unlock “${item.title}” for ${item.student_name}? They can start this timed worksheet again from scratch.`;
}

function pendingLockVariant(item) {
  if (item.lock_type === "access") return "access";
  if (item.lock_type === "timed_attempt") return "timed";
  return "neutral";
}

function CalendarTimeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[14px] h-[14px]"
      aria-hidden
    >
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
      <path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2" />
      <path d="M12 14v3" />
      <path d="M12 11v.01" />
    </svg>
  );
}

function scheduledItemKey(item) {
  return `${item.student_name}-${item.worksheet_id}-sched`;
}

function ScheduledTestsSection({
  label,
  items,
  scopedToStudent,
  unlockingKey,
  onUnlockNow,
  onScheduleUpdated,
  onScheduleError,
}) {
  const [rescheduleKey, setRescheduleKey] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [savingKey, setSavingKey] = useState("");

  function closeReschedule() {
    setRescheduleKey(null);
    setRescheduleDate("");
    setRescheduleTime("");
  }

  function toggleReschedule(item) {
    const key = scheduledItemKey(item);
    if (rescheduleKey === key) {
      closeReschedule();
      return;
    }
    setRescheduleKey(key);
    setRescheduleDate(isoToLocalDateInput(item.scheduled_unlock_at));
    setRescheduleTime(isoToLocalTimeInput(item.scheduled_unlock_at));
  }

  async function handleSaveReschedule(e, item) {
    e.preventDefault();
    const key = scheduledItemKey(item);
    const unlockAt = localDateAndTimeToIso(rescheduleDate, rescheduleTime);
    if (!unlockAt) {
      onScheduleError("Pick a valid date and time.");
      return;
    }
    if (new Date(unlockAt).getTime() <= Date.now()) {
      onScheduleError("Scheduled unlock must be in the future.");
      return;
    }

    setSavingKey(key);
    onScheduleError("");
    try {
      await scheduleTestUnlock(item.worksheet_id, {
        unlockAt,
        studentName: item.student_name,
      });
      closeReschedule();
      await onScheduleUpdated();
    } catch (err) {
      onScheduleError(err.message || "Could not reschedule.");
    } finally {
      setSavingKey("");
    }
  }

  if (items.length === 0) {
    return (
      <section>
        <SectionLabel>{label}</SectionLabel>
        <div className="rounded-xl px-3.5 py-4 text-sm text-slate-500">
          {scopedToStudent
            ? `No scheduled test unlocks for this student.`
            : "No scheduled test unlocks."}
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const itemKey = scheduledItemKey(item);
          const busy = unlockingKey === itemKey || savingKey === itemKey;
          const isRescheduling = rescheduleKey === itemKey;
          const dimRow =
            rescheduleKey !== null && rescheduleKey !== itemKey && !isRescheduling;

          return (
            <div
              key={itemKey}
              className={`rounded-xl transition-colors ${dimRow ? "opacity-50" : ""} ${
                isRescheduling ? "bg-slate-50/80" : "hover:bg-slate-100/90"
              }`}
            >
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {!scopedToStudent ? `${item.student_name} · ` : ""}
                    Unlocks {formatScheduledUnlockLabel(item.scheduled_unlock_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onUnlockNow(item)}
                    title="Unlock now"
                    aria-label="Unlock now"
                    className={`${ROW_ACTION_BUTTON_CLASS} border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 disabled:opacity-60`}
                  >
                    <PadlockIcon open={false} />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleReschedule(item)}
                    aria-label={isRescheduling ? "Close reschedule" : "Reschedule unlock"}
                    aria-pressed={isRescheduling}
                    title={isRescheduling ? "Close reschedule" : "Reschedule"}
                    className={`${ROW_ACTION_BUTTON_CLASS} disabled:opacity-60 ${
                      isRescheduling
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <CalendarTimeIcon />
                  </button>
                </div>
              </div>

              {isRescheduling ? (
                <form
                  onSubmit={(e) => handleSaveReschedule(e, item)}
                  className="px-3.5 py-3.5 mx-1 mb-1 rounded-lg bg-slate-50 flex flex-wrap items-end gap-2.5"
                >
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Date</p>
                    <input
                      type="date"
                      required
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 w-[8.75rem] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Time</p>
                    <input
                      type="time"
                      required
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white pl-2.5 pr-2 py-1.5 text-sm text-slate-900 min-w-[6.85rem] w-[6.85rem] max-w-none box-border focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 [color-scheme:light]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 text-indigo-800 border-0 px-3.5 py-2 text-[13px] font-semibold"
                  >
                    {savingKey === itemKey ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={closeReschedule}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 hover:bg-white/80 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
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
        applyStudentSessionPrefs({ grade: null, curriculum: "" });
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
      applyStudentSessionPrefs({
        grade: switched.grade,
        curriculum: switched.curriculum ?? "",
      });
      window.location.reload();
    } catch {
      setError("Could not switch student.");
      setSwitchingStudent("");
    }
  }

  async function handleUnlockScheduledNow(item) {
    const key = `${item.student_name}-${item.worksheet_id}-sched`;
    const ok = window.confirm(
      `Unlock “${item.title}” for ${item.student_name} now?`,
    );
    if (!ok) return;

    setUnlockingKey(key);
    setError("");
    const current = localStorage.getItem("studentName") || "";
    try {
      if (item.student_name && item.student_name !== current) {
        await handleSelectStudentWithoutReload(item.student_name);
      }
      await clearWorksheetAccessLock(item.worksheet_id);
      await refreshHome();
    } catch (err) {
      setError(err.message || "Could not unlock test.");
    } finally {
      setUnlockingKey("");
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
    applyStudentSessionPrefs({
      grade: switched.grade,
      curriculum: switched.curriculum ?? "",
    });
  }

  const students = data?.students || [];
  const recentActivity = data?.recent_activity || [];
  const recentActivityTotal =
    data?.recent_activity_total ?? recentActivity.length;
  const pending = data?.pending || [];
  const pendingTotal = data?.pending_total ?? pending.length;
  const scheduledTests = data?.scheduled_tests || [];
  const scheduledTestsTotal =
    data?.scheduled_tests_total ?? scheduledTests.length;
  const focusChips = data?.focus_chips || {};
  const selectedStudent = data?.selected_student || localStorage.getItem("studentName") || "";
  const scopedToStudent = Boolean(selectedStudent);
  const activitySectionLabel = scopedToStudent
    ? `Recent activity · ${selectedStudent}`
    : "Recent activity · all students";
  const pendingSectionLabel = scopedToStudent
    ? `Pending · ${selectedStudent}`
    : "Pending";
  const scheduledSectionLabel = scopedToStudent
    ? `Scheduled tests · ${selectedStudent}`
    : "Scheduled tests";

  const scheduledVisible = scheduledTests.slice(0, HOME_SECTION_ITEM_LIMIT);
  const activityVisible = recentActivity.slice(0, HOME_SECTION_ITEM_LIMIT);
  const pendingVisible = pending.slice(0, HOME_SECTION_ITEM_LIMIT);

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
                switchingStudent={switchingStudent}
                plainRows
              />
            </section>

            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
              <div className="flex flex-col gap-5 min-w-0">
                <div>
                  <ScheduledTestsSection
                    label={scheduledSectionLabel}
                    items={scheduledVisible}
                    scopedToStudent={scopedToStudent}
                    unlockingKey={unlockingKey}
                    onUnlockNow={handleUnlockScheduledNow}
                    onScheduleUpdated={refreshHome}
                    onScheduleError={setError}
                  />
                  <SectionMoreHint
                    shown={scheduledVisible.length}
                    total={scheduledTestsTotal}
                    noun="scheduled tests"
                  />
                </div>

                <AdminFocusChipSection
                  chips={focusChips.preview || []}
                  totalCount={focusChips.total_count || 0}
                  showStudentName={!scopedToStudent}
                  onNavigate={handleNavigateForStudent}
                  switchingStudent={switchingStudent}
                />

                <section>
                <SectionLabel>{activitySectionLabel}</SectionLabel>
                {activityVisible.length === 0 ? (
                  <div className="rounded-xl px-4 py-8 text-center text-sm text-slate-500">
                    {scopedToStudent
                      ? `No recent activity for ${selectedStudent} yet.`
                      : "No recent activity yet."}
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {activityVisible.map((item, index) => (
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
                <SectionMoreHint
                  shown={activityVisible.length}
                  total={recentActivityTotal}
                  noun="items"
                />
              </section>
              </div>

              <div className="flex flex-col gap-5">
                <section>
                  <SectionLabel>Quick actions</SectionLabel>
                  <div className="flex flex-col gap-0.5">
                    <Link
                      to="/admin/create/worksheet"
                      className={`${HOME_ROW_CLASS} text-sm font-semibold text-slate-800 block`}
                    >
                      + New worksheet
                    </Link>
                    <Link
                      to="/admin/create/learn"
                      className={`${HOME_ROW_CLASS} text-sm font-semibold text-slate-800 block`}
                    >
                      + New learning resource
                    </Link>
                    <Link
                      to="/admin/create/test"
                      className={`${HOME_ROW_CLASS} text-sm font-semibold text-slate-800 block`}
                    >
                      + New test
                    </Link>
                  </div>
                </section>

                <section>
                  <SectionLabel>{pendingSectionLabel}</SectionLabel>
                  {pendingVisible.length === 0 ? (
                    <div className="rounded-xl px-3.5 py-4 text-sm text-slate-500">
                      {scopedToStudent
                        ? `Nothing waiting for unlock for ${selectedStudent}.`
                        : "Nothing waiting for unlock."}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {pendingVisible.map((item) => {
                        const itemKey = `${item.student_name}-${item.worksheet_id}`;
                        return (
                          <div
                            key={itemKey}
                            className={`${HOME_ROW_CLASS} flex items-start justify-between gap-3`}
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
                  <SectionMoreHint
                    shown={pendingVisible.length}
                    total={pendingTotal}
                    noun="pending items"
                  />
                </section>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
