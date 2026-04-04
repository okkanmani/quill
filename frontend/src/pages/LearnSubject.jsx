import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getLearnSubject } from "../api";
import LearnChrome from "../components/LearnChrome";
import LearnMarkdown from "../components/LearnMarkdown";

/* Sticky TOC uses top-44 (~11rem) to sit below LearnChrome’s sticky header; bump if that bar grows. */

export default function LearnSubject() {
  const { subjectKey } = useParams();
  const navigate = useNavigate();
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
                {data.sections.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className="text-sm text-amber-800 hover:text-amber-950 font-medium py-0.5"
                  >
                    {sec.title}
                  </a>
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
                <div className="flex flex-wrap gap-2">
                  {data.sections.map((sec) => (
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

              <div className="rounded-2xl border border-amber-200 bg-white p-6 sm:p-8 shadow-sm">
                {data.sections.map((sec) => (
                  <section key={sec.id} id={sec.id} className="scroll-mt-44">
                    <h2 className="text-xl font-bold text-amber-950 mb-4 pb-2 border-b border-amber-100">
                      {sec.title}
                    </h2>
                    <div className="learn-md">
                      <LearnMarkdown markdown={sec.markdown} />
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </LearnChrome>
  );
}
