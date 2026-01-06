import { channel, topic } from "@inngest/realtime";
import z from "zod";

// Create a channel for each discussion, given a thread ID. A channel is a namespace for one or more topics of streams.
export const appBuilderChannel = channel(
  (threadId: string) => `thread:${threadId}`
)
  // Add a specific topic for messages from the agent
  .addTopic(
    topic("messages").schema(
      z.object({
        id: z.string(),
        message: z.string(),
      })
    )
  )
  // Add a specific topic for code updates from E2B
  .addTopic(
    topic("code").schema(
      z.object({
        code: z.string(),
        filePath: z.string(),
        action: z.enum(["created", "updated", "deleted"]),
        id: z.string(),
      })
    )
  )
  // Add a specific topic for terminal output
  .addTopic(
    topic("terminal").schema(
      z.object({
        command: z.string(),
        output: z.string(),
        id: z.string(),
      })
    )
  )
  // Add a specific topic for status updates
  .addTopic(
    topic("status").schema(
      z.object({
        status: z.enum(["running", "completed", "error", "cancelled"]),
        message: z.string(),
      })
    )
  )
  // Generation events
  .addTopic(
    topic("generation").schema(
      z.object({
        type: z.enum([
          "generation_started",
          "generation_phase",
          "generation_progress",
          "generation_completed",
          "generation_failed",
        ]),
        data: z.any().optional(),
      })
    )
  )
  // Sandbox events
  .addTopic(
    topic("sandbox").schema(
      z.object({
        type: z.enum(["sandbox_created", "sandbox_updated"]),
        sandboxId: z.string(),
        url: z.string().optional(),
        data: z.any().optional(),
      })
    )
  )
  // Fragment events
  .addTopic(
    topic("fragment").schema(
      z.object({
        type: z.enum(["fragment_created", "fragment_updated"]),
        fragmentId: z.string(),
        data: z.any().optional(),
      })
    )
  )
  // File events
  .addTopic(
    topic("file").schema(
      z.object({
        type: z.enum(["file_created", "file_updated"]),
        filePath: z.string(),
        data: z.any().optional(),
      })
    )
  );
