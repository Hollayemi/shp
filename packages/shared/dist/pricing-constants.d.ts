/**
 * Shared pricing constants for credit-to-USD conversion
 *
 * Pricing Model:
 * - Users pay $25 for 100 credits
 * - Therefore: $1 = 4 credits
 * - We apply a 2x markup on OpenRouter costs (100% profit margin)
 * - Final formula: credits = openRouterCost_USD * 4 * 2 = openRouterCost_USD * 8
 * - Minimum charge: 1 credit per operation
 */
export declare const PRICING: {
    /** $25 USD = 100 credits, so $1 USD = 4 credits */
    readonly USD_TO_CREDITS: 4;
    /** 2x markup on costs (100% profit margin) */
    readonly MARKUP_MULTIPLIER: 2;
    /** Minimum credits to charge for any operation */
    readonly MIN_CREDITS: 1;
    /** Combined multiplier: USD_TO_CREDITS * MARKUP_MULTIPLIER = 8 */
    readonly TOTAL_MULTIPLIER: 8;
};
/**
 * Calculate credits to charge based on OpenRouter USD cost
 * @param openRouterCostUSD - Cost in USD from OpenRouter
 * @returns Credits to charge (minimum 1.0, rounded to 2 decimals)
 */
export declare function calculateCreditsFromUSD(openRouterCostUSD: number): number;
/**
 * Calculate USD cost from credits (for reference/reporting)
 * @param credits - Number of credits
 * @returns USD value
 */
export declare function calculateUSDFromCredits(credits: number): number;
//# sourceMappingURL=pricing-constants.d.ts.map