import { NextRequest, NextResponse } from 'next/server';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { validateAndCreateChatToken } from '@/lib/api-proxy-auth';
import { getProjectContext } from '@/lib/ai/context';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Validate session and create chat token
    const authResult = await validateAndCreateChatToken();
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status || 401 }
      );
    }

    const body = await request.json();
    const { projectId, projectName, currentTitle } = body;

    if (!projectId || !projectName) {
      return NextResponse.json(
        { success: false, error: 'Project ID and name are required' },
        { status: 400 }
      );
    }

    // Get project context from chat messages
    const projectContext = await getProjectContext(projectId, authResult.chatToken!);

    const generatedTitle = await generateSEOTitle({
      projectName,
      currentTitle,
      projectContext
    });

    return NextResponse.json({
      success: true,
      generatedTitle,
      creditsUsed: 0.25,
      keywords: extractKeywords(generatedTitle)
    });

  } catch (error) {
    console.error('Title generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate title' },
      { status: 500 }
    );
  }
}



async function generateSEOTitle(params: {
  projectName: string;
  currentTitle?: string;
  projectContext?: string;
}): Promise<string> {
  const prompt = `Generate a catchy, SEO-friendly title for a web application based on the project context.

Project Name: ${params.projectName}
${params.currentTitle ? `Current Title: ${params.currentTitle}` : ''}
${params.projectContext ? `Project Description/Context: ${params.projectContext}` : ''}

Requirements:
- Maximum 60 characters (for SEO)
- Base the title on what the app actually does (from the project context)
- Include relevant keywords that describe the app's functionality
- Make it engaging and memorable
- Professional tone
- No quotes or special formatting

Return ONLY the title text, nothing else.`;

  const { text } = await generateText({
    model: openrouter('anthropic/claude-3.5-sonnet'),
    prompt,
    temperature: 0.7,
  });

  return text.trim();
}

function extractKeywords(title: string): string[] {
  return title
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !['your', 'with', 'the', 'and', 'for'].includes(word))
    .slice(0, 5);
}
