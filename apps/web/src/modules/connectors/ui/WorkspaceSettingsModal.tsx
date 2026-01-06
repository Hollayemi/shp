"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Loader2,
    Check,
    X,
    ChevronLeft,
    ExternalLink,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface WorkspaceSettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultTab?: string;
}

interface Connector {
    id: string;
    name: string;
    description: string;
    icon: string;
    builtIn?: boolean;
    comingSoon?: boolean;
    overview?: string;
    docsUrl?: string;
}

type ViewState =
    | { type: "list" }
    | { type: "detail"; connector: Connector };

// =============================================================================
// Connector Data
// =============================================================================

const SHARED_CONNECTORS: Connector[] = [
    {
        id: "shipper-cloud",
        name: "Shipper Cloud",
        description: "Built-in backend, ready to use",
        icon: "☁️",
        builtIn: true,
        overview: "Shipper Cloud provides a fully managed backend infrastructure for your applications. It includes database, authentication, and serverless functions out of the box.",
        docsUrl: "https://docs.shipper.dev/cloud",
    },
    {
        id: "stripe",
        name: "Stripe",
        description: "Accept payments and manage subscriptions",
        icon: "💳",
        overview: "Stripe enables you to accept payments, manage subscriptions, and handle billing. Configure once for your team, then AI can generate payment features automatically.",
        docsUrl: "https://stripe.com/docs",
    },
    {
        id: "supabase",
        name: "Supabase",
        description: "Open source Firebase alternative",
        icon: "⚡",
        overview: "Supabase provides database, authentication, storage, and real-time features. Connect your Supabase project to use it as your app's backend.",
        docsUrl: "https://supabase.com/docs",
    },
    {
        id: "resend",
        name: "Resend",
        description: "Modern email API for developers",
        icon: "📧",
        overview: "Resend makes it easy to send transactional emails, notifications, and newsletters. Configure once and AI can generate email features.",
        docsUrl: "https://resend.com/docs",
    },
    {
        id: "shopify",
        name: "Shopify",
        description: "Build an eCommerce store",
        icon: "🛒",
        comingSoon: true,
        overview: "Shopify integration allows you to build custom storefronts and manage eCommerce functionality.",
        docsUrl: "https://shopify.dev/docs",
    },
    {
        id: "twilio",
        name: "Twilio",
        description: "Send SMS and make voice calls",
        icon: "📱",
        comingSoon: true,
        overview: "Twilio enables SMS messaging and voice calls in your apps.",
        docsUrl: "https://www.twilio.com/docs",
    },
];

const PERSONAL_CONNECTORS: Connector[] = [
    {
        id: "notion",
        name: "Notion",
        description: "Access your Notion pages and databases",
        icon: "📝",
        overview: "Notion is a project management and collaboration tool. Connect to give the AI access to your pages, databases, and documentation while building.",
        docsUrl: "https://developers.notion.com/docs/mcp",
    },
    {
        id: "atlassian",
        name: "Atlassian",
        description: "Access your Jira issues and Confluence pages",
        icon: "🎫",
        overview: "Connect to Atlassian to give the AI access to your Jira issues and Confluence documentation. Perfect for building tools that integrate with your project management workflow.",
        docsUrl: "https://developer.atlassian.com",
    },
    // {
    //     id: "linear",
    //     name: "Linear",
    //     description: "Access your Linear issues and project data",
    //     icon: "📋",
    //     overview: "Linear is a modern issue tracking tool. Connect to give the AI access to your issues, projects, and team data while building.",
    //     docsUrl: "https://linear.app/docs",
    // },
    // {
    //     id: "miro",
    //     name: "Miro",
    //     description: "Access your Miro boards and diagrams",
    //     icon: "🎨",
    //     comingSoon: true,
    //     overview: "Miro is a collaborative whiteboard platform. Access your boards and diagrams while building.",
    //     docsUrl: "https://developers.miro.com",
    // },
    // {
    //     id: "figma",
    //     name: "Figma",
    //     description: "Access your Figma design files",
    //     icon: "🎨",
    //     comingSoon: true,
    //     overview: "Connect to Figma to give the AI access to your design files, components, and styles.",
    //     docsUrl: "https://www.figma.com/developers",
    // },
    // {
    //     id: "github",
    //     name: "GitHub",
    //     description: "Connect your GitHub repositories",
    //     icon: "🐙",
    //     comingSoon: true,
    //     overview: "Connect to GitHub to access your repositories, issues, and pull requests.",
    //     docsUrl: "https://docs.github.com",
    // },
];

// =============================================================================
// Sidebar Navigation Items
// =============================================================================

const SIDEBAR_ITEMS = [
    { id: "connectors", label: "Connectors" },
];

// =============================================================================
// Main Component
// =============================================================================

export function WorkspaceSettingsModal({
    open,
    onOpenChange,
    defaultTab = "connectors"
}: WorkspaceSettingsModalProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [viewState, setViewState] = useState<ViewState>({ type: "list" });
    const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

    // Reset view state when tab changes
    useEffect(() => {
        setViewState({ type: "list" });
    }, [activeTab]);

    // Listen for postMessage from OAuth popup
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === "connector-connected") {
                const provider = event.data.provider;
                setConnectingProvider(null);
                queryClient.invalidateQueries({
                    queryKey: trpc.connectors.getStatus.queryKey({ provider }),
                });
                toast.success(`Connected to ${provider}`);
                setViewState({ type: "list" });
            } else if (event.data?.type === "connector-error") {
                setConnectingProvider(null);
                toast.error(`Connection failed: ${event.data.error}`);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [queryClient, trpc.connectors.getStatus]);

    // Fetch connection status for all personal connectors
    const { data: notionStatus } = useQuery(
        trpc.connectors.getStatus.queryOptions({ provider: "notion" })
    ) as { data: { connected: boolean; connection?: { metadata?: Record<string, unknown> } } | undefined };

    const { data: linearStatus } = useQuery(
        trpc.connectors.getStatus.queryOptions({ provider: "linear" })
    ) as { data: { connected: boolean; connection?: { metadata?: Record<string, unknown> } } | undefined };

    const { data: atlassianStatus } = useQuery(
        trpc.connectors.getStatus.queryOptions({ provider: "atlassian" })
    ) as { data: { connected: boolean; connection?: { metadata?: Record<string, unknown> } } | undefined };

    const getOAuthUrl = useMutation(
        trpc.connectors.getOAuthUrl.mutationOptions({
            onSuccess: (data, variables) => {
                if (data.authUrl) {
                    const width = 600;
                    const height = 700;
                    const left = window.screenX + (window.outerWidth - width) / 2;
                    const top = window.screenY + (window.outerHeight - height) / 2;

                    window.open(
                        data.authUrl,
                        `${variables.provider}-oauth`,
                        `width=${width},height=${height},left=${left},top=${top},popup=1`
                    );
                }
            },
            onError: (error) => {
                setConnectingProvider(null);
                toast.error(error.message || "Failed to connect");
            },
        })
    );

    const disconnect = useMutation(
        trpc.connectors.disconnect.mutationOptions({
            onSuccess: (_, variables) => {
                toast.success(`Disconnected from ${variables.provider}`);
                queryClient.invalidateQueries({
                    queryKey: trpc.connectors.getStatus.queryKey({
                        provider: variables.provider,
                    }),
                });
            },
            onError: (error) => {
                toast.error(error.message || "Failed to disconnect");
            },
        })
    );

    const handleConnect = (providerId: string) => {
        setConnectingProvider(providerId);
        getOAuthUrl.mutate({ provider: providerId });
    };

    const handleDisconnect = (providerId: string) => {
        disconnect.mutate({ provider: providerId });
    };

    const getConnectorStatus = (connectorId: string) => {
        // Personal connectors
        if (connectorId === "notion") return notionStatus?.connected ?? false;
        if (connectorId === "linear") return linearStatus?.connected ?? false;
        if (connectorId === "atlassian") return atlassianStatus?.connected ?? false;

        // Shared connectors (these would need real implementation)
        // For now, shipper-cloud and stripe are marked as "built-in" / always available
        if (connectorId === "shipper-cloud" || connectorId === "stripe") return true;

        return false;
    };

    const handleConnectorClick = (connector: Connector) => {
        if (connector.comingSoon) {
            toast.info(`${connector.name} integration coming soon!`);
            return;
        }
        setViewState({ type: "detail", connector });
    };

    // =============================================================================
    // Render Functions
    // =============================================================================

    const renderSidebar = () => (
        <div className="flex w-[131px] flex-col gap-6 pt-1">
            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                orientation="vertical"
                className="w-full"
            >
                <TabsList className="flex h-fit w-full flex-col gap-2 bg-transparent p-0">
                    {SIDEBAR_ITEMS.map((item) => (
                        <TabsTrigger
                            key={item.id}
                            value={item.id}
                            className={cn(
                                "flex w-full items-center justify-start gap-2 rounded-lg px-3 py-2 transition-colors",
                                "data-[state=active]:bg-[#F3F3EE] data-[state=active]:text-sm data-[state=active]:font-medium data-[state=active]:text-[#0D9488] dark:data-[state=active]:bg-[#1A2421] dark:data-[state=active]:text-[#1E9A80]",
                                "text-sm font-normal text-[#717784] hover:bg-[#F5F5F0] data-[state=active]:shadow-none dark:text-[#B8C9C3] dark:hover:bg-[#1A2421]",
                            )}
                        >
                            <div className="flex-1 text-left">{item.label}</div>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
        </div>
    );

    const renderConnectorsList = () => (
        <div className="space-y-8">
            {/* Personal Connectors */}
            <div>
                <h3 className="text-sm font-semibold mb-1 text-gray-900 dark:text-gray-100">Personal connectors</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                    Connect your personal tools to provide context while building. Only you can access your connections.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PERSONAL_CONNECTORS.map((connector) => {
                        const isConnected = getConnectorStatus(connector.id);
                        return (
                            <button
                                key={connector.id}
                                onClick={() => handleConnectorClick(connector)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 text-left transition-all",
                                    "hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50",
                                    connector.comingSoon && "opacity-50 cursor-not-allowed"
                                )}
                                disabled={connector.comingSoon}
                            >
                                <span className="text-2xl">{connector.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{connector.name}</span>
                                        {isConnected && (
                                            <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                                                Connected
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                        {connector.description}
                                    </p>
                                </div>
                                {!connector.comingSoon && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs px-3 py-1.5 h-auto shrink-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleConnectorClick(connector);
                                        }}
                                    >
                                        Set up
                                    </Button>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
            
            {/* Shared Connectors */}
            <div className="hidden">
                <h3 className="text-sm font-semibold mb-1 text-gray-900 dark:text-gray-100">Shared connectors</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                    Add functionality to your apps. Configured once by admins, available to everyone in your workspace.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SHARED_CONNECTORS.map((connector) => {
                        const isEnabled = getConnectorStatus(connector.id);
                        return (
                            <button
                                key={connector.id}
                                onClick={() => handleConnectorClick(connector)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 text-left transition-all",
                                    "hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50",
                                    connector.comingSoon && "opacity-50 cursor-not-allowed"
                                )}
                                disabled={connector.comingSoon}
                            >
                                <span className="text-2xl">{connector.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{connector.name}</span>
                                        {isEnabled && (
                                            <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                                                Enabled
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                        {connector.description}
                                    </p>
                                </div>
                                {!connector.comingSoon && !connector.builtIn && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs px-3 py-1.5 h-auto shrink-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleConnectorClick(connector);
                                        }}
                                    >
                                        Set up
                                    </Button>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

         
        </div>
    );

    const renderConnectorDetail = (connector: Connector) => {
        const isConnected = getConnectorStatus(connector.id);
        const isConnecting = connectingProvider === connector.id;
        const isDisconnecting = disconnect.isPending && disconnect.variables?.provider === connector.id;

        return (
            <div className="max-w-2xl">
                {/* Header with icon, name, and connect button */}
                <div className="flex items-start gap-4 mb-8">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl">
                        {connector.icon}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{connector.name}</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{connector.description}</p>
                    </div>
                    {isConnected && !connector.builtIn ? (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => handleDisconnect(connector.id)}
                                disabled={isDisconnecting}
                                className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                                {isDisconnecting ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : null}
                                Disconnect
                            </Button>
                        </div>
                    ) : !connector.builtIn && !isConnected ? (
                        <Button
                            onClick={() => handleConnect(connector.id)}
                            disabled={isConnecting}
                            className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100"
                        >
                            {isConnecting ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Connect
                        </Button>
                    ) : null}
                </div>

                {/* Overview Section */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Overview</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {connector.overview}
                    </p>
                </div>

                {/* Details Section */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Details</h3>
                    <div className="space-y-2">
                        <div className="flex items-center gap-8">
                            <span className="text-sm text-gray-500 dark:text-gray-400 w-20">Created by</span>
                            <a
                                href={connector.docsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-gray-900 dark:text-gray-100 hover:underline flex items-center gap-1"
                            >
                                {connector.name}
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                        <div className="flex items-center gap-8">
                            <span className="text-sm text-gray-500 dark:text-gray-400 w-20">Docs</span>
                            <a
                                href={connector.docsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                                {connector.docsUrl}
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        if (activeTab !== "connectors") {
            return (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                    <p className="text-sm">Coming soon</p>
                </div>
            );
        }

        if (viewState.type === "detail") {
            return renderConnectorDetail(viewState.connector);
        }

        return renderConnectorsList();
    };

    const getHeaderTitle = () => {
        if (activeTab === "connectors" && viewState.type === "detail") {
            return (
                <button
                    onClick={() => setViewState({ type: "list" })}
                    className="flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Connectors
                </button>
            );
        }

        const tabLabels: Record<string, string> = {
            people: "People",
            plans: "Plans & credits",
            cloud: "Cloud & AI balance",
            security: "Privacy & security",
            labs: "Labs",
            connectors: "Connectors",
            "github-connector": "GitHub",
        };

        return <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tabLabels[activeTab] || "Settings"}</span>;
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="h-[82vh] overflow-scroll flex flex-col justify-start bg-prj-bg-primary !max-w-[981px] p-0 gap-0" showCloseButton={false}>
                    {/* Header */}
                    <div className="p-4 gap-0 border-b border-[#0000000A] dark:border-prj-border-primary flex flex-row justify-between items-start mb-0 h-fit">
                        <div>
                            <h2 className="text-sm font-semibold text-[#14201F] dark:text-[#F5F9F7]">
                                {viewState.type === "detail" ? (
                                    <button
                                        onClick={() => setViewState({ type: "list" })}
                                        className="flex items-center gap-1 hover:text-[#0D9488] transition-colors"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Connectors
                                    </button>
                                ) : (
                                    "Connectors"
                                )}
                            </h2>
                        </div>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="rounded-[5px] opacity-70 transition-opacity hover:opacity-100 border-[1.25px] border-white [box-shadow:0px_0px_0px_0.83px_#DCDEDD,0px_1.67px_3.33px_0px_rgba(198,210,207,0.15)] w-5 h-5 flex items-center justify-center"
                        >
                            <X className="h-3 w-3" />
                            <span className="sr-only">Close</span>
                        </button>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
                        <div className="flex items-start justify-center gap-8">
                            {/* Sidebar */}
                            {renderSidebar()}

                            {/* Content */}
                            <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#E7E5E4] shadow-[0px_1px_1.5px_0px_rgba(20,20,20,0.07)] dark:border-[#26263D]">
                                {/* Content Header */}
                                <div className="flex h-20 items-center justify-between overflow-hidden border-b border-[#E7E5E4] bg-white pl-4 dark:border-[#26263D] dark:bg-[#1a2421]">
                                    <div className="flex flex-col gap-1">
                                        <h1 className="text-lg leading-5 font-semibold text-[#141414] dark:text-[#F5F9F7]">
                                            {viewState.type === "detail" ? viewState.connector.name : "Connectors"}
                                        </h1>
                                        <p className="text-sm leading-5 text-[#727272] dark:text-[#B8C9C3]">
                                            {viewState.type === "detail"
                                                ? viewState.connector.description
                                                : "Connect your tools to enhance your workflow"}
                                        </p>
                                    </div>
                                </div>

                                {/* Content Body */}
                                <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-[#1a2421]">
                                    {renderContent()}
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}