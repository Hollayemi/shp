"use strict";
/**
 * Sandbox Monitoring Script
 *
 * This script is injected into the user's preview environment to monitor:
 * - Runtime errors and exceptions
 * - Network requests and responses
 * - Console output
 * - Navigation events
 * - Blank screen detection
 * - Visual editing capabilities
 *
 * All events are sent to the parent window via postMessage API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MONITOR_CONFIG = void 0;
exports.generateMonitorScript = generateMonitorScript;
exports.createMonitorScriptTag = createMonitorScriptTag;
exports.injectMonitoringScript = injectMonitoringScript;
exports.MONITOR_CONFIG = {
    ALLOWED_ORIGINS: [
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "https://app.shipper.now", // production
        "https://staging.shipper.now", // staging
    ],
    DEBOUNCE_DELAY: 250,
    MAX_STRING_LENGTH: 10000,
    MAX_DEPTH: 5,
    MAX_ARRAY_LENGTH: 100,
    MAX_OBJECT_KEYS: 100,
    HIGHLIGHT_COLOR: "#3b82f6",
    VISUAL_EDIT_ENABLED: false,
};
/**
 * Generate the monitoring script to be injected into the sandbox
 * This is the complete script from shipper-vite-template/.shipper/monitor.js
 */
function generateMonitorScript(allowedOrigins) {
    // Read the monitor.js content and inject allowed origins
    const script = `(function () {
  "use strict";

  const CONFIG = {
    ALLOWED_ORIGINS: ${JSON.stringify(allowedOrigins)},
    DEBOUNCE_DELAY: 250,
    MAX_STRING_LENGTH: 10000,
    HIGHLIGHT_COLOR: "#3b82f6",
    VISUAL_EDIT_ENABLED: false,
  };

  // Post message to parent window
  function postToParent(message) {
    CONFIG.ALLOWED_ORIGINS.forEach((origin) => {
      try {
        if (!window.parent) return;
        window.parent.postMessage(
          {
            ...message,
            timestamp: new Date().toISOString(),
          },
          origin
        );
      } catch (err) {
        console.error(\`Failed to send message to \${origin}:\`, err);
      }
    });
  }

  // Detect blank screen
  function isBlankScreen() {
    const root = document.querySelector("div#root");
    return root ? root.childElementCount === 0 : false;
  }

  // Serialize complex objects for transmission
  function serializeValue(value, depth = 0, seen = new WeakMap()) {
    if (depth > 5) return "[Max Depth Reached]";

    if (value === undefined) return { _type: "undefined" };
    if (value === null) return null;
    if (typeof value === "string") {
      return value.length > CONFIG.MAX_STRING_LENGTH
        ? value.slice(0, CONFIG.MAX_STRING_LENGTH) + "..."
        : value;
    }
    if (typeof value === "number") {
      if (Number.isNaN(value)) return { _type: "NaN" };
      if (!Number.isFinite(value))
        return { _type: value > 0 ? "Infinity" : "-Infinity" };
      return value;
    }
    if (typeof value === "boolean") return value;
    if (typeof value === "bigint")
      return { _type: "BigInt", value: value.toString() };
    if (typeof value === "symbol")
      return { _type: "Symbol", value: value.toString() };
    if (typeof value === "function") {
      return {
        _type: "Function",
        name: value.name || "anonymous",
        stringValue: value.toString().slice(0, 100),
      };
    }

    if (value && typeof value === "object") {
      if (seen.has(value)) return { _type: "Circular", ref: seen.get(value) };
      seen.set(value, "ref_" + depth);
    }

    if (value instanceof Error) {
      return {
        _type: "Error",
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    if (value instanceof Date) {
      return { _type: "Date", iso: value.toISOString() };
    }

    if (value instanceof RegExp) {
      return { _type: "RegExp", source: value.source, flags: value.flags };
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, 100)
        .map((item) => serializeValue(item, depth + 1, seen));
    }

    if (value && typeof value === "object") {
      const result = {};
      const keys = Object.keys(value).slice(0, 100);
      keys.forEach((key) => {
        try {
          result[key] = serializeValue(value[key], depth + 1, seen);
        } catch (err) {
          result[key] = { _type: "Error", message: "Failed to serialize" };
        }
      });
      return result;
    }

    return value;
  }

  // ===== Runtime Error Tracking =====
  function setupErrorTracking() {
    const errorCache = new Set();
    const getCacheKey = (msg, file, line, col) =>
      \`\${msg}|\${file}|\${line}|\${col}\`;

    window.addEventListener(
      "error",
      (event) => {
        // Check if this is a resource loading error (script, img, link, etc.)
        if (event.target && event.target !== window) {
          const element = event.target;
          const tagName = element.tagName?.toLowerCase();
          const src = element.src || element.href;

          const cacheKey = \`resource|\${tagName}|\${src}\`;
          if (errorCache.has(cacheKey)) return;
          errorCache.add(cacheKey);
          setTimeout(() => errorCache.delete(cacheKey), 5000);

          postToParent({
            type: "RESOURCE_LOAD_ERROR",
            data: {
              message: \`Failed to load \${tagName}: \${src}\`,
              tagName,
              src,
              blankScreen: isBlankScreen(),
            },
          });
          return;
        }

        // Regular runtime error
        const cacheKey = getCacheKey(
          event.message,
          event.filename,
          event.lineno,
          event.colno
        );

        if (errorCache.has(cacheKey)) return;
        errorCache.add(cacheKey);
        setTimeout(() => errorCache.delete(cacheKey), 5000);

        postToParent({
          type: "RUNTIME_ERROR",
          data: {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack,
            blankScreen: isBlankScreen(),
          },
        });
      },
      true
    ); // Use capture phase to catch resource errors

    window.addEventListener("unhandledrejection", (event) => {
      const stack = event.reason?.stack || String(event.reason);
      if (errorCache.has(stack)) return;
      errorCache.add(stack);
      setTimeout(() => errorCache.delete(stack), 5000);

      postToParent({
        type: "UNHANDLED_PROMISE_REJECTION",
        data: {
          message: event.reason?.message || "Unhandled promise rejection",
          stack: event.reason?.stack || String(event.reason),
        },
      });
    });
  }

  // ===== Network Monitoring =====
  function setupNetworkMonitoring() {
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      const startTime = Date.now();
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      const method = args[1]?.method || "GET";

      let requestBody;
      if (args[1]?.body) {
        try {
          if (typeof args[1].body === "string") {
            requestBody = args[1].body;
          } else if (args[1].body instanceof FormData) {
            requestBody =
              "FormData: " +
              Array.from(args[1].body.entries())
                .map(([k, v]) => \`\${k}=\${v}\`)
                .join("&");
          } else if (args[1].body instanceof URLSearchParams) {
            requestBody = args[1].body.toString();
          } else {
            requestBody = JSON.stringify(args[1].body);
          }
        } catch {
          requestBody = "Could not serialize request body";
        }
      }

      try {
        const response = await originalFetch(...args);
        const duration = Date.now() - startTime;

        let responseBody;
        try {
          if (response.clone) {
            responseBody = await response.clone().text();
          }
        } catch (err) {
          responseBody = "[Clone failed]";
        }

        postToParent({
          type: "NETWORK_REQUEST",
          data: {
            url,
            method,
            status: response.status,
            statusText: response.statusText,
            requestBody,
            responseBody: responseBody?.slice(0, CONFIG.MAX_STRING_LENGTH),
            duration,
            timestamp: new Date().toISOString(),
          },
        });

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;

        postToParent({
          type: "NETWORK_REQUEST",
          data: {
            url,
            method,
            requestBody,
            duration,
            timestamp: new Date().toISOString(),
            error: {
              message: error?.message || "Unknown error",
              stack: error?.stack,
            },
          },
        });

        throw error;
      }
    };
  }

  // ===== Console Output Capture =====
  function setupConsoleCapture() {
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };

    const consoleBuffer = [];
    let consoleFlushTimer = null;

    const levelMap = {
      log: "info",
      warn: "warning",
      error: "error",
    };

    function flushConsoleBuffer() {
      if (consoleBuffer.length === 0) {
        consoleFlushTimer = null;
        return;
      }

      const messages = [...consoleBuffer];
      consoleBuffer.length = 0;
      consoleFlushTimer = null;

      postToParent({
        type: "CONSOLE_OUTPUT",
        data: { messages },
      });
    }

    ["log", "warn", "error"].forEach((level) => {
      console[level] = (...args) => {
        // Call original console method
        originalConsole[level].apply(console, args);

        // Serialize arguments
        const serialized = args.map((arg) => serializeValue(arg));
        const messageText = args
          .map((arg) =>
            typeof arg === "string"
              ? arg
              : JSON.stringify(serializeValue(arg), null, 2)
          )
          .join(" ")
          .slice(0, CONFIG.MAX_STRING_LENGTH);

        consoleBuffer.push({
          level: levelMap[level],
          message: messageText,
          logged_at: new Date().toISOString(),
          raw: serialized,
        });

        // Debounce flush
        if (consoleFlushTimer === null) {
          consoleFlushTimer = setTimeout(
            flushConsoleBuffer,
            CONFIG.DEBOUNCE_DELAY
          );
        }
      };
    });
  }

  // ===== URL Change Tracking =====
  function setupNavigationTracking() {
    let currentUrl = document.location.href;

    const observer = new MutationObserver(() => {
      if (currentUrl !== document.location.href) {
        currentUrl = document.location.href;
        postToParent({
          type: "URL_CHANGED",
          data: { url: currentUrl },
        });
      }
    });

    const body = document.querySelector("body");
    if (body) {
      observer.observe(body, {
        childList: true,
        subtree: true,
      });
    }
  }

  // ===== Content Load Detection =====
  function checkContentLoaded() {
    const root = document.querySelector(
      '#root, [id*="root"], [class*="root"], body > div:first-child'
    );
    const rootElementExists = !!root;
    const rootHasChildren = root ? root.childElementCount > 0 : false;

    // Check if HMR is complete (Vite-specific)
    const hmrComplete =
      !window.__vite_plugin_react_preamble_installed__ ||
      (window.import &&
        window.import.meta &&
        !window.import.meta.hot?.data?.pending);

    // Check if React is ready (look for React root or hydration)
    const reactReady =
      rootHasChildren &&
      (!!root?.querySelector("[data-reactroot], [data-react-helmet]") ||
        root?.textContent?.trim().length > 0);

    const hasContent =
      rootElementExists && rootHasChildren && hmrComplete && reactReady;

    return {
      hasContent,
      rootElementExists,
      rootHasChildren,
      hmrComplete,
      reactReady,
    };
  }

  function setupContentDetection() {
    let lastContentState = checkContentLoaded();
    let contentLoadNotified = false;

    // Check immediately
    const initialState = checkContentLoaded();
    if (initialState.hasContent && !contentLoadNotified) {
      postToParent({
        type: "CONTENT_LOADED",
        data: initialState,
      });
      contentLoadNotified = true;
    }

    // Watch for content changes
    const observer = new MutationObserver(() => {
      const currentState = checkContentLoaded();

      // Notify when content becomes available
      if (currentState.hasContent && !contentLoadNotified) {
        postToParent({
          type: "CONTENT_LOADED",
          data: currentState,
        });
        contentLoadNotified = true;
      }

      // Also notify if content disappears (blank screen)
      if (!currentState.hasContent && lastContentState.hasContent) {
        postToParent({
          type: "BLANK_SCREEN_DETECTED",
          data: currentState,
        });
        contentLoadNotified = false;
      }

      lastContentState = currentState;
    });

    // Observe the entire document for changes
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: false,
    });

    // Also check after a short delay for HMR scenarios
    setTimeout(() => {
      const state = checkContentLoaded();
      if (state.hasContent && !contentLoadNotified) {
        postToParent({
          type: "CONTENT_LOADED",
          data: state,
        });
        contentLoadNotified = true;
      }
    }, 1000);

    // Check periodically during first 10 seconds (for slow HMR)
    let checkCount = 0;
    const periodicCheck = setInterval(() => {
      checkCount++;
      const state = checkContentLoaded();

      // If content is loaded and we haven't notified yet, send event and stop
      if (state.hasContent && !contentLoadNotified) {
        postToParent({
          type: "CONTENT_LOADED",
          data: state,
        });
        contentLoadNotified = true;
        clearInterval(periodicCheck);
        return;
      }

      // If we've already notified (from mutation observer or timeout), stop checking
      if (contentLoadNotified) {
        clearInterval(periodicCheck);
        return;
      }

      // Stop after 10 seconds (20 checks × 500ms)
      if (checkCount >= 20) {
        clearInterval(periodicCheck);
      }
    }, 500);
  }

  // ===== VISUAL EDITOR =====
  let visualEditorState = {
    enabled: false,
    selectedElement: null,
    highlightOverlay: null,
    hoverOverlay: null,
    repeatedHoverOverlays: [], // Array of overlays for repeated elements
  };

  // Create overlay elements for visual editing
  function createVisualEditorOverlays() {
    // Hover overlay (blue outline when hovering)
    visualEditorState.hoverOverlay = document.createElement("div");
    visualEditorState.hoverOverlay.id = "shipper-visual-editor-hover";
    visualEditorState.hoverOverlay.style.cssText = \`
      position: absolute;
      pointer-events: none;
      border: 2px dashed \${CONFIG.HIGHLIGHT_COLOR};
      background: rgba(59, 130, 246, 0.1);
      z-index: 999999;
      transition: all 0.1s ease;
      display: none;
    \`;
    document.body.appendChild(visualEditorState.hoverOverlay);

    // Selection overlay (dotted border when selected, no background)
    visualEditorState.highlightOverlay = document.createElement("div");
    visualEditorState.highlightOverlay.id = "shipper-visual-editor-selection";
    visualEditorState.highlightOverlay.style.cssText = \`
      position: absolute;
      pointer-events: none;
      border: 2px dashed \${CONFIG.HIGHLIGHT_COLOR};
      background: transparent;
      z-index: 999998;
      display: none;
    \`;
    document.body.appendChild(visualEditorState.highlightOverlay);
  }

  // Get element position
  function getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    };
  }

  // Update overlay position
  function updateOverlay(overlay, element) {
    const pos = getElementPosition(element);
    overlay.style.left = pos.x + "px";
    overlay.style.top = pos.y + "px";
    overlay.style.width = pos.width + "px";
    overlay.style.height = pos.height + "px";
    overlay.style.display = "block";
  }

  // Create or get hover overlay for repeated elements
  function getOrCreateRepeatedHoverOverlay(index) {
    if (!visualEditorState.repeatedHoverOverlays[index]) {
      const overlay = document.createElement("div");
      overlay.className = "shipper-visual-editor-repeated-hover";
      overlay.style.cssText = \`
        position: absolute;
        pointer-events: none;
        border: 2px dashed \${CONFIG.HIGHLIGHT_COLOR};
        background: rgba(59, 130, 246, 0.1);
        z-index: 999999;
        transition: all 0.1s ease;
        display: none;
      \`;
      document.body.appendChild(overlay);
      visualEditorState.repeatedHoverOverlays[index] = overlay;
    }
    return visualEditorState.repeatedHoverOverlays[index];
  }

  // Hide all repeated hover overlays
  function hideRepeatedHoverOverlays() {
    visualEditorState.repeatedHoverOverlays.forEach((overlay) => {
      if (overlay) {
        overlay.style.display = "none";
      }
    });
  }

  // Generate CSS selector for element
  function getSelector(element) {
    if (element.id) return "#" + element.id;

    const path = [];
    let current = element;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.className && typeof current.className === "string") {
        const classes = current.className
          .trim()
          .split(/\\s+/)
          .filter((c) => c);
        // Filter out classes with invalid CSS selector characters (like square brackets in bg-[#color], colons in md:grid-cols-4)
        const validClasses = classes.filter((c) => !/[\\[\\]#:]/.test(c));
        if (validClasses.length > 0) {
          selector += "." + validClasses.slice(0, 3).join(".");
        }
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(" > ");
  }

  // Generate XPath for element (absolute path from document root)
  function getXPath(element) {
    if (element.id) return \`//*[@id="\${element.id}"]\`;

    const parts = [];
    let current = element;
    while (current && current.nodeType === 1) {
      let index = 0;
      let sibling = current.previousSibling;
      while (sibling) {
        if (sibling.nodeType === 1 && sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      const tagName = current.tagName.toLowerCase();
      parts.unshift(\`\${tagName}[\${index + 1}]\`);
      current = current.parentElement;
    }
    return "/" + parts.join("/");
  }

  // Extract Tailwind classes
  function getTailwindClasses(element) {
    if (!element.className || typeof element.className !== "string") return [];

    const classes = element.className
      .trim()
      .split(/\\s+/)
      .filter((c) => c);
    // Basic heuristic: Tailwind classes often have patterns like bg-, text-, flex-, etc.
    return classes.filter(
      (c) =>
        /^(bg|text|border|rounded|p|m|w|h|flex|grid|gap|space|shadow|opacity|transition|hover|focus|active|disabled|cursor|overflow|absolute|relative|fixed|sticky|z|top|bottom|left|right|inset|transform|scale|rotate|translate|skew|origin)-/.test(
          c
        ) || /^(sm|md|lg|xl|2xl):/.test(c)
    );
  }

  // Get computed styles (serializable)
  function getComputedStyles(element) {
    const computed = window.getComputedStyle(element);
    const styles = {};
    const importantProps = [
      "backgroundColor",
      "color",
      "borderRadius",
      "opacity",
      "padding",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "margin",
      "marginTop",
      "marginRight",
      "marginBottom",
      "marginLeft",
      "width",
      "height",
      "display",
      "position",
      "fontSize",
      "fontWeight",
      "border",
      "borderWidth",
      "borderColor",
      "borderStyle",
    ];

    importantProps.forEach((prop) => {
      styles[prop] = computed[prop];
    });

    return styles;
  }

  // Get inline styles
  function getInlineStyles(element) {
    const styles = {};
    if (element.style && element.style.length > 0) {
      for (let i = 0; i < element.style.length; i++) {
        const prop = element.style[i];
        styles[prop] = element.style[prop];
      }
    }
    return styles;
  }

  // Check if element has direct text content (not from children)
  function hasDirectTextContent(element) {
    // Check if element has direct text nodes as children
    // (not just child elements that contain text)
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (
        node.nodeType === Node.TEXT_NODE &&
        node.textContent.trim().length > 0
      ) {
        return true;
      }
    }
    return false;
  }

  // Extract element info
  function getElementInfo(element) {
    const attributes = {};
    Array.from(element.attributes).forEach((attr) => {
      attributes[attr.name] = attr.value;
    });

    const textContent = element.textContent?.slice(0, 100);
    const hasDirectText = hasDirectTextContent(element);
    const shipperId = element.getAttribute("data-shipper-id") || null;
    const shipperUsage = element.getAttribute("data-shipper-usage") || null;

    // Parse usage info if present
    // Format: "type:line:column" (e.g., "map:63:7")
    let usageInfo = null;
    if (shipperUsage) {
      try {
        const parts = shipperUsage.split(":");
        if (parts.length === 3) {
          usageInfo = {
            type: parts[0],
            line: parseInt(parts[1], 10),
            column: parseInt(parts[2], 10),
          };
        }
      } catch (e) {
        console.warn("[getElementInfo] Failed to parse usage info:", e);
      }
    }

    // Check if this element is part of a repeated set (same shipper ID appears multiple times)
    let isRepeated = false;
    let instanceIndex = null;
    let totalInstances = 1;
    if (shipperId) {
      const elementsWithSameId = document.querySelectorAll(
        \`[data-shipper-id="\${shipperId}"]\`
      );
      totalInstances = elementsWithSameId.length;
      if (elementsWithSameId.length > 1) {
        isRepeated = true;
        // Find the index of this element in the set
        for (let i = 0; i < elementsWithSameId.length; i++) {
          if (elementsWithSameId[i] === element) {
            instanceIndex = i;
            break;
          }
        }
      }
    }

    // Also check if usage info indicates repetition (e.g., inside .map())
    if (usageInfo && usageInfo.type === "map") {
      isRepeated = true;
    }

    return {
      selector: getSelector(element),
      xpath: getXPath(element),
      shipperId: shipperId,
      componentName:
        element.dataset?.componentName || element.dataset?.component || element.tagName.toLowerCase(),
      currentStyles: {
        computed: getComputedStyles(element),
        tailwindClasses: getTailwindClasses(element),
        inlineStyles: getInlineStyles(element),
      },
      position: getElementPosition(element),
      textContent: textContent,
      hasDirectText: hasDirectText,
      isRepeated: isRepeated,
      instanceIndex: instanceIndex,
      totalInstances: totalInstances,
      usageInfo: usageInfo, // Include usage info if present
      attributes,
    };
  }

  // Find the nearest ancestor element with a data-shipper-id attribute
  function findElementWithShipperId(element) {
    let current = element;
    // If starting from a text node, move to parent element
    if (current && current.nodeType !== Node.ELEMENT_NODE) {
      current = current.parentElement;
    }

    while (current && current !== document.body) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const shipperId = current.getAttribute("data-shipper-id");
        if (shipperId) {
          return { element: current, shipperId };
        }
      }
      current = current.parentElement;
    }
    return { element: null, shipperId: null };
  }

  // Handle element hover
  function handleVisualEditorMouseMove(event) {
    if (!visualEditorState.enabled) return;

    const target = event.target;
    if (
      target === visualEditorState.hoverOverlay ||
      target === visualEditorState.highlightOverlay
    )
      return;

    // Skip overlays and visual editor elements
    if (target.id?.startsWith("shipper-visual-editor")) return;
    if (target.classList?.contains("shipper-visual-editor-repeated-hover"))
      return;

    // Find the element with data-shipper-id (could be target or an ancestor)
    const { element: elementWithId, shipperId } =
      findElementWithShipperId(target);

    // Don't show hover overlay if this element is currently selected
    const isSelected =
      elementWithId === visualEditorState.selectedElement ||
      target === visualEditorState.selectedElement;

    // Also check if we're hovering over a repeated element that's selected
    let isRepeatedSelected = false;
    if (shipperId && elementWithId) {
      const elementsWithSameId = document.querySelectorAll(
        \`[data-shipper-id="\${shipperId}"]\`
      );
      if (elementsWithSameId.length > 1) {
        // Check if any of these elements is the selected element
        isRepeatedSelected = Array.from(elementsWithSameId).some(
          (el) => el === visualEditorState.selectedElement
        );
      }
    }

    if (isSelected || isRepeatedSelected) {
      // Element is selected - don't show hover overlay, selection overlays are already shown
      if (visualEditorState.hoverOverlay) {
        visualEditorState.hoverOverlay.style.display = "none";
      }
      // Don't hide repeated overlays if they're showing selection - keep them visible
      if (isRepeatedSelected && shipperId && elementWithId) {
        const elementsWithSameId = document.querySelectorAll(
          \`[data-shipper-id="\${shipperId}"]\`
        );
        if (elementsWithSameId.length > 1) {
          // Ensure selection overlays remain visible
          elementsWithSameId.forEach((element, index) => {
            const overlay = getOrCreateRepeatedHoverOverlay(index);
            overlay.style.border = \`2px solid \${CONFIG.HIGHLIGHT_COLOR}\`;
            overlay.style.background = "rgba(59, 130, 246, 0.15)";
            updateOverlay(overlay, element);
          });
        }
      }
      return;
    }

    if (shipperId && elementWithId) {
      const elementsWithSameId = document.querySelectorAll(
        \`[data-shipper-id="\${shipperId}"]\`
      );

      if (elementsWithSameId.length > 1) {
        // Show hover overlay on all repeated elements (dashed border for hover)
        hideRepeatedHoverOverlays();
        elementsWithSameId.forEach((element, index) => {
          const overlay = getOrCreateRepeatedHoverOverlay(index);
          // Use dashed border for hover (different from selection)
          overlay.style.border = \`2px dashed \${CONFIG.HIGHLIGHT_COLOR}\`;
          overlay.style.background = "rgba(59, 130, 246, 0.1)";
          updateOverlay(overlay, element);
        });
        // Hide the single hover overlay
        if (visualEditorState.hoverOverlay) {
          visualEditorState.hoverOverlay.style.display = "none";
        }
        return;
      }
    }

    // Single element - hide repeated overlays and show single overlay
    // Use elementWithId if found, otherwise use target
    hideRepeatedHoverOverlays();
    if (visualEditorState.hoverOverlay) {
      const elementToHighlight = elementWithId || target;
      updateOverlay(visualEditorState.hoverOverlay, elementToHighlight);
    }
  }

  // Handle element click
  function handleVisualEditorClick(event) {
    if (!visualEditorState.enabled) return;

    event.preventDefault();
    event.stopPropagation();

    const target = event.target;
    if (
      target === visualEditorState.hoverOverlay ||
      target === visualEditorState.highlightOverlay
    )
      return;
    if (target.id?.startsWith("shipper-visual-editor")) return;
    if (target.classList?.contains("shipper-visual-editor-repeated-hover"))
      return;

    // Find the element with data-shipper-id (could be target or an ancestor)
    // This ensures clicking on child elements selects the correct parent element
    const { element: elementToSelect, shipperId } =
      findElementWithShipperId(target);
    const selectedElement = elementToSelect || target;

    visualEditorState.selectedElement = selectedElement;

    // Hide hover overlay when element is selected
    if (visualEditorState.hoverOverlay) {
      visualEditorState.hoverOverlay.style.display = "none";
    }

    // Check if this element is part of a repeated set
    if (shipperId) {
      const elementsWithSameId = document.querySelectorAll(
        \`[data-shipper-id="\${shipperId}"]\`
      );

      if (elementsWithSameId.length > 1) {
        // Show highlight overlay on all repeated elements
        hideRepeatedHoverOverlays();
        elementsWithSameId.forEach((element, index) => {
          const overlay = getOrCreateRepeatedHoverOverlay(index);
          // Use a different style for selection (solid border, not dashed)
          overlay.style.border = \`2px solid \${CONFIG.HIGHLIGHT_COLOR}\`;
          overlay.style.background = "rgba(59, 130, 246, 0.15)";
          updateOverlay(overlay, element);
        });
        // Hide the single highlight overlay
        if (visualEditorState.highlightOverlay) {
          visualEditorState.highlightOverlay.style.display = "none";
        }
      } else {
        // Single element - hide repeated overlays and show single overlay
        hideRepeatedHoverOverlays();
        updateOverlay(visualEditorState.highlightOverlay, selectedElement);
      }
    } else {
      // No shipperId - use single overlay
      hideRepeatedHoverOverlays();
      updateOverlay(visualEditorState.highlightOverlay, selectedElement);
    }

    // Send element info to parent
    const elementInfo = getElementInfo(selectedElement);
    postToParent({
      type: "ELEMENT_SELECTED",
      payload: elementInfo,
    });
  }

  // Find element using multiple methods (most reliable first)
  function findElement(identifiers) {
    // 1. Try shipperId first (most reliable IF unique)
    // Note: shipperId may not be unique for repeating elements from same source line
    if (identifiers.shipperId) {
      try {
        const elements = document.querySelectorAll(
          \`[data-shipper-id="\${identifiers.shipperId}"]\`
        );
        // Only use shipperId if it matches exactly one element
        if (elements.length === 1) {
          return elements[0];
        }
        // If multiple elements match, shipperId isn't unique - fall through to XPath
        if (elements.length > 1) {
          console.warn(
            \`Multiple elements found with shipperId "\${identifiers.shipperId}", using XPath instead\`
          );
        }
      } catch (e) {
        console.warn("shipperId lookup failed:", e);
      }
    }

    // 2. Try XPath (most reliable for repeating elements - unique per DOM position)
    if (identifiers.xpath) {
      try {
        // Try absolute XPath first
        let result = document.evaluate(
          identifiers.xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        if (result.singleNodeValue) return result.singleNodeValue;

        // If absolute XPath fails, try relative to body
        if (
          identifiers.xpath.startsWith("/") &&
          !identifiers.xpath.startsWith("//")
        ) {
          const bodyResult = document.evaluate(
            identifiers.xpath,
            document.body,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          if (bodyResult.singleNodeValue) return bodyResult.singleNodeValue;
        }
      } catch (e) {
        console.warn("XPath evaluation failed:", e, identifiers.xpath);
      }
    }

    // 3. Fall back to CSS selector (least reliable, skip if contains invalid chars)
    if (identifiers.selector) {
      // Skip selector if it contains invalid characters (like colons in class names)
      const hasInvalidChars = /[\\[\\]#:]/.test(identifiers.selector);
      if (!hasInvalidChars) {
        try {
          const element = document.querySelector(identifiers.selector);
          if (element) return element;
        } catch (e) {
          console.warn("CSS selector failed (invalid syntax):", e.message);
        }
      } else {
        console.warn(
          "Skipping CSS selector due to invalid characters:",
          identifiers.selector
        );
      }
    }

    return null;
  }

  // Apply style changes
  function applyVisualEditorStyle(styleUpdate) {
    const { selector, shipperId, xpath, changes } = styleUpdate;
    const element = findElement({ selector, shipperId, xpath });

    if (!element) {
      console.warn("Element not found using any method:", {
        shipperId,
        xpath,
        selector,
      });
      return;
    }

    // Check if this element is part of a repeated set
    let elementsToUpdate = [element];
    if (shipperId) {
      const elementsWithSameId = document.querySelectorAll(
        \`[data-shipper-id="\${shipperId}"]\`
      );

      if (elementsWithSameId.length > 1) {
        // Apply changes to ALL repeated elements
        elementsToUpdate = Array.from(elementsWithSameId);
      }
    }

    // Apply style changes to all elements that should be updated
    elementsToUpdate.forEach((el) => {
      Object.entries(changes).forEach(([prop, value]) => {
        // Handle "inherit" or empty string to remove inline styles
        if (value === "inherit" || value === "") {
          el.style[prop] = "";
        } else {
          el.style[prop] = value;
        }
      });
    });

    // Update highlight overlays - maintain selection state
    if (shipperId) {
      const elementsWithSameId = document.querySelectorAll(
        \`[data-shipper-id="\${shipperId}"]\`
      );

      if (elementsWithSameId.length > 1) {
        // Check if this element is currently selected
        const isSelected = element === visualEditorState.selectedElement;

        if (isSelected) {
          // Maintain selection overlays on all repeated elements
          elementsWithSameId.forEach((el, index) => {
            const overlay = getOrCreateRepeatedHoverOverlay(index);
            overlay.style.border = \`2px solid \${CONFIG.HIGHLIGHT_COLOR}\`;
            overlay.style.background = "rgba(59, 130, 246, 0.15)";
            updateOverlay(overlay, el);
          });
          // Hide the single highlight overlay
          if (visualEditorState.highlightOverlay) {
            visualEditorState.highlightOverlay.style.display = "none";
          }
        } else {
          // Not selected - hide repeated overlays
          hideRepeatedHoverOverlays();
        }
      } else {
        // Single element - update single highlight overlay
        if (element === visualEditorState.selectedElement) {
          updateOverlay(visualEditorState.highlightOverlay, element);
        }
      }
    } else {
      // No shipperId - update single highlight overlay
      if (element === visualEditorState.selectedElement) {
        updateOverlay(visualEditorState.highlightOverlay, element);
      }
    }
  }

  // Apply text content changes
  function applyVisualEditorText(textUpdate) {
    const { selector, shipperId, xpath, textContent } = textUpdate;
    const element = findElement({ selector, shipperId, xpath });

    if (!element) {
      console.warn("Element not found using any method:", {
        shipperId,
        xpath,
        selector,
      });
      return;
    }

    // Check if this element is part of a repeated set
    let elementsToUpdate = [element];
    if (shipperId) {
      const elementsWithSameId = document.querySelectorAll(
        \`[data-shipper-id="\${shipperId}"]\`
      );

      if (elementsWithSameId.length > 1) {
        // Apply text changes to ALL repeated elements
        elementsToUpdate = Array.from(elementsWithSameId);
      }
    }

    // Update text content for all elements that should be updated
    elementsToUpdate.forEach((el) => {
      el.textContent = textContent;
    });

    // Update highlight overlays - maintain selection state
    if (shipperId) {
      const elementsWithSameId = document.querySelectorAll(
        \`[data-shipper-id="\${shipperId}"]\`
      );

      if (elementsWithSameId.length > 1) {
        // Check if this element is currently selected
        const isSelected = element === visualEditorState.selectedElement;

        if (isSelected) {
          // Maintain selection overlays on all repeated elements
          elementsWithSameId.forEach((el, index) => {
            const overlay = getOrCreateRepeatedHoverOverlay(index);
            overlay.style.border = \`2px solid \${CONFIG.HIGHLIGHT_COLOR}\`;
            overlay.style.background = "rgba(59, 130, 246, 0.15)";
            updateOverlay(overlay, el);
          });
          // Hide the single highlight overlay
          if (visualEditorState.highlightOverlay) {
            visualEditorState.highlightOverlay.style.display = "none";
          }
        } else {
          // Not selected - hide repeated overlays
          hideRepeatedHoverOverlays();
        }
      } else {
        // Single element - update single highlight overlay
        if (element === visualEditorState.selectedElement) {
          updateOverlay(visualEditorState.highlightOverlay, element);
        }
      }
    } else {
      // No shipperId - update single highlight overlay
      if (element === visualEditorState.selectedElement) {
        updateOverlay(visualEditorState.highlightOverlay, element);
      }
    }
  }

  // Enable visual editing mode
  function enableVisualEditor() {
    if (visualEditorState.enabled) return;

    visualEditorState.enabled = true;

    // Create overlays if they don't exist
    if (!visualEditorState.hoverOverlay) {
      createVisualEditorOverlays();
    }

    // Add event listeners
    document.addEventListener("mousemove", handleVisualEditorMouseMove);
    document.addEventListener("click", handleVisualEditorClick, true);

    // Notify parent that visual editor is ready
    postToParent({
      type: "VISUAL_EDIT_READY",
      data: { url: window.location.href },
    });

    console.log("[Shipper Visual Editor] Enabled");
  }

  // Disable visual editing mode
  function disableVisualEditor() {
    if (!visualEditorState.enabled) return;

    visualEditorState.enabled = false;

    // Hide overlays
    if (visualEditorState.hoverOverlay) {
      visualEditorState.hoverOverlay.style.display = "none";
    }
    if (visualEditorState.highlightOverlay) {
      visualEditorState.highlightOverlay.style.display = "none";
    }
    hideRepeatedHoverOverlays();

    // Clean up repeated hover overlays
    visualEditorState.repeatedHoverOverlays.forEach((overlay) => {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    });
    visualEditorState.repeatedHoverOverlays = [];

    // Remove event listeners
    document.removeEventListener("mousemove", handleVisualEditorMouseMove);
    document.removeEventListener("click", handleVisualEditorClick, true);

    visualEditorState.selectedElement = null;

    console.log("[Shipper Visual Editor] Disabled");
  }

  // Listen for visual editor commands from parent
  window.addEventListener("message", (event) => {
    const { type, payload } = event.data;

    // Only process visual editor messages
    if (
      type === "ENABLE_VISUAL_EDIT" ||
      type === "DISABLE_VISUAL_EDIT" ||
      type === "APPLY_STYLE" ||
      type === "APPLY_TEXT"
    ) {
      console.log(
        "[Shipper Visual Editor] Received message:",
        type,
        "from origin:",
        event.origin
      );

      // Validate origin (allow localhost for development and shipper domains)
      const isLocalhost =
        event.origin.startsWith("http://localhost") ||
        event.origin.startsWith("https://localhost");
      const isShipperDomain =
        event.origin.includes(".shipper.now") ||
        event.origin === "https://app.shipper.now" ||
        event.origin === "https://staging.shipper.now";
      const isAllowed =
        CONFIG.ALLOWED_ORIGINS.includes(event.origin) || isLocalhost || isShipperDomain;

      console.log("[Shipper Visual Editor] Origin validation:", {
        origin: event.origin,
        isLocalhost,
        isAllowed,
        allowedOrigins: CONFIG.ALLOWED_ORIGINS,
      });

      if (!isAllowed) {
        console.warn(
          "[Shipper Visual Editor] Message blocked from unauthorized origin:",
          event.origin,
          "Allowed origins:",
          CONFIG.ALLOWED_ORIGINS
        );
        return;
      }

      if (type === "ENABLE_VISUAL_EDIT") {
        console.log("[Shipper Visual Editor] Enabling visual editor...");
        enableVisualEditor();
      } else if (type === "DISABLE_VISUAL_EDIT") {
        console.log("[Shipper Visual Editor] Disabling visual editor...");
        disableVisualEditor();
      } else if (type === "APPLY_STYLE") {
        applyVisualEditorStyle(payload);
      } else if (type === "APPLY_TEXT") {
        applyVisualEditorText(payload);
      }
    }
  });

  // ===== Initialize All Monitoring =====
  function init() {
    setupErrorTracking();
    setupNetworkMonitoring();
    setupConsoleCapture();
    setupNavigationTracking();
    setupContentDetection();

    // Notify parent that monitoring is active
    postToParent({
      type: "MONITOR_INITIALIZED",
      data: { url: window.location.href },
    });
  }

  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();`;
    return script.trim();
}
/**
 * Create a script tag to inject monitoring code
 */
function createMonitorScriptTag(allowedOrigins) {
    const script = generateMonitorScript(allowedOrigins);
    return `<script type="module">${script}</script>`;
}
/**
 * Inject monitoring script into HTML content
 */
function injectMonitoringScript(html, allowedOrigins) {
    const scriptTag = createMonitorScriptTag(allowedOrigins);
    // Try to inject before </head> if it exists
    if (html.includes("</head>")) {
        return html.replace("</head>", `${scriptTag}</head>`);
    }
    // Otherwise inject at the beginning of <body>
    if (html.includes("<body")) {
        return html.replace(/<body[^>]*>/, (match) => `${match}${scriptTag}`);
    }
    // Fallback: prepend to HTML
    return scriptTag + html;
}
//# sourceMappingURL=sandbox-monitor.js.map