"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Palette,
  Type,
  Sparkles,
  Code2,
  ArrowUp,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Copy,
  Trash2,
  Loader2,
  Undo2,
} from "lucide-react";
import {
  ElementInfo,
  StyleChangeRequest,
  TextChangeRequest,
  TextContentChangeRequest,
} from "@/lib/visual-editor/types";
import { TailwindColorPicker } from "./TailwindColorPicker";
import {
  normalizeTailwindColorValue,
  tailwindClassToCssColor,
} from "@/lib/visual-editor/tailwind-colors";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface PendingChanges {
  modifiedProperties: Set<string>;
  styles: Record<string, string>;
  originalStyles: Record<string, string>;
  textContent?: string;
  originalTextContent?: string;
  hasTextChange: boolean;
  elementInfo: ElementInfo;
}

interface BatchedEditRequest {
  filePath: string;
  selector: string;
  elementInfo: {
    componentName?: string;
    textContent?: string;
    currentClasses: string[];
    shipperId?: string;
    isRepeated?: boolean;
    instanceIndex?: number;
    totalInstances?: number;
  };
  styleChanges: Record<string, string>;
  textChanges?: string;
}

interface VisualEditingPanelProps {
  element: ElementInfo;
  projectId: string;
  onClose: () => void;
  onStyleChange: (change: StyleChangeRequest) => Promise<void>;
  onTextContentChange: (change: TextContentChangeRequest) => Promise<void>;
  onTextPrompt: (prompt: TextChangeRequest) => void;
  onBatchedChanges: (changes: BatchedEditRequest[]) => Promise<void>;
  onExitVisualEdit: () => void;
  resolveFilePath: (element: ElementInfo) => Promise<string | null>;
  onFragmentRefresh?: () => void;
}

// Helper function to convert RGB/RGBA to hex, or return "inherit" if transparent/not set
function rgbToHex(rgb: string): string {
  if (rgb.startsWith("#")) {
    return rgb;
  }

  if (rgb === "transparent" || rgb === "rgba(0, 0, 0, 0)") {
    return "inherit";
  }

  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) {
    return "inherit";
  }

  const alpha = match[4] ? parseFloat(match[4]) : 1;
  if (alpha === 0) {
    return "inherit";
  }

  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);

  const toHex = (n: number) => {
    const hex = n.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Helper to convert Tailwind fontSize class to CSS
function tailwindToFontSize(tailwindClass: string): string {
  const classMap: Record<string, string> = {
    "text-xs": "12px",
    "text-sm": "14px",
    "text-base": "16px",
    "text-lg": "18px",
    "text-xl": "20px",
    "text-2xl": "24px",
    "text-3xl": "30px",
    "text-4xl": "36px",
    "text-5xl": "48px",
    "text-6xl": "60px",
    "text-7xl": "72px",
    "text-8xl": "96px",
    "text-9xl": "128px",
  };

  // Handle arbitrary values like text-[24px]
  const arbitraryMatch = tailwindClass.match(/text-\[(.+?)\]/);
  if (arbitraryMatch) {
    return arbitraryMatch[1];
  }

  return classMap[tailwindClass] || "16px";
}

// Helper to extract base fontSize class from Tailwind classes (ignoring responsive variants)
// BUT use computed fontSize to match what's actually being displayed
function extractActualFontSize(
  classes: string[],
  computedFontSize: string,
): string {
  // First, check if there's a computed font size that matches a standard Tailwind size
  const computedPx = parseInt(computedFontSize);

  // Map computed pixel values to Tailwind classes
  const sizeMap: Record<number, string> = {
    12: "text-xs",
    14: "text-sm",
    16: "text-base",
    18: "text-lg",
    20: "text-xl",
    24: "text-2xl",
    30: "text-3xl",
    36: "text-4xl",
    48: "text-5xl",
    60: "text-6xl",
    72: "text-7xl",
    96: "text-8xl",
    128: "text-9xl",
  };

  // If computed size matches a standard Tailwind size, return that class
  if (sizeMap[computedPx]) {
    return sizeMap[computedPx];
  }

  // Otherwise, look for any text-size class in the element's classes (including responsive ones)
  // This will find the class that's currently active
  const allFontSizeClasses = classes.filter((cls) => {
    // Match base classes: text-xl
    if (
      /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|\[.+?\])$/.test(
        cls,
      )
    ) {
      return true;
    }
    // Match responsive classes: md:text-xl
    if (
      /^(sm|md|lg|xl|2xl):text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|\[.+?\])$/.test(
        cls,
      )
    ) {
      return true;
    }
    return false;
  });

  // If we found font size classes, check which one produces the computed size
  if (allFontSizeClasses.length > 0) {
    // Prefer responsive classes that match, then fall back to base class
    const responsiveMatch = allFontSizeClasses.find((cls) => {
      const baseClass = cls.includes(":") ? cls.split(":")[1] : cls;
      const expectedPx = parseInt(tailwindToFontSize(baseClass));
      return expectedPx === computedPx;
    });

    if (responsiveMatch) {
      // Return just the base class part for storage
      return responsiveMatch.includes(":")
        ? responsiveMatch.split(":")[1]
        : responsiveMatch;
    }

    // Return the first base (non-responsive) class as fallback
    const baseClass = allFontSizeClasses.find((cls) => !cls.includes(":"));
    if (baseClass) return baseClass;
  }

  // If no match found, create arbitrary value class with computed size
  return `text-[${computedFontSize}]`;
}

// Helper to extract font weight - detects what's actually displayed
function extractActualFontWeight(
  classes: string[],
  computedFontWeight: string,
): string {
  // Map computed font weights to Tailwind classes
  const weightMap: Record<string, string> = {
    "100": "font-thin",
    "200": "font-extralight",
    "300": "font-light",
    "400": "font-normal",
    normal: "font-normal",
    "500": "font-medium",
    "600": "font-semibold",
    "700": "font-bold",
    bold: "font-bold",
    "800": "font-extrabold",
    "900": "font-black",
  };

  // If computed weight matches a standard Tailwind weight, return that class
  if (weightMap[computedFontWeight]) {
    return weightMap[computedFontWeight];
  }

  // Look for font weight classes in the element
  const fontWeightClass = classes.find((cls) => {
    const baseClass = cls.includes(":") ? cls.split(":")[1] : cls;
    return /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(
      baseClass,
    );
  });

  if (fontWeightClass) {
    return fontWeightClass.includes(":")
      ? fontWeightClass.split(":")[1]
      : fontWeightClass;
  }

  return "font-normal";
}

// Helper to extract text color from Tailwind classes or computed styles
function extractBaseTextColor(
  classes: string[],
  computedColor?: string,
): string {
  const textColorClass = classes.find((cls) => /^([a-z0-9]+:)*text-/.test(cls));

  if (textColorClass) {
    const cssColor = tailwindClassToCssColor(textColorClass, "text");
    if (cssColor) {
      return cssColor;
    }
  }

  // Fallback to computed color
  if (computedColor && computedColor !== "inherit") {
    return rgbToHex(computedColor);
  }
  return "inherit";
}

// Helper to extract text alignment from Tailwind classes
function extractBaseTextAlign(classes: string[]): string {
  const textAlignClass = classes.find((cls) =>
    /^text-(left|center|right|justify)$/.test(cls),
  );
  return textAlignClass?.replace("text-", "") || "left";
}

// Helper to extract border radius from Tailwind classes or convert computed value to Tailwind class
function extractBaseBorderRadius(
  classes: string[],
  computedBorderRadius?: string,
): string {
  // First, check if there's a rounded-* class in the element's classes
  const borderRadiusClass = classes.find((cls) => {
    const baseClass = cls.includes(":") ? cls.split(":")[1] : cls;
    return /^rounded(-(none|sm|md|lg|xl|2xl|3xl|full|\[.+?\]))?$/.test(
      baseClass,
    );
  });

  if (borderRadiusClass) {
    return borderRadiusClass.includes(":")
      ? borderRadiusClass.split(":")[1]
      : borderRadiusClass;
  }

  // If no class found, convert computed value to Tailwind class
  if (computedBorderRadius) {
    const numValue = parseInt(computedBorderRadius);
    if (isNaN(numValue)) {
      // Check for special values
      if (computedBorderRadius === "9999px" || computedBorderRadius === "50%") {
        return "rounded-full";
      }
      // If it's already a Tailwind class or arbitrary value, return as-is
      if (computedBorderRadius.startsWith("rounded-")) {
        return computedBorderRadius;
      }
      return `rounded-[${computedBorderRadius}]`;
    }

    // Map pixel values to Tailwind classes
    if (numValue === 0) return "rounded-none";
    if (numValue <= 2) return "rounded-sm";
    if (numValue <= 4) return "rounded";
    if (numValue <= 6) return "rounded-md";
    if (numValue <= 8) return "rounded-lg";
    if (numValue <= 12) return "rounded-xl";
    if (numValue <= 16) return "rounded-2xl";
    if (numValue <= 24) return "rounded-3xl";
    return `rounded-[${computedBorderRadius}]`;
  }

  return "rounded-none";
}

function deriveFilePathFromShipperId(shipperId?: string | null): string | null {
  if (!shipperId) return null;
  const [rawPath] = shipperId.split(":");
  if (!rawPath) return null;

  const hasExtension =
    rawPath.endsWith(".tsx") ||
    rawPath.endsWith(".jsx") ||
    rawPath.endsWith(".ts") ||
    rawPath.endsWith(".js");
  const includesDirectory = rawPath.includes("/");

  if (includesDirectory) {
    const prefixedPath = rawPath.startsWith("src/")
      ? rawPath
      : `src/${rawPath}`;
    return hasExtension ? prefixedPath : `${prefixedPath}.tsx`;
  }

  const baseName = hasExtension ? rawPath : `${rawPath}.tsx`;
  const isRootFile = rawPath === "App" || rawPath === "main";
  const directory = isRootFile ? "src" : "src/components";
  return `${directory}/${baseName}`;
}

// Helper to parse spacing value and extract number and unit
function parseSpacingValue(value: string): { num: number; unit: string } {
  if (!value || value === "0px" || value === "0") {
    return { num: 0, unit: "px" };
  }

  // Match number and unit (e.g., "16 px", "16px", "1rem", "0.5em")
  const match = value.trim().match(/^([\d.]+)\s*(px|rem|em|%)?$/i);
  if (match) {
    return {
      num: parseFloat(match[1]) || 0,
      unit: match[2]?.toLowerCase() || "px",
    };
  }

  // Default fallback
  return { num: 0, unit: "px" };
}

// Helper to format spacing value
function formatSpacingValue(num: number, unit: string): string {
  if (num === 0) return "0px";
  // Round to avoid floating point issues
  const rounded = Math.round(num * 100) / 100;
  return `${rounded}${unit}`;
}

// Helper to increment/decrement spacing value
function adjustSpacingValue(
  value: string,
  delta: number,
  min: number = 0,
): string {
  const { num, unit } = parseSpacingValue(value);
  const newNum = Math.max(min, num + delta);
  return formatSpacingValue(newNum, unit);
}

// Helper to extract padding/margin from computed styles using individual properties
function extractSpacingFromComputed(
  computed: Record<string, string>,
  type: "padding" | "margin",
): string {
  const top = computed[`${type}Top`] || "0px";
  const right = computed[`${type}Right`] || "0px";
  const bottom = computed[`${type}Bottom`] || "0px";
  const left = computed[`${type}Left`] || "0px";

  // If all sides are the same, return single value
  if (top === right && right === bottom && bottom === left) {
    return top;
  }

  // If top/bottom are same and left/right are same, return "vertical horizontal"
  if (top === bottom && left === right) {
    return `${top} ${left}`;
  }

  // Otherwise return all four values: "top right bottom left"
  return `${top} ${right} ${bottom} ${left}`;
}

// Helper to parse padding/margin into horizontal and vertical values
function parseSpacingPair(value: string): {
  horizontal: string;
  vertical: string;
} {
  if (!value || value === "0px" || value === "0") {
    return { horizontal: "0px", vertical: "0px" };
  }

  // Try to parse as "horizontal vertical" or "top right bottom left"
  const parts = value.trim().split(/\s+/);

  if (parts.length === 1) {
    // Single value - use for both
    return { horizontal: parts[0], vertical: parts[0] };
  } else if (parts.length === 2) {
    // Two values - vertical horizontal (CSS shorthand: top/bottom left/right)
    return { horizontal: parts[1], vertical: parts[0] };
  } else if (parts.length === 4) {
    // Four values - top right bottom left
    // Horizontal = left + right (use left, assuming they're the same)
    // Vertical = top + bottom (use top, assuming they're the same)
    return { horizontal: parts[3], vertical: parts[0] };
  }

  // Default fallback
  return { horizontal: value, vertical: value };
}

// Helper to format spacing pair back to CSS value
function formatSpacingPair(
  horizontal: string,
  vertical: string,
  isLinked: boolean,
): string {
  if (isLinked && horizontal === vertical) {
    return horizontal;
  }
  return `${vertical} ${horizontal}`;
}

// Helper to split padding/margin shorthand into individual properties
function splitSpacingProperties(
  property: string,
  value: string,
): Record<string, string> {
  if (property !== "padding" && property !== "margin") {
    return { [property]: value };
  }

  const pair = parseSpacingPair(value);
  const prefix = property === "padding" ? "padding" : "margin";

  // If values are the same, return single property
  if (pair.horizontal === pair.vertical) {
    return { [property]: pair.horizontal };
  }

  // Otherwise, return individual properties
  // For vertical: use top and bottom (assuming they're the same)
  // For horizontal: use left and right (assuming they're the same)
  return {
    [`${prefix}Top`]: pair.vertical,
    [`${prefix}Bottom`]: pair.vertical,
    [`${prefix}Left`]: pair.horizontal,
    [`${prefix}Right`]: pair.horizontal,
  };
}

export function VisualEditingPanel({
  element,
  projectId,
  onClose,
  onStyleChange,
  onTextContentChange,
  onTextPrompt,
  onBatchedChanges,
  onExitVisualEdit,
  resolveFilePath,
  onFragmentRefresh,
}: VisualEditingPanelProps) {
  console.log(
    "[VisualEditingPanel] Component rendering with element:",
    element.selector,
  );

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // State to track resolved file path
  const [filePath, setFilePath] = useState<string | null>(null);

  // Resolve file path asynchronously
  useEffect(() => {
    let isMounted = true;
    resolveFilePath(element).then((path) => {
      if (isMounted) {
        setFilePath(path);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [element, resolveFilePath]);

  // Query component edit history - only enabled when filePath is available and we have a way to identify the component
  const { data: editHistory, isLoading: isLoadingHistory } = useQuery({
    ...trpc.projects.getComponentEditHistory.queryOptions({
      projectId,
      filePath: filePath!,
      shipperId: element.shipperId || undefined,
      selector: element.shipperId ? undefined : element.selector,
      limit: 5,
    }),
    enabled: !!filePath && (!!element.shipperId || !!element.selector),
  });

  // Undo mutation
  const undoMutation = useMutation(
    trpc.projects.undoComponentEdit.mutationOptions({
      onSuccess: () => {
        toast.success("Component reverted successfully");
        // Refresh the fragment to show the undone state
        if (onFragmentRefresh) {
          onFragmentRefresh();
        }
        onClose();
      },
      onError: (error) => {
        toast.error(`Failed to undo: ${error.message}`);
      },
    }),
  );

  const handleUndo = () => {
    if (!editHistory || editHistory.length === 0) {
      toast.error("No edit history found for this component");
      return;
    }

    // Get the most recent edit
    const latestEdit = editHistory[0];
    undoMutation.mutate({
      projectId,
      editMetadataId: latestEdit.id,
    });
  };

  const canUndo =
    editHistory && editHistory.length > 0 && !undoMutation.isPending;

  // Calculate toolbar position based on element position
  const toolbarPosition = useMemo(() => {
    const PANEL_HEIGHT = 600;
    const PANEL_WIDTH = 292;
    const PANEL_PADDING = 20;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Get iframe position to convert iframe-relative coords to window coords
    const iframe = document.querySelector(
      'iframe[title="Preview"]',
    ) as HTMLIFrameElement;

    let iframeLeft = 0;
    let iframeTop = 0;

    if (iframe) {
      const iframeRect = iframe.getBoundingClientRect();
      iframeLeft = iframeRect.left;
      iframeTop = iframeRect.top;
      console.log("[VisualEditingPanel] Iframe position:", {
        left: iframeLeft,
        top: iframeTop,
      });
    } else {
      console.warn("[VisualEditingPanel] Preview iframe not found");
    }

    // Convert element position from iframe coords to window coords
    const { x, y, width, height } = element.position;
    const elementAbsoluteX = iframeLeft + x;
    const elementAbsoluteY = iframeTop + y;
    const elementRight = elementAbsoluteX + width;
    const elementBottom = elementAbsoluteY + height;

    console.log("[VisualEditingPanel] Element bounds:", {
      x: elementAbsoluteX,
      y: elementAbsoluteY,
      right: elementRight,
      bottom: elementBottom,
      width,
      height,
    });

    let left = 0;
    let top = 0;

    // Calculate horizontal position
    const spaceOnRight = viewportWidth - elementRight;
    const spaceOnLeft = elementAbsoluteX;

    if (spaceOnRight >= PANEL_WIDTH + PANEL_PADDING * 2) {
      // Position to the right of element
      left = elementRight + PANEL_PADDING;
    } else if (spaceOnLeft >= PANEL_WIDTH + PANEL_PADDING * 2) {
      // Position to the left of element
      left = elementAbsoluteX - PANEL_WIDTH - PANEL_PADDING;
    } else {
      // Not enough space on either side, center it
      left = Math.max(PANEL_PADDING, (viewportWidth - PANEL_WIDTH) / 2);
    }

    // Calculate vertical position - try to align with element top
    top = elementAbsoluteY;

    console.log(
      "[VisualEditingPanel] Initial top:",
      top,
      "viewport height:",
      viewportHeight,
    );

    // Ensure panel doesn't go off bottom
    if (top + PANEL_HEIGHT > viewportHeight - PANEL_PADDING) {
      const adjustedTop = viewportHeight - PANEL_HEIGHT - PANEL_PADDING;
      console.log(
        "[VisualEditingPanel] Would go off bottom, adjusting from",
        top,
        "to",
        adjustedTop,
      );
      top = Math.max(PANEL_PADDING, adjustedTop);
    }

    // Ensure panel doesn't go off top
    if (top < PANEL_PADDING) {
      console.log(
        "[VisualEditingPanel] Would go off top, clamping to",
        PANEL_PADDING,
      );
      top = PANEL_PADDING;
    }

    // Ensure we have valid numbers
    const finalLeft = isNaN(left) || !isFinite(left) ? 100 : Math.round(left);
    const finalTop = isNaN(top) || !isFinite(top) ? 100 : Math.round(top);

    console.log("[VisualEditingPanel] Final position:", {
      left: finalLeft,
      top: finalTop,
    });

    return { left: finalLeft, top: finalTop };
  }, [element.position]);

  // Store original styles from element
  const originalStyles = useMemo(() => {
    const bgColor = element.currentStyles.computed.backgroundColor;
    const computedColor = element.currentStyles.computed.color;
    const computedFontSize = element.currentStyles.computed.fontSize || "16px";
    const computedFontWeight =
      element.currentStyles.computed.fontWeight || "400";

    // Extract styles from Tailwind classes, using computed values to determine what's actually displayed
    const actualFontSize = extractActualFontSize(
      element.currentStyles.tailwindClasses,
      computedFontSize,
    );
    const actualFontWeight = extractActualFontWeight(
      element.currentStyles.tailwindClasses,
      computedFontWeight,
    );
    const baseTextColor = extractBaseTextColor(
      element.currentStyles.tailwindClasses,
      computedColor,
    );
    const baseTextAlign = extractBaseTextAlign(
      element.currentStyles.tailwindClasses,
    );
    const baseBorderRadius = extractBaseBorderRadius(
      element.currentStyles.tailwindClasses,
      element.currentStyles.computed.borderRadius,
    );

    const result = {
      backgroundColor: bgColor ? rgbToHex(bgColor) : "inherit",
      borderRadius: baseBorderRadius, // Use Tailwind class
      opacity: element.currentStyles.computed.opacity || "1",
      padding:
        extractSpacingFromComputed(element.currentStyles.computed, "padding") ||
        "0px",
      margin:
        extractSpacingFromComputed(element.currentStyles.computed, "margin") ||
        "0px",
      fontSize: actualFontSize, // Use the class that's actually being displayed
      fontWeight: actualFontWeight, // Use the class that's actually being displayed
      color: baseTextColor, // Use Tailwind class or arbitrary value
      textAlign: baseTextAlign, // Extract value from text-* class
    };

    console.log("[VisualEditingPanel] Original styles captured:", {
      componentName: element.componentName,
      shipperId: element.shipperId,
      isRepeated: element.isRepeated,
      instanceIndex: element.instanceIndex,
      totalInstances: element.totalInstances,
      tailwindClasses: element.currentStyles.tailwindClasses,
      processedStyles: result,
    });

    return result;
  }, [element]);

  // Store original text content
  const originalTextContent = useMemo(
    () => element.textContent || "",
    [element.textContent],
  );

  // Check if element has direct text content (not from children)
  // Fallback: if hasDirectText is undefined but text is short, likely direct text
  const hasDirectText =
    element.hasDirectText === true ||
    (element.hasDirectText === undefined &&
      element.textContent &&
      element.textContent.trim().length > 0 &&
      element.textContent.trim().length < 100);

  // console.log("[VisualEditingPanel] Text content check:", {
  //   selector: element.selector,
  //   hasDirectText: element.hasDirectText,
  //   computedHasDirectText: hasDirectText,
  //   textContent: element.textContent,
  //   textContentLength: element.textContent?.length,
  // });

  // Track pending changes per element (persists across element switches)
  const [pendingChangesByElement, setPendingChangesByElement] = useState<
    Map<string, PendingChanges>
  >(new Map());
  const [promptText, setPromptText] = useState("");
  const [activeTab, setActiveTab] = useState("describe");
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);
  // Initialize linked state based on whether horizontal and vertical are the same
  const initialPaddingPair = useMemo(
    () => parseSpacingPair(originalStyles.padding),
    [originalStyles.padding],
  );
  const initialMarginPair = useMemo(
    () => parseSpacingPair(originalStyles.margin),
    [originalStyles.margin],
  );

  const [isPaddingLinked, setIsPaddingLinked] = useState(
    initialPaddingPair.horizontal === initialPaddingPair.vertical,
  );
  const [isMarginLinked, setIsMarginLinked] = useState(
    initialMarginPair.horizontal === initialMarginPair.vertical,
  );

  // Track if changes are being properly handled (applied or sent to builder)
  // This prevents false "unsaved changes" warnings when component unmounts
  const changesHandledRef = useRef(false);

  // Refs to access current values in cleanup without triggering effect re-runs
  // Initialize with null, will be populated by effect below
  const currentStateRef = useRef<{
    pendingChangesByElement: Map<string, PendingChanges>;
    modifiedProperties: Set<string>;
    hasTextChange: boolean;
    element: ElementInfo;
    originalStyles: Record<string, string>;
    originalTextContent: string;
    hasAnyPendingChanges: boolean;
  } | null>(null);

  // Get current element's pending changes or use original styles
  const currentPendingChanges = useMemo(() => {
    return element.shipperId
      ? pendingChangesByElement.get(element.shipperId)
      : undefined;
  }, [pendingChangesByElement, element.shipperId]);

  const [styles, setStyles] = useState(
    currentPendingChanges?.styles || originalStyles,
  );
  const [modifiedProperties, setModifiedProperties] = useState<Set<string>>(
    currentPendingChanges?.modifiedProperties || new Set(),
  );
  const [textContent, setTextContent] = useState(
    currentPendingChanges?.textContent ?? originalTextContent,
  );
  const [hasTextChange, setHasTextChange] = useState(
    currentPendingChanges?.hasTextChange || false,
  );

  // Parse padding and margin into horizontal/vertical values
  const paddingPair = useMemo(
    () => parseSpacingPair(styles.padding),
    [styles.padding],
  );
  const marginPair = useMemo(
    () => parseSpacingPair(styles.margin),
    [styles.margin],
  );

  // Helper to convert Tailwind class to CSS value for live preview
  const tailwindToCSS = useCallback(
    (property: string, value: string): string => {
      if (property === "backgroundColor") {
        return normalizeTailwindColorValue(value, "bg");
      }
      if (property === "fontSize") {
        // Convert Tailwind fontSize class to CSS pixel value
        return tailwindToFontSize(value);
      }
      if (property === "fontWeight") {
        // Convert Tailwind font-weight to CSS
        if (value === "font-thin") return "100";
        if (value === "font-extralight") return "200";
        if (value === "font-light") return "300";
        if (value === "font-normal") return "normal";
        if (value === "font-medium") return "500";
        if (value === "font-semibold") return "600";
        if (value === "font-bold") return "bold";
        if (value === "font-extrabold") return "800";
        if (value === "font-black") return "900";
        // If it's already a CSS value or arbitrary, return as-is
        return value;
      }
      if (property === "color") {
        return normalizeTailwindColorValue(value, "text");
      }
      if (property === "textAlign") {
        // textAlign values are the same in Tailwind and CSS (left, center, right, justify)
        return value;
      }
      if (property === "borderRadius") {
        // Convert Tailwind borderRadius class to CSS value
        if (value === "rounded-none") return "0px";
        if (value === "rounded-sm") return "2px";
        if (value === "rounded") return "4px";
        if (value === "rounded-md") return "6px";
        if (value === "rounded-lg") return "8px";
        if (value === "rounded-xl") return "12px";
        if (value === "rounded-2xl") return "16px";
        if (value === "rounded-3xl") return "24px";
        if (value === "rounded-full") return "9999px";
        // Handle arbitrary values like rounded-[10px]
        const arbitraryMatch = value.match(/rounded-\[(.+?)\]/);
        if (arbitraryMatch) {
          return arbitraryMatch[1];
        }
        // If it's already a CSS value, return as-is
        return value;
      }
      return value;
    },
    [],
  );

  // Helper to reset live preview for a specific element
  const resetLivePreview = useCallback(
    (
      elementInfo: ElementInfo,
      modifiedProps: Set<string>,
      origStyles: Record<string, string>,
      hasText: boolean,
      origText: string,
    ) => {
      if (modifiedProps.size > 0) {
        const resetStyles: Record<string, string> = {};
        modifiedProps.forEach((prop) => {
          const origValue = origStyles[prop as keyof typeof origStyles];
          // Convert Tailwind classes to CSS for live preview reset
          const cssValue = tailwindToCSS(prop, origValue);
          resetStyles[prop] = cssValue === "inherit" ? "" : cssValue;
        });

        console.log("[VisualEditingPanel] Resetting live preview:", {
          elementInfo: elementInfo.selector,
          modifiedProps: Array.from(modifiedProps),
          origStyles,
          resetStyles,
        });

        onStyleChange({
          elementInfo,
          changes: resetStyles,
          isLive: true,
        });
      }

      if (hasText) {
        onTextContentChange({
          elementInfo,
          textContent: origText,
          isLive: true,
        });
      }
    },
    [onStyleChange, onTextContentChange, tailwindToCSS],
  );

  // Update ref with current values on every render
  // This allows cleanup to access current values without triggering effect re-runs
  useEffect(() => {
    currentStateRef.current = {
      pendingChangesByElement,
      modifiedProperties,
      hasTextChange,
      element,
      originalStyles,
      originalTextContent,
      hasAnyPendingChanges:
        pendingChangesByElement.size > 0 ||
        modifiedProperties.size > 0 ||
        hasTextChange,
    };
  });

  // Load pending changes when element changes
  useEffect(() => {
    // Update linked state based on original styles (before any pending changes)
    const paddingPair = parseSpacingPair(originalStyles.padding);
    const marginPair = parseSpacingPair(originalStyles.margin);
    setIsPaddingLinked(paddingPair.horizontal === paddingPair.vertical);
    setIsMarginLinked(marginPair.horizontal === marginPair.vertical);

    if (!element.shipperId) {
      // If no shipperId, reset to defaults
      setStyles(originalStyles);
      setModifiedProperties(new Set());
      setTextContent(originalTextContent);
      setHasTextChange(false);
      setPromptText("");
      return;
    }

    const pending = pendingChangesByElement.get(element.shipperId);

    if (pending) {
      setStyles(pending.styles);
      setModifiedProperties(pending.modifiedProperties);
      setTextContent(pending.textContent ?? originalTextContent);
      setHasTextChange(pending.hasTextChange || false);
    } else {
      setStyles(originalStyles);
      setModifiedProperties(new Set());
      setTextContent(originalTextContent);
      setHasTextChange(false);
    }

    setPromptText("");
  }, [
    element.shipperId,
    originalStyles,
    originalTextContent,
    pendingChangesByElement,
  ]);

  const handleStyleChange = (property: string, value: string) => {
    if (!element.shipperId) return; // Can't track changes without shipperId

    const newStyles = { ...styles, [property]: value };
    const newModifiedProps = new Set(modifiedProperties).add(property);

    console.log("[VisualEditingPanel] handleStyleChange:", {
      property,
      value,
      previousStyles: styles,
      newStyles,
      modifiedProperties: Array.from(newModifiedProps),
    });

    setStyles(newStyles);
    setModifiedProperties(newModifiedProps);

    // Save to pending changes map
    setPendingChangesByElement((prev) => {
      const updated = new Map(prev);
      const existing = prev.get(element.shipperId!);
      updated.set(element.shipperId!, {
        modifiedProperties: newModifiedProps,
        styles: newStyles,
        originalStyles: originalStyles,
        textContent: existing?.textContent,
        originalTextContent:
          existing?.originalTextContent ?? originalTextContent,
        hasTextChange: existing?.hasTextChange || false,
        elementInfo: element,
      });
      return updated;
    });

    // Convert to CSS for live preview
    const cssChanges: Record<string, string> = {};
    newModifiedProps.forEach((prop) => {
      const val = newStyles[prop as keyof typeof newStyles];
      if (val !== undefined) {
        cssChanges[prop] = tailwindToCSS(prop, val);
      }
    });

    console.log("[VisualEditingPanel] Sending live preview update:", {
      modifiedProperties: Array.from(newModifiedProps),
      cssChanges,
    });

    // Send live preview update with CSS values
    onStyleChange({
      elementInfo: element,
      changes: cssChanges,
      isLive: true,
    });
  };

  const handleTextContentChange = (newText: string) => {
    if (element.isRepeated || !element.shipperId) {
      return;
    }

    setTextContent(newText);
    const textChanged = newText !== originalTextContent;
    setHasTextChange(textChanged);

    // Save to pending changes map
    setPendingChangesByElement((prev) => {
      const updated = new Map(prev);
      const existing = prev.get(element.shipperId!);
      updated.set(element.shipperId!, {
        modifiedProperties: existing?.modifiedProperties || new Set(),
        styles: existing?.styles || originalStyles,
        originalStyles: existing?.originalStyles || originalStyles,
        textContent: newText,
        originalTextContent:
          existing?.originalTextContent ?? originalTextContent,
        hasTextChange: textChanged,
        elementInfo: element,
      });
      return updated;
    });

    // Send live preview update
    onTextContentChange({
      elementInfo: element,
      textContent: newText,
      isLive: true,
    });
  };

  const handleCancel = () => {
    // Reset live preview for all elements with pending changes
    pendingChangesByElement.forEach((changes) => {
      resetLivePreview(
        changes.elementInfo,
        changes.modifiedProperties,
        changes.originalStyles,
        changes.hasTextChange,
        changes.originalTextContent ?? "",
      );
    });

    // Reset current element's live preview if it has changes
    if (modifiedProperties.size > 0 || hasTextChange) {
      resetLivePreview(
        element,
        modifiedProperties,
        originalStyles,
        hasTextChange,
        originalTextContent,
      );
    }

    // Clear all pending changes
    setPendingChangesByElement(new Map());

    // Reset current element state
    if (modifiedProperties.size > 0 || hasTextChange) {
      setStyles(originalStyles);
      setModifiedProperties(new Set());
      setTextContent(originalTextContent);
      setHasTextChange(false);
    }

    // Mark changes as handled (user explicitly cancelled)
    changesHandledRef.current = true;

    // Exit visual editing mode
    onExitVisualEdit();
    onClose();
  };

  const handleApplyChanges = async () => {
    // Mark changes as handled immediately to prevent false warnings
    changesHandledRef.current = true;

    console.log(
      "[VisualEditingPanel] handleApplyChanges called - applying ALL pending changes:",
      {
        totalElementsWithPendingChanges: pendingChangesByElement.size,
        currentElementHasChanges: hasChanges,
        allPendingElements: Array.from(pendingChangesByElement.keys()),
      },
    );

    // Collect ALL pending changes from ALL elements in the map
    const allChangesToApply: Array<{
      elementInfo: ElementInfo;
      styleChanges: Record<string, string>;
      textContent?: string;
    }> = [];

    // First, save current element's changes if it has any and isn't already in the map
    if (
      hasChanges &&
      element.shipperId &&
      !pendingChangesByElement.has(element.shipperId)
    ) {
      const changedStyles: Record<string, string> = {};
      modifiedProperties.forEach((prop) => {
        const value = styles[prop as keyof typeof styles];
        // Split padding/margin shorthand into individual properties if needed
        const splitProps = splitSpacingProperties(prop, value);
        Object.assign(changedStyles, splitProps);
      });

      allChangesToApply.push({
        elementInfo: element,
        styleChanges: changedStyles,
        textContent: hasTextChange ? textContent : undefined,
      });

      console.log(
        "[VisualEditingPanel] Adding current element changes (not in pending map):",
        {
          shipperId: element.shipperId,
          styleChanges: changedStyles,
          hasTextChange,
        },
      );
    }

    // Then iterate through all pending changes from the map
    pendingChangesByElement.forEach((changes, shipperId) => {
      const hasStyleChanges = changes.modifiedProperties.size > 0;
      const hasTextChanges =
        changes.hasTextChange && !changes.elementInfo.isRepeated;

      if (hasStyleChanges || hasTextChanges) {
        const changedStyles: Record<string, string> = {};
        if (hasStyleChanges) {
          changes.modifiedProperties.forEach((prop) => {
            const value = changes.styles[prop as keyof typeof changes.styles];
            // Split padding/margin shorthand into individual properties if needed
            const splitProps = splitSpacingProperties(prop, value);
            Object.assign(changedStyles, splitProps);
          });
        }

        allChangesToApply.push({
          elementInfo: changes.elementInfo,
          styleChanges: changedStyles,
          textContent: hasTextChanges ? changes.textContent : undefined,
        });

        console.log(
          "[VisualEditingPanel] Adding changes for element:",
          shipperId,
          {
            hasStyleChanges,
            hasTextChanges,
            styleChanges: changedStyles,
          },
        );
      }
    });

    console.log(
      "[VisualEditingPanel] Total changes to apply:",
      allChangesToApply.length,
      allChangesToApply,
    );

    if (allChangesToApply.length === 0) {
      console.log("[VisualEditingPanel] No changes to apply");
      return;
    }

    // Convert to BatchedEditRequest format with resolved file paths
    const batchedRequests: BatchedEditRequest[] = [];

    for (const change of allChangesToApply) {
      try {
        const resolvedFilePath =
          (await resolveFilePath(change.elementInfo)) ||
          deriveFilePathFromShipperId(change.elementInfo.shipperId);

        if (!resolvedFilePath) {
          throw new Error("Unable to resolve file path from element info");
        }

        batchedRequests.push({
          filePath: resolvedFilePath,
          selector: change.elementInfo.selector,
          elementInfo: {
            componentName: change.elementInfo.componentName,
            textContent: change.elementInfo.textContent,
            currentClasses: change.elementInfo.currentStyles.tailwindClasses,
            shipperId: change.elementInfo.shipperId,
            isRepeated: change.elementInfo.isRepeated,
            instanceIndex: change.elementInfo.instanceIndex ?? undefined,
            totalInstances: change.elementInfo.totalInstances ?? undefined,
          },
          styleChanges: change.styleChanges,
          textChanges: change.textContent,
        });
      } catch (error) {
        console.error(
          "[VisualEditingPanel] Failed to resolve file for batched change:",
          {
            shipperId: change.elementInfo.shipperId,
            componentName: change.elementInfo.componentName,
            selector: change.elementInfo.selector,
            error,
          },
        );

        const targetLabel =
          change.elementInfo.componentName ||
          change.elementInfo.shipperId ||
          change.elementInfo.selector;

        toast.error(
          `Couldn't determine which file contains ${targetLabel}. Please reselect the element and try again.`,
        );
        changesHandledRef.current = false;
        return;
      }
    }

    // Group by file for logging
    const changesByFile = new Map<string, number>();
    batchedRequests.forEach((req) => {
      changesByFile.set(
        req.filePath,
        (changesByFile.get(req.filePath) || 0) + 1,
      );
    });

    console.log(
      `[VisualEditingPanel] Batching ${batchedRequests.length} changes across ${changesByFile.size} files`,
      Array.from(changesByFile.entries()).map(([file, count]) => ({
        file,
        count,
      })),
    );

    // Clear all pending changes and close panel immediately for instant feedback
    setPendingChangesByElement(new Map());
    setModifiedProperties(new Set());
    setHasTextChange(false);

    // Apply changes in the background without blocking
    onBatchedChanges(batchedRequests)
      .then(() => {
        console.log(
          "[VisualEditingPanel] All batched changes applied successfully",
        );
        onExitVisualEdit();
        onClose();
      })
      .catch((error) => {
        console.error("[VisualEditingPanel] Error applying changes:", error);
        toast.error("Failed to apply some changes. Please try again.");
      });
  };

  const hasChanges = modifiedProperties.size > 0 || hasTextChange;
  const hasAnyPendingChanges = pendingChangesByElement.size > 0 || hasChanges;

  // Warn user if they try to close with pending changes, and cleanup on unmount
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (
        currentStateRef.current?.hasAnyPendingChanges &&
        !changesHandledRef.current
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup only runs when component unmounts (empty dependency array)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);

      // Get current values from ref
      const currentState = currentStateRef.current;
      if (!currentState) return; // Safety check (shouldn't happen)

      const {
        pendingChangesByElement,
        modifiedProperties,
        hasTextChange,
        element,
        originalStyles,
        originalTextContent,
        hasAnyPendingChanges,
      } = currentState;

      // Reset live preview when component unmounts (unless changes were already handled)
      if (!changesHandledRef.current) {
        // Reset all pending changes in other elements
        pendingChangesByElement.forEach((changes) => {
          resetLivePreview(
            changes.elementInfo,
            changes.modifiedProperties,
            changes.originalStyles,
            changes.hasTextChange,
            changes.originalTextContent ?? "",
          );
        });

        // Reset current element's live preview if it has changes
        if (modifiedProperties.size > 0 || hasTextChange) {
          resetLivePreview(
            element,
            modifiedProperties,
            originalStyles,
            hasTextChange,
            originalTextContent,
          );
        }

        // Warn if component unmounts with pending changes that weren't handled
        if (hasAnyPendingChanges) {
          toast.warning(
            "Visual editing closed with unsaved changes. Changes were not applied.",
          );
        }
      }
    };
    // Empty dependency array: cleanup only runs on unmount, not on every change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTextPromptSubmit = () => {
    // Reset live preview for all elements with pending changes
    if (modifiedProperties.size > 0 || hasTextChange) {
      resetLivePreview(
        element,
        modifiedProperties,
        originalStyles,
        hasTextChange,
        originalTextContent,
      );
    }

    // Reset ALL pending changes for all elements (since we're sending to AI builder)
    pendingChangesByElement.forEach((changes) => {
      if (changes.elementInfo.shipperId !== element.shipperId) {
        resetLivePreview(
          changes.elementInfo,
          changes.modifiedProperties,
          changes.originalStyles,
          changes.hasTextChange,
          changes.originalTextContent ?? "",
        );
      }
    });

    // Clear ALL pending changes to prevent false "unsaved changes" warning
    setPendingChangesByElement(new Map());
    setModifiedProperties(new Set());
    setHasTextChange(false);

    // Mark changes as handled (sent to builder)
    changesHandledRef.current = true;

    // Include shipperId in the prompt to target only this specific component
    const enhancedPrompt = `IMPORTANT: Only modify the element with data-shipper-id="${element.shipperId}". Do not change any other elements.

${promptText}`;

    onTextPrompt({
      elementInfo: element,
      prompt: enhancedPrompt,
    });

    // Exit visual editing mode after sending to builder
    onExitVisualEdit();
    onClose();
  };

  const handleSelectParent = () => {
    const iframe = document.querySelector(
      'iframe[title="Preview"]',
    ) as HTMLIFrameElement;

    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: "SELECT_PARENT" }, "*");
      console.log("[VisualEditingPanel] Sent SELECT_PARENT message to iframe");
    } else {
      console.warn("[VisualEditingPanel] Could not find preview iframe");
    }
  };

  const handleCopyTailwindClasses = () => {
    const classes = element.currentStyles.tailwindClasses.join(" ");
    navigator.clipboard.writeText(classes);
  };

  const handleDeleteElement = () => {
    // Implementation would go here
    console.log("[VisualEditingPanel] Delete element requested");
  };

  console.log(
    "[VisualEditingPanel] About to render with position:",
    toolbarPosition,
  );

  return (
    <div
      className="fixed z-[9999] flex flex-col rounded-[16px] bg-[#FCFCF9] shadow-[0px_1px_13.8px_1px_rgba(18,18,18,0.10)] dark:bg-[#1A2421]"
      style={{
        left: `${toolbarPosition.left}px`,
        top: `${toolbarPosition.top}px`,
        width: "302px",
        maxHeight: "600px",
      }}
    >
      {/* Header with Select Parent Button */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <Button
          onClick={handleSelectParent}
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs font-medium text-[#1C1C1C] dark:text-[#F5F9F7]"
          title="Select parent element"
        >
          <ArrowUp className="h-3.5 w-3.5" />
          <span>Select Parent</span>
        </Button>
        {hasAnyPendingChanges && (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            {pendingChangesByElement.size +
              (hasChanges &&
              element.shipperId &&
              !pendingChangesByElement.has(element.shipperId)
                ? 1
                : 0)}{" "}
            pending
          </span>
        )}
      </div>

      {/* Tabbed Content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-1 flex-col gap-0 overflow-hidden"
      >
        <div className="mx-1 mt-2 mb-0 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setActiveTab("describe")}
                className={`inline-flex h-[30px] shrink-0 items-center gap-2 rounded-lg px-4 text-xs font-normal transition-colors ${
                  activeTab === "describe"
                    ? "border border-[#25B596] bg-[#D1FAE5] text-[#111827] dark:bg-[#1E3A32] dark:text-[#F5F9F7]"
                    : "bg-[#F3F3EE] text-[#111827] hover:bg-[#E7E7E7] dark:bg-[#2A3531] dark:text-[#F5F9F7] dark:hover:bg-[#3A4541]"
                }`}
              >
                <span>Describe Changes</span>
                <svg
                  className="h-3 w-3 text-[#111827] dark:text-white"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 8V6M6 4H6.005M11 6C11 8.76142 8.76142 11 6 11C3.23858 11 1 8.76142 1 6C1 3.23858 3.23858 1 6 1C8.76142 1 11 3.23858 11 6Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent className="z-[10000] w-[520px] rounded-lg bg-gray-900 px-4 py-3 text-left text-sm text-white dark:bg-gray-800 [&>svg]:fill-gray-900 dark:[&>svg]:fill-gray-800">
              <p className="font-semibold">AI-Powered Editing</p>
              <p className="mt-1 text-xs text-gray-300">
                Describe what you&apos;d like to change in plain English, and AI
                will update the element for you instantly.
              </p>
              <p className="mt-2 text-xs text-teal-400">✨ Uses 0.25 Credits</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setActiveTab("style")}
                className={`inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg transition-colors ${
                  activeTab === "style"
                    ? "border border-[#25B596] bg-[#D1FAE5] text-[#111827] dark:bg-[#1E3A32] dark:text-[#F5F9F7]"
                    : "bg-[#F3F3EE] text-[#111827] hover:bg-[#E7E7E7] dark:bg-[#2A3531] dark:text-[#F5F9F7] dark:hover:bg-[#3A4541]"
                }`}
              >
                <Palette className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="dark:bg-prj-accent-primary bg-prj-accent-primary z-[10000] rounded-lg px-3 py-2 text-sm font-semibold text-white">
              <p>Style</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setActiveTab("text")}
                className={`inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg transition-colors ${
                  activeTab === "text"
                    ? "border border-[#25B596] bg-[#D1FAE5] text-[#111827] dark:bg-[#1E3A32] dark:text-[#F5F9F7]"
                    : "bg-[#F3F3EE] text-[#111827] hover:bg-[#E7E7E7] dark:bg-[#2A3531] dark:text-[#F5F9F7] dark:hover:bg-[#3A4541]"
                }`}
              >
                <Type className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="dark:bg-prj-accent-primary bg-prj-accent-primary z-[10000] rounded-lg px-3 py-2 text-sm font-semibold text-white">
              <p>Text</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setActiveTab("spacing")}
                className={`inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg transition-colors ${
                  activeTab === "spacing"
                    ? "border border-[#25B596] bg-[#D1FAE5] text-[#111827] dark:bg-[#1E3A32] dark:text-[#F5F9F7]"
                    : "bg-[#F3F3EE] text-[#111827] hover:bg-[#E7E7E7] dark:bg-[#2A3531] dark:text-[#F5F9F7] dark:hover:bg-[#3A4541]"
                }`}
              >
                <svg
                  className="h-3.5 w-3.5 text-[#0F172A] dark:text-white"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2.33203 11.6673V10.5007C2.33203 10.1912 2.45495 9.89449 2.67374 9.67569C2.89253 9.4569 3.18928 9.33398 3.4987 9.33398H10.4987C10.8081 9.33398 11.1049 9.4569 11.3237 9.67569C11.5424 9.89449 11.6654 10.1912 11.6654 10.5007V11.6673"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2.33203 2.33398V3.50065C2.33203 3.81007 2.45495 4.10682 2.67374 4.32561C2.89253 4.5444 3.18928 4.66732 3.4987 4.66732H10.4987C10.8081 4.66732 11.1049 4.5444 11.3237 4.32561C11.5424 4.10682 11.6654 3.81007 11.6654 3.50065V2.33398"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.33464 7H4.66797"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent className="dark:bg-prj-accent-primary bg-prj-accent-primary z-[10000] rounded-lg px-3 py-2 text-sm font-semibold text-white">
              <p>Spacing</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setActiveTab("advanced")}
                className={`inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg transition-colors ${
                  activeTab === "advanced"
                    ? "border border-[#25B596] bg-[#D1FAE5] text-[#111827] dark:bg-[#1E3A32] dark:text-[#F5F9F7]"
                    : "bg-[#F3F3EE] text-[#111827] hover:bg-[#E7E7E7] dark:bg-[#2A3531] dark:text-[#F5F9F7] dark:hover:bg-[#3A4541]"
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="dark:bg-prj-accent-primary bg-prj-accent-primary z-[10000] rounded-lg px-3 py-2 text-sm font-semibold text-white">
              <p>Advanced</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex-1 overflow-y-auto px-1 py-[4px]">
          {/* Describe Changes Tab */}
          <TabsContent value="describe" className="mt-0">
            <div className="relative flex h-[119px] flex-col rounded-lg bg-white p-0 dark:border-[#25B596] dark:bg-[#1A2421]">
              <Textarea
                id="ai-prompt"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                onKeyDown={(e) => {
                  // Submit on Enter (but allow Shift+Enter for new lines)
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (promptText.trim() && !isApplyingChanges) {
                      handleTextPromptSubmit();
                    }
                  }
                }}
                placeholder="Describe your changes in natural language..."
                className="h-full w-full resize-none rounded-[11px] border-0 bg-transparent p-2 text-xs leading-[140%] font-light tracking-[0.12px] text-[#5F5F5D] shadow-none placeholder:text-[#5F5F5D] focus-visible:ring-0 focus-visible:ring-1 focus-visible:ring-[#1E9A80] dark:text-[#A8B5B0] dark:placeholder:text-[#6B7A75]"
                style={{
                  fontFamily:
                    "'Inter Display', -apple-system, Roboto, Helvetica, sans-serif",
                }}
              />
              <button
                type="button"
                onClick={promptText.trim() ? handleTextPromptSubmit : undefined}
                disabled={isApplyingChanges || !promptText.trim()}
                className="absolute right-4 bottom-4 flex h-6 w-6 items-center justify-center rounded-full bg-[#1E9A80] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isApplyingChanges ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#FCFBF8]" />
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8.29688 6.43299L5.81044 8.86317C5.66269 9.01105 5.48906 9.08186 5.28956 9.07561C5.09006 9.06936 4.91644 8.9923 4.76869 8.84442C4.62081 8.69655 4.54688 8.52292 4.54688 8.32355C4.54688 8.12405 4.62081 7.95036 4.76869 7.80248L8.48925 4.07123C8.63713 3.92348 8.81431 3.84961 9.02081 3.84961C9.22731 3.84961 9.4045 3.92348 9.55238 4.07123L13.2729 7.80248C13.4208 7.95036 13.4948 8.12405 13.4948 8.32355C13.4948 8.52292 13.4208 8.69655 13.2729 8.84442C13.1252 8.9923 12.9516 9.06624 12.7521 9.06624C12.5526 9.06624 12.3789 8.9923 12.2312 8.84442L9.78225 6.39548V12.936C9.78225 13.1479 9.71144 13.3247 9.56981 13.4663C9.42831 13.6079 9.25156 13.6787 9.03956 13.6787C8.82756 13.6787 8.65081 13.6079 8.50931 13.4663C8.36769 13.3247 8.29688 13.1479 8.29688 12.936V6.43299Z"
                      fill="#FCFBF8"
                    />
                  </svg>
                )}
              </button>
            </div>
          </TabsContent>

          {/* Style Tab */}
          <TabsContent value="style" className="mt-0 space-y-2">
            <div className="rounded-lg border border-[#E7E7E7] bg-white p-3 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#1A2421]">
              <div className="flex flex-col gap-2">
                {/* Background Color */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[11px] leading-[150%] font-medium tracking-[-0.11px] text-[#14201F] dark:text-[#F5F9F7]">
                    Background Color
                  </Label>
                  <div className="mt-1.5">
                    <TailwindColorPicker
                      kind="bg"
                      value={styles.backgroundColor}
                      onChange={(value) =>
                        handleStyleChange("backgroundColor", value)
                      }
                    />
                  </div>
                </div>

                {/* Opacity */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] leading-[150%] font-medium tracking-[-0.11px] text-[#14201F] dark:text-[#F5F9F7]">
                      Opacity
                    </Label>
                    <span className="text-[11px] leading-[150%] font-normal text-[#898F8F] dark:text-[#8A9691]">
                      {Math.round((parseFloat(styles.opacity) || 1) * 100)}%
                    </span>
                  </div>
                  <div className="relative mt-1.5 h-4 w-full">
                    <div className="absolute top-0.5 left-0 h-3 w-full rounded-full bg-[#F3F3EE] dark:bg-[#2A3531]"></div>
                    <Input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={parseFloat(styles.opacity) || 1}
                      onChange={(e) =>
                        handleStyleChange("opacity", e.target.value)
                      }
                      className="absolute top-0 left-0 h-4 w-full cursor-pointer appearance-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#1E9A80] [&::-moz-range-thumb]:shadow-[0_0_0_1px_rgba(0,0,0,0.15)] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#1E9A80] [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
                    />
                  </div>
                </div>

                {/* Border Radius */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[11px] leading-[150%] font-medium tracking-[-0.11px] text-[#14201F] dark:text-[#F5F9F7]">
                    Border Radius
                  </Label>
                  <Select
                    value={styles.borderRadius}
                    onValueChange={(value) =>
                      handleStyleChange("borderRadius", value)
                    }
                  >
                    <SelectTrigger className="mt-1.5 h-auto rounded-md border border-[#F2F2F2] bg-white p-1 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#2A3531] [&>span]:px-0.5 [&>span]:text-xs [&>span]:leading-normal [&>span]:font-normal [&>span]:tracking-[-0.12px] [&>span]:text-[#898F8F] dark:[&>span]:text-[#8A9691]">
                      <SelectValue placeholder="Select radius" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="rounded-none">None (0px)</SelectItem>
                      <SelectItem value="rounded-sm">Small (2px)</SelectItem>
                      <SelectItem value="rounded">Default (4px)</SelectItem>
                      <SelectItem value="rounded-md">Medium (6px)</SelectItem>
                      <SelectItem value="rounded-lg">Large (8px)</SelectItem>
                      <SelectItem value="rounded-xl">XL (12px)</SelectItem>
                      <SelectItem value="rounded-2xl">2XL (16px)</SelectItem>
                      <SelectItem value="rounded-3xl">3XL (24px)</SelectItem>
                      <SelectItem value="rounded-full">
                        Full (9999px)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Text Tab */}
          <TabsContent value="text" className="mt-0 space-y-2">
            <div className="rounded-lg border border-[#E7E7E7] bg-white p-3 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#1A2421]">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] leading-[150%] font-medium tracking-[-0.11px] text-[#14201F] dark:text-[#F5F9F7]">
                  Text Content
                </Label>
                {element.isRepeated ? (
                  <div className="mt-1.5 rounded-md border border-[#F2F2F2] bg-[#F9F9F9] p-3 dark:border-[#3A4541] dark:bg-[#2A3531]">
                    <p className="text-xs leading-normal text-[#898F8F] dark:text-[#8A9691]">
                      This element is dynamically generated and cannot be edited
                      directly. Use the{" "}
                      <button
                        type="button"
                        onClick={() => setActiveTab("describe")}
                        className="font-medium text-[#1E9A80] underline hover:text-[#1a8570]"
                      >
                        Describe Changes
                      </button>{" "}
                      tab to modify it.
                    </p>
                  </div>
                ) : (
                  <Textarea
                    value={textContent}
                    onChange={(e) => handleTextContentChange(e.target.value)}
                    placeholder="Enter text content..."
                    rows={3}
                    disabled={!hasDirectText}
                    className="mt-1.5 resize-none rounded-md border border-[#F2F2F2] bg-white p-2 text-xs leading-normal text-[#14201F] shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] placeholder:text-[#898F8F] focus-visible:ring-1 focus-visible:ring-[#1E9A80] disabled:cursor-not-allowed disabled:bg-[#F9F9F9] disabled:text-[#898F8F] disabled:opacity-60 dark:border-[#3A4541] dark:bg-[#2A3531] dark:text-[#F5F9F7] dark:placeholder:text-[#6B7A75] dark:disabled:bg-[#1A2421] dark:disabled:text-[#6B7A75]"
                  />
                )}
              </div>
            </div>

            <div className="rounded-lg border border-[#E7E7E7] bg-white p-3 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#1A2421]">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] leading-[150%] font-medium tracking-[-0.11px] text-[#14201F] dark:text-[#F5F9F7]">
                  Font Size
                </Label>
                <Select
                  value={styles.fontSize}
                  onValueChange={(value) =>
                    handleStyleChange("fontSize", value)
                  }
                >
                  <SelectTrigger className="mt-1.5 h-auto rounded-md border border-[#F2F2F2] bg-white p-1 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#2A3531] [&>span]:px-0.5 [&>span]:text-xs [&>span]:leading-normal [&>span]:font-normal [&>span]:tracking-[-0.12px] [&>span]:text-[#898F8F] dark:[&>span]:text-[#8A9691]">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    <SelectItem value="text-xs">XS (12px)</SelectItem>
                    <SelectItem value="text-sm">Small (14px)</SelectItem>
                    <SelectItem value="text-base">Base (16px)</SelectItem>
                    <SelectItem value="text-lg">Large (18px)</SelectItem>
                    <SelectItem value="text-xl">XL (20px)</SelectItem>
                    <SelectItem value="text-2xl">2XL (24px)</SelectItem>
                    <SelectItem value="text-3xl">3XL (30px)</SelectItem>
                    <SelectItem value="text-4xl">4XL (36px)</SelectItem>
                    <SelectItem value="text-5xl">5XL (48px)</SelectItem>
                    <SelectItem value="text-6xl">6XL (60px)</SelectItem>
                    <SelectItem value="text-7xl">7XL (72px)</SelectItem>
                    <SelectItem value="text-8xl">8XL (96px)</SelectItem>
                    <SelectItem value="text-9xl">9XL (128px)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border border-[#E7E7E7] bg-white p-3 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#1A2421]">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] leading-[150%] font-medium tracking-[-0.11px] text-[#14201F] dark:text-[#F5F9F7]">
                  Font Weight
                </Label>
                <Select
                  value={styles.fontWeight}
                  onValueChange={(value) =>
                    handleStyleChange("fontWeight", value)
                  }
                >
                  <SelectTrigger className="mt-1.5 h-auto rounded-md border border-[#F2F2F2] bg-white p-1 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#2A3531] [&>span]:px-0.5 [&>span]:text-xs [&>span]:leading-normal [&>span]:font-normal [&>span]:tracking-[-0.12px] [&>span]:text-[#898F8F] dark:[&>span]:text-[#8A9691]">
                    <SelectValue placeholder="Select weight" />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    <SelectItem value="font-light">Light</SelectItem>
                    <SelectItem value="font-normal">Normal</SelectItem>
                    <SelectItem value="font-medium">Medium</SelectItem>
                    <SelectItem value="font-semibold">Semibold</SelectItem>
                    <SelectItem value="font-bold">Bold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border border-[#E7E7E7] bg-white p-3 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#1A2421]">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] leading-[150%] font-medium tracking-[-0.11px] text-[#14201F] dark:text-[#F5F9F7]">
                  Text Color
                </Label>
                <div className="mt-1.5">
                  <TailwindColorPicker
                    kind="text"
                    value={styles.color}
                    onChange={(value) => handleStyleChange("color", value)}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#E7E7E7] bg-white p-3 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#1A2421]">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] leading-[150%] font-medium tracking-[-0.11px] text-[#14201F] dark:text-[#F5F9F7]">
                  Text Align
                </Label>
                <div className="mt-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleStyleChange("textAlign", "center")}
                    className={`flex h-8 items-center justify-center rounded-md border p-1 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] ${
                      styles.textAlign === "center"
                        ? "border-[#1E9A80] bg-white dark:bg-[#2A3531]"
                        : "border-[#F2F2F2] bg-white dark:border-[#3A4541] dark:bg-[#2A3531]"
                    }`}
                  >
                    <div className="flex h-full items-center justify-center rounded bg-[#F3F3EE] px-1.5 py-1 dark:bg-[#3A4541]">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M2 3H10"
                          stroke="#0F172A"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M4 6H8"
                          stroke="#0F172A"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M3 9H9"
                          stroke="#0F172A"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStyleChange("textAlign", "justify")}
                    className={`flex h-8 items-center justify-center rounded-md border p-1 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] ${
                      styles.textAlign === "justify"
                        ? "border-[#1E9A80] bg-white dark:bg-[#2A3531]"
                        : "border-[#F2F2F2] bg-white dark:border-[#3A4541] dark:bg-[#2A3531]"
                    }`}
                  >
                    <div className="flex h-full items-center justify-center rounded bg-[#F3F3EE] px-1.5 py-1 dark:bg-[#3A4541]">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M2 3H10"
                          stroke="#0F172A"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M2 6H10"
                          stroke="#0F172A"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M2 9H8"
                          stroke="#0F172A"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStyleChange("textAlign", "left")}
                    className={`flex h-8 items-center justify-center rounded-md border p-1 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] ${
                      styles.textAlign === "left"
                        ? "border-[#1E9A80] bg-white dark:bg-[#2A3531]"
                        : "border-[#F2F2F2] bg-white dark:border-[#3A4541] dark:bg-[#2A3531]"
                    }`}
                  >
                    <div className="flex h-full items-center justify-center rounded bg-[#F3F3EE] px-1.5 py-1 dark:bg-[#3A4541]">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M2 3H10"
                          stroke="#0F172A"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M2 6H7"
                          stroke="#0F172A"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M2 9H9"
                          stroke="#0F172A"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStyleChange("textAlign", "right")}
                    className={`flex h-8 items-center justify-center rounded-md border p-1 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] ${
                      styles.textAlign === "right"
                        ? "border-[#1E9A80] bg-white dark:bg-[#2A3531]"
                        : "border-[#F2F2F2] bg-white dark:border-[#3A4541] dark:bg-[#2A3531]"
                    }`}
                  >
                    <div className="flex h-full items-center justify-center rounded bg-[#F3F3EE] px-1.5 py-1 dark:bg-[#3A4541]">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M2 3H10"
                          stroke="#0F172A"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M5 6H10"
                          stroke="#0F172A"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M3 9H10"
                          stroke="#0F172A"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Spacing Tab */}
          <TabsContent value="spacing" className="mt-0 space-y-2">
            <div className="rounded-lg border border-[#E7E7E7] bg-white p-3 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#1A2421]">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] leading-[150%] font-medium tracking-[-0.11px] text-[#14201F] dark:text-[#F5F9F7]">
                  Padding
                </Label>
                <div className="mt-1.5 flex items-center gap-1">
                  <div className="flex flex-1 items-center rounded-md border border-[#F2F2F2] bg-white p-1 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#2A3531]">
                    <div className="flex h-6 w-6 items-center justify-center rounded-[3.556px] bg-[#F3F3EE] p-[3.556px_5.333px] dark:bg-[#3A4541]">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="text-[#0F172A] dark:text-white"
                      >
                        <path
                          d="M10 10H9C8.73478 10 8.48043 9.89464 8.29289 9.70711C8.10536 9.51957 8 9.26522 8 9V3C8 2.73478 8.10536 2.48043 8.29289 2.29289C8.48043 2.10536 8.73478 2 9 2H10"
                          stroke="currentColor"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M2 10H3C3.26522 10 3.51957 9.89464 3.70711 9.70711C3.89464 9.51957 4 9.26522 4 9V3C4 2.73478 3.89464 2.48043 3.70711 2.29289C3.51957 2.10536 3.26522 2 3 2H2"
                          stroke="currentColor"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6 4V8"
                          stroke="currentColor"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <Input
                      type="text"
                      placeholder="16 px"
                      value={paddingPair.horizontal}
                      onChange={(e) => {
                        const newHorizontal = e.target.value;
                        const newVertical = isPaddingLinked
                          ? newHorizontal
                          : paddingPair.vertical;
                        handleStyleChange(
                          "padding",
                          formatSpacingPair(
                            newHorizontal,
                            newVertical,
                            isPaddingLinked,
                          ),
                        );
                      }}
                      className="flex-1 border-0 bg-transparent px-2 py-0.5 text-xs leading-normal font-normal tracking-[-0.12px] text-[#898F8F] shadow-none focus-visible:ring-0 dark:text-[#8A9691]"
                    />
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => {
                          const newHorizontal = adjustSpacingValue(
                            paddingPair.horizontal,
                            1,
                          );
                          const newVertical = isPaddingLinked
                            ? newHorizontal
                            : paddingPair.vertical;
                          handleStyleChange(
                            "padding",
                            formatSpacingPair(
                              newHorizontal,
                              newVertical,
                              isPaddingLinked,
                            ),
                          );
                        }}
                        className="flex h-3 w-6 items-center justify-center rounded-t-[3.556px] bg-[#F3F3EE] transition-colors hover:bg-[#E7E7E7] dark:bg-[#3A4541] dark:hover:bg-[#4A5551]"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 13 13"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-2 w-2 text-[#0F172A] dark:text-white"
                        >
                          <path
                            d="M4.14844 4.66587L6.22251 2.5918L8.29659 4.66587"
                            stroke="currentColor"
                            strokeWidth="0.888889"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newHorizontal = adjustSpacingValue(
                            paddingPair.horizontal,
                            -1,
                          );
                          const newVertical = isPaddingLinked
                            ? newHorizontal
                            : paddingPair.vertical;
                          handleStyleChange(
                            "padding",
                            formatSpacingPair(
                              newHorizontal,
                              newVertical,
                              isPaddingLinked,
                            ),
                          );
                        }}
                        className="flex h-3 w-6 items-center justify-center rounded-b-[3.556px] bg-[#F3F3EE] transition-colors hover:bg-[#E7E7E7] dark:bg-[#3A4541] dark:hover:bg-[#4A5551]"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 13 13"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-2 w-2 text-[#0F172A] dark:text-white"
                        >
                          <path
                            d="M8.29659 7.77734L6.22251 9.85142L4.14844 7.77734"
                            stroke="currentColor"
                            strokeWidth="0.888889"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPaddingLinked(!isPaddingLinked)}
                    className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-md border border-[#F2F2F2] bg-white shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] transition-colors hover:bg-[#F9F9F9] dark:border-[#3A4541] dark:bg-[#2A3531] dark:hover:bg-[#3A4541]"
                    title={
                      isPaddingLinked
                        ? "Unlink padding values"
                        : "Link padding values"
                    }
                  >
                    {isPaddingLinked ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5 text-[#0F172A] dark:text-white"
                      >
                        <path
                          d="M6.33333 4.66667C6.33333 5.58714 5.58714 6.33333 4.66667 6.33333C3.74619 6.33333 3 5.58714 3 4.66667C3 3.74619 3.74619 3 4.66667 3C5.58714 3 6.33333 3.74619 6.33333 4.66667Z"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M11 9.33333C11 10.2538 10.2538 11 9.33333 11C8.41286 11 7.66667 10.2538 7.66667 9.33333C7.66667 8.41286 8.41286 7.66667 9.33333 7.66667C10.2538 7.66667 11 8.41286 11 9.33333Z"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6.33333 4.66667L7.66667 9.33333"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5 text-[#898F8F] dark:text-[#8A9691]"
                      >
                        <path
                          d="M6.33333 4.66667C6.33333 5.58714 5.58714 6.33333 4.66667 6.33333C3.74619 6.33333 3 5.58714 3 4.66667C3 3.74619 3.74619 3 4.66667 3C5.58714 3 6.33333 3.74619 6.33333 4.66667Z"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M11 9.33333C11 10.2538 10.2538 11 9.33333 11C8.41286 11 7.66667 10.2538 7.66667 9.33333C7.66667 8.41286 8.41286 7.66667 9.33333 7.66667C10.2538 7.66667 11 8.41286 11 9.33333Z"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6.33333 4.66667L7.66667 9.33333"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M5 3L9 11"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                  <div className="flex flex-1 items-center rounded-md border border-[#F2F2F2] bg-white p-1 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#2A3531]">
                    <div className="flex h-6 w-6 items-center justify-center rounded-[3.556px] bg-[#F3F3EE] p-[3.556px_5.333px] dark:bg-[#3A4541]">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="text-[#0F172A] dark:text-white"
                      >
                        <path
                          d="M2 10V9C2 8.73478 2.10536 8.48043 2.29289 8.29289C2.48043 8.10536 2.73478 8 3 8H9C9.26522 8 9.51957 8.10536 9.70711 8.29289C9.89464 8.48043 10 8.73478 10 9V10"
                          stroke="currentColor"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M2 2V3C2 3.26522 2.10536 3.51957 2.29289 3.70711C2.48043 3.89464 2.73478 4 3 4H9C9.26522 4 9.51957 3.89464 9.70711 3.70711C9.89464 3.51957 10 3.26522 10 3V2"
                          stroke="currentColor"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M8 6H4"
                          stroke="currentColor"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <Input
                      type="text"
                      placeholder="16 px"
                      value={paddingPair.vertical}
                      onChange={(e) => {
                        const newVertical = e.target.value;
                        const newHorizontal = isPaddingLinked
                          ? newVertical
                          : paddingPair.horizontal;
                        handleStyleChange(
                          "padding",
                          formatSpacingPair(
                            newHorizontal,
                            newVertical,
                            isPaddingLinked,
                          ),
                        );
                      }}
                      className="flex-1 border-0 bg-transparent px-2 py-0.5 text-xs leading-normal font-normal tracking-[-0.12px] text-[#898F8F] shadow-none focus-visible:ring-0 dark:text-[#8A9691]"
                    />
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => {
                          const newVertical = adjustSpacingValue(
                            paddingPair.vertical,
                            1,
                          );
                          const newHorizontal = isPaddingLinked
                            ? newVertical
                            : paddingPair.horizontal;
                          handleStyleChange(
                            "padding",
                            formatSpacingPair(
                              newHorizontal,
                              newVertical,
                              isPaddingLinked,
                            ),
                          );
                        }}
                        className="flex h-3 w-6 items-center justify-center rounded-t-[3.556px] bg-[#F3F3EE] transition-colors hover:bg-[#E7E7E7] dark:bg-[#3A4541] dark:hover:bg-[#4A5551]"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 13 13"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-2 w-2 text-[#0F172A] dark:text-white"
                        >
                          <path
                            d="M4.14844 4.66587L6.22251 2.5918L8.29659 4.66587"
                            stroke="currentColor"
                            strokeWidth="0.888889"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newVertical = adjustSpacingValue(
                            paddingPair.vertical,
                            -1,
                          );
                          const newHorizontal = isPaddingLinked
                            ? newVertical
                            : paddingPair.horizontal;
                          handleStyleChange(
                            "padding",
                            formatSpacingPair(
                              newHorizontal,
                              newVertical,
                              isPaddingLinked,
                            ),
                          );
                        }}
                        className="flex h-3 w-6 items-center justify-center rounded-b-[3.556px] bg-[#F3F3EE] transition-colors hover:bg-[#E7E7E7] dark:bg-[#3A4541] dark:hover:bg-[#4A5551]"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 13 13"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-2 w-2 text-[#0F172A] dark:text-white"
                        >
                          <path
                            d="M8.29659 7.77734L6.22251 9.85142L4.14844 7.77734"
                            stroke="currentColor"
                            strokeWidth="0.888889"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#E7E7E7] bg-white p-3 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#1A2421]">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] leading-[150%] font-medium tracking-[-0.11px] text-[#14201F] dark:text-[#F5F9F7]">
                  Margin
                </Label>
                <div className="mt-1.5 flex items-center gap-1">
                  <div className="flex flex-1 items-center rounded-md border border-[#F2F2F2] bg-white p-1 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#2A3531]">
                    <div className="flex h-6 w-6 items-center justify-center rounded-[3.556px] bg-[#F3F3EE] p-[3.556px_5.333px] dark:bg-[#3A4541]">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="text-[#0F172A] dark:text-white"
                      >
                        <path
                          d="M2 2V10"
                          stroke="currentColor"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M10 2V10"
                          stroke="currentColor"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M4.5 4C4.5 3.73478 4.60536 3.48043 4.79289 3.29289C4.98043 3.10536 5.23478 3 5.5 3H6.5C6.76522 3 7.01957 3.10536 7.20711 3.29289C7.39464 3.48043 7.5 3.73478 7.5 4V8C7.5 8.26522 7.39464 8.51957 7.20711 8.70711C7.01957 8.89464 6.76522 9 6.5 9H5.5C5.23478 9 4.98043 8.89464 4.79289 8.70711C4.60536 8.51957 4.5 8.26522 4.5 8V4Z"
                          stroke="currentColor"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <Input
                      type="text"
                      placeholder="16 px"
                      value={marginPair.horizontal}
                      onChange={(e) => {
                        const newHorizontal = e.target.value;
                        const newVertical = isMarginLinked
                          ? newHorizontal
                          : marginPair.vertical;
                        handleStyleChange(
                          "margin",
                          formatSpacingPair(
                            newHorizontal,
                            newVertical,
                            isMarginLinked,
                          ),
                        );
                      }}
                      className="flex-1 border-0 bg-transparent px-2 py-0.5 text-xs leading-normal font-normal tracking-[-0.12px] text-[#898F8F] shadow-none focus-visible:ring-0 dark:text-[#8A9691]"
                    />
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => {
                          const newHorizontal = adjustSpacingValue(
                            marginPair.horizontal,
                            1,
                          );
                          const newVertical = isMarginLinked
                            ? newHorizontal
                            : marginPair.vertical;
                          handleStyleChange(
                            "margin",
                            formatSpacingPair(
                              newHorizontal,
                              newVertical,
                              isMarginLinked,
                            ),
                          );
                        }}
                        className="flex h-3 w-6 items-center justify-center rounded-t-[3.556px] bg-[#F3F3EE] transition-colors hover:bg-[#E7E7E7] dark:bg-[#3A4541] dark:hover:bg-[#4A5551]"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 13 13"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-2 w-2 text-[#0F172A] dark:text-white"
                        >
                          <path
                            d="M4.14844 4.66587L6.22251 2.5918L8.29659 4.66587"
                            stroke="currentColor"
                            strokeWidth="0.888889"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newHorizontal = adjustSpacingValue(
                            marginPair.horizontal,
                            -1,
                          );
                          const newVertical = isMarginLinked
                            ? newHorizontal
                            : marginPair.vertical;
                          handleStyleChange(
                            "margin",
                            formatSpacingPair(
                              newHorizontal,
                              newVertical,
                              isMarginLinked,
                            ),
                          );
                        }}
                        className="flex h-3 w-6 items-center justify-center rounded-b-[3.556px] bg-[#F3F3EE] transition-colors hover:bg-[#E7E7E7] dark:bg-[#3A4541] dark:hover:bg-[#4A5551]"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 13 13"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-2 w-2 text-[#0F172A] dark:text-white"
                        >
                          <path
                            d="M8.29659 7.77734L6.22251 9.85142L4.14844 7.77734"
                            stroke="currentColor"
                            strokeWidth="0.888889"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMarginLinked(!isMarginLinked)}
                    className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-md border border-[#F2F2F2] bg-white shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] transition-colors hover:bg-[#F9F9F9] dark:border-[#3A4541] dark:bg-[#2A3531] dark:hover:bg-[#3A4541]"
                    title={
                      isMarginLinked
                        ? "Unlink margin values"
                        : "Link margin values"
                    }
                  >
                    {isMarginLinked ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5 text-[#0F172A] dark:text-white"
                      >
                        <path
                          d="M6.33333 4.66667C6.33333 5.58714 5.58714 6.33333 4.66667 6.33333C3.74619 6.33333 3 5.58714 3 4.66667C3 3.74619 3.74619 3 4.66667 3C5.58714 3 6.33333 3.74619 6.33333 4.66667Z"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M11 9.33333C11 10.2538 10.2538 11 9.33333 11C8.41286 11 7.66667 10.2538 7.66667 9.33333C7.66667 8.41286 8.41286 7.66667 9.33333 7.66667C10.2538 7.66667 11 8.41286 11 9.33333Z"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6.33333 4.66667L7.66667 9.33333"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5 text-[#898F8F] dark:text-[#8A9691]"
                      >
                        <path
                          d="M6.33333 4.66667C6.33333 5.58714 5.58714 6.33333 4.66667 6.33333C3.74619 6.33333 3 5.58714 3 4.66667C3 3.74619 3.74619 3 4.66667 3C5.58714 3 6.33333 3.74619 6.33333 4.66667Z"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M11 9.33333C11 10.2538 10.2538 11 9.33333 11C8.41286 11 7.66667 10.2538 7.66667 9.33333C7.66667 8.41286 8.41286 7.66667 9.33333 7.66667C10.2538 7.66667 11 8.41286 11 9.33333Z"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6.33333 4.66667L7.66667 9.33333"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M5 3L9 11"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                  <div className="flex flex-1 items-center rounded-md border border-[#F2F2F2] bg-white p-1 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#2A3531]">
                    <div className="flex h-6 w-6 items-center justify-center rounded-[3.556px] bg-[#F3F3EE] p-[3.556px_5.333px] dark:bg-[#3A4541]">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="text-[#0F172A] dark:text-white"
                      >
                        <path
                          d="M2 10H10"
                          stroke="currentColor"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M2 2L10 2"
                          stroke="currentColor"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M4 7.5C3.73478 7.5 3.48043 7.39464 3.29289 7.20711C3.10536 7.01957 3 6.76522 3 6.5V5.5C3 5.23478 3.10536 4.98043 3.29289 4.79289C3.48043 4.60536 3.73478 4.5 4 4.5H8C8.26522 4.5 8.51957 4.60536 8.70711 4.79289C8.89464 4.98043 9 5.23478 9 5.5V6.5C9 6.76522 8.89464 7.01957 8.70711 7.20711C8.51957 7.39464 8.26522 7.5 8 7.5H4Z"
                          stroke="currentColor"
                          strokeWidth="0.857143"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <Input
                      type="text"
                      placeholder="16 px"
                      value={marginPair.vertical}
                      onChange={(e) => {
                        const newVertical = e.target.value;
                        const newHorizontal = isMarginLinked
                          ? newVertical
                          : marginPair.horizontal;
                        handleStyleChange(
                          "margin",
                          formatSpacingPair(
                            newHorizontal,
                            newVertical,
                            isMarginLinked,
                          ),
                        );
                      }}
                      className="flex-1 border-0 bg-transparent px-2 py-0.5 text-xs leading-normal font-normal tracking-[-0.12px] text-[#898F8F] shadow-none focus-visible:ring-0 dark:text-[#8A9691]"
                    />
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => {
                          const newVertical = adjustSpacingValue(
                            marginPair.vertical,
                            1,
                          );
                          const newHorizontal = isMarginLinked
                            ? newVertical
                            : marginPair.horizontal;
                          handleStyleChange(
                            "margin",
                            formatSpacingPair(
                              newHorizontal,
                              newVertical,
                              isMarginLinked,
                            ),
                          );
                        }}
                        className="flex h-3 w-6 items-center justify-center rounded-t-[3.556px] bg-[#F3F3EE] transition-colors hover:bg-[#E7E7E7] dark:bg-[#3A4541] dark:hover:bg-[#4A5551]"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 13 13"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-2 w-2 text-[#0F172A] dark:text-white"
                        >
                          <path
                            d="M4.14844 4.66587L6.22251 2.5918L8.29659 4.66587"
                            stroke="currentColor"
                            strokeWidth="0.888889"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newVertical = adjustSpacingValue(
                            marginPair.vertical,
                            -1,
                          );
                          const newHorizontal = isMarginLinked
                            ? newVertical
                            : marginPair.horizontal;
                          handleStyleChange(
                            "margin",
                            formatSpacingPair(
                              newHorizontal,
                              newVertical,
                              isMarginLinked,
                            ),
                          );
                        }}
                        className="flex h-3 w-6 items-center justify-center rounded-b-[3.556px] bg-[#F3F3EE] transition-colors hover:bg-[#E7E7E7] dark:bg-[#3A4541] dark:hover:bg-[#4A5551]"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 13 13"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-2 w-2 text-[#0F172A] dark:text-white"
                        >
                          <path
                            d="M8.29659 7.77734L6.22251 9.85142L4.14844 7.77734"
                            stroke="currentColor"
                            strokeWidth="0.888889"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="mt-0 space-y-2">
            <div className="rounded-[10px] bg-[#F3F3EE] p-1 dark:bg-[#2A3531]">
              <div className="space-y-2">
                <div className="rounded-lg border border-[#E7E7E7] bg-white p-3 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#1A2421]">
                  <div className="flex flex-col gap-2">
                    <Label className="text-[11px] leading-[150%] font-medium tracking-[-0.11px] text-[#14201F] dark:text-[#F5F9F7]">
                      Tailwind Classes
                    </Label>
                    <div className="min-h-[77px] rounded-md border border-[#F2F2F2] bg-white p-1 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#2A3531]">
                      <p className="px-0.5 text-xs leading-[130%] text-[#898F8F] dark:text-[#8A9691]">
                        {element.currentStyles.tailwindClasses.length > 0
                          ? element.currentStyles.tailwindClasses.join(" ")
                          : "No Tailwind classes detected"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-[#E7E7E7] bg-white p-3 shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#1A2421]">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] leading-[150%] font-medium tracking-[-0.11px] text-[#14201F] dark:text-[#F5F9F7]">
                      Custom Tailwind CSS Classes
                    </Label>
                    <Textarea
                      placeholder="flex flex-col space-y-4 p-6 bg-white rounded-lg shadow-md"
                      rows={4}
                      className="mt-1.5 rounded-md border border-[#F2F2F2] bg-white p-1 text-xs leading-[130%] text-[#898F8F] shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] dark:border-[#3A4541] dark:bg-[#2A3531] dark:text-[#8A9691] dark:placeholder:text-[#6B7A75]"
                    />
                    <p className="mt-1 text-[10px] leading-normal font-light tracking-[-0.1px] text-[#898F8F] dark:text-[#8A9691]">
                      Enter custom Tailwind CSS classes for advanced styling
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto rounded-md border border-[#F2F2F2] bg-[#F3F3EE] px-1.5 py-1.5 text-xs leading-[130%] font-normal text-[#898F8F] shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] hover:bg-[#E7E7E7] dark:border-[#3A4541] dark:bg-[#3A4541] dark:text-[#8A9691] dark:hover:bg-[#4A5551]"
                    onClick={handleCopyTailwindClasses}
                  >
                    <Copy className="mr-1.5 h-3 w-3" />
                    Copy Elements
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto flex-1 rounded-md border border-[#EF4444] bg-transparent px-1.5 py-1.5 text-xs leading-[130%] font-normal text-[#DC2626] shadow-[0_1px_1.5px_0_rgba(44,54,53,0.03)] hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={handleDeleteElement}
                  >
                    <Trash2 className="mr-1.5 h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Footer Actions */}
      {activeTab !== "describe" && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
          {/* Undo button on the left - always visible */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndo}
                disabled={!canUndo || undoMutation.isPending}
                className={`gap-1.5 ${!canUndo ? "cursor-not-allowed opacity-40" : ""}`}
              >
                {undoMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Undo2 className="h-4 w-4" />
                )}
                <span>Undo</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isLoadingHistory ? (
                <p className="text-xs">Loading history...</p>
              ) : editHistory && editHistory.length > 0 ? (
                <div className="text-xs">
                  <p className="font-semibold">Revert last change</p>
                  <p className="mt-1 text-gray-400">
                    {editHistory[0].changeType === "style" && "Style change"}
                    {editHistory[0].changeType === "text" && "Text change"}
                    {editHistory[0].changeType === "combined" &&
                      "Style & text change"}
                    {editHistory[0].changeType === "undo" && "Previous undo"}
                  </p>
                  <p className="mt-1 text-[10px] text-gray-500">
                    {new Date(editHistory[0].createdAt).toLocaleDateString(
                      undefined,
                      {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                </div>
              ) : (
                <div className="text-xs">
                  <p className="font-semibold">No edit history</p>
                  <p className="mt-1 text-gray-400">
                    Make changes to this component to enable undo
                  </p>
                </div>
              )}
            </TooltipContent>
          </Tooltip>

          {/* Apply/Cancel buttons on the right */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApplyChanges}
              disabled={!hasAnyPendingChanges}
            >
              Apply Styles
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
