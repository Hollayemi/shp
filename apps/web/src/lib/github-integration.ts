import { Octokit } from "@octokit/rest";

export class GitHubService {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({ auth: accessToken });
  }

  /**
   * Get authenticated user info
   */
  async getUserInfo() {
    const response = await this.octokit.users.getAuthenticated();
    return {
      login: response.data.login,
      name: response.data.name,
      email: response.data.email,
      avatarUrl: response.data.avatar_url,
    };
  }

  /**
   * List user's repositories
   */
  async listRepositories(page: number = 1, perPage: number = 5) {
    const response = await this.octokit.repos.listForAuthenticatedUser({
      page,
      per_page: perPage,
      sort: "updated",
      direction: "desc",
    });

    return {
      repositories: response.data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        description: repo.description,
        url: repo.html_url,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
      })),
      hasMore: response.data.length === perPage,
    };
  }

  /**
   * Get specific repository
   */
  async getRepository(owner: string, repo: string) {
    try {
      const response = await this.octokit.repos.get({ owner, repo });
      return {
        exists: true,
        name: response.data.name,
        fullName: response.data.full_name,
        owner: response.data.owner.login,
        private: response.data.private,
        url: response.data.html_url,
        defaultBranch: response.data.default_branch,
      };
    } catch (error: any) {
      if (error.status === 404) {
        return { exists: false };
      }
      throw error;
    }
  }

  /**
   * Create a new repository
   */
  async createRepository(
    name: string,
    isPrivate: boolean = true,
    description?: string
  ) {
    try {
      const response = await this.octokit.repos.createForAuthenticatedUser({
        name,
        private: isPrivate,
        description: description || "Created with Shipper",
        auto_init: false, // We'll create the initial commit via push
      });

      return {
        success: true,
        url: response.data.html_url,
        cloneUrl: response.data.clone_url,
        owner: response.data.owner.login,
        name: response.data.name,
        fullName: response.data.full_name,
        defaultBranch: response.data.default_branch,
      };
    } catch (error: any) {
      if (error.status === 422) {
        throw new Error(`Repository '${name}' already exists`);
      }
      throw error;
    }
  }

  /**
   * Push files to GitHub using Git Data API (single commit)
   */
  async pushFiles(
    owner: string,
    repo: string,
    branch: string,
    files: Record<string, string>,
    commitMessage: string = "Update from Shipper"
  ) {
    try {
      let isEmptyRepo = false;

      // Check if repository is empty
      try {
        await this.octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${branch}`,
        });
      } catch (error: any) {
        if (error.status === 404 || error.status === 409) {
          console.log("[GitHubService] Empty repository detected, will create initial commit");
          isEmptyRepo = true;
        } else {
          throw error;
        }
      }

      // For empty repos, we must use Contents API for the first file to initialize
      // GitHub doesn't allow Git Data API (blobs/trees) on completely empty repos
      if (isEmptyRepo) {
        console.log("[GitHubService] Empty repository detected - initializing with Contents API");
        
        // Pick the first file to initialize the repo (prefer README.md if it exists)
        const fileEntries = Object.entries(files);
        const readmeEntry = fileEntries.find(([path]) => path === "README.md");
        const firstEntry = readmeEntry || fileEntries[0];
        
        if (!firstEntry) {
          throw new Error("No files to push");
        }

        const [firstFilePath, firstFileContent] = firstEntry;
        
        // Create the first file using Contents API to initialize the repo
        console.log(`[GitHubService] Creating initial file: ${firstFilePath}`);
        await this.octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: firstFilePath,
          message: "initial commit",
          content: Buffer.from(firstFileContent).toString("base64"),
          branch,
        });

        // Now the repo has one commit, we can use Git API for remaining files
        const remainingFiles = fileEntries.filter(([path]) => path !== firstFilePath);
        
        if (remainingFiles.length === 0) {
          // Only one file, we're done
          return {
            success: true,
            commitSha: "initial",
            commitUrl: `https://github.com/${owner}/${repo}`,
            filesProcessed: 1,
          };
        }

        // Push remaining files using Git API (now that repo is initialized)
        console.log(`[GitHubService] Pushing ${remainingFiles.length} remaining files using Git API`);
        
        // Get the latest commit SHA
        const refResponse = await this.octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${branch}`,
        });
        const latestCommitSha = refResponse.data.object.sha;

        const commitResponse = await this.octokit.git.getCommit({
          owner,
          repo,
          commit_sha: latestCommitSha,
        });
        const baseTreeSha = commitResponse.data.tree.sha;

        // Create blobs for remaining files
        const tree = [];
        let filesProcessed = 1; // Already created first file

        for (const [filePath, content] of remainingFiles) {
          try {
            const blobResponse = await this.octokit.git.createBlob({
              owner,
              repo,
              content: Buffer.from(content).toString("base64"),
              encoding: "base64",
            });

            tree.push({
              path: filePath,
              mode: "100644" as const,
              type: "blob" as const,
              sha: blobResponse.data.sha,
            });

            filesProcessed++;
          } catch (error) {
            console.warn(`Failed to create blob for ${filePath}:`, error);
          }
        }

        // Create new tree
        const treeResponse = await this.octokit.git.createTree({
          owner,
          repo,
          tree,
          base_tree: baseTreeSha,
        });

        // Create commit
        const newCommitResponse = await this.octokit.git.createCommit({
          owner,
          repo,
          message: `${commitMessage}`,
          tree: treeResponse.data.sha,
          parents: [latestCommitSha],
        });

        // Update reference
        await this.octokit.git.updateRef({
          owner,
          repo,
          ref: `heads/${branch}`,
          sha: newCommitResponse.data.sha,
        });

        return {
          success: true,
          commitSha: newCommitResponse.data.sha,
          commitUrl: newCommitResponse.data.html_url,
          filesProcessed,
        };
      }

      // For non-empty repos, use the existing Git API approach
      const refResponse = await this.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });
      const latestCommitSha = refResponse.data.object.sha;

      const commitResponse = await this.octokit.git.getCommit({
        owner,
        repo,
        commit_sha: latestCommitSha,
      });
      const baseTreeSha = commitResponse.data.tree.sha;

      // Create blobs for all files
      const tree = [];
      let filesProcessed = 0;

      for (const [filePath, content] of Object.entries(files)) {
        try {
          const blobResponse = await this.octokit.git.createBlob({
            owner,
            repo,
            content: Buffer.from(content).toString("base64"),
            encoding: "base64",
          });

          tree.push({
            path: filePath,
            mode: "100644" as const,
            type: "blob" as const,
            sha: blobResponse.data.sha,
          });

          filesProcessed++;
        } catch (error) {
          console.warn(`Failed to create blob for ${filePath}:`, error);
        }
      }

      // Create new tree
      const treeResponse = await this.octokit.git.createTree({
        owner,
        repo,
        tree,
        base_tree: baseTreeSha,
      });

      // Create commit
      const newCommitResponse = await this.octokit.git.createCommit({
        owner,
        repo,
        message: commitMessage,
        tree: treeResponse.data.sha,
        parents: [latestCommitSha],
      });

      // Update reference
      await this.octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommitResponse.data.sha,
      });

      return {
        success: true,
        commitSha: newCommitResponse.data.sha,
        commitUrl: newCommitResponse.data.html_url,
        filesProcessed,
      };
    } catch (error: any) {
      console.error("[GitHubService] Push failed:", error);
      throw new Error(`Failed to push to GitHub: ${error.message}`);
    }
  }

  /**
   * Get latest commit on branch
   */
  async getLatestCommit(owner: string, repo: string, branch: string) {
    try {
      const response = await this.octokit.repos.getBranch({
        owner,
        repo,
        branch,
      });

      return {
        sha: response.data.commit.sha,
        message: response.data.commit.commit.message,
        author: response.data.commit.commit.author?.name,
        date: response.data.commit.commit.author?.date,
      };
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Branch '${branch}' not found`);
      }
      throw error;
    }
  }

  /**
   * Check if user has write access to repository
   */
  async hasWriteAccess(owner: string, repo: string): Promise<boolean> {
    try {
      const response = await this.octokit.repos.get({ owner, repo });
      return response.data.permissions?.push === true;
    } catch {
      return false;
    }
  }
}
