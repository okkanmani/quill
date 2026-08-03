import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteCompositeTest,
  listCompositeTests,
  lockCompositeTest,
  unlockCompositeTest,
} from "../api";
import QuillLoading from "./QuillLoading";
import WorksheetLockButton from "./WorksheetLockButton";
import EditActionButton from "./EditActionButton";
import ScheduleActionButton from "./ScheduleActionButton";
import RecycleBinButton from "./RecycleBinButton";
import StatusToast from "./StatusToast";
import { WS_BODY } from "../worksheetAdminTypography";
import { formatSubjectLabel } from "../subjectUtils";
import {
  formatScheduledUnlockLabel,
  isoToLocalDateInput,
  isoToLocalTimeInput,
  localDateAndTimeToIso,
} from "../testSchedulingUtils";
import { useAutoDismissToast, TOAST_AUTO_DISMISS_MS } from "../useAutoDismissToast";

function sectionSummary(sections) {
  if (!sections?.length) return "No sections";
  const subjects = sections.map((s) => formatSubjectLabel(s.subject));
  const unique = [...new Set(subjects)];
  if (unique.length <= 3) return unique.join(" · ");
  return `${unique.slice(0, 2).join(" · ")} +${unique.length - 2} more`;
}

function CompositeTestRow({
  composite,
  locked,
  onToggleLock,
  onDelete,
  onReschedule,
  locking,
  deleting,
  rescheduling,
}) {
  const [scheduleDate, setScheduleDate] = useState(() =>
    isoToLocalDateInput(composite.scheduled_unlock_at),
  );
  const [scheduleTime, setScheduleTime] = useState(() =>
    isoToLocalTimeInput(composite.scheduled_unlock_at),
  );
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    setScheduleDate(isoToLocalDateInput(composite.scheduled_unlock_at));
    setScheduleTime(isoToLocalTimeInput(composite.scheduled_unlock_at));
  }, [composite.scheduled_unlock_at]);

  return (
    <li className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 truncate">{composite.title}</h2>
            {composite.scheduled_unlock_at ? (
              <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
                Unlocks {formatScheduledUnlockLabel(composite.scheduled_unlock_at)}
              </span>
            ) : null}
          </div>
          <p className={`${WS_BODY} mt-1`}>
            {composite.sections?.length || 0} section
            {(composite.sections?.length || 0) === 1 ? "" : "s"} ·{" "}
            {sectionSummary(composite.sections)}
          </p>
          {composite.sections?.length ? (
            <ul className="mt-2 space-y-1">
              {composite.sections.map((section, index) => (
                <li key={section.worksheet_id} className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-500 tabular-nums mr-1.5">
                    {index + 1}.
                  </span>
                  {formatSubjectLabel(section.subject)} · {section.title}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <WorksheetLockButton
            locked={locked}
            onClick={() => onToggleLock(composite)}
            disabled={locking || deleting || rescheduling}
            variant="access"
            label={locked ? "Unlock composite for students" : "Lock composite for students"}
          />
          <EditActionButton
            to={`/admin/create/composite?edit=${encodeURIComponent(composite.id)}`}
            label={`Edit ${composite.title}`}
            disabled={locking || deleting || rescheduling}
          />
          <ScheduleActionButton
            onClick={() => setShowSchedule((open) => !open)}
            disabled={locking || deleting || rescheduling}
            active={showSchedule}
            label={showSchedule ? "Close schedule" : `Schedule unlock for ${composite.title}`}
          />
          <RecycleBinButton
            onClick={() => onDelete(composite)}
            disabled={deleting || locking || rescheduling}
            label={`Delete ${composite.title}`}
          />
        </div>
      </div>

      {showSchedule ? (
        <form
          className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onReschedule(composite, scheduleDate, scheduleTime);
          }}
        >
          <label className="text-xs font-semibold text-slate-600">
            Date
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Time
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
            />
          </label>
          <button
            type="submit"
            disabled={rescheduling || locking || deleting}
            className="rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 transition"
          >
            {rescheduling ? "Saving…" : "Apply schedule"}
          </button>
        </form>
      ) : null}
    </li>
  );
}

export default function AdminTestsCompositePanel() {
  const [composites, setComposites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lockState, setLockState] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [toast, setToast] = useState(null);

  useAutoDismissToast(toast?.message ?? "", () => setToast(null), TOAST_AUTO_DISMISS_MS);

  function showToast(message) {
    setToast({ message });
  }

  const loadComposites = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await listCompositeTests();
      setComposites(rows);
      setLockState((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          if (next[row.id] === undefined) {
            next[row.id] = row.scheduled_unlock_at
              ? new Date(row.scheduled_unlock_at).getTime() > Date.now()
              : false;
          }
        }
        return next;
      });
    } catch (err) {
      setError(err.message || "Failed to load composite tests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComposites();
  }, [loadComposites]);

  function isLocked(composite) {
    return Boolean(lockState[composite.id]);
  }

  async function handleToggleLock(composite) {
    const locked = isLocked(composite);
    setBusyId(composite.id);
    setBusyAction("lock");
    try {
      if (locked) {
        const result = await unlockCompositeTest(composite.id);
        setLockState((prev) => ({ ...prev, [composite.id]: false }));
        showToast(
          `Unlocked “${composite.title}” for ${result.students_affected ?? "your"} students.`,
        );
      } else {
        const result = await lockCompositeTest(composite.id);
        setLockState((prev) => ({ ...prev, [composite.id]: true }));
        showToast(
          `Locked “${composite.title}” for ${result.students_affected ?? "your"} students.`,
        );
      }
      await loadComposites();
    } catch (err) {
      showToast(err.message || "Lock update failed.");
    } finally {
      setBusyId(null);
      setBusyAction("");
    }
  }

  async function handleDelete(composite) {
    const ok = window.confirm(
      `Delete “${composite.title}”? This cannot be undone. Existing student results may remain in the database.`,
    );
    if (!ok) return;

    setBusyId(composite.id);
    setBusyAction("delete");
    try {
      await deleteCompositeTest(composite.id);
      showToast(`Deleted “${composite.title}”.`);
      await loadComposites();
    } catch (err) {
      showToast(err.message || "Delete failed.");
    } finally {
      setBusyId(null);
      setBusyAction("");
    }
  }

  async function handleReschedule(composite, dateStr, timeStr) {
    const unlockAt = localDateAndTimeToIso(dateStr, timeStr);
    if (!unlockAt) {
      showToast("Pick a valid date and time.");
      return;
    }
    if (new Date(unlockAt).getTime() <= Date.now()) {
      showToast("Scheduled unlock must be in the future.");
      return;
    }

    setBusyId(composite.id);
    setBusyAction("schedule");
    try {
      const result = await lockCompositeTest(composite.id, { scheduledUnlockAt: unlockAt });
      setLockState((prev) => ({ ...prev, [composite.id]: true }));
      showToast(
        `Scheduled unlock for “${composite.title}” at ${formatScheduledUnlockLabel(unlockAt)} (${result.students_affected ?? 0} students).`,
      );
      await loadComposites();
    } catch (err) {
      showToast(err.message || "Schedule failed.");
    } finally {
      setBusyId(null);
      setBusyAction("");
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <p className={`${WS_BODY} m-0`}>
          Multi-subject assessments built from your existing subject tests.
        </p>
        <Link
          to="/admin/create/composite"
          className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 transition"
        >
          New composite test
        </Link>
      </div>

      {loading ? <QuillLoading label="Loading composite tests…" /> : null}

      {!loading && error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {!loading && !error && composites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <p className="text-sm text-slate-600 mb-4">
            No composite tests yet. Create one by selecting subject tests to combine.
          </p>
          <Link
            to="/admin/create/composite"
            className="inline-flex rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 transition"
          >
            Create composite test
          </Link>
        </div>
      ) : null}

      {!loading && !error && composites.length > 0 ? (
        <ul className="space-y-3">
          {composites.map((composite) => (
            <CompositeTestRow
              key={composite.id}
              composite={composite}
              locked={isLocked(composite)}
              onToggleLock={handleToggleLock}
              onDelete={handleDelete}
              onReschedule={handleReschedule}
              locking={busyId === composite.id && busyAction === "lock"}
              deleting={busyId === composite.id && busyAction === "delete"}
              rescheduling={busyId === composite.id && busyAction === "schedule"}
            />
          ))}
        </ul>
      ) : null}

      <StatusToast message={toast?.message} />
    </>
  );
}
