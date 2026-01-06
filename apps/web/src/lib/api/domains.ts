/**
 * Custom Domain API Client
 * 
 * Client-side functions for managing custom domains
 * Uses Next.js API routes for secure server-side authentication
 */

export interface CustomDomain {
  id: string;
  domain: string;
  isPrimary?: boolean;
  status: 'PENDING_VALIDATION' | 'ACTIVE' | 'FAILED' | 'DELETED';
  sslStatus: 'PENDING' | 'ACTIVE' | 'FAILED';
  cnameTarget: string | null;
  txtName: string | null;
  txtValue: string | null;
  verificationErrors: string[] | null;
  createdAt: string;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
}

/**
 * Create a new custom domain
 */
export async function createCustomDomain(
  projectId: string,
  domain: string
): Promise<{ success: boolean; domain?: CustomDomain; error?: string }> {
  try {
    const response = await fetch('/api/domains', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ projectId, domain }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to create domain' };
    }

    return data;
  } catch (error) {
    console.error('[Domains API] Error creating domain:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * List all domains for a project
 */
export async function listCustomDomains(
  projectId: string
): Promise<{ success: boolean; domains?: CustomDomain[]; error?: string }> {
  try {
    const response = await fetch(`/api/domains/list/${projectId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to list domains' };
    }

    return data;
  } catch (error) {
    console.error('[Domains API] Error listing domains:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Check domain verification status
 */
export async function checkDomainStatus(
  domainId: string
): Promise<{ success: boolean; domain?: CustomDomain; error?: string }> {
  try {
    const response = await fetch(`/api/domains/status/${domainId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to check status' };
    }

    return data;
  } catch (error) {
    console.error('[Domains API] Error checking status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Set a domain as primary for the project
 */
export async function setPrimaryDomain(
  domainId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/domains/${domainId}/set-primary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to set primary domain' };
    }

    return data;
  } catch (error) {
    console.error('[Domains API] Error setting primary domain:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Unset all primary domains for a project (revert to Shipper subdomain)
 */
export async function unsetPrimaryDomain(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/domains/unset-primary/${projectId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to unset primary domain' };
    }

    return data;
  } catch (error) {
    console.error('[Domains API] Error unsetting primary domain:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Delete a custom domain
 */
export async function deleteCustomDomain(
  domainId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/domains/${domainId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to delete domain' };
    }

    return data;
  } catch (error) {
    console.error('[Domains API] Error deleting domain:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
