import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getLearnSubject, updateLearnSection } from "../api";
import LearnMarkdownEditor from "./LearnMarkdownEditor";
import QuillLoading from "./QuillLoading";

export default function LearnResourceEditor({ subjectKey, sectionId }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [collectionTitle, setCollectionTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    <LearnMarkdownEditor
      title={title}
      markdown={markdown}
      onTitleChange={setTitle}
      onMarkdownChange={setMarkdown}
      titleHint="Shown as the heading on the learning resource page."
      publishLabel="Republish"
      onPublish={handleRepublish}
      publishing={saving}
      error={error}
      headerActions={
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mr-2">
            {collectionTitle}
          </p>
          <Link
            to={learnUrl}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
        </div>
      }
    />
  );
}
