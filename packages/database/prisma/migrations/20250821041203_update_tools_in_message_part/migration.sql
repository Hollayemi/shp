-- AlterTable
ALTER TABLE "MessagePart" ADD COLUMN     "tool_getSandboxUrl_input" JSONB,
ADD COLUMN     "tool_getSandboxUrl_output" TEXT,
ADD COLUMN     "tool_readFile_input" JSONB,
ADD COLUMN     "tool_readFile_output" TEXT,
ADD COLUMN     "tool_runCommand_input" JSONB,
ADD COLUMN     "tool_writeFile_input" JSONB;
