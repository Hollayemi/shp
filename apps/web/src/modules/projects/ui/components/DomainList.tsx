"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Trash2, RefreshCw, CheckCircle2, Clock, XCircle, Copy, Check, Star, Link2, ChevronDown } from "lucide-react";
import { CustomDomain, listCustomDomains, checkDomainStatus, deleteCustomDomain, setPrimaryDomain, unsetPrimaryDomain } from "@/lib/api/domains";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface DomainListProps {
  projectId: string;
}

export function DomainList({ projectId }: DomainListProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
  const [selectedRegistrar, setSelectedRegistrar] = useState<string>('Cloudflare');
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  
  // Auto-expand pending domains to show DNS instructions
  useEffect(() => {
    const pendingDomains = domains.filter(d => d.status === 'PENDING_VALIDATION');
    if (pendingDomains.length > 0) {
      setExpandedDomains(prevExpanded => {
        const newExpanded = new Set(prevExpanded);
        pendingDomains.forEach(d => newExpanded.add(d.id));
        return newExpanded;
      });
    }
  }, [domains]);

  // TRPC mutation for updating deployment URL
  const updateDeploymentUrlMutation = useMutation(
    trpc.projects.updateDeploymentUrl.mutationOptions({
      onSuccess: (data, variables) => {
        console.log('[DomainList] Deployment URL updated:', data.deploymentUrl);
        
        // Invalidate project query to refresh deployment URL in UI
        queryClient.invalidateQueries({
          queryKey: trpc.projects.getOne.queryKey({ projectId }),
        });
        
        toast.success(`✓ Domain is now active! Your app is accessible at ${variables.deploymentUrl}`);
      },
      onError: (error) => {
        console.error('[DomainList] Failed to update deployment URL:', error);
        toast.error('Failed to update deployment URL');
      },
    })
  );

  const registrarConfig: Record<string, { type: string; name: string; content: string }> = {
    'Cloudflare': { type: 'Type', name: 'Name', content: 'Content' },
    'GoDaddy': { type: 'Type', name: 'Name', content: 'Value' },
    'Namecheap': { type: 'Type', name: 'Host', content: 'Value' },
    'Google Domains': { type: 'Type', name: 'Host name', content: 'Data' },
    'Squarespace': { type: 'Type', name: 'Host', content: 'Data' },
    'Others': { type: 'Type', name: 'Name', content: 'Content' },
  };

  // Load domains on mount
  useEffect(() => {
    loadDomains();
  }, [projectId]);

  // Auto-poll pending domains every 30 seconds
  useEffect(() => {
    const pendingDomains = domains.filter(d => d.status === 'PENDING_VALIDATION');
    
    if (pendingDomains.length === 0) return;

    const interval = setInterval(() => {
      console.log('[DomainList] Auto-checking status for pending domains');
      pendingDomains.forEach(domain => {
        handleRefreshStatus(domain.id);
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [domains]);

  const loadDomains = async () => {
    setLoading(true);
    setError(null);

    const result = await listCustomDomains(projectId);

    if (result.success && result.domains) {
      setDomains(result.domains || []);
    } else {
      setError(result.error || 'Failed to load domains');
      setDomains([]); // Set empty array on error
    }

    setLoading(false);
  };

  const handleRefreshStatus = async (domainId: string) => {
    setRefreshingId(domainId);

    const result = await checkDomainStatus(domainId);

    if (result.success && result.domain) {
      const updatedDomain = result.domain;
      
      // Update the domain in the list
      setDomains(prev => prev.map(d => d.id === domainId ? updatedDomain : d));

      // Note: We don't update deploymentUrl here because it should always point to the Shipper subdomain
      // The Cloudflare Worker handles routing custom domains to the actual deployment
      if (updatedDomain.status === 'ACTIVE' && updatedDomain.isPrimary) {
        toast.success(`✓ ${updatedDomain.domain} is now active and set as primary!`);
      }
    }

    setRefreshingId(null);
  };

  const handleSetPrimary = async (domainId: string, domain: string) => {
    setSettingPrimaryId(domainId);

    const result = await setPrimaryDomain(domainId);

    if (result.success) {
      // Update the domains list to reflect the new primary
      setDomains(prev => prev.map(d => ({
        ...d,
        isPrimary: d.id === domainId,
      })));

      // Note: We don't update deploymentUrl because it should always point to the Shipper subdomain
      // The Cloudflare Worker handles routing custom domains to the actual deployment
      toast.success(`✓ ${domain} is now your primary domain!`);
    } else {
      toast.error(`Failed to set primary domain: ${result.error}`);
    }

    setSettingPrimaryId(null);
  };

  const handleDelete = async (domainId: string, domain: string) => {
    if (!confirm(`Are you sure you want to remove ${domain}?`)) {
      return;
    }

    const result = await deleteCustomDomain(domainId);

    if (result.success) {
      setDomains(prev => prev.filter(d => d.id !== domainId));
      
      // Note: We don't need to update deploymentUrl because it always points to the Shipper subdomain
      // The Cloudflare Worker will automatically route to the Shipper subdomain when no primary custom domain exists
      toast.success(`Domain ${domain} removed successfully`);
    } else {
      toast.error(`Failed to delete domain: ${result.error}`);
    }
  };

  const copyToClipboard = async (text: string, domainId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(domainId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: CustomDomain['status']) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'PENDING_VALIDATION':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  const getSSLBadge = (sslStatus: CustomDomain['sslStatus']) => {
    switch (sslStatus) {
      case 'ACTIVE':
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            SSL Active
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            SSL Pending
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="outline" className="text-red-600 border-red-600">
            SSL Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-[#8A9A94]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        <Button onClick={loadDomains} variant="outline" size="sm" className="mt-2">
          Try Again
        </Button>
      </div>
    );
  }

  if (domains.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Globe className="h-12 w-12 text-[#8A9A94] mb-3" />
        <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
          No custom domains connected yet
        </p>
        <p className="text-xs text-[#8A9A94] mt-1">
          Connect a domain to get started
        </p>
      </div>
    );
  }

  // Get project data for Shipper subdomain
  const projectData = queryClient.getQueryData(
    trpc.projects.getOne.queryKey({ projectId })
  ) as { subdomain?: string; name?: string; deploymentUrl?: string } | undefined;
  const shipperSubdomain = projectData?.subdomain || projectData?.name;
  const shipperDeploymentUrl = projectData?.deploymentUrl;
  
  // Check if any custom domain is primary
  const hasCustomPrimaryDomain = domains.some(d => d.isPrimary && d.status === 'ACTIVE');

  const handleSetShipperAsPrimary = async () => {
    // Unset all custom domains as primary
    const result = await unsetPrimaryDomain(projectId);

    if (result.success) {
      // Update local state
      setDomains(prev => prev.map(d => ({ ...d, isPrimary: false })));

      // Update project deployment URL to use Shipper subdomain
      if (shipperSubdomain) {
        updateDeploymentUrlMutation.mutate({
          projectId,
          deploymentUrl: `https://${shipperSubdomain}.shipper.now`,
        });
        toast.success(`Shipper domain is now primary: ${shipperSubdomain}.shipper.now`);
      }
    } else {
      toast.error(`Failed to set Shipper domain as primary: ${result.error}`);
    }
  };

  return (
    <div className="space-y-3">
      {/* Shipper Subdomain Card */}
      {shipperSubdomain && (
        <div className="rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-[#0F1613] p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50">
                <Globe className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Shipper Domain</span>
              </div>
              {!hasCustomPrimaryDomain && (
                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  Primary
                </Badge>
              )}
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
            {hasCustomPrimaryDomain && (
              <Button
                onClick={handleSetShipperAsPrimary}
                size="sm"
                variant="outline"
                className="h-7 text-xs border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950"
              >
                <Star className="h-3 w-3 mr-1" />
                Make Primary
              </Button>
            )}
          </div>
          <h4 className="font-semibold text-[#141414] dark:text-[#F5F9F7] mb-1">
            {shipperDeploymentUrl ? new URL(shipperDeploymentUrl).hostname : `${shipperSubdomain}.shipper.now`}
          </h4>
          <p className="text-xs text-[#727272] dark:text-[#8A9A94]">
            Free subdomain provided by Shipper • Always active
          </p>
        </div>
      )}

      {/* Custom Domains Section Header */}
      {domains.length > 0 && shipperSubdomain && (
        <div className="flex items-center gap-2 pt-2">
          <div className="h-px flex-1 bg-[#E5E5E5] dark:bg-[#26263D]" />
          <span className="text-xs font-medium text-[#727272] dark:text-[#8A9A94] uppercase tracking-wide">
            Custom Domains
          </span>
          <div className="h-px flex-1 bg-[#E5E5E5] dark:bg-[#26263D]" />
        </div>
      )}

      {/* Custom Domains */}
      {domains.map((domain) => {
        const isExpanded = expandedDomains.has(domain.id);
        const toggleExpanded = () => {
          const newExpanded = new Set(expandedDomains);
          if (isExpanded) {
            newExpanded.delete(domain.id);
          } else {
            newExpanded.add(domain.id);
          }
          setExpandedDomains(newExpanded);
        };

        return (
        <div
          key={domain.id}
          className="rounded-lg border border-[#E5E5E5] dark:border-[#26263D] bg-white dark:bg-[#0F1613] overflow-hidden"
        >
          {/* Header - Always visible */}
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div 
                className="flex-1 cursor-pointer"
                onClick={toggleExpanded}
              >
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-[#141414] dark:text-[#F5F9F7]">
                    {domain.domain}
                  </h4>
                  {domain.isPrimary && (
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      Primary
                    </Badge>
                  )}
                  {getStatusBadge(domain.status)}
                  {getSSLBadge(domain.sslStatus)}
                </div>
                <p className="text-xs text-[#727272] dark:text-[#8A9A94]">
                  Added {domain.createdAt ? new Date(domain.createdAt).toLocaleDateString() : 'Recently'}
                </p>
              </div>

              <div className="flex gap-2 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefreshStatus(domain.id);
                  }}
                  disabled={refreshingId === domain.id}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshingId === domain.id ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(domain.id, domain.domain);
                  }}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleExpanded}
                  className="h-8 w-8 p-0"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </div>
          </div>

          {/* Expandable Content */}
          {isExpanded && (
            <div className="px-4 pb-4 pt-3 border-t border-[#E5E5E5] dark:border-[#26263D]">
              {/* Primary Domain Button */}
              {domain.status === 'ACTIVE' && !domain.isPrimary && (
            <div className="mb-3">
              <Button
                onClick={() => handleSetPrimary(domain.id, domain.domain)}
                disabled={settingPrimaryId === domain.id}
                size="sm"
                variant="outline"
                className="w-full border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950"
              >
                <Link2 className="h-3 w-3 mr-2" />
                {settingPrimaryId === domain.id ? 'Setting...' : 'Use this domain for this project'}
              </Button>
            </div>
          )}

          {domain.isPrimary && domain.status === 'ACTIVE' && (
            <div className="mb-3 rounded-md bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 p-3">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <Globe className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-purple-900 dark:text-purple-100">
                    Active Web Address
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                    This domain is your project&apos;s primary web address
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Active Domain Success Banner */}
          {domain.status === 'ACTIVE' && (
            <div className="mb-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
                    Domain is Active!
                  </h4>
                  <p className="text-xs text-green-700 dark:text-green-300 mb-2">
                    Your domain is configured and ready. Your app is now accessible at:
                  </p>
                  <a
                    href={`https://${domain.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-green-700 dark:text-green-300 hover:underline"
                  >
                    https://{domain.domain}
                    <Globe className="h-3 w-3" />
                  </a>
                  {domain.sslStatus === 'ACTIVE' && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                      🔒 SSL certificate is active and secure
                    </p>
                  )}
                </div>
              </div>
              <Button
                onClick={() => window.open(`https://${domain.domain}`, '_blank')}
                size="sm"
                className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white"
              >
                <Globe className="h-4 w-4 mr-2" />
                Test Domain
              </Button>
            </div>
          )}

          {/* DNS Instructions */}
          {domain.status === 'PENDING_VALIDATION' && domain.cnameTarget && (
            <div className="mt-4">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-[#141414] dark:text-[#F5F9F7]">
                      Add these DNS records to your domain registrar
                    </h4>
                    <p className="text-sm text-[#727272] dark:text-[#8A9A94] mt-1">
                      Choose your domain provider below to see the correct field names:
                    </p>
                  </div>
                  <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-400">
                    DNS propagation pending
                  </Badge>
                </div>
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 mt-3">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Both records are required:</strong> The CNAME record points your domain to {domain.cnameTarget}, and the TXT record verifies domain ownership. Add both records to complete setup.
                  </p>
                </div>
              </div>

              {/* Registrar Tabs */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {Object.keys(registrarConfig).map((registrar) => (
                  <button
                    key={registrar}
                    onClick={() => setSelectedRegistrar(registrar)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${selectedRegistrar === registrar
                      ? 'bg-[#F3F3EE] dark:bg-[#26263D] text-[#141414] dark:text-[#F5F9F7]'
                      : 'text-[#727272] dark:text-[#8A9A94] hover:bg-[#F3F3EE] dark:hover:bg-[#26263D]/50'
                      }`}
                  >
                    {registrar}
                  </button>
                ))}
              </div>

              {/* DNS Table */}
              <div className="rounded-xl border border-[#E5E5E5] dark:border-[#26263D] overflow-hidden bg-[#F9F9F9] dark:bg-[#151515]">
                {/* Table Header */}
                <div className="grid grid-cols-[100px_150px_1fr] gap-3 p-3 bg-[#F3F3EE] dark:bg-[#1A2421] border-b border-[#E5E5E5] dark:border-[#26263D]">
                  <div className="text-xs font-medium text-[#727272] dark:text-[#8A9A94]">
                    {registrarConfig[selectedRegistrar].type}
                  </div>
                  <div className="text-xs font-medium text-[#727272] dark:text-[#8A9A94]">
                    {registrarConfig[selectedRegistrar].name}
                  </div>
                  <div className="text-xs font-medium text-[#727272] dark:text-[#8A9A94]">
                    {registrarConfig[selectedRegistrar].content}
                  </div>
                </div>

                {/* CNAME Record */}
                <div className="grid grid-cols-[100px_150px_1fr] gap-3 p-3 items-center bg-white dark:bg-[#0F1613] border-b border-[#E5E5E5] dark:border-[#26263D]">
                  <div className="font-medium text-sm text-[#141414] dark:text-[#F5F9F7]">
                    CNAME
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-[#141414] dark:text-[#F5F9F7]">@</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard('@', `${domain.id}-cname-name`)}
                      className="h-5 w-5 p-0 flex-shrink-0"
                      title="Copy name"
                    >
                      {copiedId === `${domain.id}-cname-name` ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3 text-[#727272]" />
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="font-mono text-xs text-[#141414] dark:text-[#F5F9F7] truncate" title={domain.cnameTarget || undefined}>
                      {domain.cnameTarget}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(domain.cnameTarget!, `${domain.id}-cname-target`)}
                      className="h-5 w-5 p-0 flex-shrink-0"
                      title="Copy target"
                    >
                      {copiedId === `${domain.id}-cname-target` ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3 text-[#727272]" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* TXT Record for Ownership Verification - REQUIRED */}
                {domain.txtName && domain.txtValue ? (
                  <div className="grid grid-cols-[100px_150px_1fr] gap-3 p-3 items-center bg-white dark:bg-[#0F1613]">
                    <div className="font-medium text-sm text-[#141414] dark:text-[#F5F9F7]">
                      TXT
                    </div>
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="text-sm text-[#141414] dark:text-[#F5F9F7] truncate" title={domain.txtName}>
                        {domain.txtName === domain.domain ? '@' : domain.txtName.replace(`.${domain.domain}`, '')}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(domain.txtName!, `${domain.id}-txt-name`)}
                        className="h-5 w-5 p-0 flex-shrink-0"
                        title="Copy name"
                      >
                        {copiedId === `${domain.id}-txt-name` ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3 text-[#727272]" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="font-mono text-xs text-[#141414] dark:text-[#F5F9F7] truncate" title={domain.txtValue}>
                        {domain.txtValue}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(domain.txtValue!, `${domain.id}-txt-value`)}
                        className="h-5 w-5 p-0 flex-shrink-0"
                        title="Copy value"
                      >
                        {copiedId === `${domain.id}-txt-value` ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3 text-[#727272]" />
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 border-t border-[#E5E5E5] dark:border-[#26263D]">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      ⚠️ TXT record not yet generated. Please refresh the status to get your TXT verification record.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1 h-10 bg-white dark:bg-[#0F1613] border-[#E5E5E5] dark:border-[#26263D] text-[#141414] dark:text-[#F5F9F7] hover:bg-[#F3F3EE] dark:hover:bg-[#1A2421]"
                  onClick={() => {/* Handle go back if needed */ }}
                >
                  Go Back
                </Button>
                <Button
                  className="flex-1 h-10 bg-[#0D9488] hover:bg-[#0D9488]/90 text-white"
                  onClick={() => handleRefreshStatus(domain.id)}
                  disabled={refreshingId === domain.id}
                >
                  {refreshingId === domain.id ? (
                    <>Checking... <RefreshCw className="h-4 w-4 ml-2 animate-spin" /></>
                  ) : (
                    "Check Status"
                  )}
                </Button>
              </div>

              <p className="text-xs text-[#727272] dark:text-[#8A9A94] text-center mt-3">
                NS changes can take up to 24 hours to propagate worldwide
              </p>
            </div>
          )}

              {/* Verification Errors - Subtle Alert */}
              {domain.verificationErrors && domain.verificationErrors.length > 0 && (
                <div className="mt-3">
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
                          Configuration issue detected
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                          {domain.verificationErrors[0]}
                          {domain.verificationErrors.length > 1 && ` (+${domain.verificationErrors.length - 1} more)`}
                        </p>
                        <details className="text-xs text-amber-700 dark:text-amber-300">
                          <summary className="cursor-pointer font-medium hover:underline mb-1">
                            View troubleshooting steps
                          </summary>
                          <ol className="mt-2 ml-4 space-y-1 list-decimal text-xs">
                            <li>Verify both CNAME and TXT records are added correctly</li>
                            <li>Check that there are no conflicting DNS records (A, AAAA)</li>
                            <li>Wait 24-48 hours for DNS propagation</li>
                            <li>Ensure your domain registrar allows CNAME records on root domain</li>
                            <li>Try using a subdomain (e.g., www.{domain.domain}) instead</li>
                          </ol>
                        </details>
                      </div>
                      <Button
                        onClick={() => handleRefreshStatus(domain.id)}
                        disabled={refreshingId === domain.id}
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30 flex-shrink-0"
                      >
                        {refreshingId === domain.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <>Retry</>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
