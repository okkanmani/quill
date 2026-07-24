/** Placeholder italic line inserted after new images; authors may edit or delete it. */
export const LEARN_IMAGE_CAPTION_PLACEHOLDER = "Caption";

/**
 * Split markdown into alternating prose blocks and learn figures (image + optional *caption* line).
 */
export function splitLearnMarkdownFigures(markdown) {
  const source = markdown || "";
  if (!source.trim()) {
    return [{ type: "markdown", text: source }];
  }

  const re =
    /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)(?:[ \t]*\n+[ \t]*\*([^*\n]+)\*)?/g;

  const parts = [];
  let lastIndex = 0;
  let match = re.exec(source);

  while (match) {
    if (match.index > lastIndex) {
      parts.push({ type: "markdown", text: source.slice(lastIndex, match.index) });
    }
    parts.push({
      type: "figure",
      alt: match[1],
      src: match[2],
      title: match[3] || "",
      caption: (match[4] || "").trim(),
    });
    lastIndex = re.lastIndex;
    match = re.exec(source);
  }

  if (lastIndex < source.length) {
    parts.push({ type: "markdown", text: source.slice(lastIndex) });
  }

  return parts.length ? parts : [{ type: "markdown", text: source }];
}

export function learnImageInsertSnippet(safeAlt, pendingId, title) {
  return `\n\n![${safeAlt}](learn:pending:${pendingId} "${title}")\n*${LEARN_IMAGE_CAPTION_PLACEHOLDER}*\n\n`;
}
