/**
 * Framework Analyzer for Code Import
 * Detects project framework and language from file contents
 */

export interface FrameworkAnalysis {
  framework: string;
  language: "typescript" | "javascript" | "mixed";
  packageManager: "npm" | "yarn" | "pnpm" | "bun" | "unknown";
  hasTests: boolean;
  hasLinting: boolean;
  entryPoint?: string;
  devCommand?: string;
  buildCommand?: string;
}

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  packageManager?: string;
}

const FRAMEWORK_SIGNATURES: Record<
  string,
  {
    dependencies: string[];
    configFiles: string[];
    priority: number;
  }
> = {
  nextjs: {
    dependencies: ["next"],
    configFiles: ["next.config.js", "next.config.mjs", "next.config.ts"],
    priority: 10,
  },
  remix: {
    dependencies: ["@remix-run/react", "@remix-run/node"],
    configFiles: ["remix.config.js", "remix.config.ts"],
    priority: 9,
  },
  astro: {
    dependencies: ["astro"],
    configFiles: ["astro.config.mjs", "astro.config.js", "astro.config.ts"],
    priority: 9,
  },
  nuxt: {
    dependencies: ["nuxt"],
    configFiles: ["nuxt.config.js", "nuxt.config.ts"],
    priority: 9,
  },
  sveltekit: {
    dependencies: ["@sveltejs/kit"],
    configFiles: ["svelte.config.js"],
    priority: 9,
  },
  gatsby: {
    dependencies: ["gatsby"],
    configFiles: ["gatsby-config.js", "gatsby-config.ts"],
    priority: 8,
  },
  vite: {
    dependencies: ["vite"],
    configFiles: ["vite.config.js", "vite.config.ts", "vite.config.mjs"],
    priority: 7,
  },
  "create-react-app": {
    dependencies: ["react-scripts"],
    configFiles: [],
    priority: 6,
  },
  vue: {
    dependencies: ["vue", "@vue/cli-service"],
    configFiles: ["vue.config.js"],
    priority: 5,
  },
  svelte: {
    dependencies: ["svelte"],
    configFiles: ["svelte.config.js"],
    priority: 5,
  },
  angular: {
    dependencies: ["@angular/core"],
    configFiles: ["angular.json"],
    priority: 5,
  },
  react: {
    dependencies: ["react", "react-dom"],
    configFiles: [],
    priority: 3,
  },
  express: {
    dependencies: ["express"],
    configFiles: [],
    priority: 2,
  },
  node: {
    dependencies: [],
    configFiles: ["package.json"],
    priority: 1,
  },
};

/**
 * Analyze files to detect the project framework
 */
export function analyzeFramework(
  files: Record<string, string>,
): FrameworkAnalysis {
  const fileNames = Object.keys(files);
  const packageJsonContent = files["package.json"];

  let packageJson: PackageJson = {};
  if (packageJsonContent) {
    try {
      packageJson = JSON.parse(packageJsonContent);
    } catch {
      // Invalid package.json, continue with empty
    }
  }

  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  // Detect framework
  let detectedFramework = "unknown";
  let highestPriority = 0;

  for (const [framework, signature] of Object.entries(FRAMEWORK_SIGNATURES)) {
    // Check dependencies
    const hasDep = signature.dependencies.some((dep) => dep in allDeps);

    // Check config files
    const hasConfig = signature.configFiles.some((config) =>
      fileNames.some(
        (f) => f === config || f.endsWith(`/${config}`),
      ),
    );

    if ((hasDep || hasConfig) && signature.priority > highestPriority) {
      detectedFramework = framework;
      highestPriority = signature.priority;
    }
  }

  // Detect language
  const language = detectLanguage(fileNames);

  // Detect package manager
  const packageManager = detectPackageManager(fileNames, packageJson);

  // Detect testing
  const hasTests =
    fileNames.some(
      (f) =>
        f.includes(".test.") ||
        f.includes(".spec.") ||
        f.includes("__tests__"),
    ) ||
    "jest" in allDeps ||
    "vitest" in allDeps ||
    "mocha" in allDeps;

  // Detect linting
  const hasLinting =
    fileNames.some(
      (f) =>
        f.includes("eslint") ||
        f.includes(".eslintrc") ||
        f.includes("prettier"),
    ) ||
    "eslint" in allDeps ||
    "prettier" in allDeps;

  // Get dev and build commands
  const devCommand = packageJson.scripts?.dev || packageJson.scripts?.start;
  const buildCommand = packageJson.scripts?.build;

  // Detect entry point
  const entryPoint = detectEntryPoint(fileNames, detectedFramework);

  return {
    framework: detectedFramework,
    language,
    packageManager,
    hasTests,
    hasLinting,
    entryPoint,
    devCommand,
    buildCommand,
  };
}

function detectLanguage(
  fileNames: string[],
): "typescript" | "javascript" | "mixed" {
  const hasTypeScript = fileNames.some(
    (f) =>
      f.endsWith(".ts") ||
      f.endsWith(".tsx") ||
      f === "tsconfig.json" ||
      f.endsWith("/tsconfig.json"),
  );
  const hasJavaScript = fileNames.some(
    (f) =>
      (f.endsWith(".js") || f.endsWith(".jsx")) &&
      !f.includes("node_modules") &&
      !f.includes(".config."),
  );

  if (hasTypeScript && hasJavaScript) return "mixed";
  if (hasTypeScript) return "typescript";
  return "javascript";
}

function detectPackageManager(
  fileNames: string[],
  packageJson: PackageJson,
): "npm" | "yarn" | "pnpm" | "bun" | "unknown" {
  // Check lockfiles
  if (fileNames.some((f) => f === "bun.lockb" || f.endsWith("/bun.lockb"))) {
    return "bun";
  }
  if (
    fileNames.some((f) => f === "pnpm-lock.yaml" || f.endsWith("/pnpm-lock.yaml"))
  ) {
    return "pnpm";
  }
  if (fileNames.some((f) => f === "yarn.lock" || f.endsWith("/yarn.lock"))) {
    return "yarn";
  }
  if (
    fileNames.some(
      (f) => f === "package-lock.json" || f.endsWith("/package-lock.json"),
    )
  ) {
    return "npm";
  }

  // Check packageManager field
  if (packageJson.packageManager) {
    if (packageJson.packageManager.startsWith("pnpm")) return "pnpm";
    if (packageJson.packageManager.startsWith("yarn")) return "yarn";
    if (packageJson.packageManager.startsWith("bun")) return "bun";
    if (packageJson.packageManager.startsWith("npm")) return "npm";
  }

  return "unknown";
}

function detectEntryPoint(fileNames: string[], framework: string): string | undefined {
  // Framework-specific entry points
  const entryPoints: Record<string, string[]> = {
    nextjs: ["app/page.tsx", "app/page.jsx", "pages/index.tsx", "pages/index.jsx"],
    vite: ["src/main.tsx", "src/main.jsx", "src/main.ts", "src/main.js", "index.html"],
    "create-react-app": ["src/index.tsx", "src/index.jsx", "src/index.js"],
    react: ["src/App.tsx", "src/App.jsx", "src/index.tsx", "src/index.jsx"],
    vue: ["src/main.ts", "src/main.js", "src/App.vue"],
    svelte: ["src/main.ts", "src/main.js", "src/App.svelte"],
    angular: ["src/main.ts"],
    express: ["src/index.ts", "src/index.js", "index.ts", "index.js", "server.ts", "server.js"],
    node: ["src/index.ts", "src/index.js", "index.ts", "index.js"],
  };

  const candidates = entryPoints[framework] || entryPoints.node;
  for (const entry of candidates) {
    if (fileNames.some((f) => f === entry || f.endsWith(`/${entry}`))) {
      return entry;
    }
  }

  return undefined;
}

/**
 * Get AI guidelines for working with a specific framework
 */
export function getFrameworkGuidelines(framework: string): string {
  const guidelines: Record<string, string> = {
    nextjs: `This is a Next.js project. Key considerations:
- Use the App Router (app/) or Pages Router (pages/) based on the existing structure
- Server Components are the default in App Router
- Use 'use client' directive for client-side interactivity
- API routes go in app/api/ or pages/api/
- Follow Next.js file-based routing conventions
- Use next/image for optimized images
- Use next/link for client-side navigation`,

    vite: `This is a Vite project. Key considerations:
- Fast HMR (Hot Module Replacement) is available
- Use import.meta.env for environment variables
- Static assets go in the public/ directory
- Configure via vite.config.ts/js
- Supports React, Vue, Svelte, and vanilla JS`,

    remix: `This is a Remix project. Key considerations:
- Use loader functions for data fetching
- Use action functions for mutations
- Follow Remix's nested routing conventions
- Use the Form component for progressive enhancement
- Server-side rendering is the default`,

    astro: `This is an Astro project. Key considerations:
- Components are server-rendered by default
- Use client:* directives for interactivity
- Supports multiple UI frameworks (React, Vue, Svelte)
- Content collections for structured content
- Static site generation with optional SSR`,

    "create-react-app": `This is a Create React App project. Key considerations:
- Uses react-scripts for build tooling
- Environment variables must start with REACT_APP_
- Static files go in public/
- Consider migrating to Vite for better performance`,

    vue: `This is a Vue.js project. Key considerations:
- Use Composition API or Options API based on existing patterns
- Single File Components (.vue) for components
- Vue Router for navigation
- Vuex or Pinia for state management`,

    svelte: `This is a Svelte project. Key considerations:
- Components are .svelte files
- Reactive declarations with $:
- Stores for shared state
- Minimal boilerplate, compile-time optimizations`,

    sveltekit: `This is a SvelteKit project. Key considerations:
- File-based routing in routes/
- +page.svelte for pages, +layout.svelte for layouts
- +server.ts for API endpoints
- Load functions for data fetching`,

    angular: `This is an Angular project. Key considerations:
- Component-based architecture with decorators
- Dependency injection for services
- RxJS for reactive programming
- Angular CLI for scaffolding`,

    express: `This is an Express.js project. Key considerations:
- Middleware-based architecture
- Route handlers for HTTP endpoints
- Error handling middleware
- Static file serving with express.static`,

    react: `This is a React project. Key considerations:
- Functional components with hooks
- State management with useState, useReducer, or external libraries
- Use React.memo for performance optimization
- Follow existing component patterns`,

    unknown: `Framework not detected. Key considerations:
- Explore the file structure to understand the project architecture
- Check package.json for dependencies and scripts
- Look for configuration files to understand the build setup
- Follow existing patterns and conventions`,
  };

  return guidelines[framework] || guidelines.unknown;
}


