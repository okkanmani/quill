import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getLearnSubject } from "../api";
import LearnChrome from "../components/LearnChrome";
import LearnMarkdown from "../components/LearnMarkdown";
import { LearnPageSheet } from "../components/LearnPageLabel";
import QuillLoading from "../components/QuillLoading";
import { buildLearnLinePages, getSectionStartPage } from "../learnPageUtils";

/* Sticky TOC sits below the page top padding in the sidebar layout. */

export default function LearnSubject() {
  const { subjectKey } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!subjectKey) return;
    setLoading(true);
    getLearnSubject(subjectKey)
      .then(setData)
      .catch(() => setError("Could not load this topic."))
      .finally(() => setLoading(false));
  }, [subjectKey]);

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

  return (
    <LearnChrome onBack={() => navigate("/student/learn")}>
      <div className="max-w-5xl">
        {loading && <QuillLoading label="Loading topic…" />}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {data && !loading && (
          <div className="lg:grid lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:gap-10 items-start">
            <aside className="hidden lg:block sticky top-6 z-30 mb-8 lg:mb-0 self-start max-h-[calc(100vh-3rem)] overflow-y-auto pr-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-3">
                On this page
              </p>
              <nav className="flex flex-col gap-1 border-l-2 border-slate-200 pl-3 pb-2">
                {groups.map((g, gi) => (
                  <div key={g.id || `toc-${gi}`}>
                    {g.title ? (
                      <p
                        className={`text-[11px] font-bold uppercase tracking-wide text-indigo-500 mb-1.5 ${
                          gi > 0 ? "mt-3" : ""
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
                          className="flex items-baseline gap-2 text-sm text-slate-800 hover:text-slate-950 font-medium py-0.5"
                        >
                          {showPageNumbers && startPage ? (
                            <span className="shrink-0 w-5 text-right text-xs font-semibold text-slate-500 tabular-nums">
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

                  const pageBody = (
                    <>
                      {showGroupHeader ? (
                        <h2 className="text-xl font-bold text-slate-950 pb-3 mb-4 border-b border-slate-200">
                          {page.group.title}
                        </h2>
                      ) : null}

                      {page.isFirstPageOfSection ? (
                        page.group.title ? (
                          <h3
                            id={page.section.id}
                            className="text-lg font-bold text-slate-950 mb-4 scroll-mt-44"
                          >
                            {page.section.title}
                          </h3>
                        ) : (
                          <h2
                            id={page.section.id}
                            className="text-xl font-bold text-slate-950 mb-4 scroll-mt-44"
                          >
                            {page.section.title}
                          </h2>
                        )
                      ) : (
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
                          {page.section.title} · continued
                        </p>
                      )}

                      <div className="learn-md">
                        <LearnMarkdown markdown={page.markdown} />
                      </div>
                    </>
                  );

                  if (!showPageNumbers) {
                    return (
                      <div
                        key={`${page.section.id}-${page.pageNumber}`}
                        className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm scroll-mt-44"
                      >
                        {pageBody}
                      </div>
                    );
                  }

                  return (
                    <LearnPageSheet
                      key={`${page.section.id}-${page.pageNumber}`}
                      pageNumber={page.pageNumber}
                      totalPages={page.totalPages}
                      className="scroll-mt-44"
                    >
                      {pageBody}
                    </LearnPageSheet>
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
