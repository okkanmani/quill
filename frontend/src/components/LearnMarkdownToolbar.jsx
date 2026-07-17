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

export default function LearnMarkdownToolbar({ textareaRef, onChange }) {
  function runAction(action) {
    const el = textareaRef?.current;
    if (!el) return;
    const { value, selectionStart, selectionEnd } = applyMarkdownAction(
      el.value,
      el.selectionStart,
      el.selectionEnd,
      action,
    );
    onChange(value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-slate-200 bg-white">
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
    </div>
  );
}
