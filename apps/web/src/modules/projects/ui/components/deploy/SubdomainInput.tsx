import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLinkIcon,
  CheckIcon,
  XCircleIcon,
  PencilIcon,
} from "lucide-react";

interface SubdomainInputProps {
  subdomain: string;
  subdomainError: string | null;
  isEditingUrl: boolean;
  isCheckingSubdomain: boolean;
  subdomainAvailable: boolean | null;
  hasSetInitialSubdomain: boolean;
  deploymentUrl?: string;
  projectName?: string;
  customDomain?: string; // Primary active custom domain
  onSubdomainChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUrlClick: (e: React.MouseEvent<HTMLInputElement>) => void;
  onUrlFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
  onUrlBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  onEditUrlClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function SubdomainInput({
  subdomain,
  subdomainError,
  isEditingUrl,
  isCheckingSubdomain,
  subdomainAvailable,
  hasSetInitialSubdomain,
  deploymentUrl,
  projectName,
  customDomain,
  onSubdomainChange,
  onUrlClick,
  onUrlFocus,
  onUrlBlur,
  onEditUrlClick,
}: SubdomainInputProps) {
  // Show custom domain if it's primary, otherwise show Shipper subdomain
  const displayDomain = customDomain || subdomain;
  const isCustomDomain = !!customDomain;
  const placeholder = projectName
    ? projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 63)
    : "my-app";

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`flex h-[35px] items-center rounded-lg border p-1 shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] ${
          subdomainError
            ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
            : "border-[#F2F2F2] bg-white dark:border-[#2A3833] dark:bg-[#1A2421]"
        }`}
      >
        {!isCustomDomain && (
          <div className="flex items-center gap-2 rounded bg-[#F3F4F4] px-1.5 py-1 dark:bg-[#1A2421]">
            <div className="text-xs font-normal text-[#14201F] dark:text-[#F5F9F7]">
              https://
            </div>
          </div>
        )}
        <div className="relative flex-1">
          {!hasSetInitialSubdomain ? (
            <div className="flex h-full w-full items-center px-2">
              <Skeleton className="h-3 w-32" />
            </div>
          ) : isCustomDomain ? (
            <div className="flex h-full w-full items-center px-2">
              <div className={`text-xs ${deploymentUrl ? "cursor-pointer text-[#1E9A80] hover:text-[#17816B]" : "text-[#14201F] dark:text-[#F5F9F7]"}`}>
                https://{displayDomain}
              </div>
            </div>
          ) : (
            <Input
              value={displayDomain}
              onChange={onSubdomainChange}
              onMouseDown={onUrlClick}
              onFocus={onUrlFocus}
              onBlur={onUrlBlur}
              placeholder={placeholder}
              className={`h-full w-full border-0 bg-transparent px-2 text-xs shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] focus-visible:ring-0 ${
                deploymentUrl && !isEditingUrl
                  ? "cursor-pointer pr-14 text-[#1E9A80] hover:text-[#17816B] dark:text-[#1E9A80] dark:hover:text-[#17816B]"
                  : subdomainError
                    ? "pr-8 text-red-600 dark:text-red-400"
                    : "pr-8 text-[#14201F] dark:text-[#F5F9F7]"
              }`}
              title={
                deploymentUrl && !isEditingUrl
                  ? "Click to open project"
                  : "Edit your app's subdomain"
              }
            />
          )}
          {deploymentUrl && !isEditingUrl ? (
            <div className="absolute top-1/2 right-0.5 flex -translate-y-1/2 items-center gap-0.5">
              <button
                type="button"
                onClick={onEditUrlClick}
                className="flex h-5 w-5 items-center justify-center rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Edit subdomain"
              >
                <PencilIcon className="h-3 w-3 text-[#666E6D] dark:text-[#B8C9C3]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deploymentUrl) {
                    window.open(deploymentUrl, "_blank", "noopener,noreferrer");
                  }
                }}
                className="flex h-5 w-5 items-center justify-center rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Open project in new tab"
              >
                <ExternalLinkIcon className="h-3 w-3 text-[#1E9A80]" />
              </button>
            </div>
          ) : (
            isEditingUrl &&
            subdomain && (
              <div className="absolute top-1/2 right-2 -translate-y-1/2">
                {isCheckingSubdomain ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-b border-gray-400" />
                ) : subdomainAvailable === true ? (
                  <CheckIcon className="h-3 w-3 text-green-600 dark:text-green-400" />
                ) : subdomainAvailable === false ? (
                  <XCircleIcon className="h-3 w-3 text-red-600 dark:text-red-400" />
                ) : null}
              </div>
            )
          )}
        </div>
        {!isCustomDomain && (
          <div className="flex items-center gap-2 rounded bg-[#F3F4F4] px-1.5 py-1 dark:bg-[#1A2421]">
            <div className="text-xs font-normal text-[#14201F] dark:text-[#F5F9F7]">
              .shipper.now
            </div>
          </div>
        )}
      </div>
      {subdomainError && (
        <div className="px-1 text-xs text-red-600 dark:text-red-400">
          {subdomainError}
        </div>
      )}
    </div>
  );
}

