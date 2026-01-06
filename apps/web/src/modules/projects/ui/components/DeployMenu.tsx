"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSetAtom } from "jotai";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RocketIcon, Globe, Star } from "lucide-react";
import { useState, useEffect } from "react";
import { useDeploymentSettings } from "@/hooks/useDeploymentSettings";
import {
  CollapsibleSection,
  SubdomainInput,
  AppIconTitle,
  DescriptionInput,
  ShareImageUpload,
  DeploymentActions,
  AutofillButton,
} from "./deploy";
import { useAutofill } from "@/hooks/useAutofill";
import { toast } from "sonner";
import { listCustomDomains, type CustomDomain, setPrimaryDomain, unsetPrimaryDomain } from "@/lib/api/domains";
import { openSettingsWithTabAtom } from "@/lib/atoms/settings";

interface DeployMenuProps {
  projectId: string;
  isDeploying: boolean;
  isDeployed: boolean;
  deploymentUrl?: string;
  deployedAt?: Date;
  needsUpdate?: boolean;
  onDeploy: (subdomain?: string) => void;
  className?: string;
  sandboxReady?: boolean;
}

export const DeployMenu = ({
  projectId,
  isDeploying,
  isDeployed,
  deploymentUrl,
  deployedAt,
  needsUpdate = false,
  onDeploy,
  className,
  sandboxReady,
}: DeployMenuProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [primaryActiveDomain, setPrimaryActiveDomain] = useState<CustomDomain | null>(null);
  const [allCustomDomains, setAllCustomDomains] = useState<CustomDomain[]>([]);
  const [switchingDomain, setSwitchingDomain] = useState(false);

  const {
    subdomain,
    title,
    iconUrl,
    description,
    shareImage,
    isEditingUrl,
    subdomainAvailable,
    subdomainError,
    isSaving,
    isCheckingSubdomain,
    isLoadingMetadata,
    hasSetInitialSubdomain,
    projectData,
    isDomainOpen,
    setIsDomainOpen,
    isIconTitleOpen,
    setIsIconTitleOpen,
    isDescriptionOpen,
    setIsDescriptionOpen,
    isShareImageOpen,
    setIsShareImageOpen,
    setTitle,
    setDescription,
    setShareImage,
    handleSubdomainChange,
    handleUrlClick,
    handleUrlFocus,
    handleUrlBlur,
    handleEditUrlClick,
    handleReset,
    handlePublishWithMetadata,
    handleImageUpload,
    handleIconUpload,
    hasUnsavedChanges,
  } = useDeploymentSettings({
    projectId,
    deploymentUrl,
    isDeploying,
    isDeployed,
    needsUpdate,
    onDeploy,
    sandboxReady,
    deployedAt,
    initialCollapsibleState: {
      isDomainOpen: true,
      isIconTitleOpen: false,
      isDescriptionOpen: false,
      isShareImageOpen: false,
    },
  });

  const {
    generateTitle,
    generateDescription,
    isGeneratingTitle,
    isGeneratingDescription,
  } = useAutofill({
    projectId,
    projectName: projectData?.name,
    onSuccess: (creditsUsed) => {
      console.log(`Used ${creditsUsed} credits`);
    }
  });

  // Atom setter for opening settings with specific tab
  const openSettingsWithTab = useSetAtom(openSettingsWithTabAtom);

  // Load custom domains
  useEffect(() => {
    const loadDomains = async () => {
      console.log('[DeployMenu] Loading domains for project:', projectId);
      const result = await listCustomDomains(projectId);
      console.log('[DeployMenu] Domain loading result:', result);
      
      if (result.success && result.domains) {
        console.log('[DeployMenu] Found domains:', result.domains);
        setAllCustomDomains(result.domains);
        // Find primary active domain for web address display
        const primary = result.domains.find(d => d.isPrimary && d.status === 'ACTIVE');
        console.log('[DeployMenu] Primary active domain:', primary);
        setPrimaryActiveDomain(primary || null);
      } else {
        console.log('[DeployMenu] No domains found or error:', result.error);
        setAllCustomDomains([]);
        setPrimaryActiveDomain(null);
      }
    };

    loadDomains();
  }, [projectId]);

  // Handle domain switching
  const handleDomainSwitch = async (value: string) => {
    if (switchingDomain) return;
    
    setSwitchingDomain(true);
    
    try {
      if (value === 'shipper') {
        // Switch to Shipper subdomain
        const result = await unsetPrimaryDomain(projectId);
        if (result.success) {
          // Update local state
          setAllCustomDomains(prev => prev.map(d => ({ ...d, isPrimary: false })));
          setPrimaryActiveDomain(null);
          toast.success(`Switched to Shipper domain: ${subdomain}.shipper.now`);
        } else {
          toast.error(`Failed to switch domain: ${result.error}`);
        }
      } else {
        // Switch to custom domain
        const domain = allCustomDomains.find(d => d.id === value);
        if (domain) {
          const result = await setPrimaryDomain(domain.id);
          if (result.success) {
            // Update local state
            setAllCustomDomains(prev => prev.map(d => ({ 
              ...d, 
              isPrimary: d.id === value 
            })));
            setPrimaryActiveDomain(domain);
            toast.success(`Switched to custom domain: ${domain.domain}`);
          } else {
            toast.error(`Failed to switch domain: ${result.error}`);
          }
        }
      }
    } catch (error) {
      toast.error('Failed to switch domain');
    } finally {
      setSwitchingDomain(false);
    }
  };

  // Get current primary domain value for the select
  const getCurrentDomainValue = () => {
    if (primaryActiveDomain) {
      return primaryActiveDomain.id;
    }
    return 'shipper';
  };

  // Get active domains (only ACTIVE status)
  const activeDomains = allCustomDomains.filter(d => d.status === 'ACTIVE');

  const getButtonVariant = () => {
    if (isDeployed && needsUpdate) return "secondary";
    if (isDeployed) return "default";
    return "outline";
  };

  const getButtonText = () => {
    if (isSaving) return "Saving...";
    return "Publish";
  };

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant={getButtonVariant()}
          className={`active-[#146B5A] dark:active-[#146B5A] h-7 cursor-pointer rounded-[6px] bg-[#1E9A80] px-3 font-semibold text-[#F0F6FF] hover:bg-[#17816B] hover:text-[#F0F6FF] dark:bg-[#1E9A80] dark:hover:bg-[#17816B] ${className}`}
          disabled={isDeploying || !sandboxReady}
        >
          {/* {getStatusIcon()} */}
          <span>{getButtonText()}</span>
          {/* <ChevronDownIcon className="h-3 w-3 ml-1" /> */}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={6}
        alignOffset={0}
        className="w-[360px] rounded-[16px] bg-[#FCFCF9] px-1 pt-1 pb-1.5 shadow-[0px_1px_13.8px_1px_rgba(18,18,18,0.10)] dark:bg-[#1A2421]"
      >
        {/* Header */}
        <div className="px-2 py-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="text-sm leading-5 font-semibold text-[#1C1C1C] dark:text-[#F5F9F7]">
                App Settings
              </div>
              <div className="text-xs leading-[16.8px] font-normal text-[#727272] dark:text-[#B8C9C3]">
                Make your project live and track its performance.
              </div>
            </div>
            {/* Deployment Status Badge */}
            {deploymentUrl ? (
              <Badge
                variant="secondary"
                className="bg-prj-bg-status-ready text-prj-text-status-ready gap-1.5 rounded-full border border-transparent px-3 py-[6px] text-xs leading-none font-medium"
              >
                <RocketIcon className="text-prj-text-status-ready h-3 w-3" />
                <span>Live</span>
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-muted/50 text-muted-foreground border-border gap-1.5 rounded-full border px-3 py-[6px] text-xs leading-none font-medium"
              >
                <span className="bg-muted-foreground h-1.5 w-1.5 rounded-full" />
                <span>Not deployed</span>
              </Badge>
            )}
          </div>
        </div>
        <DropdownMenuSeparator className="mx-auto w-[340px]" />

        {/* Your app's web address */}
        <CollapsibleSection
          isOpen={isDomainOpen}
          onOpenChange={setIsDomainOpen}
          title="Your app's web address"
        >
          <SubdomainInput
            subdomain={subdomain}
            subdomainError={subdomainError}
            isEditingUrl={isEditingUrl}
            isCheckingSubdomain={isCheckingSubdomain}
            subdomainAvailable={subdomainAvailable}
            hasSetInitialSubdomain={hasSetInitialSubdomain}
            deploymentUrl={primaryActiveDomain ? `https://${primaryActiveDomain.domain}` : deploymentUrl}
            projectName={projectData?.name}
            customDomain={primaryActiveDomain?.domain}
            onSubdomainChange={handleSubdomainChange}
            onUrlClick={handleUrlClick}
            onUrlFocus={handleUrlFocus}
            onUrlBlur={handleUrlBlur}
            onEditUrlClick={handleEditUrlClick}
          />
          
          {/* Domain Switcher - Show when user has active domains */}
          {activeDomains.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800/50">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="text-xs font-semibold text-purple-900 dark:text-purple-100 block mb-1">
                    Primary Domain
                  </label>
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    Choose which domain visitors see
                  </p>
                </div>
                {activeDomains.length > 1 && (
                  <Badge variant="outline" className="text-xs bg-white/50 dark:bg-black/20">
                    {activeDomains.length} domains
                  </Badge>
                )}
              </div>
              <Select
                value={getCurrentDomainValue()}
                onValueChange={handleDomainSwitch}
                disabled={switchingDomain}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shipper">
                    <div className="flex items-center gap-2">
                      <Globe className="h-3 w-3" />
                      <span>{subdomain}.shipper.now</span>
                      <Badge variant="outline" className="text-xs">Free</Badge>
                    </div>
                  </SelectItem>
                  {activeDomains.map(domain => (
                    <SelectItem key={domain.id} value={domain.id}>
                      <div className="flex items-center gap-2">
                        <Globe className="h-3 w-3" />
                        <span>{domain.domain}</span>
                        <Badge variant="outline" className="text-xs">Custom</Badge>
                        {domain.isPrimary && (
                          <Star className="h-3 w-3 fill-current text-purple-600" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          

          
          {/* Show current domain status if custom domain is active */}
          {primaryActiveDomain && (
            <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800/50">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/50 flex-shrink-0">
                  <svg className="h-3 w-3 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-green-900 dark:text-green-100">
                    Using custom domain: {primaryActiveDomain.domain}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    <button 
                      onClick={() => {
                        openSettingsWithTab('domains');
                        setIsDropdownOpen(false);
                      }}
                      className="underline hover:no-underline"
                    >
                      Manage domains
                    </button> or switch to Shipper subdomain
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Always show manage domains link when no custom domain is active */}
          {!primaryActiveDomain && (
            <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800/50">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex-shrink-0">
                  <Globe className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">
                    Using Shipper subdomain: {subdomain}.shipper.now
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <button 
                      onClick={() => {
                        openSettingsWithTab('domains');
                        setIsDropdownOpen(false);
                      }}
                      className="underline hover:no-underline"
                    >
                      Manage domains
                    </button> or add a custom domain
                  </p>
                </div>
              </div>
            </div>
          )}
        </CollapsibleSection>
        <DropdownMenuSeparator className="mx-auto w-[340px]" />

        {/* App Icon & Title */}
        <CollapsibleSection
          isOpen={isIconTitleOpen}
          onOpenChange={setIsIconTitleOpen}
          title="App Icon & Title"
          action={
            <AutofillButton
              onClick={async () => {
                const generatedTitle = await generateTitle(title);
                if (generatedTitle) {
                  setTitle(generatedTitle);
                  toast.success('Title generated successfully!');
                }
              }}
              isLoading={isGeneratingTitle}
              disabled={!projectData}
              context="title"
            />
          }
        >
          <AppIconTitle
            title={title}
            iconUrl={iconUrl}
            isLoadingMetadata={isLoadingMetadata}
            projectName={projectData?.name}
            onTitleChange={setTitle}
            onIconUpload={handleIconUpload}
          />
        </CollapsibleSection>

        {/* Description */}
        <CollapsibleSection
          isOpen={isDescriptionOpen}
          onOpenChange={setIsDescriptionOpen}
          title="Description"
          action={
            <AutofillButton
              onClick={async () => {
                const generatedDescription = await generateDescription(title, description);
                if (generatedDescription) {
                  setDescription(generatedDescription);
                  toast.success('Description generated successfully!');
                }
              }}
              isLoading={isGeneratingDescription}
              disabled={!projectData}
              context="description"
            />
          }
        >
          <DescriptionInput
            description={description}
            isLoadingMetadata={isLoadingMetadata}
            onDescriptionChange={setDescription}
          />
        </CollapsibleSection>

        {/* Social Share Image */}
        <CollapsibleSection
          isOpen={isShareImageOpen}
          onOpenChange={setIsShareImageOpen}
          title="Social Share Image"
        >
          <ShareImageUpload
            shareImage={shareImage}
            isLoadingMetadata={isLoadingMetadata}
            onImageUpload={handleImageUpload}
            onImageRemove={() => setShareImage(null)}
          />
        </CollapsibleSection>

        {/* Action Buttons */}
        <DeploymentActions
          hasUnsavedChanges={hasUnsavedChanges()}
          isSaving={isSaving}
          isDeploying={isDeploying}
          sandboxReady={sandboxReady}
          isEditingUrl={isEditingUrl}
          subdomainAvailable={subdomainAvailable}
          deploymentUrl={deploymentUrl}
          showCancel={true}
          onReset={handleReset}
          onCancel={() => setIsDropdownOpen(false)}
          onPublish={handlePublishWithMetadata}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

