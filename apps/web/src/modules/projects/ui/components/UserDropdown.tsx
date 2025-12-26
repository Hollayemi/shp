import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import {
  CheckIcon,
  XIcon,
  ChevronLeft,
  ChevronDown,
  Moon,
  Monitor,
  ChevronRight,
  Download,
  Loader2,
  Cloud,
} from "lucide-react";
import { useFilteredFiles } from "@/hooks/useFilteredFiles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Session } from "next-auth";
import { deslugifyProjectName } from "@/lib/project-namer";
import { PencilEditIcon } from "@/components/icons/PencilEditIcon";
import { GiftBoxIcon } from "@/components/icons/GiftBoxIcon";
import { SunLightIcon } from "@/components/icons/SunLightIcon";
import { SignOutIcon } from "@/components/icons/SignOutIcon";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

// Reusable menu item component with icon container
interface MenuItemWithIconProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  onSelect?: (e: Event) => void;
  href?: string;
  showIconBackground?: boolean;
  disabled?: boolean;
}

const MenuItemWithIcon = ({
  icon,
  label,
  onClick,
  onSelect,
  href,
  showIconBackground = true,
  disabled = false,
}: MenuItemWithIconProps) => {
  const content = (
    <div className="flex items-center gap-2">
      <div
        className={`dark:bg-prj-bg-secondary flex h-8 w-8 items-center justify-center rounded-[6px] bg-[#F5F5F5] group-hover:bg-[#EBEBEB] group-focus:bg-[#EBEBEB] ${disabled ? "opacity-50" : "dark:text-[#B8C9C3]"}`}
      >
        {icon}
      </div>
      <span
        className={`text-sm font-medium ${disabled ? "opacity-50" : "text-[#09090B] dark:text-[#F5F9F7]"}`}
      >
        {label}
      </span>
    </div>
  );

  const menuItemClasses = `py-[6px] mx-[4px] h-[48px] rounded-[12px] transition-all duration-200 mb-1 ${disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-[#F5F5F5] focus:bg-[#F5F5F5] dark:hover:bg-[#232D29] dark:focus:bg-[#232D29]"}`;

  if (href) {
    return (
      <DropdownMenuItem asChild className={menuItemClasses} disabled={disabled}>
        <Link href={href} className="group flex items-center gap-2">
          <div
            className={`dark:bg-prj-bg-secondary flex h-8 w-8 items-center justify-center rounded-[6px] bg-[#F5F5F5] group-hover:bg-[#EBEBEB] group-focus:bg-[#EBEBEB] ${disabled ? "opacity-50" : "dark:text-[#B8C9C3]"}`}
          >
            {icon}
          </div>
          <span
            className={`text-sm font-medium ${disabled ? "opacity-50" : "text-[#09090B] dark:text-[#F5F9F7]"}`}
          >
            {label}
          </span>
        </Link>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      onClick={disabled ? undefined : onClick}
      onSelect={disabled ? undefined : onSelect}
      className={`group ${menuItemClasses}`}
      disabled={disabled}
    >
      {content}
    </DropdownMenuItem>
  );
};

// Reusable theme option component
interface ThemeOptionProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const ThemeOption = ({ icon, label, value }: ThemeOptionProps) => (
  <DropdownMenuRadioItem
    value={value}
    className="group hover:border-[#E5E5E5] hover:bg-[#F5F5F5] focus:border-[#E5E5E5] focus:bg-[#F5F5F5] dark:hover:border-[#3D4A45] dark:hover:bg-[#232D29] dark:focus:border-[#3D4A45] dark:focus:bg-[#232D29] [&[data-state=checked]]:border-[#E5E5E5] dark:[&[data-state=checked]]:border-[#3D4A45] h-[48px] w-full cursor-pointer rounded-[8px] border border-transparent px-2 py-[6px] transition-colors duration-200 [&>span:first-child]:hidden"
  >
    <div className="flex items-center gap-2">
      <div className="dark:bg-prj-bg-secondary flex h-8 w-8 items-center justify-center rounded-[6px] bg-[#F5F5F5] group-hover:bg-[#EBEBEB] group-focus:bg-[#EBEBEB] dark:text-[#B8C9C3]">
        {icon}
      </div>
      <span className="text-sm font-medium text-[#09090B] dark:text-[#F5F9F7]">
        {label}
      </span>
    </div>
  </DropdownMenuRadioItem>
);

interface UserDropdownProps {
  project: {
    id: string;
    name: string;
    logo?: string;
  };
  session: Session;
  credits?: number;
  isLoadingCredits?: boolean;
  sandboxReady?: boolean;
  sandboxFiles?: Set<string>; // Pre-loaded sandbox files
  onOpenPricingModal: () => void;
  onOpenFreeCreditsDialog: () => void;
  onOpenCloudCreditsModal?: () => void;
  onUpdateProjectName: (projectId: string, name: string) => Promise<void>;
}

export const UserDropdown = ({
  project,
  session,
  credits,
  isLoadingCredits,
  sandboxReady = false,
  sandboxFiles,
  onOpenPricingModal,
  onOpenFreeCreditsDialog,
  onOpenCloudCreditsModal,
  onUpdateProjectName,
}: UserDropdownProps) => {
  const { setTheme, theme } = useTheme();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const { user } = session;
  const trpc = useTRPC();

  // Filter sandbox files for export (removes node_modules, .git, etc.)
  const filteredFiles = useFilteredFiles(sandboxFiles);

  // Export to ZIP mutation
  const exportMutation = useMutation(
    trpc.projects.exportToZip.mutationOptions({
      onSuccess: (result) => {
        if (result.success) {
          // Show preparing download toast
          toast.loading("Preparing download...", { id: "export-download" });

          // Convert base64 to blob and trigger download
          const byteCharacters = atob(result.data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "application/zip" });

          // Create download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = result.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          // Dismiss loading toast and show success
          toast.dismiss("export-download");
          toast.success("Project exported successfully!");

          // Close dropdown after successful download
          setIsDropdownOpen(false);
        }
      },
      onError: (error) => {
        console.error("Export error:", error);
        toast.error(error.message || "Failed to export project");
        // Close dropdown on error too
        setIsDropdownOpen(false);
      },
    }),
  );

  const handleStartEdit = () => {
    setIsEditingName(true);
    setEditedName(project.name);
    setIsDropdownOpen(true);
  };

  const handleSaveEdit = async () => {
    if (editedName.trim() && editedName.trim() !== project.name) {
      setIsUpdating(true);
      setUpdateError(null);
      try {
        await onUpdateProjectName(project.id, editedName.trim());
        setIsEditingName(false);
        setEditedName("");
        setIsDropdownOpen(false);
      } catch (error: any) {
        setUpdateError(error.message || "Failed to update project name");
      } finally {
        setIsUpdating(false);
      }
    } else {
      setIsEditingName(false);
      setIsDropdownOpen(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditedName("");
    setUpdateError(null);
    setIsDropdownOpen(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleExportToZip = () => {
    // Don't close dropdown, keep it open to show progress
    if (filteredFiles.length === 0) {
      toast.error("No files available to export");
      return;
    }

    exportMutation.mutate({
      projectId: project.id,
      filePaths: filteredFiles,
    });
  };

  // Calculate credit percentage (max 500 credits)
  const maxCredits = 400;
  const creditPercentage = credits
    ? Math.min((credits / maxCredits) * 100, 100)
    : 0;

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="group p-0! transition-opacity hover:bg-transparent hover:opacity-75 focus-visible:ring-0 dark:hover:bg-transparent"
        >
          {project.logo ? (
            project.logo.startsWith("data:image") ? (
              <img
                src={project.logo}
                alt={`${project.name} logo`}
                width={32}
                height={32}
                className="xs:w-8 xs:h-8 h-6 w-6 rounded object-cover"
              />
            ) : (
              <span className="xs:text-lg text-base">{project.logo}</span>
            )
          ) : (
            <Image
              src="/shipper_logo.png"
              alt="ShipperAI"
              width={32}
              height={32}
              className="xs:w-8 xs:h-8 h-6 w-6"
            />
          )}
          <div className="xs:max-w-[120px] flex max-w-[80px] flex-col items-start md:max-w-[160px]">
            <span className="text-prj-text-title w-full truncate text-sm font-medium dark:text-[#F5F9F7]">
              {deslugifyProjectName(project.name)}
            </span>
          </div>
          <ChevronDown className="xs:h-4 xs:w-4 text-foreground h-3 w-3 dark:text-[#B8C9C3]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="start"
        className="w-[307px] rounded-[16px] bg-white py-1 [box-shadow:0_1px_13.8px_1px_#1212121A] dark:bg-[#1A2421]"
      >
        {/* Go back to dashboard */}
        <MenuItemWithIcon
          icon={<ChevronLeft className="h-4 w-4 dark:text-[#B8C9C3]" />}
          label="Go back to dashboard"
          href="/"
        />

        {/* Rename Project */}
        {isEditingName ? (
          <div className="mx-2 px-2 py-[6px]">
            <div className="flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={handleKeyPress}
                className="h-9 text-sm dark:border-[#26263D] dark:bg-[#26263D] dark:text-[#F5F9F7]"
                autoFocus
                disabled={isUpdating}
                placeholder="Project name"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 dark:text-[#B8C9C3] dark:hover:text-[#F5F9F7]"
                onClick={handleSaveEdit}
                disabled={isUpdating}
              >
                <CheckIcon className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 dark:text-[#B8C9C3] dark:hover:text-[#F5F9F7]"
                onClick={handleCancelEdit}
                disabled={isUpdating}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
            {updateError && (
              <p className="text-destructive mt-2 text-xs dark:text-red-400">
                {updateError}
              </p>
            )}
          </div>
        ) : (
          <MenuItemWithIcon
            icon={<PencilEditIcon className="dark:text-[#B8C9C3]" />}
            label="Rename Project"
            onSelect={(e) => {
              e.preventDefault();
              handleStartEdit();
            }}
          />
        )}
        {/* User Info */}
        <DropdownMenuSeparator className="mx-2 my-1 dark:bg-[#26263D]" />
        <div className="mx-3 py-[6px]">
          <p className="text-sm font-semibold text-[#09090B] dark:text-[#F5F9F7]">
            {user.name}
          </p>
          <p className="mt-0.5 text-sm text-[#79747E] dark:text-[#B8C9C3]">
            {user.email}
          </p>
        </div>

        {/* Credits */}
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            setIsDropdownOpen(false);
            // Use setTimeout to ensure dropdown is fully closed before opening modal
            setTimeout(() => onOpenPricingModal(), 100);
          }}
          className="dark:bg-prj-bg-secondary dark:focus:bg-[#354641] focus:bg-[#E0E0E0] mx-2 mb-2 cursor-pointer flex-col items-start gap-2 rounded-[12px] bg-[#EBEBEB] px-3 py-2 pb-3 transition-colors duration-200 hover:bg-[#E0E0E0] dark:hover:bg-[#354641]"
        >
          <div className="flex w-full items-center justify-between">
            <span className="text-sm font-medium text-[#09090B] dark:text-[#F5F9F7]">
              Builder Credits
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-[#79747E] dark:text-[#B8C9C3]">
                {isLoadingCredits ? "..." : credits || 0} left
              </span>
              <ChevronRight className="h-4 w-4 text-[#79747E] dark:text-[#B8C9C3]" />
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#E8E5DF] dark:bg-[#1A2421]">
            <div
              className="h-full rounded-[4px] bg-emerald-500 transition-all duration-300 dark:bg-emerald-600"
              style={{ width: `${creditPercentage}%` }}
            />
          </div>
        </DropdownMenuItem>

        {/* Cloud Credits */}
        {onOpenCloudCreditsModal && (
          <MenuItemWithIcon
            icon={<Cloud className="h-4 w-4 dark:text-[#B8C9C3]" />}
            label="Cloud Credits"
            onSelect={(e) => {
              e.preventDefault();
              setIsDropdownOpen(false);
              // Use setTimeout to ensure dropdown is fully closed before opening modal
              setTimeout(() => onOpenCloudCreditsModal(), 100);
            }}
          />
        )}
        <DropdownMenuSeparator className="mx-2 my-1 dark:bg-[#26263D]" />

        {/* Win free credits */}
        <MenuItemWithIcon
          icon={<GiftBoxIcon className="dark:text-[#B8C9C3]" />}
          label="Win free credits"
          onSelect={(e) => {
            e.preventDefault();
            setIsDropdownOpen(false);
            // Use setTimeout to ensure dropdown is fully closed before opening modal
            setTimeout(() => onOpenFreeCreditsDialog(), 100);
          }}
        />

        {/* Export to ZIP */}
        <MenuItemWithIcon
          icon={
            exportMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin dark:text-[#B8C9C3]" />
            ) : (
              <Download className="h-4 w-4 dark:text-[#B8C9C3]" />
            )
          }
          label={
            exportMutation.isPending ? "Exporting..." : "Export code (.zip)"
          }
          onClick={handleExportToZip}
          disabled={!sandboxReady || exportMutation.isPending}
          onSelect={(e) => {
            // Prevent dropdown from closing when export is clicked
            e.preventDefault();
          }}
        />

        {/* Appearance */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="group hover:bg-[#F5F5F5] focus:bg-[#F5F5F5] data-[state=open]:bg-[#F5F5F5] dark:hover:bg-[#232D29] dark:focus:bg-[#232D29] dark:data-[state=open]:bg-[#232D29] mx-[4px] mb-1 h-[48px] w-[calc(100%-8px)] cursor-pointer rounded-[12px] py-[6px] transition-all duration-200">
            <div className="flex items-center gap-2">
              <div className="dark:bg-prj-bg-secondary flex h-8 w-8 items-center justify-center rounded-[6px] bg-[#F5F5F5] group-hover:bg-[#EBEBEB] group-focus:bg-[#EBEBEB] group-data-[state=open]:bg-[#EBEBEB] dark:text-[#B8C9C3]">
                <SunLightIcon />
              </div>
              <span className="text-sm font-medium text-[#09090B] dark:text-[#F5F9F7]">
                Appearance
              </span>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="rounded-[16px] p-2 bg-white [box-shadow:0_1px_13.8px_1px_#1212121A] dark:bg-[#1A2421]">
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                <ThemeOption
                  icon={<SunLightIcon />}
                  label="Light"
                  value="light"
                />
                <ThemeOption
                  icon={<Moon className="h-4 w-4" />}
                  label="Dark"
                  value="dark"
                />
                <ThemeOption
                  icon={<Monitor className="h-4 w-4" />}
                  label="System"
                  value="system"
                />
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="mx-2 my-1 dark:bg-[#26263D]" />

        {/* Sign out */}
        <MenuItemWithIcon
          icon={<SignOutIcon className="dark:text-[#B8C9C3]" />}
          label="Sign out"
          onClick={() => signOut({ callbackUrl: "/" })}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
