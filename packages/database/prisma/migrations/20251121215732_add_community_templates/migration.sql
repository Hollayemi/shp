-- DropForeignKey
ALTER TABLE "public"."uploads" DROP CONSTRAINT "uploads_teamId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "public"."uploads_uploadType_idx";

-- DropIndex
DROP INDEX IF EXISTS "public"."uploads_userId_idx";

-- AlterTable
ALTER TABLE "uploads" ALTER COLUMN "tags" DROP DEFAULT,
ALTER COLUMN "usedInProjects" DROP DEFAULT;

-- CreateTable
CREATE TABLE "community_templates" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "logo" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "screenshots" JSONB,
    "demoUrl" TEXT,
    "sourceProjectId" TEXT,
    "sourceFragmentId" TEXT NOT NULL,
    "categoryId" TEXT,
    "tags" TEXT[],
    "remixCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL DEFAULT 'Shipper Team',
    "chatHistoryVisible" BOOLEAN NOT NULL DEFAULT true,
    "seedPrompt" TEXT,
    "price" INTEGER DEFAULT 0,
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,

    CONSTRAINT "community_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,

    CONSTRAINT "template_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_likes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "template_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_comments" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "template_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_saves" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "template_saves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_remixes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "remixedProjectId" TEXT NOT NULL,

    CONSTRAINT "template_remixes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_chat_messages" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "templateId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "template_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_purchases" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "priceAtPurchase" INTEGER NOT NULL,

    CONSTRAINT "template_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "community_templates_slug_key" ON "community_templates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "community_templates_sourceProjectId_key" ON "community_templates"("sourceProjectId");

-- CreateIndex
CREATE INDEX "community_templates_slug_idx" ON "community_templates"("slug");

-- CreateIndex
CREATE INDEX "community_templates_categoryId_idx" ON "community_templates"("categoryId");

-- CreateIndex
CREATE INDEX "community_templates_featured_published_idx" ON "community_templates"("featured", "published");

-- CreateIndex
CREATE INDEX "community_templates_remixCount_idx" ON "community_templates"("remixCount" DESC);

-- CreateIndex
CREATE INDEX "community_templates_createdAt_idx" ON "community_templates"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "community_templates_authorId_idx" ON "community_templates"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "template_categories_name_key" ON "template_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "template_categories_slug_key" ON "template_categories"("slug");

-- CreateIndex
CREATE INDEX "template_categories_order_idx" ON "template_categories"("order");

-- CreateIndex
CREATE INDEX "template_likes_templateId_idx" ON "template_likes"("templateId");

-- CreateIndex
CREATE INDEX "template_likes_userId_idx" ON "template_likes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "template_likes_templateId_userId_key" ON "template_likes"("templateId", "userId");

-- CreateIndex
CREATE INDEX "template_comments_templateId_createdAt_idx" ON "template_comments"("templateId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "template_comments_userId_idx" ON "template_comments"("userId");

-- CreateIndex
CREATE INDEX "template_saves_userId_createdAt_idx" ON "template_saves"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "template_saves_templateId_userId_key" ON "template_saves"("templateId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "template_remixes_remixedProjectId_key" ON "template_remixes"("remixedProjectId");

-- CreateIndex
CREATE INDEX "template_remixes_templateId_createdAt_idx" ON "template_remixes"("templateId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "template_remixes_userId_idx" ON "template_remixes"("userId");

-- CreateIndex
CREATE INDEX "template_chat_messages_templateId_order_idx" ON "template_chat_messages"("templateId", "order");

-- CreateIndex
CREATE INDEX "template_purchases_userId_idx" ON "template_purchases"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "template_purchases_templateId_userId_key" ON "template_purchases"("templateId", "userId");

-- CreateIndex (IF NOT EXISTS to handle existing indexes)
CREATE INDEX IF NOT EXISTS "uploads_userId_uploadType_idx" ON "uploads"("userId", "uploadType");

-- CreateIndex (IF NOT EXISTS to handle existing indexes)
CREATE INDEX IF NOT EXISTS "uploads_tags_idx" ON "uploads"("tags");

-- AddForeignKey
ALTER TABLE "community_templates" ADD CONSTRAINT "community_templates_sourceProjectId_fkey" FOREIGN KEY ("sourceProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_templates" ADD CONSTRAINT "community_templates_sourceFragmentId_fkey" FOREIGN KEY ("sourceFragmentId") REFERENCES "V2Fragment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_templates" ADD CONSTRAINT "community_templates_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "template_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_templates" ADD CONSTRAINT "community_templates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_categories" ADD CONSTRAINT "template_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "template_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_likes" ADD CONSTRAINT "template_likes_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "community_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_likes" ADD CONSTRAINT "template_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_comments" ADD CONSTRAINT "template_comments_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "community_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_comments" ADD CONSTRAINT "template_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_comments" ADD CONSTRAINT "template_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "template_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_saves" ADD CONSTRAINT "template_saves_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "community_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_saves" ADD CONSTRAINT "template_saves_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_remixes" ADD CONSTRAINT "template_remixes_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "community_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_remixes" ADD CONSTRAINT "template_remixes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_remixes" ADD CONSTRAINT "template_remixes_remixedProjectId_fkey" FOREIGN KEY ("remixedProjectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_chat_messages" ADD CONSTRAINT "template_chat_messages_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "community_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_purchases" ADD CONSTRAINT "template_purchases_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "community_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_purchases" ADD CONSTRAINT "template_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
