/**
 * Removes common leading whitespace from all lines in a string.
 * Useful for template literals with indentation.
 *
 * @example
 * const text = stripIndents`
 *   Hello
 *     World
 * `;
 * // Returns: "Hello\n  World"
 */
export function stripIndents(
  strings: TemplateStringsArray | string,
  ...values: unknown[]
): string {
  // Handle both template literal and regular string usage
  let text: string;
  if (typeof strings === "string") {
    text = strings;
  } else {
    text = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "");
  }

  // Split into lines
  const lines = text.split("\n");

  // Remove leading/trailing empty lines
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  // Find minimum indentation (ignoring empty lines)
  const minIndent = lines.reduce((min, line) => {
    if (line.trim() === "") return min;
    const indent = line.match(/^[ \t]*/)?.[0].length ?? 0;
    return Math.min(min, indent);
  }, Infinity);

  // Remove the common indentation from all lines
  const dedented = lines.map((line) => {
    if (line.trim() === "") return "";
    return line.slice(minIndent);
  });

  return dedented.join("\n");
}
