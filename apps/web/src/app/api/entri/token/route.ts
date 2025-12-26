import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('[Entri API] Requesting token...');
    console.log('[Entri API] App ID:', process.env.NEXT_PUBLIC_ENTRI_APP_ID);
    console.log('[Entri API] Secret exists:', !!process.env.ENTRI_CLIENT_SECRET);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch('https://api.goentri.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: process.env.NEXT_PUBLIC_ENTRI_APP_ID,
        secret: process.env.ENTRI_CLIENT_SECRET,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('[Entri API] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Entri API] Error response:', errorText);
      throw new Error(`Entri API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[Entri API] Token received successfully');

    return NextResponse.json({ token: data.auth_token });
  } catch (error) {
    console.error('[Entri API] Error fetching token:', error);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Token request timed out' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get token' },
      { status: 500 }
    );
  }
}
