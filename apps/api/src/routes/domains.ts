/**
 * Custom Domain Management API Routes
 * 
 * Handles custom domain operations for Cloudflare for SaaS integration
 */

import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@shipper/database';
import { createCloudflareService, CloudflareSaaSService } from '../services/cloudflare-saas.js';
import { forceHttpsForDeployments } from '../utils/deployment-url.js';

const router: ExpressRouter = Router();



/**
 * GET /api/domains/lookup
 * Look up a domain and return the associated project info
 * Used by Cloudflare Worker to route custom domains
 */
router.get('/lookup', async (req: Request, res: Response) => {
  try {
    // Validate API key from Cloudflare Worker
    const apiKey = req.headers['x-api-key'];
    const workerApiKey = process.env.WORKER_API_KEY;
    
    if (!workerApiKey) {
      console.error("[Domains] WORKER_API_KEY not configured!");
      return res.status(500).json({ error: "Server configuration error" });
    }

    let isAuthorized = false;
    if (apiKey && typeof apiKey === 'string') {
      const expectedKeyBuffer = Buffer.from(workerApiKey);
      const providedKeyBuffer = Buffer.from(apiKey);
      if (expectedKeyBuffer.length === providedKeyBuffer.length) {
        isAuthorized = timingSafeEqual(expectedKeyBuffer, providedKeyBuffer);
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { domain } = req.query;

    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'Missing domain parameter' });
    }

    // Find the custom domain that is primary and active
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
            paymentStatus: true,
            gracePeriodEnds: true,
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

    // Ensure deployment URL is HTTPS for staging/production deployments
    const deploymentUrl = forceHttpsForDeployments(
      customDomain.project.deploymentUrl || '', 
      'DomainsAPI'
    );

    return res.json({
      success: true,
      domain: customDomain.domain,
      project: {
        id: customDomain.project.id,
        name: customDomain.project.name,
        deploymentUrl: deploymentUrl,
        paymentStatus: customDomain.project.paymentStatus,
        gracePeriodEnds: customDomain.project.gracePeriodEnds,
      },
    });
  } catch (error) {
    console.error('[Domains] Error looking up domain:', error);
    return res.status(500).json({ error: 'Failed to lookup domain' });
  }
});

/**
 * GET /api/domains/metadata/:projectId
 * Get metadata for a deployed project (used by domain router for meta tags)
 */
router.get('/metadata/:projectId', async (req: Request, res: Response) => {
  try {
    // Validate API key from Cloudflare Worker
    const apiKey = req.headers['x-api-key'];
    const workerApiKey = process.env.WORKER_API_KEY;
    
    if (!workerApiKey) {
      console.error("[Domains] WORKER_API_KEY not configured!");
      return res.status(500).json({ error: "Server configuration error" });
    }

    let isAuthorized = false;
    if (apiKey && typeof apiKey === 'string') {
      const expectedKeyBuffer = Buffer.from(workerApiKey);
      const providedKeyBuffer = Buffer.from(apiKey);
      if (expectedKeyBuffer.length === providedKeyBuffer.length) {
        isAuthorized = timingSafeEqual(expectedKeyBuffer, providedKeyBuffer);
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ error: 'Missing projectId parameter' });
    }

    // Get project with metadata from the latest fragment
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        subtitle: true,
        deploymentUrl: true,
        sandboxId: true,
        daytonaSandboxId: true,
        sandboxProvider: true,
      },
    });

    if (!project) {
      return res.status(404).json({ 
        error: 'Project not found',
        projectId,
      });
    }

    // Default fallback metadata
    let title = project.name || 'Shipper App';
    let description = project.subtitle || `${project.name} - Built with Shipper`;
    let iconUrl: string | null = null;
    let shareImageUrl: string | null = null;

    // Try to get dynamic metadata from sandbox if available (Modal only for now)
    const provider = (project.sandboxProvider as "modal" | "daytona" | null) || "modal";
    const sandboxId = provider === "modal" ? project.sandboxId : project.daytonaSandboxId;

    if (sandboxId && provider === "modal") {
      try {
        // Import Modal sandbox manager
        const { readFile } = await import("../services/modal-sandbox-manager.js");

        // Read index.html from sandbox
        const htmlContent = await readFile(sandboxId, "index.html");

        // Parse metadata from HTML
        const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/);
        const iconMatch = htmlContent.match(
          /<link[^>]*rel=["']icon["'][^>]*href=["']([^"']*)["']/,
        );
        const descriptionMatch = htmlContent.match(
          /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/,
        );
        const ogImageMatch = htmlContent.match(
          /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/,
        );

        // Update metadata with parsed values
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1];
        }
        if (descriptionMatch && descriptionMatch[1]) {
          description = descriptionMatch[1];
        }

        // For now, we don't extract icon/image data URLs in the API app
        // The web app metadata route can handle that with its API clients
        
      } catch (error) {
        console.warn("[Domains] Failed to read metadata from sandbox:", error);
        // Continue with fallback metadata
      }
    }

    const response = {
      success: true,
      projectId: project.id,
      projectName: project.name,
      deploymentUrl: project.deploymentUrl,
      metadata: {
        title,
        description,
        iconUrl,
        shareImageUrl,
        // Additional SEO metadata
        ogTitle: title,
        ogDescription: description,
        ogImage: shareImageUrl,
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: shareImageUrl,
      },
    };

    return res.json(response);
  } catch (error) {
    console.error('[Domains] Error fetching project metadata:', error);
    return res.status(500).json({ error: 'Failed to fetch project metadata' });
  }
});

/**
 * POST /api/domains
 * Create a new custom domain for a project
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { projectId, domain } = req.body;

    if (!projectId || !domain) {
      return res.status(400).json({ error: 'Missing required fields: projectId, domain' });
    }

    // Validate domain format
    if (!CloudflareSaaSService.isValidDomain(domain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }

    // Check for prohibited domains (Cloudflare restrictions)
    const prohibitedDomains = ['example.com', 'example.net', 'example.org', 'test.com', 'localhost'];
    const domainLower = domain.toLowerCase();
    
    for (const prohibited of prohibitedDomains) {
      if (domainLower === prohibited || domainLower.endsWith(`.${prohibited}`)) {
        return res.status(400).json({ 
          error: `Domain "${domain}" is not allowed. Please use a real domain you own.` 
        });
      }
    }

    // Check for localhost or IP addresses
    if (domainLower.includes('localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
      return res.status(400).json({ 
        error: 'Cannot use localhost or IP addresses. Please use a real domain name.' 
      });
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

    // Create custom hostname in Cloudflare
    let cfHostname: any;
    
    try {
      const cloudflare = createCloudflareService();
      cfHostname = await cloudflare.createCustomHostname(domain, projectId);
    } catch (cloudflareError: any) {
      console.error('[Domains] Cloudflare API error:', cloudflareError);
      
      // Parse Cloudflare error messages
      let errorMessage = 'Failed to create custom domain';
      
      if (cloudflareError.message) {
        const msg = cloudflareError.message.toLowerCase();
        
        if (msg.includes('example.com') || msg.includes('example.net') || msg.includes('example.org')) {
          errorMessage = 'Cannot use example domains. Please use a real domain you own.';
        } else if (msg.includes('already exists') || msg.includes('duplicate')) {
          errorMessage = 'This domain is already registered with Cloudflare.';
        } else if (msg.includes('invalid') || msg.includes('malformed')) {
          errorMessage = 'Invalid domain format. Please check your domain name.';
        } else if (msg.includes('rate limit')) {
          errorMessage = 'Too many requests. Please try again in a few minutes.';
        } else if (msg.includes('unauthorized') || msg.includes('forbidden')) {
          errorMessage = 'Cloudflare authentication error. Please contact support.';
        } else {
          errorMessage = cloudflareError.message;
        }
      }
      
      return res.status(400).json({ error: errorMessage });
    }

    // Extract TXT records from SSL validation records or ownership verification
    let txtName: string | undefined;
    let txtValue: string | undefined;

    // Check ownership_verification first (for ownership verification)
    if (cfHostname.ownership_verification?.name && cfHostname.ownership_verification?.value) {
      txtName = cfHostname.ownership_verification.name;
      txtValue = cfHostname.ownership_verification.value;
    }
    // Check ssl.validation_records for TXT records (for SSL validation)
    else if (cfHostname.ssl.validation_records && cfHostname.ssl.validation_records.length > 0) {
      const txtRecord = cfHostname.ssl.validation_records.find((r: { txt_name?: string; txt_value?: string }) => r.txt_name && r.txt_value);
      if (txtRecord) {
        txtName = txtRecord.txt_name;
        txtValue = txtRecord.txt_value;
      }
    }

    console.log('[Domains] Cloudflare response:', {
      hostname: cfHostname.hostname,
      status: cfHostname.status,
      sslStatus: cfHostname.ssl.status,
      sslMethod: cfHostname.ssl.method,
      ownershipVerification: cfHostname.ownership_verification,
      validationRecords: cfHostname.ssl.validation_records,
      txtName,
      txtValue,
    });

    // Save to database
    const customDomain = await prisma.customDomain.create({
      data: {
        projectId,
        domain,
        cloudflareHostnameId: cfHostname.id,
        status: CloudflareSaaSService.mapCloudflareStatus(cfHostname.status),
        sslStatus: CloudflareSaaSService.mapSSLStatus(cfHostname.ssl.status),
        cnameTarget: CloudflareSaaSService.getCnameTarget(cfHostname),
        txtName: txtName,
        txtValue: txtValue,
        verificationErrors: cfHostname.verification_errors || [],
        lastCheckedAt: new Date(),
      },
    });

    console.log(`[Domains] Created custom domain ${domain} for project ${projectId}`);

    return res.status(201).json({
      success: true,
      domain: {
        id: customDomain.id,
        domain: customDomain.domain,
        status: customDomain.status,
        sslStatus: customDomain.sslStatus,
        cnameTarget: customDomain.cnameTarget,
        txtName: customDomain.txtName,
        txtValue: customDomain.txtValue,
        verificationErrors: customDomain.verificationErrors,
        isPrimary: customDomain.isPrimary,
        createdAt: customDomain.createdAt,
      },
    });
  } catch (error) {
    console.error('[Domains] Error creating custom domain:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Failed to create custom domain: ${errorMessage}` });
  }
});

/**
 * GET /api/domains/:projectId
 * List all custom domains for a project
 */
router.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get all domains for this project
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
        txtName: d.txtName,
        txtValue: d.txtValue,
        verificationErrors: d.verificationErrors,
        isPrimary: d.isPrimary,
        createdAt: d.createdAt,
        verifiedAt: d.verifiedAt,
        lastCheckedAt: d.lastCheckedAt,
      })),
    });
  } catch (error) {
    console.error('[Domains] Error listing domains:', error);
    return res.status(500).json({ error: 'Failed to list domains' });
  }
});

/**
 * GET /api/domains/status/:domainId
 * Check verification status of a domain
 */
router.get('/status/:domainId', async (req: Request, res: Response) => {
  try {
    const { domainId } = req.params;

    // Get domain
    const domain = await prisma.customDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Check status with Cloudflare
    if (domain.cloudflareHostnameId) {
      const cloudflare = createCloudflareService();
      const cfHostname = await cloudflare.getCustomHostname(domain.cloudflareHostnameId);

      // Extract TXT records from SSL validation records or ownership verification
      let txtName: string | undefined = domain.txtName || undefined;
      let txtValue: string | undefined = domain.txtValue || undefined;

      // Check ownership_verification first (for ownership verification)
      if (cfHostname.ownership_verification?.name && cfHostname.ownership_verification?.value) {
        txtName = cfHostname.ownership_verification.name;
        txtValue = cfHostname.ownership_verification.value;
      }
      // Check ssl.validation_records for TXT records (for SSL validation)
      else if (cfHostname.ssl.validation_records && cfHostname.ssl.validation_records.length > 0) {
        const txtRecord = cfHostname.ssl.validation_records.find(r => r.txt_name && r.txt_value);
        if (txtRecord) {
          txtName = txtRecord.txt_name;
          txtValue = txtRecord.txt_value;
        }
      }

      console.log('[Domains] Status check - Cloudflare response:', {
        hostname: cfHostname.hostname,
        status: cfHostname.status,
        sslStatus: cfHostname.ssl.status,
        sslMethod: cfHostname.ssl.method,
        ownershipVerification: cfHostname.ownership_verification,
        validationRecords: cfHostname.ssl.validation_records,
        txtName,
        txtValue,
      });

      // Update database with latest status
      const updatedDomain = await prisma.customDomain.update({
        where: { id: domainId },
        data: {
          status: CloudflareSaaSService.mapCloudflareStatus(cfHostname.status),
          sslStatus: CloudflareSaaSService.mapSSLStatus(cfHostname.ssl.status),
          txtName: txtName,
          txtValue: txtValue,
          verificationErrors: cfHostname.verification_errors || [],
          lastCheckedAt: new Date(),
          verifiedAt: cfHostname.status === 'active' && !domain.verifiedAt ? new Date() : domain.verifiedAt,
        },
      });

      return res.json({
        success: true,
        domain: {
          id: updatedDomain.id,
          domain: updatedDomain.domain,
          status: updatedDomain.status,
          sslStatus: updatedDomain.sslStatus,
          cnameTarget: updatedDomain.cnameTarget,
          txtName: updatedDomain.txtName,
          txtValue: updatedDomain.txtValue,
          verificationErrors: updatedDomain.verificationErrors,
          isPrimary: updatedDomain.isPrimary,
          verifiedAt: updatedDomain.verifiedAt,
          lastCheckedAt: updatedDomain.lastCheckedAt,
        },
      });
    }

    return res.json({
      success: true,
      domain: {
        id: domain.id,
        domain: domain.domain,
        status: domain.status,
        sslStatus: domain.sslStatus,
        cnameTarget: domain.cnameTarget,
        txtName: domain.txtName,
        txtValue: domain.txtValue,
        verificationErrors: domain.verificationErrors,
        isPrimary: domain.isPrimary,
        verifiedAt: domain.verifiedAt,
        lastCheckedAt: domain.lastCheckedAt,
      },
    });
  } catch (error) {
    console.error('[Domains] Error checking domain status:', error);
    return res.status(500).json({ error: 'Failed to check domain status' });
  }
});

/**
 * POST /api/domains/:domainId/set-primary
 * Set a domain as the primary domain for the project
 */
router.post('/:domainId/set-primary', async (req: Request, res: Response) => {
  try {
    const { domainId } = req.params;

    // Get domain
    const domain = await prisma.customDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Only allow setting active domains as primary
    if (domain.status !== 'ACTIVE') {
      return res.status(400).json({ 
        error: 'Only verified domains can be set as primary. Please wait for domain verification.' 
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

    console.log(`[Domains] Set ${domain.domain} as primary for project ${domain.projectId}`);

    return res.json({
      success: true,
      domain: {
        id: updatedDomain.id,
        domain: updatedDomain.domain,
        isPrimary: updatedDomain.isPrimary,
      },
    });
  } catch (error) {
    console.error('[Domains] Error setting primary domain:', error);
    return res.status(500).json({ error: 'Failed to set primary domain' });
  }
});

/**
 * POST /api/domains/cleanup
 * Clean up orphaned domain records (admin only)
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    // Validate API key
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.SHIPPER_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { fullDomainCleanup } = await import('../utils/domain-cleanup.js');
    const result = await fullDomainCleanup();

    return res.json({
      success: true,
      message: 'Domain cleanup completed',
      result,
    });
  } catch (error) {
    console.error('[Domains] Error during cleanup:', error);
    return res.status(500).json({ error: 'Failed to cleanup domains' });
  }
});

/**
 * POST /api/domains/unset-primary/:projectId
 * Unset all primary domains for a project (revert to Shipper subdomain)
 */
router.post('/unset-primary/:projectId', async (req: Request, res: Response) => {
  try {
    // Validate API key
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.SHIPPER_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId } = req.params;

    // Unset all primary domains for this project
    await prisma.customDomain.updateMany({
      where: { 
        projectId,
        isPrimary: true,
      },
      data: { isPrimary: false },
    });

    console.log(`[Domains] Unset all primary domains for project ${projectId}`);

    return res.json({
      success: true,
      message: 'All custom domains unset as primary. Shipper subdomain is now primary.',
    });
  } catch (error) {
    console.error('[Domains] Error unsetting primary domain:', error);
    return res.status(500).json({ error: 'Failed to unset primary domain' });
  }
});

/**
 * DELETE /api/domains/:domainId
 * Remove a custom domain
 */
router.delete('/:domainId', async (req: Request, res: Response) => {
  try {
    const { domainId } = req.params;

    // Get domain
    const domain = await prisma.customDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Delete from Cloudflare first (fail fast if this fails)
    if (domain.cloudflareHostnameId) {
      try {
        console.log(`[Domains] Deleting from Cloudflare: ${domain.domain} (${domain.cloudflareHostnameId})`);
        const cloudflare = createCloudflareService();
        await cloudflare.deleteCustomHostname(domain.cloudflareHostnameId);
        console.log(`[Domains] Successfully deleted from Cloudflare: ${domain.domain}`);
      } catch (error) {
        console.error(`[Domains] CRITICAL: Failed to delete ${domain.domain} from Cloudflare:`, error);
        
        // Return error instead of continuing - this prevents orphaned records
        return res.status(500).json({ 
          error: `Failed to delete domain from Cloudflare: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: 'Domain deletion aborted to prevent orphaned records. Please try again or contact support.'
        });
      }
    } else {
      console.log(`[Domains] No Cloudflare hostname ID for ${domain.domain}, skipping Cloudflare deletion`);
    }

    // Only delete from database if Cloudflare deletion succeeded
    await prisma.customDomain.delete({
      where: { id: domainId },
    });

    console.log(`[Domains] Successfully deleted custom domain ${domain.domain} from both Cloudflare and database`);

    return res.json({
      success: true,
      message: 'Domain deleted successfully',
    });
  } catch (error) {
    console.error('[Domains] Error deleting domain:', error);
    return res.status(500).json({ error: 'Failed to delete domain' });
  }
});

export default router;
