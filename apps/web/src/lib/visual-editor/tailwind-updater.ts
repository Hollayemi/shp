/**
 * Tailwind Class Updater
 *
 * Utilities to update Tailwind CSS classes in React/JSX/HTML files
 * based on style changes from the visual editor.
 */

/**
 * Maps CSS style properties to Tailwind class prefixes
 */
const STYLE_TO_TAILWIND_MAP: Record<string, (value: string) => string[]> = {
  backgroundColor: (value: string) => {
    // If value is already a Tailwind class (bg-*), return it as-is
    if (value.startsWith("bg-")) {
      return [value];
    }
    // Convert hex/rgb to Tailwind color using arbitrary value syntax
    return [`bg-[${value}]`];
  },
  borderRadius: (value: string) => {
    // If value is already a Tailwind class (rounded-*), return it as-is
    if (value.startsWith("rounded-")) {
      return [value];
    }
    const numValue = parseInt(value);
    if (numValue === 0) return ['rounded-none'];
    if (numValue <= 4) return ['rounded-sm'];
    if (numValue <= 6) return ['rounded'];
    if (numValue <= 8) return ['rounded-md'];
    if (numValue <= 12) return ['rounded-lg'];
    if (numValue <= 16) return ['rounded-xl'];
    if (numValue <= 24) return ['rounded-2xl'];
    if (numValue <= 32) return ['rounded-3xl'];
    if (value === '9999px' || value === '50%') return ['rounded-full'];
    return [`rounded-[${value}]`];
  },
  opacity: (value: string) => {
    const numValue = Math.round(parseFloat(value) * 100);
    if (numValue === 0) return ['opacity-0'];
    if (numValue === 5) return ['opacity-5'];
    if (numValue === 10) return ['opacity-10'];
    if (numValue === 20) return ['opacity-20'];
    if (numValue === 25) return ['opacity-25'];
    if (numValue === 30) return ['opacity-30'];
    if (numValue === 40) return ['opacity-40'];
    if (numValue === 50) return ['opacity-50'];
    if (numValue === 60) return ['opacity-60'];
    if (numValue === 70) return ['opacity-70'];
    if (numValue === 75) return ['opacity-75'];
    if (numValue === 80) return ['opacity-80'];
    if (numValue === 90) return ['opacity-90'];
    if (numValue === 95) return ['opacity-95'];
    if (numValue === 100) return ['opacity-100'];
    return [`opacity-[${numValue}%]`];
  },
  padding: (value: string) => {
    const numValue = parseInt(value);
    if (numValue === 0) return ['p-0'];
    if (numValue <= 4) return ['p-1'];
    if (numValue <= 8) return ['p-2'];
    if (numValue <= 12) return ['p-3'];
    if (numValue <= 16) return ['p-4'];
    if (numValue <= 20) return ['p-5'];
    if (numValue <= 24) return ['p-6'];
    if (numValue <= 32) return ['p-8'];
    if (numValue <= 40) return ['p-10'];
    if (numValue <= 48) return ['p-12'];
    return [`p-[${value}]`];
  },
  paddingTop: (value: string) => {
    const numValue = parseInt(value);
    if (numValue === 0) return ['pt-0'];
    if (numValue <= 4) return ['pt-1'];
    if (numValue <= 8) return ['pt-2'];
    if (numValue <= 12) return ['pt-3'];
    if (numValue <= 16) return ['pt-4'];
    if (numValue <= 20) return ['pt-5'];
    if (numValue <= 24) return ['pt-6'];
    return [`pt-[${value}]`];
  },
  paddingBottom: (value: string) => {
    const numValue = parseInt(value);
    if (numValue === 0) return ['pb-0'];
    if (numValue <= 4) return ['pb-1'];
    if (numValue <= 8) return ['pb-2'];
    if (numValue <= 12) return ['pb-3'];
    if (numValue <= 16) return ['pb-4'];
    if (numValue <= 20) return ['pb-5'];
    if (numValue <= 24) return ['pb-6'];
    return [`pb-[${value}]`];
  },
  paddingLeft: (value: string) => {
    const numValue = parseInt(value);
    if (numValue === 0) return ['pl-0'];
    if (numValue <= 4) return ['pl-1'];
    if (numValue <= 8) return ['pl-2'];
    if (numValue <= 12) return ['pl-3'];
    if (numValue <= 16) return ['pl-4'];
    if (numValue <= 20) return ['pl-5'];
    if (numValue <= 24) return ['pl-6'];
    return [`pl-[${value}]`];
  },
  paddingRight: (value: string) => {
    const numValue = parseInt(value);
    if (numValue === 0) return ['pr-0'];
    if (numValue <= 4) return ['pr-1'];
    if (numValue <= 8) return ['pr-2'];
    if (numValue <= 12) return ['pr-3'];
    if (numValue <= 16) return ['pr-4'];
    if (numValue <= 20) return ['pr-5'];
    if (numValue <= 24) return ['pr-6'];
    return [`pr-[${value}]`];
  },
  margin: (value: string) => {
    const numValue = parseInt(value);
    if (numValue === 0) return ['m-0'];
    if (numValue <= 4) return ['m-1'];
    if (numValue <= 8) return ['m-2'];
    if (numValue <= 12) return ['m-3'];
    if (numValue <= 16) return ['m-4'];
    if (numValue <= 20) return ['m-5'];
    if (numValue <= 24) return ['m-6'];
    return [`m-[${value}]`];
  },
  marginTop: (value: string) => {
    const numValue = parseInt(value);
    if (numValue === 0) return ['mt-0'];
    if (numValue <= 4) return ['mt-1'];
    if (numValue <= 8) return ['mt-2'];
    if (numValue <= 12) return ['mt-3'];
    if (numValue <= 16) return ['mt-4'];
    if (numValue <= 20) return ['mt-5'];
    if (numValue <= 24) return ['mt-6'];
    return [`mt-[${value}]`];
  },
  marginBottom: (value: string) => {
    const numValue = parseInt(value);
    if (numValue === 0) return ['mb-0'];
    if (numValue <= 4) return ['mb-1'];
    if (numValue <= 8) return ['mb-2'];
    if (numValue <= 12) return ['mb-3'];
    if (numValue <= 16) return ['mb-4'];
    if (numValue <= 20) return ['mb-5'];
    if (numValue <= 24) return ['mb-6'];
    return [`mb-[${value}]`];
  },
  marginLeft: (value: string) => {
    const numValue = parseInt(value);
    if (numValue === 0) return ['ml-0'];
    if (numValue <= 4) return ['ml-1'];
    if (numValue <= 8) return ['ml-2'];
    if (numValue <= 12) return ['ml-3'];
    if (numValue <= 16) return ['ml-4'];
    if (numValue <= 20) return ['ml-5'];
    if (numValue <= 24) return ['ml-6'];
    return [`ml-[${value}]`];
  },
  marginRight: (value: string) => {
    const numValue = parseInt(value);
    if (numValue === 0) return ['mr-0'];
    if (numValue <= 4) return ['mr-1'];
    if (numValue <= 8) return ['mr-2'];
    if (numValue <= 12) return ['mr-3'];
    if (numValue <= 16) return ['mr-4'];
    if (numValue <= 20) return ['mr-5'];
    if (numValue <= 24) return ['mr-6'];
    return [`mr-[${value}]`];
  },
  fontSize: (value: string) => {
    // If value is already a Tailwind class (text-*), return it as-is
    if (value.startsWith("text-")) {
      return [value];
    }
    // Convert pixel values to Tailwind classes
    const numValue = parseInt(value);
    if (numValue === 12) return ['text-xs'];
    if (numValue === 14) return ['text-sm'];
    if (numValue === 16) return ['text-base'];
    if (numValue === 18) return ['text-lg'];
    if (numValue === 20) return ['text-xl'];
    if (numValue === 24) return ['text-2xl'];
    if (numValue === 30) return ['text-3xl'];
    if (numValue === 36) return ['text-4xl'];
    if (numValue === 48) return ['text-5xl'];
    if (numValue === 60) return ['text-6xl'];
    if (numValue === 72) return ['text-7xl'];
    if (numValue === 96) return ['text-8xl'];
    if (numValue === 128) return ['text-9xl'];
    return [`text-[${value}]`];
  },
  fontWeight: (value: string) => {
    // If value is already a Tailwind class (font-*), return it as-is
    if (value.startsWith("font-")) {
      return [value];
    }
    // Convert CSS font-weight to Tailwind classes
    if (value === '100') return ['font-thin'];
    if (value === '200') return ['font-extralight'];
    if (value === '300') return ['font-light'];
    if (value === 'normal' || value === '400') return ['font-normal'];
    if (value === '500') return ['font-medium'];
    if (value === '600') return ['font-semibold'];
    if (value === 'bold' || value === '700') return ['font-bold'];
    if (value === '800') return ['font-extrabold'];
    if (value === '900') return ['font-black'];
    return [`font-[${value}]`];
  },
  color: (value: string) => {
    // If value is already a Tailwind class (text-*), return it as-is
    if (value.startsWith("text-")) {
      return [value];
    }
    // Convert hex/rgb to Tailwind color using arbitrary value syntax
    return [`text-[${value}]`];
  },
  textAlign: (value: string) => {
    if (value === 'left') return ['text-left'];
    if (value === 'center') return ['text-center'];
    if (value === 'right') return ['text-right'];
    if (value === 'justify') return ['text-justify'];
    return ['text-left'];
  },
};

/**
 * Get Tailwind class prefixes that should be removed when updating a style
 * These are patterns that will be checked against each class
 */
const STYLE_PREFIXES_TO_REMOVE: Record<string, string[]> = {
  backgroundColor: ['bg-'],
  borderRadius: ['rounded-', 'rounded'],
  opacity: ['opacity-'],
  padding: ['p-', 'pt-', 'pb-', 'pl-', 'pr-'], // Remove all padding classes when setting overall padding
  paddingTop: ['pt-'],
  paddingBottom: ['pb-'],
  paddingLeft: ['pl-'],
  paddingRight: ['pr-'],
  margin: ['m-', 'mt-', 'mb-', 'ml-', 'mr-'], // Remove all margin classes when setting overall margin
  marginTop: ['mt-'],
  marginBottom: ['mb-'],
  marginLeft: ['ml-'],
  marginRight: ['mr-'],
  // For fontSize, we need to match both base classes and responsive variants
  // Pattern: text-{size} or {breakpoint}:text-{size}
  fontSize: ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl', 'text-7xl', 'text-8xl', 'text-9xl', 'text-['],
  fontWeight: ['font-thin', 'font-extralight', 'font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-extrabold', 'font-black', 'font-['],
  color: ['text-'],
  textAlign: ['text-left', 'text-center', 'text-right', 'text-justify'],
};

/**
 * Check if a class should be removed based on the property being updated
 * Handles both base classes and responsive variants (e.g., "text-xl" and "md:text-xl")
 */
function shouldRemoveClass(cls: string, property: string): boolean {
  const patterns = STYLE_PREFIXES_TO_REMOVE[property] || [];
  
  // For responsive classes like "md:text-xl", extract the base class
  const baseClass = cls.includes(':') ? cls.split(':')[1] : cls;
  
  // Special handling for fontSize - need exact matches or prefix matches
  if (property === 'fontSize') {
    return patterns.some(pattern => {
      // Check if the base class matches exactly or starts with the pattern
      if (pattern.endsWith('[')) {
        // Pattern like "text-[" - check if it starts with this
        return baseClass.startsWith(pattern);
      } else {
        // Exact match like "text-xl"
        return baseClass === pattern;
      }
    });
  }
  
  // Special handling for fontWeight - exact matches
  if (property === 'fontWeight') {
    return patterns.some(pattern => {
      if (pattern.endsWith('[')) {
        return baseClass.startsWith(pattern);
      } else {
        return baseClass === pattern;
      }
    });
  }
  
  // For other properties, use prefix matching
  return patterns.some(prefix => baseClass.startsWith(prefix) || baseClass === prefix.replace(/-$/, ''));
}

/**
 * Convert CSS style changes to Tailwind classes
 */
export function convertStylesToTailwind(
  styleChanges: Record<string, string>
): { classesToAdd: string[]; classesToRemove: string[] } {
  const classesToAdd: string[] = [];
  const classesToRemove: string[] = [];

  for (const [property, value] of Object.entries(styleChanges)) {
    const converter = STYLE_TO_TAILWIND_MAP[property];
    if (converter) {
      const newClasses = converter(value);
      classesToAdd.push(...newClasses);

      // Add prefixes to remove
      const prefixes = STYLE_PREFIXES_TO_REMOVE[property] || [];
      classesToRemove.push(...prefixes);
    }
  }

  return { classesToAdd, classesToRemove };
}

/**
 * Update className attribute in a file
 * Finds the element by selector and updates its className
 */
export function updateTailwindClasses(
  fileContent: string,
  selector: string,
  classesToAdd: string[],
  classesToRemove: string[]
): string {
  // Simple implementation: find className attributes and update them
  // This is a basic regex-based approach. For production, consider using a proper parser.

  // Pattern to match className="..." or className={'...'}
  const classNamePattern = /className=(?:["']([^"']*)["']|\{["']([^"']*)["']\})/g;

  let updatedContent = fileContent;
  let match;

  while ((match = classNamePattern.exec(fileContent)) !== null) {
    const currentClasses = (match[1] || match[2] || '').split(' ').filter(Boolean);

    // Remove classes matching the prefixes
    const filteredClasses = currentClasses.filter(cls => {
      return !classesToRemove.some(prefix => cls.startsWith(prefix) || cls === prefix.replace(/-$/, ''));
    });

    // Add new classes
    const newClasses = [...filteredClasses, ...classesToAdd].join(' ');

    // Replace the className attribute
    const fullMatch = match[0];
    const replacement = match[0].includes('{')
      ? `className={"${newClasses}"}`
      : `className="${newClasses}"`;

    updatedContent = updatedContent.replace(fullMatch, replacement);
  }

  return updatedContent;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find the likely element in the file based on selector information
 * Returns the updated file content with Tailwind classes modified
 */
export function updateFileWithTailwind(
  fileContent: string,
  selector: string,
  elementInfo: {
    componentName?: string;
    textContent?: string;
    currentClasses: string[];
    shipperId?: string;
    isRepeated?: boolean;
    instanceIndex?: number;
    totalInstances?: number;
  },
  styleChanges: Record<string, string>
): string {
  const { classesToAdd, classesToRemove } = convertStylesToTailwind(styleChanges);

  console.log('[updateFileWithTailwind] Looking for element with classes:', elementInfo.currentClasses);
  console.log('[updateFileWithTailwind] Shipper ID:', elementInfo.shipperId || 'none');
  console.log('[updateFileWithTailwind] Classes to add:', classesToAdd);
  console.log('[updateFileWithTailwind] Prefixes to remove:', classesToRemove);

  // STRATEGY 0: Precise line:column matching using shipper ID
  // Shipper ID format: "filename:line:column" where line:column is the exact position of the opening tag
  // Note: filename may or may not include the extension (e.g., "App:149:10" or "App.tsx:149:10")
  if (elementInfo.shipperId) {
    console.log('[updateFileWithTailwind] Using shipper ID for precise matching:', elementInfo.shipperId);

    // Parse shipper ID: "App:80:10" -> line 80, column 10
    const idParts = elementInfo.shipperId.split(':');
    if (idParts.length === 3) {
      const targetLine = parseInt(idParts[1]) - 1; // Convert to 0-based
      const targetColumn = parseInt(idParts[2]);

      console.log(`[updateFileWithTailwind] Target position: line ${targetLine + 1}, column ${targetColumn}`);

      // Split into lines and calculate character position
      const lines = fileContent.split('\n');

      if (targetLine < 0 || targetLine >= lines.length) {
        console.warn(`[updateFileWithTailwind] Target line ${targetLine + 1} out of range (file has ${lines.length} lines)`);
        // Fall through to other strategies
      } else {
        // Calculate absolute character position in the file
        let charPosition = 0;
        for (let i = 0; i < targetLine; i++) {
          charPosition += lines[i].length + 1; // +1 for newline
        }
        charPosition += targetColumn;

        console.log(`[updateFileWithTailwind] Character position: ${charPosition}`);

        // The element should start with '<' at this position
        if (fileContent[charPosition] === '<') {
          // Find the end of the opening tag (handle multi-line tags)
          // Look for '>' or '/>' but handle cases where className might span lines
          let tagEnd = fileContent.indexOf('>', charPosition);
          const tagEndSelfClosing = fileContent.indexOf('/>', charPosition);
          
          // Use the earlier of the two, but make sure we capture the full className
          if (tagEndSelfClosing !== -1 && (tagEnd === -1 || tagEndSelfClosing < tagEnd)) {
            tagEnd = tagEndSelfClosing + 1; // Include the '/' in '/>'
          }
          
          if (tagEnd === -1) {
            console.warn('[updateFileWithTailwind] Could not find end of opening tag');
          } else {
            // Extend search to handle multi-line className attributes
            // Look for className= and find the matching closing brace/quote
            const tagStart = charPosition;
            let searchEnd = tagEnd;
            
            // If we see className= but haven't found its closing brace/quote, extend search
            const classNameStart = fileContent.indexOf('className=', tagStart);
            if (classNameStart !== -1 && classNameStart < tagEnd) {
              // Check if it's a cn() call or template literal
              const afterEquals = fileContent[classNameStart + 'className='.length];
              if (afterEquals === '{') {
                // Find matching closing brace (handle nested braces)
                let braceCount = 0;
                let foundClosing = false;
                const startPos = classNameStart + 'className='.length;
                for (let i = startPos; i < Math.min(fileContent.length, startPos + 500); i++) {
                  if (fileContent[i] === '{') braceCount++;
                  if (fileContent[i] === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                      searchEnd = Math.max(searchEnd, i + 1);
                      foundClosing = true;
                      break;
                    }
                  }
                }
                if (!foundClosing) {
                  // Fallback: extend to next line or reasonable limit
                  const nextNewline = fileContent.indexOf('\n', tagEnd);
                  if (nextNewline !== -1 && nextNewline - tagEnd < 200) {
                    searchEnd = nextNewline;
                  }
                }
              }
            }
            
            const openingTag = fileContent.substring(charPosition, searchEnd + 1);
            console.log('[updateFileWithTailwind] Found opening tag:', openingTag.substring(0, 200));

            // Find className - handle multiple formats:
            // 1. className="..."
            // 2. className={"..."}
            // 3. className={cn("...", ...)}
            // 4. className={cn(`...`, ...)}
            const classMatch = openingTag.match(/className=(?:["']([^"']*)["']|\{["']([^"']*)["']\})/);
            
            // If no simple match, try to find cn() call
            if (!classMatch) {
              // Match cn() with nested parentheses and braces
              const cnPattern = /className=\{cn\(/;
              const cnMatchStart = openingTag.search(cnPattern);
              if (cnMatchStart !== -1) {
                // Find the matching closing brace for className={cn(...)}
                const cnStart = cnMatchStart + 'className={cn('.length;
                let parenCount = 1;
                let cnEnd = -1;
                for (let i = cnStart; i < openingTag.length; i++) {
                  if (openingTag[i] === '(') parenCount++;
                  if (openingTag[i] === ')') {
                    parenCount--;
                    if (parenCount === 0) {
                      cnEnd = i;
                      break;
                    }
                  }
                }
                
                if (cnEnd !== -1) {
                  const cnArgs = openingTag.substring(cnStart, cnEnd);
                  console.log('[updateFileWithTailwind] Found cn() args:', cnArgs.substring(0, 100));
                  
                  // Extract string literals from cn() arguments
                  const stringMatches = Array.from(cnArgs.matchAll(/(?:["']|`)([^"'`]+)(?:["']|`)/g));
                  const extractedClasses: string[] = [];
                  for (const match of stringMatches) {
                    extractedClasses.push(...match[1].split(' ').filter(Boolean));
                  }
                  
                  if (extractedClasses.length > 0) {
                    console.log('[updateFileWithTailwind] Found className in cn() call:', extractedClasses.join(' '));
                    
                    // Remove classes that should be replaced
                    // We need to identify which property each class belongs to and check if it should be removed
                    const filteredClasses = extractedClasses.filter(cls => {
                      // Check if this class should be removed for any of the properties being changed
                      for (const [property] of Object.entries(styleChanges)) {
                        if (shouldRemoveClass(cls, property)) {
                          return false; // Remove this class
                        }
                      }
                      return true; // Keep this class
                    });

                    // Add new classes
                    const newClasses = [...filteredClasses, ...classesToAdd].join(' ');
                    
                    // Reconstruct cn() call - replace the first string argument
                    // Match the first quoted string (could be at start or after whitespace/comma)
                    const firstStringMatch = cnArgs.match(/^\s*(["'`])([^"'`]+)\1/);
                    if (firstStringMatch) {
                      const quote = firstStringMatch[1];
                      const originalContent = firstStringMatch[2];
                      // Replace just the content, preserving the quote and any leading whitespace
                      const leadingWhitespace = cnArgs.substring(0, firstStringMatch.index || 0);
                      const afterFirstArg = cnArgs.substring((firstStringMatch.index || 0) + firstStringMatch[0].length);
                      const newCnArgs = leadingWhitespace + `${quote}${newClasses}${quote}` + afterFirstArg;
                      const replacement = `className={cn(${newCnArgs})}`;
                      
                      // Replace in full content
                      // cnMatchStart is position within openingTag where className={cn( starts
                      // cnEnd is position within openingTag where cn(...) closes (the ')')
                      // The full className={cn(...)} ends at cnEnd + 2 (the ')' and '}')
                      const fullCnStart = charPosition + cnMatchStart;
                      // cnEnd is relative to openingTag start, so add charPosition
                      // Then add 2 for the closing ')' and '}'
                      const fullCnEnd = charPosition + cnEnd + 2;
                      
                      // Verify the replacement by checking what we're replacing
                      const originalText = fileContent.substring(fullCnStart, fullCnEnd);
                      const beforeText = fileContent.substring(Math.max(0, fullCnStart - 20), fullCnStart);
                      const afterText = fileContent.substring(fullCnEnd, Math.min(fileContent.length, fullCnEnd + 20));
                      
                      console.log('[updateFileWithTailwind] Replacing cn() call:', {
                        contextBefore: beforeText,
                        original: originalText,
                        contextAfter: afterText,
                        replacement,
                        fullCnStart,
                        fullCnEnd,
                        originalLength: originalText.length,
                        replacementLength: replacement.length,
                        newClasses,
                        filteredClasses,
                        classesToAdd,
                        classesToRemove,
                      });
                      
                      // Verify the original text matches what we expect
                      if (!originalText.includes('className={cn(')) {
                        console.error('[updateFileWithTailwind] ERROR: Original text does not contain className={cn(, aborting replacement');
                        console.error('[updateFileWithTailwind] Expected to find className={cn( but found:', originalText);
                        // Fall through to other strategies
                      } else {
                        const result = fileContent.substring(0, fullCnStart) +
                               replacement +
                               fileContent.substring(fullCnEnd);
                        
                        // Verify the replacement worked
                        const expectedLength = fileContent.length - originalText.length + replacement.length;
                        if (result.length === expectedLength) {
                          console.log('[updateFileWithTailwind] Replacement successful, file length changed correctly');
                          
                          // Extract the replaced section to verify
                          const replacedSection = result.substring(fullCnStart, fullCnStart + replacement.length);
                          console.log('[updateFileWithTailwind] Replaced section for verification:', replacedSection);
                          
                          // Extract just the first string argument from the cn() call to verify
                          // This is what we actually replaced, not the entire className attribute
                          const firstStringMatch = newCnArgs.match(/^\s*(["'`])([^"'`]+)\1/);
                          const replacedClassesString = firstStringMatch ? firstStringMatch[2] : '';
                          console.log('[updateFileWithTailwind] Replaced classes string:', replacedClassesString);
                          
                          // Verify the replacement actually contains our new class(es)
                          const allNewClassesFound = classesToAdd.every(cls => replacedClassesString.includes(cls));
                          
                          // Verify old classes with matching prefixes are removed from the replaced classes string
                          // Only check the classes we actually replaced, not the entire className attribute
                          const oldClassesRemoved = classesToRemove.every(prefix => {
                            // Check if any class starting with this prefix still exists in the replaced classes
                            const regex = new RegExp(`\\b${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\s"']+`, 'g');
                            const matches = replacedClassesString.match(regex);
                            if (matches) {
                              // Filter out the new classes we just added
                              const oldMatches = matches.filter(m => !classesToAdd.includes(m));
                              if (oldMatches.length > 0) {
                                console.warn(`[updateFileWithTailwind] Found old classes with prefix '${prefix}' in replaced string:`, oldMatches);
                              }
                              return oldMatches.length === 0;
                            }
                            return true;
                          });
                          
                          if (allNewClassesFound && oldClassesRemoved) {
                            console.log('[updateFileWithTailwind] Verified: All new classes found and old classes removed');
                            // Log a snippet of the result to verify
                            const resultSnippet = result.substring(Math.max(0, fullCnStart - 30), Math.min(result.length, fullCnStart + replacement.length + 30));
                            console.log('[updateFileWithTailwind] Result snippet:', resultSnippet);
                          } else {
                            console.warn('[updateFileWithTailwind] WARNING: Verification failed');
                            console.warn('[updateFileWithTailwind] All new classes found:', allNewClassesFound);
                            console.warn('[updateFileWithTailwind] Old classes removed:', oldClassesRemoved);
                            console.warn('[updateFileWithTailwind] Expected classes to add:', classesToAdd);
                            console.warn('[updateFileWithTailwind] Prefixes to remove:', classesToRemove);
                            console.warn('[updateFileWithTailwind] Replaced classes string:', replacedClassesString);
                            console.warn('[updateFileWithTailwind] Original text:', originalText);
                            console.warn('[updateFileWithTailwind] Replacement:', replacement);
                          }
                          return result;
                        } else {
                          console.error('[updateFileWithTailwind] Replacement length mismatch:', {
                            originalLength: fileContent.length,
                            resultLength: result.length,
                            expectedLength: fileContent.length - originalText.length + replacement.length,
                          });
                          // Fall through to other strategies
                        }
                      }
                    } else {
                      console.warn('[updateFileWithTailwind] Could not match first string argument in cn() call');
                      console.warn('[updateFileWithTailwind] cnArgs:', cnArgs);
                      console.warn('[updateFileWithTailwind] Attempted regex:', /^\s*(["'`])([^"'`]+)\1/);
                    }
                  } else {
                    console.warn('[updateFileWithTailwind] Could not find closing parenthesis for cn() call');
                  }
                } else {
                  console.warn('[updateFileWithTailwind] Could not find cn() pattern in opening tag');
                }
              }
            }

            if (classMatch) {
              const currentClasses = (classMatch[1] || classMatch[2] || '').split(' ').filter(Boolean);
              console.log('[updateFileWithTailwind] Found className at exact position:', currentClasses.join(' '));

              // Remove classes that should be replaced
              const filteredClasses = currentClasses.filter(cls => {
                for (const [property] of Object.entries(styleChanges)) {
                  if (shouldRemoveClass(cls, property)) {
                    console.log(`[updateFileWithTailwind] Removing class '${cls}' because it matches property '${property}'`);
                    return false;
                  }
                }
                return true;
              });

              console.log('[updateFileWithTailwind] Filtered classes:', filteredClasses.join(' '));
              console.log('[updateFileWithTailwind] Classes to add:', classesToAdd.join(' '));

              // Add new classes
              const newClasses = [...filteredClasses, ...classesToAdd].join(' ');
              console.log('[updateFileWithTailwind] Final new classes:', newClasses);
              
              const replacement = classMatch[0].includes('{')
                ? `className={"${newClasses}"}`
                : `className="${newClasses}"`;

              console.log('[updateFileWithTailwind] Replacement:', replacement);
              console.log('[updateFileWithTailwind] Original match:', classMatch[0]);

              // Replace className in the opening tag
              const updatedTag = openingTag.replace(classMatch[0], replacement);

              // Replace in full content
              return fileContent.substring(0, charPosition) +
                     updatedTag +
                     fileContent.substring(searchEnd + 1);
            } else {
              console.log('[updateFileWithTailwind] No className found - adding new className attribute');

              // No className found - need to add one
              // Find where to insert the className (after the tag name)
              const tagNameMatch = openingTag.match(/^<(\w+)/);
              if (tagNameMatch) {
                const tagName = tagNameMatch[1];
                const insertPosition = charPosition + tagName.length + 1; // +1 for '<'

                // Create the new className attribute
                const newClasses = classesToAdd.join(' ');
                const classNameAttr = ` className="${newClasses}"`;

                console.log(`[updateFileWithTailwind] Inserting className="${newClasses}" at position ${insertPosition}`);

                // Insert the className attribute
                return fileContent.substring(0, insertPosition) +
                       classNameAttr +
                       fileContent.substring(insertPosition);
              } else {
                console.warn('[updateFileWithTailwind] Could not find tag name in opening tag');
              }
            }
          }
        } else {
          console.warn(`[updateFileWithTailwind] Expected '<' at position ${charPosition}, found '${fileContent[charPosition]}'`);
          // Show context
          const context = fileContent.substring(Math.max(0, charPosition - 20), charPosition + 20);
          console.log('[updateFileWithTailwind] Context:', JSON.stringify(context));
        }
      }
    } else {
      console.warn('[updateFileWithTailwind] Invalid shipper ID format:', elementInfo.shipperId);
    }
  }

  // Strategy 1: Find by exact current classes match (exact order)
  // Skip this strategy if element has no current classes
  if (elementInfo.currentClasses.length > 0) {
    const classesStr = elementInfo.currentClasses.join(' ');
    const escapedClasses = classesStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const exactPattern = new RegExp(
      `className=(?:["']${escapedClasses}["']|\\{["']${escapedClasses}["']\\})`,
      'g'
    );

    if (exactPattern.test(fileContent)) {
    console.log('[updateFileWithTailwind] Found exact match');
    // Found exact match, update it
    const filteredClasses = elementInfo.currentClasses.filter(cls => {
      for (const [property] of Object.entries(styleChanges)) {
        if (shouldRemoveClass(cls, property)) {
          return false;
        }
      }
      return true;
    });

    const newClasses = [...filteredClasses, ...classesToAdd].join(' ');
    const replacement = `className="${newClasses}"`;

    return fileContent.replace(exactPattern, replacement);
    }
  }

  // Strategy 2: Find element that contains ALL our target classes (superset match)
  // Skip this strategy if element has no current classes
  if (elementInfo.currentClasses.length > 0) {
    // The file element might have additional classes, but should have all our classes
    const classNamePattern = /className=(?:["']([^"']*)["']|\{["']([^"']*)["']\})/g;
    const matches: Array<{ match: RegExpExecArray; classes: string[]; matchingCount: number }> = [];
    let match;

    // Reset lastIndex
    classNamePattern.lastIndex = 0;

    while ((match = classNamePattern.exec(fileContent)) !== null) {
      const matchedClasses = (match[1] || match[2] || '').split(' ').filter(Boolean);

      // Calculate how many of our target classes are in this element
      const matchingCount = elementInfo.currentClasses.filter(cls =>
        matchedClasses.includes(cls)
      ).length;

      if (matchingCount > 0) {
        matches.push({ match, classes: matchedClasses, matchingCount });
      }
    }

  console.log('[updateFileWithTailwind] Found', matches.length, 'potential matches');
  matches.forEach((m, i) => {
    console.log(`  Match ${i + 1}: ${m.matchingCount}/${elementInfo.currentClasses.length} classes match:`, m.classes.join(' '));
  });

  // Sort by number of matching classes (descending)
  matches.sort((a, b) => b.matchingCount - a.matchingCount);

  // Take the best match if it has all our classes
  if (matches.length > 0 && matches[0].matchingCount === elementInfo.currentClasses.length) {
    console.log('[updateFileWithTailwind] Using best match with all classes');
    const bestMatch = matches[0];
    const currentClasses = bestMatch.classes;

    // Remove classes that should be replaced
    const filteredClasses = currentClasses.filter(cls => {
      for (const [property] of Object.entries(styleChanges)) {
        if (shouldRemoveClass(cls, property)) {
          return false;
        }
      }
      return true;
    });

    // Add new classes
    const newClasses = [...filteredClasses, ...classesToAdd].join(' ');
    const replacement = `className="${newClasses}"`;

    // Replace only this specific match
    const fullMatch = bestMatch.match[0];
    const matchIndex = bestMatch.match.index!;

    return fileContent.substring(0, matchIndex) +
           replacement +
           fileContent.substring(matchIndex + fullMatch.length);
  }

  // Try partial match if we have at least 70% of classes
  if (matches.length > 0) {
    const score = matches[0].matchingCount / elementInfo.currentClasses.length;
    if (score >= 0.7) {
      console.log(`[updateFileWithTailwind] Using partial match with ${Math.round(score * 100)}% match`);
      const bestMatch = matches[0];
      const currentClasses = bestMatch.classes;

      // Remove classes that should be replaced
      const filteredClasses = currentClasses.filter(cls => {
        for (const [property] of Object.entries(styleChanges)) {
          if (shouldRemoveClass(cls, property)) {
            return false;
          }
        }
        return true;
      });

      // Add new classes
      const newClasses = [...filteredClasses, ...classesToAdd].join(' ');
      const replacement = `className="${newClasses}"`;

      // Replace only this specific match
      const fullMatch = bestMatch.match[0];
      const matchIndex = bestMatch.match.index!;

      return fileContent.substring(0, matchIndex) +
             replacement +
             fileContent.substring(matchIndex + fullMatch.length);
    }
    }
  }

  // No match found
  console.error('[updateFileWithTailwind] No suitable match found');
  console.error('[updateFileWithTailwind] Element info:', {
    shipperId: elementInfo.shipperId,
    currentClasses: elementInfo.currentClasses,
    componentName: elementInfo.componentName,
  });

  let errorMessage: string;
  if (!elementInfo.shipperId && elementInfo.currentClasses.length === 0) {
    errorMessage = 'Cannot find element: The element has no shipper ID and no CSS classes. The visual editor plugin may not be installed correctly in this project.';
  } else if (!elementInfo.shipperId) {
    errorMessage = `Cannot find element with classes: ${elementInfo.currentClasses.join(', ')}. The element may have been modified. Please try selecting it again.`;
  } else {
    errorMessage = `Cannot find element at position specified by shipperId: ${elementInfo.shipperId}. The file structure may have changed.`;
  }
  throw new Error(errorMessage);
}

/**
 * Validate JSX/TSX file content for specific corruption issues
 * Only checks for the exact corruption patterns we're trying to prevent
 * Returns validation errors if any are found
 */
export function validateJSXContent(content: string): string[] {
  const errors: string[] = [];

  // Check for the specific corruption pattern: /tagName> without the opening <
  // This is the exact issue that was happening (e.g., /div> instead of </div>)
  // Use word boundary and more specific pattern to avoid false positives
  const malformedClosingTagPattern = /[\s\n\r;,]\/[a-zA-Z][a-zA-Z0-9]*>/g;
  const matches = content.match(malformedClosingTagPattern);

  if (matches) {
    // Filter out false positives like comments or within strings
    const realIssues = matches.filter(match => {
      // Get the position of this match in the content
      const index = content.indexOf(match);
      if (index === -1) return false;

      // Check if it's preceded by a < (which would make it valid: </div>)
      const charBefore = content[index - 1];
      if (charBefore === '<') return false;

      // This is a real malformed closing tag
      return true;
    });

    if (realIssues.length > 0) {
      errors.push(`Malformed closing tags detected (missing opening '<'): ${realIssues.map(m => m.trim()).join(', ')}`);
    }
  }

  // Check for duplicate className attributes in the same tag
  // This is a simpler check that's less prone to false positives
  const duplicateClassNamePattern = /<[a-zA-Z][^>]*\sclassName\s*=\s*[^>]*\sclassName\s*=/g;
  if (duplicateClassNamePattern.test(content)) {
    errors.push('Duplicate className attribute detected in a single element');
  }

  return errors;
}

/**
 * Update text content of an element in a file
 * Finds the element by selector information and updates its text content
 */
export function updateFileWithText(
  fileContent: string,
  selector: string,
  elementInfo: {
    componentName?: string;
    textContent?: string;
    currentClasses: string[];
    shipperId?: string;
    isRepeated?: boolean;
    instanceIndex?: number;
    totalInstances?: number;
  },
  newTextContent: string
): string {
  console.log('[updateFileWithText] Looking for element to update text content');
  console.log('[updateFileWithText] Shipper ID:', elementInfo.shipperId || 'none');
  console.log('[updateFileWithText] New text content:', newTextContent);

  // STRATEGY 0: Precise line:column matching using shipper ID
  // Shipper ID format: "filename:line:column" where line:column is the exact position of the opening tag
  // Note: filename may or may not include the extension (e.g., "App:149:10" or "App.tsx:149:10")
  if (elementInfo.shipperId) {
    console.log('[updateFileWithText] Using shipper ID for precise matching:', elementInfo.shipperId);

    const idParts = elementInfo.shipperId.split(':');
    if (idParts.length === 3) {
      const targetLine = parseInt(idParts[1]) - 1; // Convert to 0-based
      const targetColumn = parseInt(idParts[2]);

      const lines = fileContent.split('\n');

      if (targetLine >= 0 && targetLine < lines.length) {
        // Calculate absolute character position
        let charPosition = 0;
        for (let i = 0; i < targetLine; i++) {
          charPosition += lines[i].length + 1; // +1 for newline
        }
        charPosition += targetColumn;

        // Find the opening tag
        if (fileContent[charPosition] === '<') {
          // Find the end of the opening tag (handle multi-line and arrow functions)
          // We need to find the '>' that closes the opening tag, not one inside an attribute
          let tagEnd = -1;
          let depth = 0;
          let inString = false;
          let stringChar = '';

          for (let i = charPosition; i < fileContent.length; i++) {
            const char = fileContent[i];
            const prevChar = i > 0 ? fileContent[i - 1] : '';

            // Track string boundaries
            if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
              if (!inString) {
                inString = true;
                stringChar = char;
              } else if (char === stringChar) {
                inString = false;
                stringChar = '';
              }
            }

            // Track JSX expression depth (braces)
            if (!inString) {
              if (char === '{') depth++;
              if (char === '}') depth--;

              // Found the closing '>' at depth 0 (not inside JSX expression)
              if (char === '>' && depth === 0) {
                tagEnd = i;
                break;
              }
            }
          }

          if (tagEnd !== -1) {
            // Find the closing tag for this element
            // For self-closing tags, there's no text content
            const openingTag = fileContent.substring(charPosition, tagEnd + 1);

            // Check if it's self-closing
            if (openingTag.endsWith('/>')) {
              console.warn('[updateFileWithText] Element is self-closing, cannot update text content');
              throw new Error('Cannot update text content: element is self-closing.');
            }

            // Find the matching closing tag
            const tagNameMatch = openingTag.match(/<(\w+)/);
            if (tagNameMatch) {
              const tagName = tagNameMatch[1];
              
              // Find the closing tag
              let depth = 1;
              let pos = tagEnd + 1;
              let closingTagPos = -1;

              while (pos < fileContent.length && depth > 0) {
                const nextOpen = fileContent.indexOf(`<${tagName}`, pos);
                const nextClose = fileContent.indexOf(`</${tagName}>`, pos);

                if (nextClose === -1) break;

                if (nextOpen !== -1 && nextOpen < nextClose) {
                  depth++;
                  pos = nextOpen + 1;
                } else {
                  depth--;
                  if (depth === 0) {
                    closingTagPos = nextClose;
                    break;
                  }
                  pos = nextClose + 1;
                }
              }

              if (closingTagPos !== -1) {
                // Extract content between tags
                const textStart = tagEnd + 1;
                const textEnd = closingTagPos;
                const innerContent = fileContent.substring(textStart, textEnd);

                console.log('[updateFileWithText] Found inner content:', innerContent.substring(0, 100));

                // Parse the inner content to identify text nodes vs JSX elements
                // We need to replace only the text content, preserving JSX elements (like icons)

                // Strategy: Find all JSX elements (< ... >) and text segments
                const segments: Array<{ type: 'jsx' | 'text', content: string, start: number, end: number }> = [];
                let i = 0;

                while (i < innerContent.length) {
                  // Check if we're at the start of a JSX element
                  if (innerContent[i] === '<') {
                    // Find the end of this JSX element (could be self-closing or have children)
                    const elementStart = i;

                    // Find tag name
                    const tagMatch = innerContent.substring(i).match(/^<(\/?)(\w+)/);
                    if (tagMatch) {
                      const isClosing = tagMatch[1] === '/';
                      const tagName = tagMatch[2];

                      if (isClosing) {
                        // Closing tag - find the >
                        const closeEnd = innerContent.indexOf('>', i);
                        if (closeEnd !== -1) {
                          segments.push({
                            type: 'jsx',
                            content: innerContent.substring(elementStart, closeEnd + 1),
                            start: elementStart,
                            end: closeEnd + 1
                          });
                          i = closeEnd + 1;
                          continue;
                        }
                      } else {
                        // Opening tag - find the matching closing tag
                        let depth = 0;
                        let inString = false;
                        let stringChar = '';
                        let elementEnd = -1;

                        for (let j = i; j < innerContent.length; j++) {
                          const char = innerContent[j];
                          const prevChar = j > 0 ? innerContent[j - 1] : '';

                          // Track strings
                          if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
                            if (!inString) {
                              inString = true;
                              stringChar = char;
                            } else if (char === stringChar) {
                              inString = false;
                              stringChar = '';
                            }
                          }

                          if (!inString) {
                            if (char === '{') depth++;
                            if (char === '}') depth--;

                            // Check for self-closing tag
                            if (char === '>' && prevChar === '/' && depth === 0) {
                              elementEnd = j + 1;
                              break;
                            }

                            // Check for end of opening tag
                            if (char === '>' && depth === 0) {
                              // Now find the matching closing tag
                              const openTagEnd = j;
                              let tagDepth = 1;
                              let pos = j + 1;

                              while (pos < innerContent.length && tagDepth > 0) {
                                const nextOpen = innerContent.indexOf(`<${tagName}`, pos);
                                const nextClose = innerContent.indexOf(`</${tagName}>`, pos);

                                if (nextClose === -1) break;

                                if (nextOpen !== -1 && nextOpen < nextClose) {
                                  tagDepth++;
                                  pos = nextOpen + tagName.length + 1;
                                } else {
                                  tagDepth--;
                                  if (tagDepth === 0) {
                                    elementEnd = nextClose + `</${tagName}>`.length;
                                    break;
                                  }
                                  pos = nextClose + 1;
                                }
                              }
                              break;
                            }
                          }
                        }

                        if (elementEnd !== -1) {
                          segments.push({
                            type: 'jsx',
                            content: innerContent.substring(elementStart, elementEnd),
                            start: elementStart,
                            end: elementEnd
                          });
                          i = elementEnd;
                          continue;
                        }
                      }
                    }
                  }

                  // Not a JSX element - find the next < or end of content
                  const nextJsx = innerContent.indexOf('<', i);
                  const textEnd = nextJsx !== -1 ? nextJsx : innerContent.length;

                  if (textEnd > i) {
                    const textContent = innerContent.substring(i, textEnd);
                    // Only add non-whitespace text segments
                    if (textContent.trim().length > 0) {
                      segments.push({
                        type: 'text',
                        content: textContent,
                        start: i,
                        end: textEnd
                      });
                    }
                    i = textEnd;
                  } else {
                    i++;
                  }
                }

                console.log('[updateFileWithText] Parsed segments:', segments.map(s => ({ type: s.type, content: s.content.substring(0, 30) })));

                // Replace only text segments with new content
                // Preserve all JSX elements and their positions
                let newInnerContent = '';
                let hasTextSegment = false;

                for (const segment of segments) {
                  if (segment.type === 'jsx') {
                    newInnerContent += segment.content;
                  } else {
                    // Replace text segment with new text
                    if (!hasTextSegment) {
                      // First text segment - replace with new content
                      newInnerContent += ` ${newTextContent} `;
                      hasTextSegment = true;
                    }
                    // Skip other text segments (in case there are multiple)
                  }
                }

                // If no text segment was found, just add the new text
                if (!hasTextSegment) {
                  newInnerContent = ` ${newTextContent} `;
                }

                console.log('[updateFileWithText] New inner content:', newInnerContent);
                console.log('[updateFileWithText] Text replacement verification:', {
                  originalInnerContent: innerContent.substring(0, 100),
                  newInnerContent: newInnerContent.substring(0, 100),
                  containsNewText: newInnerContent.includes(newTextContent),
                  textStart,
                  textEnd
                });

                // Replace content between tags
                const result = fileContent.substring(0, textStart) +
                       newInnerContent +
                       fileContent.substring(textEnd);
                       
                console.log('[updateFileWithText] Replacement result verification:', {
                  resultLength: result.length,
                  originalLength: fileContent.length,
                  containsNewText: result.includes(newTextContent),
                  resultPreview: result.substring(textStart, textStart + newInnerContent.length + 50)
                });
                
                return result;
              }
            }
          }
        }
      }
    }
  }

  // STRATEGY 1: Find by classes and update text content
  // This is a fallback - less reliable but works if shipper ID is not available
  const classesStr = elementInfo.currentClasses.join(' ');
  const escapedClasses = classesStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const classNamePattern = new RegExp(
    `className=(?:["']${escapedClasses}["']|\\{["']${escapedClasses}["']\\})`,
    'g'
  );

  let match;
  while ((match = classNamePattern.exec(fileContent)) !== null) {
    const matchIndex = match.index;
    
    // Find the opening tag that contains this className
    let tagStart = matchIndex;
    while (tagStart > 0 && fileContent[tagStart] !== '<') {
      tagStart--;
    }

    if (tagStart >= 0) {
      const tagEnd = fileContent.indexOf('>', tagStart);
      if (tagEnd !== -1) {
        const openingTag = fileContent.substring(tagStart, tagEnd + 1);
        
        // Check if self-closing
        if (openingTag.endsWith('/>')) {
          continue; // Try next match
        }

        // Find tag name
        const tagNameMatch = openingTag.match(/<(\w+)/);
        if (tagNameMatch) {
          const tagName = tagNameMatch[1];
          
          // Find closing tag
          let depth = 1;
          let pos = tagEnd + 1;
          let closingTagPos = -1;

          while (pos < fileContent.length && depth > 0) {
            const nextOpen = fileContent.indexOf(`<${tagName}`, pos);
            const nextClose = fileContent.indexOf(`</${tagName}>`, pos);

            if (nextClose === -1) break;

            if (nextOpen !== -1 && nextOpen < nextClose) {
              depth++;
              pos = nextOpen + 1;
            } else {
              depth--;
              if (depth === 0) {
                closingTagPos = nextClose;
                break;
              }
              pos = nextClose + 1;
            }
          }

          if (closingTagPos !== -1) {
            const textStart = tagEnd + 1;
            const textEnd = closingTagPos;
            
            // Replace text content
            return fileContent.substring(0, textStart) +
                   ` ${newTextContent} ` +
                   fileContent.substring(textEnd);
          }
        }
      }
    }
  }

  // No match found
  console.error('[updateFileWithText] No suitable match found');
  throw new Error(`Cannot find element to update text content. Please try selecting the element again.`);
}
