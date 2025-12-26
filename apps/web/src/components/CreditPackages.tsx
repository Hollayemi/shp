import { CREDIT_PACKAGES } from "@/lib/pricing"

  // src/components/credit-packages.tsx
  export function CreditPackages() {
    const handlePurchase = async (packageIndex: number) => {
      try {
        const response = await fetch("/api/stripe/buy-credits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageIndex,
            returnUrl: window.location.href
          }),
        });

        if (!response.ok) {
          console.error('Purchase failed:', await response.text());
          return;
        }

        const { url } = await response.json();
        if (url) {
          window.location.href = url;
        }
      } catch (error) {
        console.error('Purchase error:', error);
      }
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {CREDIT_PACKAGES.map((pkg, index) => (
          <div 
            key={index}
            className={`border rounded-lg p-6 relative ${
              pkg.popular ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
          >
            {pkg.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs">
                  Most Popular
                </span>
              </div>
            )}
            
            <div className="text-center">
              <h3 className="text-2xl font-bold">{pkg.credits}</h3>
              <p className="text-gray-600">credits</p>
              <p className="text-3xl font-bold mt-2">${pkg.price}</p>
              
              {index > 0 && (
                <p className="text-green-600 text-sm mt-1">
                  Save {Math.round((1 - pkg.price / (CREDIT_PACKAGES[0].price * pkg.credits / CREDIT_PACKAGES[0].credits)) * 100)}%
                </p>
              )}
            </div>
            
            <button 
              onClick={() => handlePurchase(index)}
              className="w-full mt-4 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Buy Credits
            </button>
          </div>
        ))}
      </div>
    )
  }