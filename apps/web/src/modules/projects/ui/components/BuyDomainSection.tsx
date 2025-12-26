"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Globe, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface BuyDomainSectionProps {
  projectId: string;
  onDomainPurchased: (domain: string) => void;
}

// Ensure entri-root element exists
const ensureEntriRoot = (): HTMLElement => {
  let entriRoot = document.getElementById('entri-root');

  if (!entriRoot) {
    entriRoot = document.createElement('div');
    entriRoot.id = 'entri-root';
    document.body.appendChild(entriRoot);
    console.log('[Entri] Created entri-root element');
  }

  return entriRoot;
};

export function BuyDomainSection({ projectId, onDomainPurchased }: BuyDomainSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEntriLoaded, setIsEntriLoaded] = useState(false);
  const [isEntriOpen, setIsEntriOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cachedToken, setCachedToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);

  const hasLoadedRef = useRef(false);
  
  // Extract env vars at module level to avoid inline warnings
  const ENTRI_APP_ID = process.env.NEXT_PUBLIC_ENTRI_APP_ID;
  const ENTRI_REGISTRAR = process.env.NEXT_PUBLIC_ENTRI_REGISTRAR;
  const ENTRI_DEBUG_MODE = process.env.NEXT_PUBLIC_ENTRI_DEBUG_MODE;
  
  const isRegistrarConfigured = !!ENTRI_REGISTRAR;

  // Validate environment variables
  useEffect(() => {
    const missingVars = [];

    if (!ENTRI_APP_ID) {
      missingVars.push('NEXT_PUBLIC_ENTRI_APP_ID');
    }
    if (!ENTRI_REGISTRAR) {
      missingVars.push('NEXT_PUBLIC_ENTRI_REGISTRAR');
    }

    if (missingVars.length > 0) {
      console.warn('[Entri] Missing environment variables:', missingVars);
      setLoadError(`Missing: ${missingVars.join(', ')}`);
    }
  }, [ENTRI_APP_ID, ENTRI_REGISTRAR]);

  // Load Entri SDK - robust implementation
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadEntriSDK = async () => {
      console.log("[Entri] Loading SDK...");

      // Check if already loaded
      if ((window as any).entri) {
        console.log("[Entri] SDK already available");
        setIsEntriLoaded(true);
        return;
      }

      // Create entri-root element immediately
      ensureEntriRoot();

      try {
        // Load script with promise
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.goentri.com/entri.js";
          script.async = true;

          script.onload = () => {
            console.log("[Entri] Script loaded");
            // Wait for SDK to initialize
            setTimeout(() => {
              if ((window as any).entri) {
                console.log("[Entri] ✅ SDK ready!");
                setIsEntriLoaded(true);
                resolve();
              } else {
                reject(new Error("Entri SDK not available after script load"));
              }
            }, 500);
          };

          script.onerror = () => {
            reject(new Error("Failed to load Entri SDK script"));
          };

          document.body.appendChild(script);
        });
      } catch (error) {
        console.error("[Entri] Failed to load SDK:", error);
        setLoadError("Failed to load Entri SDK");
      }
    };

    loadEntriSDK();
  }, []);

  // Prefetch token
  useEffect(() => {
    let isMounted = true;

    if (isEntriLoaded && !cachedToken && !isLoadingToken) {
      console.log('[Entri] Prefetching token...');
      getEntriToken().catch((error) => {
        if (isMounted) {
          console.error('[Entri] Failed to prefetch token:', error);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [isEntriLoaded, cachedToken, isLoadingToken]);

  // Handle Entri events
  useEffect(() => {
    const cleanupEntriModal = () => {
      console.log('[Entri] Cleaning up modal...');

      // Remove entri-root element completely
      const entriRoot = document.getElementById('entri-root');
      if (entriRoot) {
        // First clear all content
        entriRoot.innerHTML = '';
        // Then remove the element
        entriRoot.remove();
        console.log('[Entri] Removed entri-root');
      }

      // Re-enable pointer events on body and all elements
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';

      // Remove any leftover Entri elements
      const entriElements = document.querySelectorAll('[class*="entri"], [id*="entri"]');
      entriElements.forEach(el => {
        if (el.id !== 'entri-root') {
          (el as HTMLElement).remove();
        }
      });

      // Force re-enable pointer events on all Radix elements
      const radixOverlays = document.querySelectorAll('[data-radix-dialog-overlay]');
      const radixDialogs = document.querySelectorAll('[role="dialog"]');

      radixOverlays.forEach(overlay => {
        (overlay as HTMLElement).style.pointerEvents = '';
      });

      radixDialogs.forEach(dialog => {
        (dialog as HTMLElement).style.pointerEvents = '';
      });

      console.log('[Entri] ✅ Cleanup complete');
    };

    const handleEntriClose = (event: Event) => {
      const detail = (event as any)?.detail;
      console.log('[Entri] Modal closed:', detail);

      // Cleanup immediately
      setTimeout(cleanupEntriModal, 100);
      setIsEntriOpen(false);

      if (detail?.error) {
        console.error('[Entri] Error:', detail.error);
        setLoadError(detail.error?.message || "Domain operation failed");
        return;
      }

      if (detail?.success) {
        const domain = detail.freeDomain || detail.domain || detail.hostname;
        if (domain) {
          console.log('[Entri] Domain purchased:', domain);
          onDomainPurchased(domain);
        }
      }
    };

    const handleEntriError = (event: Event) => {
      const detail = (event as any)?.detail;
      console.error('[Entri] Error event:', detail);

      // Cleanup on error too
      setTimeout(cleanupEntriModal, 100);
      setIsEntriOpen(false);
      setLoadError(detail?.message || "An error occurred");
    };

    const handleEntriStepChange = (event: Event) => {
      const detail = (event as any)?.detail;
      console.log('[Entri] Step changed:', detail);
    };

    window.addEventListener('onEntriClose', handleEntriClose);
    window.addEventListener('onEntriError', handleEntriError);
    window.addEventListener('onEntriStepChange', handleEntriStepChange);

    return () => {
      window.removeEventListener('onEntriClose', handleEntriClose);
      window.removeEventListener('onEntriError', handleEntriError);
      window.removeEventListener('onEntriStepChange', handleEntriStepChange);
    };
  }, [onDomainPurchased]);

  // Manage modal layering when Entri opens
  useEffect(() => {
    if (!isEntriOpen) return;

    console.log('[Entri] Managing modal layers...');

    // Store original values to restore later
    const originalStyles = new Map<HTMLElement, {
      zIndex: string;
      pointerEvents: string;
      inert?: boolean;
    }>();

    const setupEntriModal = () => {
      // Find ALL Radix overlays and dialogs
      const radixOverlays = document.querySelectorAll('[data-radix-dialog-overlay]');
      const radixDialogs = document.querySelectorAll('[role="dialog"]');

      // Disable pointer events on ALL Radix overlays
      radixOverlays.forEach(overlay => {
        const overlayEl = overlay as HTMLElement;
        if (!originalStyles.has(overlayEl)) {
          originalStyles.set(overlayEl, {
            zIndex: overlayEl.style.zIndex,
            pointerEvents: overlayEl.style.pointerEvents,
          });
        }
        // Make overlay non-interactive but keep it visible
        overlayEl.style.pointerEvents = 'none';
        console.log('[Entri] Disabled overlay pointer-events');
      });

      // Keep dialogs visible but non-interactive
      radixDialogs.forEach(dialog => {
        const dialogEl = dialog as HTMLElement;
        if (!originalStyles.has(dialogEl)) {
          originalStyles.set(dialogEl, {
            zIndex: dialogEl.style.zIndex,
            pointerEvents: dialogEl.style.pointerEvents,
          });
        }
        dialogEl.style.pointerEvents = 'none';
        console.log('[Entri] Disabled dialog pointer-events');
      });

      // Setup Entri modal on top - container should NOT block clicks
      const entriRoot = document.getElementById('entri-root');
      if (entriRoot) {
        entriRoot.style.cssText = `
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 999999 !important;
          pointer-events: none !important;
        `;

        // Enable pointer events on actual modal content inside entri-root
        const entriContent = entriRoot.querySelector('[class*="entri"], [class*="modal"], iframe');
        if (entriContent) {
          (entriContent as HTMLElement).style.pointerEvents = 'auto';
          console.log('[Entri] ✅ Modal content interactive');
        }

        console.log('[Entri] ✅ Modal layers configured');
      }
    };

    // Setup immediately and retry as Entri modal loads
    setupEntriModal();
    const timer1 = setTimeout(setupEntriModal, 100);
    const timer2 = setTimeout(setupEntriModal, 300);
    const timer3 = setTimeout(setupEntriModal, 500);
    const timer4 = setTimeout(setupEntriModal, 1000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);

      console.log('[Entri] Restoring original styles...');

      // Restore ALL original styles
      originalStyles.forEach((originalValue, element) => {
        element.style.zIndex = originalValue.zIndex;
        element.style.pointerEvents = originalValue.pointerEvents;
      });

      // Ensure body is interactive
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';

      console.log('[Entri] ✅ Styles restored');
    };
  }, [isEntriOpen]);

  const getEntriToken = async (): Promise<string> => {
    if (cachedToken) {
      console.log('[Entri] Using cached token');
      return cachedToken;
    }

    try {
      setIsLoadingToken(true);
      const response = await fetch('/api/entri/token', { method: 'POST' });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.token) {
        throw new Error('No token received');
      }

      setCachedToken(data.token);
      return data.token;
    } catch (error) {
      console.error('[Entri] Token error:', error);
      throw error;
    } finally {
      setIsLoadingToken(false);
    }
  };

  const handleBuyDomain = async () => {
    console.log("[Entri] Buy Domain clicked");
    setLoadError(null);

    if (!isRegistrarConfigured) {
      setLoadError("⚠️ Set NEXT_PUBLIC_ENTRI_REGISTRAR in .env");
      return;
    }

    // Clean up any existing entri-root first
    const existingRoot = document.getElementById('entri-root');
    if (existingRoot) {
      existingRoot.remove();
      console.log('[Entri] Removed existing entri-root');
    }

    // Create fresh entri-root
    ensureEntriRoot();

    if (!isEntriLoaded) {
      setLoadError("Entri SDK loading...");
      return;
    }

    const entri = (window as any).entri;
    if (!entri?.purchaseDomain) {
      setLoadError("Entri SDK not available");
      return;
    }

    try {
      const token = await getEntriToken();
      const isDebugMode = ENTRI_DEBUG_MODE === 'true';

      // Working config from Entri support
      const config = {
        applicationId: ENTRI_APP_ID!,
        token: token,
        sellVersion: 'v3',
        preferred_registrar: ENTRI_REGISTRAR!,
        searchType: 'classic',
        freeDomain: isDebugMode,
        whiteLabel: {
          theme: {
            primary: '#0D9488',
            onPrimary: '#ffffff',
            secondary: '#ffffff',
            onSecondary: '#0D9488',
          },
          sell: {
            partnerName: 'Shipper',
          },
        },
        dnsRecords: [
          {
            value: 'shipper.now',
            host: '@',
            ttl: 300,
            type: 'CNAME'
          }
        ],
        successCallbackUrl: `${window.location.origin}/projects/${projectId}?domain-success=true`,
        exitCallbackUrl: `${window.location.origin}/projects/${projectId}`,
      };

      console.log('[Entri] Opening modal with config:', { ...config, token: '***' });

      setIsEntriOpen(true);
      entri.purchaseDomain(config);

    } catch (error: any) {
      console.error("[Entri] Error:", error);
      setLoadError(error?.message || "Failed to open modal");
      setIsEntriOpen(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="p-2 bg-[#F3F3EE] dark:bg-[#1A2421] rounded-2xl">
        <div className="flex items-center justify-between p-2 gap-4">
          <CollapsibleTrigger asChild>
            <button className="flex-1 flex items-center gap-2">
              <div className="flex-1 text-left flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[#0D9488]" />
                  <h3 className="font-medium text-[#141414] dark:text-[#F5F9F7] leading-6">
                    Buy a New Domain
                  </h3>
                </div>
                <p className="text-sm text-[#727272] dark:text-[#8A9A94] leading-5">
                  Purchase a custom domain like mycompany.com
                </p>
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-7 h-7 bg-[#E6E6DB] dark:bg-[#0F1613] rounded-md flex items-center justify-center">
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-[#28303F] dark:text-[#B8C9C3]" />
              ) : (
                <ChevronDown className="h-5 w-5 text-[#28303F] dark:text-[#B8C9C3]" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="p-2 bg-white dark:bg-[#0F1613] rounded-2xl border border-[#E5E5E5] dark:border-[#26263D]">
            <div className="p-4 space-y-3">
              {loadError && (
                <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-700 dark:text-yellow-300 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">
                      {loadError}
                    </p>
                  </div>
                </div>
              )}

              <Button
                onClick={handleBuyDomain}
                disabled={!isEntriLoaded || isLoadingToken || !isRegistrarConfigured || isEntriOpen}
                className="w-full h-11 bg-[#0D9488] hover:bg-[#0D9488]/90 text-white disabled:opacity-50 font-medium text-[15px]"
              >
                {isEntriOpen
                  ? "Modal Open..."
                  : !isEntriLoaded
                    ? "Loading..."
                    : isLoadingToken
                      ? "Getting ready..."
                      : !isRegistrarConfigured
                        ? "Not Configured"
                        : "Buy Custom Domain"}
              </Button>

              {cachedToken && isRegistrarConfigured && (
                <p className="text-xs text-green-600 dark:text-green-400 text-center">
                  ✓ Ready to purchase
                </p>
              )}

              {ENTRI_DEBUG_MODE === 'true' && (
                <div className="rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-2">
                  <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
                    🎭 <strong>Debug Mode:</strong> Test with a previously purchased domain
                  </p>
                </div>
              )}

              <p className="text-xs text-[#727272] dark:text-[#8A9A94] text-center">
                Powered by {ENTRI_REGISTRAR || 'Entri'}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
