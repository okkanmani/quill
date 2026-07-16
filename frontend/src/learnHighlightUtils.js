export const LEARN_HIGHLIGHT_COLORS = [
  {
    id: "orange",
    label: "Orange",
    className: "learn-hl-orange",
    swatchClass: "bg-amber-300 ring-amber-500/60",
  },
  {
    id: "green",
    label: "Green",
    className: "learn-hl-green",
    swatchClass: "bg-emerald-300 ring-emerald-500/60",
  },
  {
    id: "blue",
    label: "Blue",
    className: "learn-hl-blue",
    swatchClass: "bg-sky-300 ring-sky-500/60",
  },
];

export const LEARN_HIGHLIGHT_COLOR_IDS = new Set(
  LEARN_HIGHLIGHT_COLORS.map((color) => color.id),
);

export const LEARN_HIGHLIGHT_COLOR_STORAGE_KEY = "quillLearnHighlightColor";

export function getStoredLearnHighlightColor() {
  try {
    const stored = localStorage.getItem(LEARN_HIGHLIGHT_COLOR_STORAGE_KEY);
    if (stored && LEARN_HIGHLIGHT_COLOR_IDS.has(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "orange";
}

export function setStoredLearnHighlightColor(color) {
  const next = LEARN_HIGHLIGHT_COLOR_IDS.has(color) ? color : "orange";
  try {
    localStorage.setItem(LEARN_HIGHLIGHT_COLOR_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

export function createHighlightId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `hl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function highlightClassForColor(color) {
  const match = LEARN_HIGHLIGHT_COLORS.find((item) => item.id === color);
  return match?.className || "learn-hl-orange";
}

function unwrapMark(mark) {
  const parent = mark.parentNode;
  if (!parent) return;
  while (mark.firstChild) {
    parent.insertBefore(mark.firstChild, mark);
  }
  parent.removeChild(mark);
}

export function clearHighlightMarks(root) {
  if (!root) return;
  root.querySelectorAll("mark.learn-hl").forEach((mark) => unwrapMark(mark));
}

export function getRangeCharacterOffset(container, range) {
  const preRange = range.cloneRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

export function serializeHighlight(container, range, color) {
  const exact = range.toString();
  const start = getRangeCharacterOffset(container, range);
  const full = container.textContent || "";
  const end = start + exact.length;
  return {
    id: createHighlightId(),
    color,
    exact,
    prefix: full.slice(Math.max(0, start - 48), start),
    suffix: full.slice(end, end + 48),
  };
}

function createRangeFromOffsets(container, start, end) {
  const range = document.createRange();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let charIndex = 0;
  let startSet = false;
  let node = walker.nextNode();

  while (node) {
    const length = node.textContent?.length || 0;
    const nodeStart = charIndex;
    const nodeEnd = charIndex + length;

    if (!startSet && start >= nodeStart && start <= nodeEnd) {
      range.setStart(node, start - nodeStart);
      startSet = true;
    }
    if (startSet && end >= nodeStart && end <= nodeEnd) {
      range.setEnd(node, end - nodeStart);
      return range;
    }

    charIndex = nodeEnd;
    node = walker.nextNode();
  }

  return null;
}

export function findRangeForHighlight(container, highlight) {
  const full = container.textContent || "";
  const exact = highlight?.exact || "";
  if (!exact) return null;

  const prefix = highlight.prefix || "";
  const suffix = highlight.suffix || "";
  const withContext = `${prefix}${exact}${suffix}`;
  let start = full.indexOf(withContext);
  if (start !== -1) {
    start += prefix.length;
  } else {
    start = full.indexOf(exact);
  }
  if (start === -1) return null;

  return createRangeFromOffsets(container, start, start + exact.length);
}

export function wrapRangeWithHighlight(range, color, id) {
  if (!range || range.collapsed) return null;

  const mark = document.createElement("mark");
  mark.className = `learn-hl ${highlightClassForColor(color)}`;
  mark.dataset.hlId = id;

  const contents = range.extractContents();
  mark.appendChild(contents);
  range.insertNode(mark);
  return mark;
}

export function applyHighlightsToContainer(container, highlights) {
  if (!container) return;
  clearHighlightMarks(container);

  const sorted = [...(highlights || [])].sort((a, b) => {
    const rangeA = findRangeForHighlight(container, a);
    const rangeB = findRangeForHighlight(container, b);
    if (!rangeA || !rangeB) return 0;
    return (
      getRangeCharacterOffset(container, rangeB) -
      getRangeCharacterOffset(container, rangeA)
    );
  });

  for (const highlight of sorted) {
    const range = findRangeForHighlight(container, highlight);
    if (!range) continue;
    wrapRangeWithHighlight(range, highlight.color, highlight.id);
  }
}

export function removeHighlightMark(mark) {
  if (!mark) return null;
  const id = mark.dataset.hlId || null;
  unwrapMark(mark);
  return id;
}

export function selectionTouchesExistingHighlight(range) {
  if (!range) return false;
  const probe = range.cloneContents();
  if (probe.querySelector?.("mark.learn-hl")) return true;

  let node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (node?.closest?.("mark.learn-hl")) return true;

  node = range.endContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (node?.closest?.("mark.learn-hl")) return true;

  return false;
}
