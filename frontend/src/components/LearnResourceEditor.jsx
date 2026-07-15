import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getLearnSubject, updateLearnSection } from "../api";
import LearnMarkdown from "./LearnMarkdown";
import QuillLoading from "./QuillLoading";

export default function LearnResourceEditor({ subjectKey, sectionId }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [collectionTitle, setCollectionTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mobilePane, setMobilePane] = useState("edit");

  useEffect(() => {
    if (!subjectKey || !sectionId) return;
    setLoading(true);
    getLearnSubject(subjectKey)
      .then((data) => {
        const section = (data.sections || []).find(
          (sec) => sec.id === sectionId && sec.source === "db",
        );
        if (!section) {
          throw new Error("This learning resource is not editable.");
        }
        setCollectionTitle(data.title || subjectKey);
        setTitle(section.title || "");
        setMarkdown(section.markdown || "");
        setError("");
      })
      .catch((err) => {
        setError(err.message || "Could not load this resource.");
      })
      .finally(() => setLoading(false));
  }, [subjectKey, sectionId]);

  async function handleRepublish() {
    setError("");
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!markdown.trim()) {
      setError("Content is required.");
      return;
    }

    setSaving(true);
    try {
      const result = await updateLearnSection(subjectKey, sectionId, {
        title: title.trim(),
        markdown: markdown.trim(),
      });
      navigate(`/student/learn/${result.subject_key}#${result.section_id}`, {
        replace: true,
      });
    } catch (err) {
      setError(err.message || "Could not republish.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <QuillLoading label="Loading editor…" />;
  }

  if (error && !title && !markdown) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}{" "}
        <Link
          to={`/student/learn/${subjectKey}`}
          className="font-semibold underline"
        >
          Back to resource
        </Link>
      </div>
    );
  }

  const learnUrl = `/student/learn/${subjectKey}#${sectionId}`;

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
            {collectionTitle}
          </p>
          <label className="block text-sm font-semibold text-slate-800">
            Section title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full max-w-xl rounded-xl border border-slate-300 px-3 py-2 text-lg font-bold text-slate-950 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Shown as the heading on the learning resource page.
            </span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            to={learnUrl}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleRepublish}
            disabled={saving}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 transition"
          >
            {saving ? "Publishing…" : "Republish"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="lg:hidden flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMobilePane("edit")}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            mobilePane === "edit"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setMobilePane("preview")}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            mobilePane === "preview"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          Preview
        </button>
      </div>

      <div className="flex-1 grid lg:grid-cols-2 gap-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[28rem]">
        <div
          className={`flex flex-col border-slate-200 lg:border-r ${
            mobilePane === "edit" ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Markdown
          </div>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            spellCheck
            className="flex-1 w-full resize-none border-0 px-4 py-4 text-sm font-mono text-slate-900 leading-relaxed focus:outline-none focus:ring-0 min-h-[24rem]"
            placeholder="Write markdown content…"
          />
        </div>

        <div
          className={`flex flex-col bg-slate-50/60 ${
            mobilePane === "preview" ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className="px-4 py-2 border-b border-slate-200 bg-white text-xs font-semibold uppercase tracking-wide text-slate-600">
            Preview
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            <div className="learn-md rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950 mb-4 pb-2 border-b border-slate-100">
                {title.trim() || "Section title"}
              </h2>
              <LearnMarkdown markdown={markdown || "_Nothing to preview yet._"} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
