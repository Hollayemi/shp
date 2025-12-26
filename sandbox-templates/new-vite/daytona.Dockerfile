# Simpler Dockerfile
FROM node:22-slim

# Install necessary tools
RUN apt-get update && apt-get install -y bash curl && rm -rf /var/lib/apt/lists/*

# Install dependencies and customize sandbox
WORKDIR /home/user

# Make directory writable (this is crucial)
RUN chmod -R 777 /home/user

# Set up Vite with React + TypeScript
RUN npm create vite@latest . -- --template react-ts

# Clean up boilerplate files
RUN rm -rf ./src/assets/* \
    && rm -f ./src/App.css \
    && rm -f ./public/vite.svg \
    && echo 'import React from "react";\n\nconst App: React.FC = () => {\n  return (\n    <div className="flex min-h-screen items-center justify-center">\n      <h1 className="text-2xl font-bold">Your App</h1>\n    </div>\n  );\n};\n\nexport default App;' > ./src/App.tsx \
    && echo 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);' > ./src/main.tsx

# Install all dependencies
RUN npm install

# Install shadcn dependencies
RUN npm install tailwindcss @tailwindcss/vite lucide-react framer-motion -y
RUN npm install -D @types/node

# Create tailwind.config.js for Tailwind v4 (with proper path)
RUN echo 'export default {\n  content: [\n    "./index.html",\n    "./src/**/*.{js,ts,jsx,tsx}",\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}' > ./tailwind.config.js

# Create postcss.config.js for Tailwind v4
RUN echo 'export default {\n  plugins: {},\n}' > ./postcss.config.js

# Update vite.config.ts to use the Tailwind plugin, path alias and include allowedHosts
RUN echo 'import path from "path"\nimport tailwindcss from "@tailwindcss/vite"\nimport react from "@vitejs/plugin-react"\nimport { defineConfig } from "vite"\n\nexport default defineConfig({\n  plugins: [react(), tailwindcss()],\n  resolve: {\n    alias: {\n      "@": path.resolve(__dirname, "./src"),\n    },\n  },\n  server: {\n    host: true,\n    allowedHosts: [".e2b.app"],\n  },\n})' > ./vite.config.ts

# Configure Tailwind CSS (simplified import for v4)
RUN echo '@import "tailwindcss";' > ./src/index.css

# Create tsconfig.json with references structure for shadcn
RUN echo '{\n  "files": [],\n  "references": [\n    {\n      "path": "./tsconfig.app.json"\n    },\n    {\n      "path": "./tsconfig.node.json"\n    }\n  ],\n  "compilerOptions": {\n    "baseUrl": ".",\n    "paths": {\n      "@/*": ["./src/*"]\n    }\n  }\n}' > ./tsconfig.json

# Create tsconfig.app.json
RUN echo '{\n  "compilerOptions": {\n    "target": "ES2020",\n    "useDefineForClassFields": true,\n    "lib": ["ES2020", "DOM", "DOM.Iterable"],\n    "module": "ESNext",\n    "skipLibCheck": true,\n    "moduleResolution": "bundler",\n    "allowImportingTsExtensions": true,\n    "resolveJsonModule": true,\n    "isolatedModules": true,\n    "noEmit": true,\n    "jsx": "react-jsx",\n    "strict": true,\n    "noUnusedLocals": true,\n    "noUnusedParameters": true,\n    "noFallthroughCasesInSwitch": true,\n    "baseUrl": ".",\n    "paths": {\n      "@/*": ["./src/*"]\n    }\n  },\n  "include": ["src"]\n}' > ./tsconfig.app.json

# Create tsconfig.node.json
RUN echo '{\n  "compilerOptions": {\n    "composite": true,\n    "skipLibCheck": true,\n    "module": "ESNext",\n    "moduleResolution": "bundler",\n    "allowSyntheticDefaultImports": true,\n    "strict": true,\n    "noEmit": true\n  },\n  "include": ["vite.config.ts"]\n}' > ./tsconfig.node.json


# Install shadcn/ui
RUN echo "y" | npx shadcn@latest init --yes

# Add all shadcn components to the project
RUN echo "y" | npx shadcn@latest add --all --yes

RUN echo "y" | npx shadcn@latest add https://tweakcn.com/r/themes/modern-minimal.json

# Install ESLint and related dependencies
RUN npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh globals

# Create ESLint configuration file
RUN echo 'import js from "@eslint/js";\nimport tseslint from "typescript-eslint";\nimport reactHooks from "eslint-plugin-react-hooks";\nimport reactRefresh from "eslint-plugin-react-refresh";\nimport globals from "globals";\n\nexport default [\n  {\n    files: ["**/*.{js,jsx,ts,tsx}"],\n    languageOptions: {\n      globals: {\n        ...globals.browser,\n        ...globals.es2020\n      },\n      parserOptions: {\n        ecmaVersion: "latest",\n        sourceType: "module",\n        ecmaFeatures: { jsx: true }\n      }\n    },\n    plugins: {\n      "react-hooks": reactHooks,\n      "react-refresh": reactRefresh\n    },\n    rules: {\n      ...js.configs.recommended.rules,\n      "react-hooks/rules-of-hooks": "error",\n      "react-hooks/exhaustive-deps": "warn",\n      "react-refresh/only-export-components": "off",\n      "no-unused-vars": ["warn", { vars: "all", args: "after-used", ignoreRestSiblings: false }]\n    }\n  },\n  ...tseslint.configs.recommended,\n  {\n    files: ["**/*.{ts,tsx}"],\n    rules: {\n      "@typescript-eslint/no-explicit-any": "warn",\n      "@typescript-eslint/explicit-function-return-type": "off",\n      "@typescript-eslint/no-unused-vars": ["warn", { vars: "all", args: "after-used", ignoreRestSiblings: false }]\n    }\n  },\n  {\n    ignores: ["dist/", "node_modules/", "eslint.config.js"]\n  }\n];' > ./eslint.config.js

# Add lint scripts to package.json
RUN npm pkg set scripts.lint="eslint . --ext ts,tsx --report-unused-disable-directives"
RUN npm pkg set scripts.lint:fix="eslint . --ext ts,tsx --report-unused-disable-directives --fix"

# Already in /home/user - no need to move anything

# TODO: Integrate screenshots to pass back to AI

# # Install Playwright Node.js package
# RUN npm install playwright

# # Install Playwright browsers and dependencies
# RUN PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install --with-deps chromium

# # Allow the user "user" to write output files
# RUN chmod a+rwX /app

# Run validation to ensure template has no import/syntax errors
RUN npm run lint

# Run TypeScript check to catch type errors
RUN npx tsc --noEmit

EXPOSE 5173

# Start dev server
RUN npm run dev
