import { z } from 'zod';

export const halChatResponseSchema = z.object({
  greeting: z.string().describe('Brief contextual greeting about the project (e.g., "Your React app is looking great!")'),
  suggestions: z.array(
    z.object({
      id: z.string().describe('Unique identifier for the suggestion'),
      title: z.string().describe('Short, actionable title (e.g., "Add User Authentication")'),
      description: z.string().describe('Brief description of the improvement'),
      prompt: z.string().describe('Detailed prompt to send to the main AI when clicked'),
      icon: z.enum([
        'eye', 'zap', 'search', 'file-text', 'palette', 'code', 'users', 'target'
      ]).describe('Icon identifier'),
      color: z.enum([
        'bg-purple-500', 'bg-orange-500', 'bg-blue-500', 
        'bg-green-500', 'bg-red-500', 'bg-yellow-500'
      ]).describe('Background color class')
    })
  ).length(4).describe('Exactly 4 actionable suggestions for improving the project')
});