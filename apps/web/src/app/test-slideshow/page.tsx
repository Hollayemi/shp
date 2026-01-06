"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Sample HTML components for testing
const SAMPLE_COMPONENTS = [
  {
    id: 1,
    name: "Hero Section",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; font-family: system-ui; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .hero { min-height: 100vh; display: flex; align-items: center; justify-content: center; color: white; text-align: center; padding: 2rem; }
            h1 { font-size: 4rem; margin: 0; animation: fadeIn 1s; }
            p { font-size: 1.5rem; margin-top: 1rem; opacity: 0.9; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          </style>
        </head>
        <body>
          <div class="hero">
            <div>
              <h1>🚀 Welcome to Shipper</h1>
              <p>Build amazing apps with AI</p>
            </div>
          </div>
        </body>
      </html>
    `,
  },
  {
    id: 2,
    name: "Dashboard",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; font-family: system-ui; background: #f5f5f5; padding: 2rem; }
            .dashboard { max-width: 1200px; margin: 0 auto; }
            .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 1rem; }
            h2 { color: #333; margin: 0 0 1rem 0; }
            .stat { font-size: 2rem; color: #1E9A80; font-weight: bold; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 2rem; }
          </style>
        </head>
        <body>
          <div class="dashboard">
            <div class="card">
              <h2>📊 Analytics Dashboard</h2>
              <div class="stat">1,234</div>
              <p>Total Users</p>
            </div>
            <div class="grid">
              <div class="card"><div class="stat">89%</div><p>Growth</p></div>
              <div class="card"><div class="stat">456</div><p>Projects</p></div>
              <div class="card"><div class="stat">$12K</div><p>Revenue</p></div>
            </div>
          </div>
        </body>
      </html>
    `,
  },
  {
    id: 3,
    name: "Contact Form",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; font-family: system-ui; background: linear-gradient(to right, #fa709a 0%, #fee140 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
            .form-container { background: white; padding: 3rem; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 500px; }
            h2 { color: #333; margin: 0 0 2rem 0; }
            input, textarea { width: 100%; padding: 1rem; margin-bottom: 1rem; border: 2px solid #ddd; border-radius: 8px; font-size: 1rem; box-sizing: border-box; }
            button { width: 100%; padding: 1rem; background: #1E9A80; color: white; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
            button:hover { background: #17806a; }
          </style>
        </head>
        <body>
          <div class="form-container">
            <h2>📧 Contact Us</h2>
            <input type="text" placeholder="Your Name" />
            <input type="email" placeholder="Email Address" />
            <textarea rows="4" placeholder="Your Message"></textarea>
            <button>Send Message</button>
          </div>
        </body>
      </html>
    `,
  },
  {
    id: 4,
    name: "Product Card",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; font-family: system-ui; background: #1a1a1a; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }
            .product { background: white; border-radius: 20px; overflow: hidden; max-width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
            .image { height: 300px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 4rem; }
            .content { padding: 2rem; }
            h3 { margin: 0 0 1rem 0; font-size: 1.5rem; }
            .price { font-size: 2rem; color: #1E9A80; font-weight: bold; margin-bottom: 1rem; }
            button { width: 100%; padding: 1rem; background: #1E9A80; color: white; border: none; border-radius: 12px; font-size: 1rem; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="product">
            <div class="image">🎁</div>
            <div class="content">
              <h3>Premium Package</h3>
              <div class="price">$99</div>
              <p>Everything you need to build amazing apps with AI-powered tools.</p>
              <button>Add to Cart</button>
            </div>
          </div>
        </body>
      </html>
    `,
  },
  {
    id: 5,
    name: "Team Section",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; font-family: system-ui; background: white; padding: 4rem 2rem; }
            .team { max-width: 1200px; margin: 0 auto; text-align: center; }
            h2 { font-size: 3rem; margin-bottom: 3rem; color: #333; }
            .members { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; }
            .member { padding: 2rem; background: #f8f8f8; border-radius: 16px; transition: transform 0.3s; }
            .member:hover { transform: translateY(-10px); }
            .avatar { width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; font-size: 2rem; }
            .name { font-weight: bold; margin-bottom: 0.5rem; }
          </style>
        </head>
        <body>
          <div class="team">
            <h2>👥 Meet Our Team</h2>
            <div class="members">
              <div class="member"><div class="avatar">🚀</div><div class="name">Sarah Chen</div><div>CEO</div></div>
              <div class="member"><div class="avatar">💻</div><div class="name">Alex Kim</div><div>CTO</div></div>
              <div class="member"><div class="avatar">🎨</div><div class="name">Jordan Lee</div><div>Designer</div></div>
              <div class="member"><div class="avatar">📊</div><div class="name">Morgan Davis</div><div>Analytics</div></div>
            </div>
          </div>
        </body>
      </html>
    `,
  },
];

export default function TestSlideshowPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedHtml, setDisplayedHtml] = useState(SAMPLE_COMPONENTS[0].html);
  const [isAutoCycling, setIsAutoCycling] = useState(true);
  const [pauseTimeout, setPauseTimeout] = useState<NodeJS.Timeout | null>(null);

  // Auto-cycling effect
  useEffect(() => {
    if (!isAutoCycling) return;

    const interval = setInterval(() => {
      // Auto-navigation doesn't pause cycling
      const nextIndex = (currentIndex + 1) % SAMPLE_COMPONENTS.length;
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setDisplayedHtml(SAMPLE_COMPONENTS[nextIndex].html);
        setIsTransitioning(false);
      }, 150);
    }, 3000); // Auto-cycle every 3 seconds

    return () => clearInterval(interval);
  }, [currentIndex, isAutoCycling]);

  const handleTransition = (newIndex: number, isManual: boolean = true) => {
    if (newIndex === currentIndex) return;

    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setDisplayedHtml(SAMPLE_COMPONENTS[newIndex].html);
      setIsTransitioning(false);
    }, 150);

    // Only pause auto-cycling for manual navigation
    if (isManual) {
      setIsAutoCycling(false);
      if (pauseTimeout) clearTimeout(pauseTimeout);
      const timeout = setTimeout(() => {
        setIsAutoCycling(true);
      }, 30000);
      setPauseTimeout(timeout);
    }
  };

  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % SAMPLE_COMPONENTS.length;
    handleTransition(nextIndex, true);
  };

  const handlePrevious = () => {
    const prevIndex =
      currentIndex === 0 ? SAMPLE_COMPONENTS.length - 1 : currentIndex - 1;
    handleTransition(prevIndex, true);
  };

  const handleDotClick = (index: number) => {
    handleTransition(index, true);
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b bg-white p-4 dark:bg-gray-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              🎬 Slideshow Navigation Test
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Testing the component navigation feature with{" "}
              {SAMPLE_COMPONENTS.length} sample components
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Auto-cycling: {isAutoCycling ? "✅ Active" : "⏸️ Paused"}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="relative h-full w-full max-w-5xl">
          {/* Component Preview with Header */}
          <div className="flex h-full flex-col rounded-lg bg-white shadow-xl dark:bg-gray-800">
            {/* Preview Section */}
            <div className="relative flex-1 overflow-hidden rounded-b-lg border-t-2 border-[#1E9A80]">
              <iframe
                srcDoc={displayedHtml}
                className={`h-full w-full border-0 transition-opacity duration-150 ${
                  isTransitioning ? "opacity-0" : "opacity-100"
                }`}
                sandbox="allow-same-origin allow-scripts"
                title={`Component Preview - ${SAMPLE_COMPONENTS[currentIndex].name}`}
              />

              {/* Navigation Controls */}
              <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3 px-4">
                <div className="flex items-center gap-2 rounded-full border border-gray-200/60 bg-transparent px-3 py-2 shadow-lg backdrop-blur-md dark:border-[#2A3833]/60">
                  {/* Previous Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrevious}
                    className="h-8 w-8 rounded-full p-0 hover:bg-gray-100/50 dark:hover:bg-[#2A3833]/50"
                    title="Previous component"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {/* Pagination Dots */}
                  <div className="flex items-center gap-1.5 px-2">
                    {SAMPLE_COMPONENTS.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => handleDotClick(index)}
                        className={`h-2 w-2 rounded-full transition-all duration-200 ${
                          index === currentIndex
                            ? "w-6 bg-[#1E9A80]/70"
                            : "bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500"
                        }`}
                        title={`Go to ${SAMPLE_COMPONENTS[index].name}`}
                      />
                    ))}
                  </div>

                  {/* Next Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNext}
                    className="h-8 w-8 rounded-full p-0 hover:bg-gray-100/50 dark:hover:bg-[#2A3833]/50"
                    title="Next component"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>

                  {/* Component counter */}
                  <div className="ml-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                    {currentIndex + 1}/{SAMPLE_COMPONENTS.length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Current Component Info */}
          <div className="mt-4 rounded-lg bg-white p-4 text-center shadow dark:bg-gray-800">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Currently Viewing:
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {SAMPLE_COMPONENTS[currentIndex].name}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="border-t bg-white p-4 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl text-sm text-gray-600 dark:text-gray-400">
          <strong>Test Instructions:</strong>
          <ul className="mt-2 ml-6 list-disc space-y-1">
            <li>Click the arrows (◀ ▶) to navigate between components</li>
            <li>Click the dots to jump to a specific component</li>
            <li>Components auto-cycle every 3 seconds</li>
            <li>Manual navigation pauses auto-cycling for 30 seconds</li>
            <li>The active dot is elongated and jade green</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
