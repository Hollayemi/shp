import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  init_esm_shims
} from "./chunk-BUABXYJD.js";

// src/services/shipper-cloud-credits.ts
init_esm_shims();
var SHIPPER_CLOUD_CREDITS_METER = process.env.SHIPPER_CLOUD_CREDITS_METER_NAME || "shipper_cloud_credits_dec_v2";
var CONVEX_TO_CREDITS_RATES = {
  /**
   * Function calls: 300 credits per million calls
   * (Convex: $2/million, we charge $3/million = 300 cents = 300 credits)
   */
  functionCallsPerMillion: 300,
  /**
   * Action compute: 45 credits per GB-hour
   * (Convex: $0.30/GB-hr, we charge $0.45/GB-hr = 45 cents = 45 credits)
   */
  actionComputePerGBHour: 45,
  /**
   * Database storage: 30 credits per GB/month
   * (Convex: $0.20/GB/mo, we charge $0.30/GB/mo = 30 cents = 30 credits)
   */
  databaseStoragePerGBMonth: 30,
  /**
   * Database bandwidth: 30 credits per GB
   * (Convex: $0.20/GB, we charge $0.30/GB = 30 cents = 30 credits)
   */
  databaseBandwidthPerGB: 30,
  /**
   * File storage: 4.5 credits per GB/month
   * (Convex: $0.03/GB/mo, we charge $0.045/GB/mo = 4.5 cents = 4.5 credits)
   */
  fileStoragePerGBMonth: 4.5,
  /**
   * File bandwidth: 45 credits per GB
   * (Convex: $0.30/GB, we charge $0.45/GB = 45 cents = 45 credits)
   */
  fileBandwidthPerGB: 45,
  /**
   * Vector storage: 75 credits per GB/month
   * (Convex: $0.50/GB/mo, we charge $0.75/GB/mo = 75 cents = 75 credits)
   */
  vectorStoragePerGBMonth: 75,
  /**
   * Vector bandwidth: 15 credits per GB
   * (Convex: $0.10/GB, we charge $0.15/GB = 15 cents = 15 credits)
   */
  vectorBandwidthPerGB: 15
};
var BYTES_PER_GB = 1024 * 1024 * 1024;
var MS_PER_HOUR = 36e5;
var MB_PER_GB = 1024;
var MEMORY_MB = 128;
function calculateCreditsFromConvexUsageRaw(metrics) {
  const rates = CONVEX_TO_CREDITS_RATES;
  let totalCredits = 0;
  const functionCallCredits = Number(metrics.functionCalls) / 1e6 * rates.functionCallsPerMillion;
  totalCredits += functionCallCredits;
  const gbHours = MEMORY_MB / MB_PER_GB * (Number(metrics.actionComputeMs) / MS_PER_HOUR);
  const actionComputeCredits = gbHours * rates.actionComputePerGBHour;
  totalCredits += actionComputeCredits;
  const dbBandwidthCredits = Number(metrics.databaseBandwidthBytes) / BYTES_PER_GB * rates.databaseBandwidthPerGB;
  totalCredits += dbBandwidthCredits;
  const dbStorageCredits = Number(metrics.databaseStorageBytes) / BYTES_PER_GB * rates.databaseStoragePerGBMonth;
  totalCredits += dbStorageCredits;
  const fileBandwidthCredits = Number(metrics.fileBandwidthBytes) / BYTES_PER_GB * rates.fileBandwidthPerGB;
  totalCredits += fileBandwidthCredits;
  const fileStorageCredits = Number(metrics.fileStorageBytes) / BYTES_PER_GB * rates.fileStoragePerGBMonth;
  totalCredits += fileStorageCredits;
  const vectorBandwidthCredits = Number(metrics.vectorBandwidthBytes) / BYTES_PER_GB * rates.vectorBandwidthPerGB;
  totalCredits += vectorBandwidthCredits;
  const vectorStorageCredits = Number(metrics.vectorStorageBytes) / BYTES_PER_GB * rates.vectorStoragePerGBMonth;
  totalCredits += vectorStorageCredits;
  return totalCredits;
}

export {
  SHIPPER_CLOUD_CREDITS_METER,
  calculateCreditsFromConvexUsageRaw
};
