export const COLOR_THEME_STORAGE_KEY = "quillColorTheme";

export const COLOR_THEMES = [
  {
    id: "default",
    label: "Default",
    description: "Soft slate with indigo accents",
    swatch: ["#f8fafc", "#4f46e5"],
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Cool sky blues",
    swatch: ["#f0f9ff", "#0284c7"],
  },
  {
    id: "forest",
    label: "Forest",
    description: "Fresh greens",
    swatch: ["#f0fdf4", "#059669"],
  },
  {
    id: "sunset",
    label: "Sunset",
    description: "Warm amber tones",
    swatch: ["#fff7ed", "#ea580c"],
  },
  {
    id: "plum",
    label: "Plum",
    description: "Rich violet",
    swatch: ["#faf5ff", "#7c3aed"],
  },
];

const VALID_THEME_IDS = new Set(COLOR_THEMES.map((theme) => theme.id));

export function normalizeColorTheme(themeId) {
  return VALID_THEME_IDS.has(themeId) ? themeId : "default";
}

export function getStoredColorTheme() {
  try {
    return normalizeColorTheme(localStorage.getItem(COLOR_THEME_STORAGE_KEY));
  } catch {
    return "default";
  }
}

export function applyColorTheme(themeId) {
  const normalized = normalizeColorTheme(themeId);
  document.documentElement.dataset.theme = normalized;
  return normalized;
}

export function setStoredColorTheme(themeId) {
  const normalized = normalizeColorTheme(themeId);
  try {
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, normalized);
  } catch {
    /* ignore quota / private mode */
  }
  applyColorTheme(normalized);
  return normalized;
}

export function initColorTheme() {
  return applyColorTheme(getStoredColorTheme());
}
