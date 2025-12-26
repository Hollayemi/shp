import { NextRequest, NextResponse } from 'next/server';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, projectName, title, description } = body;

    if (!projectName) {
      return NextResponse.json(
        { success: false, error: 'Project name is required' },
        { status: 400 }
      );
    }

    // Generate a compelling tagline for the social image
    const tagline = await generateImageTagline({
      projectName,
      title,
      description
    });

    // Create the OG image URL
    const ogImageUrl = createSocialImageUrl({
      projectName,
      tagline,
      title: title || projectName
    });

    // Fetch the image from the OG service (server-side to avoid CORS)
    const imageResponse = await fetch(ogImageUrl);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch OG image: ${imageResponse.status}`);
    }

    // Convert to base64 data URL
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    return NextResponse.json({
      success: true,
      imageUrl: dataUrl,
      creditsUsed: 0.5,
      tagline
    });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate image' },
      { status: 500 }
    );
  }
}

async function generateImageTagline(params: {
  projectName: string;
  title?: string;
  description?: string;
}): Promise<string> {
  const prompt = `Generate a short, punchy tagline for a social media share image.

Project Name: ${params.projectName}
${params.title ? `Title: ${params.title}` : ''}
${params.description ? `Description: ${params.description}` : ''}

Requirements:
- Maximum 50 characters
- Catchy and memorable
- Professional tone
- No quotes or special formatting
- Should work well on a social share image

Return ONLY the tagline text, nothing else.`;

  const { text } = await generateText({
    model: openrouter('anthropic/claude-3.5-sonnet'),
    prompt,
    temperature: 0.8,
  });

  return text.trim();
}

function createSocialImageUrl(params: {
  projectName: string;
  tagline: string;
  title: string;
}): string {
  // Using Vercel's OG image service with clean formatting
  const baseUrl = 'https://og-image.vercel.app';
  
  // Properly encode user input to prevent URL injection
  const encodedTitle = encodeURIComponent(params.title);
  const encodedTagline = encodeURIComponent(params.tagline);
  
  // Create a clean, professional layout
  // Title on top, tagline below
  const imageText = `**${encodedTitle}**%0A%0A${encodedTagline}`;
  
  // Create a professional dark-themed OG image with proper sizing
  return `${baseUrl}/${imageText}.png?theme=dark&md=1&fontSize=60px`;
}
