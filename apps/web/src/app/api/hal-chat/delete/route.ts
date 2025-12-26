import { prisma } from '@/lib/db';

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return Response.json({ error: 'Project ID is required' }, { status: 400 });
    }

    console.log(`[HAL Delete] Starting deletion for project: ${projectId}`);

    // Delete all HAL chat messages and their associated suggestions for this project
    // The HalSuggestion model has onDelete: Cascade, so deleting messages will auto-delete suggestions
    const deleteResult = await prisma.halChatMessage.deleteMany({
      where: {
        projectId: projectId,
      },
    });

    // Also delete legacy Message entries if they exist for this project
    const legacyDeleteResult = await prisma.message.deleteMany({
      where: {
        projectId: projectId,
      },
    });

    const totalDeleted = deleteResult.count + legacyDeleteResult.count;
    console.log(`[HAL Delete] Deleted ${deleteResult.count} HAL messages and ${legacyDeleteResult.count} legacy messages for project: ${projectId}`);

    return Response.json({ 
      success: true, 
      deletedCount: totalDeleted,
      halMessages: deleteResult.count,
      legacyMessages: legacyDeleteResult.count,
      message: `Deleted ${totalDeleted} messages and suggestions` 
    });
  } catch (error) {
    console.error('[HAL Delete] Error:', error);
    return Response.json(
      { error: 'Failed to delete messages' },
      { status: 500 }
    );
  }
}