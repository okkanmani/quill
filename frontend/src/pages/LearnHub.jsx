import { useEffect, useMemo, useState } from "react";
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
  filterHubEntriesByGrade,
  flattenHubSubjects,
  learnSubjectGrade,
  learnHubDescriptionWithoutGrade,
  resolveLearnHubGrade,
  sortedGradesFromSubjects,
} from "../learnHubGrades";
import LearnChrome from "../components/LearnChrome";
import QuillLoading from "../components/QuillLoading";
import RecycleBinButton from "../components/RecycleBinButton";

function EditableSectionTitle({ section, learnUrl, saving, onSave, trailing = null }) {
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
    <div className="flex items-center justify-between gap-3">
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
        className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-0 py-0.5 text-sm font-semibold text-slate-900 hover:border-slate-200 hover:bg-white focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60 transition"
      />
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to={learnUrl}
          className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline whitespace-nowrap"
        >
          View resource
        </Link>
        {trailing}
      </div>
    </div>
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
        <h2 id="delete-learn-title" className="text-lg font-bold text-slate-950">
          Delete learning resource?
        </h2>
        <p className="text-sm text-slate-700 mt-2 leading-relaxed">
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
  const pad = compact ? "p-3.5" : "p-4";
  const collectionBlurb = learnHubDescriptionWithoutGrade(section.subject_description);

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
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {isAdmin ? (
        <div className={pad}>
          <EditableSectionTitle
            section={section}
            learnUrl={learnUrl}
            saving={savingTitle}
            onSave={onTitleSave}
            trailing={adminActions}
          />
            {!compact && section.subject_title ? (
              <p className="text-slate-600 text-xs mt-1.5">{section.subject_title}</p>
            ) : null}
            {!compact && collectionBlurb ? (
              <p className="text-slate-500 text-xs mt-1">{collectionBlurb}</p>
            ) : null}
          </div>
        ) : (
          <Link
            to={learnUrl}
            className={`block ${pad} hover:bg-slate-50/60 transition`}
          >
            <p className="text-slate-900 font-semibold text-sm leading-snug">{section.title}</p>
            {!compact && section.subject_title ? (
              <p className="text-slate-600 text-xs mt-1">{section.subject_title}</p>
            ) : null}
            {!compact && collectionBlurb ? (
              <p className="text-slate-500 text-xs mt-1">{collectionBlurb}</p>
            ) : null}
          </Link>
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
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(subjectKey, group.id)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 text-left mb-2 rounded-lg py-0.5 hover:bg-slate-50/80 -mx-0.5 px-1 transition"
      >
        <span className="text-slate-500 text-xs w-3 shrink-0" aria-hidden>
          {collapsed ? "▸" : "▾"}
        </span>
        <span className="text-sm font-semibold text-slate-800">{group.label}</span>
        <span className="text-xs font-normal text-slate-500 tabular-nums">
          ({group.sections.length})
        </span>
      </button>
      {!collapsed ? children : null}
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
  const collectionBlurb = learnHubDescriptionWithoutGrade(subject.description);

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
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 overflow-hidden">
        <div className="p-4 bg-slate-50/80">
          <p className="text-base font-semibold text-slate-900">{subject.title}</p>
          {collectionBlurb ? (
            <p className="text-slate-600 text-sm mt-1.5 leading-relaxed line-clamp-3">
              {collectionBlurb}
            </p>
          ) : null}
        </div>
        <div className="border-t border-slate-200 bg-white px-4 py-4 flex flex-col gap-3">
          {isAdmin && publishedSections.length >= 2 ? (
            <p className="text-xs font-medium text-slate-500 -mb-0.5">
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
                <div className="flex flex-col gap-3 pl-1 border-l-2 border-slate-100 ml-0.5">
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
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-base font-semibold text-slate-900">{subject.title}</p>
      {collectionBlurb ? (
        <p className="text-slate-600 text-sm mt-1.5 leading-relaxed line-clamp-3">
          {collectionBlurb}
        </p>
      ) : null}
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
          });
        }
      } catch {
        /* subject may have been removed */
      }
    }),
  );
  return sections;
}

function LearnHubGradeNav({ grades, activeGrade }) {
  if (!grades.length) return null;

  return (
    <nav
      className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-3"
      aria-label="Grades"
    >
      {grades.map((grade) => {
        const active = grade === activeGrade;
        return (
          <Link
            key={grade}
            to={`/student/learn?grade=${grade}`}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            aria-current={active ? "page" : undefined}
          >
            Grade {grade}
          </Link>
        );
      })}
    </nav>
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

  const availableGrades = useMemo(() => {
    const subjects = flattenHubSubjects(entries);
    const grades = sortedGradesFromSubjects(subjects);
    const fromOrphans = new Set(grades);
    for (const grade of subjectGradeByKey.values()) {
      if (grade > 0) fromOrphans.add(grade);
    }
    return [...fromOrphans].sort((a, b) => a - b);
  }, [entries, subjectGradeByKey]);

  const activeGrade = useMemo(
    () => resolveLearnHubGrade(searchParams.get("grade"), availableGrades),
    [searchParams, availableGrades],
  );

  useEffect(() => {
    if (loading || availableGrades.length === 0) return;
    const param = searchParams.get("grade");
    const parsed = parseInt(String(param || "").trim(), 10);
    if (availableGrades.includes(parsed)) return;
    setSearchParams({ grade: String(activeGrade) }, { replace: true });
  }, [loading, availableGrades, activeGrade, searchParams, setSearchParams]);

  const filteredEntries = useMemo(
    () =>
      activeGrade != null
        ? filterHubEntriesByGrade(entries, activeGrade)
        : entries,
    [entries, activeGrade],
  );

  const filteredOrphanGroups = useMemo(() => {
    if (activeGrade == null) return orphanGroups;
    return orphanGroups.filter(
      (group) => subjectGradeByKey.get(group.subjectKey) === activeGrade,
    );
  }, [orphanGroups, activeGrade, subjectGradeByKey]);

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
        <h1 className="text-2xl font-bold text-slate-950 mb-2">Learning resources</h1>
        <p className="text-slate-700 text-sm mb-4 leading-relaxed">
          Reference pages you can read before worksheets.
        </p>

        {!loading && availableGrades.length > 0 ? (
          <LearnHubGradeNav grades={availableGrades} activeGrade={activeGrade} />
        ) : null}

        {statusMessage ? (
          <p className="text-green-700 text-sm mb-4">{statusMessage}</p>
        ) : null}

        {loading && <QuillLoading label="Loading resources…" />}
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        {adminSectionsError ? (
          <p className="text-amber-800 text-sm mb-4">{adminSectionsError}</p>
        ) : null}

        {isAdmin && !loading && filteredOrphanGroups.length > 0 ? (
          <section className="mb-8">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3">
              Published resources
            </h2>
            <div className="flex flex-col gap-6">
              {filteredOrphanGroups.map((group) => (
                <div key={group.subjectKey}>
                  <p className="text-base font-semibold text-slate-900 mb-3">
                    {group.subjectTitle}
                  </p>
                  <div className="flex flex-col gap-4">
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
                          <div className="flex flex-col gap-3 pl-1 border-l-2 border-slate-100">
                            {topicGroup.sections.length >= 2 ? (
                              <>
                                <p className="text-xs font-medium text-slate-500">
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
          <p className="text-slate-600 text-sm">
            {activeGrade != null
              ? `No learning resources for grade ${activeGrade} yet.`
              : "No topics yet."}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {filteredEntries.map((entry) => {
            if (entry.type === "subject") {
              return renderSubjectCard(entry);
            }

            const open = expandedGroups.has(entry.id);
            return (
              <div
                key={entry.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(entry.id)}
                  aria-expanded={open}
                  className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 hover:bg-slate-50/80 transition"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-slate-900">{entry.title}</p>
                    {entry.description ? (
                      <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                        {entry.description}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className="text-slate-500 text-base leading-none shrink-0 pt-0.5"
                    aria-hidden
                  >
                    {open ? "−" : "+"}
                  </span>
                </button>
                {open ? (
                  <div className="px-5 pb-5 pt-4 flex flex-col gap-3 border-t border-slate-100">
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
    </LearnChrome>
  );
}
