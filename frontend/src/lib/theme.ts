/**
 * Light (paper) or dark (ink) theme. The visitor's pick is remembered in this browser only;
 * with no pick, the system setting decides. index.html applies it before the first paint,
 * so the page never flashes the wrong theme.
 */
export type Theme = "light" | "dark";

const KEY = "mockmate-theme";

export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;   // private window or blocked storage: follow the system
  }
}

export function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // still switch for this visit
  }
  document.documentElement.classList.toggle("dark", theme === "dark");
}
