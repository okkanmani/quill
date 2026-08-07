import { useEffect, useRef } from "react";
import {
  imageFileToMarkdownInsert,
  markdownHasPendingLearnImages,
} from "../learnImageMarkdown";
import {
  LEARN_IMAGE_LAYOUTS,
  LEARN_IMAGE_SHAPES,
  LEARN_IMAGE_SIZES,
  layoutOptionsForSize,
  normalizeLearnImageOptions,
} from "../learnImagePresets";

const TOOLBAR_ACTIONS = [
  { id: "h2", label: "H2", title: "Heading 2", prefix: "## ", suffix: "", block: true },
  { id: "h3", label: "H3", title: "Heading 3", prefix: "### ", suffix: "", block: true },
  { id: "bold", label: "B", title: "Bold", prefix: "**", suffix: "**" },
  { id: "italic", label: "I", title: "Italic", prefix: "_", suffix: "_" },
  {
    id: "ul",
    label: "• List",
    title: "Bullet list",
    prefix: "- ",
    suffix: "",
    block: true,
  },
  {
    id: "ol",
    label: "1. List",
    title: "Numbered list",
    prefix: "1. ",
    suffix: "",
    block: true,
  },
  {
    id: "quote",
    label: "Quote",
    title: "Blockquote",
    prefix: "> ",
    suffix: "",
    block: true,
  },
  {
    id: "code",
    label: "Code",
    title: "Inline code",
    prefix: "`",
    suffix: "`",
  },
  {
    id: "link",
    label: "Link",
    title: "Link",
    prefix: "[",
    suffix: "](https://)",
  },
  {
    id: "hr",
    label: "—",
    title: "Horizontal rule",
    prefix: "\n\n---\n\n",
    suffix: "",
    insertOnly: true,
  },
  {
    id: "table",
    label: "Table",
    title: "Table",
    prefix: "\n| Column A | Column B |\n| --- | --- |\n|  |  |\n",
    suffix: "",
    insertOnly: true,
  },
];

function applyMarkdownAction(text, selectionStart, selectionEnd, action) {
  const selected = text.slice(selectionStart, selectionEnd);
  if (action.insertOnly) {
    const next = `${text.slice(0, selectionStart)}${action.prefix}${text.slice(selectionEnd)}`;
    const cursor = selectionStart + action.prefix.length;
    return { value: next, selectionStart: cursor, selectionEnd: cursor };
  }

  if (action.block && !selected && selectionStart > 0) {
    const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;
    const before = text.slice(0, lineStart);
    const line = text.slice(lineStart, selectionEnd);
    const after = text.slice(selectionEnd);
    const nextLine = `${action.prefix}${line}`;
    const next = `${before}${nextLine}${after}`;
    const cursor = lineStart + nextLine.length;
    return { value: next, selectionStart: cursor, selectionEnd: cursor };
  }

  const inner = selected || "text";
  const wrapped = `${action.prefix}${inner}${action.suffix}`;
  const next = `${text.slice(0, selectionStart)}${wrapped}${text.slice(selectionEnd)}`;
  const start = selectionStart + action.prefix.length;
  const end = start + inner.length;
  return { value: next, selectionStart: start, selectionEnd: end };
}

export default function LearnMarkdownToolbar({
  textareaRef,
  markdown,
  onChange,
  onImageError,
  imageSize,
  imageLayout,
  onImageSizeChange,
  onImageLayoutChange,
  imageShape,
  onImageShapeChange,
}) {
  const fileInputRef = useRef(null);
  const layoutOptions = layoutOptionsForSize(imageSize);

  useEffect(() => {
    if (!layoutOptions.some((option) => option.id === imageLayout)) {
      onImageLayoutChange("block");
    }
  }, [imageSize, imageLayout, layoutOptions, onImageLayoutChange]);

  function applyEdit({ value, selectionStart, selectionEnd }) {
    onChange(value);
    requestAnimationFrame(() => {
      const el = textareaRef?.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function runAction(action) {
    const el = textareaRef?.current;
    if (!el) return;
    applyEdit(
      applyMarkdownAction(
        el.value,
        el.selectionStart,
        el.selectionEnd,
        action,
      ),
    );
  }

  async function handleImageFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const el = textareaRef?.current;
    if (!el) return;
    try {
      const options = normalizeLearnImageOptions(imageSize, imageLayout, imageShape);
      const edit = await imageFileToMarkdownInsert(
        file,
        el.value,
        el.selectionStart,
        el.selectionEnd,
        options,
      );
      applyEdit(edit);
    } catch (err) {
      onImageError?.(err.message || "Could not insert image.");
    }
  }

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-1 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mr-1">
          Format
        </span>
        {TOOLBAR_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            title={action.title}
            onClick={() => runAction(action)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-800 transition"
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          title="Insert image (uploaded when you publish)"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-800 transition"
        >
          Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleImageFileChange}
        />
        {markdownHasPendingLearnImages(markdown) ? (
          <span className="ml-auto text-[10px] font-medium text-amber-800">
            Images upload on publish
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-slate-100 bg-slate-50/80">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Image defaults
        </span>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          Size
          <select
            value={imageSize}
            onChange={(e) => onImageSizeChange(e.target.value)}
            className="quill-field-select rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
          >
            {LEARN_IMAGE_SIZES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          Layout
          <select
            value={imageLayout}
            onChange={(e) => onImageLayoutChange(e.target.value)}
            className="quill-field-select rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 max-w-[12rem]"
          >
            {(layoutOptions.length ? layoutOptions : LEARN_IMAGE_LAYOUTS).map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          Frame
          <select
            value={imageShape}
            onChange={(e) => onImageShapeChange(e.target.value)}
            className="quill-field-select rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
          >
            {LEARN_IMAGE_SHAPES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[10px] text-slate-500">
          Applies to the next image insert or paste. Adds an optional *Caption* line below.
        </span>
      </div>
    </div>
  );
}
