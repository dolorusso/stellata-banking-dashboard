"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "./theme";

/** One click flips between light and dark. The label names the action, not the state. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label={label}>
          {/* CSS-driven icons: correct on first paint, before hydration knows the theme */}
          <Sun className="size-4 dark:hidden" aria-hidden="true" />
          <Moon className="hidden size-4 dark:block" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
