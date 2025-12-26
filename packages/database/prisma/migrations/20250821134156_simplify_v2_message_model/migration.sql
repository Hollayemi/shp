/*
  Warnings:

  - You are about to drop the `MessagePart` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `content` to the `V2Message` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "MessagePart" DROP CONSTRAINT "MessagePart_messageId_fkey";

-- AlterTable
ALTER TABLE "V2Message" ADD COLUMN     "content" TEXT NOT NULL;

-- DropTable
DROP TABLE "MessagePart";
