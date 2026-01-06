/**
 * Atlassian Personal Connector
 * 
 * Connects to Atlassian's API to fetch Jira issues and Confluence pages.
 * Uses OAuth 2.0 with authorization code flow.
 * 
 * @see https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
 * @see https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/
 */

import logger from "../../../config/logger.js";
import type {
    PersonalConnectorDefinition,
    TokenResponse,
    ResourceQuery,
    Resource,
} from "../types.js";

// Environment variables
const ATLASSIAN_CLIENT_ID = "";
const ATLASSIAN_CLIENT_SECRET = "";

if (!ATLASSIAN_CLIENT_ID || !ATLASSIAN_CLIENT_SECRET) {
    throw new Error(
        "Atlassian Connector requires ATLASSIAN_CLIENT_ID and ATLASSIAN_CLIENT_SECRET environment variables.",
    );
}

/**
 * Atlassian connector implementation
 */
export const atlassianConnector: PersonalConnectorDefinition = {
    id: "ATLASSIAN",
    name: "Atlassian",
    description: "Access your Jira issues and Confluence pages to bring context into your builds",
    icon: "/icons/atlassian.svg",

    auth: {
        type: "oauth",
        authUrl: "https://auth.atlassian.com/authorize",
        tokenUrl: "https://auth.atlassian.com/oauth/token",
        scopes: [
            "read:jira-work",
            "read:jira-user",
            "read:confluence-content.all",
            "read:confluence-space.summary",
            "offline_access", // For refresh tokens
        ],
    },

    capabilities: {
        read: ["jira-issues", "confluence-pages", "confluence-spaces"],
        write: ["jira-comments", "confluence-comments"],
    },

    /**
     * Generate OAuth authorization URL for Atlassian
     */
    getAuthUrl(redirectUri: string, state: string): string {
        const params = new URLSearchParams({
            audience: "api.atlassian.com",
            client_id: ATLASSIAN_CLIENT_ID,
            scope: [
                "read:jira-work",
                "read:jira-user",
                "read:confluence-content.all",
                "read:confluence-space.summary",
                "offline_access",
            ].join(" "),
            redirect_uri: "http://localhost:4000/api/connectors/atlassian/callback",
            state,
            response_type: "code",
            prompt: "consent",
        });
        console.log("[Atlassian OAuth] redirect_uri:", redirectUri);
        logger.info({
            msg: "[Atlassian OAuth] redirect_uri:" + redirectUri,
            service: "---",
        });

        return `https://auth.atlassian.com/authorize?${params.toString()}`;
    },

    /**
     * Exchange authorization code for access token
     */
    async handleCallback(
        code: string,
        redirectUri: string,
    ): Promise<TokenResponse> {
        const response = await fetch("https://auth.atlassian.com/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "authorization_code",
                client_id: ATLASSIAN_CLIENT_ID,
                client_secret: ATLASSIAN_CLIENT_SECRET,
                code,
                redirect_uri: redirectUri,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Atlassian OAuth failed: ${error}`);
        }

        const data = await response.json() as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            scope: string;
        };

        const expiresAt = new Date(Date.now() + data.expires_in * 1000);

        // Get accessible resources (sites)
        const resourcesResponse = await fetch(
            "https://api.atlassian.com/oauth/token/accessible-resources",
            {
                headers: {
                    Authorization: `Bearer ${data.access_token}`,
                    Accept: "application/json",
                },
            },
        );

        let sites: any[] = [];
        if (resourcesResponse.ok) {
            sites = (await resourcesResponse.json()) as any[];
        }

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt,
            metadata: {
                scope: data.scope,
                sites: sites.map((site: any) => ({
                    id: site.id,
                    url: site.url,
                    name: site.name,
                    scopes: site.scopes,
                })),
            },
        };
    },

    /**
     * Refresh an expired access token
     */
    async refreshToken(
        refreshToken: string,
        metadata?: Record<string, unknown>,
    ): Promise<TokenResponse> {
        const response = await fetch("https://auth.atlassian.com/oauth/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "refresh_token",
                client_id: ATLASSIAN_CLIENT_ID,
                client_secret: ATLASSIAN_CLIENT_SECRET,
                refresh_token: refreshToken,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token refresh failed: ${error}`);
        }

        const data = await response.json() as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
        };

        const expiresAt = new Date(Date.now() + data.expires_in * 1000);

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt,
            metadata: {
                ...metadata,
                lastRefreshedAt: new Date().toISOString(),
            },
        };
    },

    /**
     * Fetch resources from Atlassian (Jira/Confluence)
     */
    async fetchResources(
        accessToken: string,
        query: ResourceQuery,
    ): Promise<Resource[]> {
        const { resourceType, query: searchQuery, limit = 50 } = query;

        // Get the first site (cloud ID) from metadata
        // In a real implementation, we'd store this during OAuth
        const resourcesResponse = await fetch(
            "https://api.atlassian.com/oauth/token/accessible-resources",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json",
                },
            },
        );

        if (!resourcesResponse.ok) {
            throw new Error("Failed to get accessible resources");
        }

        const sites = await resourcesResponse.json() as Array<{ id: string; url: string }>;
        if (sites.length === 0) {
            throw new Error("No accessible Atlassian sites found");
        }

        const cloudId = sites[0].id;

        // Fetch based on resource type
        if (resourceType === "jira-issues" || resourceType === "search") {
            return await fetchJiraIssues(accessToken, cloudId, searchQuery, limit);
        } else if (resourceType === "confluence-pages") {
            return await fetchConfluencePages(accessToken, cloudId, searchQuery, limit);
        }

        throw new Error(`Unsupported resource type: ${resourceType}`);
    },

    /**
     * Validate that the connection is still working
     */
    async validateConnection(accessToken: string): Promise<boolean> {
        try {
            const response = await fetch(
                "https://api.atlassian.com/oauth/token/accessible-resources",
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: "application/json",
                    },
                },
            );

            return response.ok;
        } catch (error) {
            console.error("[Atlassian] Validation error:", error);
            return false;
        }
    },
};

/**
 * Fetch Jira issues
 */
async function fetchJiraIssues(
    accessToken: string,
    cloudId: string,
    searchQuery?: string,
    limit = 50,
): Promise<Resource[]> {
    const jql = searchQuery
        ? `text ~ "${searchQuery}" ORDER BY updated DESC`
        : "ORDER BY updated DESC";

    const response = await fetch(
        `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                jql,
                maxResults: limit,
                fields: [
                    "summary",
                    "description",
                    "status",
                    "priority",
                    "assignee",
                    "created",
                    "updated",
                ],
            }),
        },
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Jira API request failed: ${error}`);
    }

    const data = await response.json() as {
        issues: Array<{
            id: string;
            key: string;
            self: string;
            fields: {
                summary: string;
                description?: any;
                status: { name: string };
                priority: { name: string };
                assignee?: { displayName: string };
                created: string;
                updated: string;
            };
        }>;
    };

    return data.issues.map((issue) => {
        const description = typeof issue.fields.description === "string"
            ? issue.fields.description
            : issue.fields.description?.content?.[0]?.content?.[0]?.text || "";

        return {
            id: issue.id,
            type: "jira-issue",
            name: `${issue.key}: ${issue.fields.summary}`,
            description: description.substring(0, 200),
            url: issue.self,
            content: `# ${issue.key}: ${issue.fields.summary}\n\n${description}\n\nStatus: ${issue.fields.status.name}\nPriority: ${issue.fields.priority.name}`,
            metadata: {
                key: issue.key,
                status: issue.fields.status.name,
                priority: issue.fields.priority.name,
                assignee: issue.fields.assignee?.displayName,
                created: issue.fields.created,
                updated: issue.fields.updated,
            },
        };
    });
}

/**
 * Fetch Confluence pages
 */
async function fetchConfluencePages(
    accessToken: string,
    cloudId: string,
    searchQuery?: string,
    limit = 50,
): Promise<Resource[]> {
    const cql = searchQuery
        ? `text ~ "${searchQuery}" AND type=page ORDER BY lastmodified DESC`
        : "type=page ORDER BY lastmodified DESC";

    const params = new URLSearchParams({
        cql,
        limit: limit.toString(),
        expand: "body.storage,version",
    });

    const response = await fetch(
        `https://api.atlassian.com/ex/confluence/${cloudId}/rest/api/content/search?${params}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
            },
        },
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Confluence API request failed: ${error}`);
    }

    const data = await response.json() as {
        results: Array<{
            id: string;
            type: string;
            title: string;
            body?: {
                storage: {
                    value: string;
                };
            };
            _links: {
                webui: string;
            };
            version: {
                when: string;
            };
        }>;
    };

    return data.results.map((page) => {
        const content = page.body?.storage?.value || "";
        // Strip HTML tags for plain text content
        const plainContent = content.replace(/<[^>]*>/g, "");

        return {
            id: page.id,
            type: "confluence-page",
            name: page.title,
            description: plainContent.substring(0, 200),
            url: `https://${cloudId}${page._links.webui}`,
            content: `# ${page.title}\n\n${plainContent}`,
            metadata: {
                type: page.type,
                lastModified: page.version.when,
            },
        };
    });
}