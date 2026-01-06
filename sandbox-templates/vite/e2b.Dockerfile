FROM node:21-slim

# Install curl
RUN apt-get update && apt-get install -y curl && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY compile_page.sh /compile_page.sh
RUN chmod +x /compile_page.sh

# Install dependencies and customize sandbox
WORKDIR /home/user/vite-app

# Create Vite React TypeScript app
RUN npm create vite@latest . -- --template react-ts --yes

# Install dependencies
RUN npm install

# Install Tailwind CSS 4.1 with Vite plugin
RUN npm install tailwindcss @tailwindcss/vite

# Install Framer Motion and Tailwind Animate for animations
RUN npm install framer-motion tailwindcss-animate

# Install React Router for navigation
RUN npm install react-router-dom @types/react-router-dom

# Install form handling and validation
RUN npm install react-hook-form @hookform/resolvers zod

# Install HTTP client and data fetching
RUN npm install axios @tanstack/react-query

# Install state management (atomic and easy to use)
RUN npm install jotai

# Install utility libraries
RUN npm install clsx tailwind-merge date-fns lodash-es nanoid

# Install UI and notification libraries (lucide-react comes with shadcn)
RUN npm install react-hot-toast sonner

# Install development and build tools
RUN npm install -D @types/lodash-es @types/node

# Install database and API tools (for fullstack demos)
RUN npm install fake-rest-api json-server

# Install additional React utilities
RUN npm install react-use react-window react-virtualized-auto-sizer

# Install basic linting (minimal for sandbox)
RUN npm install -D eslint

# Update tsconfig.json to add path mapping for shadcn/ui
RUN npm install -D @types/node
RUN echo '{\n  "files": [],\n  "references": [\n    {\n      "path": "./tsconfig.app.json"\n    },\n    {\n      "path": "./tsconfig.node.json"\n    }\n  ],\n  "compilerOptions": {\n    "baseUrl": ".",\n    "paths": {\n      "@/*": ["./src/*"]\n    }\n  }\n}' > tsconfig.json

# Update tsconfig.app.json to include path mapping
RUN echo '{\n  "compilerOptions": {\n    "target": "ES2020",\n    "useDefineForClassFields": true,\n    "lib": ["ES2020", "DOM", "DOM.Iterable"],\n    "module": "ESNext",\n    "skipLibCheck": true,\n    "moduleResolution": "bundler",\n    "allowImportingTsExtensions": true,\n    "isolatedModules": true,\n    "moduleDetection": "force",\n    "noEmit": true,\n    "jsx": "react-jsx",\n    "strict": true,\n    "noUnusedLocals": true,\n    "noUnusedParameters": true,\n    "noFallthroughCasesInSwitch": true,\n    "noUncheckedSideEffectImports": true,\n    "baseUrl": ".",\n    "paths": {\n      "@/*": ["./src/*"]\n    }\n  },\n  "include": ["src"]\n}' > tsconfig.app.json

# Update vite.config.ts with Tailwind 4.1 plugin, path mapping and e2b hosts
RUN echo 'import { defineConfig } from "vite"\nimport react from "@vitejs/plugin-react"\nimport tailwindcss from "@tailwindcss/vite"\nimport path from "path"\n\nexport default defineConfig({\n  plugins: [react(), tailwindcss()],\n  server: {\n    host: "0.0.0.0",\n    port: 3000,\n    allowedHosts: true\n  },\n  resolve: {\n    alias: {\n      "@": path.resolve(__dirname, "./src"),\n    },\n  },\n  optimizeDeps: {\n    include: [\n      "react",\n      "react-dom",\n      "react-router-dom",\n      "framer-motion",\n      "clsx",\n      "tailwind-merge",\n      "lucide-react",\n      "@radix-ui/react-accordion",\n      "@radix-ui/react-alert-dialog",\n      "@radix-ui/react-aspect-ratio",\n      "@radix-ui/react-avatar",\n      "@radix-ui/react-button",\n      "@radix-ui/react-calendar",\n      "@radix-ui/react-card",\n      "@radix-ui/react-checkbox",\n      "@radix-ui/react-collapsible",\n      "@radix-ui/react-context-menu",\n      "@radix-ui/react-dialog",\n      "@radix-ui/react-dropdown-menu",\n      "@radix-ui/react-hover-card",\n      "@radix-ui/react-label",\n      "@radix-ui/react-menubar",\n      "@radix-ui/react-navigation-menu",\n      "@radix-ui/react-popover",\n      "@radix-ui/react-progress",\n      "@radix-ui/react-radio-group",\n      "@radix-ui/react-scroll-area",\n      "@radix-ui/react-select",\n      "@radix-ui/react-separator",\n      "@radix-ui/react-sheet",\n      "@radix-ui/react-slider",\n      "@radix-ui/react-switch",\n      "@radix-ui/react-table",\n      "@radix-ui/react-tabs",\n      "@radix-ui/react-toast",\n      "@radix-ui/react-toggle",\n      "@radix-ui/react-toggle-group",\n      "@radix-ui/react-tooltip",\n      "react-hook-form",\n      "@hookform/resolvers",\n      "zod",\n      "@tanstack/react-query",\n      "axios",\n      "jotai",\n      "date-fns",\n      "lodash-es",\n      "nanoid",\n      "react-hot-toast",\n      "sonner"\n    ]\n  }\n})' > vite.config.ts

# Add Tailwind CSS 4.1 import to CSS
RUN echo '@import "tailwindcss";' > src/index.css

# Create components.json for shadcn/ui
RUN echo '{\n  "$schema": "https://ui.shadcn.com/schema.json",\n  "style": "new-york",\n  "rsc": false,\n  "tsx": true,\n  "tailwind": {\n    "config": "",\n    "css": "src/index.css",\n    "baseColor": "neutral",\n    "cssVariables": true,\n    "prefix": ""\n  },\n  "aliases": {\n    "components": "@/components",\n    "utils": "@/lib/utils",\n    "ui": "@/components/ui",\n    "lib": "@/lib",\n    "hooks": "@/hooks"\n  }\n}' > components.json

# Install shadcn/ui (with proper Tailwind CSS 4.1 setup)
RUN npx --yes shadcn@2.6.3 init --yes --force
RUN npx --yes shadcn@2.6.3 add --all --yes

# Add test and build scripts to package.json
RUN npm pkg set scripts.test="vitest"
RUN npm pkg set scripts.test:ui="vitest --ui"
RUN npm pkg set scripts.lint="eslint src --ext .ts,.tsx"
RUN npm pkg set scripts.lint:fix="eslint src --ext .ts,.tsx --fix"
RUN npm pkg set scripts.type-check="tsc --noEmit"

# Ensure @/lib/utils exists (sometimes shadcn doesn't create it properly)
RUN mkdir -p src/lib
RUN echo 'import { type ClassValue, clsx } from "clsx"\nimport { twMerge } from "tailwind-merge"\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs))\n}' > src/lib/utils.ts

# Pre-generate Vite dependency cache to eliminate cold start delay
# Start dev server in background, let it pre-bundle dependencies, then kill it
RUN npm run dev & DEV_PID=$! && \
    echo "Waiting for Vite to pre-bundle dependencies..." && \
    sleep 15 && \
    echo "Pre-bundling complete, stopping dev server..." && \
    kill $DEV_PID && \
    wait $DEV_PID 2>/dev/null || true

# Move the Vite app to the home directory and remove the vite-app directory
RUN mv /home/user/vite-app/* /home/user/ && rm -rf /home/user/vite-app