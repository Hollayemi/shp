import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  // Auth check
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json(
      {
        error: "Authentication required",
        message: "You must be signed in to access this resource",
      },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const limitParam = searchParams.get("limit");
  const hatType = searchParams.get("hatType"); // Optional: filter by hat type
  const limit = limitParam ? parseInt(limitParam, 10) : 20; // Default to last 20 items

  if (!projectId) {
    return NextResponse.json(
      { error: "Project ID is required" },
      { status: 400 },
    );
  }

  try {
    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id: projectId },
    });
    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Fetch HAL chat messages (most recent first, then reverse for chronological display)
    // Filter by hatType if provided to keep conversations separate between different hats
    const chatMessages = await prisma.halChatMessage.findMany({
      where: {
        projectId,
        ...(hatType && { hatType }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        role: true,
        content: true,
        parts: true,
        createdAt: true,
      },
    });

    // Reverse to get chronological order (oldest first)
    chatMessages.reverse();

    // Fetch HAL suggestions through their associated messages
    // Filter by hatType if provided to keep suggestions separate between different hats
    const suggestions = await prisma.halSuggestion.findMany({
      where: {
        message: {
          projectId: projectId,
          ...(hatType && { hatType }),
        },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        suggestionId: true,
        title: true,
        description: true,
        prompt: true,
        icon: true,
        color: true,
        clicked: true,
        targetChat: true,
        createdAt: true,
        messageId: true,
      },
    });

    // Group suggestions by messageId or createdAt for chronological display
    const suggestionGroups: Record<string, typeof suggestions> = {};
    const standaloneSuggestions: typeof suggestions = [];

    suggestions.forEach((suggestion) => {
      if (suggestion.messageId) {
        if (!suggestionGroups[suggestion.messageId]) {
          suggestionGroups[suggestion.messageId] = [];
        }
        suggestionGroups[suggestion.messageId].push(suggestion);
      } else {
        standaloneSuggestions.push(suggestion);
      }
    });

    // Create unified chronological timeline
    const timeline: Array<{
      type: "message" | "suggestions";
      id: string;
      createdAt: Date;
      data: any;
    }> = [];

    // Add chat messages
    chatMessages.forEach((message) => {
      const parts = (message as any).parts;
      console.log("[HAL Messages API] Processing message:", {
        id: message.id,
        role: message.role,
        contentLength: message.content.length,
        hasParts: !!parts,
        partsType: typeof parts,
        partsIsArray: Array.isArray(parts),
        partsLength: parts?.length,
        partsRawJSON: JSON.stringify(parts).substring(0, 200),
      });

      timeline.push({
        type: "message",
        id: message.id,
        createdAt: message.createdAt,
        data: {
          id: message.id,
          role: message.role,
          content: message.content,
          parts: parts, // Prisma should already parse JSONB to JS object/array
          timestamp: message.createdAt,
        },
      });

      // Add suggestions linked to this message
      if (suggestionGroups[message.id]) {
        timeline.push({
          type: "suggestions",
          id: `suggestions-${message.id}`,
          createdAt: message.createdAt,
          data: {
            suggestions: suggestionGroups[message.id].map((s) => ({
              id: s.suggestionId,
              title: s.title,
              description: s.description,
              prompt: s.prompt,
              icon: s.icon,
              color: s.color,
              category: "general",
              clicked: s.clicked,
              targetChat: s.targetChat,
              dbId: s.id,
            })),
            timestamp: message.createdAt,
          },
        });
      }
    });

    // Add standalone suggestions (not linked to specific messages)
    standaloneSuggestions.forEach((suggestion) => {
      timeline.push({
        type: "suggestions",
        id: `standalone-${suggestion.id}`,
        createdAt: suggestion.createdAt,
        data: {
          suggestions: [
            {
              id: suggestion.suggestionId,
              title: suggestion.title,
              description: suggestion.description,
              prompt: suggestion.prompt,
              icon: suggestion.icon,
              color: suggestion.color,
              category: "general",
              clicked: suggestion.clicked,
              targetChat: suggestion.targetChat,
              dbId: suggestion.id,
            },
          ],
          timestamp: suggestion.createdAt,
        },
      });
    });

    // Sort timeline chronologically
    timeline.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return NextResponse.json({
      timeline: timeline.map((item) => ({
        type: item.type,
        id: item.id,
        ...item.data,
      })),
    });
  } catch (error) {
    console.error("HAL Messages API Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to fetch HAL messages and suggestions",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  // Auth check
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json(
      {
        error: "Authentication required",
        message: "You must be signed in to access this resource",
      },
      { status: 401 },
    );
  }

  try {
    const body = await req.json();
    const { projectId, role, content, parts } = body;

    if (!projectId || !role || !content) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, role, content" },
        { status: 400 },
      );
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id: projectId },
    });
    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Save HAL chat message with optional parts
    const halChatMessage = await prisma.halChatMessage.create({
      data: {
        projectId,
        userId: session.user.id!,
        role,
        content,
        parts: parts ? JSON.parse(JSON.stringify(parts)) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: halChatMessage,
    });
  } catch (error) {
    console.error("HAL Messages POST API Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to save HAL message",
      },
      { status: 500 },
    );
  }
}
