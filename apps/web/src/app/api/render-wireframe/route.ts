import { NextRequest, NextResponse } from "next/server";
import { generateWireframeHTML } from "@/lib/llmWireframeGenerator";

export async function POST(request: NextRequest) {
  try {
    const { content, filePath, componentName } = await request.json();

    if (!content || !filePath) {
      return NextResponse.json(
        { error: "Content and filePath are required" },
        { status: 400 },
      );
    }

    console.log("Wireframe render API called with:", {
      filePath,
      contentLength: content.length,
      componentName: componentName || "unknown",
    });

    // Extract component name from filePath if not provided
    const finalComponentName = componentName || 
      filePath
        .split("/")
        .pop()
        ?.replace(/\.(tsx|jsx|ts|js)$/, "") || "Component";

    // Set a timeout for the wireframe generation (30 seconds)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Wireframe generation timed out"));
      }, 30000);
    });

    const wireframePromise = generateWireframeHTML(
      content,
      finalComponentName,
    );

    const html = await Promise.race([wireframePromise, timeoutPromise]);

    console.log("Wireframe HTML generated successfully:", {
      componentName: finalComponentName,
      htmlLength: html.length,
    });

    return NextResponse.json(
      { html },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Wireframe render API error:", error);
    
    // Return a fallback HTML with error message
    const fallbackHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wireframe Preview - Error</title>
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
  <div class="bg-white rounded-lg shadow-md p-8 border border-red-200 max-w-md">
    <div class="text-center">
      <div class="text-red-500 text-5xl mb-4">⚠️</div>
      <h2 class="text-xl font-semibold mb-2 text-gray-900">Wireframe Error</h2>
      <p class="text-gray-600 mb-4">Failed to generate wireframe preview.</p>
      <p class="text-sm text-gray-500">${error instanceof Error ? error.message : "Unknown error"}</p>
      <p class="text-xs text-gray-400 mt-2">Check console for details</p>
    </div>
  </div>
</body>
</html>`;

    return NextResponse.json(
      { html: fallbackHtml },
      { status: 500 },
    );
  }
}
