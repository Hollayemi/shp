import { Coins, AlertTriangle } from "lucide-react"
import { CREDIT_PACKAGES } from "@/lib/pricing"
import { useRouter } from "next/navigation"
import { useTRPC } from "@/trpc/client"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { useState } from "react"
import CreditPurchaseModal from "./CreditPurchaseModal"

interface CreditDisplayProps {
  userId?: string;
  showBuyButton?: boolean;
  variant?: 'default' | 'compact' | 'warning';
  threshold?: number; // Show warning when credits are below this number
}

export function CreditDisplay({ 
  userId, 
  showBuyButton = true, 
  variant = 'default',
  threshold = 5 
}: CreditDisplayProps) {
    const router = useRouter()
    const trpc = useTRPC()
    const [showModal, setShowModal] = useState(false)

    const { data: creditsData, isLoading } = useQuery({
      ...trpc.credits.getMyCredits.queryOptions(),
      refetchOnWindowFocus: false,
    })

    const credits = creditsData?.user?.creditBalance || 0
    const membershipTier = creditsData?.user?.membershipTier || 'FREE'
    const hasSubscription = membershipTier !== 'FREE' // Users with PRO/ENTERPRISE have subscriptions
    const isLow = credits < threshold
    const isEmpty = credits === 0

    const handleBuyCredits = () => {
      if (hasSubscription) {
        setShowModal(true)
      } else {
        router.push('/test-checkout')
      }
    }

    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Coins className="w-4 h-4 animate-pulse" />
          <span className="text-sm">Loading...</span>
        </div>
      )
    }

    if (variant === 'compact') {
      return (
        <>
          <div className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded",
            isEmpty ? "bg-red-100 text-red-700" : 
            isLow ? "bg-yellow-100 text-yellow-700" : 
            "bg-green-100 text-green-700"
          )}>
            <Coins className="w-3 h-3" />
            <span className="font-mono font-medium">{credits}</span>
          </div>
          
          {/* Credit Purchase Modal */}
          <CreditPurchaseModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            currentCredits={credits}
            userTier={membershipTier}
          />
        </>
      )
    }

    if (variant === 'warning' && isLow) {
      return (
        <>
          <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">
              {isEmpty ? 'No credits remaining!' : `Only ${credits} credits left`}
            </span>
            {showBuyButton && (
              <button 
                onClick={handleBuyCredits}
                className="text-xs bg-white/20 px-2 py-1 rounded hover:bg-white/30 transition-colors"
              >
                Buy Credits
              </button>
            )}
          </div>
          
          {/* Credit Purchase Modal */}
          <CreditPurchaseModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            currentCredits={credits}
            userTier={membershipTier}
          />
        </>
      )
    }
    
    return (
      <>
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg",
          isEmpty ? "bg-gradient-to-r from-red-500 to-red-600 text-white" :
          isLow ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white" :
          "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
        )}>
          <Coins className="w-4 h-4" />
          <span className="font-medium">{credits} credits</span>
          {showBuyButton && (
            <button 
              onClick={handleBuyCredits}
              className="text-xs bg-white/20 px-2 py-1 rounded hover:bg-white/30 transition-colors"
            >
              {isEmpty ? 'Buy Credits' : 'Buy More'}
            </button>
          )}
        </div>
        
        {/* Credit Purchase Modal */}
        <CreditPurchaseModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          currentCredits={credits}
          userTier={membershipTier}
        />
      </>
    )
}
  
