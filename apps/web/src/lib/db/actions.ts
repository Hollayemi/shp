import { prisma } from "@/lib/db";
import { UIMessage } from "ai";

export async function loadChat(projectId: string, limit?: number) {
  const messages = await prisma.v2Message.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    take: limit ?? undefined,
  });

  const uiMessages = messages.map((msg) => ({
    id: msg.id,
    role: msg.role.toLowerCase(),
    parts: JSON.parse(msg.content),
    createdAt: msg.createdAt,
  })) as UIMessage[];

  return uiMessages;
}

export async function upsertMessage(message: UIMessage, projectId: string) {
  const project = await prisma.project.upsert({
    where: { id: projectId },
    update: {},
    create: { id: projectId, name: "New Project" },
  });

  if (!project) {
    console.error("[Database] Project not found, creating new one");
    throw new Error("Project not found");
  }

  // For assistant messages, save ALL parts (including tool calls) to preserve full context
  // This ensures tool calls are persisted and shown when user returns
  let content = JSON.stringify(message.parts);

  // Only filter for user messages to keep them simple
  if (message.role === "user") {
    const textParts = message.parts.filter((part) => part.type === "text");
    content = JSON.stringify(textParts);
  }

  console.log("[Database] Upserting message", { message, projectId });

  // Use upsert to prevent duplicate messages with the same ID
  const upsertedMessage = await prisma.v2Message.upsert({
    where: { id: message.id },
    update: {
      content: content,
      role: message.role === "user" ? "USER" : "ASSISTANT",
    },
    create: {
      id: message.id,
      role: message.role === "user" ? "USER" : "ASSISTANT",
      content: content,
      projectId: project.id,
    },
  });
  console.log("[Database] Upserted message", upsertedMessage);

  return upsertedMessage.id;
}

// export const deleteMessage = async (messageId: string) => {
//   await prisma.$transaction(async (tx) => {
//     const targetMessage = await tx.v2Message.findUnique({
//       where: { id: messageId },
//     });

//     if (!targetMessage) return;

//     // Delete all messages after this one in the chat
//     await tx.v2Message.deleteMany({
//       where: {
//         projectId: targetMessage.projectId,
//         createdAt: {
//           gt: targetMessage.createdAt,
//         },
//       },
//     });

//     // Delete the target message (cascade delete will handle parts)
//     await tx.v2Message.delete({
//       where: { id: messageId },
//     });
//   });
// };
