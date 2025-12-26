"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

interface ConvexTableViewerProps {
  projectId: string;
  tableName: string;
  documentCount: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ConvexTableViewer({
  projectId,
  tableName,
  documentCount,
  isExpanded,
  onToggle,
}: ConvexTableViewerProps) {
  const trpc = useTRPC();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Fetch table data only when expanded
  const { data: tableData, isLoading } = useQuery({
    ...trpc.projects.getConvexTableData.queryOptions({
      projectId,
      tableName,
      limit: pageSize,
    }),
    enabled: isExpanded,
  });

  const documents = tableData?.documents ?? [];

  // Get all unique column names from documents
  const columns = documents.length > 0
    ? Array.from(
        new Set(
          documents.flatMap((doc) =>
            Object.keys(doc).filter((key) => !key.startsWith("_"))
          )
        )
      )
    : [];

  // Always show _id and _creationTime first
  const orderedColumns = ["_id", "_creationTime", ...columns];

  // Format value for display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") {
      // Check if it's a timestamp (creation time is in milliseconds)
      if (value > 1e12 && value < 1e14) {
        return new Date(value).toLocaleString();
      }
      return value.toLocaleString();
    }
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-2xl bg-[#F3F3EE] p-2 dark:bg-[#1A2421]">
        {/* Table Header */}
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between gap-4 p-2">
            <div className="flex flex-1 flex-col gap-0.5 text-left">
              <h3 className="font-medium leading-6 text-[#141414] dark:text-[#F5F9F7]">
                {tableName}
              </h3>
              <p className="text-sm leading-5 text-[#727272] dark:text-[#8A9A94]">
                {documentCount} Documents
              </p>
            </div>
            <Button
              variant="ghost"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-[#E6E6DB] dark:bg-[#0F1613]"
            >
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-[#28303F] dark:text-[#B8C9C3]" />
              ) : (
                <ChevronDown className="h-5 w-5 text-[#28303F] dark:text-[#B8C9C3]" />
              )}
            </Button>
          </button>
        </CollapsibleTrigger>

        {/* Table Content */}
        <CollapsibleContent>
          {isLoading ? (
            <div className="overflow-x-auto rounded-2xl border border-[#E5E5E5] bg-white p-2 dark:border-[#26263D] dark:bg-[#0F1613]">
              <Table>
                <TableHeader>
                  <TableRow className="!border-b-0 bg-[#F9FAFA] hover:bg-[#F9FAFB] dark:bg-[#1A2421] dark:hover:bg-[#1A2421]">
                    <TableHead className="min-w-[120px] whitespace-nowrap border-b-0 px-4 py-3 text-sm font-medium text-[#727272] first:rounded-l-lg last:rounded-r-lg dark:text-[#8A9A94]">
                      <Skeleton className="h-4 w-20 bg-gray-200 dark:bg-gray-700" />
                    </TableHead>
                    <TableHead className="min-w-[120px] whitespace-nowrap border-b-0 px-4 py-3 text-sm font-medium text-[#727272] first:rounded-l-lg last:rounded-r-lg dark:text-[#8A9A94]">
                      <Skeleton className="h-4 w-24 bg-gray-200 dark:bg-gray-700" />
                    </TableHead>
                    <TableHead className="min-w-[120px] whitespace-nowrap border-b-0 px-4 py-3 text-sm font-medium text-[#727272] first:rounded-l-lg last:rounded-r-lg dark:text-[#8A9A94]">
                      <Skeleton className="h-4 w-16 bg-gray-200 dark:bg-gray-700" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, idx) => (
                    <TableRow
                      key={idx}
                      className="border-b border-dashed border-[#DBDBDB] first:border-t-0 last:border-b-0 dark:border-[#26263D]"
                    >
                      <TableCell className="h-10 whitespace-nowrap px-4 py-3 text-sm text-[#171717] dark:text-[#F5F9F7]">
                        <Skeleton className="h-4 w-16 bg-gray-200 dark:bg-gray-700" />
                      </TableCell>
                      <TableCell className="h-10 whitespace-nowrap px-4 py-3 text-sm text-[#171717] dark:text-[#F5F9F7]">
                        <Skeleton className="h-4 w-20 bg-gray-200 dark:bg-gray-700" />
                      </TableCell>
                      <TableCell className="h-10 whitespace-nowrap px-4 py-3 text-sm text-[#171717] dark:text-[#F5F9F7]">
                        <Skeleton className="h-4 w-12 bg-gray-200 dark:bg-gray-700" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : documents.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-[#E5E5E5] bg-white p-2 dark:border-[#26263D] dark:bg-[#0F1613]">
              <Table>
                <TableHeader>
                  <TableRow className="!border-b-0 bg-[#F9FAFA] hover:bg-[#F9FAFB] dark:bg-[#1A2421] dark:hover:bg-[#1A2421]">
                    {orderedColumns.map((column) => (
                      <TableHead
                        key={column}
                        className="min-w-[120px] whitespace-nowrap border-b-0 px-4 py-3 text-sm font-medium text-[#727272] first:rounded-l-lg last:rounded-r-lg dark:text-[#8A9A94]"
                      >
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc, idx) => (
                    <TableRow
                      key={doc._id ?? idx}
                      className="border-b border-dashed border-[#DBDBDB] first:border-t-0 last:border-b-0 dark:border-[#26263D]"
                    >
                      {orderedColumns.map((column) => (
                        <TableCell
                          key={column}
                          className="h-10 max-w-[200px] truncate whitespace-nowrap px-4 py-3 text-sm text-[#171717] dark:text-[#F5F9F7]"
                        >
                          <span
                            className={
                              doc[column] === null || doc[column] === undefined
                                ? "text-[#8A9A94]"
                                : ""
                            }
                            title={formatValue(doc[column])}
                          >
                            {formatValue(doc[column])}
                          </span>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-[#727272] dark:text-[#8A9A94]">
                No documents in this table
              </p>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
