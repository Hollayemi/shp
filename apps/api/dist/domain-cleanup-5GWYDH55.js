import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  createCloudflareService
} from "./chunk-HZ6DVTH4.js";
import {
  prisma
} from "./chunk-YMWDDMLV.js";
import {
  init_esm_shims
} from "./chunk-IXOW5DJO.js";

// src/utils/domain-cleanup.ts
init_esm_shims();
async function findOrphanedDatabaseRecords() {
  const cloudflare = createCloudflareService();
  const dbDomains = await prisma.customDomain.findMany({
    select: {
      id: true,
      domain: true,
      cloudflareHostnameId: true,
      status: true
    }
  });
  const cfHostnames = await cloudflare.listCustomHostnames();
  const cfHostnameIds = new Set(cfHostnames.map((h) => h.id));
  return dbDomains.filter(
    (domain) => domain.cloudflareHostnameId && !cfHostnameIds.has(domain.cloudflareHostnameId)
  );
}
async function findOrphanedCloudflareRecords() {
  const cloudflare = createCloudflareService();
  const cfHostnames = await cloudflare.listCustomHostnames();
  const dbHostnameIds = await prisma.customDomain.findMany({
    select: { cloudflareHostnameId: true },
    where: { cloudflareHostnameId: { not: null } }
  });
  const dbHostnameIdSet = new Set(
    dbHostnameIds.map((d) => d.cloudflareHostnameId).filter(Boolean)
  );
  return cfHostnames.filter(
    (hostname) => !dbHostnameIdSet.has(hostname.id)
  );
}
async function cleanupOrphanedCloudflareRecords() {
  const orphaned = await findOrphanedCloudflareRecords();
  const cloudflare = createCloudflareService();
  let cleaned = 0;
  const errors = [];
  for (const record of orphaned) {
    try {
      console.log(`[Cleanup] Deleting orphaned Cloudflare record: ${record.hostname} (${record.id})`);
      await cloudflare.deleteCustomHostname(record.id);
      cleaned++;
      console.log(`[Cleanup] Successfully deleted: ${record.hostname}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Cleanup] Failed to delete ${record.hostname}:`, error);
      errors.push({ hostname: record.hostname, error: errorMsg });
    }
  }
  return { cleaned, errors };
}
async function cleanupOrphanedDatabaseRecords() {
  const orphaned = await findOrphanedDatabaseRecords();
  let cleaned = 0;
  const errors = [];
  for (const record of orphaned) {
    try {
      console.log(`[Cleanup] Deleting orphaned database record: ${record.domain} (${record.id})`);
      await prisma.customDomain.delete({
        where: { id: record.id }
      });
      cleaned++;
      console.log(`[Cleanup] Successfully deleted: ${record.domain}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Cleanup] Failed to delete ${record.domain}:`, error);
      errors.push({ domain: record.domain, error: errorMsg });
    }
  }
  return { cleaned, errors };
}
async function fullDomainCleanup() {
  console.log("[Cleanup] Starting full domain cleanup...");
  const cloudflareOrphans = await cleanupOrphanedCloudflareRecords();
  const databaseOrphans = await cleanupOrphanedDatabaseRecords();
  console.log(`[Cleanup] Cleanup complete. CF: ${cloudflareOrphans.cleaned} cleaned, DB: ${databaseOrphans.cleaned} cleaned`);
  return { cloudflareOrphans, databaseOrphans };
}
export {
  cleanupOrphanedCloudflareRecords,
  cleanupOrphanedDatabaseRecords,
  findOrphanedCloudflareRecords,
  findOrphanedDatabaseRecords,
  fullDomainCleanup
};
