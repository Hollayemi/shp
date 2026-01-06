"use client";

import { useState } from "react";
import { RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
const Sandpack = dynamic(
  () =>
    import("@codesandbox/sandpack-react").then((mod) => ({
      default: mod.Sandpack,
    })),
  { ssr: false },
);

interface ProjectFile {
  path: string;
  content: string;
  language: string;
}

interface GeneratedProject {
  name: string;
  framework: string;
  files: ProjectFile[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  description: string;
}

interface PreviewFrameProps {
  project: GeneratedProject;
}

export default function PreviewFrame({ project }: PreviewFrameProps) {
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  const refreshPreview = () => {
    setError(null);
    setKey((prev) => prev + 1);
  };

  // Check if this is a single HTML file project
  const isSingleHTMLFile =
    project.files.length === 1 &&
    project.files[0].path === "index.html" &&
    project.files[0].language === "html";

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={refreshPreview} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Handle single HTML file with iframe
  if (isSingleHTMLFile) {
    const htmlContent = project.files[0].content;

    return (
      <div className="h-full bg-white relative">
        <div className="absolute top-2 right-2 z-10">
          <Button
            onClick={refreshPreview}
            variant="outline"
            size="sm"
            className="bg-white/90 backdrop-blur-sm"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
        <iframe
          key={key}
          srcDoc={htmlContent}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          allow="clipboard-read; clipboard-write"
          title="App Preview"
        />
      </div>
    );
  }

  // For multi-file projects, use Sandpack (legacy support)
  try {
    const sandpackFiles: Record<string, string> = {};
    project.files.forEach((file) => {
      sandpackFiles[file.path] = file.content;
    });

    const template = project.framework === "vue" ? "vue-ts" : "react-ts";
    const dependencies = { ...project.dependencies };

    if (project.framework === "react") {
      if (!dependencies["react"]) dependencies["react"] = "^18.2.0";
      if (!dependencies["react-dom"]) dependencies["react-dom"] = "^18.2.0";
    }

    return (
      <div className="h-full bg-white">
        <Sandpack
          template={template}
          files={sandpackFiles}
          customSetup={{ dependencies }}
          options={{
            showNavigator: false,
            showTabs: false,
            showLineNumbers: false,
            showInlineErrors: true,
            wrapContent: true,
            autorun: true,
            autoReload: true,
          }}
          theme="light"
        />
      </div>
    );
  } catch (err) {
    console.error("Preview error:", err);
    setError("Failed to load preview");
    return null;
  }
}
