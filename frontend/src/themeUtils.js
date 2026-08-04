import {
  readScopedAppearanceValue,
  writeScopedAppearanceValue,
} from "./appearancePrefsScope.js";

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
  {
    id: "midnight",
    label: "Midnight",
    description: "Deep navy with cyan accents",
    swatch: ["#0f172a", "#22d3ee"],
    dark: true,
  },
  {
    id: "charcoal",
    label: "Charcoal",
    description: "Neutral dark gray with blue accents",
    swatch: ["#18181b", "#3b82f6"],
    dark: true,
  },
  {
    id: "wine",
    label: "Wine",
    description: "Dark plum with rose accents",
    swatch: ["#1c1017", "#fb7185"],
    dark: true,
  },
];

const VALID_THEME_IDS = new Set(COLOR_THEMES.map((theme) => theme.id));
const DARK_THEME_IDS = new Set(
  COLOR_THEMES.filter((theme) => theme.dark).map((theme) => theme.id),
);

export function isDarkColorTheme(themeId) {
  return DARK_THEME_IDS.has(normalizeColorTheme(themeId));
}

export function normalizeColorTheme(themeId) {
  return VALID_THEME_IDS.has(themeId) ? themeId : "default";
}

export function getStoredColorTheme() {
  try {
    return normalizeColorTheme(readScopedAppearanceValue(COLOR_THEME_STORAGE_KEY));
  } catch {
    return "default";
  }
}

export function applyColorTheme(themeId) {
  const normalized = normalizeColorTheme(themeId);
  document.documentElement.dataset.theme = normalized;
  document.documentElement.dataset.themeMode = isDarkColorTheme(normalized)
    ? "dark"
    : "light";
  return normalized;
}

export function setStoredColorTheme(themeId) {
  const normalized = normalizeColorTheme(themeId);
  writeScopedAppearanceValue(COLOR_THEME_STORAGE_KEY, normalized);
  applyColorTheme(normalized);
  return normalized;
}

export function initColorTheme() {
  return applyColorTheme(getStoredColorTheme());
}
