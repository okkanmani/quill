import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
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
import {
  displayLearnGroups,
  filterGroupsToSoloSection,
  filterGroupsToTopic,
  learnReaderHashScrollId,
  learnReaderScopedQuery,
  resolveSoloSectionId,
  resolveTopicFilterId,
  topicLabelFromGroups,
} from "../learnTopics";
import { scrollToLearnHashTarget } from "../learnReaderScroll";
import {
  LEARN_BODY,
  LEARN_BODY_RELAXED,
  LEARN_ERROR,
  LEARN_READER_H1,
  LEARN_READER_H2,
  LEARN_TOC_CHIP,
  LEARN_TOC_LABEL,
  LEARN_TOC_LINK,
  LEARN_TOPIC_EYEBROW,
} from "../learnTypography";
import { HUB_TOP_HEADER, HUB_TOP_SHELL } from "../hubSectionStyles";
import { WS_SECTION_TITLE } from "../worksheetAdminTypography";

/* Sticky TOC sits below the page top padding in the sidebar layout. */

/** AppShell back pill: sticky top-4 + button height — keep learn stickies below it. */
const LEARN_TOC_STICKY_CLASS =
  "sticky top-[4.75rem] z-30 mb-8 lg:mb-0 self-start max-h-[calc(100vh-5.5rem)] overflow-y-auto pr-0.5 pt-0.5";
const LEARN_HIGHLIGHT_STICKY_CLASS =
  "sticky top-[4.5rem] lg:top-[4.75rem] z-30 mb-6 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-sm shadow-sm px-3 py-2.5";

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
  const scrollKeyDoneRef = useRef(null);
  const hashScrollAllowedRef = useRef(false);
  const locationSnapshotRef = useRef(null);
  const notesExtrasReadyRef = useRef(false);
  const highlightsExtrasReadyRef = useRef(false);
  const [readerExtrasReady, setReaderExtrasReady] = useState(false);
  const [contentVisible, setContentVisible] = useState(true);

  function syncReaderExtrasReady() {
    const ready =
      notesExtrasReadyRef.current &&
      highlightsExtrasReadyRef.current;
    setReaderExtrasReady(ready);
  }

  function resetReaderExtrasReady() {
    notesExtrasReadyRef.current = false;
    highlightsExtrasReadyRef.current = false;
    setReaderExtrasReady(false);
  }
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

  useLayoutEffect(() => {
    const scopedOpen = learnReaderScopedQuery(location);
    const prev = locationSnapshotRef.current;
    const hashOnlyNavigation =
      prev != null &&
      prev.search === location.search &&
      prev.hash !== location.hash &&
      Boolean(location.hash);
    locationSnapshotRef.current = {
      search: location.search,
      hash: location.hash,
    };

    if (!location.hash) {
      hashScrollAllowedRef.current = false;
    } else if (hashOnlyNavigation) {
      hashScrollAllowedRef.current = true;
    } else if (scopedOpen) {
      hashScrollAllowedRef.current = false;
    } else {
      hashScrollAllowedRef.current = true;
    }
  }, [location.search, location.hash]);

  useEffect(() => {
    scrollKeyDoneRef.current = null;
    resetReaderExtrasReady();
    const scoped = learnReaderScopedQuery(location);
    setContentVisible(!location.hash || scoped);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [subjectKey, location.search]);

  useEffect(() => {
    scrollKeyDoneRef.current = null;
  }, [location.hash]);

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
      notesExtrasReadyRef.current = true;
      syncReaderExtrasReady();
      return;
    }
    notesExtrasReadyRef.current = false;
    syncReaderExtrasReady();
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
      })
      .finally(() => {
        notesExtrasReadyRef.current = true;
        syncReaderExtrasReady();
      });
  }, [subjectKey, canViewLearnNotes]);

  useEffect(() => {
    if (!subjectKey || !canViewLearnNotes) {
      setHighlightsByKey({});
      highlightsExtrasReadyRef.current = true;
      syncReaderExtrasReady();
      return;
    }
    highlightsExtrasReadyRef.current = false;
    syncReaderExtrasReady();
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
      })
      .finally(() => {
        highlightsExtrasReadyRef.current = true;
        syncReaderExtrasReady();
      });
  }, [subjectKey, canViewLearnNotes]);

  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      const previous = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
      return () => {
        window.history.scrollRestoration = previous;
      };
    }
  }, []);

  const groups = useMemo(() => {
    if (!data) return [];
    return data.groups?.length > 0
      ? data.groups
      : [{ id: "", title: "", sections: data.sections ?? [] }];
  }, [data]);

  const soloSectionId = useMemo(
    () => resolveSoloSectionId(location, data?.sections),
    [location.search, location.hash, data?.sections],
  );

  const topicFilterId = useMemo(
    () => resolveTopicFilterId(location, data?.sections),
    [location.search, location.hash, data?.sections],
  );

  const scopedToTopic = Boolean(topicFilterId && !soloSectionId);

  const displayGroups = useMemo(() => {
    let filtered = groups;
    if (soloSectionId) {
      filtered = filterGroupsToSoloSection(filtered, soloSectionId);
    } else if (topicFilterId) {
      filtered = filterGroupsToTopic(filtered, topicFilterId);
    }
    return displayLearnGroups(filtered);
  }, [groups, soloSectionId, topicFilterId]);

  const topicFilterLabel = useMemo(
    () => topicLabelFromGroups(groups, topicFilterId),
    [groups, topicFilterId],
  );

  const readerScoped = Boolean(soloSectionId || topicFilterId);

  const soloSectionTitle = useMemo(() => {
    if (!soloSectionId || !data?.sections) return "";
    const match = data.sections.find(
      (s) => (s.id || "").toLowerCase() === soloSectionId,
    );
    return match?.title || "";
  }, [soloSectionId, data?.sections]);

  const soloSectionDomId = useMemo(() => {
    if (!soloSectionId || !data?.sections) return undefined;
    const match = data.sections.find(
      (s) => (s.id || "").toLowerCase() === soloSectionId,
    );
    return match?.id;
  }, [soloSectionId, data?.sections]);

  const hashScrollTargetId = useMemo(
    () => learnReaderHashScrollId(location, data?.sections),
    [location.hash, location.search, data?.sections],
  );

  const { pages } = useMemo(() => buildLearnLinePages(displayGroups), [displayGroups]);
  const sectionCount = useMemo(() => countLearnSections(displayGroups), [displayGroups]);
  const fullCollectionSectionCount = useMemo(
    () => countLearnSections(groups),
    [groups],
  );
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
        !readerScoped &&
        Boolean(block.group.title) &&
        block.group.id !== lastGroupId;
      if (showGroupHeader) {
        lastGroupId = block.group.id;
      }
      return { ...block, showGroupHeader };
    });
  }, [pages, readerScoped]);

  const contentReady =
    !loading && Boolean(data?.sections?.length) && readerExtrasReady && pages.length > 0;

  useLayoutEffect(() => {
    if (!contentReady) return;

    const scrollKey = `${location.pathname}${location.search}${location.hash}`;

    const hashScrollId = hashScrollAllowedRef.current ? hashScrollTargetId : null;

    if (!hashScrollId) {
      window.scrollTo({ top: 0, behavior: "auto" });
      scrollKeyDoneRef.current = scrollKey;
      setContentVisible(true);
      return;
    }

    if (scrollKeyDoneRef.current === scrollKey) {
      setContentVisible(true);
      return;
    }

    let cancelled = false;
    setContentVisible(false);
    window.scrollTo({ top: 0, behavior: "auto" });

    (async () => {
      const root = document.getElementById("learn-reader-root");
      const ok = await scrollToLearnHashTarget(hashScrollId, { root });
      if (cancelled) return;
      if (ok) scrollKeyDoneRef.current = scrollKey;
      setContentVisible(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    contentReady,
    hashScrollTargetId,
    pages.length,
    location.hash,
    location.search,
    location.pathname,
  ]);

  const { sidebarCollapsed } = useShellLayout();
  const contentWidthClass =
    sidebarCollapsed || canViewLearnNotes ? "max-w-none" : "max-w-6xl";

  return (
    <LearnChrome onBack={() => navigate("/student/learn")}>
      <div className={contentWidthClass}>
        {loading && <QuillLoading label="Loading topic…" />}
        {error && <p className={LEARN_ERROR}>{error}</p>}

        {data && !loading && (
          <div
            id="learn-reader-root"
            className={`lg:grid lg:grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] lg:gap-6 items-start transition-opacity duration-75 [overflow-anchor:none] ${
              contentVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <aside className={`hidden lg:block ${LEARN_TOC_STICKY_CLASS}`}>
              <p className={`${LEARN_TOC_LABEL} mb-2`}>
                Contents
              </p>
              <nav className="flex flex-col gap-0.5 border-l border-slate-200 pl-2 pb-2 text-sm">
                {displayGroups.map((g, gi) => (
                  <div key={g.id || `toc-${gi}`}>
                    {g.title && !scopedToTopic ? (
                      <p
                        className={`${LEARN_TOPIC_EYEBROW} mb-1 leading-tight ${
                          gi > 0 ? "mt-2.5" : ""
                        }`}
                      >
                        {g.title}
                      </p>
                    ) : null}
                    {g.sections.map((sec) => (
                        <a
                          key={sec.id}
                          href={`#${sec.id}`}
                          className={`flex items-baseline gap-1.5 ${LEARN_TOC_LINK} py-0.5`}
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

              <h1
                id={soloSectionDomId}
                className={`${LEARN_READER_H1} mb-3 scroll-mt-48`}
              >
                {soloSectionId && soloSectionTitle
                  ? soloSectionTitle
                  : scopedToTopic && topicFilterLabel
                    ? topicFilterLabel
                    : data.title}
              </h1>
              {readerScoped ? (
                <p className={`${LEARN_BODY} mb-3`}>
                  {data.title}
                  {" · "}
                  <Link
                    to={`/student/learn/${encodeURIComponent(subjectKey)}`}
                    className="font-semibold text-indigo-700 hover:text-indigo-900 underline"
                  >
                    View full collection
                  </Link>
                </p>
              ) : null}
              {!readerScoped && data.description ? (
                <p className={`${LEARN_BODY_RELAXED} mb-3`}>{data.description}</p>
              ) : null}
              {!readerScoped && fullCollectionSectionCount > 1 ? (
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
                          groups: displayGroups,
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
                <p className={`${LEARN_TOC_LABEL} mb-2`}>
                  Contents
                </p>
                <div className="flex flex-col gap-3 text-sm">
                  {displayGroups.map((g, gi) => (
                    <div key={g.id || `mob-${gi}`}>
                      {g.title && !scopedToTopic ? (
                        <p className={`${LEARN_TOPIC_EYEBROW} mb-1.5`}>
                          {g.title}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {g.sections.map((sec) => (
                            <a
                              key={sec.id}
                              href={`#${sec.id}`}
                              className={`inline-flex items-center gap-1.5 ${LEARN_TOC_CHIP}`}
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
                <div className={LEARN_HIGHLIGHT_STICKY_CLASS}>
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

                  const sectionHeading = soloSectionId ? null : (
                    <h2
                      id={block.section.id}
                      className={`${LEARN_READER_H2} scroll-mt-48 min-w-0 flex-1`}
                    >
                      {block.section.title}
                    </h2>
                  );

                  const sectionHeadingRow = soloSectionId ? (
                    <div className="flex flex-wrap items-start justify-end gap-3 mb-2">
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
                  ) : (
                    <div
                      className={`flex flex-wrap items-start justify-between gap-3 mb-4`}
                    >
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
                      className={`${HUB_TOP_SHELL} scroll-mt-44`}
                    >
                      {showGroupHeader ? (
                        <div className={`${HUB_TOP_HEADER} border-b-0 pb-2`}>
                          <p className={WS_SECTION_TITLE}>{block.group.title}</p>
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
                              <LearnMarkdown
                                markdown={page.markdown}
                                eagerImages={page.isFirstPageOfSection}
                              />
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
