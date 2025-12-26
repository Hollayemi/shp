// Mock data generator for common patterns
const generateMockData = (variableName: string): string => {
  const lowerName = variableName.toLowerCase();

  // Common patterns
  if (lowerName.includes("task")) {
    return "Sample Task";
  }

  if (lowerName.includes("user")) {
    return "John Doe";
  }

  if (lowerName.includes("product")) {
    return "Sample Product";
  }

  if (lowerName.includes("search") || lowerName.includes("query")) {
    return "";
  }

  if (lowerName.includes("stats")) {
    return "10";
  }

  if (lowerName.includes("title")) {
    return "Sample Title";
  }

  if (lowerName.includes("description")) {
    return "Sample description text";
  }

  if (lowerName.includes("name")) {
    return "Sample Name";
  }

  if (lowerName.includes("email")) {
    return "sample@example.com";
  }

  if (lowerName.includes("price")) {
    return "$99.99";
  }

  if (
    lowerName.includes("count") ||
    lowerName.includes("total") ||
    lowerName.includes("size")
  ) {
    return "5";
  }

  // Default values
  if (
    lowerName.includes("open") ||
    lowerName.includes("show") ||
    lowerName.includes("visible")
  ) {
    return "false";
  }

  if (
    lowerName.includes("list") ||
    lowerName.includes("items") ||
    lowerName.includes("array")
  ) {
    return "[]";
  }

  // String defaults
  return `Sample ${variableName}`;
};

// Function to replace JSX expressions with mock data
const replaceJSXExpressions = (jsxContent: string): string => {
  // Replace {variable} with mock data
  return jsxContent.replace(/\{([^}]+)\}/g, (match, expression) => {
    const trimmed = expression.trim();

    // Handle function calls - just remove them
    if (trimmed.includes("(") && trimmed.includes(")")) {
      return "";
    }

    // Handle object property access
    if (trimmed.includes(".")) {
      const parts = trimmed.split(".");
      const rootVar = parts[0];
      return generateMockData(rootVar);
    }

    // Handle simple variables
    return generateMockData(trimmed);
  });
};

// Function to clean up JSX for static rendering
const cleanJSXForStaticRender = (jsxContent: string): string => {
  let cleaned = jsxContent;

  // Remove comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
  cleaned = cleaned.replace(/\/\/.*$/gm, "");

  // Remove event handlers and function calls
  cleaned = cleaned.replace(/\s+on\w+=\{[^}]+\}/g, "");
  cleaned = cleaned.replace(/\s+onClick=\{[^}]+\}/g, "");
  cleaned = cleaned.replace(/\s+onChange=\{[^}]+\}/g, "");
  cleaned = cleaned.replace(/\s+onSubmit=\{[^}]+\}/g, "");
  cleaned = cleaned.replace(/\s+onKeyDown=\{[^}]+\}/g, "");
  cleaned = cleaned.replace(/\s+onKeyUp=\{[^}]+\}/g, "");
  cleaned = cleaned.replace(/\s+onFocus=\{[^}]+\}/g, "");
  cleaned = cleaned.replace(/\s+onBlur=\{[^}]+\}/g, "");

  // Remove conditional rendering that might break
  cleaned = cleaned.replace(/\s*&&\s*[^<]+/g, "");
  cleaned = cleaned.replace(/\s*\?\s*[^:]+:\s*[^<]+/g, "");

  // Remove complex expressions
  cleaned = cleaned.replace(/\{[^}]*\.[^}]*\}/g, "");

  // Replace JSX expressions with mock data
  cleaned = replaceJSXExpressions(cleaned);

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
};

export const transformJSXToHTML = (jsxContent: string): string => {
  try {
    // Clean the JSX for static rendering
    const cleanedJSX = cleanJSXForStaticRender(jsxContent);

    console.log("Cleaned JSX:", cleanedJSX.substring(0, 300) + "...");

    // Return the cleaned JSX as HTML (it should already be valid HTML)
    return cleanedJSX;
  } catch (error) {
    console.error("JSX transformation error:", error);
    // Fallback: return the original content
    return jsxContent;
  }
};
