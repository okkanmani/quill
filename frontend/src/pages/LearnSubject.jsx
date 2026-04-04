import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getLearnSubject } from "../api";
import LearnChrome from "../components/LearnChrome";
import LearnMarkdown from "../components/LearnMarkdown";

/* Sticky TOC uses top-44 (~11rem) to sit below LearnChrome’s sticky header; bump if that bar grows. */

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

  const groups =
    data && data.groups?.length > 0
      ? data.groups
      : data
        ? [{ id: "", title: "", sections: data.sections ?? [] }]
        : [];

  return (
    <LearnChrome onBack={() => navigate("/student/learn")}>
      <div className="max-w-5xl">
        {loading && <p className="text-amber-600">Loading…</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {data && !loading && (
          <div className="lg:grid lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:gap-10 items-start">
            <aside className="hidden lg:block sticky top-44 z-30 mb-8 lg:mb-0 self-start max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-3">
                On this page
              </p>
              <nav className="flex flex-col gap-1 border-l-2 border-amber-200 pl-3 pb-2">
                {groups.map((g, gi) => (
                  <div key={g.id || `toc-${gi}`}>
                    {g.title ? (
                      <p
                        className={`text-[11px] font-bold uppercase tracking-wide text-amber-500 mb-1.5 ${
                          gi > 0 ? "mt-3" : ""
                        }`}
                      >
                        {g.title}
                      </p>
                    ) : null}
                    {g.sections.map((sec) => (
                      <a
                        key={sec.id}
                        href={`#${sec.id}`}
                        className="block text-sm text-amber-800 hover:text-amber-950 font-medium py-0.5"
                      >
                        {sec.title}
                      </a>
                    ))}
                  </div>
                ))}
              </nav>
            </aside>

            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-amber-950 mb-3">{data.title}</h1>
              {data.description ? (
                <p className="text-amber-700 text-sm mb-10 leading-relaxed border-b border-amber-200 pb-8">
                  {data.description}
                </p>
              ) : (
                <div className="mb-10 border-b border-amber-200 pb-8" />
              )}

              {/* Mobile TOC — sticky under app header */}
              <div className="lg:hidden sticky top-44 z-30 mb-8 rounded-xl border border-amber-200 bg-amber-50/95 backdrop-blur-sm shadow-sm p-4">
                <p className="text-xs font-semibold text-amber-600 mb-2">Sections</p>
                <div className="flex flex-col gap-3">
                  {groups.map((g, gi) => (
                    <div key={g.id || `mob-${gi}`}>
                      {g.title ? (
                        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-500 mb-1.5">
                          {g.title}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {g.sections.map((sec) => (
                          <a
                            key={sec.id}
                            href={`#${sec.id}`}
                            className="text-xs font-medium text-amber-800 bg-amber-100 px-2 py-1 rounded-lg"
                          >
                            {sec.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-white p-6 sm:p-8 shadow-sm space-y-12">
                {groups.map((g, gi) => (
                  <div key={g.id || `body-${gi}`} className="space-y-8">
                    {g.title ? (
                      <h2
                        id={g.id || undefined}
                        className="text-xl font-bold text-amber-950 pb-2 border-b border-amber-200 scroll-mt-44"
                      >
                        {g.title}
                      </h2>
                    ) : null}
                    {g.sections.map((sec) => (
                      <section
                        key={sec.id}
                        id={sec.id}
                        className="scroll-mt-44"
                      >
                        {g.title ? (
                          <h3 className="text-lg font-bold text-amber-950 mb-4 pb-2 border-b border-amber-100">
                            {sec.title}
                          </h3>
                        ) : (
                          <h2 className="text-xl font-bold text-amber-950 mb-4 pb-2 border-b border-amber-100">
                            {sec.title}
                          </h2>
                        )}
                        <div className="learn-md">
                          <LearnMarkdown markdown={sec.markdown} />
                        </div>
                      </section>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </LearnChrome>
  );
}
