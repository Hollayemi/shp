import { Button } from "@/components/ui/button";

interface DeploymentActionsProps {
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isDeploying: boolean;
  sandboxReady?: boolean;
  isEditingUrl: boolean;
  subdomainAvailable: boolean | null;
  deploymentUrl?: string;
  showCancel?: boolean;
  onReset: () => void;
  onCancel?: () => void;
  onPublish: () => void;
}

export function DeploymentActions({
  hasUnsavedChanges,
  isSaving,
  isDeploying,
  sandboxReady,
  isEditingUrl,
  subdomainAvailable,
  deploymentUrl,
  showCancel = true,
  onReset,
  onCancel,
  onPublish,
}: DeploymentActionsProps) {
  const getPublishButtonText = () => {
    if (isSaving) return "Saving...";
    if (isDeploying) {
      return deploymentUrl ? "Updating..." : "Publishing...";
    }
    return deploymentUrl ? "Update" : "Publish";
  };

  return (
    <div className="flex flex-col gap-2 px-2">
      <div className="flex flex-col">
        <div className="rounded-xl py-2">
          <div className="flex items-center gap-2">
            {hasUnsavedChanges ? (
              <Button
                onClick={onReset}
                disabled={isSaving || isDeploying}
                className="h-[29px] flex-1 rounded-md bg-[#F3F3EE] px-3 py-1.5 text-sm leading-[18.2px] font-medium text-[#1C1C1C] hover:bg-[#EAEAEA] dark:bg-[#1f2b28] dark:text-[#F5F9F7] dark:hover:bg-[#1F2B28]"
              >
                Reset
              </Button>
            ) : showCancel && onCancel ? (
              <Button
                onClick={onCancel}
                disabled={isSaving || isDeploying || !sandboxReady}
                className="h-[29px] flex-1 rounded-md bg-[#F3F3EE] px-3 py-1.5 text-sm leading-[18.2px] font-medium text-[#1C1C1C] hover:bg-[#EAEAEA] dark:bg-[#1f2b28] dark:text-[#F5F9F7] dark:hover:bg-[#1F2B28]"
              >
                Cancel
              </Button>
            ) : (
              <div className="flex-1" />
            )}
            <Button
              onClick={onPublish}
              disabled={
                isSaving ||
                isDeploying ||
                !sandboxReady ||
                (isEditingUrl && !subdomainAvailable)
              }
              className="h-[29px] flex-1 rounded-md bg-[#1E9A80] px-3 py-1.5 text-sm leading-[18.2px] font-medium text-[#F0F6FF] hover:bg-[#17816B] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {getPublishButtonText()}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
