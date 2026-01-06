

declare global {
    interface Window {
      Frill(
        method: FrillWidgetMethods,
        config: FrillWidgetConfig
      ): CancelablePromise<FrillWidget>;
    }
  }
  
  export interface FrillWidget {
    open(): void;
    close(): void;
    destroy(): void;
    viewSection(section: "ideas" | "roadmap" | "announcements"): void;
    events: {
      on<K extends keyof FrillWidgetEvents>(
        event: K,
         
        callback: (payload: FrillWidgetEvents[K]) => any
      ): Unsubscribe;
    };
  }
  
  export type FrillWidgetMethods = "widget" | "survey";
  
  interface FrillWidgetEvents {
    ready: void;
    open: void;
    close: void;
    badgeCount: { announcements: object[]; count: number };
  }
  
  type Unsubscribe = () => void;
  
  interface FrillWidgetConfig {
    key: string;
    callbacks?: { onReady?(widget: FrillWidget): void };
  }
  
  type CancelablePromise<T> = Promise<T> & { destroy(): void };