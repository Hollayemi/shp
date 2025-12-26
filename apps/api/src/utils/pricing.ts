/**
 * Pricing constants for credit-to-USD conversion
 *
 * Pricing Model:
 * - Users pay $25 for 100 credits
 * - Therefore: $1 = 4 credits
 * - We apply a 2x markup on OpenRouter costs (100% profit margin) for most operations
 * - First prompt (Opus) uses 10% margin instead of 50%
 * - Final formula: credits = openRouterCost_USD * 4 * markup
 * - Minimum charge: 1 credit per operation
 */

export const PRICING = {
  /** $25 USD = 100 credits, so $1 USD = 4 credits */
  USD_TO_CREDITS: 4,

  /** 2x markup on costs (100% profit margin) - default for most operations */
  MARKUP_MULTIPLIER: 2.0,

  /** 1.1x markup (10% margin) - used for first prompt with Opus */
  FIRST_PROMPT_MARKUP_MULTIPLIER: 1.1,

  /** Minimum credits to charge for any operation */
  MIN_CREDITS: 1.0,

  /** Combined multiplier: USD_TO_CREDITS * MARKUP_MULTIPLIER = 8 */
  TOTAL_MULTIPLIER: 8, // 4 * 2

  /** Combined multiplier for first prompt: USD_TO_CREDITS * 1.1 = 4.4 */
  FIRST_PROMPT_MULTIPLIER: 4.4, // 4 * 1.1
} as const;

/**
 * Calculate credits to charge based on USD cost (default 50% margin)
 * @param costUSD - Cost in USD
 * @returns Credits to charge (minimum 1, always rounded UP to nearest whole number)
 */
export function calculateCreditsFromUSD(costUSD: number): number {
  const rawCredits = costUSD * PRICING.TOTAL_MULTIPLIER;
  // Always round UP to nearest whole number
  const roundedUp = Math.ceil(rawCredits);
  return Math.max(PRICING.MIN_CREDITS, roundedUp);
}

/**
 * Calculate credits for first prompt (Opus) with 10% margin instead of 50%
 * @param costUSD - Cost in USD
 * @returns Credits to charge (minimum 1, always rounded UP to nearest whole number)
 */
export function calculateCreditsFromUSDFirstPrompt(costUSD: number): number {
  const rawCredits = costUSD * PRICING.FIRST_PROMPT_MULTIPLIER;
  // Always round UP to nearest whole number
  const roundedUp = Math.ceil(rawCredits);
  return Math.max(PRICING.MIN_CREDITS, roundedUp);
}

/**
 * Calculate USD cost from credits (for reference/reporting)
 * @param credits - Number of credits
 * @returns USD value
 */
export function calculateUSDFromCredits(credits: number): number {
  return credits / PRICING.USD_TO_CREDITS;
}
