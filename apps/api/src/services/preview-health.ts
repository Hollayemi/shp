/**
 * Preview Health Probe
 *
 * Validates that a sandbox preview URL is healthy and ready.
 * Performs HTTP health checks with retry logic and content validation.
 *
 * @module preview-health
 *
 * Uses native fetch API (Node 18+)
 */

export interface HealthProbeOptions {
  /** Maximum time to wait for response (ms) */
  timeoutMs?: number;
  /** Expect text/html content type */
  expectHtml?: boolean;
  /** Expect <div id="root"> in HTML */
  expectRootDiv?: boolean;
  /** Number of retry attempts */
  retries?: number;
  /** Delay between retries (ms) */
  retryDelayMs?: number;
  /** Additional headers to send with the probe */
  headers?: Record<string, string>;
}

export interface HealthProbeResult {
  /** Whether the preview is healthy */
  healthy: boolean;
  /** Reason for failure (if unhealthy) */
  reason?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Response time in milliseconds */
  responseTime?: number;
}

/**
 * Probe a sandbox preview URL to verify it's healthy and serving content.
 *
 * Performs the following checks:
 * 1. HTTP GET returns 200 OK
 * 2. Content-Type is text/html (if expectHtml=true)
 * 3. HTML contains <div id="root"> (if expectRootDiv=true)
 * 4. No obvious error messages in HTML
 *
 * Retries failed requests with exponential backoff.
 *
 * @param url - Full URL to probe (e.g., https://preview--5173-sandbox.shipper.now)
 * @param options - Configuration options
 * @returns Promise<HealthProbeResult> - Health check result
 *
 * @example
 * ```typescript
 * const result = await probePreviewUrl('https://preview.example.com', {
 *   timeoutMs: 10000,
 *   expectRootDiv: true,
 *   retries: 3
 * });
 *
 * if (!result.healthy) {
 *   console.error(`Preview unhealthy: ${result.reason}`);
 * }
 * ```
 */
export async function probePreviewUrl(
  url: string,
  options: HealthProbeOptions = {},
): Promise<HealthProbeResult> {
  const {
    timeoutMs = 10000,
    expectHtml = true,
    expectRootDiv = true,
    retries = 3,
    retryDelayMs = 2000,
    headers: additionalHeaders = {},
  } = options;

  console.log(
    `[PreviewHealth] Probing ${url} (${retries} attempts, ${timeoutMs}ms timeout)`,
  );

  for (let attempt = 0; attempt < retries; attempt++) {
    const startTime = Date.now();

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      console.log(`[PreviewHealth] Attempt ${attempt + 1}/${retries}...`);

      // Make HTTP request
      const headers = {
        "User-Agent": "Shipper-HealthProbe/1.0",
        Accept: "text/html,application/xhtml+xml",
        ...additionalHeaders,
      };

      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow", // Follow redirects
        headers,
      });

      clearTimeout(timeout);

      const responseTime = Date.now() - startTime;
      console.log(
        `[PreviewHealth] Response: ${response.status} in ${responseTime}ms`,
      );

      // Check 1: HTTP status code
      if (response.status !== 200) {
        if (attempt < retries - 1) {
          console.log(
            `[PreviewHealth] Non-200 status, retrying in ${retryDelayMs}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }
        return {
          healthy: false,
          reason: `HTTP ${response.status} ${response.statusText}`,
          statusCode: response.status,
          responseTime,
        };
      }

      // Check 2: Content type
      const contentType = response.headers.get("content-type") || "";
      if (expectHtml && !contentType.includes("text/html")) {
        console.log(`[PreviewHealth] Unexpected content type: ${contentType}`);
        return {
          healthy: false,
          reason: `Expected HTML, got ${contentType}`,
          statusCode: response.status,
          responseTime,
        };
      }

      // Check 3: HTML content validation
      if (expectRootDiv) {
        const html = await response.text();
        console.log(`[PreviewHealth] Received ${html.length} bytes of HTML`);

        // Check if HTML is suspiciously small first (before checking root div)
        if (html.length < 200) {
          console.log(`[PreviewHealth] HTML too small (${html.length} bytes)`);
          return {
            healthy: false,
            reason: `HTML too small (${html.length} bytes) - likely error page`,
            statusCode: response.status,
            responseTime,
          };
        }

        // Check for root div
        const hasRootDiv =
          html.includes('id="root"') || html.includes("id='root'");
        if (!hasRootDiv) {
          console.log(`[PreviewHealth] No root div found in HTML`);
          return {
            healthy: false,
            reason: "No root div found in HTML",
            statusCode: response.status,
            responseTime,
          };
        }

        // Check for common error patterns
        const errorPatterns = [
          /Cannot\s+GET/i,
          /404\s+Not\s+Found/i,
          /500\s+Internal\s+Server\s+Error/i,
          /502\s+Bad\s+Gateway/i,
          /503\s+Service\s+Unavailable/i,
          /Failed\s+to\s+compile/i,
          /SyntaxError/i,
          /Module\s+not\s+found/i,
        ];

        for (const pattern of errorPatterns) {
          if (pattern.test(html)) {
            console.log(`[PreviewHealth] Error pattern detected: ${pattern}`);
            return {
              healthy: false,
              reason: `Error page detected: ${pattern.source}`,
              statusCode: response.status,
              responseTime,
            };
          }
        }
      }

      // All checks passed!
      console.log(`[PreviewHealth] ✅ Preview is healthy`);
      return {
        healthy: true,
        statusCode: response.status,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      // Handle timeout
      if (error.name === "AbortError") {
        console.log(`[PreviewHealth] Timeout after ${responseTime}ms`);
        if (attempt < retries - 1) {
          console.log(`[PreviewHealth] Retrying in ${retryDelayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }
        return {
          healthy: false,
          reason: `Timeout after ${timeoutMs}ms`,
          responseTime,
        };
      }

      // Handle network errors
      console.log(`[PreviewHealth] Network error: ${error.message}`);
      if (attempt < retries - 1) {
        console.log(`[PreviewHealth] Retrying in ${retryDelayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }

      return {
        healthy: false,
        reason: `Network error: ${error.message}`,
        responseTime,
      };
    }
  }

  // Should never reach here, but just in case
  console.log(`[PreviewHealth] Failed after ${retries} attempts`);
  return {
    healthy: false,
    reason: `Failed after ${retries} attempts`,
  };
}

/**
 * Quick health check (single attempt, short timeout)
 * Useful for fast non-blocking checks.
 */
export async function quickHealthCheck(url: string): Promise<boolean> {
  const result = await probePreviewUrl(url, {
    timeoutMs: 3000,
    expectRootDiv: false,
    retries: 1,
  });
  return result.healthy;
}
