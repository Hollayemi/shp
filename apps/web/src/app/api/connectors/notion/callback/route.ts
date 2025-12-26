/**
 * Notion OAuth Callback Handler
 *
 * This route handles the OAuth callback from Notion after user authorization.
 * It receives the authorization code and forwards it to the API server,
 * then closes the popup window.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Connection Failed</title></head>
        <body>
          <script>
            window.opener?.postMessage({ type: 'connector-error', error: '${error}' }, '*');
            window.close();
          </script>
          <p>Connection failed: ${error}. This window will close automatically.</p>
        </body>
      </html>
      `,
      {
        headers: { "Content-Type": "text/html" },
      },
    );
  }

  if (!code || !state) {
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Invalid Request</title></head>
        <body>
          <script>
            window.opener?.postMessage({ type: 'connector-error', error: 'missing_params' }, '*');
            window.close();
          </script>
          <p>Invalid request. This window will close automatically.</p>
        </body>
      </html>
      `,
      {
        headers: { "Content-Type": "text/html" },
      },
    );
  }

  // Get the current user session
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Not Authenticated</title></head>
        <body>
          <script>
            window.opener?.postMessage({ type: 'connector-error', error: 'not_authenticated' }, '*');
            window.close();
          </script>
          <p>Not authenticated. This window will close automatically.</p>
        </body>
      </html>
      `,
      {
        headers: { "Content-Type": "text/html" },
      },
    );
  }

  try {
    // Forward the callback to the API server
    const response = await fetch(
      `${API_URL}/api/v1/connectors/notion/callback?code=${code}&state=${state}`,
      {
        headers: {
          "x-user-id": session.user.id,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to complete OAuth");
    }

    // Success - close the popup
    // Use 'connector-connected' message type to match the frontend listener
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Connected!</title></head>
        <body>
          <script>
            window.opener?.postMessage({ type: 'connector-connected', provider: 'notion' }, '*');
            window.close();
          </script>
          <p>Successfully connected to Notion! This window will close automatically.</p>
        </body>
      </html>
      `,
      {
        headers: { "Content-Type": "text/html" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Connection Failed</title></head>
        <body>
          <script>
            window.opener?.postMessage({ type: 'connector-error', error: '${message}' }, '*');
            window.close();
          </script>
          <p>Connection failed: ${message}. This window will close automatically.</p>
        </body>
      </html>
      `,
      {
        headers: { "Content-Type": "text/html" },
      },
    );
  }
}
