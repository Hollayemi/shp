"use client";

import { useState, useEffect, useRef } from "react";

interface TypewriterTextProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export const TypewriterText = ({
  text,
  speed = 50,
  className = "",
  onComplete,
}: TypewriterTextProps) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const indexRef = useRef(0);
  const previousTextRef = useRef("");

  useEffect(() => {
    // Always start animation on mount or when text changes
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setDisplayedText("");
    setIsComplete(false);
    indexRef.current = 0;
    previousTextRef.current = text;

    // Start typing animation
    const typeNextChar = () => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.slice(0, indexRef.current + 1));
        indexRef.current++;

        // Use requestAnimationFrame for better performance
        timeoutRef.current = setTimeout(() => {
          requestAnimationFrame(typeNextChar);
        }, speed);
      } else {
        setIsComplete(true);
        onComplete?.();
      }
    };

    // Start with a small delay
    timeoutRef.current = setTimeout(() => {
      requestAnimationFrame(typeNextChar);
    }, 100);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, speed, onComplete]);

  return (
    <span className={className}>
      {displayedText}
      {!isComplete && (
        <span className="text-muted-foreground animate-pulse dark:text-[#B8C9C3]">
          |
        </span>
      )}
    </span>
  );
};
