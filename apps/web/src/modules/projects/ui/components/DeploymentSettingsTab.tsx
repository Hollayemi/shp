"use client";

import { useState, useEffect } from "react";
import {
  useDeploymentSettings,
  UseDeploymentSettingsProps,
} from "@/hooks/useDeploymentSettings";
import { useAutofill } from "@/hooks/useAutofill";
import {
  SubdomainInput,
  AppIconTitle,
  DescriptionInput,
  ShareImageUpload,
  DeploymentActions,
  AutofillButton,
} from "./deploy";
import { Badge } from "@/components/ui/badge";
import { Globe, ExternalLink, CheckCircle2, Clock, XCircle, Copy, Star, RocketIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listCustomDomains, type CustomDomain, setPrimaryDomain, unsetPrimaryDomain } from "@/lib/api/domains";
import { toast } from "sonner";

type DeploymentSettingsTabProps = UseDeploymentSettingsProps;

export function DeploymentSettingsTab(props: DeploymentSettingsTabProps) {
  const [customDomains, setCustomDomains] = useState<CustomDomain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [primaryActiveDomain, setPrimaryActiveDomain] = useState<CustomDomain | null>(null);
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
    isDeploying,
    deploymentUrl,
    sandboxReady,
  } = useDeploymentSettings(props);

  const {
    generateTitle,
    generateDescription,
    isGeneratingTitle,
    isGeneratingDescription,
  } = useAutofill({
    projectId: props.projectId,
    projectName: projectData?.name,
    onSuccess: (creditsUsed) => {
      // TODO: Update user credits in database
      console.log(`Used ${creditsUsed} credits`);
    }
  });

  // Load custom domains
  useEffect(() => {
    const loadDomains = async () => {
      setLoadingDomains(true);
      const result = await listCustomDomains(props.projectId);
      if (result.success && result.domains) {
        setCustomDomains(result.domains);
        // Find primary active domain for web address display
        const primary = result.domains.find(d => d.isPrimary && d.status === 'ACTIVE');
        setPrimaryActiveDomain(primary || null);
      }
      setLoadingDomains(false);
    };

    loadDomains();
  }, [props.projectId]);

  const getStatusBadge = (status: CustomDomain['status']) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'PENDING_VALIDATION':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleDomainSwitch = async (value: string) => {
    if (switchingDomain) return;
    
    setSwitchingDomain(true);
    
    try {
      if (value === 'shipper') {
        // Switch to Shipper subdomain
        const result = await unsetPrimaryDomain(props.projectId);
        if (result.success) {
          // Update local state
          setCustomDomains(prev => prev.map(d => ({ ...d, isPrimary: false })));
          setPrimaryActiveDomain(null);
          toast.success(`Switched to Shipper domain: ${subdomain}.shipper.now`);
        } else {
          toast.error(`Failed to switch domain: ${result.error}`);
        }
      } else {
        // Switch to custom domain
        const domain = customDomains.find(d => d.id === value);
        if (domain) {
          const result = await setPrimaryDomain(domain.id);
          if (result.success) {
            // Update local state
            setCustomDomains(prev => prev.map(d => ({ 
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

  const copyToClipboard = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  // Get current primary domain value for the select
  const getCurrentDomainValue = () => {
    if (primaryActiveDomain) {
      return primaryActiveDomain.id;
    }
    return 'shipper';
  };

  // Get current primary domain URL for display
  const getCurrentDomainUrl = () => {
    if (primaryActiveDomain) {
      return `https://${primaryActiveDomain.domain}`;
    }
    return deploymentUrl || `https://${subdomain}.shipper.now`;
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Web Address Section */}
      <div className="rounded-2xl bg-white dark:bg-[#0F1613] border border-gray-100 dark:border-gray-800 shadow-sm" style={{ padding: '20px' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#14201F] dark:text-[#F5F9F7] mb-1">
              Web Address
            </h3>
            <p className="text-xs text-[#727272] dark:text-[#8A9A94]">
              Configure how users access your app
            </p>
          </div>
          <Globe className="h-5 w-5 text-[#727272] dark:text-[#8A9A94]" />
        </div>

        {/* Domain Switcher */}
        {customDomains.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800/50">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-xs font-semibold text-purple-900 dark:text-purple-100 block mb-1">
                  Primary Domain
                </label>
                <p className="text-xs text-purple-700 dark:text-purple-300">
                  Choose which domain visitors see when they access your app
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(getCurrentDomainUrl())}
                className="h-7 px-3 text-xs bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy URL
              </Button>
            </div>
            <Select
              value={getCurrentDomainValue()}
              onValueChange={handleDomainSwitch}
              disabled={switchingDomain || loadingDomains}
            >
              <SelectTrigger className="w-full">
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
                {customDomains
                  .filter(d => d.status === 'ACTIVE')
                  .map(domain => (
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
        
        {/* Show primary custom domain first if exists */}
        {primaryActiveDomain && (
          <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50">
                  <Globe className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-green-900 dark:text-green-100 truncate">
                      {primaryActiveDomain.domain}
                    </span>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs flex-shrink-0">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      Primary
                    </Badge>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    This is your primary web address
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`https://${primaryActiveDomain.domain}`, '_blank')}
                className="h-8 px-3 bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40 flex-shrink-0"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Visit
              </Button>
            </div>
          </div>
        )}

        {/* Current Web Address Display */}
        <div className="mb-4">
          <label className="text-xs font-medium text-[#14201F] dark:text-[#F5F9F7] block mb-2">
            Current Web Address
          </label>
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
          {primaryActiveDomain && (
            <p className="text-xs text-purple-700 dark:text-purple-300 mt-2">
              Using custom domain • Switch domains above
            </p>
          )}
          {!primaryActiveDomain && (
            <p className="text-xs text-[#727272] dark:text-[#8A9A94] mt-2">
              Using Shipper subdomain • Add custom domains in Domains tab
            </p>
          )}
        </div>



        {/* Other Custom Domains (non-primary) */}
        {!loadingDomains && customDomains.filter(d => !d.isPrimary).length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-xs font-semibold text-[#14201F] dark:text-[#F5F9F7] mb-1">
                  Other Custom Domains
                </h4>
                <p className="text-xs text-[#727272] dark:text-[#8A9A94]">
                  Additional domains that redirect to your primary domain
                </p>
              </div>
              <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-gray-800">
                {customDomains.filter(d => !d.isPrimary).length}
              </Badge>
            </div>
            <div className="space-y-3">
              {customDomains.filter(d => !d.isPrimary).map((domain) => (
                <div
                  key={domain.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Globe className="h-4 w-4 text-[#727272] dark:text-[#8A9A94] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-[#141414] dark:text-[#F5F9F7] truncate block">
                        {domain.domain}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(domain.status)}
                      </div>
                    </div>
                  </div>
                  {domain.status === 'ACTIVE' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`https://${domain.domain}`, '_blank')}
                      className="h-8 px-3 flex-shrink-0"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Visit
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                💡 Manage all domains, add new ones, or configure DNS settings in the <strong>Domains tab</strong>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* App Metadata Section */}
      <div className="rounded-2xl bg-white dark:bg-[#0F1613] border border-gray-100 dark:border-gray-800 shadow-sm" style={{ padding: '20px' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-semibold text-[#14201F] dark:text-[#F5F9F7] mb-1">
              App Metadata
            </h3>
            <p className="text-xs text-[#727272] dark:text-[#8A9A94]">
              Customize how your app appears when shared
            </p>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* App Icon & Title */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-xs font-medium text-[#14201F] dark:text-[#F5F9F7] block mb-1">
                  App Icon & Title
                </label>
                <p className="text-xs text-[#727272] dark:text-[#8A9A94]">
                  The icon and name that appear in browser tabs and bookmarks
                </p>
              </div>
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
            </div>
            <AppIconTitle
              title={title}
              iconUrl={iconUrl}
              isLoadingMetadata={isLoadingMetadata}
              projectName={projectData?.name}
              onTitleChange={setTitle}
              onIconUpload={handleIconUpload}
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-xs font-medium text-[#14201F] dark:text-[#F5F9F7] block mb-1">
                  Description
                </label>
                <p className="text-xs text-[#727272] dark:text-[#8A9A94]">
                  A brief description that appears in search results and social shares
                </p>
              </div>
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
            </div>
            <DescriptionInput
              description={description}
              isLoadingMetadata={isLoadingMetadata}
              onDescriptionChange={setDescription}
            />
          </div>

          {/* Social Share Image */}
          <div>
            <div className="mb-3">
              <label className="text-xs font-medium text-[#14201F] dark:text-[#F5F9F7] block mb-1">
                Social Share Image
              </label>
              <p className="text-xs text-[#727272] dark:text-[#8A9A94]">
                The image that appears when your app is shared on social media
              </p>
            </div>
            <ShareImageUpload
              shareImage={shareImage}
              isLoadingMetadata={isLoadingMetadata}
              onImageUpload={handleImageUpload}
              onImageRemove={() => setShareImage(null)}
            />
          </div>
        </div>
      </div>

      {/* Deployment Actions */}
      <div className="rounded-2xl bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border border-green-200 dark:border-green-800/50" style={{ padding: '20px' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#14201F] dark:text-[#F5F9F7] mb-1">
              Deployment
            </h3>
            <p className="text-xs text-[#727272] dark:text-[#8A9A94]">
              {deploymentUrl ? 'Update your live app with the latest changes' : 'Make your app available to the world'}
            </p>
          </div>
          <RocketIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        
        <DeploymentActions
          hasUnsavedChanges={hasUnsavedChanges()}
          isSaving={isSaving}
          isDeploying={isDeploying}
          sandboxReady={sandboxReady}
          isEditingUrl={isEditingUrl}
          subdomainAvailable={subdomainAvailable}
          deploymentUrl={deploymentUrl}
          showCancel={false}
          onReset={handleReset}
          onPublish={handlePublishWithMetadata}
        />
      </div>
    </div>
  );
}
