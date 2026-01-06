"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageContent } from "@/components/ai-elements/message";

export const ThinkingBubble = () => {
  const STATES = useMemo(() => ["Reading...", "Understanding...", "Thinking...", "Reasoning..."], [])  ;

  const [index, setIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [showCursor, setShowCursor] = useState(false);

  const charIndexRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const TYPING_SPEED = 45;
  const STATE_PAUSE = 1500;
  const INITIAL_DELAY = 250;
  const CURSOR_FADE_IN = 100;
  const CURSOR_FADE_OUT = 350;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Typewriter + cursor animation logic
  useEffect(() => {
    const text = STATES[index];
    let cancelled = false;

    setDisplayedText("");
    setShowCursor(false);
    charIndexRef.current = 0;

    // Fade in cursor before typing starts
    const cursorInTimer = setTimeout(() => {
      if (!cancelled) setShowCursor(true);
    }, CURSOR_FADE_IN);

    const typeNextChar = () => {
      if (cancelled) return;

      if (charIndexRef.current < text.length) {
        setDisplayedText(text.slice(0, ++charIndexRef.current));
        timeoutRef.current = setTimeout(typeNextChar, TYPING_SPEED);
      } else {
        // Typing complete - fade out cursor, then cycle to next state
        const cursorOutTimer = setTimeout(() => {
          if (!cancelled) setShowCursor(false);
        }, CURSOR_FADE_OUT);

        timeoutRef.current = setTimeout(() => {
          if (!cancelled) {
            setIndex((prev) => (prev < 3 ? prev + 1 : prev === 3 ? 2 : 3));
          }
        }, STATE_PAUSE);

        // Cleanup cursor timer if effect is cancelled
        return () => clearTimeout(cursorOutTimer);
      }
    };

    timeoutRef.current = setTimeout(typeNextChar, INITIAL_DELAY);

    return () => {
      cancelled = true;
      clearTimeout(cursorInTimer);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [index, STATES]);

  return (
    <MessageContent className="group-[.is-assistant]:bg-transparent group-[.is-assistant]:px-0 group-[.is-assistant]:py-0 group-[.is-assistant]:shadow-none">
      <div className="text-prj-message-assistant-text flex items-center gap-3">
        {/* Animated dots */}
        <div className="text-prj-message-assistant-text/70 flex items-center gap-1">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="animate-thinking-bounce h-2 w-2 rounded-full bg-current opacity-70"
              style={{ animationDelay: `${dot * 150}ms` }}
            />
          ))}
        </div>

        {/* Typing text + cursor */}
        <span
          className="text-prj-message-assistant-text text-sm font-medium inline-flex items-center dark:text-[#B8C9C3]"
          aria-live="polite"
        >
          {displayedText}
          <span
            className={`animate-pulse text-muted-foreground dark:text-[#B8C9C3] transition-opacity duration-300 ${
              showCursor ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden="true"
          >
            |
          </span>
        </span>
      </div>
    </MessageContent>
  );
};

export default ThinkingBubble;