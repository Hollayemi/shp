import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { generateSlug } from "random-word-slugs";
import type { UserRole } from "@/lib/db";
import { authConfig } from "./auth-config";

// Helper function to generate unique personal team slug - optimized for edge functions
async function generatePersonalTeamSlug(): Promise<string> {
  // More efficient: generate multiple candidates and check in single query
  const candidates = Array.from({ length: 5 }, () => {
    const randomSlug = generateSlug(2, { format: "kebab" });
    return `personal-${randomSlug}`;
  });

  // Check all candidates in single query
  const existingSlugs = await prisma.team.findMany({
    where: { slug: { in: candidates } },
    select: { slug: true },
  });

  const usedSlugs = new Set(existingSlugs.map((team) => team.slug));
  const availableSlug = candidates.find((slug) => !usedSlugs.has(slug));

  // Return first available slug, or fallback with timestamp (no dynamic import needed)
  return (
    availableSlug ||
    `personal-${generateSlug(2, { format: "kebab" })}-${Date.now()}`
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "read:user user:email public_repo", // Request public repo access for GitHub integration
        },
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const validatedFields = z
            .object({
              email: z.string().email(),
              password: z.string().min(6),
            })
            .safeParse(credentials);

          if (!validatedFields.success) {
            return null;
          }

          const { email, password } = validatedFields.data;

          const user = await prisma.user.findUnique({
            where: { email },
            include: { teamMemberships: true },
          });

          if (!user || !user.password) {
            return null;
          }

          const passwordMatch = await bcrypt.compare(password, user.password);

          if (!passwordMatch) {
            return null;
          }

          // Return complete user object that NextAuth expects
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            isNewUser: user.isNewUser,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      // Debug: Log Google account data
      if (account?.provider === "google") {
        console.log("Google OAuth data:", {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          },
          account: { provider: account.provider, type: account.type },
          profile: profile
            ? {
              name: profile.name,
              email: profile.email,
              picture: profile.picture,
            }
            : null,
        });
      }

      // Optimized OAuth account linking and team creation
      if (account && user?.email && account.type === "oauth") {
        try {
          // Single query with all needed data
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
            include: {
              teamMemberships: true,
              accounts: {
                where: { provider: account.provider },
              },
            },
          });

          if (existingUser) {
            // Batch operations in a transaction for efficiency
            await prisma.$transaction(async (tx) => {
              // Link OAuth account if it doesn't exist
              if (existingUser.accounts.length === 0) {
                await tx.account.create({
                  data: {
                    userId: existingUser.id,
                    type: account.type,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                    refresh_token: account.refresh_token as string | null,
                    access_token: account.access_token as string | null,
                    expires_at: account.expires_at as number | null,
                    token_type: account.token_type as string | null,
                    scope: account.scope as string | null,
                    id_token: account.id_token as string | null,
                    session_state: account.session_state as string | null,
                  },
                });
              }

              // Create personal team if user has no teams
              if (existingUser.teamMemberships.length === 0) {
                const slug = await generatePersonalTeamSlug();

                await tx.team.create({
                  data: {
                    name: `${existingUser.name || existingUser.email}'s Team`,
                    description: `Personal workspace for ${existingUser.name || existingUser.email}`,
                    slug,
                    isPersonal: true,
                    members: {
                      create: {
                        userId: existingUser.id,
                        role: "OWNER",
                      },
                    },
                  },
                });
              }
            });

            return true;
          }
        } catch (error) {
          console.error("[Auth] OAuth setup failed:", error);
          // Still allow sign-in even if team creation fails
          return true;
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      // When user signs in, add user data to token
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isNewUser = user.isNewUser;
      }

      // Store GitHub access token when user signs in with GitHub
      if (account?.provider === "github" && account.access_token) {
        // Update user record with GitHub token
        if (user?.id) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              githubAccessToken: account.access_token,
              githubRefreshToken: account.refresh_token,
            },
          });
        }
      }

      // On session update or token refresh, check if GitHub is still connected
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { githubAccessToken: true },
        });
      }

      return token;
    },
    session({ session, token }) {
      // Add user data from token to session
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.isNewUser = token.isNewUser as boolean;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      isNewUser: boolean;
      resetUrl?: string | null;
    };
  }

  interface User {
    role: UserRole;
    isNewUser: boolean;
  }
}
