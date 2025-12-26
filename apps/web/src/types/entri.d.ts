/**
 * Type definitions for Entri domain purchasing SDK
 * @see https://docs.entri.com
 */

interface EntriConfig {
  applicationId: string;
  token: string;
  userId: string;
  registrar?: string;
  sellVersion?: 'v3';
  successCallbackUrl?: string;
  exitCallbackUrl?: string;
  debugMode?: boolean;
  prefilledDomain?: string;
  dnsRecords?: Array<{
    type: string;
    host: string;
    value: string;
    ttl: number;
  }>;
  whiteLabel?: {
    hideEntriLogo?: boolean;
    hideConfetti?: boolean;
  };
}

interface EntriCloseDetail {
  success: boolean;
  setupType?: 'purchase' | 'connect';
  freeDomain?: string; // For Entri Sell - the purchased domain
  domain?: string; // For Entri Connect or Sell
  lastStatus?: 'COMPLETED' | 'IN_PROGRESS';
  error?: any;
}

interface Entri {
  showEntri: (config: EntriConfig) => void;
  purchaseDomain: (config: EntriConfig) => void;
  close: () => void;
}

interface Window {
  entri?: Entri;
}
