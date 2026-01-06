// Canonical source for vite-plugin-shipper-ids.ts
// Keep this in sync with plugins/vite-plugin-shipper-ids.template.ts
// When updating, bump the version in both places

export const SHIPPER_IDS_PLUGIN_VERSION = "2025-11-25";

// JavaScript version for Base44 projects (no TypeScript syntax)
export const SHIPPER_IDS_PLUGIN_CANONICAL_JS = `// shipper-ids-plugin-version: 2025-11-25
// NOTE: Keep this version in sync with the API's expected version
export const SHIPPER_IDS_PLUGIN_VERSION = "2025-11-25";

import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";
import path from "path";

// Handle default exports for CommonJS modules
const traverse = _traverse.default || _traverse;
const generate = _generate.default || _generate;

export function shipperIdsPlugin() {
  let root = "";

  return {
    name: "vite-plugin-shipper-ids",
    enforce: "pre",

    configResolved(config) {
      root = config.root;
    },

    transform(code, id) {
      // Only process in dev mode
      if (process.env.NODE_ENV !== "development") {
        return null;
      }

      // Only process JSX files
      if (!/\\.jsx$/.test(id)) {
        return null;
      }

      try {
        // Parse and transform
        const ast = parse(code, {
          sourceType: "module",
          plugins: ["jsx"],
        });

        let hasChanges = false;

        // Get relative path from src directory
        const relativePath = path.relative(path.join(root, "src"), id);
        const sourceFile = relativePath.replace(/\\.jsx$/, "");

        traverse(ast, {
          JSXElement(nodePath) {
            const openingElement = nodePath.node.openingElement;
            const elementName = openingElement.name;

            // Check if this is a custom component (PascalCase) or native element
            const isCustomComponent =
              t.isJSXIdentifier(elementName) &&
              /^[A-Z]/.test(elementName.name);

            // For custom components: always add ID (tracks usage site)
            // For native elements: only add ID if element has className
            if (!isCustomComponent) {
              const hasClassName = openingElement.attributes.some(
                (attr) =>
                  t.isJSXAttribute(attr) &&
                  t.isJSXIdentifier(attr.name) &&
                  attr.name.name === "className"
              );

              if (!hasClassName) return;
            }

            // Check if already has data-shipper-id
            const hasId = openingElement.attributes.some(
              (attr) =>
                t.isJSXAttribute(attr) &&
                t.isJSXIdentifier(attr.name) &&
                attr.name.name === "data-shipper-id"
            );

            if (hasId) return;

            // Skip elements with spread attributes
            const hasSpread = openingElement.attributes.some(
              (attr) => t.isJSXSpreadAttribute(attr)
            );

            if (hasSpread) return;

            // Generate stable ID based on location
            const loc = openingElement.loc;
            if (!loc) return;

            const shipperId = \`\${sourceFile}:\${loc.start.line}:\${loc.start.column}\`;

            // Add data-shipper-id attribute
            openingElement.attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier("data-shipper-id"),
                t.stringLiteral(shipperId)
              )
            );

            hasChanges = true;
          },
        });

        if (!hasChanges) return null;

        const output = generate(ast, {}, code);
        return {
          code: output.code,
          map: output.map,
        };
      } catch (error) {
        console.error(
          "[shipper-ids-plugin] Error transforming file:",
          id,
          error
        );
        return null;
      }
    },
  };
}
`;

export const SHIPPER_IDS_PLUGIN_CANONICAL = `// shipper-ids-plugin-version: 2025-11-25
// NOTE: Keep this version in sync with the API's expected version in \`ai-tools.ts\`
export const SHIPPER_IDS_PLUGIN_VERSION = "2025-11-25";

import { Plugin } from "vite";
import { parse } from "@babel/parser";
import _traverse, { NodePath } from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";
import path from "path";

// Handle default exports for CommonJS modules
type TraverseModule = typeof _traverse & { default?: typeof _traverse };
type GenerateModule = typeof _generate & { default?: typeof _generate };

const traverse = (((_traverse as TraverseModule).default || _traverse) as typeof _traverse);
const generate = (((_generate as GenerateModule).default || _generate) as typeof _generate);

export function shipperIdsPlugin(): Plugin {
  let root = "";

  return {
    name: "vite-plugin-shipper-ids",
    enforce: "pre",

    configResolved(config) {
      root = config.root;
    },

    transform(code, id) {
      // Only process in dev mode
      if (process.env.NODE_ENV !== "development") {
        return null;
      }

      // Only process JSX/TSX files
      if (!/\\.[jt]sx$/.test(id)) {
        return null;
      }

      try {
        // Parse and transform
        const ast = parse(code, {
          sourceType: "module",
          plugins: ["jsx", "typescript"],
        });

        let hasChanges = false;

        // Get relative path from src directory
        const relativePath = path.relative(path.join(root, "src"), id);
        const sourceFile = relativePath.replace(/\\.[jt]sx$/, "");

        traverse(ast, {
          JSXElement(path: NodePath<t.JSXElement>) {
            const { openingElement } = path.node;
            const elementName = openingElement.name;

            // Check if this is a custom component (PascalCase) or native element
            const isCustomComponent =
              t.isJSXIdentifier(elementName) &&
              /^[A-Z]/.test(elementName.name);

            // For custom components: always add ID (tracks usage site)
            // For native elements: only add ID if element has className
            if (!isCustomComponent) {
              const hasClassName = openingElement.attributes.some(
                (attr: t.JSXAttribute | t.JSXSpreadAttribute) =>
                  t.isJSXAttribute(attr) &&
                  t.isJSXIdentifier(attr.name) &&
                  attr.name.name === "className"
              );

              if (!hasClassName) return;
            }

            // Check if already has data-shipper-id
            const hasId = openingElement.attributes.some(
              (attr: t.JSXAttribute | t.JSXSpreadAttribute) =>
                t.isJSXAttribute(attr) &&
                t.isJSXIdentifier(attr.name) &&
                attr.name.name === "data-shipper-id"
            );

            if (hasId) return;

            // Skip elements with spread attributes - they pass through props from parent
            // (e.g., <Comp {...props} /> in wrapper components)
            const hasSpread = openingElement.attributes.some(
              (attr: t.JSXAttribute | t.JSXSpreadAttribute) =>
                t.isJSXSpreadAttribute(attr)
            );

            if (hasSpread) return;

            // Generate stable ID based on location with full relative path
            const loc = openingElement.loc;
            if (!loc) return;

            const shipperId = \`\${sourceFile}:\${loc.start.line}:\${loc.start.column}\`;

            // Add data-shipper-id attribute
            openingElement.attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier("data-shipper-id"),
                t.stringLiteral(shipperId)
              )
            );

            hasChanges = true;
          },
        });

        if (!hasChanges) return null;

        const output = generate(ast, {}, code);
        return {
          code: output.code,
          map: output.map,
        };
      } catch (error) {
        console.error(
          "[shipper-ids-plugin] Error transforming file:",
          id,
          error
        );
        return null;
      }
    },
  };
}
`;
