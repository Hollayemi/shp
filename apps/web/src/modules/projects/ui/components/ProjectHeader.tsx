import { useQuery, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useState, useEffect } from "react";
import { Session } from "next-auth";
import PricingModal from "@/components/PricingModal";
import FreeCreditsDialog from "@/components/FreeCreditsDialog";
import { CloudCreditsModal } from "@/components/CloudCreditsModal";
import { HistoryIcon } from "@/components/icons/HistoryIcon";
import { SidebarIcon } from "@/components/icons/SidebarIcon";
import { SandboxStatusCard, SandboxStatus } from "@/components/ui/sandbox-status-card";
import { UserDropdown } from "./UserDropdown";
import { ProjectTooltip } from "./ProjectTooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { listCustomDomains, type CustomDomain } from "@/lib/api/domains";


export const ProjectHeader = ({
    projectId,
    session,
    projectFiles,
    isSandboxReady,
    sandboxStatus,
    onSuggestionClick,
    onToggleHalPanel,
    isHalPanelOpen,
    hasNewSuggestions,
    onHistoryClick,
    onToggleSidebar,
    isSidebarHidden,
    // Mobile-specific props
    mobileActiveSection,
    onMobileSectionChange,
    tabState,
    hideOnMobile,
    sandboxFiles,
    // External Cloud Credits modal control
    onOpenCloudCreditsModal: externalOpenCloudCreditsModal,
}: {
    projectId: string;
    session: Session;
    projectFiles?: { [path: string]: string } | null;
    isSandboxReady?: boolean;
    sandboxStatus?: SandboxStatus;
    sandboxFiles?: Set<string>; // Pre-loaded sandbox files
    onSuggestionClick?: (prompt: string) => void;
    onToggleHalPanel?: () => void;
    isHalPanelOpen?: boolean;
    hasNewSuggestions?: boolean;
    onHistoryClick?: () => void;
    onToggleSidebar?: () => void;
    isSidebarHidden?: boolean;
    // Mobile-specific props
    mobileActiveSection?: "preview" | "assistant" | "chat";
    onMobileSectionChange?: (section: "preview" | "assistant" | "chat") => void;
    tabState?: "preview" | "code";
    hideOnMobile?: boolean;
    // External Cloud Credits modal control (for sharing modal with Chat component)
    onOpenCloudCreditsModal?: () => void;
}) => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { data: project } = useSuspenseQuery(
        trpc.projects.getOne.queryOptions({ projectId }),
    );
    const [isFreeCreditsDialogOpen, setIsFreeCreditsDialogOpen] = useState(false);
    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
    const [isCloudCreditsModalOpen, setIsCloudCreditsModalOpen] = useState(false);
    const [primaryDomain, setPrimaryDomain] = useState<CustomDomain | null>(null);
    const isMobile = useIsMobile();



    // Load primary custom domain
    useEffect(() => {
        const loadPrimaryDomain = async () => {
            const result = await listCustomDomains(projectId);
            if (result.success && result.domains) {
                const primary = result.domains.find(d => d.isPrimary && d.status === 'ACTIVE');
                setPrimaryDomain(primary || null);
            }
        };

        loadPrimaryDomain();
    }, [projectId]);

    // Get user's credit balance with real-time updates
    const { data: credits, isLoading: isLoadingCredits } = useQuery({
        ...trpc.credits.getMyCredits.queryOptions(),
        refetchInterval: 3000, // Refetch every 3 seconds for real-time credit updates
    });

    // Project name update mutation
    const updateProjectNameMutation = useMutation(
        trpc.projects.updateName.mutationOptions({
            onSuccess: () => {
                // Invalidate project queries to sync across all components
                queryClient.invalidateQueries({
                    queryKey: trpc.projects.getOne.queryKey({ projectId }),
                });
                queryClient.invalidateQueries({
                    queryKey: trpc.projects.getPublishMetadata.queryKey({ projectId }),
                });
            },
        }),
    );

    const handleUpdateProjectName = async (projectId: string, name: string) => {
        await updateProjectNameMutation.mutateAsync({ projectId, name });
    };



    return (
        <header
            className={`flex items-center justify-between bg-prj-bg-primary p-4 h-fit sm:h-[72px] sm:p-[20px] transition-all duration-100 ease-in-out ${isSidebarHidden ? 'pr-3' : ''} ${hideOnMobile ? 'hidden md:flex' : 'flex md:hidden'}`}
        >
            <div className="flex items-center gap-0.5 xs:gap-1">
                <UserDropdown
                    project={{
                        id: projectId,
                        name: project.name,
                        logo: (project as any).logo,
                    }}
                    session={session}
                    credits={credits?.user.creditBalance}
                    isLoadingCredits={isLoadingCredits}
                    sandboxReady={isSandboxReady}
                    sandboxFiles={sandboxFiles}
                    onOpenPricingModal={() => setIsPricingModalOpen(true)}
                    onOpenFreeCreditsDialog={() => setIsFreeCreditsDialogOpen(true)}
                    onOpenCloudCreditsModal={externalOpenCloudCreditsModal ?? (() => setIsCloudCreditsModalOpen(true))}
                    onUpdateProjectName={handleUpdateProjectName}
                />
                {sandboxStatus && (isMobile || !isSidebarHidden) && <SandboxStatusCard status={sandboxStatus} />}
            </div>



            <div className="flex items-center gap-1.5 xs:gap-3">
                {/* Desktop buttons */}
                {!isMobile && (
                    <div className="flex items-center gap-1.5 xs:gap-3">
                        <ProjectTooltip
                            tooltip="Version history"
                            onClick={onHistoryClick}
                        >
                            <HistoryIcon />
                        </ProjectTooltip>
                        {/* <GitHubIntegration projectId={projectId} /> */}
                        <ProjectTooltip
                            tooltip={isSidebarHidden ? "View chat" : "Hide chat"}
                            onClick={onToggleSidebar}
                        >
                            <SidebarIcon />
                        </ProjectTooltip>
                    </div>
                )}

                {/* Mobile buttons */}
                {isMobile && (
                    <>

                        <ProjectTooltip
                            tooltip="Version history"
                            onClick={onHistoryClick}
                        >
                            <HistoryIcon />
                        </ProjectTooltip>
                        {/* <GitHubIntegration projectId={projectId} /> */}
                    </>
                )}
            </div>

            {/* Other modals */}
            <>
                <FreeCreditsDialog
                    open={isFreeCreditsDialogOpen}
                    onOpenChange={() => setIsFreeCreditsDialogOpen(false)}
                />

                <PricingModal
                    isOpen={isPricingModalOpen}
                    onClose={() => setIsPricingModalOpen(false)}
                />

                {/* Only render local CloudCreditsModal if no external control is provided */}
                {!externalOpenCloudCreditsModal && (
                    <CloudCreditsModal
                        isOpen={isCloudCreditsModalOpen}
                        onClose={() => setIsCloudCreditsModalOpen(false)}
                    />
                )}
            </>
        </header>
    );
};
