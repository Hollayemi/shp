/**
 * Domain Cleanup Utilities
 * 
 * Functions to detect and clean up orphaned domain records
 */

import { prisma } from '@shipper/database';
import { createCloudflareService } from '../services/cloudflare-saas.js';

/**
 * Find domains that exist in database but not in Cloudflare
 */
export async function findOrphanedDatabaseRecords(): Promise<Array<{
  id: string;
  domain: string;
  cloudflareHostnameId: string | null;
  status: string;
}>> {
  const cloudflare = createCloudflareService();
  const dbDomains = await prisma.customDomain.findMany({
    select: {
      id: true,
      domain: true,
      cloudflareHostnameId: true,
      status: true,
    },
  });

  const cfHostnames = await cloudflare.listCustomHostnames();
  const cfHostnameIds = new Set(cfHostnames.map(h => h.id));

  return dbDomains.filter(domain => 
    domain.cloudflareHostnameId && 
    !cfHostnameIds.has(domain.cloudflareHostnameId)
  );
}

/**
 * Find domains that exist in Cloudflare but not in database
 */
export async function findOrphanedCloudflareRecords(): Promise<Array<{
  id: string;
  hostname: string;
  status: string;
}>> {
  const cloudflare = createCloudflareService();
  const cfHostnames = await cloudflare.listCustomHostnames();
  
  const dbHostnameIds = await prisma.customDomain.findMany({
    select: { cloudflareHostnameId: true },
    where: { cloudflareHostnameId: { not: null } },
  });
  
  const dbHostnameIdSet = new Set(
    dbHostnameIds
      .map(d => d.cloudflareHostnameId)
      .filter(Boolean) as string[]
  );

  return cfHostnames.filter(hostname => 
    !dbHostnameIdSet.has(hostname.id)
  );
}

/**
 * Clean up orphaned Cloudflare records (domains in CF but not in DB)
 */
export async function cleanupOrphanedCloudflareRecords(): Promise<{
  cleaned: number;
  errors: Array<{ hostname: string; error: string }>;
}> {
  const orphaned = await findOrphanedCloudflareRecords();
  const cloudflare = createCloudflareService();
  
  let cleaned = 0;
  const errors: Array<{ hostname: string; error: string }> = [];

  for (const record of orphaned) {
    try {
      console.log(`[Cleanup] Deleting orphaned Cloudflare record: ${record.hostname} (${record.id})`);
      await cloudflare.deleteCustomHostname(record.id);
      cleaned++;
      console.log(`[Cleanup] Successfully deleted: ${record.hostname}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Cleanup] Failed to delete ${record.hostname}:`, error);
      errors.push({ hostname: record.hostname, error: errorMsg });
    }
  }

  return { cleaned, errors };
}

/**
 * Clean up orphaned database records (domains in DB but not in CF)
 */
export async function cleanupOrphanedDatabaseRecords(): Promise<{
  cleaned: number;
  errors: Array<{ domain: string; error: string }>;
}> {
  const orphaned = await findOrphanedDatabaseRecords();
  
  let cleaned = 0;
  const errors: Array<{ domain: string; error: string }> = [];

  for (const record of orphaned) {
    try {
      console.log(`[Cleanup] Deleting orphaned database record: ${record.domain} (${record.id})`);
      await prisma.customDomain.delete({
        where: { id: record.id },
      });
      cleaned++;
      console.log(`[Cleanup] Successfully deleted: ${record.domain}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Cleanup] Failed to delete ${record.domain}:`, error);
      errors.push({ domain: record.domain, error: errorMsg });
    }
  }

  return { cleaned, errors };
}

/**
 * Full cleanup - removes orphaned records from both sides
 */
export async function fullDomainCleanup(): Promise<{
  cloudflareOrphans: { cleaned: number; errors: Array<{ hostname: string; error: string }> };
  databaseOrphans: { cleaned: number; errors: Array<{ domain: string; error: string }> };
}> {
  console.log('[Cleanup] Starting full domain cleanup...');
  
  const cloudflareOrphans = await cleanupOrphanedCloudflareRecords();
  const databaseOrphans = await cleanupOrphanedDatabaseRecords();
  
  console.log(`[Cleanup] Cleanup complete. CF: ${cloudflareOrphans.cleaned} cleaned, DB: ${databaseOrphans.cleaned} cleaned`);
  
  return { cloudflareOrphans, databaseOrphans };
}