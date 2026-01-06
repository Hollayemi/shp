-- CreateTable
CREATE TABLE "hal_interactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "firstAnalyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAnalyzedAt" TIMESTAMP(3),
    "lastInteractionAt" TIMESTAMP(3),
    "interactionCount" INTEGER NOT NULL DEFAULT 0,
    "clickedSuggestions" JSONB NOT NULL DEFAULT '[]',
    "analysisData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hal_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hal_user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredCategories" TEXT[],
    "dismissedPatterns" TEXT[],
    "interactionStyle" TEXT NOT NULL DEFAULT 'detailed',
    "difficultyPreference" TEXT NOT NULL DEFAULT 'mixed',
    "focusAreas" TEXT[],
    "completionRate" INTEGER NOT NULL DEFAULT 0,
    "lastAnalyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hal_user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hal_interactions_userId_lastInteractionAt_idx" ON "hal_interactions"("userId", "lastInteractionAt");

-- CreateIndex
CREATE INDEX "hal_interactions_projectId_idx" ON "hal_interactions"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "hal_interactions_userId_projectId_key" ON "hal_interactions"("userId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "hal_user_preferences_userId_key" ON "hal_user_preferences"("userId");

-- CreateIndex
CREATE INDEX "hal_user_preferences_userId_idx" ON "hal_user_preferences"("userId");

-- AddForeignKey
ALTER TABLE "hal_interactions" ADD CONSTRAINT "hal_interactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hal_interactions" ADD CONSTRAINT "hal_interactions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hal_user_preferences" ADD CONSTRAINT "hal_user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
