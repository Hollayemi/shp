/**
 * PostHog Manual Capture Utility
 *
 * This utility provides functions to manually capture PostHog events via direct API calls
 * instead of using the PostHog SDK client. This approach gives us full control over
 * the event data and ensures compatibility with PostHog's LLM analytics dashboard.
 */

interface PostHogEventProperties {
  distinct_id: string;
  [key: string]: any;
}

interface PostHogEvent {
  api_key: string;
  event: string;
  properties: PostHogEventProperties;
  timestamp?: string;
}

interface PostHogAIGenerationProperties extends PostHogEventProperties {
  $ai_trace_id: string;
  $ai_span_id?: string;
  $ai_span_name?: string;
  $ai_parent_id?: string;
  $ai_model: string;
  $ai_provider: string;
  $ai_input: any[];
  $ai_input_tokens?: number;
  $ai_output_choices?: any[];
  $ai_output_tokens?: number;
  $ai_latency?: number;
  $ai_http_status?: number;
  $ai_base_url?: string;
  $ai_request_url?: string;
  $ai_is_error?: boolean;
  $ai_error?: any;
  $ai_input_cost_usd?: number;
  $ai_output_cost_usd?: number;
  $ai_total_cost_usd?: number;
  $ai_temperature?: number;
  $ai_stream?: boolean;
  $ai_max_tokens?: number;
  $ai_tools?: any[];
  $ai_cache_read_input_tokens?: number;
  $ai_cache_creation_input_tokens?: number;
}

interface PostHogAITraceProperties extends PostHogEventProperties {
  $ai_trace_id: string;
  $ai_input_state?: any;
  $ai_output_state?: any;
  $ai_latency?: number;
  $ai_span_name?: string;
  $ai_is_error?: boolean;
  $ai_error?: any;
}

interface PostHogAISpanProperties extends PostHogEventProperties {
  $ai_trace_id: string;
  $ai_span_id?: string;
  $ai_span_name?: string;
  $ai_parent_id?: string;
  $ai_input_state?: any;
  $ai_output_state?: any;
  $ai_latency?: number;
  $ai_is_error?: boolean;
  $ai_error?: any;
}

/**
 * Environment properties for consistent tracking across dev/prod
 */
interface EnvironmentProperties {
  environment: string;
  vercel_env?: string;
}

/**
 * Generate consistent environment properties for PostHog events
 * This helps differentiate between dev, staging, and production chat sessions
 */
export function getEnvironmentProperties(): EnvironmentProperties {
  const nodeEnv = process.env.NODE_ENV || "development";
  const vercelEnv = process.env.VERCEL_ENV;

  return {
    environment: nodeEnv,
    vercel_env: vercelEnv,
  };
}

class PostHogManualCapture {
  private apiKey: string;
  private host: string;

  constructor() {
    this.apiKey =
      process.env.POSTHOG_PROJECT_API_KEY ||
      process.env.NEXT_PUBLIC_POSTHOG_KEY ||
      "";
    this.host =
      process.env.POSTHOG_HOST ||
      process.env.NEXT_PUBLIC_POSTHOG_HOST ||
      "https://eu.i.posthog.com";
  }

  private async sendEvent(event: PostHogEvent): Promise<void> {
    if (!this.apiKey) {
      console.warn("[PostHog] API key not configured, skipping event capture");
      return;
    }

    try {
      const response = await fetch(`${this.host}/i/v0/e/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...event,
          api_key: this.apiKey,
          timestamp: event.timestamp || new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        console.error(
          `[PostHog] Failed to send event: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      console.error("[PostHog] Error sending event:", error);
    }
  }

  /**
   * Capture an AI generation event
   * @param properties - The properties for the AI generation event
   */
  async captureAIGeneration(
    properties: PostHogAIGenerationProperties,
  ): Promise<void> {
    await this.sendEvent({
      api_key: this.apiKey,
      event: "$ai_generation",
      properties,
    });
  }

  /**
   * Capture an AI trace event
   * @param properties - The properties for the AI trace event
   */
  async captureAITrace(properties: PostHogAITraceProperties): Promise<void> {
    await this.sendEvent({
      api_key: this.apiKey,
      event: "$ai_trace",
      properties,
    });
  }

  /**
   * Capture an AI span event
   * @param properties - The properties for the AI span event
   */
  async captureAISpan(properties: PostHogAISpanProperties): Promise<void> {
    await this.sendEvent({
      api_key: this.apiKey,
      event: "$ai_span",
      properties,
    });
  }

  /**
   * Capture a custom event
   * @param event - The event name
   * @param properties - The event properties
   */
  async capture(
    event: string,
    properties: PostHogEventProperties,
  ): Promise<void> {
    await this.sendEvent({
      api_key: this.apiKey,
      event,
      properties,
    });
  }

  /**
   * Check if PostHog is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

// Singleton instance
let postHogCapture: PostHogManualCapture | null = null;

/**
 * Get the PostHog manual capture instance
 */
export function getPostHogCapture(): PostHogManualCapture {
  if (!postHogCapture) {
    postHogCapture = new PostHogManualCapture();
  }
  return postHogCapture;
}

/**
 * Helper function to generate a unique span ID
 */
export function generateSpanId(): string {
  return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper function to generate a unique trace ID
 */
export function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Export types for use in other files
export type {
  PostHogAIGenerationProperties,
  PostHogAITraceProperties,
  PostHogAISpanProperties,
  PostHogEventProperties,
  EnvironmentProperties,
};
