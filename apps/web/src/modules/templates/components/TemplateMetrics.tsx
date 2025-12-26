"use client";

import { Heart, Bookmark, RefreshCw, Eye } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { cn } from "@/lib/utils";

interface TemplateMetricsProps {
  remixes: number;
  likes: number;
  saves: number;
  views?: number;
  variant?: "default" | "compact" | "detailed";
  className?: string;
  showLabels?: boolean;
  userLiked?: boolean;
  userSaved?: boolean;
}

export function TemplateMetrics({
  remixes,
  likes,
  saves,
  views,
  userLiked,
  userSaved,
  variant = "default",
  className,
  showLabels = false,
}: TemplateMetricsProps) {
  const metrics = [
    {
      icon: RefreshCw,
      value: remixes,
      label: "Remixes",
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      icon: Heart,
      value: likes,
      label: "Likes",
      color: "text-red-600 dark:text-red-400",
      fill: userLiked ? "currentColor" : "none",
    },
    {
      icon: Bookmark,
      value: saves,
      label: "Saves",
      color: "text-yellow-600 dark:text-yellow-400",
      fill: userSaved ? "currentColor" : "none",
    },
  ];

  if (views !== undefined) {
    metrics.push({
      icon: Eye,
      value: views,
      label: "Views",
      color: "text-gray-600 dark:text-gray-400",
    });
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <metric.icon
              className="h-3.5 w-3.5"
              fill={metric.fill}
            />
            <span>{formatNumber(metric.value)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "detailed") {
    return (
      <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-4", className)}>
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex flex-col items-center rounded-lg border bg-card p-3"
          >
            <metric.icon
              className={cn("mb-1 h-5 w-5", metric.color)}
              fill={metric.fill}
            />
            <div className="text-2xl font-bold">{formatNumber(metric.value)}</div>
            <div className="text-xs text-muted-foreground">{metric.label}</div>
          </div>
        ))}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("flex flex-wrap items-center gap-4", className)}>
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="flex items-center gap-2 text-sm"
        >
          <metric.icon
            className={cn("h-4 w-4", metric.color)}
            fill={metric.fill}
          />
          <span className="font-medium">{formatNumber(metric.value)}</span>
          {showLabels && (
            <span className="text-muted-foreground">{metric.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}

