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
    const { projectId, projectName, title, currentDescription } = body;

    if (!projectId || !projectName) {
      return NextResponse.json(
        { success: false, error: 'Project ID and name are required' },
        { status: 400 }
      );
    }

    // Get project context from chat messages
    const projectContext = await getProjectContext(projectId, authResult.chatToken!);

    const generatedDescription = await generateSEODescription({
      projectName,
      title,
      currentDescription,
      projectContext
    });

    return NextResponse.json({
      success: true,
      generatedDescription,
      creditsUsed: 0.25
    });

  } catch (error) {
    console.error('Description generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate description' },
      { status: 500 }
    );
  }
}



async function generateSEODescription(params: {
  projectName: string;
  title?: string;
  currentDescription?: string;
  projectContext?: string;
}): Promise<string> {
  const prompt = `Generate a compelling, SEO-optimized meta description for a web application based on the project context.

Project Name: ${params.projectName}
${params.title ? `Title: ${params.title}` : ''}
${params.currentDescription ? `Current Description: ${params.currentDescription}` : ''}
${params.projectContext ? `Project Description/Context: ${params.projectContext}` : ''}

Requirements:
- Maximum 155 characters (for SEO)
- Base the description on what the app actually does (from the project context)
- Include relevant keywords naturally that describe the app's functionality
- Clear value proposition
- Call to action if appropriate
- Professional and engaging tone
- No quotes or special formatting

Return ONLY the description text, nothing else.`;

  const { text } = await generateText({
    model: openrouter('anthropic/claude-3.5-sonnet'),
    prompt,
    temperature: 0.7,
  });

  return text.trim();
}
