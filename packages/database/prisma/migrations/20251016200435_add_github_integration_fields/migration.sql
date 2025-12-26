-- AlterTable
ALTER TABLE "users" ADD COLUMN     "githubAccessToken" TEXT,
ADD COLUMN     "githubRefreshToken" TEXT,
ADD COLUMN     "githubUsername" TEXT,
ADD COLUMN     "githubEmail" TEXT,
ADD COLUMN     "githubAvatarUrl" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "githubRepositoryUrl" TEXT,
ADD COLUMN     "githubRepoOwner" TEXT,
ADD COLUMN     "githubRepoName" TEXT,
ADD COLUMN     "githubBranch" TEXT DEFAULT 'main',
ADD COLUMN     "lastGithubSyncAt" TIMESTAMP(3),
ADD COLUMN     "githubConnectionStatus" TEXT;
