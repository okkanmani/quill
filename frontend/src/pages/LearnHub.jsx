import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteLearnSection,
  getAdminLearnSections,
  getLearnSubject,
  getLearnSubjects,
  reorderLearnSections,
  updateLearnSection,
} from "../api";
import EditActionButton from "../components/EditActionButton";
import LearnChrome from "../components/LearnChrome";
import QuillLoading from "../components/QuillLoading";
import RecycleBinButton from "../components/RecycleBinButton";

function RenameSectionDialog({ section, saving, onCancel, onSave }) {
  const [title, setTitle] = useState(section?.title || "");

  useEffect(() => {
    setTitle(section?.title || "");
  }, [section]);

  if (!section) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-slate-900/40"
        aria-label="Close rename dialog"
        onClick={saving ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-learn-title"
        className="fixed left-1/2 top-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h2 id="rename-learn-title" className="text-lg font-bold text-slate-950">
          Rename section
        </h2>
        <p className="text-sm text-slate-600 mt-1">{section.subject_title}</p>
        <label className="block mt-4 text-sm font-semibold text-slate-800">
          Section title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(title.trim())}
            disabled={saving || !title.trim()}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2 text-sm font-semibold transition"
          >
            {saving ? "Saving…" : "Save title"}
          </button>
        </div>
      </div>
    </>
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
  onRename,
  compact = false,
  draggable = false,
  dragHandleProps = null,
  isDragging = false,
  isDropTarget = false,
}) {
  const learnUrl = `/student/learn/${encodeURIComponent(section.subject_key)}#${encodeURIComponent(section.section_id)}`;
  const editUrl = `/admin/create/learn/edit/${encodeURIComponent(section.subject_key)}/${encodeURIComponent(section.section_id)}`;

  return (
    <div
      className={`flex flex-col sm:flex-row gap-3 sm:items-stretch sm:gap-4 transition-opacity ${
        isDragging ? "opacity-40" : ""
      } ${isDropTarget ? "ring-2 ring-indigo-300 ring-offset-2 rounded-2xl" : ""}`}
    >
      {draggable ? (
        <div className="flex sm:flex-col items-center justify-center shrink-0 self-center sm:self-stretch">
          <button
            type="button"
            aria-label={`Drag to reorder ${section.title}`}
            className="cursor-grab active:cursor-grabbing rounded-lg border border-slate-200 bg-white px-2 py-3 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition touch-none"
            {...dragHandleProps}
          >
            <span aria-hidden className="block text-base leading-none tracking-tighter">
              ⋮⋮
            </span>
          </button>
        </div>
      ) : null}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch sm:gap-4 flex-1 min-w-0">
      <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <Link
          to={learnUrl}
          className="block p-5 hover:bg-slate-50/60 transition"
        >
          <p className="text-slate-900 font-semibold text-lg">{section.title}</p>
          {!compact && section.subject_title ? (
            <p className="text-slate-600 text-sm mt-1">{section.subject_title}</p>
          ) : null}
          {!compact && section.subject_description ? (
            <p className="text-slate-500 text-xs mt-2">{section.subject_description}</p>
          ) : null}
        </Link>
        {onRename ? (
          <div className="px-5 pb-4 -mt-1 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => onRename(section)}
              disabled={Boolean(deleting)}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline disabled:opacity-60"
            >
              Rename title
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-row sm:flex-col shrink-0 gap-2 self-center sm:self-stretch items-center sm:items-stretch sm:w-11">
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
      </div>
      </div>
    </div>
  );
}

function reorderSectionList(sections, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return sections;
  const next = [...sections];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function SortableSectionList({
  subjectKey,
  sections,
  reordering,
  onReorder,
  deleting,
  onDelete,
  onRename,
  compact = false,
}) {
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  if (sections.length < 2) {
    return sections.map((section) => (
      <PublishedResourceRow
        key={`${section.subject_key}-${section.section_id}`}
        section={section}
        deleting={deleting}
        onDelete={onDelete}
        onRename={onRename}
        compact={compact}
      />
    ));
  }

  async function finishDrop(targetIndex) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const ordered = reorderSectionList(sections, dragIndex, targetIndex);
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
    >
      <PublishedResourceRow
        section={section}
        deleting={deleting}
        onDelete={onDelete}
        onRename={onRename}
        compact={compact}
        draggable
        isDragging={dragIndex === index}
        isDropTarget={dropIndex === index}
        dragHandleProps={{
          draggable: reordering !== subjectKey,
          onDragStart: (event) => {
            setDragIndex(index);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", section.section_id);
          },
          onDragEnd: () => {
            setDragIndex(null);
            setDropIndex(null);
          },
        }}
      />
    </div>
  ));
}

function SubjectCard({
  subject,
  publishedSections = [],
  isAdmin,
  deleting,
  reordering,
  onDelete,
  onRename,
  onReorder,
}) {
  if (isAdmin && publishedSections.length > 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 overflow-hidden">
        <Link
          to={`/student/learn/${subject.key}`}
          className="block p-4 hover:bg-white transition"
        >
          <p className="text-base font-semibold text-slate-900">{subject.title}</p>
          {subject.description ? (
            <p className="text-slate-600 text-sm mt-1.5 leading-relaxed line-clamp-3">
              {subject.description}
            </p>
          ) : null}
        </Link>
        <div className="border-t border-slate-200 bg-white px-4 py-4 flex flex-col gap-3">
          <SortableSectionList
            subjectKey={subject.key}
            sections={publishedSections}
            reordering={reordering}
            onReorder={onReorder}
            deleting={deleting}
            onDelete={onDelete}
            onRename={onRename}
            compact
          />
        </div>
      </div>
    );
  }

  return (
    <Link
      to={`/student/learn/${subject.key}`}
      className="block rounded-xl border border-slate-200 bg-slate-50/80 p-4 hover:border-indigo-400 hover:bg-white hover:shadow-sm transition"
    >
      <p className="text-base font-semibold text-slate-900">{subject.title}</p>
      {subject.description ? (
        <p className="text-slate-600 text-sm mt-1.5 leading-relaxed line-clamp-3">
          {subject.description}
        </p>
      ) : null}
    </Link>
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

async function discoverEditableSections(entries) {
  const keys = collectHubSubjectKeys(entries);
  const sections = [];
  await Promise.all(
    keys.map(async (key) => {
      try {
        const data = await getLearnSubject(key);
        for (const sec of data.sections || []) {
          if (sec.source !== "db") continue;
          sections.push({
            subject_key: data.key,
            section_id: sec.id,
            title: sec.title,
            subject_title: data.title,
            subject_description: data.description || "",
          });
        }
      } catch {
        /* subject may have been removed */
      }
    }),
  );
  return sections;
}

export default function LearnHub() {
  const [entries, setEntries] = useState([]);
  const [publishedSections, setPublishedSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminSectionsError, setAdminSectionsError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingRename, setPendingRename] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [reordering, setReordering] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set(["math"]));
  const isAdmin = localStorage.getItem("role") === "admin";

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
          sections = await discoverEditableSections(hubEntries);
        }
        setPublishedSections(sections);
      } else {
        setPublishedSections([]);
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

  function requestRenameSection(section) {
    setPendingRename(section);
  }

  async function confirmRenameSection(nextTitle) {
    if (!pendingRename || !nextTitle) return;

    setRenaming(true);
    setError("");
    setStatusMessage("");
    try {
      const data = await getLearnSubject(pendingRename.subject_key);
      const sec = (data.sections || []).find(
        (item) => item.id === pendingRename.section_id && item.source === "db",
      );
      if (!sec) {
        throw new Error("This learning resource is not editable.");
      }
      await updateLearnSection(
        pendingRename.subject_key,
        pendingRename.section_id,
        {
          title: nextTitle,
          markdown: sec.markdown,
        },
      );
      setStatusMessage(`Renamed to “${nextTitle}”.`);
      setPendingRename(null);
      await loadHub();
    } catch (err) {
      setError(err.message || "Could not rename this section.");
    } finally {
      setRenaming(false);
    }
  }

  async function handleReorderSections(subjectKey, orderedSections) {
    if (orderedSections.length < 2) return;

    setReordering(subjectKey);
    setError("");
    setStatusMessage("");
    const previous = publishedSections;
    const orderedIds = new Set(orderedSections.map((section) => section.section_id));
    setPublishedSections((current) => {
      const others = current.filter(
        (section) =>
          section.subject_key !== subjectKey ||
          !orderedIds.has(section.section_id),
      );
      return [...others, ...orderedSections];
    });

    try {
      await reorderLearnSections(
        subjectKey,
        orderedSections.map((section) => section.section_id),
      );
      setStatusMessage("Section order updated.");
    } catch (err) {
      setPublishedSections(previous);
      setError(err.message || "Could not reorder sections.");
    } finally {
      setReordering(null);
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
        reordering={reordering}
        onDelete={requestDeleteSection}
        onRename={requestRenameSection}
        onReorder={handleReorderSections}
      />
    );
  }

  return (
    <LearnChrome>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-950 mb-2">Learning resources</h1>
        <p className="text-slate-700 text-sm mb-8 leading-relaxed">
          Reference pages you can read before worksheets.
        </p>

        {statusMessage ? (
          <p className="text-green-700 text-sm mb-4">{statusMessage}</p>
        ) : null}

        {loading && <QuillLoading label="Loading resources…" />}
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        {adminSectionsError ? (
          <p className="text-amber-800 text-sm mb-4">{adminSectionsError}</p>
        ) : null}

        {isAdmin && !loading && orphanGroups.length > 0 ? (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">
              Published resources
            </h2>
            <div className="flex flex-col gap-6">
              {orphanGroups.map((group) => (
                <div key={group.subjectKey}>
                  <p className="text-sm font-semibold text-slate-800 mb-3">
                    {group.subjectTitle}
                  </p>
                  <div className="flex flex-col gap-3">
                    <SortableSectionList
                      subjectKey={group.subjectKey}
                      sections={group.sections}
                      reordering={reordering}
                      onReorder={handleReorderSections}
                      deleting={deleting}
                      onDelete={requestDeleteSection}
                      onRename={requestRenameSection}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!loading && !error && entries.length === 0 && (
          <p className="text-slate-600">No topics yet.</p>
        )}

        <div className="flex flex-col gap-4">
          {entries.map((entry) => {
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
                    <p className="text-lg font-semibold text-slate-900">{entry.title}</p>
                    {entry.description ? (
                      <p className="text-slate-600 text-sm mt-1.5 leading-relaxed">
                        {entry.description}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className="text-slate-500 text-lg leading-none shrink-0 pt-0.5"
                    aria-hidden
                  >
                    {open ? "−" : "+"}
                  </span>
                </button>
                {open ? (
                  <div className="px-5 pb-5 pt-0 flex flex-col gap-3 border-t border-slate-100">
                    {entry.subjects?.map((subject) => renderSubjectCard(subject))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <RenameSectionDialog
        section={pendingRename}
        saving={renaming}
        onCancel={() => {
          if (!renaming) setPendingRename(null);
        }}
        onSave={confirmRenameSection}
      />
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
