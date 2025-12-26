"use strict";
/**
 * Shared constants for sandbox operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViteDevServerCommandDescription = exports.createViteDevServerCommand = exports.CLEAR_VITE_CACHE_COMMAND = void 0;
/**
 * Command to clear Vite cache and force Tailwind CSS rebuild.
 *
 * This command:
 * 1. Removes the Vite dependency optimization cache (node_modules/.vite)
 * 2. Removes the Vite temp directory (node_modules/.tmp)
 * 3. Touches the main CSS file to update its modification time
 * 4. Forces Tailwind CSS to rescan all source files and regenerate CSS
 *
 * This prevents:
 * - "Outdated Optimize Dep" 504 errors from Vite
 * - Stale Tailwind styles when sandbox is recreated from snapshot
 *
 * The touch command tries both common CSS file locations and uses || true
 * to prevent errors if neither file exists.
 */
exports.CLEAR_VITE_CACHE_COMMAND = "rm -rf node_modules/.vite node_modules/.tmp && (touch src/index.css 2>/dev/null || touch src/App.css 2>/dev/null || true)";
/**
 * Shell command template for starting Vite dev server with cache clearing and optimization wait.
 *
 * This is used in Modal sandboxes where we need to:
 * 1. Clear Vite cache and touch CSS file
 * 2. Start Vite in background
 * 3. Wait for initial dependency optimization to complete
 * 4. Return the PID for process management
 *
 * @param port - The port number to run Vite on (default: 5173)
 * @returns Shell command array for sandbox.exec()
 */
const createViteDevServerCommand = (port = 5173) => [
    "sh",
    "-c",
    `rm -rf node_modules/.vite node_modules/.tmp && \
touch src/index.css 2>/dev/null || touch src/App.css 2>/dev/null || true && \
bun vite --host 0.0.0.0 --port ${port} --force > /tmp/vite.log 2>&1 & \
VITE_PID=$! && \
echo $VITE_PID && \
for i in {1..30}; do \
  if grep -q "ready in" /tmp/vite.log 2>/dev/null; then \
    echo "Vite ready" >&2; \
    break; \
  fi; \
  sleep 1; \
done`,
];
exports.createViteDevServerCommand = createViteDevServerCommand;
/**
 * Human-readable description of the Vite dev server command for logging.
 *
 * @param port - The port number (optional, for display purposes)
 * @returns Formatted command description
 */
const getViteDevServerCommandDescription = (port) => {
    const portStr = port ? ` --port ${port}` : "";
    return `rm -rf node_modules/.vite node_modules/.tmp && touch src/index.css && bun vite${portStr} --force (waiting for initial optimization)`;
};
exports.getViteDevServerCommandDescription = getViteDevServerCommandDescription;
//# sourceMappingURL=sandbox.js.map