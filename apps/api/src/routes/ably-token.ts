import { Router, Request, Response } from "express";
import type { Router as RouterType } from "express";
import Ably from "ably";
import { validateSession } from "../middleware/session-auth.js";

const router: RouterType = Router();

/**
 * Generate Ably token for authenticated users
 * This keeps the API key secret on the server
 */
router.post("/token", validateSession, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = req.user.id;
    console.log(`[Ably] Generating token for user: ${userId}`);

    const apiKey = process.env.ABLY_API_KEY;

    if (!apiKey) {
      console.warn("ABLY_API_KEY not configured");
      return res
        .status(503)
        .json({ error: "Real-time features not configured" });
    }

    // Create Ably REST client with server key
    const ably = new Ably.Rest({ key: apiKey });

    // Generate token with limited capabilities
    const tokenRequest = await ably.auth.createTokenRequest({
      clientId: userId,
      capability: {
        "project:*": ["subscribe", "presence"],
        "workspace:*": ["subscribe", "presence"],
      },
      ttl: 60 * 60 * 1000, // 1 hour
    });

    res.json(tokenRequest);
  } catch (error) {
    console.error("Error generating Ably token:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

export default router;
