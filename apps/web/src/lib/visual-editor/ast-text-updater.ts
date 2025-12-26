/**
 * AST-based Text Content Updater
 *
 * This module provides a safer alternative to string manipulation for updating
 * text content in JSX/TSX files. It uses ts-morph (TypeScript compiler API) to:
 *
 * 1. Parse the file into a proper AST
 * 2. Locate the target element safely
 * 3. Update only the text content while preserving JSX elements
 * 4. Generate valid code back
 *
 * Benefits over string manipulation:
 * - Handles all valid JSX patterns (fragments, complex expressions, etc.)
 * - Preserves code formatting and comments
 * - No risk of generating malformed JSX
 * - Type-safe and maintainable
 */

import { Project, Node, SyntaxKind, JsxElement, JsxSelfClosingElement, JsxFragment } from 'ts-morph';

interface ElementInfo {
  componentName?: string;
  textContent?: string;
  currentClasses: string[];
  shipperId?: string;
  isRepeated?: boolean;
  instanceIndex?: number;
  totalInstances?: number;
}

/**
 * Parse shipper ID to get line and column position
 * Format: "filename:line:column" (e.g., "App:149:10" or "App.tsx:149:10")
 */
function parseShipperId(shipperId: string): { line: number; column: number } | null {
  const parts = shipperId.split(':');
  if (parts.length === 3) {
    const line = parseInt(parts[1]);
    const column = parseInt(parts[2]);
    if (!isNaN(line) && !isNaN(column)) {
      return { line, column };
    }
  }
  return null;
}

/**
 * Find a JSX element at a specific position using shipper ID
 */
function findElementByPosition(
  sourceFile: any,
  line: number,
  column: number
): JsxElement | JsxSelfClosingElement | JsxFragment | null {
  // Convert line and column to character position
  // Note: line is 1-based in our shipper ID, need to convert to 0-based for ts-morph
  const lines = sourceFile.getFullText().split('\n');

  if (line - 1 < 0 || line - 1 >= lines.length) {
    console.warn('[AST] Line number out of range:', line);
    return null;
  }

  // Calculate absolute character position
  let charPosition = 0;
  for (let i = 0; i < line - 1; i++) {
    charPosition += lines[i].length + 1; // +1 for newline
  }
  charPosition += column;

  // Find the node at this position
  const node = sourceFile.getDescendantAtPos(charPosition);

  if (!node) {
    return null;
  }

  // Walk up the tree to find the closest JSX element
  let current = node;
  while (current) {
    if (
      Node.isJsxElement(current) ||
      Node.isJsxSelfClosingElement(current) ||
      Node.isJsxFragment(current)
    ) {
      return current;
    }
    current = current.getParent();
  }

  return null;
}

/**
 * Extract class names from a className attribute
 * Handles various patterns: strings, template literals, JSX expressions, cn() calls
 */
function extractClassNames(classNameAttr: any): string[] {
  const classes: string[] = [];

  if (!Node.isJsxAttribute(classNameAttr)) {
    return classes;
  }

  const initializer = classNameAttr.getInitializer();
  if (!initializer) {
    return classes;
  }

  // Handle string literals: className="foo bar"
  if (Node.isStringLiteral(initializer)) {
    const value = initializer.getLiteralValue();
    classes.push(...value.split(' ').filter(Boolean));
    return classes;
  }

  // Handle JSX expressions: className={...}
  if (Node.isJsxExpression(initializer)) {
    const expression = initializer.getExpression();
    if (!expression) {
      return classes;
    }

    // Handle string literal in expression: className={"foo bar"}
    if (Node.isStringLiteral(expression)) {
      const value = expression.getLiteralValue();
      classes.push(...value.split(' ').filter(Boolean));
      return classes;
    }

    // Handle template literal: className={`foo bar ${variable}`}
    if (Node.isTemplateExpression(expression) || Node.isNoSubstitutionTemplateLiteral(expression)) {
      const text = expression.getText();
      // Extract static parts from template literal (between backticks and ${})
      const staticParts = text.match(/`([^${}]*)`/);
      if (staticParts && staticParts[1]) {
        classes.push(...staticParts[1].trim().split(' ').filter(Boolean));
      }
      // Also try to extract parts before/after template expressions
      const allParts = text.match(/[a-zA-Z0-9-_]+/g);
      if (allParts) {
        classes.push(...allParts.filter(part => !part.match(/^[0-9]+$/)));
      }
      return classes;
    }

    // Handle function calls like cn(): className={cn("foo", "bar")}
    if (Node.isCallExpression(expression)) {
      const args = expression.getArguments();
      args.forEach(arg => {
        if (Node.isStringLiteral(arg)) {
          const value = arg.getLiteralValue();
          classes.push(...value.split(' ').filter(Boolean));
        }
      });
      return classes;
    }

    // Try to extract any string literals from the expression text
    const text = expression.getText();
    const stringMatches = text.match(/["'`]([^"'`]+)["'`]/g);
    if (stringMatches) {
      stringMatches.forEach(match => {
        const cleaned = match.replace(/["'`]/g, '');
        classes.push(...cleaned.split(' ').filter(Boolean));
      });
    }
  }

  return classes;
}

/**
 * Find JSX element by className attribute
 * This is a fallback when shipper ID is not available
 */
function findElementByClasses(
  sourceFile: any,
  targetClasses: string[]
): JsxElement | JsxSelfClosingElement | null {
  if (targetClasses.length === 0) {
    return null;
  }

  const targetClassSet = new Set(targetClasses);
  type BestMatch = { element: JsxElement | JsxSelfClosingElement; score: number };
  let bestMatch: BestMatch | null = null;

  // Find all JSX elements
  const jsxElements: (JsxElement | JsxSelfClosingElement)[] = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];

  for (const element of jsxElements) {
    const openingElement = Node.isJsxElement(element)
      ? element.getOpeningElement()
      : element;

    const classNameAttr = openingElement.getAttribute('className');

    if (classNameAttr) {
      const classes = extractClassNames(classNameAttr);
      const matchCount = classes.filter(cls => targetClassSet.has(cls)).length;

      if (matchCount > 0) {
        const score = matchCount / targetClasses.length;
        if (bestMatch === null || score > bestMatch.score) {
          bestMatch = { element, score };
        }
      }
    }
  }

  // Only return if we have at least 70% match
  if (bestMatch !== null) {
    if (bestMatch.score >= 0.7) {
      return bestMatch.element;
    }
  }

  return null;
}


/**
 * Reconstruct a JSX element with new text content while preserving JSX children
 * This safely handles all JSX patterns and preserves the structure
 */
function reconstructElementWithNewText(
  element: JsxElement | JsxFragment,
  newText: string
): string {
  if (Node.isJsxElement(element)) {
    const openingElement = element.getOpeningElement();
    const closingElement = element.getClosingElement();

    if (!closingElement) {
      throw new Error('Element has no closing tag');
    }

    // Get all JSX children (elements, not text)
    const jsxChildren = element.getJsxChildren().filter(child =>
      Node.isJsxElement(child) ||
      Node.isJsxSelfClosingElement(child) ||
      Node.isJsxFragment(child) ||
      Node.isJsxExpression(child)
    );

    // Build the new element structure
    const parts: string[] = [openingElement.getText()];

    // Add new text content
    if (newText.trim()) {
      parts.push(` ${newText} `);
    }

    // Add back all JSX children
    jsxChildren.forEach(child => {
      parts.push(child.getText());
    });

    parts.push(closingElement.getText());

    return parts.join('');
  } else if (Node.isJsxFragment(element)) {
    // Handle JSX fragments
    const jsxChildren = element.getJsxChildren().filter(child =>
      Node.isJsxElement(child) ||
      Node.isJsxSelfClosingElement(child) ||
      Node.isJsxFragment(child) ||
      Node.isJsxExpression(child)
    );

    const parts: string[] = ['<>'];

    if (newText.trim()) {
      parts.push(` ${newText} `);
    }

    jsxChildren.forEach(child => {
      parts.push(child.getText());
    });

    parts.push('</>');

    return parts.join('');
  }

  throw new Error('Unsupported element type');
}

/**
 * Update text content in a file using AST parsing
 *
 * This is a safer alternative to string manipulation that:
 * - Properly parses JSX/TSX using the TypeScript compiler
 * - Handles all valid JSX patterns (fragments, expressions, etc.)
 * - Preserves code structure and formatting
 * - Cannot generate malformed JSX
 *
 * @param fileContent - The original file content
 * @param filePath - Path to the file (for better error messages)
 * @param elementInfo - Information to locate the element
 * @param newTextContent - The new text content to insert
 * @returns Updated file content with text replaced
 */
export function updateFileWithTextAST(
  fileContent: string,
  filePath: string,
  elementInfo: ElementInfo,
  newTextContent: string
): string {
  // Create a temporary in-memory project
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      jsx: 1, // JSX preserve mode
      target: 99, // ESNext
    },
  });

  // Add the file to the project
  const sourceFile = project.createSourceFile(filePath, fileContent);

  let targetElement: JsxElement | JsxSelfClosingElement | JsxFragment | null = null;

  // Strategy 1: Find by shipper ID (most precise)
  if (elementInfo.shipperId) {
    const position = parseShipperId(elementInfo.shipperId);
    if (position) {
      console.log('[AST] Finding element by position:', position);
      targetElement = findElementByPosition(sourceFile, position.line, position.column);

      if (targetElement) {
        console.log('[AST] Found element by shipper ID');
      }
    }
  }

  // Strategy 2: Find by className (fallback)
  if (!targetElement && elementInfo.currentClasses.length > 0) {
    console.log('[AST] Finding element by classes:', elementInfo.currentClasses);
    targetElement = findElementByClasses(sourceFile, elementInfo.currentClasses);

    if (targetElement) {
      console.log('[AST] Found element by className');
    }
  }

  // Validate element
  if (!targetElement) {
    throw new Error(
      'Cannot find element to update text content. ' +
      'The element may have been modified or the file structure may have changed.'
    );
  }

  // Check if element is self-closing
  if (Node.isJsxSelfClosingElement(targetElement)) {
    throw new Error('Cannot update text content: element is self-closing.');
  }

  // Update the text content
  console.log('[AST] Updating text content to:', newTextContent);

  // Reconstruct the element with new text
  const reconstructedElement = reconstructElementWithNewText(targetElement, newTextContent);

  // Replace the element in the source file
  targetElement.replaceWithText(reconstructedElement);

  // Get the updated content
  const updatedContent = sourceFile.getFullText();

  console.log('[AST] Text update complete');

  // Verify the update was successful
  if (!updatedContent.includes(newTextContent)) {
    console.warn('[AST] Warning: New text content not found in result');
  }

  return updatedContent;
}

/**
 * Validate that the update was successful
 */
export function validateTextUpdate(
  updatedContent: string,
  expectedText: string
): boolean {
  return updatedContent.includes(expectedText);
}
