"use client";

import { ChevronDown } from "lucide-react";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Option<T extends string> = { value: T; label: string };

/** Multi-select filter in a popover. Used for category, status and account. */
export function FacetFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly Option<T>[];
  selected: readonly T[];
  onChange: (next: T[]) => void;
}) {
  const id = useId();
  const toggle = (value: T, checked: boolean) =>
    onChange(checked ? [...selected, value] : selected.filter((v) => v !== value));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="border-dashed data-[active=true]:border-solid" data-active={selected.length > 0}>
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="px-1.5 font-mono">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <fieldset className="max-h-72 overflow-y-auto p-2">
          <legend className="sr-only">{label}</legend>
          {options.map((option) => {
            const optionId = `${id}-${option.value}`;
            return (
              <label
                key={option.value}
                htmlFor={optionId}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  id={optionId}
                  checked={selected.includes(option.value)}
                  onCheckedChange={(checked) => toggle(option.value, checked === true)}
                />
                {option.label}
              </label>
            );
          })}
        </fieldset>
        {selected.length > 0 && (
          <div className="border-t p-1">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange([])}>
              Clear {label.toLowerCase()}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
