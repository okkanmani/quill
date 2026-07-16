import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getLearnPageHighlights,
  getLearnPageNotes,
  getLearnSubject,
  saveLearnPageHighlights,
} from "../api";
import LearnChrome from "../components/LearnChrome";
import LearnMarkdown from "../components/LearnMarkdown";
import LearnPageNotes from "../components/LearnPageNotes";
import LearnPageHighlighter, {
  LearnPageHighlightMarkdown,
  LearnPageHighlightToolbarSlot,
} from "../components/LearnPageHighlighter";
import { LearnPageSheet, LearnPageStickyToolbar } from "../components/LearnPageLabel";
import { useShellLayout } from "../components/ShellLayoutContext";
import QuillLoading from "../components/QuillLoading";
import { buildLearnLinePages, getSectionStartPage } from "../learnPageUtils";
import {
  getStoredLearnHighlightColor,
  setStoredLearnHighlightColor,
} from "../learnHighlightUtils";
import {
  getStoredLearnNotesCollapsed,
  setStoredLearnNotesCollapsed,
} from "../learnNotesUtils";

/* Sticky TOC sits below the page top padding in the sidebar layout. */

export default function LearnSubject() {
  const { subjectKey } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notesByKey, setNotesByKey] = useState({});
  const [highlightsByKey, setHighlightsByKey] = useState({});
  const highlightSaveTimersRef = useRef({});
  const role = localStorage.getItem("role");
  const adminStudentName = localStorage.getItem("studentName");
  const canViewLearnNotes =
    role === "student" || (role === "admin" && Boolean(adminStudentName));
  const canEditLearnNotes = role === "student";
  const canViewLearnHighlights = canViewLearnNotes;
  const canEditLearnHighlights = role === "student";
  const [notesCollapsed, setNotesCollapsedState] = useState(getStoredLearnNotesCollapsed);
  const [highlightColor, setHighlightColorState] = useState(getStoredLearnHighlightColor);
  const [highlightEraser, setHighlightEraser] = useState(false);

  function setHighlightColor(color) {
    setHighlightColorState(setStoredLearnHighlightColor(color));
  }

  function toggleNotesCollapsed() {
    setNotesCollapsedState(setStoredLearnNotesCollapsed(!notesCollapsed));
  }

  const handleNoteUpdate = useCallback((note) => {
    setNotesByKey((prev) => ({
      ...prev,
      [`${note.section_id}:${note.page_index}`]: note,
    }));
  }, []);

  const handleHighlightUpdate = useCallback(
    (sectionId, pageIndex, highlights) => {
      const key = `${sectionId}:${pageIndex}`;
      setHighlightsByKey((prev) => ({
        ...prev,
        [key]: highlights,
      }));

      if (!canEditLearnHighlights || !subjectKey) return;

      if (highlightSaveTimersRef.current[key]) {
        window.clearTimeout(highlightSaveTimersRef.current[key]);
      }
      highlightSaveTimersRef.current[key] = window.setTimeout(async () => {
        try {
          const saved = await saveLearnPageHighlights(
            subjectKey,
            sectionId,
            pageIndex,
            highlights,
          );
          setHighlightsByKey((prev) => ({
            ...prev,
            [key]: saved.highlights,
          }));
        } catch {
          /* keep optimistic local highlights */
        }
      }, 900);
    },
    [canEditLearnHighlights, subjectKey],
  );

  useEffect(
    () => () => {
      Object.values(highlightSaveTimersRef.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
    },
    [],
  );

  useEffect(() => {
    if (!subjectKey) return;
    setLoading(true);
    getLearnSubject(subjectKey)
      .then(setData)
      .catch(() => setError("Could not load this topic."))
      .finally(() => setLoading(false));
  }, [subjectKey]);

  useEffect(() => {
    if (!subjectKey || !canViewLearnNotes) {
      setNotesByKey({});
      return;
    }
    getLearnPageNotes(subjectKey)
      .then(({ notes }) => {
        const map = {};
        for (const note of notes || []) {
          map[`${note.section_id}:${note.page_index}`] = note;
        }
        setNotesByKey(map);
      })
      .catch(() => {
        setNotesByKey({});
      });
  }, [subjectKey, canViewLearnNotes]);

  useEffect(() => {
    if (!subjectKey || !canViewLearnHighlights) {
      setHighlightsByKey({});
      return;
    }
    getLearnPageHighlights(subjectKey)
      .then(({ highlights }) => {
        const map = {};
        for (const row of highlights || []) {
          map[`${row.section_id}:${row.page_index}`] = row.highlights || [];
        }
        setHighlightsByKey(map);
      })
      .catch(() => {
        setHighlightsByKey({});
      });
  }, [subjectKey, canViewLearnHighlights]);

  useEffect(() => {
    if (!data?.sections?.length || loading) return;
    const raw = location.hash?.replace(/^#/, "");
    if (!raw) return;
    const id = decodeURIComponent(raw);
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [data, loading, location.hash]);

  const groups = useMemo(() => {
    if (!data) return [];
    return data.groups?.length > 0
      ? data.groups
      : [{ id: "", title: "", sections: data.sections ?? [] }];
  }, [data]);

  const { pages, sectionStarts, totalPages } = useMemo(
    () => buildLearnLinePages(groups),
    [groups],
  );

  const showPageNumbers = totalPages > 1;
  const { sidebarCollapsed } = useShellLayout();
  const contentWidthClass =
    sidebarCollapsed || canViewLearnNotes ? "max-w-none" : "max-w-6xl";

  return (
    <LearnChrome onBack={() => navigate("/student/learn")}>
      <div className={contentWidthClass}>
        {loading && <QuillLoading label="Loading topic…" />}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {data && !loading && (
          <div className="lg:grid lg:grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] lg:gap-6 items-start">
            <aside className="hidden lg:block sticky top-6 z-30 mb-8 lg:mb-0 self-start max-h-[calc(100vh-3rem)] overflow-y-auto pr-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                On this page
              </p>
              <nav className="flex flex-col gap-0.5 border-l border-slate-200 pl-2 pb-2">
                {groups.map((g, gi) => (
                  <div key={g.id || `toc-${gi}`}>
                    {g.title ? (
                      <p
                        className={`text-[10px] font-bold uppercase tracking-wide text-indigo-500 mb-0.5 leading-tight ${
                          gi > 0 ? "mt-2" : ""
                        }`}
                      >
                        {g.title}
                      </p>
                    ) : null}
                    {g.sections.map((sec) => {
                      const startPage = getSectionStartPage(sectionStarts, sec.id);
                      return (
                        <a
                          key={sec.id}
                          href={`#${sec.id}`}
                          className="flex items-baseline gap-1.5 text-xs leading-snug text-slate-700 hover:text-slate-950 py-px"
                        >
                          {showPageNumbers && startPage ? (
                            <span className="shrink-0 w-4 text-right text-[10px] font-semibold text-slate-400 tabular-nums">
                              {startPage}
                            </span>
                          ) : null}
                          <span className="min-w-0">{sec.title}</span>
                        </a>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </aside>

            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-950 mb-3">{data.title}</h1>
              {data.description ? (
                <p className="text-slate-700 text-sm mb-10 leading-relaxed border-b border-slate-200 pb-8">
                  {data.description}
                </p>
              ) : (
                <div className="mb-10 border-b border-slate-200 pb-8" />
              )}

              <div className="lg:hidden sticky top-44 z-30 mb-8 rounded-xl border border-slate-200 bg-slate-50/95 backdrop-blur-sm shadow-sm p-4">
                <p className="text-xs font-semibold text-slate-600 mb-2">Sections</p>
                <div className="flex flex-col gap-3">
                  {groups.map((g, gi) => (
                    <div key={g.id || `mob-${gi}`}>
                      {g.title ? (
                        <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-500 mb-1.5">
                          {g.title}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {g.sections.map((sec) => {
                          const startPage = getSectionStartPage(sectionStarts, sec.id);
                          return (
                            <a
                              key={sec.id}
                              href={`#${sec.id}`}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 bg-slate-100 px-2 py-1 rounded-lg"
                            >
                              {showPageNumbers && startPage ? (
                                <span className="text-slate-500 tabular-nums">
                                  {startPage}.
                                </span>
                              ) : null}
                              {sec.title}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-8">
                {pages.map((page, index) => {
                  const prev = pages[index - 1];
                  const showGroupHeader =
                    page.group.title &&
                    page.isFirstPageOfSection &&
                    (!prev || prev.group.id !== page.group.id);

                  const noteKey = `${page.section.id}:${page.pageIndexWithinSection}`;
                  const noteRecord = notesByKey[noteKey];
                  const pageHighlights = highlightsByKey[noteKey] || [];

                  const markdownBlock = canViewLearnHighlights ? (
                    <LearnPageHighlightMarkdown markdown={page.markdown} />
                  ) : (
                    <div className="learn-md">
                      <LearnMarkdown markdown={page.markdown} />
                    </div>
                  );

                  const pageBody = (
                    <>
                      {showGroupHeader ? (
                        <h2 className="text-lg font-bold text-slate-950 pb-2 mb-3 border-b border-slate-200">
                          {page.group.title}
                        </h2>
                      ) : null}

                      {page.isFirstPageOfSection ? (
                        page.group.title ? (
                          <h3
                            id={page.section.id}
                            className="text-base font-bold text-slate-950 mb-3 scroll-mt-44"
                          >
                            {page.section.title}
                          </h3>
                        ) : (
                          <h2
                            id={page.section.id}
                            className="text-lg font-bold text-slate-950 mb-3 scroll-mt-44"
                          >
                            {page.section.title}
                          </h2>
                        )
                      ) : (
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-3">
                          {page.section.title} · continued
                        </p>
                      )}

                      {markdownBlock}
                    </>
                  );

                  const highlightToolbar = canViewLearnHighlights ? (
                    <LearnPageHighlightToolbarSlot />
                  ) : null;

                  const pageCardInner = !showPageNumbers ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm scroll-mt-44">
                      {canViewLearnHighlights ? (
                        <LearnPageStickyToolbar>{highlightToolbar}</LearnPageStickyToolbar>
                      ) : null}
                      {pageBody}
                    </div>
                  ) : (
                    <LearnPageSheet
                      pageNumber={page.pageNumber}
                      totalPages={page.totalPages}
                      className="scroll-mt-44"
                      headerStart={highlightToolbar}
                      stickyHeader={canViewLearnHighlights}
                    >
                      {pageBody}
                    </LearnPageSheet>
                  );

                  const pageCard = canViewLearnHighlights ? (
                    <LearnPageHighlighter
                      highlights={pageHighlights}
                      onHighlightsChange={(next) =>
                        handleHighlightUpdate(
                          page.section.id,
                          page.pageIndexWithinSection,
                          next,
                        )
                      }
                      readOnly={!canEditLearnHighlights}
                      enabled
                      activeColor={highlightColor}
                      onActiveColorChange={setHighlightColor}
                      eraserActive={highlightEraser}
                      onEraserActiveChange={setHighlightEraser}
                    >
                      {pageCardInner}
                    </LearnPageHighlighter>
                  ) : (
                    pageCardInner
                  );

                  if (!canViewLearnNotes) {
                    return (
                      <div key={`${page.section.id}-${page.pageNumber}`}>
                        {pageCard}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`${page.section.id}-${page.pageNumber}`}
                      className="flex flex-col lg:flex-row lg:items-start overflow-visible"
                    >
                      <div className="min-w-0 flex-1">{pageCard}</div>
                      <LearnPageNotes
                        subjectKey={subjectKey}
                        sectionId={page.section.id}
                        pageIndex={page.pageIndexWithinSection}
                        pageMarkdown={page.markdown}
                        sectionTitle={page.section.title}
                        subjectTitle={data.title}
                        note={noteRecord}
                        onNoteUpdate={handleNoteUpdate}
                        readOnly={!canEditLearnNotes}
                        collapsed={notesCollapsed}
                        onToggleCollapsed={toggleNotesCollapsed}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </LearnChrome>
  );
}
