"use client";

import { useTheme } from "@/hooks/useTheme";

import { MoonIcon, SunIcon } from "./icons";

export function ThemeToggle({ label }: { label: string }) {
  const { theme, ready, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="text-ink-3 hover:text-ink hover:bg-surface-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150"
    >
      {/* Before the effect runs the real theme is unknown, so render the neutral icon. */}
      {ready && theme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
