"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { CREDIT_PACKAGES } from '@/lib/pricing';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits?: number;
  userTier?: string;
}

export default function CreditPurchaseModal({ 
  isOpen, 
  onClose, 
  currentCredits = 0,
  userTier = 'FREE'
}: CreditPurchaseModalProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState<number | null>(null);

  const handlePurchase = async (packageIndex: number) => {
    if (!session) {
      alert('Please sign in to purchase credits');
      return;
    }

    setLoading(packageIndex);

    try {
      const response = await fetch('/api/stripe/buy-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          packageIndex,
          returnUrl: window.location.href 
        }),
      });

      const result = await response.json();

      if (response.ok && result.url) {
        // Redirect to Stripe Checkout
        window.location.href = result.url;
      } else {
        alert(`❌ Error: ${result.error || 'Failed to create checkout session'}`);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert('❌ Failed to initiate purchase. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="min-w-fit w-full max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 text-left">
              💰 Buy Additional Credits
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-1 text-left">
              Add credits to your {userTier} subscription • Current balance: <span className="font-semibold text-green-600">{currentCredits} credits</span>
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Credit Packages */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CREDIT_PACKAGES.map((pkg, index) => (
              <div
                key={index}
                className={`relative p-6 rounded-lg border-2 transition-all duration-200 hover:shadow-lg ${
                  pkg.popular
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      ⭐ Popular
                    </span>
                  </div>
                )}

                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {pkg.credits.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 mb-1">Credits</div>
                  <div className="text-2xl font-bold text-green-600 mb-4">
                    ${pkg.price}
                  </div>
                  
                  <div className="text-sm text-gray-500 mb-4">
                    <div>After purchase:</div>
                    <div className="font-semibold text-gray-700">
                      {(currentCredits + pkg.credits).toLocaleString()} total credits
                    </div>
                  </div>

                  <button
                    onClick={() => handlePurchase(index)}
                    disabled={loading === index}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                      pkg.popular
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-900 hover:bg-gray-800 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {loading === index ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </div>
                    ) : (
                      'Purchase Credits'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Credits are added to your current balance immediately after purchase</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-600">🔄</span>
              <span>Your {userTier} subscription will continue to provide monthly credits as usual</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-purple-600">💡</span>
              <span>Purchased credits are consumed during use and reset at next subscription renewal</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 