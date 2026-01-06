"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

type CodeBlockContextType = {
  code: string;
};

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
});

export type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: string;
  showLineNumbers?: boolean;
  children?: ReactNode;
};

export const CodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  // Ensure code is a clean string
  const cleanCode =
    typeof code === "string" ? code.trim() : String(code || "").trim();

  // Map common language aliases to proper Prism language names
  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    sh: "bash",
    yml: "yaml",
    md: "markdown",
    html: "markup",
  };

  // Normalize language - handle common variations
  const normalizedLanguage =
    languageMap[language?.toLowerCase() || ""] ||
    language?.toLowerCase() ||
    "text";

  return (
    <CodeBlockContext.Provider value={{ code: cleanCode }}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-lg border-0",
          className,
        )}
        {...props}
      >
        <div className="relative">
          {/* Dark style for both light and dark modes */}
          <SyntaxHighlighter
            language={normalizedLanguage}
            style={oneDark}
            customStyle={{
              margin: 0,
              padding: "1.25rem",
              fontSize: "0.875rem",
              background: "#0D1117",
              borderRadius: "0.5rem",
              border: "1px solid #30363d",
            }}
            codeTagProps={{
              className: "font-mono text-sm",
            }}
            lineNumberStyle={{
              color: "#6e7681",
              paddingRight: "1rem",
              minWidth: "2.5rem",
            }}
            showLineNumbers={showLineNumbers}
            PreTag={({ children, ...props }: any) => (
              <pre {...props} className="!m-0 overflow-hidden">
                {children}
              </pre>
            )}
          >
            {cleanCode}
          </SyntaxHighlighter>
          {children && (
            <div className="absolute top-3 right-3 flex items-center gap-2">
              {children}
            </div>
          )}
        </div>
      </div>
    </CodeBlockContext.Provider>
  );
};

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = async () => {
    if (typeof window === "undefined" || !navigator.clipboard.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      onCopy?.();
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn(
        "h-8 w-8 shrink-0 rounded-md border-0 bg-white/10 transition-colors hover:bg-white/20 dark:bg-white/10 dark:hover:bg-white/20",
        isCopied && "bg-green-500/20 hover:bg-green-500/30",
        className,
      )}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={16} className="text-gray-400" />}
    </Button>
  );
};
