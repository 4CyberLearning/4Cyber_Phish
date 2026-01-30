import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ui.theme"; // "light" | "dark" | "system"
const THEMES = ["light", "dark", "system"];

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}

export function applyTheme(theme) {
  const t = THEMES.includes(theme) ? theme : "system";
  const isDark = t === "dark" || (t === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
  return { theme: t, isDark };
}

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY) || "system";
  applyTheme(saved);
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => localStorage.getItem(STORAGE_KEY) || "system");

  const isDark = useMemo(() => theme === "dark" || (theme === "system" && systemPrefersDark()), [theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const effectiveDark = theme === "dark" || (theme === "system" && systemPrefersDark());
    setThemeState(effectiveDark ? "light" : "dark");
  };

  return { theme, isDark, setTheme: setThemeState, toggleTheme };
}
