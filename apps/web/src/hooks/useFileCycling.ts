import { useState, useEffect, useRef, useCallback } from "react";

export type FileEvent = {
  projectId: string;
  filePath: string;
  content: string;
  timestamp: number;
  action: "created" | "updated";
};

export type QueuedFile = {
  fileEvent: FileEvent;
  renderPromise: Promise<string | null>;
  isRendering: boolean;
  hasRendered: boolean;
  renderedHtml: string | null;
};

export type CyclingState = {
  queuedFiles: QueuedFile[];
  displayedFile: FileEvent | null;
  displayedHtml: string | null;
  currentDisplayIndex: number;
};

export const useFileCycling = (projectId: string) => {
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [displayedFile, setDisplayedFile] = useState<FileEvent | null>(null);
  const [displayedHtml, setDisplayedHtml] = useState<string | null>(null);
  const [currentDisplayIndex, setCurrentDisplayIndex] = useState(0);

  const cyclingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add a file to the queue
  const addFileToQueue = useCallback(
    (fileEvent: FileEvent, renderPromise: Promise<string | null>) => {
      // Ensure the fileEvent has the correct projectId
      const fileEventWithProjectId = { ...fileEvent, projectId };

      setQueuedFiles((prev) => {
        // Check if this file is already in the queue
        const existingIndex = prev.findIndex(
          (qf) => qf.fileEvent.filePath === fileEventWithProjectId.filePath,
        );

        if (existingIndex !== -1) {
          console.log(
            "[useFileCycling] File already in queue, updating:",
            fileEvent.filePath,
            "at index:",
            existingIndex,
          );
          // Update existing file
          const updatedQueue = [...prev];
          updatedQueue[existingIndex] = {
            ...updatedQueue[existingIndex],
            renderPromise,
            isRendering: true,
            hasRendered: false,
            renderedHtml: null,
          };
          return updatedQueue;
        }

        // Add new file to queue
        const queuedFile: QueuedFile = {
          fileEvent: fileEventWithProjectId,
          renderPromise,
          isRendering: true,
          hasRendered: false,
          renderedHtml: null,
        };

        console.log(
          "[useFileCycling] Adding new file to queue:",
          fileEvent.filePath,
          "Queue size will be:",
          prev.length + 1,
        );

        const newQueue = [...prev, queuedFile];
        console.log(
          "[useFileCycling] Queue updated, new size:",
          newQueue.length,
        );
        return newQueue;
      });

      // Handle render completion
      renderPromise
        .then((html) => {
          console.log(
            "[useFileCycling] Render completed for:",
            fileEvent.filePath,
            "HTML length:",
            html?.length || 0,
          );
          setQueuedFiles((prev) =>
            prev.map((qf) =>
              qf.fileEvent.filePath === fileEventWithProjectId.filePath
                ? {
                    ...qf,
                    isRendering: false,
                    hasRendered: true,
                    renderedHtml: html,
                  }
                : qf,
            ),
          );
        })
        .catch((error) => {
          console.error("Render failed for", fileEvent.filePath, error);
          setQueuedFiles((prev) =>
            prev.map((qf) =>
              qf.fileEvent.filePath === fileEventWithProjectId.filePath
                ? {
                    ...qf,
                    isRendering: false,
                    hasRendered: false,
                    renderedHtml: null,
                  }
                : qf,
            ),
          );
        });
    },
    [projectId],
  );

  // Effect to display the first rendered file when none is displayed
  useEffect(() => {
    const renderedFiles = queuedFiles.filter(
      (qf) => qf.hasRendered && qf.renderedHtml,
    );

    if (renderedFiles.length === 0 || displayedFile) {
      return;
    }

    // Show the first rendered file
    const firstFile = renderedFiles[0];
    console.log(
      "[useFileCycling] Displaying first rendered file:",
      firstFile.fileEvent.filePath,
    );
    setDisplayedFile(firstFile.fileEvent);
    setDisplayedHtml(firstFile.renderedHtml);
    setCurrentDisplayIndex(0);
  }, [queuedFiles, displayedFile]);

  // Manual navigation functions
  const goToNext = useCallback(() => {
    const renderedFiles = queuedFiles.filter(
      (qf) => qf.hasRendered && qf.renderedHtml,
    );

    if (renderedFiles.length <= 1) return;

    const currentIndex = renderedFiles.findIndex(
      (rf) => rf.fileEvent.filePath === displayedFile?.filePath,
    );

    if (currentIndex === -1) return;

    const nextIndex = (currentIndex + 1) % renderedFiles.length;
    const nextFile = renderedFiles[nextIndex];

    console.log(
      "[useFileCycling] Manual navigation to next file:",
      nextFile.fileEvent.filePath,
    );

    setDisplayedFile(nextFile.fileEvent);
    setDisplayedHtml(nextFile.renderedHtml);
    setCurrentDisplayIndex(nextIndex);
  }, [queuedFiles, displayedFile]);

  const goToPrevious = useCallback(() => {
    const renderedFiles = queuedFiles.filter(
      (qf) => qf.hasRendered && qf.renderedHtml,
    );

    if (renderedFiles.length <= 1) return;

    const currentIndex = renderedFiles.findIndex(
      (rf) => rf.fileEvent.filePath === displayedFile?.filePath,
    );

    if (currentIndex === -1) return;

    const previousIndex =
      currentIndex === 0 ? renderedFiles.length - 1 : currentIndex - 1;
    const previousFile = renderedFiles[previousIndex];

    console.log(
      "[useFileCycling] Manual navigation to previous file:",
      previousFile.fileEvent.filePath,
    );

    setDisplayedFile(previousFile.fileEvent);
    setDisplayedHtml(previousFile.renderedHtml);
    setCurrentDisplayIndex(previousIndex);
  }, [queuedFiles, displayedFile]);

  const goToIndex = useCallback(
    (index: number) => {
      const renderedFiles = queuedFiles.filter(
        (qf) => qf.hasRendered && qf.renderedHtml,
      );

      if (index < 0 || index >= renderedFiles.length) return;

      const targetFile = renderedFiles[index];

      console.log(
        "[useFileCycling] Manual navigation to index:",
        index,
        targetFile.fileEvent.filePath,
      );

      setDisplayedFile(targetFile.fileEvent);
      setDisplayedHtml(targetFile.renderedHtml);
      setCurrentDisplayIndex(index);
    },
    [queuedFiles],
  );

  // Effect to handle auto-cycling
  useEffect(() => {
    const renderedFiles = queuedFiles.filter(
      (qf) => qf.hasRendered && qf.renderedHtml,
    );

    console.log("[useFileCycling] Cycling effect triggered:", {
      renderedFilesCount: renderedFiles.length,
      displayedFile: displayedFile?.filePath,
      queuedFilesCount: queuedFiles.length,
    });

    if (renderedFiles.length <= 1 || !displayedFile) {
      console.log(
        "[useFileCycling] Not cycling - insufficient files or no displayed file",
      );
      return;
    }

    // Find current file index in rendered files
    const currentIndex = renderedFiles.findIndex(
      (rf) => rf.fileEvent.filePath === displayedFile.filePath,
    );

    if (currentIndex === -1) {
      console.log("[useFileCycling] Current file not found in rendered files");
      return;
    }

    // Clear any existing cycling timeout
    if (cyclingTimeoutRef.current) {
      console.log("[useFileCycling] Clearing existing cycling timeout");
      clearTimeout(cyclingTimeoutRef.current);
    }

    console.log(
      "[useFileCycling] Setting up cycling timer for 3 seconds. Current file:",
      displayedFile.filePath,
      `(${currentIndex + 1}/${renderedFiles.length})`,
    );

    // Set up cycling to next file after 3 seconds
    cyclingTimeoutRef.current = setTimeout(() => {
      // Re-check rendered files in case they changed during the timeout
      const currentRenderedFiles = queuedFiles.filter(
        (qf) => qf.hasRendered && qf.renderedHtml,
      );

      if (currentRenderedFiles.length <= 1) {
        console.log("[useFileCycling] Not enough files to cycle after timeout");
        return;
      }

      const currentDisplayedIndex = currentRenderedFiles.findIndex(
        (rf) => rf.fileEvent.filePath === displayedFile?.filePath,
      );

      if (currentDisplayedIndex === -1) {
        console.log(
          "[useFileCycling] Current file no longer in rendered files after timeout",
        );
        return;
      }

      const nextIndex =
        (currentDisplayedIndex + 1) % currentRenderedFiles.length;
      const nextFile = currentRenderedFiles[nextIndex];

      console.log(
        "[useFileCycling] Cycling to next file:",
        nextFile.fileEvent.filePath,
        `(${nextIndex + 1}/${currentRenderedFiles.length})`,
      );

      setDisplayedFile(nextFile.fileEvent);
      setDisplayedHtml(nextFile.renderedHtml);
      setCurrentDisplayIndex(nextIndex);
    }, 3000);

    return () => {
      if (cyclingTimeoutRef.current) {
        console.log("[useFileCycling] Cleaning up cycling timeout");
        clearTimeout(cyclingTimeoutRef.current);
      }
    };
  }, [displayedFile, queuedFiles]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cyclingTimeoutRef.current) {
        clearTimeout(cyclingTimeoutRef.current);
      }
    };
  }, []);

  // Reset function to clear all cycling state
  const resetCycling = useCallback(() => {
    console.log("[useFileCycling] Resetting cycling state");
    setQueuedFiles([]);
    setDisplayedFile(null);
    setDisplayedHtml(null);
    setCurrentDisplayIndex(0);

    // Clear any pending cycling timeout
    if (cyclingTimeoutRef.current) {
      clearTimeout(cyclingTimeoutRef.current);
      cyclingTimeoutRef.current = null;
    }
  }, []);

  return {
    queuedFiles,
    displayedFile,
    displayedHtml,
    currentDisplayIndex,
    addFileToQueue,
    resetCycling,
    goToNext,
    goToPrevious,
    goToIndex,
  };
};
