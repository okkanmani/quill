import { applyColorTheme, initColorTheme } from "./themeUtils.js";
import { applyFont, initFont } from "./fontUtils.js";

export const LOGIN_THEME_MODE_KEY = "quillLoginThemeMode";

const LOGIN_DARK_THEME_ID = "charcoal";
const LOGIN_LIGHT_THEME_ID = "default";

export function normalizeLoginThemeMode(mode) {
  return mode === "dark" ? "dark" : "light";
}

export function getStoredLoginThemeMode() {
  try {
    return normalizeLoginThemeMode(localStorage.getItem(LOGIN_THEME_MODE_KEY));
  } catch {
    return "light";
  }
}

export function setStoredLoginThemeMode(mode) {
  const normalized = normalizeLoginThemeMode(mode);
  try {
    localStorage.setItem(LOGIN_THEME_MODE_KEY, normalized);
  } catch {
    /* ignore */
  }
  applyLoginAppearance();
  return normalized;
}

export function applyLoginAppearance() {
  const mode = getStoredLoginThemeMode();
  applyColorTheme(mode === "dark" ? LOGIN_DARK_THEME_ID : LOGIN_LIGHT_THEME_ID);
  applyFont("system");
  document.documentElement.dataset.quillPage = "login";
}

export function clearLoginPageMarker() {
  delete document.documentElement.dataset.quillPage;
}

export function applyActiveUserAppearance() {
  clearLoginPageMarker();
  initColorTheme();
  initFont();
}
