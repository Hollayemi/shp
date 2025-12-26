import { prisma } from "@shipper/database";
import { createProjectLogger, logger } from "../config/logger.js";
import { createClient } from "@libsql/client";

export type TursoCredentials = {
  databaseName: string;
  url: string;
  authToken: string;
};

const getTursoCredentials = () => {
  const TURSO_API_TOKEN = process.env.TURSO_API_TOKEN;
  const TURSO_ORG_NAME = process.env.TURSO_ORG_NAME;
  const TURSO_DB_GROUP = process.env.TURSO_DB_GROUP || "projects";

  logger.debug({
    msg: "Environment check",
    hasToken: !!TURSO_API_TOKEN,
    tokenLength: TURSO_API_TOKEN?.length,
    tokenPrefix: TURSO_API_TOKEN?.substring(0, 10) + "...",
    orgName: TURSO_ORG_NAME,
    dbGroup: TURSO_DB_GROUP,
  });

  if (!TURSO_API_TOKEN || !TURSO_ORG_NAME || !TURSO_DB_GROUP) {
    const missing = [];
    if (!TURSO_API_TOKEN) missing.push("TURSO_API_TOKEN");
    if (!TURSO_ORG_NAME) missing.push("TURSO_ORG_NAME");
    if (!TURSO_DB_GROUP) missing.push("TURSO_DB_GROUP");

    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  return { TURSO_API_TOKEN, TURSO_ORG_NAME, TURSO_DB_GROUP };
};

const TURSO_API_BASE = "https://api.turso.tech/v1";

export const provisionDatabase = async (
  projectId: string,
): Promise<TursoCredentials> => {
  const logger = createProjectLogger(projectId);
  const { TURSO_API_TOKEN, TURSO_ORG_NAME, TURSO_DB_GROUP } =
    getTursoCredentials();
  const databaseName = `project-${projectId.toLowerCase()}`;

  logger.info({
    msg: "Provisioning database",
    databaseName,
    orgName: TURSO_ORG_NAME,
    dbGroup: TURSO_DB_GROUP,
  });

  try {
    // Create database via Turso API with correct organization endpoint
    const createUrl = `${TURSO_API_BASE}/organizations/${TURSO_ORG_NAME}/databases`;
    logger.info({ msg: "Creating database", createUrl });

    const createResponse = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TURSO_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: databaseName,
        group: TURSO_DB_GROUP,
      }),
    });

    logger.info({
      msg: "Create database response",
      status: createResponse.status,
      statusText: createResponse.statusText,
      ok: createResponse.ok,
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      logger.error({
        msg: "Create database failed",
        status: createResponse.status,
        statusText: createResponse.statusText,
        error,
      });
      throw new Error(`Failed to create Turso database: ${error}`);
    }

    const createResult = await createResponse.json() as { database: { Hostname: string } };
    logger.info({
      msg: "Database created successfully",
      hostname: createResult.database?.Hostname,
    });

    // Generate auth token using correct endpoint with organization slug
    const tokenUrl = `${TURSO_API_BASE}/organizations/${TURSO_ORG_NAME}/databases/${databaseName}/auth/tokens?expiration=never&authorization=full-access`;
    logger.info({ msg: "Generating auth token", tokenUrl });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TURSO_API_TOKEN}`,
      },
    });

    logger.info({
      msg: "Token generation response",
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      ok: tokenResponse.ok,
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      logger.error({
        msg: "Token generation failed",
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error,
      });
      throw new Error(`Failed to generate auth token: ${error}`);
    }

    const tokenResult = await tokenResponse.json() as { jwt: string };
    logger.info({
      msg: "Token generated successfully",
      hasJwt: !!tokenResult.jwt,
      jwtLength: tokenResult.jwt?.length,
    });

    // Use the correct URL format from the API response
    const url = `libsql://${createResult.database.Hostname}`;

    logger.info({
      msg: "Database provisioned successfully",
      databaseName,
      url,
    });

    return {
      databaseName,
      url,
      authToken: tokenResult.jwt, // Use 'jwt' field from response
    };
  } catch (error) {
    logger.error({
      msg: "Error provisioning Turso database",
      databaseName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
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
  const logger = createProjectLogger(projectId);
  const { TURSO_API_TOKEN, TURSO_ORG_NAME } = getTursoCredentials();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { tursoDatabaseName: true },
  });

  logger.info({
    msg: "Deleting database",
    databaseName: project?.tursoDatabaseName,
  });

  if (!project?.tursoDatabaseName) {
    logger.warn({ msg: "No Turso database found" });
    return;
  }

  try {
    const deleteUrl = `${TURSO_API_BASE}/organizations/${TURSO_ORG_NAME}/databases/${project.tursoDatabaseName}`;
    logger.info({ msg: "Deleting database", deleteUrl });

    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${TURSO_API_TOKEN}`,
      },
    });

    logger.info({
      msg: "Delete database response",
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({
        msg: "Failed to delete Turso database",
        status: response.status,
        statusText: response.statusText,
        error,
      });
    } else {
      logger.info({
        msg: "Database deleted successfully",
        databaseName: project.tursoDatabaseName,
      });
    }
  } catch (error) {
    logger.error({
      msg: "Error deleting Turso database",
      databaseName: project.tursoDatabaseName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const syncSchema = async (
  projectId: string,
  entities?: any[],
): Promise<void> => {
  const logger = createProjectLogger(projectId);

  try {
    // Retrieve credentials
    const credentials = await getConnectionUrlForProject(projectId);

    logger.info({
      msg: "Connecting to Turso database for schema sync",
      databaseName: credentials.databaseName,
    });

    // Create Turso client
    const client = createClient({
      url: credentials.url,
      authToken: credentials.authToken,
    });

    // Create main entities table
    logger.info({ msg: "Creating entities table" });
    await client.execute(`
      CREATE TABLE IF NOT EXISTS entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index on entity_type for faster queries
    logger.info({ msg: "Creating entity_type index" });
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_entity_type
      ON entities(entity_type);
    `);

    // Create index on created_at for ordering
    logger.info({ msg: "Creating created_at index" });
    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_created_at
      ON entities(created_at);
    `);

    logger.info({
      msg: "Schema sync completed successfully",
      entitiesCount: entities?.length || 0,
    });

    // Close the client connection
    client.close();
  } catch (error) {
    logger.error({
      msg: "Failed to sync schema",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
