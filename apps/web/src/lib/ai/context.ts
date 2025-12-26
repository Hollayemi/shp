/**
 * Shared utilities for AI context retrieval
 */

export async function getProjectContext(projectId: string, chatToken: string): Promise<string> {
  try {
    const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    
    const response = await fetch(`${API_BASE_URL}/api/v1/chat/messages/${projectId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.SHIPPER_API_KEY || '',
        'x-chat-token': chatToken,
      },
    });
    
    if (!response.ok) {
      console.warn('Failed to fetch project context, using basic info');
      return '';
    }
    
    const data = await response.json();
    if (data.success && data.messages && data.messages.length > 0) {
      // Get the first few user messages to understand what the project is about
      const userMessages = data.messages
        .filter((msg: any) => msg.role === 'user')
        .slice(0, 3)
        .map((msg: any) => msg.content)
        .join(' ');
      
      return userMessages.substring(0, 500); // Limit context length
    }
    
    return '';
  } catch (error) {
    console.warn('Error fetching project context:', error);
    return '';
  }
}