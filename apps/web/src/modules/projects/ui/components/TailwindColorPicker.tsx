"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  COLOR_SHADES,
  TAILWIND_COLORS,
  normalizeTailwindColorValue,
} from "@/lib/visual-editor/tailwind-colors";

interface TailwindColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  kind?: "bg" | "text";
}

export function TailwindColorPicker({
  value,
  onChange,
  kind = "bg",
}: TailwindColorPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);

  // Filter colors based on search
  const filteredColors = Object.entries(TAILWIND_COLORS).filter(
    ([colorName]) =>
      colorName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Get display color for the trigger button
  const normalizedValue = normalizeTailwindColorValue(value, kind);
  const displayColor =
    normalizedValue === "inherit" ? "transparent" : normalizedValue;
  const displayText =
    normalizedValue === "inherit" ? "Inherit" : normalizedValue;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          <div className="flex items-center gap-2">
            <div
              className="h-5 w-5 rounded border border-gray-300 dark:border-gray-600"
              style={{
                backgroundColor: displayColor,
                backgroundImage:
                  displayColor === "transparent"
                    ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
                    : undefined,
                backgroundSize: displayColor === "transparent" ? "8px 8px" : undefined,
                backgroundPosition:
                  displayColor === "transparent" ? "0 0, 0 4px, 4px -4px, -4px 0px" : undefined,
              }}
            />
            <span className="text-gray-700 dark:text-gray-300">{displayText}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[480px] p-4" align="start">
        <input
          type="text"
          placeholder="Search colors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
        />

        <div className="mt-3 max-h-[400px] space-y-4 overflow-y-auto pr-2">
          {filteredColors.map(([colorName, shades]) => (
            <div key={colorName}>
              <h4 className="mb-2 text-xs font-semibold capitalize text-gray-700 dark:text-gray-300">
                {colorName}
              </h4>
              <div className="grid grid-cols-11 gap-1">
                {COLOR_SHADES.map((shade) => {
                  const hexValue = shades[shade as keyof typeof shades];
                  const isSelected = value === hexValue;

                  return (
                    <button
                      key={shade}
                      type="button"
                      onClick={() => {
                        onChange(hexValue);
                        setOpen(false);
                      }}
                      className={cn(
                        "relative h-7 w-7 rounded border-2 transition-all hover:scale-110",
                        isSelected
                          ? "border-blue-500 ring-2 ring-blue-500 ring-offset-1"
                          : "border-gray-200 dark:border-gray-700",
                      )}
                      style={{ backgroundColor: hexValue }}
                      title={`${colorName}-${shade}: ${hexValue}`}
                    >
                      {isSelected && (
                        <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow-md" />
                      )}
                      <span className="sr-only">
                        {colorName} {shade}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-700">
          <button
            type="button"
            onClick={() => {
              onChange("inherit");
              setOpen(false);
            }}
            className={cn(
              "rounded border px-3 py-1.5 text-xs font-medium transition-colors",
              value === "inherit"
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
            )}
          >
            Inherit
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {value === "inherit" ? "Inherit" : value}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
