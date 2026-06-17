"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg ring-1 ring-black/5 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:ring-white/10 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2",
        className
      )}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
