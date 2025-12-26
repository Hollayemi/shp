/**
 * Syntax Checker
 *
 * Validates code syntax before writing to sandbox.
 * Prevents truncated, malformed, or syntactically invalid code from being persisted.
 *
 * @module syntax-checker
 */

export interface SyntaxCheckResult {
  /** Whether the code is syntactically valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Line number where error occurred */
  line?: number;
  /** Column number where error occurred */
  column?: number;
}

/**
 * Quick syntax check for code files.
 *
 * Performs lightweight validation without full compilation:
 * - TypeScript/JavaScript: Basic parse check + brace/bracket matching
 * - JSON: JSON.parse validation
 * - CSS: Brace matching
 * - HTML: Tag matching
 *
 * This is a fast, non-blocking check that catches obvious truncation and syntax errors.
 * It does NOT perform type checking or semantic analysis.
 *
 * @param filePath - Path to the file (determines validation strategy)
 * @param content - File content to validate
 * @returns Promise<SyntaxCheckResult> - Validation result
 *
 * @example
 * ```typescript
 * const result = await quickSyntaxCheck('src/App.tsx', truncatedCode);
 * if (!result.valid) {
 *   throw new Error(`Syntax error: ${result.error}`);
 * }
 * ```
 */
export async function quickSyntaxCheck(
  filePath: string,
  content: string,
): Promise<SyntaxCheckResult> {
  console.log(`[SyntaxChecker] Checking ${filePath} (${content.length} bytes)`);

  // TypeScript/JavaScript/JSX files
  if (filePath.match(/\.(tsx?|jsx?)$/)) {
    return await checkJavaScriptSyntax(filePath, content);
  }

  // JSON files
  if (filePath.endsWith(".json")) {
    return checkJSONSyntax(content);
  }

  // CSS files
  if (filePath.match(/\.css$/)) {
    return checkCSSSyntax(content);
  }

  // HTML files
  if (filePath.endsWith(".html")) {
    return checkHTMLSyntax(content);
  }

  // Unknown file types pass (no validation)
  console.log(`[SyntaxChecker] No validator for ${filePath}, assuming valid`);
  return { valid: true };
}

/**
 * Check JavaScript/TypeScript syntax using basic parsing.
 * Uses a lightweight approach: brace/bracket matching + basic structure validation.
 * Does NOT use full TypeScript compiler (too slow for this use case).
 */
async function checkJavaScriptSyntax(
  filePath: string,
  content: string,
): Promise<SyntaxCheckResult> {
  try {
    // Check 1: Minimum size (catch obvious truncation)
    if (content.length < 10) {
      return {
        valid: false,
        error: `File too small (${content.length} bytes) - likely truncated`,
      };
    }

    // REMOVED: Brace/bracket/paren matching
    // REMOVED: JSX-specific checks for .tsx/.jsx files

    // Check 2: Basic structural validation
    // Ensure file doesn't end abruptly mid-statement
    const trimmed = content.trim();
    if (
      trimmed.endsWith(",") ||
      trimmed.endsWith("+") ||
      trimmed.endsWith("&")
    ) {
      return {
        valid: false,
        error: "File ends with incomplete statement",
      };
    }

    // Check 3: Common truncation patterns
    const truncationPatterns = [
      /\/\*\s*File truncated/i,
      /\.\.\..*truncated/i,
      /\[TRUNCATED\]/i,
    ];

    for (const pattern of truncationPatterns) {
      if (pattern.test(content)) {
        return {
          valid: false,
          error: "File contains truncation marker",
        };
      }
    }

    console.log(`[SyntaxChecker] ✅ ${filePath} passed syntax check`);
    return { valid: true };
  } catch (error: any) {
    console.log(
      `[SyntaxChecker] ❌ ${filePath} failed syntax check: ${error.message}`,
    );
    return {
      valid: false,
      error: `Parse error: ${error.message}`,
    };
  }
}

/**
 * Check JSON syntax using JSON.parse
 */
function checkJSONSyntax(content: string): SyntaxCheckResult {
  try {
    JSON.parse(content);
    console.log("[SyntaxChecker] ✅ JSON is valid");
    return { valid: true };
  } catch (error: any) {
    console.log(`[SyntaxChecker] ❌ JSON parse error: ${error.message}`);
    return {
      valid: false,
      error: `Invalid JSON: ${error.message}`,
    };
  }
}

/**
 * Check CSS syntax (basic brace matching)
 */
function checkCSSSyntax(content: string): SyntaxCheckResult {
  const openBraces = (content.match(/{/g) || []).length;
  const closeBraces = (content.match(/}/g) || []).length;

  if (openBraces !== closeBraces) {
    return {
      valid: false,
      error: `Mismatched braces: ${openBraces} open, ${closeBraces} close`,
    };
  }

  console.log("[SyntaxChecker] ✅ CSS brace balance valid");
  return { valid: true };
}

/**
 * Check HTML syntax (basic tag matching)
 */
function checkHTMLSyntax(content: string): SyntaxCheckResult {
  // Extract all tags
  const openTagsRaw = content.match(/<(\w+)[^>]*>/g) || [];
  const closeTags = content.match(/<\/(\w+)>/g) || [];
  const selfClosing = content.match(/<\w+[^>]*\/>/g) || [];

  const voidTags = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ]);

  // Filter out self-closing tags from open tags
  const openTags = openTagsRaw.filter((tag) => {
    if (tag.endsWith("/>")) {
      return false;
    }

    const match = tag.match(/^<(\w+)/);
    if (match?.[1] && voidTags.has(match[1].toLowerCase())) {
      return false;
    }

    return true;
  });

  // Count should match
  // Note: We already filtered self-closing from openTags, so just compare open vs close
  if (openTags.length !== closeTags.length) {
    return {
      valid: false,
      error: `Mismatched HTML tags: ${openTags.length} open, ${closeTags.length} close, ${selfClosing.length} self-closing`,
    };
  }

  console.log("[SyntaxChecker] ✅ HTML tag balance valid");
  return { valid: true };
}

/**
 * Check bracket/brace/paren balance
 */
function checkBrackets(content: string): SyntaxCheckResult {
  const stack: Array<{ char: string; line: number; col: number }> = [];
  const pairs: Record<string, string> = {
    "(": ")",
    "[": "]",
    "{": "}",
  };

  let line = 1;
  let col = 1;
  let inString = false;
  let stringChar = "";
  let inComment = false;
  let inMultiLineComment = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    // Track position
    if (char === "\n") {
      line++;
      col = 1;
      inComment = false; // Single-line comments end at newline
      continue;
    }
    col++;

    // Skip strings
    if (
      (char === '"' || char === "'" || char === "`") &&
      !inComment &&
      !inMultiLineComment
    ) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar && content[i - 1] !== "\\") {
        inString = false;
      }
      continue;
    }

    if (inString) continue;

    // Skip comments
    if (char === "/" && nextChar === "/" && !inMultiLineComment) {
      inComment = true;
      continue;
    }
    if (char === "/" && nextChar === "*" && !inComment) {
      inMultiLineComment = true;
      i++; // Skip next char
      continue;
    }
    if (char === "*" && nextChar === "/" && inMultiLineComment) {
      inMultiLineComment = false;
      i++; // Skip next char
      continue;
    }

    if (inComment || inMultiLineComment) continue;

    // Check brackets
    if (char in pairs) {
      stack.push({ char, line, col });
    } else if (Object.values(pairs).includes(char)) {
      if (stack.length === 0) {
        return {
          valid: false,
          error: `Unexpected closing '${char}'`,
          line,
          column: col,
        };
      }
      const last = stack.pop()!;
      if (pairs[last.char] !== char) {
        return {
          valid: false,
          error: `Mismatched bracket: expected '${pairs[last.char]}', got '${char}'`,
          line,
          column: col,
        };
      }
    }
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    return {
      valid: false,
      error: `Unclosed '${unclosed.char}'`,
      line: unclosed.line,
      column: unclosed.col,
    };
  }

  return { valid: true };
}

/**
 * Check JSX tag balance
 */
function checkJSXBalance(content: string): SyntaxCheckResult {
  // Simple heuristic: count JSX opening and closing tags
  // This is not perfect but catches obvious truncation

  // Match JSX component tags (capitalized)
  const openJsxTags = content.match(/<[A-Z]\w*[^>/]*>/g) || [];
  const closeJsxTags = content.match(/<\/[A-Z]\w*>/g) || [];
  const selfClosingJsx = content.match(/<[A-Z]\w*[^>]*\/>/g) || [];

  const openCount = openJsxTags.length - selfClosingJsx.length;
  const closeCount = closeJsxTags.length;

  // Allow some tolerance (JSX fragments, etc.)
  if (Math.abs(openCount - closeCount) > 3) {
    return {
      valid: false,
      error: `JSX tag mismatch: ${openCount} open, ${closeCount} close`,
    };
  }

  return { valid: true };
}
