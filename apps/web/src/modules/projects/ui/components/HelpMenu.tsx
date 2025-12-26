"use client";

import { CircleHelp, ExternalLink, Megaphone } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WebPreviewNavigationButton } from "@/components/ai-elements/web-preview";
import { useFrillWidget } from "@/hooks/use-frill-widget";

export function HelpMenu() {
  const widgetRef = useFrillWidget(
    "widget",
    process.env.NEXT_PUBLIC_FRILL_WIDGET_KEY || ""
  );

  const handleOpenFrill = () => {
    try {
      if (widgetRef.current) {
        widgetRef.current.viewSection("announcements");
        widgetRef.current.open();
      }
    } catch (error) {
      console.error('Failed to open Frill widget:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <WebPreviewNavigationButton tooltip="Help & Support">
          <CircleHelp className="h-[13px] w-[13px]" />
        </WebPreviewNavigationButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="bg-[#FCFCF9] dark:bg-[#1A2421] py-1 [box-shadow:0_1px_13.8px_1px_#1212121A] rounded-[16px]"
      >
        <DropdownMenuItem
          asChild
          className="px-3 py-[6px] h-[48px] rounded-[16px] transition-colors duration-200 cursor-pointer hover:bg-prj-tooltip-hover-bg hover:border hover:border-prj-tooltip-hover-border"
        >
          <a
            href="https://shipper-now.notion.site/Help-Center-Shipper-now-2690e9202497802e93bbf1f77a2c84de?pvs=25"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <div className="flex items-center justify-center w-8 h-8 bg-[#F3F3EE] dark:bg-prj-bg-secondary rounded-[6px] dark:text-[#B8C9C3]">
              <ExternalLink className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-[#09090B] dark:text-[#F5F9F7]">Help Center</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleOpenFrill}
          className="px-3 py-[6px] h-[48px] rounded-[16px] transition-colors duration-200 cursor-pointer hover:bg-prj-tooltip-hover-bg hover:border hover:border-prj-tooltip-hover-border"
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-[#F3F3EE] dark:bg-prj-bg-secondary rounded-[6px] dark:text-[#B8C9C3]">
              <Megaphone className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-[#09090B] dark:text-[#F5F9F7]">Updates & Roadmap</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
