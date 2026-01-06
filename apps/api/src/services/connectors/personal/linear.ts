/**
 * Linear Personal Connector
 * 
 * Connects to Linear's API to fetch user's issues, projects, and teams.
 * Uses OAuth 2.0 with PKCE for secure authentication.
 * 
 * @see https://developers.linear.app/docs/oauth/authentication
 */

import crypto from "crypto";
import type {
    PersonalConnectorDefinition,
    TokenResponse,
    ResourceQuery,
    Resource,
} from "../types.js";

// Environment variables
const LINEAR_CLIENT_ID = process.env.LINEAR_CLIENT_ID || "";
const LINEAR_CLIENT_SECRET = process.env.LINEAR_CLIENT_SECRET || "";

/**
 * Generate PKCE code verifier (random string)
 */
function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generate PKCE code challenge from verifier (S256)
 */
function generateCodeChallenge(verifier: string): string {
    return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Linear connector implementation
 */
export const linearConnector: PersonalConnectorDefinition = {
    id: "LINEAR",
    name: "Linear",
    description: "Access your Linear issues, projects, and teams to bring context into your builds",
    icon: "/icons/linear.svg",

    auth: {
        type: "oauth",
        authUrl: "https://linear.app/oauth/authorize",
        tokenUrl: "https://api.linear.app/oauth/token",
        scopes: ["read", "write"], // read: view data, write: create/update issues
    },

    capabilities: {
        read: ["issues", "projects", "teams", "cycles", "labels"],
        write: ["issues", "comments"], // Can create issues and comments
    },

    /**
     * Generate OAuth authorization URL for Linear
     * Uses PKCE for enhanced security
     */
    getAuthUrl(redirectUri: string, state: string): string {
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);

        // Store code verifier in state for PKCE
        const stateWithPKCE = JSON.stringify({
            originalState: state,
            codeVerifier,
        });

        const params = new URLSearchParams({
            client_id: LINEAR_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: "read,write",
            state: Buffer.from(stateWithPKCE).toString("base64"),
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            prompt: "consent", // Always show consent screen
        });

        return `https://linear.app/oauth/authorize?${params.toString()}`;
    },

    /**
     * Exchange authorization code for access token
     */
    async handleCallback(
        code: string,
        redirectUri: string,
        stateParam?: string,
    ): Promise<TokenResponse> {
        // Parse state to get code verifier for PKCE
        let codeVerifier: string | undefined;
        if (stateParam) {
            try {
                const stateData = JSON.parse(Buffer.from(stateParam, "base64").toString());
                codeVerifier = stateData.codeVerifier;
            } catch (e) {
                // State might not be our format
            }
        }

        const response = await fetch("https://api.linear.app/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri,
                client_id: LINEAR_CLIENT_ID,
                client_secret: LINEAR_CLIENT_SECRET,
                code_verifier: codeVerifier || "",
            }).toString(),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Linear OAuth failed: ${error}`);
        }

        const data = await response.json() as {
            access_token: string;
            token_type: string;
            expires_in: number;
            scope: string;
        };

        // Linear tokens expire after the specified time
        const expiresAt = new Date(Date.now() + data.expires_in * 1000);

        return {
            accessToken: data.access_token,
            expiresAt,
            metadata: {
                scope: data.scope,
                tokenType: data.token_type,
            },
        };
    },

    /**
     * Fetch resources from Linear
     */
    async fetchResources(
        accessToken: string,
        query: ResourceQuery,
    ): Promise<Resource[]> {
        const { resourceType, query: searchQuery, limit = 50 } = query;

        // Build GraphQL query based on resource type
        let graphqlQuery = "";

        switch (resourceType) {
            case "issues":
                graphqlQuery = `
          query {
            issues(first: ${limit}, filter: { 
              ${searchQuery ? `title: { containsIgnoreCase: "${searchQuery}" }` : ""}
            }) {
              nodes {
                id
                title
                description
                url
                state {
                  name
                  type
                }
                priority
                priorityLabel
                team {
                  name
                }
                assignee {
                  name
                  email
                }
                createdAt
                updatedAt
              }
            }
          }
        `;
                break;

            case "projects":
                graphqlQuery = `
          query {
            projects(first: ${limit}) {
              nodes {
                id
                name
                description
                url
                state
                progress
                startDate
                targetDate
                lead {
                  name
                }
                createdAt
                updatedAt
              }
            }
          }
        `;
                break;

            case "teams":
                graphqlQuery = `
          query {
            teams(first: ${limit}) {
              nodes {
                id
                name
                description
                key
                private
                createdAt
              }
            }
          }
        `;
                break;

            case "search":
            default:
                // Default to searching issues
                graphqlQuery = `
          query {
            issueSearch(query: "${searchQuery || '*'}", first: ${limit}) {
              nodes {
                id
                title
                description
                url
                state {
                  name
                }
                team {
                  name
                }
              }
            }
          }
        `;
                break;
        }

        // Make GraphQL request to Linear API
        const response = await fetch("https://api.linear.app/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ query: graphqlQuery }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Linear API request failed: ${error}`);
        }

        const result = await response.json() as { errors?: any; data?: any };

        if (result.errors) {
            throw new Error(`Linear GraphQL error: ${JSON.stringify(result.errors)}`);
        }

        // Parse response based on resource type
        const data = result.data;
        let items: any[] = [];

        if (resourceType === "search") {
            items = data.issueSearch?.nodes || [];
        } else if (data.issues) {
            items = data.issues.nodes || [];
        } else if (data.projects) {
            items = data.projects.nodes || [];
        } else if (data.teams) {
            items = data.teams.nodes || [];
        }

        // Convert to Resource format
        return items.map((item: any) => {
            let content = "";

            if (item.description) {
                content = item.description;
            } else if (item.title) {
                content = `# ${item.title}\n\nState: ${item.state?.name || "Unknown"}\nTeam: ${item.team?.name || "Unknown"}`;
            }

            return {
                id: item.id,
                type: resourceType,
                name: item.title || item.name || "Untitled",
                description: item.description || "",
                url: item.url || "",
                content,
                metadata: {
                    state: item.state,
                    priority: item.priority,
                    priorityLabel: item.priorityLabel,
                    team: item.team,
                    assignee: item.assignee,
                    progress: item.progress,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                },
            };
        });
    },

    /**
     * Validate that the connection is still working
     */
    async validateConnection(accessToken: string): Promise<boolean> {
        try {
            const response = await fetch("https://api.linear.app/graphql", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    query: `
            query {
              viewer {
                id
                name
              }
            }
          `,
                }),
            });

            if (!response.ok) return false;

            const result = await response.json() as { data?: { viewer?: { id: string; name: string } } };
            return !!result.data?.viewer;
        } catch (error) {
            console.error("[Linear] Validation error:", error);
            return false;
        }
    },
};