/**
 * LLM-based wireframe generator for React components
 * Uses Claude 3.5 Sonnet via OpenRouter to generate simple black/white wireframe HTML
 */

export interface WireframeConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_CONFIG: Required<WireframeConfig> = {
  model: "google/gemini-2.5-flash-preview-09-2025",
  temperature: 0.2, // Low temperature for consistency
  maxTokens: 3000, // Enough for HTML output
};

/**
 * Generate wireframe HTML from React component code using LLM
 */
export const generateWireframeHTML = async (
  componentCode: string,
  componentName: string,
  config: WireframeConfig = {},
): Promise<string> => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    const prompt = generateWireframePrompt(componentCode, componentName);
    const html = await callLLMForWireframe(prompt, finalConfig);
    return html;
  } catch (error) {
    console.error("Wireframe generation failed:", error);
    return generateFallbackWireframe(componentName);
  }
};

/**
 * Generate the prompt for wireframe generation
 */
const generateWireframePrompt = (
  componentCode: string,
  componentName: string,
): string => {
  return `You are converting a React/TypeScript component into a simple wireframe HTML preview.

Component name: ${componentName}

Component code:
\`\`\`tsx
${componentCode}
\`\`\`

Generate a standalone HTML document that:
1. Shows a simplified black and white wireframe version
2. Uses only Tailwind CSS for styling (border, bg-white, bg-gray-100, text-black, etc.)
3. Has a clean outline/wireframe aesthetic like a design mockup
4. Uses simple colored buttons (bg-blue-500, bg-green-500, etc.) for interactive elements
5. Includes basic grid layouts where appropriate
6. No JavaScript, no interactivity, no complex state
7. Return ONLY the complete HTML document starting with <!DOCTYPE html>
8. Include Tailwind CDN: <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
9. Include Lucide icons CDN: <script src="https://unpkg.com/lucide@latest"></script>
10. Wrap content in: <body class="min-h-screen bg-[#FCFCF9] dark:bg-[#0A0E0D] flex items-center justify-center p-4">
11. Initialize Lucide: <script>lucide.createIcons();</script>
12. Apply rounded-[16px] border radius to all cards, containers, and interactive elements
13. Add shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] to cards and elevated elements

The output should look like a design wireframe - simple, clean, and minimal with consistent rounded-[16px] borders and subtle shadows.`;
};

/**
 * Call OpenRouter API for wireframe generation
 */
const callLLMForWireframe = async (
  prompt: string,
  config: Required<WireframeConfig>,
): Promise<string> => {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Shipper Wireframe Generator",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content:
              "You are a React component wireframe generator. Return only valid HTML starting with <!DOCTYPE html>.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `OpenRouter API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("No content returned from LLM");
  }

  // Extract HTML from the response (in case LLM adds extra text)
  const htmlMatch = content.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
  if (htmlMatch) {
    return htmlMatch[0];
  }

  // If no complete HTML found, try to extract just the body content
  const bodyMatch = content.match(/<body[^>]*>[\s\S]*<\/body>/i);
  if (bodyMatch) {
    return wrapInCompleteHTML(bodyMatch[0]);
  }

  // If still no HTML found, wrap the content in a basic HTML structure
  return wrapInCompleteHTML(content);
};

/**
 * Wrap content in a complete HTML document structure
 */
const wrapInCompleteHTML = (bodyContent: string): string => {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Component Wireframe</title>
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style type="text/tailwindcss">
    button {
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
    }
    h1, h2, h3, h4, h5, h6 {
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
  </style>
</head>
<body class="min-h-screen bg-[#FCFCF9] dark:bg-[#0A0E0D] flex items-center justify-center p-4">
  <section class="border border-[#E7E5E4] dark:border-[#26263D] rounded-[16px] !bg-white dark:!bg-[#0F1613] p-6 m-6 shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)]">
    ${bodyContent.replace(/<\/?body[^>]*>/gi, "")}
  </section>
  <script>
    lucide.createIcons();
  </script>
</body>
</html>`;
};

/**
 * Generate fallback wireframe HTML when LLM fails
 */
const generateFallbackWireframe = (componentName: string): string => {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Component Wireframe - ${componentName}</title>
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style type="text/tailwindcss">
    button {
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
    }
  </style>
</head>
<body class="min-h-screen bg-[#FCFCF9] dark:bg-[#0A0E0D] flex items-center justify-center p-4">
  <section class="border border-[#E7E5E4] dark:border-[#26263D] rounded-[16px] !bg-white dark:!bg-[#0F1613] p-6 shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)]">
    <div class="text-center">
      <div class="text-gray-500 text-4xl mb-4">📋</div>
      <h2 class="text-xl font-semibold mb-2 text-black">${componentName}</h2>
      <p class="text-gray-600 mb-4">Component wireframe preview</p>
      <div class="space-y-2">
        <div class="h-4 bg-gray-200 rounded-[16px] shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)]"></div>
        <div class="h-4 bg-gray-200 rounded-[16px] shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] w-3/4 mx-auto"></div>
        <div class="h-4 bg-gray-200 rounded-[16px] shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] w-1/2 mx-auto"></div>
      </div>
      <div class="mt-4 flex gap-2 justify-center">
        <button class="bg-blue-500 text-white px-4 py-2 rounded-[16px] border border-[#E7E5E4] shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)]">Button</button>
        <button class="bg-green-500 text-white px-4 py-2 rounded-[16px] border border-[#E7E5E4] shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)]">Action</button>
      </div>
    </div>
  </section>
  <script>
    lucide.createIcons();
  </script>
</body>
</html>`;
};
