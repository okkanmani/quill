export const FONT_STORAGE_KEY = "quillFont";

export const FONT_OPTIONS = [
  {
    id: "system",
    label: "System",
    description: "Your device’s default UI font",
    stack:
      'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  {
    id: "inter",
    label: "Inter",
    description: "Clean, modern sans serif",
    stack: '"Inter", system-ui, sans-serif',
  },
  {
    id: "source",
    label: "Source Sans",
    description: "Friendly sans for reading",
    stack: '"Source Sans 3", system-ui, sans-serif',
  },
  {
    id: "literata",
    label: "Literata",
    description: "Comfortable reading serif",
    stack: '"Literata", Georgia, "Times New Roman", serif',
  },
  {
    id: "merriweather",
    label: "Merriweather",
    description: "Classic book-style serif",
    stack: '"Merriweather", Georgia, "Times New Roman", serif',
  },
  {
    id: "hyperlegible",
    label: "Atkinson Hyperlegible",
    description: "Clear letterforms for easy reading",
    stack: '"Atkinson Hyperlegible", system-ui, sans-serif',
  },
  {
    id: "nunito",
    label: "Nunito",
    description: "Soft, rounded sans serif",
    stack: '"Nunito", system-ui, sans-serif',
  },
  {
    id: "bitter",
    label: "Bitter",
    description: "Sturdy slab serif",
    stack: '"Bitter", Georgia, "Times New Roman", serif',
  },
  {
    id: "fraunces",
    label: "Fraunces",
    description: "Expressive old-style serif",
    stack: '"Fraunces", Georgia, "Times New Roman", serif',
  },
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    description: "Clean monospace for focused reading",
    stack: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    description: "Geometric sans with character",
    stack: '"Space Grotesk", system-ui, sans-serif',
  },
];

const VALID_FONT_IDS = new Set(FONT_OPTIONS.map((font) => font.id));

export function getFontOption(fontId) {
  return FONT_OPTIONS.find((font) => font.id === fontId) ?? FONT_OPTIONS[0];
}

export function normalizeFont(fontId) {
  return VALID_FONT_IDS.has(fontId) ? fontId : "system";
}

export function getStoredFont() {
  try {
    return normalizeFont(localStorage.getItem(FONT_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function applyFont(fontId) {
  const normalized = normalizeFont(fontId);
  const font = getFontOption(normalized);
  document.documentElement.dataset.font = normalized;
  document.documentElement.style.setProperty("--quill-font-family", font.stack);
  return normalized;
}

export function setStoredFont(fontId) {
  const normalized = normalizeFont(fontId);
  try {
    localStorage.setItem(FONT_STORAGE_KEY, normalized);
  } catch {
    /* ignore quota / private mode */
  }
  applyFont(normalized);
  return normalized;
}

export function initFont() {
  return applyFont(getStoredFont());
}
