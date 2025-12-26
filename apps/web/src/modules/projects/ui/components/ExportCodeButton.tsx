"use client";

import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useFilteredFiles } from "@/hooks/useFilteredFiles";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

interface ExportCodeButtonProps {
  projectId: string;
  sandboxFiles?: Set<string>;
  sandboxReady?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export const ExportCodeButton = ({
  projectId,
  sandboxFiles,
  sandboxReady = false,
  variant = "outline",
  size = "sm",
  className = "h-7 text-xs",
}: ExportCodeButtonProps) => {
  const trpc = useTRPC();
  
  // Filter sandbox files for export (removes node_modules, .git, etc.)
  const filteredFiles = useFilteredFiles(sandboxFiles);

  // Export to ZIP mutation
  const exportMutation = useMutation(
    trpc.projects.exportToZip.mutationOptions({
      onSuccess: (result) => {
        if (result.success) {
          // Show preparing download toast
          toast.loading('Preparing download...', { id: 'export-download' });

          // Convert base64 to blob and trigger download
          const byteCharacters = atob(result.data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/zip' });

          // Create download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = result.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          // Dismiss loading toast and show success
          toast.dismiss('export-download');
          toast.success('Project exported successfully!');
        }
      },
      onError: (error) => {
        console.error('Export error:', error);
        toast.error(error.message || 'Failed to export project');
      },
    })
  );

  const handleExport = () => {
    if (filteredFiles.length === 0) {
      toast.error("No files available to export");
      return;
    }
    
    exportMutation.mutate({ 
      projectId,
      filePaths: filteredFiles
    });
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      className={className}
      disabled={!sandboxReady || exportMutation.isPending}
    >
      {exportMutation.isPending ? (
        <>
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="h-3 w-3 mr-1" />
          Export code
        </>
      )}
    </Button>
  );
};
