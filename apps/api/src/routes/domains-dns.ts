/**
 * Custom Domain Management API Routes - DNS Pointing Approach
 * 
 * Simple DNS-based domain verification without Cloudflare for SaaS
 */

import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { prisma } from '@shipper/database';
import dns from 'dns/promises';

const router: ExpressRouter = Router();

// Target host for DNS verification
// Use the fallback origin from Cloudflare config, or a default
const TARGET_HOST = process.env.CLOUDFLARE_FALLBACK_ORIGIN || 
                    process.env.DEPLOYMENT_PLANE_URL?.replace('https://', '').replace('http://', '').split(':')[0] || 
                    'shipper.now';

console.log('[Domains DNS] Using target host:', TARGET_HOST);

console.log('[Domains DNS] Target host for verification:', TARGET_HOST);

/**
 * Verify if a domain points to our servers
 */
async function verifyDNS(domain: string): Promise<{ verified: boolean; type?: 'CNAME' | 'A'; error?: string }> {
  try {
    // Try CNAME first
    try {
      const cnameRecords = await dns.resolveCname(domain);
      console.log(`[Domains DNS] CNAME records for ${domain}:`, cnameRecords);
      
      if (cnameRecords.some(record => record.includes(TARGET_HOST) || record.includes('shipper.now'))) {
        return { verified: true, type: 'CNAME' };
      }
    } catch (error) {
      // CNAME not found, try A record
      console.log(`[Domains DNS] No CNAME found for ${domain}, trying A record`);
    }

    // Try A record
    try {
      const aRecords = await dns.resolve4(domain);
      console.log(`[Domains DNS] A records for ${domain}:`, aRecords);
      
      // Get our target IPs
      const targetIPs = await dns.resolve4(TARGET_HOST);
      console.log(`[Domains DNS] Target IPs for ${TARGET_HOST}:`, targetIPs);
      
      if (aRecords.some(ip => targetIPs.includes(ip))) {
        return { verified: true, type: 'A' };
      }
    } catch (error) {
      console.log(`[Domains DNS] No A record found for ${domain}`);
    }

    return { 
      verified: false, 
      error: 'Domain not pointing to our servers. Please check your DNS configuration.' 
    };
  } catch (error) {
    console.error(`[Domains DNS] Error verifying ${domain}:`, error);
    return { 
      verified: false, 
      error: 'DNS lookup failed. Domain may not exist or DNS not propagated yet.' 
    };
  }
}

/**
 * Validate domain format
 */
function isValidDomain(domain: string): boolean {
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
  return domainRegex.test(domain);
}

/**
 * GET /api/v1/domains/lookup
 * Look up a domain and return the associated project info
 */
router.get('/lookup', async (req: Request, res: Response) => {
  try {
    const { domain } = req.query;

    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'Missing domain parameter' });
    }

    const customDomain = await prisma.customDomain.findFirst({
      where: {
        domain: domain,
        isPrimary: true,
        status: 'ACTIVE',
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            deploymentUrl: true,
          },
        },
      },
    });

    if (!customDomain) {
      return res.status(404).json({ 
        error: 'Domain not found or not active',
        domain,
      });
    }

    return res.json({
      success: true,
      domain: customDomain.domain,
      project: {
        id: customDomain.project.id,
        name: customDomain.project.name,
        deploymentUrl: customDomain.project.deploymentUrl,
      },
    });
  } catch (error) {
    console.error('[Domains DNS] Error looking up domain:', error);
    return res.status(500).json({ error: 'Failed to lookup domain' });
  }
});

/**
 * POST /api/v1/domains
 * Create a new custom domain for a project
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { projectId, domain } = req.body;

    if (!projectId || !domain) {
      return res.status(400).json({ error: 'Missing required fields: projectId, domain' });
    }

    // Validate domain format
    if (!isValidDomain(domain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if domain already exists
    const existingDomain = await prisma.customDomain.findUnique({
      where: { domain },
    });

    if (existingDomain) {
      return res.status(409).json({ error: 'Domain already in use' });
    }

    // Create domain in database with PENDING_VALIDATION status
    const customDomain = await prisma.customDomain.create({
      data: {
        projectId,
        domain,
        status: 'PENDING_VALIDATION',
        sslStatus: 'PENDING',
        cnameTarget: TARGET_HOST,
        verificationErrors: [],
        lastCheckedAt: new Date(),
      },
    });

    console.log(`[Domains DNS] Created custom domain ${domain} for project ${projectId}`);

    // Return DNS instructions
    return res.status(201).json({
      success: true,
      domain: {
        id: customDomain.id,
        domain: customDomain.domain,
        status: customDomain.status,
        sslStatus: customDomain.sslStatus,
        cnameTarget: customDomain.cnameTarget,
        createdAt: customDomain.createdAt,
        dnsInstructions: {
          type: 'CNAME',
          name: domain.split('.')[0], // subdomain part
          value: TARGET_HOST,
          ttl: 3600,
          alternativeType: 'A',
          alternativeValue: 'Get IP from: dig +short ' + TARGET_HOST,
        },
      },
    });
  } catch (error) {
    console.error('[Domains DNS] Error creating custom domain:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Failed to create custom domain: ${errorMessage}` });
  }
});

/**
 * GET /api/v1/domains/:projectId
 * List all custom domains for a project
 */
router.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const domains = await prisma.customDomain.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      domains: domains.map(d => ({
        id: d.id,
        domain: d.domain,
        status: d.status,
        sslStatus: d.sslStatus,
        cnameTarget: d.cnameTarget,
        verificationErrors: d.verificationErrors,
        isPrimary: d.isPrimary,
        createdAt: d.createdAt,
        verifiedAt: d.verifiedAt,
        lastCheckedAt: d.lastCheckedAt,
      })),
    });
  } catch (error) {
    console.error('[Domains DNS] Error listing domains:', error);
    return res.status(500).json({ error: 'Failed to list domains' });
  }
});

/**
 * POST /api/v1/domains/:domainId/verify
 * Verify DNS configuration for a domain
 */
router.post('/:domainId/verify', async (req: Request, res: Response) => {
  try {
    const { domainId } = req.params;

    const domain = await prisma.customDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Verify DNS
    const verification = await verifyDNS(domain.domain);

    // Update database
    const updatedDomain = await prisma.customDomain.update({
      where: { id: domainId },
      data: {
        status: verification.verified ? 'ACTIVE' : 'PENDING_VALIDATION',
        sslStatus: verification.verified ? 'ACTIVE' : 'PENDING',
        verificationErrors: verification.error ? [verification.error] : [],
        lastCheckedAt: new Date(),
        verifiedAt: verification.verified && !domain.verifiedAt ? new Date() : domain.verifiedAt,
      },
    });

    console.log(`[Domains DNS] Verified ${domain.domain}: ${verification.verified ? 'SUCCESS' : 'FAILED'}`);

    return res.json({
      success: true,
      verified: verification.verified,
      dnsType: verification.type,
      domain: {
        id: updatedDomain.id,
        domain: updatedDomain.domain,
        status: updatedDomain.status,
        sslStatus: updatedDomain.sslStatus,
        verifiedAt: updatedDomain.verifiedAt,
        verificationErrors: updatedDomain.verificationErrors,
      },
    });
  } catch (error) {
    console.error('[Domains DNS] Error verifying domain:', error);
    return res.status(500).json({ error: 'Failed to verify domain' });
  }
});

/**
 * GET /api/v1/domains/status/:domainId
 * Check verification status of a domain
 */
router.get('/status/:domainId', async (req: Request, res: Response) => {
  try {
    const { domainId } = req.params;

    const domain = await prisma.customDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    return res.json({
      success: true,
      domain: {
        id: domain.id,
        domain: domain.domain,
        status: domain.status,
        sslStatus: domain.sslStatus,
        cnameTarget: domain.cnameTarget,
        verificationErrors: domain.verificationErrors,
        isPrimary: domain.isPrimary,
        verifiedAt: domain.verifiedAt,
        lastCheckedAt: domain.lastCheckedAt,
      },
    });
  } catch (error) {
    console.error('[Domains DNS] Error checking domain status:', error);
    return res.status(500).json({ error: 'Failed to check domain status' });
  }
});

/**
 * POST /api/v1/domains/:domainId/set-primary
 * Set a domain as the primary domain for the project
 */
router.post('/:domainId/set-primary', async (req: Request, res: Response) => {
  try {
    const { domainId } = req.params;

    const domain = await prisma.customDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    if (domain.status !== 'ACTIVE') {
      return res.status(400).json({ 
        error: 'Only verified domains can be set as primary. Please verify DNS configuration first.' 
      });
    }

    // Unset any existing primary domain for this project
    await prisma.customDomain.updateMany({
      where: { 
        projectId: domain.projectId,
        isPrimary: true,
      },
      data: { isPrimary: false },
    });

    // Set this domain as primary
    const updatedDomain = await prisma.customDomain.update({
      where: { id: domainId },
      data: { isPrimary: true },
    });

    console.log(`[Domains DNS] Set ${domain.domain} as primary for project ${domain.projectId}`);

    return res.json({
      success: true,
      domain: {
        id: updatedDomain.id,
        domain: updatedDomain.domain,
        isPrimary: updatedDomain.isPrimary,
      },
    });
  } catch (error) {
    console.error('[Domains DNS] Error setting primary domain:', error);
    return res.status(500).json({ error: 'Failed to set primary domain' });
  }
});

/**
 * DELETE /api/v1/domains/:domainId
 * Remove a custom domain
 */
router.delete('/:domainId', async (req: Request, res: Response) => {
  try {
    const { domainId } = req.params;

    const domain = await prisma.customDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    await prisma.customDomain.delete({
      where: { id: domainId },
    });

    console.log(`[Domains DNS] Deleted custom domain ${domain.domain}`);

    return res.json({
      success: true,
      message: 'Domain deleted successfully',
    });
  } catch (error) {
    console.error('[Domains DNS] Error deleting domain:', error);
    return res.status(500).json({ error: 'Failed to delete domain' });
  }
});

export default router;
