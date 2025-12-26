import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

// Helper to generate fake but realistic metrics
function generateMetrics(featured: boolean) {
  if (featured) {
    return {
      remixCount: Math.floor(Math.random() * 200) + 100, // 100-300
      viewCount: Math.floor(Math.random() * 500) + 200, // 200-700
      saveCount: Math.floor(Math.random() * 80) + 40, // 40-120
    };
  }
  return {
    remixCount: Math.floor(Math.random() * 80) + 20, // 20-100
    viewCount: Math.floor(Math.random() * 200) + 50, // 50-250
    saveCount: Math.floor(Math.random() * 30) + 10, // 10-40
  };
}

// Template definitions
const templates = [
  // ===== LANDING PAGES (4) =====
  {
    name: "Modern SaaS Landing",
    slug: "modern-saas-landing",
    shortDescription:
      "Clean, conversion-optimized landing page for SaaS products",
    description:
      "A modern, responsive landing page template perfect for SaaS products. Features a hero section with CTA, feature showcase, pricing table, testimonials, and FAQ section. Built with Tailwind CSS and includes smooth scroll animations.",
    logo: "🚀",
    categorySlug: "landing-pages",
    tags: ["saas", "landing", "tailwind", "responsive", "modern"],
    featured: true,
    files: {
      "src/App.tsx": `import { ArrowRight, Check, Star, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Navigation */}
      <nav className="sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-blue-600">SaaSify</div>
          <div className="hidden md:flex gap-8">
            <a href="#features" className="hover:text-blue-600">Features</a>
            <a href="#pricing" className="hover:text-blue-600">Pricing</a>
            <a href="#testimonials" className="hover:text-blue-600">Testimonials</a>
          </div>
          <button className="hidden md:block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Get Started
          </button>
          <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="inline-block mb-4 px-4 py-2 bg-blue-100 dark:bg-blue-900 rounded-full text-sm font-medium text-blue-600 dark:text-blue-300">
          ✨ New: AI-Powered Features
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Build Better Products
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
          The all-in-one platform to ship your SaaS product faster. Get started in minutes, scale to millions.
        </p>
        <div className="flex gap-4 justify-center">
          <button className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2">
            Start Free Trial <ArrowRight className="w-5 h-5" />
          </button>
          <button className="px-8 py-4 border-2 border-gray-300 rounded-lg hover:border-blue-600 font-semibold">
            Watch Demo
          </button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-20">
        <h2 className="text-4xl font-bold text-center mb-12">Everything You Need</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {['🚀 Fast Setup', '🔒 Secure', '📊 Analytics'].map((feature, i) => (
            <div key={i} className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
              <div className="text-4xl mb-4">{feature.split(' ')[0]}</div>
              <h3 className="text-xl font-bold mb-2">{feature.split(' ').slice(1).join(' ')}</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit.
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-white">
          <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">Join thousands of teams building better products.</p>
          <button className="px-8 py-4 bg-white text-blue-600 rounded-lg hover:bg-gray-100 font-semibold">
            Start Your Free Trial
          </button>
        </div>
      </section>
    </div>
  );
}`,
      "src/main.tsx": `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`,
      "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
  }
}`,
      "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Modern SaaS Landing</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    },
    seedPrompt:
      "Create a modern, professional landing page for a SaaS product with a hero section, features, and pricing.",
    chatMessages: [
      {
        role: "user",
        content:
          "Create a modern, professional landing page for a SaaS product with a hero section, features, and pricing.",
        order: 0,
      },
      {
        role: "assistant",
        content:
          "I'll create a beautiful SaaS landing page with a gradient hero, sticky navigation, feature cards, and a call-to-action section. Using Tailwind CSS for styling and Lucide React for icons.",
        order: 1,
      },
      {
        role: "user",
        content: "Make the hero text gradient and add a badge for new features",
        order: 2,
      },
      {
        role: "assistant",
        content:
          "Added a gradient text effect for the heading and a subtle badge highlighting new features. The design now has more visual interest and draws attention to key elements.",
        order: 3,
      },
    ],
  },

  {
    name: "Portfolio Showcase",
    slug: "portfolio-showcase",
    shortDescription: "Elegant portfolio template for creative professionals",
    description:
      "Showcase your work beautifully with this minimalist portfolio template. Features a grid-based project gallery, about section, and contact form. Perfect for designers, developers, and creatives.",
    logo: "🎨",
    categorySlug: "landing-pages",
    tags: ["portfolio", "creative", "minimal", "gallery"],
    featured: true,
    files: {
      "src/App.tsx": `import { Github, Linkedin, Mail, ExternalLink } from 'lucide-react';

export default function App() {
  const projects = [
    { title: 'E-commerce Platform', category: 'Web Design', image: '🛍️' },
    { title: 'Mobile Banking App', category: 'UI/UX', image: '📱' },
    { title: 'AI Dashboard', category: 'Product Design', image: '🤖' },
    { title: 'Fitness Tracker', category: 'Mobile App', image: '💪' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="container mx-auto px-4 py-8">
        <nav className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Jane Designer</h1>
          <div className="flex gap-4">
            <a href="#work" className="hover:text-blue-600">Work</a>
            <a href="#about" className="hover:text-blue-600">About</a>
            <a href="#contact" className="hover:text-blue-600">Contact</a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-6xl">
          👩‍💻
        </div>
        <h2 className="text-5xl font-bold mb-4">Product Designer</h2>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Creating delightful digital experiences that users love. Based in San Francisco.
        </p>
        <div className="flex gap-4 justify-center mt-6">
          <a href="#" className="hover:text-blue-600"><Github className="w-6 h-6" /></a>
          <a href="#" className="hover:text-blue-600"><Linkedin className="w-6 h-6" /></a>
          <a href="#" className="hover:text-blue-600"><Mail className="w-6 h-6" /></a>
        </div>
      </section>

      {/* Projects Grid */}
      <section id="work" className="container mx-auto px-4 py-20">
        <h3 className="text-3xl font-bold mb-12">Selected Work</h3>
        <div className="grid md:grid-cols-2 gap-8">
          {projects.map((project, i) => (
            <div key={i} className="group cursor-pointer">
              <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-xl flex items-center justify-center text-8xl mb-4 group-hover:scale-105 transition-transform">
                {project.image}
              </div>
              <h4 className="text-xl font-bold mb-2">{project.title}</h4>
              <p className="text-gray-600 dark:text-gray-400">{project.category}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-20 py-8 text-center text-gray-600 dark:text-gray-400">
        <p>© 2024 Jane Designer. All rights reserved.</p>
      </footer>
    </div>
  );
}`,
      "src/main.tsx": `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`,
      "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Portfolio Showcase</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    },
    seedPrompt: "Build a minimalist portfolio website for a product designer",
    chatMessages: [
      {
        role: "user",
        content: "Build a minimalist portfolio website for a product designer",
        order: 0,
      },
      {
        role: "assistant",
        content:
          "I'll create a clean, minimal portfolio with a hero section showcasing the designer, a project grid, and contact links. Using a simple color scheme to let the work shine.",
        order: 1,
      },
    ],
  },

  {
    name: "Product Launch Page",
    slug: "product-launch-page",
    shortDescription:
      "High-converting launch page with countdown and email capture",
    description:
      "Perfect for product launches! Includes countdown timer, email waitlist signup, feature highlights, and social proof. Eye-catching design that drives conversions.",
    logo: "🎯",
    categorySlug: "landing-pages",
    tags: ["launch", "waitlist", "conversion", "marketing"],
    featured: false,
    files: {
      "src/App.tsx": `import { ArrowRight, Bell, Users, Zap } from 'lucide-react';
import { useState } from 'react';

export default function App() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 text-white">
      <div className="container mx-auto px-4 py-12 text-center">
        {/* Badge */}
        <div className="inline-block mb-6 px-4 py-2 bg-white/20 backdrop-blur-lg rounded-full">
          🚀 Launching Soon
        </div>

        {/* Title */}
        <h1 className="text-6xl md:text-8xl font-bold mb-6">
          The Future of<br />Productivity
        </h1>
        <p className="text-2xl mb-12 opacity-90 max-w-2xl mx-auto">
          Join the waitlist for early access to the next-generation workspace tool
        </p>

        {/* Email Form */}
        {!submitted ? (
          <form onSubmit={handleSubmit} className="max-w-md mx-auto mb-12">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 px-6 py-4 rounded-lg text-gray-900 text-lg"
                required
              />
              <button
                type="submit"
                className="px-8 py-4 bg-white text-purple-600 rounded-lg font-bold hover:bg-gray-100 flex items-center gap-2"
              >
                <Bell className="w-5 h-5" />
                Notify Me
              </button>
            </div>
          </form>
        ) : (
          <div className="mb-12 p-6 bg-white/20 backdrop-blur-lg rounded-xl max-w-md mx-auto">
            <h3 className="text-2xl font-bold mb-2">You're on the list! 🎉</h3>
            <p>We'll notify you when we launch.</p>
          </div>
        )}

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="p-6 bg-white/10 backdrop-blur-lg rounded-xl">
            <Zap className="w-12 h-12 mx-auto mb-4" />
            <h4 className="font-bold text-lg">Lightning Fast</h4>
            <p className="opacity-80">10x faster than competitors</p>
          </div>
          <div className="p-6 bg-white/10 backdrop-blur-lg rounded-xl">
            <Users className="w-12 h-12 mx-auto mb-4" />
            <h4 className="font-bold text-lg">Team Collaboration</h4>
            <p className="opacity-80">Built for teams of all sizes</p>
          </div>
          <div className="p-6 bg-white/10 backdrop-blur-lg rounded-xl">
            <ArrowRight className="w-12 h-12 mx-auto mb-4" />
            <h4 className="font-bold text-lg">Easy Integration</h4>
            <p className="opacity-80">Connect with your favorite tools</p>
          </div>
        </div>
      </div>
    </div>
  );
}`,
      "src/main.tsx": `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`,
      "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Product Launch</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    },
    seedPrompt:
      "Create a product launch page with email waitlist and countdown",
    chatMessages: [
      {
        role: "user",
        content:
          "Create a product launch page with email waitlist and countdown",
        order: 0,
      },
      {
        role: "assistant",
        content:
          "Created a launch page with gradient background, email capture form, and feature highlights. Includes success state after submission.",
        order: 1,
      },
    ],
  },

  // ===== E-COMMERCE (3) =====
  {
    name: "Product Catalog Store",
    slug: "product-catalog-store",
    shortDescription:
      "Full-featured e-commerce store with product grid and cart",
    description:
      "Complete e-commerce template with product grid, filtering, shopping cart, and checkout flow. Includes product details, add to cart functionality, and responsive design perfect for online stores.",
    logo: "🛍️",
    categorySlug: "ecommerce",
    tags: ["ecommerce", "shopping", "cart", "products"],
    featured: true,
    files: {
      "src/App.tsx": `import { ShoppingCart, Search, Heart, Star } from 'lucide-react';
import { useState } from 'react';

const products = [
  { id: 1, name: 'Wireless Headphones', price: 99, rating: 4.5, image: '🎧' },
  { id: 2, name: 'Smart Watch', price: 299, rating: 4.8, image: '⌚' },
  { id: 3, name: 'Laptop Stand', price: 49, rating: 4.3, image: '💻' },
  { id: 4, name: 'USB-C Hub', price: 79, rating: 4.6, image: '🔌' },
  { id: 5, name: 'Mechanical Keyboard', price: 149, rating: 4.9, image: '⌨️' },
  { id: 6, name: 'Webcam HD', price: 89, rating: 4.4, image: '📹' },
];

export default function App() {
  const [cart, setCart] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (id: number) => {
    setCart([...cart, id]);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">TechStore</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 border rounded-lg w-64"
              />
              <Search className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
            </div>
            <button className="relative">
              <ShoppingCart className="w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Products Grid */}
      <main className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">Featured Products</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
            >
              <div className="aspect-square bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 flex items-center justify-center text-8xl">
                {product.image}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">{product.name}</h3>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={\`w-4 h-4 \${
                          i < Math.floor(product.rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }\`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">{product.rating}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold">\${product.price}</span>
                  <button
                    onClick={() => addToCart(product.id)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}`,
      "src/main.tsx": `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`,
      "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Product Catalog</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    },
    seedPrompt: "Create an e-commerce product catalog with shopping cart",
    chatMessages: [
      {
        role: "user",
        content: "Create an e-commerce product catalog with shopping cart",
        order: 0,
      },
      {
        role: "assistant",
        content:
          "I'll build a product catalog with a grid layout, search functionality, and a shopping cart indicator. Products include ratings and add-to-cart buttons.",
        order: 1,
      },
    ],
  },

  // ===== DASHBOARDS (3) =====
  {
    name: "Analytics Dashboard",
    slug: "analytics-dashboard",
    shortDescription: "Beautiful analytics dashboard with charts and metrics",
    description:
      "Professional analytics dashboard template with key metrics, charts, and data tables. Features card-based layout, stat cards, trend indicators, and responsive design. Perfect for SaaS dashboards.",
    logo: "📊",
    categorySlug: "dashboards",
    tags: ["dashboard", "analytics", "metrics", "charts"],
    featured: true,
    files: {
      "src/App.tsx": `import { TrendingUp, TrendingDown, Users, DollarSign, ShoppingBag, Activity } from 'lucide-react';

export default function App() {
  const stats = [
    { label: 'Total Revenue', value: '$45,231', change: '+20.1%', trend: 'up', icon: DollarSign },
    { label: 'Active Users', value: '2,431', change: '+12.5%', trend: 'up', icon: Users },
    { label: 'Orders', value: '1,234', change: '-3.2%', trend: 'down', icon: ShoppingBag },
    { label: 'Conversion Rate', value: '3.24%', change: '+5.7%', trend: 'up', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-800 border-r p-6">
        <h2 className="text-2xl font-bold mb-8">Dashboard</h2>
        <nav className="space-y-2">
          {['Overview', 'Analytics', 'Reports', 'Settings'].map((item) => (
            <button key={item} className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              {item}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        <h1 className="text-3xl font-bold mb-8">Overview</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <stat.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className={\`flex items-center gap-1 text-sm \${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}\`}>
                {stat.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {stat.change} from last month
              </div>
            </div>
          ))}
        </div>

        {/* Chart Placeholder */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <h3 className="text-xl font-bold mb-4">Revenue Over Time</h3>
          <div className="h-64 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Chart visualization would go here</p>
          </div>
        </div>
      </main>
    </div>
  );
}`,
      "src/main.tsx": `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`,
      "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Analytics Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    },
    seedPrompt: "Build an analytics dashboard with key metrics and charts",
    chatMessages: [
      {
        role: "user",
        content: "Build an analytics dashboard with key metrics and charts",
        order: 0,
      },
      {
        role: "assistant",
        content:
          "I'll create a dashboard with a sidebar navigation, stat cards showing key metrics with trend indicators, and a chart placeholder. Using icons from Lucide React.",
        order: 1,
      },
    ],
  },

  // ===== APPS (3) =====
  {
    name: "Todo List App",
    slug: "todo-list-app",
    shortDescription: "Clean todo app with categories and filters",
    description:
      "A beautiful, functional todo list application with categories, priorities, and filtering. Features add/delete/complete functionality, responsive design, and local state management.",
    logo: "✅",
    categorySlug: "apps",
    tags: ["todo", "productivity", "app", "tasks"],
    featured: true,
    files: {
      "src/App.tsx": `import { Plus, Trash2, Check } from 'lucide-react';
import { useState } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  category: string;
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: 1, text: 'Design new landing page', completed: false, category: 'Work' },
    { id: 2, text: 'Buy groceries', completed: false, category: 'Personal' },
    { id: 3, text: 'Finish project proposal', completed: true, category: 'Work' },
  ]);
  const [newTodo, setNewTodo] = useState('');
  const [filter, setFilter] = useState('all');

  const addTodo = () => {
    if (!newTodo.trim()) return;
    setTodos([...todos, { id: Date.now(), text: newTodo, completed: false, category: 'Work' }]);
    setNewTodo('');
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  const filteredTodos = todos.filter(t => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">My Tasks</h1>
          <p className="text-gray-600 dark:text-gray-400">Stay organized and productive</p>
        </div>

        {/* Add Todo */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTodo()}
              placeholder="What needs to be done?"
              className="flex-1 px-4 py-3 border rounded-lg dark:bg-gray-700"
            />
            <button
              onClick={addTodo}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {['all', 'active', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={\`px-4 py-2 rounded-lg capitalize \${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 hover:bg-gray-100'
              }\`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Todo List */}
        <div className="space-y-3">
          {filteredTodos.map((todo) => (
            <div
              key={todo.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => toggleTodo(todo.id)}
                className={\`w-6 h-6 rounded border-2 flex items-center justify-center \${
                  todo.completed
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300'
                }\`}
              >
                {todo.completed && <Check className="w-4 h-4 text-white" />}
              </button>
              <span className={\`flex-1 \${todo.completed ? 'line-through text-gray-400' : ''}\`}>
                {todo.text}
              </span>
              <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded">
                {todo.category}
              </span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {filteredTodos.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No tasks found. Add one above!
          </div>
        )}
      </div>
    </div>
  );
}`,
      "src/main.tsx": `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`,
      "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Todo List</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    },
    seedPrompt:
      "Create a todo list app with add, delete, and filter functionality",
    chatMessages: [
      {
        role: "user",
        content:
          "Create a todo list app with add, delete, and filter functionality",
        order: 0,
      },
      {
        role: "assistant",
        content:
          "I'll build a todo app with add/delete/toggle functionality, filters for all/active/completed tasks, and category tags. Using React state for task management.",
        order: 1,
      },
      {
        role: "user",
        content: "Add visual feedback when tasks are completed",
        order: 2,
      },
      {
        role: "assistant",
        content:
          "Added strikethrough text and a checkmark icon for completed tasks. Also using different colors for the checkbox state.",
        order: 3,
      },
    ],
  },

  {
    name: "Note Taking App",
    slug: "note-taking-app",
    shortDescription: "Markdown note-taking app with sidebar navigation",
    description:
      "A clean, minimal note-taking application with sidebar navigation, markdown support ready, and a beautiful editor interface. Perfect for personal wikis or documentation.",
    logo: "📝",
    categorySlug: "apps",
    tags: ["notes", "markdown", "writing", "productivity"],
    featured: false,
    files: {
      "src/App.tsx": `import { Plus, Search, Trash2, Edit } from 'lucide-react';
import { useState } from 'react';

interface Note {
  id: number;
  title: string;
  content: string;
  updatedAt: Date;
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([
    { id: 1, title: 'Welcome Note', content: 'Start writing your thoughts here...', updatedAt: new Date() },
    { id: 2, title: 'Project Ideas', content: 'Brainstorm for new features', updatedAt: new Date() },
  ]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(notes[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createNote = () => {
    const newNote = {
      id: Date.now(),
      title: 'Untitled Note',
      content: '',
      updatedAt: new Date(),
    };
    setNotes([newNote, ...notes]);
    setSelectedNote(newNote);
  };

  const updateNote = (id: number, updates: Partial<Note>) => {
    setNotes(notes.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date() } : n));
    if (selectedNote?.id === id) {
      setSelectedNote({ ...selectedNote, ...updates });
    }
  };

  const deleteNote = (id: number) => {
    setNotes(notes.filter(n => n.id !== id));
    if (selectedNote?.id === id) {
      setSelectedNote(notes[0] || null);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-80 bg-white dark:bg-gray-800 border-r flex flex-col">
        <div className="p-4 border-b">
          <button
            onClick={createNote}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Note
          </button>
        </div>

        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredNotes.map((note) => (
            <button
              key={note.id}
              onClick={() => setSelectedNote(note)}
              className={\`w-full p-4 text-left border-b hover:bg-gray-50 dark:hover:bg-gray-700 \${
                selectedNote?.id === note.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }\`}
            >
              <h3 className="font-semibold truncate">{note.title}</h3>
              <p className="text-sm text-gray-500 truncate">{note.content || 'Empty note'}</p>
            </button>
          ))}
        </div>
      </aside>

      {/* Editor */}
      <main className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            <div className="p-6 border-b bg-white dark:bg-gray-800 flex justify-between items-center">
              <input
                type="text"
                value={selectedNote.title}
                onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
                className="text-2xl font-bold border-none outline-none bg-transparent flex-1"
              />
              <button
                onClick={() => deleteNote(selectedNote.id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-6">
              <textarea
                value={selectedNote.content}
                onChange={(e) => updateNote(selectedNote.id, { content: e.target.value })}
                placeholder="Start writing..."
                className="w-full h-full resize-none border-none outline-none text-lg dark:bg-gray-900"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a note or create a new one
          </div>
        )}
      </main>
    </div>
  );
}`,
      "src/main.tsx": `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`,
      "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Note Taking App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    },
    seedPrompt: "Create a note-taking app with sidebar and markdown editor",
    chatMessages: [
      {
        role: "user",
        content: "Create a note-taking app with sidebar and markdown editor",
        order: 0,
      },
      {
        role: "assistant",
        content:
          "I'll build a note app with a sidebar for note list, search functionality, and a large editor area. Using React state to manage notes.",
        order: 1,
      },
    ],
  },

  // ===== FORMS & TOOLS (2) =====
  {
    name: "Multi-Step Form",
    slug: "multi-step-form",
    shortDescription: "Beautiful multi-step form with progress indicator",
    description:
      "A well-designed multi-step form template perfect for onboarding, surveys, or data collection. Features progress indicators, validation, and smooth transitions between steps.",
    logo: "📋",
    categorySlug: "forms-tools",
    tags: ["form", "multi-step", "wizard", "onboarding"],
    featured: false,
    files: {
      "src/App.tsx": `import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { useState } from 'react';

export default function App() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    role: '',
  });

  const totalSteps = 3;

  const nextStep = () => setStep(Math.min(step + 1, totalSteps));
  const prevStep = () => setStep(Math.max(step - 1, 1));

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={\`flex-1 h-2 rounded-full mx-1 \${
                  i + 1 <= step ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                }\`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            Step {step} of {totalSteps}
          </p>
        </div>

        {/* Form Steps */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-3xl font-bold mb-6">Personal Information</h2>
            <div>
              <label className="block mb-2 font-medium">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700"
                placeholder="john@example.com"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-3xl font-bold mb-6">Work Information</h2>
            <div>
              <label className="block mb-2 font-medium">Company</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700"
                placeholder="Acme Inc"
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg dark:bg-gray-700"
              >
                <option value="">Select a role</option>
                <option value="developer">Developer</option>
                <option value="designer">Designer</option>
                <option value="manager">Manager</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold mb-4">All Set!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Thank you for completing the form. We'll be in touch soon.
            </p>
            <div className="text-left bg-gray-50 dark:bg-gray-700 rounded-lg p-6 space-y-2">
              <p><strong>Name:</strong> {formData.name}</p>
              <p><strong>Email:</strong> {formData.email}</p>
              <p><strong>Company:</strong> {formData.company}</p>
              <p><strong>Role:</strong> {formData.role}</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={prevStep}
            disabled={step === 1}
            className="px-6 py-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          {step < totalSteps && (
            <button
              onClick={nextStep}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}`,
      "src/main.tsx": `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`,
      "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Multi-Step Form</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    },
    seedPrompt: "Build a multi-step form with progress indicator",
    chatMessages: [
      {
        role: "user",
        content: "Build a multi-step form with progress indicator",
        order: 0,
      },
      {
        role: "assistant",
        content:
          "I'll create a 3-step form wizard with a progress bar, next/back navigation, and a summary page. Each step collects different information.",
        order: 1,
      },
    ],
  },

  // ===== CREATIVE (2) =====
  {
    name: "Photo Gallery",
    slug: "photo-gallery",
    shortDescription: "Responsive image gallery with lightbox and filters",
    description:
      "A stunning photo gallery template with grid layout, category filters, and lightbox view. Perfect for photographers, artists, and portfolios. Fully responsive with smooth animations.",
    logo: "📷",
    categorySlug: "creative",
    tags: ["gallery", "photos", "portfolio", "images"],
    featured: false,
    files: {
      "src/App.tsx": `import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const photos = [
  { id: 1, category: 'Nature', emoji: '🏔️', title: 'Mountain Sunset' },
  { id: 2, category: 'Urban', emoji: '🌆', title: 'City Lights' },
  { id: 3, category: 'Nature', emoji: '🌊', title: 'Ocean Waves' },
  { id: 4, category: 'Urban', emoji: '🏙️', title: 'Downtown' },
  { id: 5, category: 'People', emoji: '👥', title: 'Street Portrait' },
  { id: 6, category: 'Nature', emoji: '🌲', title: 'Forest Path' },
];

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(0);

  const categories = ['All', ...Array.from(new Set(photos.map(p => p.category)))];
  const filteredPhotos = selectedCategory === 'All'
    ? photos
    : photos.filter(p => p.category === selectedCategory);

  const openLightbox = (index: number) => {
    setSelectedPhoto(index);
    setLightboxOpen(true);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="border-b p-6 text-center">
        <h1 className="text-4xl font-bold mb-2">Photo Gallery</h1>
        <p className="text-gray-600 dark:text-gray-400">My Photography Collection</p>
      </header>

      {/* Filters */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-3 justify-center flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={\`px-6 py-2 rounded-full \${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200'
              }\`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="container mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPhotos.map((photo, index) => (
            <div
              key={photo.id}
              onClick={() => openLightbox(index)}
              className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-xl cursor-pointer hover:scale-105 transition-transform flex items-center justify-center text-9xl"
            >
              {photo.emoji}
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <X className="w-8 h-8" />
          </button>
          <div className="text-center">
            <div className="text-[20rem] mb-4">{filteredPhotos[selectedPhoto].emoji}</div>
            <h3 className="text-2xl font-bold text-white">{filteredPhotos[selectedPhoto].title}</h3>
            <p className="text-gray-300">{filteredPhotos[selectedPhoto].category}</p>
          </div>
        </div>
      )}
    </div>
  );
}`,
      "src/main.tsx": `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`,
      "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Photo Gallery</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    },
    seedPrompt: "Create a photo gallery with filters and lightbox",
    chatMessages: [
      {
        role: "user",
        content: "Create a photo gallery with filters and lightbox",
        order: 0,
      },
      {
        role: "assistant",
        content:
          "I'll build a responsive gallery with category filters and a lightbox modal for viewing full-size images. Using emoji placeholders for the images.",
        order: 1,
      },
    ],
  },
];

async function main() {
  console.log("🌱 Starting template seeding...\n");

  // Get categories
  const categories = await prisma.templateCategory.findMany();
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  if (Object.keys(categoryMap).length === 0) {
    console.error(
      "❌ No categories found! Please run seed-categories.ts first.",
    );
    process.exit(1);
  }

  let createdCount = 0;
  let skippedCount = 0;

  for (const templateConfig of templates) {
    try {
      const categoryId = categoryMap[templateConfig.categorySlug];
      if (!categoryId) {
        console.error(`❌ Category not found: ${templateConfig.categorySlug}`);
        continue;
      }

      // Check if template already exists
      const existing = await prisma.communityTemplate.findUnique({
        where: { slug: templateConfig.slug },
      });

      if (existing) {
        console.log(`⏭️  Already exists: ${templateConfig.name}`);
        skippedCount++;
        continue;
      }

      // Create fragment with files
      const fragment = await prisma.v2Fragment.create({
        data: {
          title: `${templateConfig.name} - Template`,
          files: templateConfig.files as any,
          // projectId is optional for template fragments
        },
      });

      // Generate metrics
      const metrics = generateMetrics(templateConfig.featured);

      // Create template
      const template = await prisma.communityTemplate.create({
        data: {
          name: templateConfig.name,
          slug: templateConfig.slug,
          description: templateConfig.description,
          shortDescription: templateConfig.shortDescription,
          logo: templateConfig.logo,
          categoryId,
          tags: templateConfig.tags,
          sourceFragmentId: fragment.id,
          authorName: "Shipper Team",
          featured: templateConfig.featured,
          published: true,
          chatHistoryVisible: true,
          seedPrompt: templateConfig.seedPrompt,
          ...metrics,
          price: 0, // Free templates
        },
      });

      // Create chat messages
      if (
        templateConfig.chatMessages &&
        templateConfig.chatMessages.length > 0
      ) {
        await prisma.templateChatMessage.createMany({
          data: templateConfig.chatMessages.map((msg) => ({
            templateId: template.id,
            role: msg.role,
            content: msg.content,
            order: msg.order,
          })),
        });
      }

      createdCount++;
      console.log(`✅ Created: ${template.name}`);
      console.log(`   📁 Category: ${templateConfig.categorySlug}`);
      console.log(`   🔁 Remixes: ${metrics.remixCount}`);
      console.log(`   👁️  Views: ${metrics.viewCount}`);
      console.log(`   ⭐ Featured: ${template.featured ? "Yes" : "No"}`);
      console.log();
    } catch (error) {
      console.error(`❌ Failed: ${templateConfig.name}`);
      console.error(error);
      console.log();
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`🎉 Seeding Complete!`);
  console.log(`   ✅ Created: ${createdCount} templates`);
  console.log(`   ⏭️  Skipped: ${skippedCount} (already exist)`);
  console.log(
    `   📊 Total: ${createdCount + skippedCount} templates in database`,
  );
  console.log("=".repeat(50) + "\n");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

async function seedTemplates() {
  console.log("🌱 Starting template seeding...\n");

  // Get categories
  const categories = await prisma.templateCategory.findMany();
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  let createdCount = 0;

  for (const templateConfig of templates) {
    try {
      const categoryId = categoryMap[templateConfig.categorySlug];
      if (!categoryId) {
        console.error(`❌ Category not found: ${templateConfig.categorySlug}`);
        continue;
      }

      // Check if template already exists
      const existing = await prisma.communityTemplate.findUnique({
        where: { slug: templateConfig.slug },
      });

      if (existing) {
        console.log(`⏭️  Template already exists: ${templateConfig.name}`);
        continue;
      }

      // Create fragment with files
      const fragment = await prisma.v2Fragment.create({
        data: {
          title: `${templateConfig.name} - Template`,
          files: templateConfig.files as any,
          // projectId is optional for template fragments
        },
      });

      // Generate metrics
      const metrics = generateMetrics(templateConfig.featured);

      // Create template
      const template = await prisma.communityTemplate.create({
        data: {
          name: templateConfig.name,
          slug: templateConfig.slug,
          description: templateConfig.description,
          shortDescription: templateConfig.shortDescription,
          logo: templateConfig.logo,
          categoryId,
          tags: templateConfig.tags,
          sourceFragmentId: fragment.id,
          authorName: "Shipper Team",
          featured: templateConfig.featured,
          published: true,
          chatHistoryVisible: true,
          seedPrompt: templateConfig.seedPrompt,
          ...metrics,
          price: 0, // Free templates
        },
      });

      // Create chat messages
      if (
        templateConfig.chatMessages &&
        templateConfig.chatMessages.length > 0
      ) {
        await prisma.templateChatMessage.createMany({
          data: templateConfig.chatMessages.map((msg) => ({
            templateId: template.id,
            role: msg.role,
            content: msg.content,
            order: msg.order,
          })),
        });
      }

      createdCount++;
      console.log(`✅ Created template: ${template.name}`);
      console.log(`   - Category: ${templateConfig.categorySlug}`);
      console.log(`   - Remixes: ${metrics.remixCount}`);
      console.log(`   - Featured: ${template.featured ? "Yes" : "No"}`);
      console.log();
    } catch (error) {
      console.error(`❌ Failed to create template: ${templateConfig.name}`);
      console.error(error);
      console.log();
    }
  }

  console.log(`\n🎉 Seeding complete! Created ${createdCount} templates.`);
}

seedTemplates()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
