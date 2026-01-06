"use client";

import { GenerativeChatInput } from "@/app/_components/GenerativeChatInput";
import { Suspense, useEffect } from "react";

export default function EmbedChatInputPage() {
  // Get the base URL from environment or construct it
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                  (typeof window !== 'undefined' ? window.location.origin : '');

  // Auto-resize iframe height based on content
  useEffect(() => {
    const resizeIframe = () => {
      const height = document.documentElement.scrollHeight;
      
      // Send height to parent window
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'iframe-resize',
          height: height
        }, '*');
      }
    };

    // Initial resize
    resizeIframe();

    // Resize on content changes
    const observer = new ResizeObserver(resizeIframe);
    observer.observe(document.body);

    // Resize on window resize
    window.addEventListener('resize', resizeIframe);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resizeIframe);
    };
  }, []);

  return (
    <div className="min-h-fit mt-4 mx-2">
      <div className="max-w-4xl mx-auto">
        <Suspense fallback={<div className="text-center text-foreground">Loading...</div>}>
          <GenerativeChatInput embedded={true} baseUrl={baseUrl} />
        </Suspense>
      </div>
    </div>
  );
}
