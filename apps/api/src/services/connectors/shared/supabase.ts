/**
 * Supabase Shared Connector
 * 
 * Configures Supabase backend for generated apps.
 * Provides database, authentication, storage, and real-time features.
 * 
 * @see https://supabase.com/docs
 */

import type {
    SharedConnectorDefinition,
    SharedConnectorCredentials,
} from "../types.js";

export const supabaseConnector: SharedConnectorDefinition = {
    id: "SUPABASE",
    name: "Supabase",
    description: "Open source Firebase alternative with database, auth, and storage",
    icon: "/icons/supabase.svg",

    requiredCredentials: [
        {
            key: "projectUrl",
            label: "Project URL",
            placeholder: "https://xxxxx.supabase.co",
            pattern: /^https:\/\/[a-z0-9-]+\.supabase\.co$/,
            helpUrl: "https://app.supabase.com/project/_/settings/api",
        },
        {
            key: "anonKey",
            label: "Anon/Public Key",
            placeholder: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            helpUrl: "https://app.supabase.com/project/_/settings/api",
        },
        {
            key: "serviceRoleKey",
            label: "Service Role Key (Optional - for admin operations)",
            placeholder: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            helpUrl: "https://app.supabase.com/project/_/settings/api",
        },
    ],

    capabilities: [
        "database",
        "authentication",
        "storage",
        "realtime",
        "edge-functions",
        "vector-search",
    ],

    /**
     * Validate Supabase credentials by making a test request
     */
    async validateCredentials(
        credentials: SharedConnectorCredentials,
    ): Promise<{
        valid: boolean;
        error?: string;
        metadata?: Record<string, unknown>;
    }> {
        const { projectUrl, anonKey } = credentials;

        if (!projectUrl || !anonKey) {
            return {
                valid: false,
                error: "Project URL and Anon Key are required",
            };
        }

        try {
            // Test connection by querying the health endpoint
            const response = await fetch(`${projectUrl}/rest/v1/`, {
                headers: {
                    apikey: anonKey,
                    Authorization: `Bearer ${anonKey}`,
                },
            });

            if (!response.ok) {
                return {
                    valid: false,
                    error: "Invalid Supabase credentials or project URL",
                };
            }

            // Extract project ID from URL
            const projectId = projectUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/)?.[1];

            return {
                valid: true,
                metadata: {
                    projectId,
                    projectUrl,
                },
            };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : "Failed to validate credentials",
            };
        }
    },

    /**
     * Get setup instructions for integrating Supabase into user's app
     */
    getSetupInstructions(credentials: SharedConnectorCredentials): {
        envVars?: Record<string, string>;
        packages?: string[];
        codeTemplates?: { path: string; content: string }[];
    } {
        return {
            // Environment variables
            envVars: {
                VITE_SUPABASE_URL: credentials.projectUrl,
                VITE_SUPABASE_ANON_KEY: credentials.anonKey,
                SUPABASE_SERVICE_ROLE_KEY: credentials.serviceRoleKey || "",
            },

            // NPM packages
            packages: ["@supabase/supabase-js@^2.39.0"],

            // Code templates
            codeTemplates: [
                {
                    path: "src/lib/supabase.ts",
                    content: `/**
 * Supabase Client Configuration
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type-safe database client
export type Database = {
  public: {
    Tables: {
      // Define your tables here
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
        };
      };
    };
  };
};
`,
                },
                {
                    path: "src/components/Auth.tsx",
                    content: `/**
 * Supabase Authentication Component
 */

import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      alert('Check your email for the confirmation link!');
    }

    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    }

    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Sign In / Sign Up</h2>
      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
            required
          />
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
          >
            Sign In
          </button>
          <button
            onClick={handleSignUp}
            disabled={loading}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
          >
            Sign Up
          </button>
        </div>
      </form>
    </div>
  );
}
`,
                },
                {
                    path: "src/hooks/useSupabaseQuery.ts",
                    content: `/**
 * Custom React hook for Supabase queries
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useSupabaseQuery<T>(
  table: string,
  query?: (q: any) => any
) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        let q = supabase.from(table).select('*');
        
        if (query) {
          q = query(q);
        }

        const { data, error } = await q;

        if (error) throw error;
        setData(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [table]);

  return { data, loading, error };
}

// Example usage:
// const { data, loading, error } = useSupabaseQuery<User>('users', 
//   (q) => q.eq('status', 'active').order('created_at', { ascending: false })
// );
`,
                },
                {
                    path: "src/hooks/useSupabaseAuth.ts",
                    content: `/**
 * Custom React hook for Supabase authentication
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
`,
                },
            ],
        };
    },
};