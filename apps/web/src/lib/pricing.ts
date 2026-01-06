// Pro credit options - server-side to prevent client tampering
export const PRO_CREDIT_OPTIONS = [
  { credits: 100, price: 25, popular: true },
  { credits: 200, price: 50, popular: false },
  { credits: 400, price: 100, popular: false },
  { credits: 800, price: 200, popular: false },
  { credits: 1200, price: 294, popular: false },
  { credits: 2000, price: 480, popular: false },
  { credits: 3000, price: 705, popular: false },
  { credits: 4000, price: 920, popular: false },
  { credits: 5000, price: 1125, popular: false },
] as const;

// New simplified pricing structure
export const PRICING_TIERS = {
  pro: {
    name: 'Pro',
    description: 'Perfect for individuals and small teams',
    features: [
      'Advanced AI generation',
      'Unlimited projects',
      'Priority support',
      // 'API access',
      // 'Team collaboration',
      // 'Custom domains',
      // 'Advanced templates'
    ],
    creditOptions: PRO_CREDIT_OPTIONS
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Custom solutions for large organizations',
    features: [
      'Everything in Pro',
      'Dedicated support manager',
      'Custom integrations',
      // 'SSO & advanced security',
      // 'On-premise deployment',
      // 'SLA guarantees',
      // 'Custom training',
      // 'White labeling'
    ],
    isContactBased: true
  }
} as const;

// Legacy support - keeping for backward compatibility with existing code
export const ENHANCED_MEMBERSHIP_TIERS = {
  pro: PRO_CREDIT_OPTIONS.map((option, index) => ({
    id: `pro-${option.credits}`,
    name: `Pro ${option.credits}`,
    monthlyPrice: option.price,
    monthlyCredits: option.credits,
    features: PRICING_TIERS.pro.features,
    popular: option.popular,
    savings: option.credits > 100 ? `${Math.round(((option.credits * 0.1 - option.price) / (option.credits * 0.1)) * 100)}%` : null
  })),
  enterprise: [
    {
      id: 'enterprise-custom',
      name: 'Enterprise',
      monthlyPrice: 0, // Contact based
      monthlyCredits: 0, // Custom
      features: PRICING_TIERS.enterprise.features,
      popular: false,
      savings: null,
      isContactBased: true
    }
  ]
};

export const CREDIT_PACKAGES = [
  { credits: 100, price: 10, popular: false },
  { credits: 200, price: 18, popular: false }, // 10% discount
  { credits: 300, price: 24, popular: true },  // 20% discount
  { credits: 400, price: 30, popular: false }, // 25% discount  
  { credits: 500, price: 35, popular: false }, // 30% discount
  { credits: 1000, price: 60, popular: false }, // 40% discount
  { credits: 4000, price: 200, popular: false }, // 50% discount
];

export const CREDIT_COSTS = {
  ai_generation: 5,        // 5 credits per AI generation
  sandbox_minute: 1,       // 1 credit per minute of sandbox
  deployment: 10,          // 10 credits per deployment
  team_collaboration: 2,   // 2 credits per hour of team session
  advanced_features: 3,    // 3 credits for advanced AI features
};

// Helper function to get credit option by credits amount
export function getProCreditOption(credits: number) {
  return PRO_CREDIT_OPTIONS.find(option => option.credits === credits);
}

// Helper function to get tier by ID (updated for new structure)
export function getTierById(tierId: string) {
  // Handle pro tiers
  if (tierId.startsWith('pro-')) {
    const credits = parseInt(tierId.replace('pro-', ''));
    const option = getProCreditOption(credits);
    if (option) {
      return {
        ...option,
        id: tierId,
        name: `Pro ${option.credits}`,
        monthlyPrice: option.price,
        monthlyCredits: option.credits,
        features: PRICING_TIERS.pro.features,
        tierName: 'pro'
      };
    }
  }
  
  // Handle enterprise
  if (tierId === 'enterprise-custom') {
    return {
      id: tierId,
      name: 'Enterprise',
      monthlyPrice: 0,
      monthlyCredits: 0,
      features: PRICING_TIERS.enterprise.features,
      tierName: 'enterprise',
      isContactBased: true
    };
  }
  
  return null;
}

// Helper function to calculate savings
export function calculateSavings(credits: number, price: number) {
  const basePrice = (credits / 100) * 10; // Base price at $10 per 100 credits
  const savings = ((basePrice - price) / basePrice) * 100;
  return Math.round(savings);
}

// Helper function to validate credit option (server-side security)
export function isValidCreditOption(credits: number): boolean {
  return PRO_CREDIT_OPTIONS.some(option => option.credits === credits);
}

// Get default/popular credit option
export function getDefaultCreditOption() {
  // Default to the entry-level option to mirror marketing flow (100 credits)
  return PRO_CREDIT_OPTIONS[0];
}

/**
 * OpenRouter Cost to Credits Conversion
 * 
 * Pricing Model:
 * - Users pay $25 for 100 credits
 * - Therefore: $1 = 4 credits
 * - We apply a 2x markup on OpenRouter costs (100% profit margin)
 * - Final formula: credits = openRouterCost_USD * 4 * 2 = openRouterCost_USD * 8
 * - Minimum charge: 1 credit per operation
 */

export const OPENROUTER_PRICING = {
  /** $25 USD = 100 credits, so $1 USD = 4 credits */
  USD_TO_CREDITS: 4,
  
  /** 2x markup on costs (100% profit margin) */
  MARKUP_MULTIPLIER: 2.0,
  
  /** Minimum credits to charge for any operation */
  MIN_CREDITS: 1.0,
  
  /** Combined multiplier: USD_TO_CREDITS * MARKUP_MULTIPLIER = 8 */
  TOTAL_MULTIPLIER: 8, // 4 * 2
} as const;

/**
 * Calculate credits to charge based on OpenRouter USD cost
 * @param openRouterCostUSD - Cost in USD from OpenRouter
 * @returns Credits to charge (minimum 1, always rounded UP to nearest whole number)
 */
export function calculateCreditsFromUSD(openRouterCostUSD: number): number {
  const rawCredits = openRouterCostUSD * OPENROUTER_PRICING.TOTAL_MULTIPLIER;
  // Always round UP to nearest whole number
  const roundedUp = Math.ceil(rawCredits);
  return Math.max(OPENROUTER_PRICING.MIN_CREDITS, roundedUp);
}

/**
 * Calculate USD cost from credits (for reference/reporting)
 * @param credits - Number of credits
 * @returns USD value
 */
export function calculateUSDFromCredits(credits: number): number {
  return credits / OPENROUTER_PRICING.USD_TO_CREDITS;
}
  