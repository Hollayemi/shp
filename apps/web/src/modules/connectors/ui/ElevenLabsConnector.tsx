"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ElevenLabsConnectorProps {
    isConnected: boolean;
    isConnecting: boolean;
    isDisconnecting: boolean;
    isRefreshing: boolean;
    metadata?: Record<string, unknown>;
    refreshedMetadata?: {
        metadata?: Record<string, unknown>;
        capabilities?: Record<string, unknown>;
    } | null;
    apiKeyPlaceholder?: string;
    apiKeyHelpText?: string;
    apiKeyInput?: string;
    apiKeyError?: string | null;
    onConnect: (apiKey: string) => void;
    onDisconnect: () => void;
    onRefresh?: () => void;
    onApiKeyInputChange?: (value: string) => void;
    onApiKeyErrorChange?: (error: string | null) => void;
}

export function ElevenLabsConnector({
    isConnected,
    isConnecting,
    isDisconnecting,
    isRefreshing,
    metadata,
    refreshedMetadata,
    apiKeyPlaceholder = "sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    apiKeyHelpText = "Get your API key from elevenlabs.io → Developer Dashboard → API Keys",
    apiKeyInput: externalApiKeyInput,
    apiKeyError: externalApiKeyError,
    onConnect,
    onDisconnect,
    onRefresh,
    onApiKeyInputChange,
    onApiKeyErrorChange,
}: ElevenLabsConnectorProps) {
    const [internalApiKeyInput, setInternalApiKeyInput] = useState("");
    const [internalApiKeyError, setInternalApiKeyError] = useState<string | null>(null);
    
    // Use external state if provided, otherwise use internal
    const apiKeyInput = externalApiKeyInput !== undefined ? externalApiKeyInput : internalApiKeyInput;
    const apiKeyError = externalApiKeyError !== undefined ? externalApiKeyError : internalApiKeyError;

    const handleConnect = () => {
        if (!apiKeyInput.trim()) {
            const error = "Please enter your API key";
            setInternalApiKeyError(error);
            onApiKeyErrorChange?.(error);
            return;
        }
        setInternalApiKeyError(null);
        onApiKeyErrorChange?.(null);
        onConnect(apiKeyInput.trim());
    };

    const handleInputChange = (value: string) => {
        if (onApiKeyInputChange) {
            onApiKeyInputChange(value);
        } else {
            setInternalApiKeyInput(value);
        }
        setInternalApiKeyError(null);
        onApiKeyErrorChange?.(null);
    };

    if (isConnected) {
        return (
            <div className="mb-6 space-y-4">
                <div className="rounded-xl border border-[#E7E5E4] bg-white dark:border-[#26263D] dark:bg-[#1A2421] p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            {isRefreshing ? (
                                <>
                                    <Loader2 className="h-5 w-5 text-[#1E9A80] animate-spin" />
                                    <span className="font-semibold text-sm text-[#141414] dark:text-[#F5F9F7]">Checking plan...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="h-5 w-5 text-[#1E9A80]" />
                                    <span className="font-semibold text-sm text-[#141414] dark:text-[#F5F9F7]">Connected</span>
                                </>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onDisconnect}
                            disabled={isDisconnecting}
                            className="h-8 text-xs text-[#727272] dark:text-[#B8C9C3] border-[#E7E5E4] dark:border-[#26263D] hover:bg-[#F5F5F0] dark:hover:bg-[#1A2421] shadow-none"
                        >
                            {isDisconnecting ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                                <X className="h-3 w-3 mr-1" />
                            )}
                            Disconnect
                        </Button>
                    </div>
                    
                    {!isRefreshing && (refreshedMetadata?.metadata || metadata) && (() => {
                        const firstName = (refreshedMetadata?.metadata?.firstName || metadata?.firstName) as string | undefined;
                        const subscriptionTier = (refreshedMetadata?.metadata?.subscriptionTier || metadata?.subscriptionTier) as string | undefined;
                        
                        return (
                            <div className="space-y-3">
                                {/* User Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    {firstName && (
                                        <div>
                                            <p className="text-sm text-[#727272] dark:text-[#B8C9C3] mb-1">User</p>
                                            <p className="text-sm text-[#141414] dark:text-[#F5F9F7]">
                                                {firstName}
                                            </p>
                                        </div>
                                    )}
                                    {subscriptionTier && (
                                        <div>
                                            <p className="text-sm text-[#727272] dark:text-[#B8C9C3] mb-1">Plan</p>
                                            <p className="text-sm text-[#141414] dark:text-[#F5F9F7] capitalize">
                                                {subscriptionTier}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Capabilities */}
                                {refreshedMetadata?.capabilities && (() => {
                                    const capabilities = refreshedMetadata.capabilities;
                                    const textToSpeech = Boolean(capabilities?.textToSpeech);
                                    const voiceCloning = Boolean(capabilities?.voiceCloning);
                                    const realTimeSynthesis = Boolean(capabilities?.realTimeSynthesis);
                                    const speechToSpeech = Boolean(capabilities?.speechToSpeech);
                                    const aiDubbing = Boolean(capabilities?.aiDubbing);
                                    const multilingualSupport = Boolean(capabilities?.multilingualSupport);
                                    const totalVoices = capabilities?.totalVoices !== undefined ? (capabilities.totalVoices as number) : undefined;
                                    const charactersRemaining = capabilities?.charactersRemaining !== undefined ? (capabilities.charactersRemaining as number) : undefined;
                                    
                                    return (
                                        <div className="pt-3 border-t border-[#E7E5E4] dark:border-[#26263D]">
                                            <p className="text-sm font-semibold text-[#141414] dark:text-[#F5F9F7] mb-3">
                                                Plan Capabilities
                                            </p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {textToSpeech && (
                                                    <div className="flex items-center gap-2">
                                                        <Check className="h-3 w-3 text-[#1E9A80] flex-shrink-0" />
                                                        <span className="text-sm text-[#727272] dark:text-[#B8C9C3]">Text-to-Speech</span>
                                                    </div>
                                                )}
                                                {voiceCloning && (
                                                    <div className="flex items-center gap-2">
                                                        <Check className="h-3 w-3 text-[#1E9A80] flex-shrink-0" />
                                                        <span className="text-sm text-[#727272] dark:text-[#B8C9C3]">Voice Cloning</span>
                                                    </div>
                                                )}
                                                {realTimeSynthesis && (
                                                    <div className="flex items-center gap-2">
                                                        <Check className="h-3 w-3 text-[#1E9A80] flex-shrink-0" />
                                                        <span className="text-sm text-[#727272] dark:text-[#B8C9C3]">Real-time Synthesis</span>
                                                    </div>
                                                )}
                                                {speechToSpeech && (
                                                    <div className="flex items-center gap-2">
                                                        <Check className="h-3 w-3 text-[#1E9A80] flex-shrink-0" />
                                                        <span className="text-sm text-[#727272] dark:text-[#B8C9C3]">Speech-to-Speech</span>
                                                    </div>
                                                )}
                                                {aiDubbing && (
                                                    <div className="flex items-center gap-2">
                                                        <Check className="h-3 w-3 text-[#1E9A80] flex-shrink-0" />
                                                        <span className="text-sm text-[#727272] dark:text-[#B8C9C3]">AI Dubbing</span>
                                                    </div>
                                                )}
                                                {multilingualSupport && (
                                                    <div className="flex items-center gap-2">
                                                        <Check className="h-3 w-3 text-[#1E9A80] flex-shrink-0" />
                                                        <span className="text-sm text-[#727272] dark:text-[#B8C9C3]">Multilingual</span>
                                                    </div>
                                                )}
                                                {totalVoices !== undefined && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-[#727272] dark:text-[#B8C9C3]">
                                                            <span className="text-[#141414] dark:text-[#F5F9F7]">
                                                                {totalVoices || 0}
                                                            </span> Voices
                                                        </span>
                                                    </div>
                                                )}
                                                {charactersRemaining !== undefined && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-[#727272] dark:text-[#B8C9C3]">
                                                            <span className="text-[#141414] dark:text-[#F5F9F7]">
                                                                {charactersRemaining || 0}
                                                            </span> Characters
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })()}
                </div>
            </div>
        );
    }

    // API Key input form
    return (
        <div className="mb-6 rounded-xl border border-[#E7E5E4] bg-white p-4 dark:border-[#26263D] dark:bg-[#1A2421]">
            <label className="block text-sm font-semibold text-[#141414] dark:text-[#F5F9F7] mb-2">
                API Key
            </label>
            <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={apiKeyPlaceholder}
                className={cn(
                    "w-full px-3 py-2 rounded-lg border bg-[#FCFCF9] dark:bg-[#0F1613] text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-[#1E9A80] focus:border-[#1E9A80]",
                    "text-[#141414] dark:text-[#F5F9F7] placeholder:text-[#727272] dark:placeholder:text-[#8A9A94]",
                    apiKeyError
                        ? "border-red-300 dark:border-red-700"
                        : "border-[#E7E5E4] dark:border-[#26263D]"
                )}
                disabled={isConnecting}
            />
            {apiKeyError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{apiKeyError}</p>
            )}
            {apiKeyHelpText && (
                <p className="mt-2 text-xs text-[#727272] dark:text-[#B8C9C3]">
                    {apiKeyHelpText}
                </p>
            )}
            <Button
                onClick={handleConnect}
                disabled={isConnecting || !apiKeyInput.trim()}
                className="mt-4 w-full h-9 bg-[#1E9A80] hover:bg-[#1E9A80]/90 text-white text-sm font-medium"
            >
                {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Connect
            </Button>
        </div>
    );
}
