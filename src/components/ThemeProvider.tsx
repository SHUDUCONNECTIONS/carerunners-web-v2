"use client";

import * as React from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "carerunners-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(
  undefined
);

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (e.g. privacy mode) - ignore and fall through.
  }

  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to "light" for the initial render so server and client markup
  // match; the inline script in the document head already applied the
  // correct class to <html> before hydration to avoid a flash of the
  // wrong theme. We sync this piece of state on mount.
  const [theme, setThemeState] = React.useState<Theme>("light");

  React.useEffect(() => {
    setThemeState(getPreferredTheme());
  }, []);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    applyThemeClass(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore write failures (e.g. storage disabled/full).
    }
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

/**
 * Raw JS source (as a string) for the inline bootstrap script that is
 * injected into the document head via dangerouslySetInnerHTML. It runs
 * before React hydrates, synchronously setting the `dark` class on
 * <html> based on localStorage (or prefers-color-scheme as a fallback)
 * so there is no flash of the wrong theme on load.
 *
 * This intentionally duplicates the resolution logic above since it must
 * run as a plain inline script with no module imports.
 */
export const themeInitScript = `(function() {
  try {
    var key = "${THEME_STORAGE_KEY}";
    var stored = localStorage.getItem(key);
    var theme = stored === "dark" || stored === "light" ? stored : null;
    if (!theme) {
      theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  } catch (e) {}
})();`;
