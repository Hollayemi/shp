"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import {
  Github,
  Search,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Plus,
  CheckIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { GitHubModalWrapper } from "./GitHubModalWrapper";
import { LinkIcon } from "@/components/icons/LinkIcon";

interface GitHubConnectionModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenPushDialog?: () => void;
}

export function GitHubConnectionModal({
  projectId,
  open,
  onOpenChange,
  onOpenPushDialog,
}: GitHubConnectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<{
    owner: string;
    name: string;
    fullName: string;
    defaultBranch: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"existing" | "new">("existing");

  // New repo creation state
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDescription, setNewRepoDescription] = useState("");

  const trpc = useTRPC();

  // Get connection status
  const { data: status, refetch: refetchStatus } = useQuery(
    trpc.projects.getGithubConnectionStatus.queryOptions({ projectId }),
  );

  // List repositories
  const { data: reposData, isLoading: isLoadingRepos } = useQuery(
    trpc.projects.listGithubRepos.queryOptions(
      { page: 1, perPage: 5 },
      { enabled: !!status?.hasGithubAuth },
    ),
  );

  // Connect repository mutation
  const connectMutation = useMutation(
    trpc.projects.connectGithubRepo.mutationOptions({
      onSuccess: () => {
        toast.success("Repository connected successfully!");
        refetchStatus();
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to connect repository");
      },
    }),
  );

  // Disconnect mutation
  const disconnectMutation = useMutation(
    trpc.projects.disconnectGithubRepo.mutationOptions({
      onSuccess: () => {
        toast.success("Repository disconnected");
        refetchStatus();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to disconnect repository");
      },
    }),
  );

  // Create repository mutation
  const createRepoMutation = useMutation(
    trpc.projects.createGithubRepo.mutationOptions({
      onSuccess: (data) => {
        toast.success("Repository created successfully!");
        // Automatically connect the newly created repo using its actual default branch
        connectMutation.mutate({
          projectId,
          repoOwner: data.owner,
          repoName: data.name,
          branch: data.defaultBranch || "main",
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create repository");
      },
    }),
  );

  // Disconnect GitHub account mutation
  const disconnectAccountMutation = useMutation(
    trpc.projects.disconnectGithubAccount.mutationOptions({
      onSuccess: () => {
        toast.success("GitHub account disconnected");
        refetchStatus();
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to disconnect GitHub account");
      },
    }),
  );

  const handleConnect = () => {
    if (!selectedRepo) return;

    connectMutation.mutate({
      projectId,
      repoOwner: selectedRepo.owner,
      repoName: selectedRepo.name,
      branch: selectedRepo.defaultBranch || "main",
    });
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate({ projectId });
  };

  const handleCreateRepo = () => {
    if (!newRepoName.trim()) {
      toast.error("Repository name is required");
      return;
    }

    createRepoMutation.mutate({
      name: newRepoName.trim(),
      description: newRepoDescription.trim() || undefined,
    });
  };

  const handleDisconnectAccount = () => {
    disconnectAccountMutation.mutate();
  };

  const filteredRepos = reposData?.repositories.filter((repo) =>
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Not authenticated with GitHub
  if (!status?.hasGithubAuth) {
    return (
      <GitHubModalWrapper
        open={open}
        onOpenChange={onOpenChange}
        title="Connect GitHub"
        description="Sign in with GitHub to connect your repositories"
      >
        <div className="flex flex-col items-center p-3">
          <Image
            src="/githubimage.png"
            alt="GitHub"
            width={101}
            height={108}
            className="rounded-full"
            quality={100}
            unoptimized
          />
          <p className="dark:text-prj-text-secondary mt-3 mb-4 max-w-sm text-center text-sm text-[#545454]">
            Connect your GitHub account to push your project code directly to
            your repositories
          </p>
          <Button
            onClick={() =>
              signIn("github", { callbackUrl: window.location.href })
            }
            className="w-full gap-2 border-[#0E121B] bg-[#222530] py-3 text-[#F0F6FF] [box-shadow:0px_2px_6px_0px_rgba(255,255,255,0.2)_inset,0px_-2px_4px_0px_#0E121B_inset,0px_16px_24px_-8px_rgba(24,27,37,0.1),0px_0px_0px_1px_#0E121B] hover:bg-[#1b1f23]"
          >
            <GitHubIcon />
            Sign in
          </Button>
        </div>
      </GitHubModalWrapper>
    );
  }

  // Already connected
  if (status.isConnected) {
    return (
      <GitHubModalWrapper
        open={open}
        onOpenChange={onOpenChange}
        title=""
        // description="Your project is connected to a GitHub repository"
        className="sm:max-w-[377px]"
      >
        <div className="space-y-4 px-3 pb-3">
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/githubconnected.png"
              alt="GitHub"
              width={131}
              height={129}
              quality={100}
              unoptimized
            />
            <div className="text-center">
              <h3 className="text-prj-text-title text-lg font-semibold dark:text-[#F5F9F7]">
                Github connected
              </h3>
              <p className="text-sm text-[#545454]">
                Your project is connected to a GitHub repository
              </p>
            </div>
            <div className="dark:bg-prj-bg-secondary flex w-full items-center gap-[10px] rounded-lg border-0 bg-[#F3F3EE] px-3 py-2">
              <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#008000]">
                <CheckIcon className="h-2 w-2.5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#09090B] dark:text-[#F5F9F7]">
                  {status.repoOwner}/{status.repoName}
                </p>
                <p className="text-xs text-[#545454] dark:text-[#F5F9F7]">
                  Branch: {status.branch}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="rounded-prj-button hover:text-foreground hover:bg-prj-tooltip-hover-bg hover:border-prj-tooltip-hover-border h-[29px] w-[29px] bg-[#E3E3DE] p-0 transition-colors duration-200 hover:border dark:bg-[#0000000A]"
              >
                <a
                  href={status.repositoryUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-[28px] w-[28px]"
                >
                  <LinkIcon className="h-[13px] w-[11px]" size={10} />
                </a>
              </Button>
            </div>
          </div>

          {status.lastSyncAt && (
            <p className="text-prj-text-secondary text-xs">
              Last synced: {new Date(status.lastSyncAt).toLocaleString()}
            </p>
          )}

          <div className="flex gap-2.5">
            <Button
              onClick={handleDisconnect}
              disabled={disconnectMutation.isPending}
              className="flex-1 gap-2.5 rounded-[6px] border-0 bg-transparent px-3 py-[6px] text-[#7A7A7A] hover:bg-transparent hover:text-[#7A7A7A]"
            >
              {disconnectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect"
              )}
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                // Use setTimeout to ensure modal is fully closed before opening dialog
                setTimeout(() => onOpenPushDialog?.(), 100);
              }}
              className="flex-1 gap-2.5 rounded-[6px] bg-[#1E9A80] px-3 py-[6px] text-white hover:bg-[#1E9A80]/90"
            >
              Push Changes
            </Button>
          </div>
        </div>
      </GitHubModalWrapper>
    );
  }

  // Select repository
  return (
    <GitHubModalWrapper
      open={open}
      onOpenChange={onOpenChange}
      title="Connect GitHub Repository"
      description="Create a new repository or connect to an existing one"
      className="sm:max-w-[600px]"
    >
      <div className="px-6">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "existing" | "new")}
          className="w-full"
        >
          <TabsList className="bg-prj-bg-secondary border-prj-border-primary grid w-full grid-cols-2 border">
            <TabsTrigger
              value="existing"
              className="data-[state=active]:bg-prj-bg-primary data-[state=active]:dark:bg-grey-900 data-[state=active]:text-prj-text-title text-prj-text-secondary dark:text-[#F5F9F7] data-[state=active]:dark:text-[#F5F9F7]"
            >
              Use Existing
            </TabsTrigger>
            <TabsTrigger
              value="new"
              className="data-[state=active]:bg-prj-bg-primary data-[state=active]:dark:bg-grey-900 data-[state=active]:text-prj-text-title text-prj-text-secondary dark:text-[#F5F9F7] data-[state=active]:dark:text-[#F5F9F7]"
            >
              <Plus className="mr-1 h-4 w-4" />
              Create New
            </TabsTrigger>
          </TabsList>

          {/* Use Existing Tab */}
          <TabsContent
            value="existing"
            className="mt-4 flex max-h-[300px] flex-col space-y-4"
          >
            {/* Search */}
            <div className="relative flex-shrink-0">
              <Search className="text-prj-text-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-prj-bg-secondary border-prj-border-primary text-prj-text-title placeholder:text-prj-text-secondary pl-9 dark:text-[#F5F9F7]"
              />
            </div>

            {/* Repository list */}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {isLoadingRepos ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="text-prj-text-secondary h-6 w-6 animate-spin" />
                </div>
              ) : filteredRepos && filteredRepos.length > 0 ? (
                filteredRepos.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() =>
                      setSelectedRepo({
                        owner: repo.owner,
                        name: repo.name,
                        fullName: repo.fullName,
                        defaultBranch: repo.defaultBranch,
                      })
                    }
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      selectedRepo?.fullName === repo.fullName
                        ? "border-prj-tooltip-hover-border bg-prj-tooltip-hover-bg dark:bg-[#1B1F23]"
                        : "border-prj-border-primary bg-prj-bg-secondary hover:bg-prj-tooltip-hover-bg dark:hover:bg-[#1B1F23]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-prj-text-title truncate text-sm font-medium dark:text-[#F5F9F7]">
                          {repo.fullName}
                        </p>
                        {repo.description && (
                          <p className="text-prj-text-secondary mt-1 truncate text-xs">
                            {repo.description}
                          </p>
                        )}
                      </div>
                      {repo.private && (
                        <span className="bg-prj-bg-primary text-prj-text-secondary flex-shrink-0 rounded px-2 py-0.5 text-xs">
                          Private
                        </span>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-prj-text-secondary py-8 text-center">
                  <p className="text-sm">No repositories found</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-prj-border-primary flex flex-shrink-0 gap-2.5 border-t pt-4">
              <Button
                onClick={() => onOpenChange(false)}
                className="flex-1 gap-2.5 rounded-[6px] border-0 bg-transparent px-3 py-[6px] text-[#7A7A7A] hover:bg-transparent hover:text-[#7A7A7A]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConnect}
                disabled={!selectedRepo || connectMutation.isPending}
                className="flex-1 gap-2.5 rounded-[6px] bg-[#1E9A80] px-3 py-[6px] text-white hover:bg-[#1E9A80]/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {connectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect Repository"
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Create New Tab */}
          <TabsContent
            value="new"
            className="mt-4 flex max-h-[300px] flex-col space-y-4"
          >
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="repo-name"
                  className="text-prj-text-title text-sm font-medium dark:text-[#F5F9F7]"
                >
                  Repository Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="repo-name"
                  placeholder="my-awesome-project"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  className="bg-prj-bg-secondary border-prj-border-primary text-prj-text-title placeholder:text-prj-text-secondary dark:text-[#F5F9F7]"
                />
                <p className="text-prj-text-secondary text-xs">
                  Use lowercase letters, numbers, and hyphens
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="repo-description"
                  className="text-prj-text-title text-sm font-medium dark:text-[#F5F9F7]"
                >
                  Description (optional)
                </Label>
                <Input
                  id="repo-description"
                  placeholder="A brief description of your project"
                  value={newRepoDescription}
                  onChange={(e) => setNewRepoDescription(e.target.value)}
                  className="bg-prj-bg-secondary border-prj-border-primary text-prj-text-title placeholder:text-prj-text-secondary dark:text-[#F5F9F7]"
                />
              </div>

              <p className="text-prj-text-secondary text-xs">
                Repository will be created as public
              </p>
            </div>

            {/* Actions */}
            <div className="border-prj-border-primary flex flex-shrink-0 gap-2.5 border-t pt-4">
              <Button
                onClick={() => onOpenChange(false)}
                className="flex-1 gap-2.5 rounded-[6px] border-0 bg-transparent px-3 py-[6px] text-[#7A7A7A] hover:bg-transparent hover:text-[#7A7A7A]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateRepo}
                disabled={
                  !newRepoName.trim() ||
                  createRepoMutation.isPending ||
                  connectMutation.isPending
                }
                className="flex-1 gap-2.5 rounded-[6px] bg-[#1E9A80] px-3 py-[6px] text-white hover:bg-[#1E9A80]/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createRepoMutation.isPending || connectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {createRepoMutation.isPending
                      ? "Creating..."
                      : "Connecting..."}
                  </>
                ) : (
                  "Create & Connect"
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Disconnect Account Option */}
        <div className="border-prj-border-primary mt-4 mb-2 border-t pt-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnectAccount}
                  disabled={disconnectAccountMutation.isPending}
                  className="w-full text-sm text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/20 dark:hover:text-red-300"
                >
                  {disconnectAccountMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    "Disconnect GitHub Account"
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">
                  This will remove access to all your repositories
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </GitHubModalWrapper>
  );
}
