import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  createCompositeTest,
  getCompositeTest,
  listEligibleCompositeWorksheets,
  updateCompositeTest,
} from "../api";
import {
  CREATE_BODY,
  CREATE_FIELD_INPUT,
  CREATE_FIELD_LABEL,
  CREATE_FIELD_SELECT,
  CREATE_OUTLINE_BUTTON,
  CREATE_PUBLISH_BUTTON,
} from "../createTypography";
import QuillLoading from "./QuillLoading";
import { formatSubjectLabel } from "../subjectUtils";
import { BUILDER_SUBJECTS } from "../questionBuilderUtils";
import {
  defaultScheduledUnlockLocalInput,
  formatScheduledUnlockLabel,
  isoToLocalDatetimeInput,
  localDatetimeInputToIso,
} from "../testSchedulingUtils";

function groupBySubject(worksheets) {
  const groups = new Map();
  for (const ws of worksheets) {
    const key = ws.subject || "general";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ws);
  }
  return [...groups.entries()].sort(([a], [b]) =>
    formatSubjectLabel(a).localeCompare(formatSubjectLabel(b)),
  );
}

function formatTestOption(ws) {
  const parts = [ws.title];
  if (ws.time_limit_minutes) parts.push(`${ws.time_limit_minutes} min`);
  if (ws.test_adaptive) parts.push("adaptive");
  return parts.join(" · ");
}

function sectionMinutes(ws) {
  return ws?.time_limit_minutes ? Number(ws.time_limit_minutes) : 0;
}

function SubjectStatusBadge({ selected }) {
  if (selected) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
        Selected
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
      Not included
    </span>
  );
}

function OrderPill({ ws, index, dragging, onDragStart, onDragEnd }) {
  return (
    <span
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`inline-flex cursor-grab items-center rounded-full border bg-white px-2.5 py-1 text-[13px] font-medium text-slate-800 active:cursor-grabbing ${
        dragging
          ? "border-indigo-300 opacity-60"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {index + 1}. {formatSubjectLabel(ws.subject)} · {sectionMinutes(ws) || "—"} min
    </span>
  );
}

function allowDrop(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

export default function CompositeTestBuilderPanel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit")?.trim() || "";

  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState([]);
  const [title, setTitle] = useState("");
  const [selectedBySubject, setSelectedBySubject] = useState({});
  const [sectionOrder, setSectionOrder] = useState([]);
  const [availabilityMode, setAvailabilityMode] = useState("now");
  const [scheduledUnlockLocal, setScheduledUnlockLocal] = useState(
    defaultScheduledUnlockLocalInput,
  );
  const [errors, setErrors] = useState([]);
  const [notice, setNotice] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [dragSubject, setDragSubject] = useState(null);
  const dragSubjectRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrors([]);

    async function load() {
      try {
        const worksheets = await listEligibleCompositeWorksheets();
        if (cancelled) return;
        setEligible(worksheets);

        if (editId) {
          const composite = await getCompositeTest(editId);
          if (cancelled) return;
          setTitle(composite.title || "");
          const nextSelected = {};
          const nextOrder = [];
          for (const section of (composite.sections || []).slice().sort(
            (a, b) => a.sort_order - b.sort_order,
          )) {
            const subjectKey = section.subject || "general";
            nextSelected[subjectKey] = section.worksheet_id;
            if (!nextOrder.includes(subjectKey)) {
              nextOrder.push(subjectKey);
            }
          }
          setSelectedBySubject(nextSelected);
          setSectionOrder(nextOrder);
          if (composite.scheduled_unlock_at) {
            setAvailabilityMode("scheduled");
            setScheduledUnlockLocal(isoToLocalDatetimeInput(composite.scheduled_unlock_at));
          } else {
            setAvailabilityMode("now");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setErrors([err.message || "Failed to load composite test builder."]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const eligibleById = useMemo(
    () => new Map(eligible.map((ws) => [ws.id, ws])),
    [eligible],
  );

  const groupedEligible = useMemo(() => groupBySubject(eligible), [eligible]);

  const subjectRows = useMemo(() => {
    const testsBySubject = new Map(groupedEligible);
    const rows = BUILDER_SUBJECTS.map(({ value }) => [value, testsBySubject.get(value) || []]);
    for (const [subjectKey, items] of groupedEligible) {
      if (!BUILDER_SUBJECTS.some((subject) => subject.value === subjectKey)) {
        rows.push([subjectKey, items]);
      }
    }
    return rows;
  }, [groupedEligible]);

  const selectedSections = useMemo(
    () =>
      sectionOrder
        .map((subjectKey) => {
          const worksheetId = selectedBySubject[subjectKey];
          if (!worksheetId) return null;
          return eligibleById.get(worksheetId) || null;
        })
        .filter(Boolean),
    [sectionOrder, selectedBySubject, eligibleById],
  );

  const totalMinutes = useMemo(
    () => selectedSections.reduce((sum, ws) => sum + sectionMinutes(ws), 0),
    [selectedSections],
  );

  function selectSubjectTest(subjectKey, worksheetId) {
    if (!worksheetId) {
      setSelectedBySubject((prev) => {
        const next = { ...prev };
        delete next[subjectKey];
        return next;
      });
      setSectionOrder((prev) => prev.filter((key) => key !== subjectKey));
      return;
    }

    setSelectedBySubject((prev) => ({ ...prev, [subjectKey]: worksheetId }));
    setSectionOrder((prev) => (prev.includes(subjectKey) ? prev : [...prev, subjectKey]));
  }

  function orderedWorksheetIds() {
    return sectionOrder
      .map((subjectKey) => selectedBySubject[subjectKey])
      .filter(Boolean);
  }

  function handleDragStart(subjectKey, event) {
    dragSubjectRef.current = subjectKey;
    setDragSubject(subjectKey);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", subjectKey);
  }

  function handleDrop(targetSubjectKey, event) {
    event.preventDefault();
    const source = dragSubjectRef.current;
    if (!source || source === targetSubjectKey) return;
    setSectionOrder((prev) => {
      const fromIndex = prev.indexOf(source);
      const toIndex = prev.indexOf(targetSubjectKey);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, source);
      return next;
    });
    dragSubjectRef.current = null;
    setDragSubject(null);
  }

  function handleDragEnd() {
    dragSubjectRef.current = null;
    setDragSubject(null);
  }

  function validate() {
    const nextErrors = [];
    if (!title.trim()) nextErrors.push("Title is required.");
    if (orderedWorksheetIds().length < 2) {
      nextErrors.push("Select at least two subject tests.");
    }
    if (availabilityMode === "scheduled") {
      const scheduledUnlockAt = localDatetimeInputToIso(scheduledUnlockLocal);
      if (!scheduledUnlockAt) {
        nextErrors.push("Pick a valid date and time for scheduled unlock.");
      } else if (new Date(scheduledUnlockAt).getTime() <= Date.now()) {
        nextErrors.push("Scheduled unlock must be in the future.");
      }
    }
    setErrors(nextErrors);
    return nextErrors.length === 0;
  }

  async function handlePublish() {
    setErrors([]);
    setNotice("");
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setPublishing(true);
    try {
      let scheduledUnlockAt = null;
      if (availabilityMode === "scheduled") {
        scheduledUnlockAt = localDatetimeInputToIso(scheduledUnlockLocal);
      }

      const payload = {
        title: title.trim(),
        section_worksheet_ids: orderedWorksheetIds(),
      };

      if (scheduledUnlockAt) {
        payload.scheduled_unlock_at = scheduledUnlockAt;
      } else if (editId && availabilityMode === "now") {
        payload.unlock_students_now = true;
      }

      const result = editId
        ? await updateCompositeTest(editId, payload)
        : await createCompositeTest(payload);

      const lockNote = scheduledUnlockAt
        ? ` Scheduled unlock ${formatScheduledUnlockLabel(scheduledUnlockAt)} for your students.`
        : availabilityMode === "now" && editId
          ? " Unlocked for students now."
          : availabilityMode === "now" && !editId
            ? " Available to students now."
            : "";

      setNotice(
        editId
          ? `Saved “${result.title}” (${result.sections?.length || 0} sections).${lockNote}`
          : `Created “${result.title}” with ${result.sections?.length || 0} sections.${lockNote}`,
      );

      if (!editId) {
        navigate(`/admin/create/composite?edit=${encodeURIComponent(result.id)}`, {
          replace: true,
        });
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrors([err.message || "Could not save composite test."]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return <QuillLoading page label="Loading composite test builder…" />;
  }

  return (
    <div className="flex max-w-[640px] flex-col gap-[18px]">
      <div>
        <h2 className="mb-1 text-xl font-bold text-slate-950">
          {editId ? "Edit composite test" : "New composite test"}
        </h2>
        <p className="m-0 text-[13px] leading-relaxed text-slate-500">
          Pick one test per subject to combine into a single sitting (at least two subjects).
        </p>
      </div>

      {errors.length ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <ul className="list-disc space-y-1 pl-5">
            {errors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          {notice}
        </div>
      ) : null}

      <label className={CREATE_FIELD_LABEL}>
        Title
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Spring benchmark"
          className={CREATE_FIELD_INPUT}
        />
      </label>

      {eligible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center text-sm text-slate-500">
          No subject tests yet — use <strong>+ Add</strong> below to create one for each subject you
          want to include.
        </p>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {subjectRows.map(([subjectKey, items]) => {
          const selectedId = selectedBySubject[subjectKey] || "";
          const selected = Boolean(selectedId);
          const hasTests = items.length > 0;

          return (
            <div
              key={subjectKey}
              className={`rounded-xl px-[18px] py-3.5 ${
                selected
                  ? "border border-slate-300 bg-white"
                  : "border border-dashed border-slate-300 opacity-70"
              }`}
            >
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <p className="m-0 text-sm font-semibold text-slate-900">
                  {formatSubjectLabel(subjectKey)}
                </p>
                <SubjectStatusBadge selected={selected} />
              </div>

              {hasTests ? (
                <select
                  value={selectedId}
                  onChange={(e) => selectSubjectTest(subjectKey, e.target.value)}
                  className={`${CREATE_FIELD_SELECT} mt-0`}
                >
                  <option value="">Not included</option>
                  {items.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {formatTestOption(ws)}
                    </option>
                  ))}
                </select>
              ) : (
                <Link
                  to="/admin/create/test"
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-[13px] font-semibold text-slate-800 hover:bg-slate-50 transition"
                >
                  + Add a {formatSubjectLabel(subjectKey)} test
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {selectedSections.length > 0 ? (
        <div className="rounded-xl bg-slate-50 px-[18px] py-3.5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Section order &amp; timing
          </p>
          <div
            className="flex flex-wrap items-center gap-2"
            onDragOver={allowDrop}
          >
            {selectedSections.map((ws, index) => {
              const subjectKey = ws.subject || "general";
              return (
                <div
                  key={ws.id}
                  className="flex items-center gap-2"
                  onDragOver={allowDrop}
                  onDrop={(event) => handleDrop(subjectKey, event)}
                >
                  {index > 0 ? (
                    <span
                      className="text-sm text-slate-400 select-none"
                      aria-hidden="true"
                      onDragOver={allowDrop}
                      onDrop={(event) => handleDrop(subjectKey, event)}
                    >
                      →
                    </span>
                  ) : null}
                  <OrderPill
                    ws={ws}
                    index={index}
                    dragging={dragSubject === subjectKey}
                    onDragStart={(event) => handleDragStart(subjectKey, event)}
                    onDragEnd={handleDragEnd}
                  />
                </div>
              );
            })}
          </div>
          <p className="mb-0 mt-2 text-xs text-slate-500">
            Total: {totalMinutes} min · drag to reorder
          </p>
        </div>
      ) : null}

      <details className="rounded-xl border border-slate-200 bg-white px-[18px] py-3.5">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Availability
        </summary>
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="composite-availability"
                checked={availabilityMode === "now"}
                onChange={() => setAvailabilityMode("now")}
                className="text-indigo-600"
              />
              {editId ? "Unlock for students now" : "Publish and unlock now"}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="composite-availability"
                checked={availabilityMode === "scheduled"}
                onChange={() => setAvailabilityMode("scheduled")}
                className="text-indigo-600"
              />
              Schedule unlock for later
            </label>
          </div>
          {availabilityMode === "scheduled" ? (
            <div>
              <input
                type="datetime-local"
                value={scheduledUnlockLocal}
                onChange={(e) => setScheduledUnlockLocal(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <p className={`${CREATE_BODY} mt-2 text-xs`}>
                Composite and its subject tests stay locked until this time.
              </p>
            </div>
          ) : null}
        </div>
      </details>

      <div className="flex justify-end gap-2.5 pt-1">
        <Link to="/admin/tests?tab=composite" className={CREATE_OUTLINE_BUTTON}>
          Cancel
        </Link>
        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing}
          className={CREATE_PUBLISH_BUTTON}
        >
          {publishing
            ? "Saving…"
            : editId
              ? "Save composite test"
              : "Create composite test"}
        </button>
      </div>
    </div>
  );
}
