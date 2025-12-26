/**
 * Visual Editor Types
 *
 * Type definitions for the visual editing feature that allows users to
 * hover over and select elements in their preview, then describe changes
 * or directly edit styles with live updates.
 */

/**
 * Messages exchanged between webapp and monitor.js via postMessage
 */
export type VisualEditingMessage =
  | { type: "ENABLE_VISUAL_EDIT" }
  | { type: "DISABLE_VISUAL_EDIT" }
  | { type: "VISUAL_EDIT_READY"; data: { url: string } }
  | { type: "ELEMENT_SELECTED"; payload: ElementInfo }
  | { type: "APPLY_STYLE"; payload: StyleUpdate };

/**
 * Complete information about a selected element
 * Extracted by monitor.js and sent to webapp
 */
export interface ElementInfo {
  /** CSS selector for the element (e.g., "div.container > button.primary") */
  selector: string;

  /** XPath for the element (e.g., "/html/body/div[1]/button[1]") */
  xpath: string;

  /** Auto-generated unique ID from Vite plugin (e.g., "App.tsx:42:4") */
  shipperId?: string;

  /** Component name from data-component attribute or tag name */
  componentName?: string;

  /** Current styles applied to the element */
  currentStyles: {
    /** Computed styles from window.getComputedStyle() */
    computed: Record<string, string>;

    /** Detected Tailwind CSS classes */
    tailwindClasses: string[];

    /** Inline styles from element.style */
    inlineStyles: Record<string, string>;
  };

  /** Position and dimensions of the element */
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Text content of the element (truncated to 100 chars) */
  textContent?: string;

  /** Whether element has direct text content (not from children) */
  hasDirectText?: boolean;

  /** Whether this element is part of a repeated set (same shipperId) */
  isRepeated?: boolean;

  /** Index of this element in a repeated set (0-based) */
  instanceIndex?: number | null;

  /** Total number of instances if this is a repeated element */
  totalInstances?: number | null;

  /** All HTML attributes on the element */
  attributes: Record<string, string>;
}

/**
 * Request to change element styles
 * Used when user directly edits styles in the UI
 */
export interface StyleChangeRequest {
  /** Information about the element to modify */
  elementInfo: ElementInfo;

  /** Style properties to change (camelCase CSS properties) */
  changes: Record<string, string>;

  /** Whether this is a live preview update (true) or final change (false) */
  isLive: boolean;

  /** Optional text content to change along with styles (combined mutation) */
  textContent?: string;
}

/**
 * Request to change element using natural language
 * Used when user describes desired changes in text
 */
export interface TextChangeRequest {
  /** Information about the element to modify */
  elementInfo: ElementInfo;

  /** Natural language description of desired changes */
  prompt: string;
}

/**
 * Request to change element text content
 * Used when user directly edits text in the UI
 */
export interface TextContentChangeRequest {
  /** Information about the element to modify */
  elementInfo: ElementInfo;

  /** New text content for the element */
  textContent: string;

  /** Whether this is a live preview update (true) or final change (false) */
  isLive: boolean;
}

/**
 * Style update to apply in the preview iframe
 * Sent from webapp to monitor.js
 */
export interface StyleUpdate {
  /** CSS selector for the element to update */
  selector: string;

  /** XPath for the element (unique identifier, especially for repeated elements) */
  xpath?: string;

  /** Shipper ID from data-shipper-id attribute */
  shipperId?: string;

  /** Style properties to apply (camelCase CSS properties) */
  changes: Record<string, string>;
}
