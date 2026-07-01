"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useThemeStore, type Theme } from "@/core/store/theme-store";
import { cn } from "@/core/utils/cn";

export type ThemeToggleProps = {
  className?: string;
};

function getPreferredTheme(): Theme {
  const savedTheme = window.localStorage.getItem("dicere-theme");

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDark = theme === "dark";

  useEffect(() => {
    setTheme(getPreferredTheme());
  }, [setTheme]);

  return (
    <Button
      aria-label={`Ativar tema ${isDark ? "claro" : "escuro"}`}
      className={cn(
        "hover:bg-primary-green dark:hover:bg-primary-green relative size-10 rounded-full p-1.5 text-gray-400 hover:text-white active:scale-95 dark:text-gray-200",
        className,
      )}
      onClick={toggleTheme}
      size="unset"
      type="button"
      variant="ghost"
    >
      <Moon
        aria-hidden="true"
        className={cn(
          "absolute size-5 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
          isDark ? "scale-75 opacity-0" : "scale-100 opacity-100",
        )}
      />

      <Sun
        aria-hidden="true"
        className={cn(
          "absolute size-5 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
          isDark ? "scale-100 opacity-100" : "scale-75 opacity-0",
        )}
      />
    </Button>
  );
}
