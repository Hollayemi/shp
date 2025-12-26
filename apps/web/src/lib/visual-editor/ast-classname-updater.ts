/**
 * AST-Based className Updater
 *
 * This module provides a safer alternative to regex-based className manipulation.
 * It uses ts-morph (TypeScript compiler API) to properly handle all className patterns:
 *
 * - Simple strings: className="btn primary"
 * - JSX expressions: className={"btn primary"}
 * - Template literals: className={`btn btn-${size}`}
 * - cn() calls: className={cn("btn", "primary", conditionalClass)}
 * - Complex cn() with objects: className={cn("btn", { "btn-active": isActive })}
 *
 * This approach eliminates the risk of incomplete updates when classes are spread
 * across multiple arguments or conditionals in cn() calls.
 */

import { Project, Node, SyntaxKind, JsxElement, JsxSelfClosingElement, JsxFragment, JsxAttribute } from 'ts-morph';
import { convertStylesToTailwind } from './tailwind-updater';

interface ElementInfo {
  componentName?: string;
  textContent?: string;
  currentClasses: string[];
  shipperId?: string;
  isRepeated?: boolean;
  instanceIndex?: number;
  totalInstances?: number;
}

interface ClassUpdate {
  classesToAdd: string[];
  classesToRemove: string[];
}

/**
 * Parse shipper ID to get line and column position
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
  const lines = sourceFile.getFullText().split('\n');

  if (line - 1 < 0 || line - 1 >= lines.length) {
    console.warn('[AST ClassNames] Line number out of range:', line);
    return null;
  }

  // Calculate absolute character position
  let charPosition = 0;
  for (let i = 0; i < line - 1; i++) {
    charPosition += lines[i].length + 1; // +1 for newline
  }
  charPosition += column;

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
 * Extract all string literal class names from a cn() call
 * Handles: cn("a", "b", variable, { "c": condition })
 */
function extractClassesFromCnCall(callExpression: any): string[] {
  const classes: string[] = [];
  const args = callExpression.getArguments();

  for (const arg of args) {
    // Handle string literals
    if (Node.isStringLiteral(arg)) {
      const value = arg.getLiteralValue();
      classes.push(...value.split(' ').filter(Boolean));
    }
    // Handle template literals (extract static parts)
    else if (Node.isTemplateExpression(arg) || Node.isNoSubstitutionTemplateLiteral(arg)) {
      const text = arg.getText();
      // Extract identifiable class patterns (e.g., "btn" from `btn-${size}`)
      const matches = text.match(/[a-zA-Z][a-zA-Z0-9-_]*/g);
      if (matches) {
        classes.push(...matches);
      }
    }
    // Handle object literals with string keys
    else if (Node.isObjectLiteralExpression(arg)) {
      const properties = arg.getProperties();
      for (const prop of properties) {
        if (Node.isPropertyAssignment(prop)) {
          const name = prop.getName();
          // Remove quotes if present
          const className = name.replace(/^["']|["']$/g, '');
          classes.push(...className.split(' ').filter(Boolean));
        }
      }
    }
  }

  return classes;
}

/**
 * Find JSX element by matching className
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

  const jsxElements: (JsxElement | JsxSelfClosingElement)[] = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];

  for (const element of jsxElements) {
    const openingElement = Node.isJsxElement(element)
      ? element.getOpeningElement()
      : element;

    const classNameAttr = openingElement.getAttribute('className');
    if (!classNameAttr || !Node.isJsxAttribute(classNameAttr)) continue;

    const classes = extractClassesFromAttribute(classNameAttr);
    const matchCount = classes.filter(cls => targetClassSet.has(cls)).length;

    if (matchCount > 0) {
      const score = matchCount / targetClasses.length;
      if (bestMatch === null || score > bestMatch.score) {
        bestMatch = { element, score };
      }
    }
  }

  if (bestMatch !== null && bestMatch.score >= 0.7) {
    return bestMatch.element;
  }

  return null;
}

/**
 * Extract classes from a className attribute (handles all patterns)
 */
function extractClassesFromAttribute(classNameAttr: JsxAttribute): string[] {
  const classes: string[] = [];
  const initializer = classNameAttr.getInitializer();

  if (!initializer) return classes;

  // String literal: className="a b"
  if (Node.isStringLiteral(initializer)) {
    const value = initializer.getLiteralValue();
    classes.push(...value.split(' ').filter(Boolean));
    return classes;
  }

  // JSX expression: className={...}
  if (Node.isJsxExpression(initializer)) {
    const expression = initializer.getExpression();
    if (!expression) return classes;

    // String in expression: className={"a b"}
    if (Node.isStringLiteral(expression)) {
      const value = expression.getLiteralValue();
      classes.push(...value.split(' ').filter(Boolean));
      return classes;
    }

    // Template literal: className={`a b`}
    if (Node.isTemplateExpression(expression) || Node.isNoSubstitutionTemplateLiteral(expression)) {
      const text = expression.getText();
      const matches = text.match(/[a-zA-Z][a-zA-Z0-9-_]*/g);
      if (matches) {
        classes.push(...matches);
      }
      return classes;
    }

    // cn() call: className={cn(...)}
    if (Node.isCallExpression(expression)) {
      const fnName = expression.getExpression().getText();
      if (fnName === 'cn' || fnName.endsWith('.cn')) {
        classes.push(...extractClassesFromCnCall(expression));
      }
      return classes;
    }
  }

  return classes;
}

/**
 * Update className attribute with new classes
 * Handles all className patterns intelligently
 */
function updateClassNameAttribute(
  classNameAttr: JsxAttribute,
  classUpdate: ClassUpdate
): string {
  const initializer = classNameAttr.getInitializer();
  if (!initializer) {
    // No initializer, create simple string
    return `className="${classUpdate.classesToAdd.join(' ')}"`;
  }

  const classesToRemoveSet = new Set(classUpdate.classesToRemove);

  // Helper: filter classes
  const filterClasses = (classes: string[]): string[] => {
    const filtered = classes.filter(cls => {
      // Check if this class matches any removal pattern
      for (const pattern of classUpdate.classesToRemove) {
        if (cls.startsWith(pattern) || cls === pattern.replace(/-$/, '')) {
          console.log(`[AST ClassNames] Filtering out class '${cls}' (matches pattern '${pattern}')`);
          return false;
        }
      }
      return true;
    });

    console.log('[AST ClassNames] Filter result:', {
      original: classes,
      filtered,
      patterns: classUpdate.classesToRemove,
    });

    return filtered;
  };

  // String literal: className="a b"
  if (Node.isStringLiteral(initializer)) {
    const currentClasses = initializer.getLiteralValue().split(' ').filter(Boolean);
    const originalClassSet = new Set(currentClasses); // Track original classes before filtering
    const filtered = filterClasses(currentClasses);

    // Determine which classes to actually add:
    // - Add if not already in the filtered classes (avoid duplicates)
    // - BUT: if a class was in the original and got filtered out, we SHOULD add it back
    //   if it's explicitly in classesToAdd (this is an intentional update to the same value)
    const existingClassSet = new Set(filtered);
    const classesToActuallyAdd = classUpdate.classesToAdd.filter(cls =>
      !existingClassSet.has(cls)
    );

    const combined = [...filtered, ...classesToActuallyAdd].filter(Boolean);
    const newClasses = combined.join(' ');

    console.log('[AST ClassNames] Deduplication:', {
      toAdd: classUpdate.classesToAdd,
      actuallyAdding: classesToActuallyAdd,
      filtered,
      original: currentClasses,
      combined,
      newClasses,
    });

    return `className="${newClasses}"`;
  }

  // JSX expression
  if (Node.isJsxExpression(initializer)) {
    const expression = initializer.getExpression();
    if (!expression) {
      return `className="${classUpdate.classesToAdd.join(' ')}"`;
    }

    // String in expression: className={"a b"}
    if (Node.isStringLiteral(expression)) {
      const currentClasses = expression.getLiteralValue().split(' ').filter(Boolean);
      const filtered = filterClasses(currentClasses);

      // Add classes that aren't already in the filtered set
      const existingClassSet = new Set(filtered);
      const classesToActuallyAdd = classUpdate.classesToAdd.filter(cls => !existingClassSet.has(cls));

      const newClasses = [...filtered, ...classesToActuallyAdd].join(' ');
      return `className="${newClasses}"`;
    }

    // cn() call - update the first string argument
    if (Node.isCallExpression(expression)) {
      const fnName = expression.getExpression().getText();
      if (fnName === 'cn' || fnName.endsWith('.cn')) {
        return updateCnCall(expression, classUpdate, filterClasses);
      }
    }

    // Template literal - keep as is, add classes via cn()
    if (Node.isTemplateExpression(expression) || Node.isNoSubstitutionTemplateLiteral(expression)) {
      const templateText = expression.getText();
      const newClassesStr = classUpdate.classesToAdd.join(' ');
      return `className={cn(${templateText}, "${newClassesStr}")}`;
    }
  }

  // Fallback: wrap in cn()
  const existingText = initializer.getText();
  const newClassesStr = classUpdate.classesToAdd.join(' ');
  return `className={cn(${existingText}, "${newClassesStr}")}`;
}

/**
 * Update a cn() call expression with new classes
 * Updates ALL string literals in the cn() call, not just the first one
 */
function updateCnCall(
  callExpression: any,
  classUpdate: ClassUpdate,
  filterClasses: (classes: string[]) => string[]
): string {
  const args = callExpression.getArguments();
  const newArgs: string[] = [];
  let hasStringLiteral = false;
  let addedNewClasses = false;

  for (const arg of args) {
    // Update all string literals (not just the first)
    if (Node.isStringLiteral(arg)) {
      hasStringLiteral = true;
      const currentClasses = arg.getLiteralValue().split(' ').filter(Boolean);
      const filtered = filterClasses(currentClasses);

      // Add new classes to the first string literal only
      if (!addedNewClasses && filtered.length > 0) {
        // Add classes that aren't already in the filtered set
        const existingClassSet = new Set(filtered);
        const classesToActuallyAdd = classUpdate.classesToAdd.filter(cls => !existingClassSet.has(cls));

        const newClasses = [...filtered, ...classesToActuallyAdd];
        newArgs.push(`"${newClasses.join(' ')}"`);
        addedNewClasses = true;
      } else if (filtered.length > 0) {
        // Keep this string literal if it still has classes after filtering
        newArgs.push(`"${filtered.join(' ')}"`);
      }
      // Skip empty string literals after filtering
    } else {
      // Keep other arguments as-is (conditionals, objects, template literals)
      newArgs.push(arg.getText());
    }
  }

  // If no string literal was found, or all were filtered out, add new classes
  if (!hasStringLiteral || !addedNewClasses) {
    newArgs.unshift(`"${classUpdate.classesToAdd.join(' ')}"`);
  }

  const fnName = callExpression.getExpression().getText();
  return `className={${fnName}(${newArgs.join(', ')})}`;
}

/**
 * Update className in a file using AST parsing
 *
 * This safely handles all className patterns:
 * - className="a b"
 * - className={"a b"}
 * - className={`a b-${var}`}
 * - className={cn("a", "b", { "c": cond })}
 *
 * @param fileContent - Original file content
 * @param filePath - File path (for error messages)
 * @param elementInfo - Element identification info
 * @param classUpdate - Classes to add/remove
 * @returns Updated file content
 */
export function updateClassNameAST(
  fileContent: string,
  filePath: string,
  elementInfo: ElementInfo,
  classUpdate: ClassUpdate
): string {
  console.log('[AST ClassNames] Updating classes');
  console.log('[AST ClassNames] Classes to add:', classUpdate.classesToAdd);
  console.log('[AST ClassNames] Patterns to remove:', classUpdate.classesToRemove);

  // Create in-memory project
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      jsx: 1, // JSX preserve
      target: 99, // ESNext
    },
  });

  const sourceFile = project.createSourceFile(filePath, fileContent);
  let targetElement: JsxElement | JsxSelfClosingElement | JsxFragment | null = null;

  // Strategy 1: Find by shipper ID
  if (elementInfo.shipperId) {
    const position = parseShipperId(elementInfo.shipperId);
    if (position) {
      console.log('[AST ClassNames] Finding by position:', position);
      targetElement = findElementByPosition(sourceFile, position.line, position.column);
      if (targetElement) {
        console.log('[AST ClassNames] Found by shipper ID');
      }
    }
  }

  // Strategy 2: Find by className (only if we have classes to match)
  if (!targetElement && elementInfo.currentClasses.length > 0) {
    console.log('[AST ClassNames] Finding by classes:', elementInfo.currentClasses);
    targetElement = findElementByClasses(sourceFile, elementInfo.currentClasses);
    if (targetElement) {
      console.log('[AST ClassNames] Found by className');
    }
  }

  // If we still don't have an element and we have no current classes,
  // but we have a shipper ID, it means the element exists but has no className
  // This is expected when adding a className to an element that doesn't have one
  if (!targetElement) {
    if (elementInfo.currentClasses.length === 0 && !elementInfo.shipperId) {
      throw new Error(
        'Cannot find element: no shipper ID or className provided for matching.'
      );
    } else {
      throw new Error(
        'Cannot find element to update className. ' +
        'The element may have been modified or the file structure may have changed.'
      );
    }
  }

  // Get opening element
  const openingElement = Node.isJsxElement(targetElement)
    ? targetElement.getOpeningElement()
    : Node.isJsxSelfClosingElement(targetElement)
    ? targetElement
    : null;

  if (!openingElement) {
    throw new Error('Cannot update className on JSX fragment');
  }

  // Get or create className attribute
  const classNameAttr = openingElement.getAttribute('className');

  if (!classNameAttr) {
    // No className attribute - add one
    const newClassNameAttr = `className="${classUpdate.classesToAdd.join(' ')}"`;
    const tagName = openingElement.getTagNameNode().getText();
    const attributes = openingElement.getAttributes().map(a => a.getText()).join(' ');
    const isSelfClosing = Node.isJsxSelfClosingElement(targetElement);
    const closing = isSelfClosing ? ' />' : '>';

    const newOpeningTag = attributes
      ? `<${tagName} ${attributes} ${newClassNameAttr}${closing}`
      : `<${tagName} ${newClassNameAttr}${closing}`;

    openingElement.replaceWithText(newOpeningTag);
  } else if (Node.isJsxAttribute(classNameAttr)) {
    // Update existing className
    const originalAttr = classNameAttr.getText();
    const newClassNameAttr = updateClassNameAttribute(classNameAttr, classUpdate);

    console.log('[AST ClassNames] Replacing className:', {
      original: originalAttr,
      new: newClassNameAttr,
      changed: originalAttr !== newClassNameAttr,
    });

    // Instead of using replaceText on sourceFile, replace the attribute node directly
    classNameAttr.replaceWithText(newClassNameAttr);

    // Verify the replacement
    const updatedAttr = openingElement.getAttribute('className');
    const updatedText = updatedAttr ? updatedAttr.getText() : 'NOT FOUND';
    console.log('[AST ClassNames] After replacement:', {
      updatedAttr: updatedText,
    });
  }

  const updatedContent = sourceFile.getFullText();
  console.log('[AST ClassNames] Update complete');

  // Verify the update actually happened
  const containsNewClasses = classUpdate.classesToAdd.every(cls => updatedContent.includes(cls));
  if (!containsNewClasses) {
    console.warn('[AST ClassNames] Warning: Some new classes not found in result');
  }

  return updatedContent;
}

/**
 * Update Tailwind classes in a file using AST (convenience wrapper)
 *
 * This combines style-to-Tailwind conversion with AST-based className updating.
 * Drop-in replacement for updateFileWithTailwind from tailwind-updater.ts
 *
 * @param fileContent - Original file content
 * @param filePath - File path (for error messages)
 * @param selector - CSS selector (deprecated, kept for compatibility)
 * @param elementInfo - Element identification info
 * @param styleChanges - CSS style changes to convert to Tailwind
 * @returns Updated file content
 */
export function updateFileWithTailwindAST(
  fileContent: string,
  filePath: string,
  selector: string,
  elementInfo: ElementInfo,
  styleChanges: Record<string, string>
): string {
  console.log('[AST Tailwind] Converting styles to Tailwind classes');

  // Convert CSS styles to Tailwind classes
  const { classesToAdd, classesToRemove } = convertStylesToTailwind(styleChanges);

  console.log('[AST Tailwind] Tailwind conversion result:', {
    classesToAdd,
    classesToRemove,
  });

  // Use AST-based className updater
  return updateClassNameAST(fileContent, filePath, elementInfo, {
    classesToAdd,
    classesToRemove,
  });
}
