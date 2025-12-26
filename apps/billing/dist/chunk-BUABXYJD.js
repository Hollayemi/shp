import { createRequire } from 'module';const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// ../../node_modules/.pnpm/tsup@8.5.0_jiti@2.4.2_postc_9a3b7b2d2c50878e59239ee1dea946be/node_modules/tsup/assets/esm_shims.js
import path from "path";
import { fileURLToPath } from "url";
var getFilename, getDirname, __dirname, __filename;
var init_esm_shims = __esm({
  "../../node_modules/.pnpm/tsup@8.5.0_jiti@2.4.2_postc_9a3b7b2d2c50878e59239ee1dea946be/node_modules/tsup/assets/esm_shims.js"() {
    "use strict";
    getFilename = () => fileURLToPath(import.meta.url);
    getDirname = () => path.dirname(getFilename());
    __dirname = /* @__PURE__ */ getDirname();
    __filename = /* @__PURE__ */ getFilename();
  }
});

// src/config/logger.ts
init_esm_shims();
import pino from "pino";
var isDevelopment = process.env.NODE_ENV !== "production";
var logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  transport: isDevelopment ? {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname"
    }
  } : void 0,
  base: {
    service: "billing"
  }
});

// src/config/stripe.ts
init_esm_shims();
import dotenv from "dotenv";
import { resolve } from "path";
import Stripe from "stripe";
dotenv.config({ path: resolve(process.cwd(), ".env") });
var stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.warn("[Stripe] Missing STRIPE_SECRET_KEY environment variable");
}
var stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: "2025-02-24.acacia",
  typescript: true
}) : null;
var stripeConfig = {
  isLive: stripeSecretKey?.startsWith("sk_live") ?? false,
  hasValidKey: !!stripeSecretKey
};
var SHIPPER_CLOUD_CONFIG = {
  // Unified meter ID
  meterId: process.env.STRIPE_SHIPPER_CLOUD_CREDITS_METER_ID,
  // Unified price ID (linked to the meter)
  priceId: process.env.STRIPE_SHIPPER_CLOUD_CREDITS_PRICE_ID,
  // Product ID for Shipper Cloud Credits
  productId: process.env.STRIPE_SHIPPER_CLOUD_CREDITS_PRODUCT_ID,
  // Pricing - 1 credit = 1 cent
  pricing: {
    /** Cents per credit ($0.01) */
    centsPerCredit: 1,
    /** Credits per dollar (100 credits = $1) */
    creditsPerDollar: 100
  }
};
var CONVEX_BILLING_CONFIG = {
  // Meter IDs - created in Stripe Dashboard (Billing > Meters)
  meters: {
    functionCalls: process.env.STRIPE_METER_FUNCTION_CALLS_ID,
    actionCompute: process.env.STRIPE_METER_ACTION_COMPUTE_ID,
    databaseBandwidth: process.env.STRIPE_METER_DB_BANDWIDTH_ID,
    databaseStorage: process.env.STRIPE_METER_DB_STORAGE_ID,
    fileBandwidth: process.env.STRIPE_METER_FILE_BANDWIDTH_ID,
    fileStorage: process.env.STRIPE_METER_FILE_STORAGE_ID,
    vectorBandwidth: process.env.STRIPE_METER_VECTOR_BANDWIDTH_ID,
    vectorStorage: process.env.STRIPE_METER_VECTOR_STORAGE_ID
  },
  // Price IDs - each linked to its own product and meter
  prices: {
    functionCalls: process.env.STRIPE_CONVEX_FUNCTION_CALLS_PRICE_ID,
    actionCompute: process.env.STRIPE_CONVEX_ACTION_COMPUTE_PRICE_ID,
    databaseBandwidth: process.env.STRIPE_CONVEX_DB_BANDWIDTH_PRICE_ID,
    databaseStorage: process.env.STRIPE_CONVEX_DB_STORAGE_PRICE_ID,
    fileBandwidth: process.env.STRIPE_CONVEX_FILE_BANDWIDTH_PRICE_ID,
    fileStorage: process.env.STRIPE_CONVEX_FILE_STORAGE_PRICE_ID,
    vectorBandwidth: process.env.STRIPE_CONVEX_VECTOR_BANDWIDTH_PRICE_ID,
    vectorStorage: process.env.STRIPE_CONVEX_VECTOR_STORAGE_PRICE_ID
  },
  // Pricing rates (in cents) - for cost calculation display
  // These are Shipper Cloud rates (50% margin over Convex)
  rates: {
    functionCallsPerMillion: 300,
    // $3.00
    actionComputePerGBHour: 45,
    // $0.45
    databaseStoragePerGB: 30,
    // $0.30/month
    databaseBandwidthPerGB: 30,
    // $0.30
    fileStoragePerGB: 4.5,
    // $0.045/month
    fileBandwidthPerGB: 45,
    // $0.45
    vectorStoragePerGB: 75,
    // $0.75/month
    vectorBandwidthPerGB: 15
    // $0.15
  }
};

export {
  __require,
  __commonJS,
  __toESM,
  __publicField,
  __privateAdd,
  __privateMethod,
  __dirname,
  __filename,
  init_esm_shims,
  logger,
  stripe,
  stripeConfig,
  SHIPPER_CLOUD_CONFIG,
  CONVEX_BILLING_CONFIG
};
