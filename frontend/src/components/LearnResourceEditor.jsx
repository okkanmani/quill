import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAdminLearnSections, getLearnSubject, updateLearnSection } from "../api";
import LearnMarkdownEditor from "./LearnMarkdownEditor";
import QuillLoading from "./QuillLoading";
import {
  expandPendingLearnImagesInMarkdown,
  markdownHasPendingLearnImages,
} from "../learnImageMarkdown";
import { forgetPendingLearnImagesInMarkdown } from "../learnPendingImages";
import {
  authorTopicFromSection,
  learnSectionReaderUrl,
  sectionForReaderUrl,
} from "../learnTopics";
import { CREATE_FIELD_LABEL } from "../createTypography";

export default function LearnResourceEditor({ subjectKey, sectionId }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [collectionTitle, setCollectionTitle] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!subjectKey || !sectionId) return;
    setLoading(true);
    Promise.all([getLearnSubject(subjectKey), getAdminLearnSections()])
      .then(([data, adminData]) => {
        const section = (data.sections || []).find(
          (sec) => sec.id === sectionId && sec.source === "db",
        );
        if (!section) {
          throw new Error("This learning resource is not editable.");
        }
        const adminSection = (adminData.sections || []).find(
          (row) =>
            row.subject_key === subjectKey && row.section_id === sectionId,
        );
        setCollectionTitle(data.title || subjectKey);
        setTitle(section.title || "");
        setTopic(authorTopicFromSection(section));
        setMarkdown(section.markdown || "");
        setAdminCode(adminSection?.admin_code || "");
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
      const markdownForPublish = expandPendingLearnImagesInMarkdown(markdown.trim());
      const result = await updateLearnSection(subjectKey, sectionId, {
        title: title.trim(),
        topic: topic.trim(),
        markdown: markdownForPublish,
      });
      forgetPendingLearnImagesInMarkdown(markdown);
      navigate(
        learnSectionReaderUrl(
          sectionForReaderUrl(result.subject_key, result.section_id, topic.trim()),
        ),
        { replace: true },
      );
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

  const learnUrl = learnSectionReaderUrl(
    sectionForReaderUrl(subjectKey, sectionId, topic.trim()),
  );

  const republishLabel = saving
    ? markdownHasPendingLearnImages(markdown)
      ? "Uploading images & republishing…"
      : "Republishing…"
    : "Republish";

  return (
    <div className="space-y-4">
      <label className={CREATE_FIELD_LABEL}>
        Topic <span className="font-normal text-slate-500">(optional)</span>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Calculus — leave blank for Miscellaneous"
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </label>
      <LearnMarkdownEditor
        title={title}
        markdown={markdown}
        adminCode={adminCode}
        onTitleChange={setTitle}
        onMarkdownChange={setMarkdown}
        titleLabel="Sub-topic"
        titleHint="One focused slice — shown as the section heading."
        publishLabel={republishLabel}
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
    </div>
  );
}
