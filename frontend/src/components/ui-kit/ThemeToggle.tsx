import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { currentTheme, setTheme, storedTheme, systemTheme, type Theme } from "@/lib/theme";

/** Switches paper and ink. Follows the system until the visitor picks one. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setState] = useState<Theme>(currentTheme);

  useEffect(() => {
    if (storedTheme()) return;
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const follow = () => {
      const next = systemTheme();
      document.documentElement.classList.toggle("dark", next === "dark");
      setState(next);
    };
    media?.addEventListener("change", follow);
    return () => media?.removeEventListener("change", follow);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => { setTheme(next); setState(next); }}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      {theme === "dark" ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
    </button>
  );
}
