import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      // Public routes that don't need authentication
      const isPublicRoute =
        nextUrl.pathname === "/" ||
        nextUrl.pathname.startsWith("/auth/") ||
        nextUrl.pathname.startsWith("/api/auth/") ||
        nextUrl.pathname.startsWith("/_next/") ||
        nextUrl.pathname.startsWith("/api/inngest") ||
        nextUrl.pathname.startsWith("/api/stripe/webhook") ||
        nextUrl.pathname.startsWith("/api/debug/") ||
        nextUrl.pathname.startsWith("/api/webhooks/") ||
        nextUrl.pathname.startsWith("/api/e2b/") ||
        nextUrl.pathname === "/favicon.ico" ||
        nextUrl.pathname === "/robots.txt" ||
        nextUrl.pathname === "/sitemap.xml";

      // API routes that need authentication
      const isProtectedApiRoute =
        nextUrl.pathname.startsWith("/api/trpc") ||
        (nextUrl.pathname.startsWith("/api/projects/") &&
          !nextUrl.pathname.includes("/stream")) ||
        nextUrl.pathname.startsWith("/api/messages/") ||
        nextUrl.pathname.startsWith("/api/credits/") ||
        nextUrl.pathname.startsWith("/api/checkout/") ||
        nextUrl.pathname.startsWith("/api/user/") ||
        nextUrl.pathname.startsWith("/api/admin/");

      // Pages that need authentication
      const isProtectedPageRoute =
        nextUrl.pathname.startsWith("/projects") ||
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/settings") ||
        nextUrl.pathname.startsWith("/checkout");

      // Allow public routes
      if (isPublicRoute) {
        return true;
      }

      // Require authentication for protected routes
      if (!isLoggedIn && (isProtectedApiRoute || isProtectedPageRoute)) {
        // For API routes, NextAuth will return 401
        // For page routes, NextAuth will redirect to signin page
        return false;
      }

      return true;
    },
  },
  providers: [], // Providers will be defined in auth.ts
} satisfies NextAuthConfig;
