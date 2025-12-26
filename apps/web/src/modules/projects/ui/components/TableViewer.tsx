"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AutofillButton } from "./deploy/AutofillButton";
import { AutofillDatabaseModal } from "./AutofillDatabaseModal";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
    PaginationEllipsis,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface TableViewerProps {
    projectId: string;
    tableName: string;
    rowCount: number;
    isExpanded: boolean;
    onToggle: () => void;
}

// Helper function to format cell values
function formatCellValue(value: any, columnName: string): string {
    if (value === null || value === undefined) return '';
    
    // Check if it's an ISO timestamp
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (typeof value === 'string' && isoRegex.test(value)) {
        try {
            const date = new Date(value);
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            // If date parsing fails, continue to other checks
        }
    }
    
    // Check if it's JSON (for columns like 'data', 'metadata', 'config', etc.)
    // Keep it compact for table display
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
            const parsed = JSON.parse(value);
            // Return compact JSON (no extra formatting for table display)
            return JSON.stringify(parsed);
        } catch {
            // Not valid JSON, return as-is
        }
    }
    
    return String(value);
}

export function TableViewer({ projectId, tableName, rowCount, isExpanded, onToggle }: TableViewerProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(20);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Calculate pagination values
    const offset = (currentPage - 1) * pageSize;
    const totalPages = Math.ceil(rowCount / pageSize);

    // Fetch table data only when expanded
    const { data: tableData, isLoading } = useQuery({
        ...trpc.projects.getTursoTableData.queryOptions({
            projectId,
            tableName,
            limit: pageSize,
            offset: offset,
        }),
        enabled: isExpanded,
    });

    // Transform rows to records
    const records = tableData?.rows?.map((row) => {
        const record: Record<string, any> = {};
        tableData.columns.forEach((col, idx) => {
            record[col] = row[idx];
        });
        return record;
    }) || [];

    // Handle page change
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    // Generate page numbers for pagination
    const generatePageNumbers = () => {
        const pages: (number | 'ellipsis')[] = [];
        const maxVisiblePages = 5;

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            pages.push(1);

            const startPage = Math.max(2, currentPage - 1);
            const endPage = Math.min(totalPages - 1, currentPage + 1);

            if (startPage > 2) {
                pages.push('ellipsis');
            }

            for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
            }

            if (endPage < totalPages - 1) {
                pages.push('ellipsis');
            }

            pages.push(totalPages);
        }

        return pages;
    };

    const handleGenerate = async (recordCount: number, dataDescription: string) => {
        // Client-side validation: hard limit of 500 records
        if (recordCount > 500) {
            toast.error('Maximum 500 records allowed per generation');
            return;
        }

        setIsGenerating(true);
        const toastId = toast.loading(`Generating ${recordCount} records...`);

        try {
            // Step 1: Generate records with AI
            const generateResponse = await fetch('/api/ai/generate-database-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tableName,
                    recordCount,
                    dataDescription,
                    projectId
                })
            });

            const generateData = await generateResponse.json();

            if (!generateData.success) {
                throw new Error(generateData.error || 'Failed to generate records');
            }

            const { records, creditsUsed, complexity } = generateData.data;
            console.log(`Generated ${records.length} records (${creditsUsed} credits used, ${complexity} complexity)`);

            // Step 2: Insert records into actual database
            const insertResponse = await fetch('/api/database/insert-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    tableName,
                    records
                })
            });

            const insertData = await insertResponse.json();

            if (!insertData.success) {
                throw new Error(insertData.error || 'Failed to insert records');
            }

            const { insertedCount, totalRecords } = insertData.data;
            
            // Refresh table data first
            await queryClient.invalidateQueries({
                queryKey: trpc.projects.getTursoTableData.queryKey({ projectId, tableName, limit: pageSize, offset })
            });
            await queryClient.invalidateQueries({
                queryKey: trpc.projects.getTursoDatabaseTablesList.queryKey({ projectId })
            });

            // Then show success notification
            toast.success(`Successfully generated and saved ${insertedCount} of ${totalRecords} records!`, { id: toastId });

        } catch (error) {
            console.error('Failed to generate records:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to generate records', { id: toastId });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <>
            <AutofillDatabaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                tableName={tableName}
                onGenerate={handleGenerate}
            />

            <Collapsible open={isExpanded} onOpenChange={onToggle}>
                <div className="p-2 bg-[#F3F3EE] dark:bg-[#1A2421] rounded-2xl">
                    {/* Table Header */}
                    <div className="flex items-center justify-between p-2 gap-4">
                        <CollapsibleTrigger asChild>
                            <button className="flex-1 flex items-center gap-2">
                                <div className="flex-1 text-left flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-medium text-[#141414] dark:text-[#F5F9F7] leading-6">
                                            {tableName}
                                        </h3>
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <AutofillButton
                                                onClick={() => {
                                                    setIsModalOpen(true);
                                                }}
                                                isLoading={isGenerating}
                                                context="database"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-sm text-[#727272] dark:text-[#8A9A94] leading-5">
                                        {rowCount} Records | Updated 2hrs ago
                                    </p>
                                </div>
                            </button>
                        </CollapsibleTrigger>

                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-7 h-7 bg-[#E6E6DB] dark:bg-[#0F1613] rounded-md flex items-center justify-center">
                                {isExpanded ? (
                                    <ChevronUp className="h-5 w-5 text-[#28303F] dark:text-[#B8C9C3]" />
                                ) : (
                                    <ChevronDown className="h-5 w-5 text-[#28303F] dark:text-[#B8C9C3]" />
                                )}
                            </Button>
                        </CollapsibleTrigger>
                    </div>

                    {/* Table Content */}
                    <CollapsibleContent>
                        {isLoading ? (
                            <div className="p-2 bg-white dark:bg-[#0F1613] rounded-2xl border border-[#E5E5E5] dark:border-[#26263D] overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-[#F9FAFA] dark:bg-[#1A2421] hover:bg-[#F9FAFB] dark:hover:bg-[#1A2421] !border-b-0">
                                            <TableHead className="text-sm font-medium text-[#727272] dark:text-[#8A9A94] first:rounded-l-lg last:rounded-r-lg px-4 py-3 border-b-0 whitespace-nowrap min-w-[120px]">
                                                <Skeleton className="h-4 w-20 bg-gray-200 dark:bg-gray-700" />
                                            </TableHead>
                                            <TableHead className="text-sm font-medium text-[#727272] dark:text-[#8A9A94] first:rounded-l-lg last:rounded-r-lg px-4 py-3 border-b-0 whitespace-nowrap min-w-[120px]">
                                                <Skeleton className="h-4 w-24 bg-gray-200 dark:bg-gray-700" />
                                            </TableHead>
                                            <TableHead className="text-sm font-medium text-[#727272] dark:text-[#8A9A94] first:rounded-l-lg last:rounded-r-lg px-4 py-3 border-b-0 whitespace-nowrap min-w-[120px]">
                                                <Skeleton className="h-4 w-16 bg-gray-200 dark:bg-gray-700" />
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[...Array(5)].map((_, idx) => (
                                            <TableRow key={idx} className="border-b border-dashed border-[#DBDBDB] dark:border-[#26263D] last:border-b-0 first:border-t-0">
                                                <TableCell className="text-sm text-[#171717] dark:text-[#F5F9F7] h-10 px-4 py-3 whitespace-nowrap">
                                                    <Skeleton className="h-4 w-16 bg-gray-200 dark:bg-gray-700" />
                                                </TableCell>
                                                <TableCell className="text-sm text-[#171717] dark:text-[#F5F9F7] h-10 px-4 py-3 whitespace-nowrap">
                                                    <Skeleton className="h-4 w-20 bg-gray-200 dark:bg-gray-700" />
                                                </TableCell>
                                                <TableCell className="text-sm text-[#171717] dark:text-[#F5F9F7] h-10 px-4 py-3 whitespace-nowrap">
                                                    <Skeleton className="h-4 w-12 bg-gray-200 dark:bg-gray-700" />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : records.length > 0 ? (
                            <>
                                <div className="p-2 bg-white dark:bg-[#0F1613] rounded-2xl border border-[#E5E5E5] dark:border-[#26263D] overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-[#F9FAFA] dark:bg-[#1A2421] hover:bg-[#F9FAFB] dark:hover:bg-[#1A2421] !border-b-0">
                                                {tableData?.columns.map((column) => (
                                                    <TableHead
                                                        key={column}
                                                        className="text-sm font-medium text-[#727272] dark:text-[#8A9A94] first:rounded-l-lg last:rounded-r-lg px-4 py-3 border-b-0 whitespace-nowrap min-w-[120px]"
                                                    >
                                                        {column}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {records.map((record, idx) => (
                                                <TableRow key={idx} className="border-b border-dashed border-[#DBDBDB] dark:border-[#26263D] last:border-b-0 first:border-t-0">
                                                    {tableData?.columns.map((column) => (
                                                        <TableCell
                                                            key={column}
                                                            className="text-sm text-[#171717] dark:text-[#F5F9F7] h-10 px-4 py-3 whitespace-nowrap"
                                                        >
                                                            {column === "Status" ? (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="h-7 px-2.5 py-2 bg-[#EBF9FA] rounded-md border-[#8BD0D5] dark:border-[#1E9A80] text-[#155E75] dark:text-[#1E9A80] text-xs font-medium hover:bg-[#ECFDF5] dark:hover:bg-[#1A2421]"
                                                                >
                                                                    {record[column]}
                                                                </Badge>
                                                            ) : column === "Actions" ? (
                                                                <button className="text-[#171717] dark:text-[#F5F9F7] hover:text-[#1E9A80] dark:hover:text-[#1E9A80] text-sm font-normal">
                                                                    {record[column]}
                                                                </button>
                                                            ) : (
                                                                <span className="line-clamp-1">
                                                                    {record[column] !== null && record[column] !== undefined
                                                                        ? formatCellValue(record[column], column)
                                                                        : <span className="text-[#8A9A94]">null</span>
                                                                    }
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Pagination */}
                                {rowCount > pageSize && (
                                    <div className="mt-2 px-2">
                                        <Pagination>
                                            <PaginationContent>
                                                <PaginationItem>
                                                    <PaginationPrevious
                                                        onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                                                        className={cn(
                                                            currentPage === 1 && "pointer-events-none opacity-50",
                                                            "cursor-pointer hover:bg-black/[0.08] dark:hover:bg-white/[0.08] hover:text-[#141414] dark:hover:text-[#F5F9F7]"
                                                        )}
                                                    />
                                                </PaginationItem>

                                                {generatePageNumbers().map((page, idx) => (
                                                    page === 'ellipsis' ? (
                                                        <PaginationItem key={`ellipsis-${idx}`}>
                                                            <PaginationEllipsis />
                                                        </PaginationItem>
                                                    ) : (
                                                        <PaginationItem key={page}>
                                                            <PaginationLink
                                                                onClick={() => handlePageChange(page)}
                                                                isActive={currentPage === page}
                                                                className={cn(
                                                                    "cursor-pointer hover:bg-black/[0.08] dark:hover:bg-white/[0.08] hover:text-[#141414] dark:hover:text-[#F5F9F7]",
                                                                    currentPage === page && "hover:bg-transparent dark:hover:bg-transparent"
                                                                )}
                                                            >
                                                                {page}
                                                            </PaginationLink>
                                                        </PaginationItem>
                                                    )
                                                ))}

                                                <PaginationItem>
                                                    <PaginationNext
                                                        onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                                                        className={cn(
                                                            currentPage >= totalPages && "pointer-events-none opacity-50",
                                                            "cursor-pointer hover:bg-black/[0.08] dark:hover:bg-white/[0.08] hover:text-[#141414] dark:hover:text-[#F5F9F7]"
                                                        )}
                                                    />
                                                </PaginationItem>
                                            </PaginationContent>
                                        </Pagination>

                                        {/* Page info */}
                                        <div className="text-center mt-2">
                                            <p className="text-xs text-[#727272] dark:text-[#8A9A94]">
                                                Showing {offset + 1}-{Math.min(offset + pageSize, rowCount)} of {rowCount} records
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-sm text-[#727272] dark:text-[#8A9A94]">
                                    No data available
                                </p>
                            </div>
                        )}
                    </CollapsibleContent>
                </div>
            </Collapsible>
        </>
    );
}
