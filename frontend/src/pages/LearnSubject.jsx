import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getLearnPageHighlights,
  getLearnPageNotes,
  getLearnSubject,
  getMe,
  saveLearnPageHighlights,
} from "../api";
import LearnChrome from "../components/LearnChrome";
import {
  buildCollectionPrintRequest,
  buildSectionPrintRequest,
  LearnSubjectPdfTrigger,
  LearnSubjectPrintHost,
  useLearnSubjectPrint,
} from "../components/LearnSubjectPrint";
import { countLearnSections } from "../learnPrintGroups";
import LearnMarkdown from "../components/LearnMarkdown";
import LearnHighlightToolbar from "../components/LearnHighlightToolbar";
import LearnPageNotes from "../components/LearnPageNotes";
import LearnPageHighlighter, {
  LearnPageHighlightMarkdown,
} from "../components/LearnPageHighlighter";
import { useShellLayout } from "../components/ShellLayoutContext";
import QuillLoading from "../components/QuillLoading";
import { buildLearnLinePages } from "../learnPageUtils";
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
  const [sessionRole, setSessionRole] = useState(
    () => localStorage.getItem("role") || "",
  );
  const [sessionStudentName, setSessionStudentName] = useState(
    () => localStorage.getItem("studentName") || "",
  );
  const canViewLearnNotes =
    sessionRole === "student" ||
    (sessionRole === "admin" && Boolean(sessionStudentName));
  const canEditLearnNotes = sessionRole === "student";
  const canViewLearnHighlights =
    sessionRole === "student" || sessionRole === "admin";
  const canEditLearnHighlights = sessionRole === "student";
  const showHighlightToolbar = canViewLearnHighlights;
  const [notesCollapsed, setNotesCollapsedState] = useState(getStoredLearnNotesCollapsed);
  const [highlightColor, setHighlightColorState] = useState(getStoredLearnHighlightColor);
  const [highlightEraser, setHighlightEraser] = useState(false);

  function setHighlightColor(color) {
    setHighlightColorState(setStoredLearnHighlightColor(color));
  }

  useEffect(() => {
    getMe()
      .then((me) => {
        if (me?.role) {
          setSessionRole(me.role);
          localStorage.setItem("role", me.role);
        }
        if (me?.role === "admin") {
          const studentName = me.student_name || "";
          setSessionStudentName(studentName);
          if (studentName) {
            localStorage.setItem("studentName", studentName);
          } else {
            localStorage.removeItem("studentName");
          }
        }
      })
      .catch(() => {});
  }, []);

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
    if (!subjectKey || !canViewLearnNotes) {
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
  }, [subjectKey, canViewLearnNotes]);

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

  const { pages } = useMemo(() => buildLearnLinePages(groups), [groups]);
  const sectionCount = useMemo(() => countLearnSections(groups), [groups]);
  const { printRequest, busy: printBusy, requestPrint, clearPrint } =
    useLearnSubjectPrint();

  const sectionBlocks = useMemo(() => {
    const blocks = [];
    for (const page of pages) {
      const last = blocks[blocks.length - 1];
      if (last && last.section.id === page.section.id) {
        last.chunks.push(page);
      } else {
        blocks.push({
          group: page.group,
          section: page.section,
          chunks: [page],
        });
      }
    }
    let lastGroupId = null;
    return blocks.map((block) => {
      const showGroupHeader =
        Boolean(block.group.title) && block.group.id !== lastGroupId;
      if (showGroupHeader) {
        lastGroupId = block.group.id;
      }
      return { ...block, showGroupHeader };
    });
  }, [pages]);

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
                    {g.sections.map((sec) => (
                        <a
                          key={sec.id}
                          href={`#${sec.id}`}
                          className="flex items-baseline gap-1.5 text-xs leading-snug text-slate-700 hover:text-slate-950 py-px"
                        >
                          <span className="min-w-0">{sec.title}</span>
                        </a>
                      ))}
                  </div>
                ))}
              </nav>
            </aside>

            <div className="min-w-0">
              <LearnSubjectPrintHost printRequest={printRequest} onPrintDone={clearPrint} />

              <h1 className="text-2xl font-bold text-slate-950 mb-3">{data.title}</h1>
              {data.description ? (
                <p className="text-slate-700 text-sm mb-3 leading-relaxed">{data.description}</p>
              ) : null}
              {sectionCount > 1 ? (
                <p className="text-xs text-slate-500 mb-8 pb-8 border-b border-slate-200">
                  <LearnSubjectPdfTrigger
                    variant="link"
                    label="Download full collection (PDF)"
                    busy={printBusy}
                    onClick={() =>
                      requestPrint(
                        buildCollectionPrintRequest({
                          collectionTitle: data.title,
                          collectionDescription: data.description,
                          groups,
                          grade: data.grade,
                          curriculum: data.curriculum,
                        }),
                      )
                    }
                  />
                  <span className="text-slate-400">
                    {" "}
                    · Chrome or Safari → Print → Save as PDF
                  </span>
                </p>
              ) : (
                <div className="mb-8 pb-8 border-b border-slate-200" />
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
                        {g.sections.map((sec) => (
                            <a
                              key={sec.id}
                              href={`#${sec.id}`}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 bg-slate-100 px-2 py-1 rounded-lg"
                            >
                              {sec.title}
                            </a>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {showHighlightToolbar ? (
                <div className="sticky top-[4.5rem] lg:top-6 z-30 mb-6 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-sm shadow-sm px-3 py-2.5">
                  <LearnHighlightToolbar
                    activeColor={highlightColor}
                    onActiveColorChange={setHighlightColor}
                    eraserActive={highlightEraser}
                    onEraserActiveChange={setHighlightEraser}
                    disabled={!canEditLearnHighlights}
                    disabledHint={
                      canEditLearnHighlights
                        ? ""
                        : "Log in as a student to highlight and save."
                    }
                  />
                </div>
              ) : null}

              <div className="space-y-10">
                {sectionBlocks.map((block) => {
                  const showGroupHeader = block.showGroupHeader;

                  const sectionHeading = block.group.title ? (
                    <h3
                      id={block.section.id}
                      className="text-base font-bold text-slate-950 scroll-mt-48 min-w-0 flex-1"
                    >
                      {block.section.title}
                    </h3>
                  ) : (
                    <h2
                      id={block.section.id}
                      className="text-lg font-bold text-slate-950 scroll-mt-48 min-w-0 flex-1"
                    >
                      {block.section.title}
                    </h2>
                  );

                  const sectionHeadingRow = (
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      {sectionHeading}
                      <LearnSubjectPdfTrigger
                        label="PDF"
                        title={`Download “${block.section.title}” as PDF`}
                        busy={printBusy}
                        onClick={() =>
                          requestPrint(
                            buildSectionPrintRequest({
                              collectionTitle: data.title,
                              collectionDescription: data.description,
                              groups,
                              sectionId: block.section.id,
                              sectionTitle: block.section.title,
                              grade: data.grade,
                              curriculum: data.curriculum,
                            }),
                          )
                        }
                      />
                    </div>
                  );

                  return (
                    <article
                      key={block.section.id}
                      className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden scroll-mt-44"
                    >
                      {showGroupHeader ? (
                        <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-2 border-b border-slate-100">
                          <h2 className="text-lg font-bold text-slate-950">
                            {block.group.title}
                          </h2>
                        </div>
                      ) : null}

                      <div className="px-6 sm:px-8 py-6 sm:py-8 space-y-0">
                        {sectionHeadingRow}

                        {block.chunks.map((page, chunkIndex) => {
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

                          const chunkInner = (
                            <div
                              className={
                                chunkIndex > 0
                                  ? "pt-8 mt-8 border-t border-slate-100"
                                  : ""
                              }
                            >
                              {canViewLearnHighlights ? (
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
                                  showToolbar={false}
                                  activeColor={highlightColor}
                                  onActiveColorChange={setHighlightColor}
                                  eraserActive={highlightEraser}
                                  onEraserActiveChange={setHighlightEraser}
                                >
                                  {markdownBlock}
                                </LearnPageHighlighter>
                              ) : (
                                markdownBlock
                              )}
                            </div>
                          );

                          if (!canViewLearnNotes) {
                            return (
                              <div key={noteKey}>{chunkInner}</div>
                            );
                          }

                          return (
                            <div
                              key={noteKey}
                              className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-0 overflow-visible"
                            >
                              <div className="min-w-0 flex-1">{chunkInner}</div>
                              <LearnPageNotes
                                subjectKey={subjectKey}
                                sectionId={page.section.id}
                                pageIndex={page.pageIndexWithinSection}
                                pageMarkdown={page.markdown}
                                sectionTitle={block.section.title}
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
                    </article>
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
