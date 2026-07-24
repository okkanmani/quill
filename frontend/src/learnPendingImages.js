/** In-editor image blobs; markdown uses learn:pending:<id> instead of data URLs. */

const pendingImages = new Map();

const PENDING_SRC_RE = /^learn:pending:([a-f0-9-]+)$/i;

const PENDING_MARKDOWN_RE = /learn:pending:[a-f0-9-]+/i;

export function createPendingLearnImage(dataUrl) {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  pendingImages.set(id, { dataUrl: String(dataUrl || "") });
  return id;
}

export function getPendingLearnImageDataUrl(pendingId) {
  return pendingImages.get(pendingId)?.dataUrl || null;
}

export function isPendingLearnImageSrc(src) {
  return PENDING_SRC_RE.test(String(src || "").trim());
}

export function resolveLearnImageSrcForPreview(src) {
  const value = String(src || "").trim();
  const match = PENDING_SRC_RE.exec(value);
  if (!match) return value;
  return getPendingLearnImageDataUrl(match[1]) || "";
}

export function markdownHasPendingLearnImagePlaceholders(markdown) {
  return PENDING_MARKDOWN_RE.test(markdown || "");
}

/**
 * Replace learn:pending:* refs with data URLs before publish (server uploads to Tigris).
 */
export function expandPendingLearnImagesInMarkdown(markdown) {
  const text = markdown || "";
  const imageRe =
    /!\[([^\]]*)\]\(learn:pending:([a-f0-9-]+)(?:\s+"([^"]*)")?\)/gi;

  return text.replace(imageRe, (full, alt, id, title) => {
    const dataUrl = getPendingLearnImageDataUrl(id);
    if (!dataUrl) {
      throw new Error(
        "An image in this draft is missing from the editor session. Re-insert the image and try again.",
      );
    }
    const titlePart = title ? ` "${title}"` : "";
    return `![${alt}](${dataUrl}${titlePart})`;
  });
}

export function forgetPendingLearnImagesInMarkdown(markdown) {
  const text = markdown || "";
  const re = /learn:pending:([a-f0-9-]+)/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    pendingImages.delete(match[1]);
  }
}
