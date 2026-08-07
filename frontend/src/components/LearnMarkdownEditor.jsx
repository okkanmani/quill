import { useRef, useState } from "react";
import LearnMarkdown from "./LearnMarkdown";
import LearnMarkdownToolbar from "./LearnMarkdownToolbar";
import { pasteImageIntoMarkdown, prepareLearnImagePaste } from "../learnImageMarkdown";
import { normalizeLearnImageOptions } from "../learnImagePresets";
import {
  CREATE_FIELD_HINT,
  CREATE_FIELD_LABEL,
  CREATE_SECTION_TITLE,
} from "../createTypography";
import AdminResourceCodeLabel from "./AdminResourceCodeLabel";

export default function LearnMarkdownEditor({
  title,
  markdown,
  onTitleChange,
  onMarkdownChange,
  adminCode = "",
  titleLabel = "Section title",
  titleHint = "Shown as the heading on the learning resource page.",
  publishLabel = "Publish",
  onPublish,
  publishing = false,
  headerActions = null,
  error = "",
  hideTitle = false,
  embedded = false,
  borderless = false,
}) {
  const textareaRef = useRef(null);
  const [mobilePane, setMobilePane] = useState("edit");
  const [imageError, setImageError] = useState("");
  const [imageSize, setImageSize] = useState("medium");
  const [imageLayout, setImageLayout] = useState("block");
  const [imageShape, setImageShape] = useState("landscape");

  function handlePaste(event) {
    const el = textareaRef.current;
    if (!el) return;
    if (!prepareLearnImagePaste(event)) return;

    void (async () => {
      try {
        const imageOptions = normalizeLearnImageOptions(
          imageSize,
          imageLayout,
          imageShape,
        );
        const edit = await pasteImageIntoMarkdown(
          event,
          el.value,
          el.selectionStart,
          el.selectionEnd,
          imageOptions,
        );
        if (!edit) return;
        onMarkdownChange(edit.value);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
        });
        setImageError("");
      } catch (err) {
        setImageError(err.message || "Could not paste image.");
      }
    })();
  }

  const editorShellClass = borderless
    ? "flex-1 grid lg:grid-cols-2 gap-0 overflow-hidden min-h-[28rem]"
    : "flex-1 grid lg:grid-cols-2 gap-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[28rem]";

  return (
    <div className={embedded ? "min-w-0" : "flex flex-col min-h-[calc(100vh-10rem)]"}>
      {!hideTitle ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {adminCode ? (
              <AdminResourceCodeLabel code={adminCode} className="mb-1.5" />
            ) : null}
            <label className={CREATE_FIELD_LABEL}>
              {titleLabel}
              <input
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                className="quill-field-input mt-1 w-full max-w-xl rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-950 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <span className={CREATE_FIELD_HINT}>
                {titleHint}
              </span>
            </label>
          </div>
          {headerActions}
        </div>
      ) : null}

      {!hideTitle && error ? (
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

      <div className={editorShellClass}>
        <div
          className={`flex flex-col border-slate-200 lg:border-r ${
            mobilePane === "edit" ? "flex" : "hidden lg:flex"
          }`}
        >
          <LearnMarkdownToolbar
            textareaRef={textareaRef}
            markdown={markdown}
            onChange={(value) => {
              setImageError("");
              onMarkdownChange(value);
            }}
            onImageError={setImageError}
            imageSize={imageSize}
            imageLayout={imageLayout}
            onImageSizeChange={setImageSize}
            onImageLayoutChange={setImageLayout}
            imageShape={imageShape}
            onImageShapeChange={setImageShape}
          />
          {imageError ? (
            <p className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-100">
              {imageError}
            </p>
          ) : null}
          <textarea
            ref={textareaRef}
            value={markdown}
            onChange={(e) => onMarkdownChange(e.target.value)}
            onPaste={handlePaste}
            spellCheck
            className="quill-field-textarea flex-1 w-full resize-none border-0 px-4 py-4 text-sm font-mono text-slate-900 leading-relaxed focus:outline-none focus:ring-0 min-h-[24rem]"
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
              <h2 className={`${CREATE_SECTION_TITLE} mb-4 pb-2 border-b border-slate-100`}>
                {title.trim() || "Section title"}
              </h2>
              <LearnMarkdown markdown={markdown || "_Nothing to preview yet._"} />
            </div>
          </div>
        </div>
      </div>

      {onPublish ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 transition"
          >
            {publishLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
