/**
 * README.md Generator
 * Analyzes project files and generates a comprehensive README with setup instructions
 */

interface ProjectAnalysis {
  hasPackageJson: boolean;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | null;
  framework: string | null;
  hasEnvFile: boolean;
  scripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
  port: number | null;
}

/**
 * Analyze project files to determine tech stack and configuration
 */
export function analyzeProject(files: Record<string, string>): ProjectAnalysis {
  const analysis: ProjectAnalysis = {
    hasPackageJson: false,
    packageManager: null,
    framework: null,
    hasEnvFile: false,
    scripts: {},
    dependencies: [],
    devDependencies: [],
    port: null,
  };

  // Check for package.json
  if (files['package.json']) {
    analysis.hasPackageJson = true;
    try {
      const packageJson = JSON.parse(files['package.json']);
      analysis.scripts = packageJson.scripts || {};
      analysis.dependencies = Object.keys(packageJson.dependencies || {});
      analysis.devDependencies = Object.keys(packageJson.devDependencies || {});

      // Detect framework
      if (analysis.dependencies.includes('next')) {
        analysis.framework = 'Next.js';
      } else if (analysis.dependencies.includes('react')) {
        analysis.framework = 'React';
      } else if (analysis.dependencies.includes('vue')) {
        analysis.framework = 'Vue.js';
      } else if (analysis.dependencies.includes('svelte')) {
        analysis.framework = 'Svelte';
      } else if (analysis.dependencies.includes('express')) {
        analysis.framework = 'Express.js';
      }
    } catch (error) {
      console.warn('[analyzeProject] Failed to parse package.json:', error);
    }
  }

  // Detect package manager
  if (files['pnpm-lock.yaml']) {
    analysis.packageManager = 'pnpm';
  } else if (files['yarn.lock']) {
    analysis.packageManager = 'yarn';
  } else if (files['bun.lock']) {
    analysis.packageManager = 'bun';
  } else if (files['package-lock.json']) {
    analysis.packageManager = 'npm';
  }

  // Check for .env files
  analysis.hasEnvFile = !!(
    files['.env'] ||
    files['.env.local'] ||
    files['.env.example'] ||
    files['.env.template']
  );

  // Try to detect port from common files
  const viteConfig = files['vite.config.js'] || files['vite.config.ts'];
  const nextConfig = files['next.config.js'] || files['next.config.mjs'];
  
  if (viteConfig && viteConfig.includes('port')) {
    const portMatch = viteConfig.match(/port:\s*(\d+)/);
    if (portMatch) analysis.port = parseInt(portMatch[1]);
  }
  
  if (!analysis.port && analysis.framework === 'Next.js') {
    analysis.port = 3000; // Default Next.js port
  }

  return analysis;
}

/**
 * Generate comprehensive README.md content
 */
export function generateReadme(
  projectName: string,
  files: Record<string, string>
): string {
  const analysis = analyzeProject(files);
  const packageManager = analysis.packageManager || 'npm';
  const installCmd = packageManager === 'npm' ? 'npm install' : `${packageManager} install`;
  const runCmd = analysis.scripts.dev
    ? `${packageManager} ${packageManager === 'npm' ? 'run ' : ''}dev`
    : analysis.scripts.start
    ? `${packageManager} start`
    : `${packageManager} ${packageManager === 'npm' ? 'run ' : ''}start`;

  let readme = `# ${projectName}\n\n`;

  // Description
  readme += `This project was created with Shipper.\n\n`;

  // Tech Stack
  if (analysis.framework || analysis.hasPackageJson) {
    readme += `## 🚀 Tech Stack\n\n`;
    if (analysis.framework) {
      readme += `- **Framework:** ${analysis.framework}\n`;
    }
    if (analysis.packageManager) {
      readme += `- **Package Manager:** ${analysis.packageManager}\n`;
    }
    readme += `\n`;
  }

  // Prerequisites
  readme += `## 📋 Prerequisites\n\n`;
  readme += `Before you begin, ensure you have the following installed:\n\n`;
  readme += `- [Node.js](https://nodejs.org/) (v18 or higher recommended)\n`;
  if (analysis.packageManager && analysis.packageManager !== 'npm') {
    readme += `- [${analysis.packageManager}](https://www.npmjs.com/package/${analysis.packageManager})\n`;
  }
  readme += `\n`;

  // Getting Started
  readme += `## 🛠️ Getting Started\n\n`;
  readme += `### 1. Install Dependencies\n\n`;
  readme += `\`\`\`bash\n${installCmd}\n\`\`\`\n\n`;

  // Environment Variables
  if (analysis.hasEnvFile) {
    readme += `### 2. Set Up Environment Variables\n\n`;
    readme += `Copy the environment template and configure your variables:\n\n`;
    readme += `\`\`\`bash\n`;
    if (files['.env.example']) {
      readme += `cp .env.example .env\n`;
    } else if (files['.env.template']) {
      readme += `cp .env.template .env\n`;
    } else {
      readme += `# Create a .env file with your configuration\n`;
    }
    readme += `\`\`\`\n\n`;
    readme += `Then edit \`.env\` with your configuration values.\n\n`;
  }

  // Running the App
  const stepNumber = analysis.hasEnvFile ? '3' : '2';
  readme += `### ${stepNumber}. Run the Development Server\n\n`;
  readme += `\`\`\`bash\n${runCmd}\n\`\`\`\n\n`;

  if (analysis.port) {
    readme += `Open [http://localhost:${analysis.port}](http://localhost:${analysis.port}) in your browser to see the application.\n\n`;
  } else {
    readme += `The application will start and display the local URL in your terminal.\n\n`;
  }

  // Available Scripts
  if (Object.keys(analysis.scripts).length > 0) {
    readme += `## 📜 Available Scripts\n\n`;
    
    const commonScripts = ['dev', 'start', 'build', 'test', 'lint'];
    const scriptsToShow = commonScripts.filter(script => analysis.scripts[script]);
    
    if (scriptsToShow.length > 0) {
      scriptsToShow.forEach(script => {
        const cmd = packageManager === 'npm' ? `npm run ${script}` : `${packageManager} ${script}`;
        readme += `- \`${cmd}\` - ${getScriptDescription(script)}\n`;
      });
      readme += `\n`;
    }
  }

  // Build for Production
  if (analysis.scripts.build) {
    readme += `## 🏗️ Building for Production\n\n`;
    readme += `\`\`\`bash\n`;
    readme += `${packageManager} ${packageManager === 'npm' ? 'run ' : ''}build\n`;
    readme += `\`\`\`\n\n`;
    
    if (analysis.scripts.start && analysis.framework === 'Next.js') {
      readme += `To run the production build:\n\n`;
      readme += `\`\`\`bash\n${packageManager} start\n\`\`\`\n\n`;
    }
  }

  // Project Structure (if we can detect common patterns)
  if (files['src/'] || files['app/'] || files['pages/']) {
    readme += `## 📁 Project Structure\n\n`;
    readme += `\`\`\`\n`;
    if (analysis.framework === 'Next.js') {
      if (files['app/']) {
        readme += `app/          # Next.js App Router\n`;
      } else if (files['pages/']) {
        readme += `pages/        # Next.js Pages Router\n`;
      }
      readme += `public/       # Static assets\n`;
      readme += `components/   # React components\n`;
    } else {
      readme += `src/          # Source code\n`;
      readme += `public/       # Static assets\n`;
    }
    readme += `\`\`\`\n\n`;
  }

  // Learn More
  if (analysis.framework) {
    readme += `## 📚 Learn More\n\n`;
    readme += getFrameworkLinks(analysis.framework);
    readme += `\n`;
  }

  // Footer
  readme += `## 🤝 Contributing\n\n`;
  readme += `Contributions are welcome! Please feel free to submit a Pull Request.\n\n`;
  
  readme += `---\n\n`;
  readme += `Built with ❤️ using [Shipper](https://shipper.now)\n`;

  return readme;
}

/**
 * Get description for common npm scripts
 */
function getScriptDescription(script: string): string {
  const descriptions: Record<string, string> = {
    dev: 'Start development server',
    start: 'Start production server',
    build: 'Build for production',
    test: 'Run tests',
    lint: 'Run linter',
    format: 'Format code',
  };
  return descriptions[script] || `Run ${script}`;
}

/**
 * Get learning resources for frameworks
 */
function getFrameworkLinks(framework: string): string {
  const links: Record<string, string> = {
    'Next.js': `- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
- [Next.js GitHub](https://github.com/vercel/next.js)`,
    'React': `- [React Documentation](https://react.dev)
- [React Tutorial](https://react.dev/learn)
- [React GitHub](https://github.com/facebook/react)`,
    'Vue.js': `- [Vue.js Documentation](https://vuejs.org)
- [Vue.js Guide](https://vuejs.org/guide/)
- [Vue.js GitHub](https://github.com/vuejs/core)`,
    'Svelte': `- [Svelte Documentation](https://svelte.dev)
- [Svelte Tutorial](https://svelte.dev/tutorial)
- [Svelte GitHub](https://github.com/sveltejs/svelte)`,
    'Express.js': `- [Express.js Documentation](https://expressjs.com)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Express.js GitHub](https://github.com/expressjs/express)`,
  };
  return links[framework] || '';
}
