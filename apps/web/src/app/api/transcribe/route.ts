import { NextRequest, NextResponse } from "next/server";
import { validateAndCreateChatToken } from "@/lib/api-proxy-auth";
import { prisma } from "@/lib/db";
import OpenAI from "openai";

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/**
 * POST /api/transcribe - Transcribe audio using OpenAI Whisper
 */
export async function POST(req: NextRequest) {
  try {
    const openai = getOpenAI();
    if (!openai) {
      return NextResponse.json(
        { success: false, error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const authResult = await validateAndCreateChatToken();

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status || 401 }
      );
    }

    // Check if user is a paid user
    const user = await prisma.user.findUnique({
      where: { id: authResult.userId },
      select: { membershipTier: true },
    });

    if (!user || user.membershipTier === "FREE") {
      return NextResponse.json(
        {
          success: false,
          error: "Voice input is only available for paid users. Please upgrade your plan.",
          code: "PAYMENT_REQUIRED"
        },
        { status: 402 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Transcribe using Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en", // Optional: specify language for better accuracy
    });

    return NextResponse.json({
      success: true,
      text: transcription.text,
    });
  } catch (error) {
    console.error("[Transcribe] Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Transcription failed" 
      },
      { status: 500 }
    );
  }
}
