"use client";
import { cn } from "@/lib/utils";
import React, { useEffect, useRef, useState } from "react";
import { createNoise3D } from "simplex-noise";
import { useTheme } from "next-themes";

export const WavyBackground = ({
  children,
  className,
  containerClassName,
  colors,
  waveWidth,
  backgroundFill,
  blur = 10,
  speed = "fast",
  waveOpacity = 0.5,
  ...props
}: {
  children?: any;
  className?: string;
  containerClassName?: string;
  colors?: string[];
  waveWidth?: number;
  backgroundFill?: string;
  blur?: number;
  speed?: "slow" | "fast";
  waveOpacity?: number;
  [key: string]: any;
}) => {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const noise = createNoise3D();
  let w: number,
    h: number,
    nt: number,
    i: number,
    x: number,
    ctx: any,
    canvas: any;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getSpeed = () => {
    switch (speed) {
      case "slow":
        return 0.001;
      case "fast":
        return 0.002;
      default:
        return 0.001;
    }
  };

  const init = () => {
    canvas = canvasRef.current;
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    const container = canvas.parentElement;
    if (!container) return;
    
    // Use container dimensions instead of full window
    w = ctx.canvas.width = container.clientWidth;
    h = ctx.canvas.height = container.clientHeight;
    ctx.filter = `blur(${blur}px)`;
    nt = 0;
    
    // Debounced resize function to prevent flicker
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = (width: number, height: number) => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!canvas || !ctx) return;
        w = ctx.canvas.width = width;
        h = ctx.canvas.height = height;
        ctx.filter = `blur(${blur}px)`;
      }, 16); // 60fps throttling
    };
    
    // ResizeObserver for dynamic container size changes (like ResizablePanel)
    const resizeObserver = new ResizeObserver((entries) => {
      if (!canvas || !container) return;
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        // Only resize if dimensions actually changed significantly
        if (Math.abs(width - w) > 2 || Math.abs(height - h) > 2) {
          debouncedResize(width, height);
        }
      }
    });
    
    // Observe the container for size changes
    resizeObserver.observe(container);
    
    // Also listen for window resize as fallback (debounced)
    const handleResize = () => {
      if (!canvas || !container) return;
      debouncedResize(container.clientWidth, container.clientHeight);
    };
    
    window.addEventListener('resize', handleResize);
    startAnimation();
    
    return () => {
      stopAnimation();
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  };

  // Theme-aware colors
  const isDark = resolvedTheme === 'dark';
  
  const waveColors = colors ?? (isDark ? [
    "#3b82f6", // blue-500
    "#06b6d4", // cyan-500
    "#0891b2", // cyan-600
    "#0284c7", // sky-600
    "#1d4ed8", // blue-700
  ] : [
    "#60a5fa", // blue-400
    "#38bdf8", // sky-400
    "#22d3ee", // cyan-400
    "#06b6d4", // cyan-500
    "#0ea5e9", // sky-500
  ]);
  const drawWave = (n: number) => {
    nt += getSpeed();
    for (i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.lineWidth = waveWidth || 15; // Much thinner waves (was 50, now 15)
      ctx.strokeStyle = waveColors[i % waveColors.length];
      for (x = 0; x < w; x += 5) {
        const y = noise(x / 800, 0.3 * i, nt) * 100;
        ctx.lineTo(x, y + h * 0.5); // adjust for height, currently at 50% of the container
      }
      ctx.stroke();
      ctx.closePath();
    }
  };

  let animationId: number;
  let isAnimating = false;
  
  const render = () => {
    if (!ctx || !canvas) return;
    
    // Theme-aware background
    const defaultBg = isDark ? "#0f172a" : "#f8fafc"; // slate-900 : slate-50
    ctx.fillStyle = backgroundFill || defaultBg;
    ctx.globalAlpha = waveOpacity || 0.5;
    ctx.fillRect(0, 0, w, h);
    drawWave(5);
    
    if (isAnimating) {
      animationId = requestAnimationFrame(render);
    }
  };
  
  const startAnimation = () => {
    if (!isAnimating) {
      isAnimating = true;
      render();
    }
  };
  
  const stopAnimation = () => {
    isAnimating = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const cleanup = init();
    return () => {
      if (cleanup) cleanup();
    };
  }, [mounted, isDark]); // Re-render when theme changes

  const [isSafari, setIsSafari] = useState(false);
  useEffect(() => {
    // I'm sorry but i have got to support it on safari.
    setIsSafari(
      typeof window !== "undefined" &&
        navigator.userAgent.includes("Safari") &&
        !navigator.userAgent.includes("Chrome")
    );
  }, []);

  // Don't render until mounted to avoid hydration issues
  if (!mounted) return null;

  return (
    <div
      className={cn(
        "relative w-full h-full flex items-center justify-center overflow-hidden",
        containerClassName
      )}
    >
      <canvas
        className="absolute inset-0 z-0"
        ref={canvasRef}
        id="canvas"
        style={{
          ...(isSafari ? { filter: `blur(${blur}px)` } : {}),
        }}
      ></canvas>
      
      {/* Dimmer overlay for better text readability */}
      <div className="absolute inset-0 z-5 bg-black/20 dark:bg-black/40"></div>
      
      <div className={cn("relative z-10 flex items-center justify-center w-full h-full", className)} {...props}>
        <div className="text-center p-8 rounded-2xl bg-background/10 backdrop-blur-sm border border-white/10">
          {children}
        </div>
      </div>
    </div>
  );
};
