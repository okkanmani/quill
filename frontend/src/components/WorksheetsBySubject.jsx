import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SubjectBadge from "./SubjectBadge";
import { formatSubjectLabel } from "../subjectUtils";
import ContentBadge from "./ContentBadge";
import AdminResourceCodeLabel from "./AdminResourceCodeLabel";
import { DifficultyStars } from "./DifficultyStars";
import {
  averagePercentAcrossDoneWorksheets,
  isWorksheetDone,
  normalizeSubjectKey,
  subjectSortKey,
} from "../subjectUtils";
import { formatDurationSeconds } from "../worksheetUtils";
import PadlockIcon from "./PadlockIcon";
import { LOCK_STATUS_BADGE_CLASS } from "./rowActionButtonStyles";
import SectionSortSelect from "./SectionSortSelect";
import {
  SECTION_SORT_STATUS,
  sortWorksheetItems,
  WORKSHEET_SORT_OPTIONS,
} from "../sectionSortUtils";
import {
  WS_ADMIN_WORKSHEET_INSET,
  WS_ADMIN_WORKSHEET_ROW,
  WS_CARD_DETAIL,
  WS_CARD_DETAIL_LOOSE,
  WS_CARD_TITLE,
  WS_CARD_TITLE_LOOSE,
  WS_CHEVRON,
  WS_SECTION_META,
  WS_SECTION_TITLE,
} from "../worksheetAdminTypography";

function EditableWorksheetTitleInput({ worksheet, saving, onSave }) {
  const [value, setValue] = useState(worksheet.title || "");

  useEffect(() => {
    setValue(worksheet.title || "");
  }, [worksheet.title, worksheet.id]);

  async function commit() {
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(worksheet.title || "");
      return;
    }
    if (trimmed !== worksheet.title) {
      await onSave(worksheet, trimmed);
    }
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setValue(worksheet.title || "");
          e.currentTarget.blur();
        }
      }}
      disabled={saving}
      aria-label={`Worksheet title for ${worksheet.title}`}
      className={`quill-field-skip w-full min-w-0 rounded-lg border border-transparent bg-transparent px-0 py-0.5 ${WS_CARD_TITLE} hover:border-slate-200 hover:bg-white focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60 transition`}
    />
  );
}

function worksheetLockState(ws) {
  if (isWorksheetDone(ws)) return null;
  if (ws.access_locked) {
    return { kind: "access", reason: ws.lock_reason || "admin" };
  }
  if (ws.timed && ws.timed_locked) {
    return { kind: "timed", reason: "abandoned" };
  }
  if (ws.timed && ws.timed_started) {
    return { kind: "timed", reason: "active" };
  }
  return null;
}

function lockBadgeLabel(state) {
  if (!state) return "";
  if (state.kind === "access") {
    return state.reason === "week"
      ? "This week is locked — complete earlier weeks or ask your teacher"
      : "Locked — ask your teacher to unlock";
  }
  if (state.reason === "abandoned") {
    return "Locked — ask your teacher to unlock";
  }
  return "Timed worksheet in progress";
}

function LockedPadlockBadge({ state }) {
  const label = lockBadgeLabel(state);
  const accessStyle = state.kind === "access";
  return (
    <span
      className={`${LOCK_STATUS_BADGE_CLASS} ${
        accessStyle
          ? "bg-violet-100 border-violet-200 text-violet-700"
          : "bg-amber-100 border-amber-200 text-amber-800"
      }`}
      title={label}
      aria-label={label}
    >
      <PadlockIcon className="w-[14px] h-[14px]" />
    </span>
  );
}

function WorksheetRow({
  ws,
  onOpenWorksheet,
  onOpenTest,
  renderSideAction,
  renderLeadingAction,
  onTitleSave,
  titleSavingId,
}) {
  const lockState = worksheetLockState(ws);
  const accessLocked = Boolean(ws.access_locked) && !isWorksheetDone(ws);
  const timedBlocked = Boolean(ws.timed && ws.timed_locked && !isWorksheetDone(ws));
  const compact = Boolean(renderLeadingAction);
  const adminEditable = Boolean(onTitleSave);
  const savingTitle = titleSavingId === ws.id;

  function handleOpen() {
    if (accessLocked || timedBlocked) return;
    if (ws.is_test && onOpenTest) {
      onOpenTest(ws.id);
      return;
    }
    onOpenWorksheet(ws.id);
  }

  const statusBadges = (
    <>
      {isWorksheetDone(ws) ? (
        <span className="shrink-0 inline-flex items-center gap-2 flex-wrap justify-end">
          {ws.last_status === "pending" ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 border border-amber-200">
              Awaiting review
            </span>
          ) : null}
          {typeof ws.last_score === "number" &&
          typeof ws.last_total === "number" &&
          ws.last_total > 0 &&
          ws.last_status !== "pending" ? (
            <span
              className={
                compact
                  ? "inline-flex items-baseline gap-x-3 text-xs font-semibold text-emerald-950 tabular-nums"
                  : "inline-flex items-baseline gap-x-4 text-sm font-bold text-emerald-950 tabular-nums"
              }
            >
              <span className="shrink-0">Score:</span>
              <span>
                {ws.last_score}/{ws.last_total}
              </span>
              <span>
                {Math.round((ws.last_score / ws.last_total) * 100)}%
              </span>
            </span>
          ) : null}
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
            Done
          </span>
        </span>
      ) : lockState ? (
        <LockedPadlockBadge state={lockState} />
      ) : ws.has_draft ? (
        <span className="shrink-0 inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-900 border border-sky-200">
          Saved progress
        </span>
      ) : null}
    </>
  );

  const titleBlock = adminEditable ? (
    <div className={`min-w-0 flex-1 ${compact ? "p-1.5 pb-1" : "p-5 pb-3"}`}>
      {ws.admin_code ? (
        <AdminResourceCodeLabel code={ws.admin_code} className="mb-1" />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <EditableWorksheetTitleInput
          worksheet={ws}
          saving={savingTitle}
          onSave={onTitleSave}
        />
        {statusBadges}
      </div>
    </div>
  ) : (
    <button
      type="button"
      onClick={handleOpen}
      disabled={accessLocked || timedBlocked}
      className={`flex-1 text-left w-full ${
        compact ? "p-1.5 pb-1" : "p-5 pb-3"
      } ${accessLocked || timedBlocked ? "cursor-not-allowed" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={compact ? WS_CARD_TITLE : WS_CARD_TITLE_LOOSE}>{ws.title}</p>
        {statusBadges}
      </div>
    </button>
  );

  return (
    <div
      className={`flex flex-row items-start min-w-0 ${
        compact ? WS_ADMIN_WORKSHEET_ROW : "gap-2 sm:gap-3"
      }`}
    >
      {renderLeadingAction ? (
        <div className={`shrink-0 self-start ${compact ? "pt-1.5" : "pt-5"}`}>
          {renderLeadingAction(ws)}
        </div>
      ) : null}
      <div
        className={`flex-1 min-w-0 flex flex-col bg-white border rounded-2xl shadow-sm transition overflow-hidden ${
          accessLocked
            ? "border-violet-300 opacity-90"
            : timedBlocked
              ? "border-amber-300 opacity-90"
              : lockState?.kind === "timed"
                ? "border-amber-200"
                : "border-slate-200 hover:shadow-md hover:border-indigo-400"
        }`}
      >
        {titleBlock}
        <div
          role={adminEditable ? "button" : undefined}
          tabIndex={adminEditable && !accessLocked && !timedBlocked ? 0 : undefined}
          onClick={
            adminEditable
              ? (e) => {
                  if (e.target.closest("a")) return;
                  handleOpen();
                }
              : undefined
          }
          onKeyDown={
            adminEditable
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!accessLocked && !timedBlocked) handleOpen();
                  }
                }
              : undefined
          }
          aria-label={
            adminEditable
              ? ws.is_test
                ? `Preview test: ${ws.title}`
                : `Preview worksheet: ${ws.title}`
              : undefined
          }
          className={`flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-slate-100 bg-slate-50/50 ${
            compact ? "px-1.5 py-1" : "px-5 py-3"
          } ${
            adminEditable && !accessLocked && !timedBlocked
              ? "cursor-pointer hover:bg-slate-100/90 transition"
              : adminEditable
                ? "cursor-not-allowed opacity-90"
                : ""
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <ContentBadge label={ws.content_badge} />
            <SubjectBadge subject={ws.subject} />
            <DifficultyStars min={ws.difficulty_min} max={ws.difficulty_max} />
            {ws.timed && ws.time_limit_minutes ? (
              <span className="text-rose-700 text-xs font-semibold rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5">
                {ws.time_limit_minutes} min limit
              </span>
            ) : null}
            {ws.timed && ws.last_duration_seconds != null ? (
              <span className="text-sky-800 text-xs font-semibold rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 tabular-nums">
                Completed in {formatDurationSeconds(ws.last_duration_seconds)}
              </span>
            ) : null}
            <span className={compact ? WS_CARD_DETAIL : WS_CARD_DETAIL_LOOSE}>
              {ws.question_count} questions
            </span>
            {ws.learn_subject ? (
              <Link
                to={`/student/learn/${encodeURIComponent(ws.learn_subject)}${
                  ws.learn_section
                    ? `#${encodeURIComponent(ws.learn_section)}`
                    : ""
                }`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-900 border border-slate-200 hover:bg-slate-200/80 transition"
              >
                {ws.learn_section_title
                  ? `Open: ${ws.learn_section_title}`
                  : "Open Resource"}
              </Link>
            ) : null}
          </div>
          {renderSideAction ? (
            <div
              className="flex items-center gap-1.5 shrink-0 ml-auto"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {renderSideAction(ws)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function groupWorksheets(worksheets) {
  const m = new Map();
  for (const ws of worksheets) {
    const k = normalizeSubjectKey(ws.subject);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(ws);
  }
  return [...m.entries()].sort(
    (a, b) =>
      subjectSortKey(a[0]) - subjectSortKey(b[0]) ||
      a[0].localeCompare(b[0]),
  );
}

/**
 * Accordion by subject, or flat list when ungrouped.
 * renderSideAction(ws) optional (e.g. admin Delete).
 */
export default function WorksheetsBySubject({
  worksheets,
  onOpenWorksheet,
  onOpenTest,
  renderSideAction,
  renderLeadingAction,
  onTitleSave,
  titleSavingId,
  ungrouped = false,
  showSort = false,
  sortSelectId = "worksheets-sort-ungrouped",
  preserveOrder = false,
}) {
  const groups = useMemo(() => groupWorksheets(worksheets), [worksheets]);
  const [open, setOpen] = useState(() => new Set());
  const [sortBySubject, setSortBySubject] = useState({});
  const [ungroupedSort, setUngroupedSort] = useState(SECTION_SORT_STATUS);

  function toggle(subjectKey) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(subjectKey)) next.delete(subjectKey);
      else next.add(subjectKey);
      return next;
    });
  }

  if (ungrouped) {
    if (worksheets.length === 0) return null;
    const sortedWorksheets = preserveOrder
      ? worksheets
      : sortWorksheetItems(
          worksheets,
          showSort ? ungroupedSort : SECTION_SORT_STATUS,
        );
    return (
      <div
        className={`flex flex-col ${
          renderLeadingAction ? `gap-1.5 ${WS_ADMIN_WORKSHEET_INSET}` : "gap-4"
        }`}
      >
        {showSort ? (
          <div className="flex items-center justify-end gap-2 px-1">
            <label
              htmlFor={sortSelectId}
              className="text-xs font-medium text-slate-600"
            >
              Sort
            </label>
            <SectionSortSelect
              id={sortSelectId}
              value={ungroupedSort}
              options={WORKSHEET_SORT_OPTIONS}
              onChange={setUngroupedSort}
            />
          </div>
        ) : null}
        {sortedWorksheets.map((ws) => (
          <WorksheetRow
            key={ws.id}
            ws={ws}
            onOpenWorksheet={onOpenWorksheet}
            onOpenTest={onOpenTest}
            renderSideAction={renderSideAction}
            renderLeadingAction={renderLeadingAction}
            onTitleSave={onTitleSave}
            titleSavingId={titleSavingId}
          />
        ))}
      </div>
    );
  }

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {groups.map(([subjectKey, items]) => {
        const isOpen = open.has(subjectKey);
        const sortMode = sortBySubject[subjectKey] || SECTION_SORT_STATUS;
        const sortedItems = sortWorksheetItems(items, sortMode);
        const total = items.length;
        const done = items.filter(isWorksheetDone).length;
        const pct =
          total > 0 ? Math.round((done / total) * 100) : 0;
        const avgScore = averagePercentAcrossDoneWorksheets(items);
        return (
          <div
            key={subjectKey}
            className="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(subjectKey)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left bg-slate-200/90 hover:bg-slate-200 border-b border-slate-300/80 transition"
            >
              <span className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className={WS_SECTION_TITLE}>
                  {formatSubjectLabel(subjectKey)}
                </span>
                <span className={WS_SECTION_META}>
                  {done}/{total} done
                  {total > 0 ? (
                    <span className="text-slate-500 font-normal">
                      {" "}
                      · {pct}%
                    </span>
                  ) : null}
                  {avgScore ? (
                    <span className="text-slate-600 font-medium">
                      {" "}
                      · avg {avgScore.avgPct}%
                    </span>
                  ) : null}
                </span>
              </span>
              <span className={`${WS_CHEVRON} shrink-0`}>
                {isOpen ? "▼" : "▶"}
              </span>
            </button>
            {isOpen ? (
              <div
                className={`flex flex-col bg-slate-50/40 ${
                  renderLeadingAction
                    ? `gap-1.5 py-2 ${WS_ADMIN_WORKSHEET_INSET}`
                    : "gap-4 p-3"
                }`}
              >
                <div className="flex items-center justify-end gap-2 px-1">
                  <label
                    htmlFor={`worksheets-sort-${subjectKey}`}
                    className="text-xs font-medium text-slate-600"
                  >
                    Sort
                  </label>
                  <SectionSortSelect
                    id={`worksheets-sort-${subjectKey}`}
                    value={sortMode}
                    options={WORKSHEET_SORT_OPTIONS}
                    onChange={(value) =>
                      setSortBySubject((prev) => ({
                        ...prev,
                        [subjectKey]: value,
                      }))
                    }
                  />
                </div>
                {sortedItems.map((ws) => (
                  <WorksheetRow
                    key={ws.id}
                    ws={ws}
                    onOpenWorksheet={onOpenWorksheet}
                    onOpenTest={onOpenTest}
                    renderSideAction={renderSideAction}
                    renderLeadingAction={renderLeadingAction}
                    onTitleSave={onTitleSave}
                    titleSavingId={titleSavingId}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
