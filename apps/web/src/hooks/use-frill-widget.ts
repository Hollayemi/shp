"use client";

import React from "react";
import type { FrillWidget, FrillWidgetMethods } from "../frill-types";

export function useFrillWidget(
  method: FrillWidgetMethods,
  key: string
): React.RefObject<FrillWidget | null> {
  const widgetRef = React.useRef<FrillWidget>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const frill = window.Frill;

    if (typeof frill !== "function") {
      if (process.env.NODE_ENV === "development") {
        console.warn("Frill widget script not loaded or misconfigured");
      }
      return;
    }

    if (!key) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Missing Frill widget key");
      }
      return;
    }

    let cancelled = false;
    const widgetPromise = frill(method, {
      key,
      callbacks: {
        onReady(widgetInstance) {
          if (!cancelled) {
            widgetRef.current = widgetInstance;
          }
        },
      },
    });

    // Ensure promise rejections are surfaced during development
    if (widgetPromise && typeof widgetPromise.then === "function") {
      widgetPromise.catch((error: unknown) => {
        console.error("Failed to initialize Frill widget:", error);
      });
    }

    return () => {
      cancelled = true;
      widgetRef.current = null;

      const destroyWidget = (widgetInstance: unknown) => {
        if (widgetInstance && typeof (widgetInstance as FrillWidget).destroy === "function") {
          try {
            (widgetInstance as FrillWidget).destroy();
          } catch (error) {
            console.error("Error destroying Frill widget:", error);
          }
        }
      };

      if (widgetPromise && typeof widgetPromise.destroy === "function") {
        try {
          widgetPromise.destroy();
        } catch (error) {
          console.error("Error destroying Frill widget promise:", error);
        }
        return;
      }

      if (widgetPromise && typeof widgetPromise.then === "function") {
        widgetPromise
          .then(destroyWidget)
          .catch((error: unknown) => {
            console.error("Error destroying Frill widget after resolve:", error);
          });
      } else {
        destroyWidget(widgetPromise);
      }
    };
  }, [method, key]);

  return widgetRef;
}
