"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";
import { CodeBlock } from "@/components/ai-elements/code-block";
import type { Components } from "react-markdown";

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, components, ...props }: ResponseProps) => {
    // Custom components for code blocks - use CodeBlock component
    const customComponents: Components = {
      // Handle pre elements - extract code and use CodeBlock component
      pre: ({ children, ...props }) => {
        // react-markdown structure: pre > code
        const codeElement = (children as any)?.props;
        if (codeElement) {
          const codeClassName = codeElement.className || "";
          const match = /language-(\w+)/.exec(codeClassName);
          let language = match ? match[1] : "text";

          // Map common language aliases
          const languageMap: Record<string, string> = {
            js: "javascript",
            ts: "typescript",
            py: "python",
            sh: "bash",
            yml: "yaml",
            md: "markdown",
          };
          language = languageMap[language] || language;

          // Extract code string - handle both string and array of strings/React elements
          let codeString = "";

          // Helper to recursively extract text from React elements
          const extractText = (node: any): string => {
            if (typeof node === "string") return node;
            if (typeof node === "number") return String(node);
            if (Array.isArray(node)) {
              return node.map(extractText).join("");
            }
            if (node?.props?.children) {
              return extractText(node.props.children);
            }
            return "";
          };

          codeString = extractText(codeElement.children);

          // Clean up the code string - remove trailing newline but preserve structure
          codeString = codeString.replace(/\n$/, "").trim();

          // Auto-detect language from code content if not specified
          if (language === "text" && codeString) {
            const trimmedCode = codeString.trim();

            // Try to detect JSON
            if (trimmedCode.startsWith("{") || trimmedCode.startsWith("[")) {
              try {
                JSON.parse(codeString);
                language = "json";
              } catch {
                // Not valid JSON, continue detection
              }
            }

            // Try to detect JavaScript/TypeScript
            if (language === "text") {
              // Common JS/TS patterns
              const jsPatterns = [
                /^(const|let|var|function|class|import|export)\s+/m,
                /=>\s*{/,
                /\.(map|filter|reduce|forEach)\(/,
                /console\.(log|error|warn)/,
                /Error:/,
                /TypeError:/,
                /SyntaxError:/,
              ];

              const tsPatterns = [
                /:\s*(string|number|boolean|object|any|void|unknown)/,
                /interface\s+\w+/,
                /type\s+\w+\s*=/,
                /<[A-Z]\w*>/,
              ];

              const hasJsPattern = jsPatterns.some((pattern) =>
                pattern.test(trimmedCode),
              );
              const hasTsPattern = tsPatterns.some((pattern) =>
                pattern.test(trimmedCode),
              );

              if (hasTsPattern) {
                language = "typescript";
              } else if (hasJsPattern) {
                language = "javascript";
              }
            }

            // Try to detect shell/bash
            if (
              language === "text" &&
              trimmedCode.match(/^\$|^#!\/bin\/(bash|sh)/)
            ) {
              language = "bash";
            }
          }

          // Debug logging (can be removed later)
          if (process.env.NODE_ENV === "development") {
            console.log("[Response] Code block detected:", {
              language,
              codeLength: codeString.length,
              codePreview: codeString.substring(0, 50),
            });
          }

          // Use CodeBlock component for code blocks
          return <CodeBlock code={codeString} language={language} />;
        }

        // Fallback to default pre styling if structure is unexpected
        return (
          <pre
            className={cn(
              "overflow-x-auto rounded-lg border border-[#30363d] bg-[#0D1117] p-4 font-mono text-sm leading-relaxed text-[#e6edf3]",
            )}
            {...props}
          >
            {children}
          </pre>
        );
      },
      // Handle inline code - use simple styling
      code: (props: any) => {
        const { className: codeClassName, children } = props;
        const inline = (props as any).inline;

        // Inline code - use simple styling
        if (inline) {
          return (
            <code
              className={cn(
                "rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-gray-900 dark:border dark:border-[#30363d] dark:bg-[#0D1117] dark:text-[#e6edf3]",
                codeClassName,
              )}
              {...props}
            >
              {children}
            </code>
          );
        }

        // Block code is handled by pre component, but provide fallback
        const match = /language-(\w+)/.exec(codeClassName || "");
        const language = match ? match[1] : "text";
        const codeString = String(children).replace(/\n$/, "");

        return <CodeBlock code={codeString} language={language} />;
      },
      // Merge with any provided components
      ...components,
    };

    return (
      <Streamdown
        className={cn(
          // Base styling for clean message appearance
          "w-full text-sm leading-relaxed",

          // Remove default margins and add consistent spacing
          "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          "[&>*]:mb-1.5 [&>*:last-child]:mb-0",

          // Typography improvements for readability
          "[&>p]:leading-relaxed [&>p]:text-current",
          "[&>h1]:first-child]:mt-0 [&>h1]:mt-2.5 [&>h1]:mb-1.5 [&>h1]:text-lg [&>h1]:font-semibold",
          "[&>h2]:first-child]:mt-0 [&>h2]:mt-1.5 [&>h2]:mb-1 [&>h2]:text-base [&>h2]:font-semibold",
          "[&>h3]:first-child]:mt-0 [&>h3]:mt-1.5 [&>h3]:mb-1 [&>h3]:text-sm [&>h3]:font-medium",

          // List styling for better hierarchy
          "[&>ul]:list-inside [&>ul]:list-disc [&>ul]:space-y-0.5",
          "[&>ol]:list-inside [&>ol]:list-decimal [&>ol]:space-y-0.5",
          "[&>ol>li]:text-current [&>ul>li]:text-current",

          // Inline code styling (block code is handled by CodeBlock component)
          "[&>p>code]:rounded [&>p>code]:bg-gray-100 [&>p>code]:px-1.5 [&>p>code]:py-0.5 [&>p>code]:font-mono [&>p>code]:text-sm [&>p>code]:text-gray-900 [&>p>code]:dark:border [&>p>code]:dark:border-[#30363d] [&>p>code]:dark:bg-[#0D1117] [&>p>code]:dark:text-[#e6edf3]",

          // Blockquote styling
          "[&>blockquote]:border-muted [&>blockquote]:text-muted-foreground [&>blockquote]:border-l-4 [&>blockquote]:pl-4 [&>blockquote]:italic",

          // Table styling
          "[&>table]:w-full [&>table]:border-collapse [&>table]:text-sm",
          "[&>table>thead>tr>th]:border-muted [&>table>thead>tr>th]:border-b [&>table>thead>tr>th]:p-1.5 [&>table>thead>tr>th]:text-left",
          "[&>table>tbody>tr>td]:border-muted/50 [&>table>tbody>tr>td]:border-b [&>table>tbody>tr>td]:p-1.5",

          // Link styling
          "[&>p>a]:text-primary [&>p>a]:hover:text-primary/80 [&>p>a]:underline [&>p>a]:underline-offset-2",
          "[&>a]:text-primary [&>a]:hover:text-primary/80 [&>a]:underline [&>a]:underline-offset-2",

          className,
        )}
        components={customComponents}
        {...props}
      />
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

Response.displayName = "Response";
