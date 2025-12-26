import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [{
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]
}, {
  ignores: [
    "**/generated/**/*",
    "src/generated/**/*",
    "**/prisma/generated/**/*",
    "**/.next/**/*",
    "**/node_modules/**/*",
  ],
}, ...compat.extends("next/core-web-vitals", "next/typescript"), {
  rules: {
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "quotes": "off",              // Disable quote style enforcement
    "@typescript-eslint/quotes": "off", // Disable TS quote style enforcement  
    "jsx-quotes": "off",          // Disable JSX quote style enforcement
  }
}];

export default eslintConfig;
