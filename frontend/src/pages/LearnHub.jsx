import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  deleteLearnSection,
  getAdminLearnSections,
  getLearnSubject,
  getLearnSubjects,
  reorderLearnHubCollections,
  reorderLearnSections,
  updateLearnSection,
} from "../api";
import EditActionButton from "../components/EditActionButton";
import {
  groupSectionsByTopic,
  learnSectionReaderUrl,
  mergeTopicSectionOrder,
} from "../learnTopics";
import {
  curriculumKey,
  filterHubEntriesByGradeAndCurriculum,
  flattenHubSubjects,
  learnHubCollectionBlurb,
  learnHubSearchParams,
  learnSubjectCurriculum,
  learnSubjectGrade,
  preferredStudentCurriculum,
  resolveLearnHubCurriculum,
  resolveLearnHubGrade,
  sortedCurriculaFromSubjects,
  sortedGradesFromSubjects,
  subjectMatchesCurriculum,
} from "../learnHubGrades";

import { useAutoDismissToast } from "../useAutoDismissToast";
import LearnChrome from "../components/LearnChrome";
import QuillLoading from "../components/QuillLoading";
import StatusToast from "../components/StatusToast";
import RecycleBinButton from "../components/RecycleBinButton";
import CollapsibleSectionHeader from "../components/CollapsibleSectionHeader";
import {
  HUB_ROW_CARD,
  HUB_ROW_CARD_INTERACTIVE,
  HUB_ROW_FOOTER,
  HUB_ROW_TITLE_BLOCK,
  HUB_TOP_BODY,
  HUB_TOP_HEADER,
  HUB_TOP_SHELL,
} from "../hubSectionStyles";
import {
  WS_CARD_DETAIL,
  WS_CARD_TITLE,
  WS_SECTION_TITLE,
} from "../worksheetAdminTypography";
import {
  LEARN_BODY,
  LEARN_BODY_RELAXED,
  LEARN_DIALOG_TITLE,
  LEARN_ERROR,
  LEARN_EYEBROW_STRONG,
  LEARN_FILTER_LABEL,
  LEARN_HINT,
  LEARN_LINK,
  LEARN_PAGE_HEADING,
  LEARN_PAGE_INTRO,
  LEARN_ROW_META,
  LEARN_ROW_META_MUTED,
} from "../learnTypography";

function EditableSectionTitleInput({ section, saving, onSave }) {
  const [value, setValue] = useState(section.title || "");

  useEffect(() => {
    setValue(section.title || "");
  }, [section.title]);

  async function commit() {
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(section.title || "");
      return;
    }
    if (trimmed !== section.title) {
      await onSave(section, trimmed);
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
          setValue(section.title || "");
          e.currentTarget.blur();
        }
      }}
      disabled={saving}
      aria-label={`Section title for ${section.title}`}
      className={`w-full min-w-0 rounded-lg border border-transparent bg-transparent px-0 py-0.5 ${WS_CARD_TITLE} hover:border-slate-200 hover:bg-white focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60 transition`}
    />
  );
}

function DeleteConfirmDialog({ section, deleting, onCancel, onConfirm }) {
  if (!section) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-slate-900/40"
        aria-label="Close delete confirmation"
        onClick={deleting ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-learn-title"
        className="fixed left-1/2 top-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h2 id="delete-learn-title" className={LEARN_DIALOG_TITLE}>
          Delete learning resource?
        </h2>
        <p className={`${LEARN_BODY_RELAXED} mt-2`}>
          Delete “{section.title}” from {section.subject_title}? This cannot be
          undone.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 text-sm font-semibold transition"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </>
  );
}

function PublishedResourceRow({
  section,
  deleting,
  onDelete,
  onTitleSave,
  titleSavingKey,
  compact = false,
}) {
  const learnUrl = learnSectionReaderUrl(section);
  const editUrl = `/admin/create/learn/edit/${encodeURIComponent(section.subject_key)}/${encodeURIComponent(section.section_id)}`;
  const isAdmin = Boolean(onTitleSave);
  const savingTitle =
    titleSavingKey === `${section.subject_key}:${section.section_id}`;
  const collectionBlurb = learnHubCollectionBlurb(section.subject_description);

  const adminActions = isAdmin ? (
    <>
      <EditActionButton
        to={editUrl}
        label={`Edit ${section.title}`}
        disabled={Boolean(deleting)}
      />
      <RecycleBinButton
        onClick={() => onDelete(section)}
        label={`Delete ${section.title}`}
        disabled={Boolean(deleting)}
      />
    </>
  ) : null;

  return (
    <div className={`${HUB_ROW_CARD} ${!isAdmin ? HUB_ROW_CARD_INTERACTIVE : ""}`}>
      {isAdmin ? (
        <>
          <div className={HUB_ROW_TITLE_BLOCK}>
            <EditableSectionTitleInput
              section={section}
              saving={savingTitle}
              onSave={onTitleSave}
            />
            {!compact && section.subject_title ? (
              <p className={`${LEARN_ROW_META} mt-1`}>{section.subject_title}</p>
            ) : null}
            {!compact && collectionBlurb ? (
              <p className={`${LEARN_ROW_META_MUTED} mt-0.5`}>{collectionBlurb}</p>
            ) : null}
          </div>
          <div className={HUB_ROW_FOOTER}>
            <Link to={learnUrl} className={LEARN_LINK}>
              View resource
            </Link>
            {adminActions ? (
              <div
                className="flex items-center gap-1.5 shrink-0 ml-auto"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {adminActions}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <Link to={learnUrl} className={`block ${HUB_ROW_TITLE_BLOCK}`}>
            <p className={WS_CARD_TITLE}>{section.title}</p>
            {!compact && section.subject_title ? (
              <p className={`${LEARN_ROW_META} mt-1`}>{section.subject_title}</p>
            ) : null}
            {!compact && collectionBlurb ? (
              <p className={`${LEARN_ROW_META_MUTED} mt-0.5`}>{collectionBlurb}</p>
            ) : null}
          </Link>
          {!compact && section.subject_title ? (
            <div className={HUB_ROW_FOOTER}>
              <span className={WS_CARD_DETAIL}>Learning resource</span>
            </div>
          ) : compact ? (
            <div className={HUB_ROW_FOOTER}>
              <span className={WS_CARD_DETAIL}>Open to read</span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function reorderList(items, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function reorderPublishedSections(flatList, subjectKey, orderedSections) {
  const result = [];
  let inserted = false;
  for (const section of flatList) {
    if (section.subject_key === subjectKey) {
      if (!inserted) {
        result.push(...orderedSections);
        inserted = true;
      }
      continue;
    }
    result.push(section);
  }
  if (!inserted) {
    result.push(...orderedSections);
  }
  return result;
}

function SortableSectionList({
  subjectKey,
  sections,
  reorderingSubjectKey,
  onReorder,
  renderSection,
}) {
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const busy = reorderingSubjectKey === subjectKey;

  if (sections.length < 2) {
    return sections.map((section) => renderSection(section));
  }

  async function finishDrop(targetIndex) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const ordered = reorderList(sections, dragIndex, targetIndex);
    setDragIndex(null);
    setDropIndex(null);
    await onReorder(subjectKey, ordered);
  }

  return sections.map((section, index) => (
    <div
      key={`${section.subject_key}-${section.section_id}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (dragIndex !== null && dragIndex !== index) setDropIndex(index);
      }}
      onDragLeave={() => {
        if (dropIndex === index) setDropIndex(null);
      }}
      onDrop={(event) => {
        event.preventDefault();
        finishDrop(index);
      }}
      className={`flex gap-2 sm:gap-3 transition-opacity ${
        dragIndex === index ? "opacity-40" : ""
      } ${dropIndex === index ? "ring-2 ring-indigo-300 ring-offset-2 rounded-2xl" : ""}`}
    >
      <div className="flex items-start justify-center shrink-0 pt-5">
        <button
          type="button"
          aria-label={`Drag to reorder ${section.title}`}
          draggable={!busy}
          onDragStart={(event) => {
            setDragIndex(index);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", section.section_id);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setDropIndex(null);
          }}
          className="cursor-grab active:cursor-grabbing rounded-lg border border-slate-200 bg-white px-1.5 py-2.5 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition touch-none disabled:opacity-40"
          disabled={busy}
        >
          <span aria-hidden className="block text-sm leading-none tracking-tighter">
            ⋮⋮
          </span>
        </button>
      </div>
      <div className="flex-1 min-w-0">{renderSection(section)}</div>
    </div>
  ));
}

function SortableSubjectList({
  scope,
  subjects,
  reorderingScope,
  onReorder,
  renderSubject,
}) {
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  if (subjects.length < 2) {
    return subjects.map((subject) => renderSubject(subject));
  }

  async function finishDrop(targetIndex) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const ordered = reorderList(subjects, dragIndex, targetIndex);
    setDragIndex(null);
    setDropIndex(null);
    await onReorder(scope, ordered);
  }

  return subjects.map((subject, index) => (
    <div
      key={subject.key}
      onDragOver={(event) => {
        event.preventDefault();
        if (dragIndex !== null && dragIndex !== index) setDropIndex(index);
      }}
      onDragLeave={() => {
        if (dropIndex === index) setDropIndex(null);
      }}
      onDrop={(event) => {
        event.preventDefault();
        finishDrop(index);
      }}
      className={`flex gap-3 transition-opacity ${
        dragIndex === index ? "opacity-40" : ""
      } ${dropIndex === index ? "ring-2 ring-indigo-300 ring-offset-2 rounded-2xl" : ""}`}
    >
      <div className="flex items-start justify-center shrink-0 pt-4">
        <button
          type="button"
          aria-label={`Drag to reorder ${subject.title}`}
          draggable={reorderingScope !== scope}
          onDragStart={(event) => {
            setDragIndex(index);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", subject.key);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setDropIndex(null);
          }}
          className="cursor-grab active:cursor-grabbing rounded-lg border border-slate-200 bg-white px-2 py-3 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition touch-none"
        >
          <span aria-hidden className="block text-base leading-none tracking-tighter">
            ⋮⋮
          </span>
        </button>
      </div>
      <div className="flex-1 min-w-0">{renderSubject(subject)}</div>
    </div>
  ));
}

function TopicGroupShell({ subjectKey, group, collapsed, onToggle, children }) {
  const open = !collapsed;
  const meta = `${group.sections.length} resource${
    group.sections.length === 1 ? "" : "s"
  }`;

  return (
    <div className="min-w-0">
      <CollapsibleSectionHeader
        title={group.label}
        meta={meta}
        open={open}
        onToggle={() => onToggle(subjectKey, group.id)}
        smallChevron
      />
      {open ? (
        <div className="flex flex-col gap-1.5 pt-1">{children}</div>
      ) : null}
    </div>
  );
}

function SubjectCard({
  subject,
  publishedSections = [],
  isAdmin,
  deleting,
  onDelete,
  onTitleSave,
  titleSavingKey,
  reorderingSectionsSubjectKey,
  onReorderSections,
  expandedTopics = new Set(),
  onToggleTopic = () => {},
}) {
  const collectionBlurb = learnHubCollectionBlurb(subject.description);

  const renderPublishedRow = (section) => (
    <PublishedResourceRow
      key={`${section.subject_key}-${section.section_id}`}
      section={section}
      deleting={deleting}
      onDelete={isAdmin ? onDelete : undefined}
      onTitleSave={onTitleSave}
      titleSavingKey={titleSavingKey}
      compact
    />
  );

  if (publishedSections.length > 0) {
    const sectionMeta = `${publishedSections.length} resource${
      publishedSections.length === 1 ? "" : "s"
    }`;

    return (
      <div className={HUB_TOP_SHELL}>
        <div className={HUB_TOP_HEADER}>
          <p className={WS_SECTION_TITLE}>{subject.title}</p>
          {collectionBlurb ? (
            <p className={`${LEARN_BODY} mt-1 leading-relaxed line-clamp-3`}>
              {collectionBlurb}
            </p>
          ) : null}
          <p className={`${WS_CARD_DETAIL} mt-1 tabular-nums`}>{sectionMeta}</p>
        </div>
        <div className={`${HUB_TOP_BODY} gap-3`}>
          {isAdmin && publishedSections.length >= 2 ? (
            <p className={`${LEARN_HINT} -mb-0.5`}>
              Drag ⋮⋮ to reorder sections within each topic
            </p>
          ) : null}
          {groupSectionsByTopic(publishedSections).map((group) => {
            const collapsed = !expandedTopics.has(`${subject.key}:${group.id}`);
            return (
              <TopicGroupShell
                key={`${subject.key}-${group.id}`}
                subjectKey={subject.key}
                group={group}
                collapsed={collapsed}
                onToggle={onToggleTopic}
              >
                <div className="flex flex-col gap-1.5">
                  {isAdmin && group.sections.length >= 2 ? (
                    <SortableSectionList
                      subjectKey={subject.key}
                      sections={group.sections}
                      reorderingSubjectKey={reorderingSectionsSubjectKey}
                      onReorder={(sk, ordered) =>
                        onReorderSections(sk, ordered, group.id)
                      }
                      renderSection={renderPublishedRow}
                    />
                  ) : (
                    group.sections.map((section) => renderPublishedRow(section))
                  )}
                </div>
              </TopicGroupShell>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={HUB_TOP_SHELL}>
      <div className={HUB_TOP_HEADER}>
        <p className={WS_SECTION_TITLE}>{subject.title}</p>
        {collectionBlurb ? (
          <p className={`${LEARN_BODY} mt-1 leading-relaxed line-clamp-3`}>
            {collectionBlurb}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function collectHubSubjectKeys(entries) {
  const keys = new Set();
  for (const entry of entries) {
    if (entry.type === "subject") keys.add(entry.key);
    else entry.subjects?.forEach((subject) => keys.add(subject.key));
  }
  return Array.from(keys);
}

async function discoverSubjectSections(entries, { dbOnly = false } = {}) {
  const keys = collectHubSubjectKeys(entries);
  const sections = [];
  await Promise.all(
    keys.map(async (key) => {
      try {
        const data = await getLearnSubject(key);
        for (const sec of data.sections || []) {
          if (dbOnly && sec.source !== "db") continue;
          sections.push({
            subject_key: data.key,
            section_id: sec.id,
            title: sec.title,
            group_id: sec.group_id,
            group_title: sec.group_title,
            subject_title: data.title,
            subject_description: data.description || "",
            subject_grade: data.grade ?? learnSubjectGrade({ key: data.key, title: data.title, description: data.description }),
            subject_curriculum:
              data.curriculum ??
              learnSubjectCurriculum({
                key: data.key,
                title: data.title,
                description: data.description,
              }),
          });
        }
      } catch {
        /* subject may have been removed */
      }
    }),
  );
  return sections;
}

function HubFilterDropdown({
  label,
  ariaLabel,
  value,
  options,
  onChange,
  formatOption = (v) => String(v),
  optionKey = (v) => String(v),
  isSelected = (a, b) => a === b,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const triggerClass =
    "mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 flex items-center justify-between gap-1 text-left";

  return (
    <div className="block w-full max-w-[9rem] text-xs">
      <span className={LEARN_FILTER_LABEL}>
        {label}
      </span>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((prev) => !prev)}
          className={triggerClass}
        >
          <span className="truncate">{formatOption(value)}</span>
          <span className="shrink-0 text-[10px] text-slate-500" aria-hidden>
            ▾
          </span>
        </button>
        {open ? (
          <ul
            role="listbox"
            aria-label={ariaLabel}
            className="absolute left-0 right-0 top-full z-30 mt-0.5 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white py-0.5 shadow-lg"
          >
            {options.map((option) => {
              const selected = isSelected(option, value);
              return (
                <li key={optionKey(option)} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 text-xs text-left transition ${
                      selected
                        ? "bg-indigo-50 text-indigo-900 font-semibold"
                        : "text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    {formatOption(option)}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function LearnHubFilterNav({
  grades,
  activeGrade,
  curricula,
  activeCurriculum,
  onGradeChange,
  onCurriculumChange,
}) {
  if (!grades.length && !curricula.length) return null;

  const gradeValue = activeGrade ?? grades[0];
  const curriculumValue = activeCurriculum ?? curricula[0];

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 pb-1">
      {grades.length > 0 ? (
        <HubFilterDropdown
          label="Grade"
          ariaLabel="Grade"
          value={gradeValue}
          options={grades}
          onChange={onGradeChange}
          formatOption={(grade) => `Grade ${grade}`}
        />
      ) : null}
      {curricula.length > 0 ? (
        <HubFilterDropdown
          label="Curriculum"
          ariaLabel="Curriculum"
          value={curriculumValue}
          options={curricula}
          onChange={onCurriculumChange}
          formatOption={(curriculum) => curriculum}
          optionKey={(curriculum) => curriculumKey(curriculum)}
          isSelected={(a, b) => curriculumKey(a) === curriculumKey(b)}
        />
      ) : null}
    </div>
  );
}

export default function LearnHub() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState([]);
  const [publishedSections, setPublishedSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminSectionsError, setAdminSectionsError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  useAutoDismissToast(statusMessage, setStatusMessage);
  const [deleting, setDeleting] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [titleSavingKey, setTitleSavingKey] = useState(null);
  const [reorderingScope, setReorderingScope] = useState(null);
  const [reorderingSectionsSubjectKey, setReorderingSectionsSubjectKey] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set(["math"]));
  const [expandedTopics, setExpandedTopics] = useState(() => new Set());
  const isAdmin = localStorage.getItem("role") === "admin";

  function toggleTopicCollapse(subjectKey, topicId) {
    const key = `${subjectKey}:${topicId}`;
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function loadHub() {
    setLoading(true);
    setError("");
    setAdminSectionsError("");
    try {
      const subjectData = await getLearnSubjects();
      const hubEntries = subjectData.entries || [];
      setEntries(hubEntries);

      if (isAdmin) {
        let sections = subjectData.editable_sections || [];
        if (sections.length === 0) {
          try {
            const adminData = await getAdminLearnSections();
            sections = adminData?.sections || [];
          } catch {
            /* fall through to per-subject discovery */
          }
        }
        if (sections.length === 0) {
          sections = await discoverSubjectSections(hubEntries, { dbOnly: true });
        }
        setPublishedSections(sections);
      } else {
        const sections = await discoverSubjectSections(hubEntries);
        setPublishedSections(sections);
      }
    } catch {
      setError("Could not load learning topics.");
      setEntries([]);
      setPublishedSections([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHub();
  }, [isAdmin]);

  useEffect(() => {
    if (loading || error || !isAdmin) return;
    if (entries.length === 0 && publishedSections.length === 0) {
      navigate("/admin/create/learn", { replace: true });
    }
  }, [loading, error, isAdmin, entries.length, publishedSections.length, navigate]);

  const publishedBySubjectKey = useMemo(() => {
    const map = new Map();
    for (const section of publishedSections) {
      const key = section.subject_key;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(section);
    }
    return map;
  }, [publishedSections]);

  const orphanPublishedSections = useMemo(() => {
    const hubKeys = new Set();
    for (const entry of entries) {
      if (entry.type === "subject") hubKeys.add(entry.key);
      else entry.subjects?.forEach((subject) => hubKeys.add(subject.key));
    }
    return publishedSections.filter((section) => !hubKeys.has(section.subject_key));
  }, [entries, publishedSections]);

  const orphanGroups = useMemo(() => {
    const map = new Map();
    for (const section of orphanPublishedSections) {
      const key = section.subject_key;
      if (!map.has(key)) {
        map.set(key, {
          subjectKey: key,
          subjectTitle: section.subject_title || key,
          sections: [],
        });
      }
      map.get(key).sections.push(section);
    }
    return Array.from(map.values());
  }, [orphanPublishedSections]);

  const subjectGradeByKey = useMemo(() => {
    const map = new Map();
    for (const subject of flattenHubSubjects(entries)) {
      map.set(subject.key, learnSubjectGrade(subject));
    }
    for (const section of publishedSections) {
      if (map.has(section.subject_key)) continue;
      const fromSection =
        section.subject_grade ??
        learnSubjectGrade({
          key: section.subject_key,
          title: section.subject_title,
          description: section.subject_description,
        });
      if (fromSection > 0) map.set(section.subject_key, fromSection);
    }
    return map;
  }, [entries, publishedSections]);

  const subjectCurriculumByKey = useMemo(() => {
    const map = new Map();
    for (const subject of flattenHubSubjects(entries)) {
      const label = learnSubjectCurriculum(subject);
      if (label) map.set(subject.key, label);
    }
    for (const section of publishedSections) {
      if (map.has(section.subject_key)) continue;
      const label =
        section.subject_curriculum ??
        learnSubjectCurriculum({
          key: section.subject_key,
          title: section.subject_title,
          description: section.subject_description,
        });
      if (label) map.set(section.subject_key, label);
    }
    return map;
  }, [entries, publishedSections]);

  const availableGrades = useMemo(() => {
    const subjects = flattenHubSubjects(entries);
    const grades = sortedGradesFromSubjects(subjects);
    const fromOrphans = new Set(grades);
    for (const grade of subjectGradeByKey.values()) {
      if (grade > 0) fromOrphans.add(grade);
    }
    return [...fromOrphans].sort((a, b) => a - b);
  }, [entries, subjectGradeByKey]);

  const activeGrade = useMemo(() => {
    const param = searchParams.get("grade");
    if (!param || !String(param).trim()) {
      return resolveLearnHubGrade(null, availableGrades);
    }
    return resolveLearnHubGrade(param, availableGrades);
  }, [searchParams, availableGrades]);

  const gradeFilteredSubjects = useMemo(() => {
    const all = flattenHubSubjects(entries);
    if (activeGrade == null) return all;
    return all.filter((subject) => learnSubjectGrade(subject) === activeGrade);
  }, [entries, activeGrade]);

  const availableCurricula = useMemo(
    () => sortedCurriculaFromSubjects(gradeFilteredSubjects),
    [gradeFilteredSubjects],
  );

  const activeCurriculum = useMemo(() => {
    const param = searchParams.get("curriculum");
    const preferred = preferredStudentCurriculum();
    if (!param || !String(param).trim()) {
      return resolveLearnHubCurriculum(null, availableCurricula, preferred);
    }
    return resolveLearnHubCurriculum(param, availableCurricula, preferred);
  }, [searchParams, availableCurricula]);

  useEffect(() => {
    if (loading) return;
    const next = new URLSearchParams(searchParams);
    let changed = false;

    if (availableGrades.length > 0) {
      const paramRaw = next.get("grade");
      const resolved =
        paramRaw && String(paramRaw).trim()
          ? resolveLearnHubGrade(paramRaw, availableGrades)
          : resolveLearnHubGrade(null, availableGrades);
      const parsed = parseInt(String(paramRaw || "").trim(), 10);
      if (parsed !== resolved) {
        next.set("grade", String(resolved));
        changed = true;
      }
    }

    if (availableCurricula.length > 0) {
      const paramRaw = next.get("curriculum");
      const preferred = preferredStudentCurriculum();
      const resolved = paramRaw && String(paramRaw).trim()
        ? resolveLearnHubCurriculum(paramRaw, availableCurricula, preferred)
        : resolveLearnHubCurriculum(null, availableCurricula, preferred);
      const paramKey = curriculumKey(decodeURIComponent(String(paramRaw || "")));
      if (curriculumKey(resolved) !== paramKey) {
        next.set("curriculum", resolved);
        changed = true;
      }
    } else if (next.has("curriculum")) {
      next.delete("curriculum");
      changed = true;
    }

    if (changed) setSearchParams(next, { replace: true });
  }, [
    loading,
    availableGrades,
    availableCurricula,
    activeGrade,
    activeCurriculum,
    searchParams,
    setSearchParams,
  ]);

  const filteredEntries = useMemo(
    () =>
      filterHubEntriesByGradeAndCurriculum(entries, activeGrade, activeCurriculum),
    [entries, activeGrade, activeCurriculum],
  );

  const filteredOrphanGroups = useMemo(() => {
    return orphanGroups.filter((group) => {
      if (activeGrade != null && subjectGradeByKey.get(group.subjectKey) !== activeGrade) {
        return false;
      }
      if (
        activeCurriculum &&
        !subjectMatchesCurriculum(
          {
            key: group.subjectKey,
            title: group.subjectTitle,
            curriculum: subjectCurriculumByKey.get(group.subjectKey),
          },
          activeCurriculum,
        )
      ) {
        return false;
      }
      return true;
    });
  }, [
    orphanGroups,
    activeGrade,
    activeCurriculum,
    subjectGradeByKey,
    subjectCurriculumByKey,
  ]);

  function handleHubGradeChange(grade) {
    setSearchParams(
      learnHubSearchParams({ grade, curriculum: activeCurriculum }),
      { replace: true },
    );
  }

  function handleHubCurriculumChange(curriculum) {
    setSearchParams(
      learnHubSearchParams({ grade: activeGrade, curriculum }),
      { replace: true },
    );
  }

  function toggleGroup(id) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function requestDeleteSection(section) {
    setPendingDelete(section);
  }

  async function saveSectionTitle(section, nextTitle) {
    const key = `${section.subject_key}:${section.section_id}`;
    setTitleSavingKey(key);
    setError("");
    setStatusMessage("");
    try {
      const data = await getLearnSubject(section.subject_key);
      const sec = (data.sections || []).find(
        (item) => item.id === section.section_id && item.source === "db",
      );
      if (!sec) {
        throw new Error("This learning resource is not editable.");
      }
      await updateLearnSection(section.subject_key, section.section_id, {
        title: nextTitle,
        markdown: sec.markdown,
      });
      setStatusMessage(`Saved title “${nextTitle}”.`);
      await loadHub();
    } catch (err) {
      setError(err.message || "Could not save this title.");
    } finally {
      setTitleSavingKey(null);
    }
  }

  async function handleReorderCollections(scope, orderedSubjects) {
    if (orderedSubjects.length < 2) return;

    setReorderingScope(scope);
    setError("");
    setStatusMessage("");
    const previousEntries = entries;
    setEntries((current) =>
      current.map((entry) => {
        if (entry.type === "group" && entry.id === scope) {
          return { ...entry, subjects: orderedSubjects };
        }
        return entry;
      }),
    );

    try {
      await reorderLearnHubCollections(
        scope,
        orderedSubjects.map((subject) => subject.key),
      );
      setStatusMessage("Collection order updated.");
    } catch (err) {
      setEntries(previousEntries);
      setError(err.message || "Could not reorder collections.");
    } finally {
      setReorderingScope(null);
    }
  }

  async function handleReorderSections(subjectKey, orderedSections, topicId) {
    if (orderedSections.length < 2) return;

    setReorderingSectionsSubjectKey(subjectKey);
    setError("");
    setStatusMessage("");
    const previousSections = publishedSections;
    const mergedForSubject = mergeTopicSectionOrder(
      publishedSections,
      subjectKey,
      topicId,
      orderedSections,
    );
    setPublishedSections(
      reorderPublishedSections(publishedSections, subjectKey, mergedForSubject),
    );

    try {
      await reorderLearnSections(
        subjectKey,
        mergedForSubject.map((section) => section.section_id),
      );
      setStatusMessage("Section order updated.");
    } catch (err) {
      setPublishedSections(previousSections);
      setError(err.message || "Could not reorder sections.");
    } finally {
      setReorderingSectionsSubjectKey(null);
    }
  }

  async function confirmDeleteSection() {
    if (!pendingDelete) return;

    setDeleting({
      subjectKey: pendingDelete.subject_key,
      sectionId: pendingDelete.section_id,
    });
    setError("");
    setStatusMessage("");
    try {
      await deleteLearnSection(
        pendingDelete.subject_key,
        pendingDelete.section_id,
      );
      setStatusMessage(`Deleted “${pendingDelete.title}”.`);
      setPendingDelete(null);
      await loadHub();
    } catch (err) {
      setError(err.message || "Could not delete this resource.");
    } finally {
      setDeleting(null);
    }
  }

  function renderSubjectCard(subject) {
    return (
      <SubjectCard
        key={subject.key}
        subject={subject}
        isAdmin={isAdmin}
        publishedSections={publishedBySubjectKey.get(subject.key) || []}
        deleting={deleting}
        onDelete={isAdmin ? requestDeleteSection : undefined}
        onTitleSave={isAdmin ? saveSectionTitle : undefined}
        titleSavingKey={titleSavingKey}
        reorderingSectionsSubjectKey={reorderingSectionsSubjectKey}
        onReorderSections={isAdmin ? handleReorderSections : undefined}
        expandedTopics={expandedTopics}
        onToggleTopic={toggleTopicCollapse}
      />
    );
  }

  return (
    <LearnChrome>
      <div className="max-w-3xl">
        <h1 className={`${LEARN_PAGE_HEADING} mb-2`}>Learning resources</h1>
        <p className={`${LEARN_PAGE_INTRO} mb-4`}>
          Reference pages you can read before worksheets.
        </p>

        {!loading && (availableGrades.length > 0 || availableCurricula.length > 0) ? (
          <LearnHubFilterNav
            grades={availableGrades}
            activeGrade={activeGrade}
            curricula={availableCurricula}
            activeCurriculum={activeCurriculum}
            onGradeChange={handleHubGradeChange}
            onCurriculumChange={handleHubCurriculumChange}
          />
        ) : null}

        {loading && <QuillLoading label="Loading resources…" />}
        {error && <p className={`${LEARN_ERROR} mb-4`}>{error}</p>}
        {adminSectionsError ? (
          <p className="text-amber-800 text-sm mb-4">{adminSectionsError}</p>
        ) : null}

        {isAdmin && !loading && filteredOrphanGroups.length > 0 ? (
          <section className="mb-8">
            <h2 className={`${LEARN_EYEBROW_STRONG} mb-3`}>
              Published resources
            </h2>
            <div className="flex flex-col gap-4">
              {filteredOrphanGroups.map((group) => (
                <div key={group.subjectKey} className={HUB_TOP_SHELL}>
                  <div className={HUB_TOP_HEADER}>
                    <p className={WS_SECTION_TITLE}>{group.subjectTitle}</p>
                  </div>
                  <div className={`${HUB_TOP_BODY} gap-3`}>
                    {groupSectionsByTopic(group.sections).map((topicGroup) => {
                      const collapsed = !expandedTopics.has(
                        `${group.subjectKey}:${topicGroup.id}`,
                      );
                      return (
                        <TopicGroupShell
                          key={`${group.subjectKey}-${topicGroup.id}`}
                          subjectKey={group.subjectKey}
                          group={topicGroup}
                          collapsed={collapsed}
                          onToggle={toggleTopicCollapse}
                        >
                          <div className="flex flex-col gap-1.5">
                            {topicGroup.sections.length >= 2 ? (
                              <>
                                <p className={LEARN_HINT}>
                                  Drag ⋮⋮ to reorder within this topic
                                </p>
                                <SortableSectionList
                                  subjectKey={group.subjectKey}
                                  sections={topicGroup.sections}
                                  reorderingSubjectKey={reorderingSectionsSubjectKey}
                                  onReorder={(sk, ordered) =>
                                    handleReorderSections(sk, ordered, topicGroup.id)
                                  }
                                  renderSection={(section) => (
                                    <PublishedResourceRow
                                      key={`${section.subject_key}-${section.section_id}`}
                                      section={section}
                                      deleting={deleting}
                                      onDelete={requestDeleteSection}
                                      onTitleSave={saveSectionTitle}
                                      titleSavingKey={titleSavingKey}
                                    />
                                  )}
                                />
                              </>
                            ) : (
                              topicGroup.sections.map((section) => (
                                <PublishedResourceRow
                                  key={`${section.subject_key}-${section.section_id}`}
                                  section={section}
                                  deleting={deleting}
                                  onDelete={requestDeleteSection}
                                  onTitleSave={saveSectionTitle}
                                  titleSavingKey={titleSavingKey}
                                />
                              ))
                            )}
                          </div>
                        </TopicGroupShell>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!loading && !error && filteredEntries.length === 0 && (
          <p className={LEARN_BODY}>
            {activeGrade != null || activeCurriculum
              ? `No learning resources${
                  activeGrade != null ? ` for grade ${activeGrade}` : ""
                }${activeCurriculum ? ` (${activeCurriculum})` : ""} yet.`
              : "No topics yet."}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {filteredEntries.map((entry) => {
            if (entry.type === "subject") {
              return renderSubjectCard(entry);
            }

            const open = expandedGroups.has(entry.id);
            const collectionMeta =
              entry.subjects?.length > 0
                ? `${entry.subjects.length} collection${
                    entry.subjects.length === 1 ? "" : "s"
                  }`
                : null;
            return (
              <div key={entry.id} className={HUB_TOP_SHELL}>
                <div className={HUB_TOP_HEADER}>
                  <CollapsibleSectionHeader
                    title={entry.title}
                    meta={collectionMeta}
                    open={open}
                    onToggle={() => toggleGroup(entry.id)}
                  />
                  {entry.description ? (
                    <p className={`${LEARN_BODY} mt-1 leading-relaxed`}>
                      {entry.description}
                    </p>
                  ) : null}
                </div>
                {open ? (
                  <div className={`${HUB_TOP_BODY} gap-3`}>
                    {isAdmin && (entry.subjects?.length || 0) > 1 ? (
                      <SortableSubjectList
                        scope={entry.id}
                        subjects={entry.subjects}
                        reorderingScope={reorderingScope}
                        onReorder={handleReorderCollections}
                        renderSubject={renderSubjectCard}
                      />
                    ) : (
                      entry.subjects?.map((subject) => renderSubjectCard(subject))
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <DeleteConfirmDialog
        section={pendingDelete}
        deleting={Boolean(deleting)}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={confirmDeleteSection}
      />

      <StatusToast message={statusMessage} />
    </LearnChrome>
  );
}
