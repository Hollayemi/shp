#!/usr/bin/env tsx

// Load environment variables
import { config } from "dotenv";
config();

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { generateWireframeHTML } from "../src/lib/llmWireframeGenerator";

/**
 * Wireframe renderer test script
 * Tests the new LLM-based wireframe generation system
 */
const main = async () => {
  // Check for single file argument
  const args = process.argv.slice(2);
  const singleFile = args[0];

  if (singleFile) {
    console.log(`🧪 Testing wireframe renderer on single file: ${singleFile}`);
    await testSingleFile(singleFile);
  } else {
    console.log("🧪 Starting Wireframe Renderer Testing (all files)...");
    await testAllFiles();
  }
};

/**
 * Test all files in the raw directory with wireframe renderer
 */
const testAllFiles = async () => {
  const rawDir = join(process.cwd(), "temp-file-logs", "raw");
  const wireframeResultsDir = join(
    process.cwd(),
    "temp-file-logs",
    "wireframe-results",
  );
  const processedWireframeDir = join(
    process.cwd(),
    "temp-file-logs",
    "wireframe-processed",
  );

  // Create directories
  mkdirSync(wireframeResultsDir, { recursive: true });
  mkdirSync(processedWireframeDir, { recursive: true });

  // Get all raw files
  const rawFiles = readdirSync(rawDir).filter((file) => file.endsWith(".txt"));
  console.log(
    `📁 Found ${rawFiles.length} raw files to test with wireframe renderer`,
  );

  const results: WireframeTestResult[] = [];

  for (const file of rawFiles) {
    console.log(`\n🔍 Processing ${file} with wireframe renderer...`);

    try {
      const result = await processComponentWithWireframe(
        file,
        rawDir,
        wireframeResultsDir,
        processedWireframeDir,
      );
      results.push(result);

      console.log(
        `✅ ${result.componentName}: Generated wireframe (${result.htmlLength} chars)`,
      );
    } catch (error) {
      console.error(`❌ Failed to process ${file}:`, error);

      // Create error result
      results.push({
        componentName: file.replace(".txt", ""),
        filePath: file,
        renderedHtml: "",
        htmlLength: 0,
        metadata: {
          success: false,
          processingTimeMs: 0,
          hasDoctype: false,
          hasTailwind: false,
          hasLucide: false,
          hasBody: false,
          hasWireframeStyling: false,
          hasError: true,
          hasFallback: false,
          issues: [error instanceof Error ? error.message : "Unknown error"],
          processedAt: new Date().toISOString(),
        },
      });
    }
  }

  // Generate summary
  const summary = generateWireframeSummary(results);

  // Generate HTML report
  const reportPath = join(wireframeResultsDir, "wireframe-report.html");
  generateWireframeReport(summary, reportPath);

  // Print text summary
  console.log(generateWireframeTextSummary(summary));
  console.log(`\n📄 Wireframe report generated: ${reportPath}`);
  console.log(`🌐 Open in browser: file://${reportPath}`);
};

/**
 * Test a single file with wireframe renderer
 */
const testSingleFile = async (fileName: string) => {
  const rawDir = join(process.cwd(), "temp-file-logs", "raw");
  const wireframeResultsDir = join(
    process.cwd(),
    "temp-file-logs",
    "wireframe-results",
  );
  const processedWireframeDir = join(
    process.cwd(),
    "temp-file-logs",
    "wireframe-processed",
  );

  // Create directories
  mkdirSync(wireframeResultsDir, { recursive: true });
  mkdirSync(processedWireframeDir, { recursive: true });

  // Check if file exists
  const filePath = join(rawDir, fileName);
  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    console.log(`📁 Available files in ${rawDir}:`);
    const availableFiles = readdirSync(rawDir).filter((file) =>
      file.endsWith(".txt"),
    );
    availableFiles.forEach((file) => console.log(`   - ${file}`));
    process.exit(1);
  }

  console.log(`🔍 Processing ${fileName} with wireframe renderer...`);

  try {
    const result = await processComponentWithWireframe(
      fileName,
      rawDir,
      wireframeResultsDir,
      processedWireframeDir,
    );

    console.log(
      `\n✅ ${result.componentName}: Generated wireframe (${result.htmlLength} chars)`,
    );

    if (!result.metadata.success) {
      console.log(`\n⚠️  Error: ${result.metadata.issues.join(", ")}`);
    }

    console.log(
      `\n📄 Processed wireframe saved to: temp-file-logs/wireframe-processed/`,
    );
    console.log(`📊 Test results saved to: temp-file-logs/wireframe-results/`);
  } catch (error) {
    console.error(`❌ Failed to process ${fileName}:`, error);
    process.exit(1);
  }
};

/**
 * Process a single component file with wireframe renderer
 */
const processComponentWithWireframe = async (
  fileName: string,
  rawDir: string,
  wireframeResultsDir: string,
  processedWireframeDir: string,
): Promise<WireframeTestResult> => {
  const filePath = join(rawDir, fileName);
  const jsxCode = readFileSync(filePath, "utf8");

  // Extract component name from filename
  const componentName = fileName
    .replace(/^src_components_/, "")
    .replace(/\.tsx_.*\.txt$/, "");

  // Generate wireframe HTML using LLM
  console.log(`   🤖 Generating wireframe with Claude 3.5 Sonnet...`);
  const startTime = Date.now();

  const renderedHtml = await generateWireframeHTML(jsxCode, componentName);

  const endTime = Date.now();
  const processingTime = endTime - startTime;

  // Analyze results
  const metadata = analyzeWireframeHtml(renderedHtml, processingTime);

  // Save processed HTML file to the dedicated directory for easy viewing
  const processedFileName = `${componentName}_wireframe_${Date.now()}.html`;
  writeFileSync(join(processedWireframeDir, processedFileName), renderedHtml);
  console.log(`   💾 Saved wireframe file: ${processedFileName}`);

  // Save individual test result
  const timestamp = Date.now();
  const resultDir = join(
    wireframeResultsDir,
    `${componentName}_wireframe_${timestamp}`,
  );
  mkdirSync(resultDir, { recursive: true });

  writeFileSync(join(resultDir, "raw.tsx"), jsxCode);
  writeFileSync(join(resultDir, "wireframe.html"), renderedHtml);
  writeFileSync(
    join(resultDir, "metadata.json"),
    JSON.stringify(metadata, null, 2),
  );

  return {
    componentName,
    filePath: fileName,
    renderedHtml,
    htmlLength: renderedHtml.length,
    metadata,
  };
};

/**
 * Analyze wireframe HTML for quality metrics
 */
const analyzeWireframeHtml = (
  html: string,
  processingTime: number,
): WireframeTestResult["metadata"] => {
  const issues: string[] = [];

  // Check if HTML is valid
  const hasDoctype = html.includes("<!DOCTYPE html>");
  const hasTailwind = html.includes("tailwindcss");
  const hasLucide = html.includes("lucide");
  const hasBody = html.includes("<body");
  const hasWireframeStyling =
    html.includes("border") && html.includes("bg-white");

  if (!hasDoctype) issues.push("Missing DOCTYPE declaration");
  if (!hasTailwind) issues.push("Missing Tailwind CSS");
  if (!hasLucide) issues.push("Missing Lucide icons");
  if (!hasBody) issues.push("Missing body tag");
  if (!hasWireframeStyling)
    issues.push("Missing wireframe styling (borders/backgrounds)");

  // Check for error indicators
  const hasError =
    html.includes("error") || html.includes("Error") || html.includes("❌");
  const hasFallback = html.includes("fallback") || html.includes("Fallback");

  return {
    success: issues.length === 0 && !hasError,
    processingTimeMs: processingTime,
    hasDoctype,
    hasTailwind,
    hasLucide,
    hasBody,
    hasWireframeStyling,
    hasError,
    hasFallback,
    issues,
    processedAt: new Date().toISOString(),
  };
};

/**
 * Generate wireframe test summary
 */
const generateWireframeSummary = (
  results: WireframeTestResult[],
): WireframeTestSummary => {
  const totalComponents = results.length;
  const successfulComponents = results.filter((r) => r.metadata.success).length;
  const averageProcessingTime =
    results.reduce((sum, r) => sum + r.metadata.processingTimeMs, 0) /
    totalComponents;
  const componentsWithIssues = results.filter(
    (r) => r.metadata.issues.length > 0,
  ).length;

  return {
    totalComponents,
    successfulComponents,
    averageProcessingTimeMs: Math.round(averageProcessingTime),
    componentsWithIssues,
    results,
  };
};

/**
 * Generate HTML report for wireframe tests
 */
const generateWireframeReport = (
  summary: WireframeTestSummary,
  reportPath: string,
) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wireframe Renderer Test Report</title>
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body class="min-h-screen bg-gray-50 p-8">
  <div class="max-w-6xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">Wireframe Renderer Test Report</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white p-6 rounded-lg border border-black">
        <h2 class="text-xl font-semibold mb-2">Total Components</h2>
        <p class="text-3xl font-bold text-blue-600">${summary.totalComponents}</p>
      </div>
      <div class="bg-white p-6 rounded-lg border border-black">
        <h2 class="text-xl font-semibold mb-2">Successful</h2>
        <p class="text-3xl font-bold text-green-600">${summary.successfulComponents}</p>
      </div>
      <div class="bg-white p-6 rounded-lg border border-black">
        <h2 class="text-xl font-semibold mb-2">Avg Processing Time</h2>
        <p class="text-3xl font-bold text-purple-600">${summary.averageProcessingTimeMs}ms</p>
      </div>
    </div>

    <div class="bg-white rounded-lg border border-black overflow-hidden">
      <h2 class="text-xl font-semibold p-6 border-b border-black">Test Results</h2>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Component</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Processing Time</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">HTML Length</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issues</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            ${summary.results
              .map(
                (result) => `
              <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${result.componentName}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 py-1 text-xs font-semibold rounded-full ${result.metadata.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}">
                    ${result.metadata.success ? "Success" : "Failed"}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${result.metadata.processingTimeMs}ms</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${result.htmlLength}</td>
                <td class="px-6 py-4 text-sm text-gray-500">
                  ${result.metadata.issues.length > 0 ? result.metadata.issues.join(", ") : "None"}
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;

  writeFileSync(reportPath, html);
};

/**
 * Generate text summary for wireframe tests
 */
const generateWireframeTextSummary = (
  summary: WireframeTestSummary,
): string => {
  const successRate =
    (summary.successfulComponents / summary.totalComponents) * 100;

  return `
📊 Wireframe Renderer Test Summary
=====================================
Total Components: ${summary.totalComponents}
Successful: ${summary.successfulComponents} (${successRate.toFixed(1)}%)
Average Processing Time: ${summary.averageProcessingTimeMs}ms
Components with Issues: ${summary.componentsWithIssues}

${summary.results
  .map(
    (result) =>
      `${result.metadata.success ? "✅" : "❌"} ${result.componentName}: ${result.metadata.processingTimeMs}ms (${result.htmlLength} chars)`,
  )
  .join("\n")}
`;
};

// Types
type WireframeTestResult = {
  componentName: string;
  filePath: string;
  renderedHtml: string;
  htmlLength: number;
  metadata: {
    success: boolean;
    processingTimeMs: number;
    hasDoctype: boolean;
    hasTailwind: boolean;
    hasLucide: boolean;
    hasBody: boolean;
    hasWireframeStyling: boolean;
    hasError: boolean;
    hasFallback: boolean;
    issues: string[];
    processedAt: string;
  };
};

type WireframeTestSummary = {
  totalComponents: number;
  successfulComponents: number;
  averageProcessingTimeMs: number;
  componentsWithIssues: number;
  results: WireframeTestResult[];
};

// Run the script
if (require.main === module) {
  main().catch(console.error);
}
