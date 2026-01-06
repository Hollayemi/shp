"use client";

import { Loader2 } from "lucide-react";
import { RiSparkling2Fill } from "react-icons/ri";
import { HiMiniMagnifyingGlass } from "react-icons/hi2";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


interface AutofillButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  context?: "project" | "database" | "title" | "description" | "image";
  buttonText?: string;
  tooltipText?: string;
}



export function AutofillButton({
  onClick,
  isLoading = false,
  disabled = false,
  context = "project",
  buttonText,
  tooltipText,
}: AutofillButtonProps) {
  const defaultText = context === "database" ? "Fill/edit with AI" : "Autofill with AI";
  const displayText = buttonText || defaultText;
  
  // Different tooltip texts based on context
  const getTooltipText = () => {
    if (tooltipText) return tooltipText;
    
    switch (context) {
      case "title":
        return "AI generates catchy, SEO-friendly titles that capture attention and improve search rankings.";
      case "description":
        return "SEO Advisor crafts compelling descriptions with relevant keywords to boost discoverability.";
      case "image":
        return "AI creates eye-catching social share images optimized for maximum engagement across platforms.";
      case "database":
        return "Add data to your database - tell AI what to fill in here, e.g. \"Add top 50 biggest lakes in the world\"";
      default:
        return "SEO Advisor crafts compelling descriptions with relevant keywords to boost discoverability.";
    }
  };

  return (
    <TooltipProvider>
      {/* Hidden SVG for gradient definition */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="sparkle-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3689EA" />
            <stop offset="100%" stopColor="#D749E5" />
          </linearGradient>
        </defs>
      </svg>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={disabled || isLoading}
            className="group relative inline-flex items-center rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
            style={{
              height: '18px',
              gap: '6px',
              padding: '0 4px',
              minWidth: 'fit-content',
            }}
          >
            <span className="relative z-10 flex items-center" style={{ gap: '6px' }}>
              {isLoading ? (
                <Loader2 
                  className="animate-spin" 
                  style={{ 
                    stroke: "url(#sparkle-gradient)",
                    width: '12px',
                    height: '12px',
                  }}
                />
              ) : (
                <RiSparkling2Fill 
                  style={{ 
                    fill: "url(#sparkle-gradient)",
                    width: '12px',
                    height: '12px',
                  }}
                />
              )}
              <span style={{
                background: disabled ? "#9CA3AF" : "linear-gradient(90deg, #3689EA 0%, #D749E5 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontSize: '12px',
                lineHeight: '18px',
                whiteSpace: 'nowrap',
              }}>
                {displayText}
              </span>
            </span>
          </button>
        </TooltipTrigger>
        
        <TooltipContent 
          side="bottom" 
          align="end"
          className="border-none shadow-2xl [&>svg]:!fill-[#1A1A1A]"
          sideOffset={8}
          style={{
            backgroundColor: '#1A1A1A',
            width: '274px',
            borderRadius: '16px',
            padding: '12px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Description text */}
                <p 
                  style={{
                    fontFamily: 'Inter',
                    fontWeight: 400,
                    fontSize: '13px',
                    lineHeight: '20px',
                    letterSpacing: '0.01em',
                    textAlign: 'left',
                    color: '#FFFFFF',
                    margin: 0
                  }}
                >
                  {getTooltipText()}
                </p>
                
                {/* Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Credits Badge */}
                  <div 
                    className="flex items-center"
                    style={{
                      width: '116px',
                      height: '20px',
                      borderRadius: '90px',
                      paddingTop: '2px',
                      paddingRight: '4px',
                      paddingBottom: '2px',
                      paddingLeft: '4px',
                      gap: '4px',
                      backgroundColor: '#1E9A8026'
                    }}
                  >
                    <RiSparkling2Fill className="flex-shrink-0" style={{ color: '#1E9A80', width: '12px', height: '12px' }} />
                    <span className="whitespace-nowrap" style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: '10px', color: '#1E9A80' }}>Uses 0.25 Credits</span>
                  </div>
                  
                  {/* Optimized Badge */}
                  <div 
                    className="flex items-center"
                    style={{
                      width: '131px',
                      height: '20px',
                      borderRadius: '90px',
                      paddingTop: '2px',
                      paddingRight: '4px',
                      paddingBottom: '2px',
                      paddingLeft: '4px',
                      gap: '4px',
                      backgroundColor: '#78350F59'
                    }}
                  >
                    <HiMiniMagnifyingGlass className="flex-shrink-0" style={{ color: '#FCD34D', width: '12px', height: '12px' }} />
                    <span className="whitespace-nowrap" style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: '10px', color: '#FCD34D' }}>Optimized for Search</span>
                  </div>
                </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}