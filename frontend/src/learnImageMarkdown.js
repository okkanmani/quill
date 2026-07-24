import {
  normalizeLearnImageOptions,
  serializeLearnImageTitle,
} from "./learnImagePresets";
import {
  createPendingLearnImage,
  expandPendingLearnImagesInMarkdown,
  markdownHasPendingLearnImagePlaceholders,
} from "./learnPendingImages";

const DATA_IMAGE_MARKDOWN_RE =
  /!\[[^\]]*\]\(data:image\/(jpeg|jpg|png|gif|webp);base64,/i;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const DATA_URL_CLIPBOARD_RE = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/i;

export function markdownHasPendingLearnImages(markdown) {
  return (
    DATA_IMAGE_MARKDOWN_RE.test(markdown || "") ||
    markdownHasPendingLearnImagePlaceholders(markdown)
  );
}

export { expandPendingLearnImagesInMarkdown };

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

export function defaultImageAlt(file) {
  const name = (file?.name || "image").replace(/\.[^.]+$/, "");
  return name.trim() || "image";
}

export function insertMarkdownImage(
  text,
  selectionStart,
  selectionEnd,
  dataUrl,
  alt,
  imageOptions = {},
) {
  const { size = "medium", layout = "block", shape = "landscape" } =
    normalizeLearnImageOptions(
      imageOptions.size,
      imageOptions.layout,
      imageOptions.shape,
    );
  const safeAlt = (alt || "image").replace(/]/g, "");
  const title = serializeLearnImageTitle(size, layout, shape);
  const pendingId = createPendingLearnImage(dataUrl);
  const snippet = `\n\n![${safeAlt}](learn:pending:${pendingId} "${title}")\n\n`;
  const next = `${text.slice(0, selectionStart)}${snippet}${text.slice(selectionEnd)}`;
  const cursor = selectionStart + snippet.length;
  return { value: next, selectionStart: cursor, selectionEnd: cursor };
}

export function isAllowedLearnImageFile(file) {
  if (!file) return false;
  if (ALLOWED_IMAGE_TYPES.has(file.type)) return true;
  return /\.(jpe?g|png|gif|webp)$/i.test(file.name || "");
}

export async function imageFileToMarkdownInsert(
  file,
  text,
  selectionStart,
  selectionEnd,
  imageOptions = {},
) {
  if (!isAllowedLearnImageFile(file)) {
    throw new Error("Use JPEG, PNG, WebP, or GIF images.");
  }
  const dataUrl = await readFileAsDataUrl(file);
  return insertMarkdownImage(
    text,
    selectionStart,
    selectionEnd,
    dataUrl,
    defaultImageAlt(file),
    imageOptions,
  );
}

export function shouldInterceptLearnImagePaste(event) {
  const cd = event.clipboardData;
  if (!cd) return false;

  const items = cd.items;
  if (items) {
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        return true;
      }
    }
  }

  const plain = (cd.getData("text/plain") || "").trim();
  if (DATA_URL_CLIPBOARD_RE.test(plain)) {
    return true;
  }

  const html = cd.getData("text/html") || "";
  if (/src=["']data:image\//i.test(html)) {
    return true;
  }

  return false;
}

/** Call synchronously at the start of paste — blocks raw base64 text landing in the textarea. */
export function prepareLearnImagePaste(event) {
  if (!shouldInterceptLearnImagePaste(event)) {
    return false;
  }
  event.preventDefault();
  return true;
}

function extractDataImageSrcFromHtml(html) {
  const match = html.match(/src=["'](data:image\/[^"']+)["']/i);
  return match?.[1] || "";
}

export function clipboardHasImage(event) {
  return shouldInterceptLearnImagePaste(event);
}

export async function pasteImageIntoMarkdown(
  event,
  text,
  selectionStart,
  selectionEnd,
  imageOptions = {},
) {
  const items = event.clipboardData?.items;
  if (items) {
    for (const item of items) {
      if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      return imageFileToMarkdownInsert(
        file,
        text,
        selectionStart,
        selectionEnd,
        imageOptions,
      );
    }
  }

  const plain = (event.clipboardData?.getData("text/plain") || "").trim();
  if (DATA_URL_CLIPBOARD_RE.test(plain)) {
    return insertMarkdownImage(
      text,
      selectionStart,
      selectionEnd,
      plain,
      "image",
      imageOptions,
    );
  }

  const htmlSrc = extractDataImageSrcFromHtml(
    event.clipboardData?.getData("text/html") || "",
  );
  if (DATA_URL_CLIPBOARD_RE.test(htmlSrc)) {
    return insertMarkdownImage(
      text,
      selectionStart,
      selectionEnd,
      htmlSrc,
      "image",
      imageOptions,
    );
  }

  return null;
}
