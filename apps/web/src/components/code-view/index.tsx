import Prism from "prismjs";
import { useEffect, useRef } from "react";
import "prismjs/components/prism-markup-templating";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-css";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-python";
import "prismjs/components/prism-java";
import "prismjs/components/prism-c";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-php";
import "prismjs/components/prism-ruby";
import "./code-theme.css";

interface CodeViewProps {
  code: string;
  language: string;
}

// Map file extensions to PrismJS language identifiers
const languageMap: Record<string, string> = {
  'js': 'javascript',
  'jsx': 'jsx',
  'ts': 'typescript',
  'tsx': 'tsx',
  'html': 'markup',
  'css': 'css',
  'scss': 'scss',
  'json': 'json',
  'yaml': 'yaml',
  'yml': 'yaml',
  'toml': 'toml',
  'md': 'markdown',
  'bash': 'bash',
  'sh': 'bash',
  'sql': 'sql',
  'py': 'python',
  'java': 'java',
  'c': 'c',
  'cs': 'csharp',
  'php': 'php',
  'rb': 'ruby',
  'text': 'text',
};

export const CodeView = ({ code, language }: CodeViewProps) => {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!codeRef.current || !code) return;

    // Map the language to PrismJS language identifier
    const prismLanguage = languageMap[language] || language || 'text';
    
    // Set the content as textContent so HTML tags are displayed as text
    codeRef.current.textContent = code;
    
    // Set the correct language class
    codeRef.current.className = `language-${prismLanguage}`;
    
    // Apply syntax highlighting to this specific element
    try {
      Prism.highlightElement(codeRef.current);
    } catch (error) {
      console.warn('PrismJS highlighting failed:', error);
      // Fallback: just display the code without highlighting
      codeRef.current.textContent = code;
    }
  }, [code, language]);

  // Get the mapped language for the class
  const prismLanguage = languageMap[language] || language || 'text';

  return (
    <pre className="p-2 bg-transparent border-none rounded-none m-0 text-xs overflow-auto">
      <code 
        ref={codeRef}
        className={`language-${prismLanguage}`}
      >
        {code}
      </code>
    </pre>
  );
};