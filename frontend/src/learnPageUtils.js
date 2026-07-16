/** Approximate lines of markdown per printed-style page. */
export const LEARN_LINES_PER_PAGE = 38;

/**
 * Split markdown into page chunks by line count, preferring breaks at blank lines.
 */
export function splitMarkdownByLines(
  markdown,
  linesPerPage = LEARN_LINES_PER_PAGE,
) {
  const text = (markdown || "").replace(/\r\n/g, "\n");
  if (!text.trim()) return [];

  const lines = text.split("\n");
  const pages = [];
  let start = 0;

  while (start < lines.length) {
    let end = Math.min(start + linesPerPage, lines.length);

    if (end < lines.length) {
      const minBreak = start + Math.max(1, Math.floor(linesPerPage * 0.65));
      let breakAt = end;
      for (let i = end - 1; i >= minBreak; i -= 1) {
        if (lines[i].trim() === "") {
          breakAt = i + 1;
          break;
        }
      }
      end = breakAt;
    }

    const chunk = lines.slice(start, end).join("\n").trim();
    if (chunk) pages.push(chunk);

    start = end;
    while (start < lines.length && lines[start].trim() === "") start += 1;
  }

  return pages.length ? pages : [text.trim()];
}

export function buildLearnLinePages(groups, linesPerPage = LEARN_LINES_PER_PAGE) {
  const pages = [];
  const sectionStarts = new Map();

  for (const group of groups || []) {
    for (const section of group.sections || []) {
      const chunks = splitMarkdownByLines(section.markdown, linesPerPage);
      chunks.forEach((markdown, chunkIndex) => {
        const pageNumber = pages.length + 1;
        if (chunkIndex === 0) {
          sectionStarts.set(section.id, pageNumber);
        }
        pages.push({
          group,
          section,
          markdown,
          pageNumber,
          isFirstPageOfSection: chunkIndex === 0,
          isContinuation: chunkIndex > 0,
        });
      });
    }
  }

  const totalPages = pages.length;
  for (const page of pages) {
    page.totalPages = totalPages;
  }

  return { pages, sectionStarts, totalPages };
}

export function formatLearnPageLabel(pageNumber, totalPages) {
  if (!pageNumber || !totalPages || totalPages <= 1) return null;
  return `Page ${pageNumber} of ${totalPages}`;
}

export function getSectionStartPage(sectionStarts, sectionId) {
  return sectionStarts.get(sectionId) ?? null;
}
