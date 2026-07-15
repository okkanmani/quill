import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteLearnSection,
  getAdminLearnSections,
  getLearnSubject,
  getLearnSubjects,
} from "../api";
import EditActionButton from "../components/EditActionButton";
import LearnChrome from "../components/LearnChrome";
import QuillLoading from "../components/QuillLoading";
import RecycleBinButton from "../components/RecycleBinButton";

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
  compact = false,
}) {
  const learnUrl = `/student/learn/${encodeURIComponent(section.subject_key)}#${encodeURIComponent(section.section_id)}`;
  const editUrl = `/admin/create/learn/edit/${encodeURIComponent(section.subject_key)}/${encodeURIComponent(section.section_id)}`;

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch sm:gap-4">
      <Link
        to={learnUrl}
        className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 hover:bg-slate-50/60 transition"
      >
        <p className="text-slate-900 font-semibold text-lg">{section.title}</p>
        {!compact && section.subject_title ? (
          <p className="text-slate-600 text-sm mt-1">{section.subject_title}</p>
        ) : null}
        {!compact && section.subject_description ? (
          <p className="text-slate-500 text-xs mt-2">{section.subject_description}</p>
        ) : null}
      </Link>
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
  );
}

function SubjectCard({ subject, publishedSections = [], isAdmin, deleting, onDelete }) {
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
          {publishedSections.map((section) => (
            <PublishedResourceRow
              key={`${section.subject_key}-${section.section_id}`}
              section={section}
              deleting={deleting}
              onDelete={onDelete}
              compact
            />
          ))}
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
        onDelete={requestDeleteSection}
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

        {isAdmin && !loading && orphanPublishedSections.length > 0 ? (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">
              Published resources
            </h2>
            <div className="flex flex-col gap-3">
              {orphanPublishedSections.map((section) => (
                <PublishedResourceRow
                  key={`${section.subject_key}-${section.section_id}`}
                  section={section}
                  deleting={deleting}
                  onDelete={requestDeleteSection}
                />
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
