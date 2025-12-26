"use client";

import { Button } from "@/components/ui/button";
import {
  Code,
  Zap,
  Eye,
  ExternalLink,
  RefreshCw,
  ArrowUpRight,
  Clock,
  Square,
} from "lucide-react";

interface ProjectHeaderProps {
  projectName?: string;
  projectUrl?: string;
  hasNewDeliverable?: boolean;
}

export function ProjectHeader({
  projectName = "Dashboard",
  projectUrl = "https://5173-ii6jtgor3cmst2nh9pfti.e2b.app",
  hasNewDeliverable = false,
}: ProjectHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      {/* Top Header Bar with Preview/Code Tabs */}
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              {projectName}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-yellow-400 rounded-full"></div>
              <span className="text-sm text-gray-600">
                Shipper-insight-compass
              </span>
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <Square className="w-4 h-4 text-gray-500" />
              <RefreshCw className="w-4 h-4 text-gray-500" />
              <ArrowUpRight className="w-4 h-4 text-gray-500" />
            </div>

            <div className="text-sm text-gray-600">20 /</div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="p-2 h-8 w-8">
                <Code className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="p-2 h-8 w-8">
                <Zap className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="relative">
                <div className="w-4 h-4 bg-purple-600 rounded flex items-center justify-center text-white text-xs font-bold">
                  K
                </div>
                <span className="ml-2">Invite</span>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                  1
                </div>
              </Button>
              <Button variant="outline" size="sm">
                <div className="w-4 h-4 bg-yellow-500 rounded flex items-center justify-center text-white">
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <span className="ml-2">Upgrade</span>
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Publish
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* URL Bar */}
      <div className="px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
            <RefreshCw className="h-3 w-3" />
          </Button>
          <span className="text-sm text-gray-600 font-mono">{projectUrl}</span>
          <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
