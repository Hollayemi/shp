"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import type { Session } from "next-auth";
import Image from "next/image";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Coins,
  CreditCard,
  ArrowRight,
  Megaphone,
  Moon,
  Monitor,
  ChevronRight,
} from "lucide-react";
import PricingModal from "./PricingModal";
import { toast } from "sonner";
import FreeCreditsDialog from "./FreeCreditsDialog";
import { useFrillWidget } from "@/hooks/use-frill-widget";
import { useTheme } from "next-themes";
import { GiftBoxIcon } from "@/components/icons/GiftBoxIcon";
import { SunLightIcon } from "@/components/icons/SunLightIcon";
import { SignOutIcon } from "@/components/icons/SignOutIcon";

// Reusable menu item component with icon container (matching UserDropdown.tsx)
interface MenuItemWithIconProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  onSelect?: (e: Event) => void;
  rightElement?: React.ReactNode;
}

const MenuItemWithIcon = ({
  icon,
  label,
  onClick,
  onSelect,
  rightElement,
}: MenuItemWithIconProps) => {
  const content = (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="dark:bg-prj-bg-secondary flex h-8 w-8 items-center justify-center rounded-[6px] bg-[#F5F5F5] group-hover:bg-[#EBEBEB] group-focus:bg-[#EBEBEB] dark:text-[#B8C9C3]">
          {icon}
        </div>
        <span className="text-sm font-medium text-[#09090B] dark:text-[#F5F9F7]">
          {label}
        </span>
      </div>
      {rightElement}
    </div>
  );

  return (
    <DropdownMenuItem
      onClick={onClick}
      onSelect={onSelect}
      className="group mx-[4px] mb-1 h-[48px] cursor-pointer rounded-[12px] py-[6px] transition-all duration-200 hover:bg-[#F5F5F5] focus:bg-[#F5F5F5] dark:hover:bg-[#232D29] dark:focus:bg-[#232D29]"
    >
      {content}
    </DropdownMenuItem>
  );
};

// Reusable theme option component (matching UserDropdown.tsx)
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

interface UserProfileProps {
  session: Session;
}

export function UserProfile({ session }: UserProfileProps) {
  const { user } = session;
  const trpc = useTRPC();
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isFreeCreditsDialogOpen, setIsFreeCreditsDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  // Get user's credit balance
  const {
    data: credits,
    isLoading: isLoadingCredits,
    error: creditsError,
  } = useQuery(trpc.credits.getMyCredits.queryOptions());

  console.log("credits", credits);
  console.log("isLoadingCredits", isLoadingCredits);
  console.log("creditsError", creditsError);

  const createPortalSession = useMutation(
    trpc.checkout.createPortalSession.mutationOptions(),
  );

  const widgetRef = useFrillWidget(
    "widget",
    process.env.NEXT_PUBLIC_FRILL_WIDGET_KEY || "",
  );

  const handleManageSubscription = () => {
    toast.promise(
      createPortalSession.mutateAsync({
        returnUrl: window.location.href,
      }),
      {
        position: "top-center",
        loading: "Opening subscription portal...",
        success: (data) => {
          window.location.href = data.url;
          return "Redirecting to portal...";
        },
        error: (error) => {
          console.error("Error opening subscription portal:", error);
          if (error.message?.includes("not configured")) {
            return "The subscription management portal is not yet configured. Please contact support for assistance.";
          } else if (error.message?.includes("No active subscription")) {
            return "No active subscription found. Please purchase a subscription first.";
          } else {
            return "Unable to open subscription portal. Please try again later.";
          }
        },
      },
    );
  };

  // Calculate credit percentage (max 400 credits)
  const maxCredits = 400;
  const creditBalance = credits?.user.creditBalance || 0;
  const creditPercentage = Math.min((creditBalance / maxCredits) * 100, 100);

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-8 w-8 rounded-full p-0"
            suppressHydrationWarning
          >
            {user.image ? (
              <Image
                className="h-8 w-8 rounded-full"
                src={user.image}
                alt={user.name || "User"}
                width={32}
                height={32}
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                <span className="text-sm font-medium text-white">
                  {user.name?.charAt(0)?.toUpperCase() ||
                    user.email?.charAt(0)?.toUpperCase() ||
                    "U"}
                </span>
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[307px] rounded-[16px] bg-white py-1 [box-shadow:0_1px_13.8px_1px_#1212121A] dark:bg-[#1A2421]"
          align="end"
          forceMount
          suppressHydrationWarning
        >
          {/* User Info */}
          <div className="mx-3 py-[6px]">
            <p className="text-sm font-semibold text-[#09090B] dark:text-[#F5F9F7]">
              {user.name}
            </p>
            <p className="mt-0.5 text-sm text-[#79747E] dark:text-[#B8C9C3]">
              {user.email}
            </p>
            {user.role === "ADMIN" && (
              <p className="mt-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                Admin
              </p>
            )}
          </div>

          {/* Credits with Progress Bar */}
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              setDropdownOpen(false);
              setTimeout(() => setIsPricingModalOpen(true), 100);
            }}
            className="dark:bg-prj-bg-secondary dark:focus:bg-[#354641] focus:bg-[#E0E0E0] mx-2 mb-2 cursor-pointer flex-col items-start gap-2 rounded-[12px] bg-[#EBEBEB] px-3 py-2 pb-3 transition-colors duration-200 hover:bg-[#E0E0E0] dark:hover:bg-[#354641]"
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-sm font-medium text-[#09090B] dark:text-[#F5F9F7]">
                Credits
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-[#79747E] dark:text-[#B8C9C3]">
                  {isLoadingCredits ? "..." : creditBalance} left
                </span>
                <ChevronRight className="h-4 w-4 text-[#79747E] dark:text-[#B8C9C3]" />
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5E5E5] dark:bg-[#1A2421]">
              <div
                className="h-full rounded-[4px] bg-emerald-500 transition-all duration-300 dark:bg-emerald-600"
                style={{ width: `${creditPercentage}%` }}
              />
            </div>
          </DropdownMenuItem>

          {/* Win free credits */}
          <MenuItemWithIcon
            icon={<GiftBoxIcon className="dark:text-[#B8C9C3]" />}
            label="Win free credits"
            rightElement={<ArrowRight className="h-4 w-4 text-[#79747E] dark:text-[#B8C9C3]" />}
            onSelect={(e) => {
              e.preventDefault();
              setDropdownOpen(false);
              setTimeout(() => setIsFreeCreditsDialogOpen(true), 100);
            }}
          />

          {/* Updates & news */}
          <MenuItemWithIcon
            icon={<Megaphone className="h-4 w-4 dark:text-[#B8C9C3]" />}
            label="Updates & news"
            onClick={() => {
              widgetRef.current?.viewSection("announcements");
              widgetRef.current?.open();
            }}
          />

          <DropdownMenuSeparator className="mx-2 my-1 dark:bg-[#26263D]" />

          {/* Manage Subscription */}
          <MenuItemWithIcon
            icon={<CreditCard className="h-4 w-4 dark:text-[#B8C9C3]" />}
            label="Manage subscription"
            onClick={handleManageSubscription}
          />

          {/* Appearance Submenu */}
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

      <FreeCreditsDialog
        open={isFreeCreditsDialogOpen}
        onOpenChange={() => setIsFreeCreditsDialogOpen(false)}
      />
      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
      />
    </>
  );
}
