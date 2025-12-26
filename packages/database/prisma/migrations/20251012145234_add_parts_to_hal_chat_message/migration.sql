-- AlterTable
ALTER TABLE "hal_chat_messages" ADD COLUMN "parts" JSONB;

-- Update role column comment
COMMENT ON COLUMN "hal_chat_messages"."role" IS 'user | assistant | system';

-- Update content column comment  
COMMENT ON COLUMN "hal_chat_messages"."content" IS 'Plain text content for simple messages';

-- Add comment for new parts column
COMMENT ON COLUMN "hal_chat_messages"."parts" IS 'Full message parts structure (for tool calls, reasoning, etc.)';
