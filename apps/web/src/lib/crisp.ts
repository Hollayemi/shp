/**
 * Utility functions for interacting with Crisp Chat
 */

declare global {
  interface Window {
    $crisp: any[];
  }
}

/**
 * Opens the Crisp live chat window
 */
export function openCrispChat() {
  if (typeof window === "undefined" || !window.$crisp) {
    console.warn("Crisp chat is not initialized yet");
    return;
  }

  // Ensure the widget is visible before opening
  window.$crisp.push(["do", "chat:show"]);
  window.$crisp.push(["config", "hide:on:mobile", [false]]);
  window.$crisp.push(["do", "chat:open"]);
}

/**
 * Closes the Crisp live chat window
 */
export function closeCrispChat() {
  if (typeof window !== "undefined" && window.$crisp) {
    window.$crisp.push(["do", "chat:close"]);
  }
}

/**
 * Shows the Crisp chat widget
 */
export function showCrispChat() {
  if (typeof window !== "undefined" && window.$crisp) {
    window.$crisp.push(["do", "chat:show"]);
  }
}

/**
 * Hides the Crisp chat widget
 */
export function hideCrispChat() {
  if (typeof window !== "undefined" && window.$crisp) {
    window.$crisp.push(["do", "chat:hide"]);
  }
}
