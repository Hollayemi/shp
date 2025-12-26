/*
  Warnings:

  - You are about to drop the column `chatId` on the `V2Message` table. All the data in the column will be lost.
  - You are about to drop the `Chat` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "V2Message" DROP CONSTRAINT "V2Message_chatId_fkey";

-- DropIndex
DROP INDEX "V2Message_chatId_idx";

-- AlterTable
ALTER TABLE "V2Message" DROP COLUMN "chatId";

-- DropTable
DROP TABLE "Chat";
