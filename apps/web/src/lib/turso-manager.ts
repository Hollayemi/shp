import { prisma } from "@/lib/db";

export type TursoCredentials = {
  databaseName: string;
  url: string;
  authToken: string;
};

const getTursoCredentials = () => {
  const TURSO_API_TOKEN = process.env.TURSO_API_TOKEN;
  const TURSO_ORG_NAME = process.env.TURSO_ORG_NAME;

  if (!TURSO_API_TOKEN || !TURSO_ORG_NAME) {
    throw new Error(
      "TURSO_API_TOKEN and TURSO_ORG_NAME environment variables are required",
    );
  }

  return { TURSO_API_TOKEN, TURSO_ORG_NAME };
};

const TURSO_API_BASE = "https://api.turso.tech/v1";

export const provisionDatabase = async (
  projectId: string,
): Promise<TursoCredentials> => {
  const { TURSO_API_TOKEN, TURSO_ORG_NAME } = getTursoCredentials();
  const databaseName = `project-${projectId.toLowerCase()}`;

  try {
    // Create database via Turso API with correct organization endpoint
    const createResponse = await fetch(
      `${TURSO_API_BASE}/organizations/${TURSO_ORG_NAME}/databases`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TURSO_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: databaseName,
          group: "projects", // Use the "projects" group we created
        }),
      },
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create Turso database: ${error}`);
    }

    const createResult = await createResponse.json();

    // Generate auth token using correct endpoint with organization slug
    const tokenResponse = await fetch(
      `${TURSO_API_BASE}/organizations/${TURSO_ORG_NAME}/databases/${databaseName}/auth/tokens?expiration=never&authorization=full-access`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TURSO_API_TOKEN}`,
        },
      },
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Failed to generate auth token: ${error}`);
    }

    const tokenResult = await tokenResponse.json();

    // Use the correct URL format from the API response
    const url = `libsql://${createResult.database.Hostname}`;

    return {
      databaseName,
      url,
      authToken: tokenResult.jwt, // Use 'jwt' field from response
    };
  } catch (error) {
    console.error("Error provisioning Turso database:", error);
    throw error;
  }
};

export const getConnectionUrlForProject = async (
  projectId: string,
): Promise<TursoCredentials> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      tursoDatabaseName: true,
      tursoDatabaseUrl: true,
      tursoDatabaseToken: true,
    },
  });

  if (
    !project?.tursoDatabaseName ||
    !project?.tursoDatabaseUrl ||
    !project?.tursoDatabaseToken
  ) {
    throw new Error(`No Turso database found for project ${projectId}`);
  }

  return {
    databaseName: project.tursoDatabaseName,
    url: project.tursoDatabaseUrl,
    authToken: project.tursoDatabaseToken,
  };
};

export const deleteDatabase = async (projectId: string): Promise<void> => {
  const { TURSO_API_TOKEN, TURSO_ORG_NAME } = getTursoCredentials();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { tursoDatabaseName: true },
  });

  if (!project?.tursoDatabaseName) {
    console.warn(`No Turso database found for project ${projectId}`);
    return;
  }

  try {
    const response = await fetch(
      `${TURSO_API_BASE}/organizations/${TURSO_ORG_NAME}/databases/${project.tursoDatabaseName}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${TURSO_API_TOKEN}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to delete Turso database: ${error}`);
    }
  } catch (error) {
    console.error("Error deleting Turso database:", error);
  }
};

export const syncSchema = async (
  projectId: string,
  entities: any[],
): Promise<void> => {
  const credentials = await getConnectionUrlForProject(projectId);

  // This would require @libsql/client to be available in the API
  // For now, we'll just log the entities that need to be synced
  console.log(
    `Schema sync requested for project ${projectId} with ${entities.length} entities`,
  );

  // TODO: Implement actual schema sync using libsql client
  // This would involve:
  // 1. Connect to Turso database
  // 2. Generate DDL from entity definitions
  // 3. Execute CREATE TABLE statements
};

// TypeScript types for Turso API responses
export type TursoDatabaseInfo = {
  Name: string;
  DbId: string;
  Hostname: string;
  block_reads: boolean;
  block_writes: boolean;
  regions: string[];
  primaryRegion: string;
  group: string;
  delete_protection: boolean;
  parent: {
    id: string;
    name: string;
    branched_at: string;
  } | null;
};

export type TursoDatabaseStats = {
  query: string;
  rows_read: number;
  rows_written: number;
};

export type TursoDatabaseStatsResponse = {
  top_queries: TursoDatabaseStats[] | null;
};

export type TursoDatabaseUsage = {
  rows_read: number;
  rows_written: number;
  storage_bytes: number;
  embedded_replicas: number;
};

export type TursoDatabaseTable = {
  name: string;
  type: string; // 'table' | 'view' | 'index'
  sql: string | null;
  rowCount?: number;
  columns?: string[];
  rows?: any[][];
};

/**
 * Retrieve database information from Turso API
 * @param projectId - The project ID
 * @returns Database information including name, regions, status, etc.
 */
export const getDatabaseInfo = async (
  projectId: string,
): Promise<TursoDatabaseInfo> => {
  const { TURSO_API_TOKEN, TURSO_ORG_NAME } = getTursoCredentials();
  
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { tursoDatabaseName: true },
  });

  if (!project?.tursoDatabaseName) {
    throw new Error(`No Turso database found for project ${projectId}`);
  }

  try {
    const response = await fetch(
      `${TURSO_API_BASE}/organizations/${TURSO_ORG_NAME}/databases/${project.tursoDatabaseName}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${TURSO_API_TOKEN}`,
        },
      },
    );

    console.log("response", response)

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to retrieve database info: ${error}`);
    }

    const result = await response.json();
    return result.database as TursoDatabaseInfo;
  } catch (error) {
    console.error("Error retrieving database info:", error);
    throw error;
  }
};

/**
 * Retrieve database statistics from Turso API
 * @param projectId - The project ID
 * @returns Database statistics including top queries with rows read/written
 */
export const getDatabaseStats = async (
  projectId: string,
): Promise<TursoDatabaseStatsResponse> => {
  const { TURSO_API_TOKEN, TURSO_ORG_NAME } = getTursoCredentials();
  
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { tursoDatabaseName: true },
  });

  console.log("project", project?.tursoDatabaseName)

  if (!project?.tursoDatabaseName) {
    throw new Error(`No Turso database found for project ${projectId}`);
  }

  try {
    const response = await fetch(
      `${TURSO_API_BASE}/organizations/${TURSO_ORG_NAME}/databases/${project.tursoDatabaseName}/stats`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${TURSO_API_TOKEN}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.warn(`Database stats not available: ${error}`);
      // Stats endpoint doesn't work for AWS-hosted databases
      // Return empty stats instead of throwing error
      return {
        top_queries: null,
      };
    }

    const result = await response.json();
    return result as TursoDatabaseStatsResponse;
  } catch (error) {
    console.error("Error retrieving database stats:", error);
    // Return empty stats on error instead of throwing
    return {
      top_queries: null,
    };
  }
};

/**
 * Retrieve database usage/activity from Turso API
 * @param projectId - The project ID
 * @returns Database usage including rows read/written, storage, embedded syncs
 */
export const getDatabaseUsage = async (
  projectId: string,
): Promise<TursoDatabaseUsage> => {
  const { TURSO_API_TOKEN, TURSO_ORG_NAME } = getTursoCredentials();
  
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { tursoDatabaseName: true },
  });

  if (!project?.tursoDatabaseName) {
    throw new Error(`No Turso database found for project ${projectId}`);
  }

  try {
    // Fetch database usage from Turso API
    const response = await fetch(
      `${TURSO_API_BASE}/organizations/${TURSO_ORG_NAME}/databases/${project.tursoDatabaseName}/usage`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${TURSO_API_TOKEN}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.warn(`Database usage not available: ${error}`);
      // Usage endpoint doesn't work for AWS-hosted databases
      // Return default values instead of throwing error
      return {
        rows_read: 0,
        rows_written: 0,
        storage_bytes: 0,
        embedded_replicas: 0,
      };
    }

    const result = await response.json();
    
    console.log("[getDatabaseUsage] Full API response:", JSON.stringify(result, null, 2));
    
    // Extract usage data from response
    // The API returns: { database: { usage: {...} }, total: {...} }
    const usage = result.database?.usage || result.total || {};
    
    console.log("[getDatabaseUsage] Extracted usage:", usage);
    
    const returnData = {
      rows_read: usage.rows_read || 0,
      rows_written: usage.rows_written || 0,
      storage_bytes: usage.storage_bytes || 0,
      embedded_replicas: usage.bytes_synced || 0, // Use bytes_synced as embedded syncs metric
    };
    
    console.log("[getDatabaseUsage] Returning:", returnData);
    
    return returnData;
  } catch (error) {
    console.error("Error retrieving database usage:", error);
    // Return default values on error
    return {
      rows_read: 0,
      rows_written: 0,
      storage_bytes: 0,
      embedded_replicas: 0,
    };
  }
};

/**
 * Fetch list of tables from Turso database (metadata only, no data)
 * @param projectId - The project ID
 * @returns List of table names and metadata
 */
export const getDatabaseTablesList = async (
  projectId: string,
): Promise<Array<{ name: string; type: string; sql: string | null; rowCount: number }>> => {
  try {
    console.log(`[getDatabaseTablesList] Starting fetch for project ${projectId}`);
    
    // Get database credentials
    const credentials = await getConnectionUrlForProject(projectId);
    const httpUrl = credentials.url.replace('libsql://', 'https://');

    // Query the database using fetch (Turso HTTP API)
    const response = await fetch(httpUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${credentials.authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        statements: [
          {
            q: "SELECT name, type, sql FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%' ORDER BY name",
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[getDatabaseTablesList] Failed to fetch database tables:`, error);
      return [];
    }

    const result = await response.json();
    const statement = result[0];
    if (!statement?.results?.rows) {
      return [];
    }

    const tableNames = statement.results.rows.map((row: any[]) => ({
      name: row[0] as string,
      type: row[1] as string,
      sql: row[2] as string | null,
    }));

    // Get row count for each table
    const tablesWithCount = [];
    for (const table of tableNames) {
      try {
        const countResponse = await fetch(httpUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${credentials.authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            statements: [
              { q: `SELECT COUNT(*) as count FROM "${table.name}"` },
            ],
          }),
        });

        if (countResponse.ok) {
          const countResult = await countResponse.json();
          const count = countResult[0]?.results?.rows?.[0]?.[0] || 0;
          tablesWithCount.push({ ...table, rowCount: count });
        } else {
          tablesWithCount.push({ ...table, rowCount: 0 });
        }
      } catch (error) {
        console.error(`[getDatabaseTablesList] Error fetching count for table ${table.name}:`, error);
        tablesWithCount.push({ ...table, rowCount: 0 });
      }
    }

    console.log(`[getDatabaseTablesList] Returning ${tablesWithCount.length} tables`);
    return tablesWithCount;
  } catch (error) {
    console.error("[getDatabaseTablesList] Error fetching database tables:", error);
    return [];
  }
};

/**
 * Fetch data for a specific table with pagination
 * @param projectId - The project ID
 * @param tableName - Name of the table to fetch data from
 * @param options - Pagination options (limit and offset)
 * @returns Table data with columns and rows
 */
export const getTableData = async (
  projectId: string,
  tableName: string,
  options: { limit?: number; offset?: number } = {},
): Promise<{ columns: string[]; rows: any[][]; totalCount: number }> => {
  const { limit = 10, offset = 0 } = options;
  
  try {
    console.log(`[getTableData] Fetching data for table ${tableName} (limit: ${limit}, offset: ${offset})`);
    
    // Get database credentials
    const credentials = await getConnectionUrlForProject(projectId);
    const httpUrl = credentials.url.replace('libsql://', 'https://');

    // Fetch row count and data
    const response = await fetch(httpUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${credentials.authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        statements: [
          { q: `SELECT COUNT(*) as count FROM "${tableName}"` },
          { q: `SELECT * FROM "${tableName}" LIMIT ${limit} OFFSET ${offset}` },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[getTableData] Failed to fetch table data:`, error);
      return { columns: [], rows: [], totalCount: 0 };
    }

    const result = await response.json();
    const countResult = result[0]?.results?.rows?.[0]?.[0] || 0;
    const tableData = result[1]?.results;

    return {
      columns: tableData?.columns || [],
      rows: tableData?.rows || [],
      totalCount: countResult,
    };
  } catch (error) {
    console.error(`[getTableData] Error fetching data for table ${tableName}:`, error);
    return { columns: [], rows: [], totalCount: 0 };
  }
};
