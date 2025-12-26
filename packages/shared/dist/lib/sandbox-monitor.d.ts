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
export declare const MONITOR_CONFIG: {
    readonly ALLOWED_ORIGINS: readonly [string, "https://app.shipper.now", "https://staging.shipper.now"];
    readonly DEBOUNCE_DELAY: 250;
    readonly MAX_STRING_LENGTH: 10000;
    readonly MAX_DEPTH: 5;
    readonly MAX_ARRAY_LENGTH: 100;
    readonly MAX_OBJECT_KEYS: 100;
    readonly HIGHLIGHT_COLOR: "#3b82f6";
    readonly VISUAL_EDIT_ENABLED: false;
};
export type MonitorEventType = "RUNTIME_ERROR" | "RESOURCE_LOAD_ERROR" | "UNHANDLED_PROMISE_REJECTION" | "NETWORK_REQUEST" | "CONSOLE_OUTPUT" | "URL_CHANGED" | "BLANK_SCREEN_DETECTED" | "CONTENT_LOADED" | "MONITOR_INITIALIZED" | "VISUAL_EDIT_READY" | "ELEMENT_SELECTED";
export interface MonitorEvent {
    type: MonitorEventType;
    timestamp: string;
    data: unknown;
}
export interface RuntimeErrorEvent extends MonitorEvent {
    type: "RUNTIME_ERROR";
    data: {
        message: string;
        filename?: string;
        lineno?: number;
        colno?: number;
        stack?: string;
        blankScreen: boolean;
    };
}
export interface ResourceLoadErrorEvent extends MonitorEvent {
    type: "RESOURCE_LOAD_ERROR";
    data: {
        message: string;
        tagName: string;
        src: string;
        blankScreen: boolean;
    };
}
export interface NetworkRequestEvent extends MonitorEvent {
    type: "NETWORK_REQUEST";
    data: {
        url: string;
        method: string;
        status?: number;
        statusText?: string;
        requestBody?: string;
        responseBody?: string;
        duration: number;
        timestamp: string;
        error?: {
            message: string;
            stack?: string;
        };
    };
}
export interface ConsoleOutputEvent extends MonitorEvent {
    type: "CONSOLE_OUTPUT";
    data: {
        messages: Array<{
            level: "info" | "warning" | "error";
            message: string;
            logged_at: string;
            raw: unknown[];
        }>;
    };
}
export interface ContentLoadedEvent extends MonitorEvent {
    type: "CONTENT_LOADED";
    data: {
        hasContent: boolean;
        rootElementExists: boolean;
        rootHasChildren: boolean;
        hmrComplete: boolean;
        reactReady: boolean;
    };
}
/**
 * Generate the monitoring script to be injected into the sandbox
 * This is the complete script from shipper-vite-template/.shipper/monitor.js
 */
export declare function generateMonitorScript(allowedOrigins: readonly string[]): string;
/**
 * Create a script tag to inject monitoring code
 */
export declare function createMonitorScriptTag(allowedOrigins: string[]): string;
/**
 * Inject monitoring script into HTML content
 */
export declare function injectMonitoringScript(html: string, allowedOrigins: string[]): string;
//# sourceMappingURL=sandbox-monitor.d.ts.map