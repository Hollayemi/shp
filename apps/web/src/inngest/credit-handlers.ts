import { prisma } from "@/lib/db"
import { inngest } from "@/inngest/client"
import { CreditManager } from "@/lib/credits"

export const handleCreditPurchase = inngest.createFunction(
    { id: 'credit-purchase' },
    { event: 'stripe/payment_succeeded' },
    async ({ event }) => {
      const { metadata } = event.data
      
      if (metadata.type === 'credit_purchase') {
        await CreditManager.addCredits(
          metadata.userId,
          parseInt(metadata.credits),
          'PURCHASE',
          `Purchased ${metadata.credits} credits`
        )
        
        // Log purchase record
        await prisma.creditPurchase.create({
          data: {
            userId: metadata.userId,
            credits: parseInt(metadata.credits),
            amountPaid: event.data.amount_total,
            stripePaymentId: event.data.payment_intent,
            status: 'COMPLETED'
          }
        })
      }
    }
  )
  