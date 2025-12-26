import type { Metadata } from "next";
import { Inter, Geist_Mono, Playfair_Display } from "next/font/google";
import Script from "next/script";
import { TRPCReactProvider } from "../../trpc/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthSessionProvider } from "@/components/SessionProvider";
import { auth } from "@/lib/auth";
import ErrorBoundary from "@/components/ErrorBoundary";
import "../globals.css";
import NextTopLoader from "nextjs-toploader";

// Analytics type declarations
declare global {
  interface Window {
    posthog: any;
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap", // Improve font loading performance
  fallback: ["system-ui", "-apple-system", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap", // Improve font loading performance
  fallback: ["ui-monospace", "SFMono-Regular", "monospace"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  display: "swap",
  fallback: ["serif"],
});

export const metadata: Metadata = {
  title: "Shipper",
  description: "Build applications with AI assistance",
};

const icon = "/favicon_shipper.png";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning className="light" style={{ colorScheme: "light" }}>
      <link rel="icon" href={icon} sizes="any" />
      <body
        className={`${inter.variable} ${geistMono.variable} ${playfairDisplay.variable} antialiased`}
        suppressHydrationWarning
        style={{
          background: "transparent",
        }}
      >
        <AuthSessionProvider session={session}>
          <TRPCReactProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              disableTransitionOnChange
            >
              <ErrorBoundary>
                <NextTopLoader />
                {children}
              </ErrorBoundary>
            </ThemeProvider>
          </TRPCReactProvider>
        </AuthSessionProvider>
      </body>
      {/* Google Analytics and PostHog Analytics */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-N6KZ8EPBWR"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-N6KZ8EPBWR');
          `}
      </Script>
      <Script strategy="afterInteractive" id="clarity-script">
        {`
        (function(c,l,a,r,i,t,y){
                c[a]=c[a]function(){(c[a].q=c[a].q[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "t80217c8w7");
        `}
      </Script>
    </html>
  );
}
