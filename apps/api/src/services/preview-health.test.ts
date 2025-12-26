/**
 * Tests for Preview Health Probe
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { probePreviewUrl, quickHealthCheck } from './preview-health.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Preview Health Probe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console.log to avoid cluttering test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('probePreviewUrl', () => {
    it('should return healthy for valid HTML with root div', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Test App</title></head>
          <body>
            <div id="root"></div>
            <script src="/main.js"></script>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {
          get: (key: string) => key === 'content-type' ? 'text/html; charset=utf-8' : null,
        },
        text: async () => mockHtml,
      } as any);

      const result = await probePreviewUrl('https://preview.example.com', {
        retries: 1,
      });

      expect(result.healthy).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should detect missing root div', async () => {
      // Make HTML > 200 bytes so it doesn't hit the "too small" check
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Test App</title></head>
          <body>
            <div id="app">This is a test application with enough content to pass the size check but no root div</div>
            <script src="/main.js"></script>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {
          get: (key: string) => key === 'content-type' ? 'text/html' : null,
        },
        text: async () => mockHtml,
      } as any);

      const result = await probePreviewUrl('https://preview.example.com', {
        retries: 1,
      });

      expect(result.healthy).toBe(false);
      expect(result.reason).toContain('No root div');
    });

    it('should detect 404 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        statusText: 'Not Found',
        headers: {
          get: () => null,
        },
      } as any);

      const result = await probePreviewUrl('https://preview.example.com', {
        retries: 1,
      });

      expect(result.healthy).toBe(false);
      expect(result.reason).toContain('HTTP 404');
      expect(result.statusCode).toBe(404);
    });

    it('should detect 500 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 500,
        statusText: 'Internal Server Error',
        headers: {
          get: () => null,
        },
      } as any);

      const result = await probePreviewUrl('https://preview.example.com', {
        retries: 1,
      });

      expect(result.healthy).toBe(false);
      expect(result.reason).toContain('HTTP 500');
    });

    it('should detect wrong content type', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {
          get: (key: string) => key === 'content-type' ? 'application/json' : null,
        },
        text: async () => '{}',
      } as any);

      const result = await probePreviewUrl('https://preview.example.com', {
        retries: 1,
        expectHtml: true,
      });

      expect(result.healthy).toBe(false);
      expect(result.reason).toContain('Expected HTML, got application/json');
    });

    it('should detect error messages in HTML', async () => {
      // Make HTML > 200 bytes
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Error Page</title></head>
          <body>
            <div id="root"></div>
            <div class="error-message">Cannot GET /api/test endpoint was not found on the server</div>
            <script src="/bundle.js"></script>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {
          get: (key: string) => key === 'content-type' ? 'text/html' : null,
        },
        text: async () => mockHtml,
      } as any);

      const result = await probePreviewUrl('https://preview.example.com', {
        retries: 1,
      });

      expect(result.healthy).toBe(false);
      expect(result.reason).toContain('Error page detected');
    });

    it('should detect suspiciously small HTML', async () => {
      const mockHtml = `<html><body></body></html>`; // Only 27 bytes

      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {
          get: (key: string) => key === 'content-type' ? 'text/html' : null,
        },
        text: async () => mockHtml,
      } as any);

      const result = await probePreviewUrl('https://preview.example.com', {
        retries: 1,
        expectRootDiv: true,
      });

      expect(result.healthy).toBe(false);
      expect(result.reason).toContain('HTML too small');
    });

    it('should handle timeout errors', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await probePreviewUrl('https://preview.example.com', {
        retries: 1,
        timeoutMs: 1000,
      });

      expect(result.healthy).toBe(false);
      expect(result.reason).toContain('Timeout');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await probePreviewUrl('https://preview.example.com', {
        retries: 1,
      });

      expect(result.healthy).toBe(false);
      expect(result.reason).toContain('Network error');
    });

    it('should retry on transient failures', async () => {
      // First attempt fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: {
            get: (key: string) => key === 'content-type' ? 'text/html' : null,
          },
          text: async () => {
            // Make HTML > 200 bytes
            const html = `
              <!DOCTYPE html>
              <html>
                <head><title>Retry Test</title></head>
                <body>
                  <div id="root">App content loaded successfully after retry</div>
                  <script src="/bundle.js"></script>
                </body>
              </html>
            `;
            return html;
          },
        } as any);

      const result = await probePreviewUrl('https://preview.example.com', {
        retries: 2,
        retryDelayMs: 10, // Fast for testing
      });

      expect(result.healthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should skip root div check when disabled', async () => {
      const mockHtml = '<html><body><div id="app"></div></body></html>';

      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {
          get: (key: string) => key === 'content-type' ? 'text/html' : null,
        },
        text: async () => mockHtml,
      } as any);

      const result = await probePreviewUrl('https://preview.example.com', {
        retries: 1,
        expectRootDiv: false,
      });

      expect(result.healthy).toBe(true);
    });

    it('should detect various error patterns', async () => {
      const errorCases = [
        'Failed to compile',
        'SyntaxError: Unexpected token',
        'Module not found',
        '404 Not Found',
        '500 Internal Server Error',
        '502 Bad Gateway',
        '503 Service Unavailable',
      ];

      for (const errorMsg of errorCases) {
        vi.clearAllMocks();
        
        // Make HTML > 200 bytes
        const mockHtml = `
          <!DOCTYPE html>
          <html>
            <head><title>Error</title></head>
            <body>
              <div id="root"></div>
              <div class="error-container">${errorMsg} - This error occurred during the application build process</div>
              <script src="/main.js"></script>
            </body>
          </html>
        `;

        mockFetch.mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: {
            get: (key: string) => key === 'content-type' ? 'text/html' : null,
          },
          text: async () => mockHtml,
        } as any);

        const result = await probePreviewUrl('https://preview.example.com', {
          retries: 1,
        });

        expect(result.healthy).toBe(false);
        expect(result.reason).toContain('Error page detected');
      }
    });

    it('should merge additional headers with defaults', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {
          get: (key: string) => (key === 'content-type' ? 'text/html' : null),
        },
        text: async () => `
          <!doctype html>
          <html>
            <body><div id="root"></div></body>
          </html>
        `,
      } as any);

      await probePreviewUrl('https://preview.example.com', {
        headers: { 'X-Test-Header': 'true' },
        retries: 1,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://preview.example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Test-Header': 'true',
            'User-Agent': 'Shipper-HealthProbe/1.0',
            Accept: 'text/html,application/xhtml+xml',
          }),
        }),
      );
    });
  });

  describe('quickHealthCheck', () => {
    it('should perform fast health check', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {
          get: (key: string) => key === 'content-type' ? 'text/html' : null,
        },
        text: async () => '<html></html>',
      } as any);

      const result = await quickHealthCheck('https://preview.example.com');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return false on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await quickHealthCheck('https://preview.example.com');

      expect(result).toBe(false);
    });
  });
});
