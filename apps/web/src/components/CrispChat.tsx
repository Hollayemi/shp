"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    $crisp: any[];
    CRISP_WEBSITE_ID: string;
  }
}

const CRISP_ID = "ee9a8a67-90d1-4045-a824-387af9c6e4c7";

function ensureCrispLoaded() {
  if (typeof window === "undefined") return;

  if (!window.$crisp) {
    window.$crisp = [];
  }

  if (!window.CRISP_WEBSITE_ID) {
    window.CRISP_WEBSITE_ID = CRISP_ID;
  }

  const hasScript = document.querySelector(
    'script[src="https://client.crisp.chat/l.js"]',
  );

  if (!hasScript) {
    const script = document.createElement("script");
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    document.head.appendChild(script);
  }
}

export default function CrispChat() {
  const pathname = usePathname();

  useEffect(() => {
    // Don't load Crisp at all on embed pages
    if (pathname?.includes("embed")) {
      return;
    }

    ensureCrispLoaded();

    // When chat is closed on project pages, hide the widget again so it only shows after an explicit support click
    if (window.$crisp) {
      window.$crisp.push([
        "on",
        "chat:closed",
        () => {
          if (pathname?.includes("projects")) {
            window.$crisp.push(["do", "chat:hide"]);
            window.$crisp.push(["config", "hide:on:mobile", [true]]);
          }
        },
      ]);
    }

    return () => {
      const existingScript = document.querySelector(
        'script[src="https://client.crisp.chat/l.js"]',
      );
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [pathname]);

  // Handle show/hide based on pathname
  useEffect(() => {
    if (!window.$crisp) return;

    const isProject = pathname?.includes("projects");
    const isEmbed = pathname?.includes("embed");

    if (isEmbed) {
      window.$crisp.push(["do", "chat:hide"]);
      return;
    }

    if (isProject) {
      // Hide widget on project pages by default; it will be shown when support is explicitly opened
      window.$crisp.push(["do", "chat:hide"]);
      window.$crisp.push(["config", "hide:on:mobile", [true]]);
    } else {
      window.$crisp.push(["do", "chat:show"]);
      window.$crisp.push(["config", "hide:on:mobile", [false]]);
    }
  }, [pathname]);

  return null;
}
