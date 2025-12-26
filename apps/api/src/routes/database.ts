/**
 * Database API Routes
 *
 * Handles database operations including:
 * - AI-powered record generation
 * - Bulk record insertion
 * - Table schema inspection
 */

import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import type { ApiResponse } from "@shipper/shared";
import {
  validateSession,
  validateProjectAccess,
} from "../middleware/session-auth.js";
import { prisma } from "@shipper/database";
import { createClient } from "@libsql/client";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

const router: ExpressRouter = Router();

// Apply session authentication to all database routes
router.use(validateSession);

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Generate database records using AI
 * POST /api/v1/database/generate-records
 */
router.post(
  "/generate-records",
  validateProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const { tableName, recordCount, dataDescription, projectId } = req.body;

      if (!tableName || !recordCount) {
        const response: ApiResponse = {
          success: false,
          error: "Table name and record count are required",
        };
        return res.status(400).json(response);
      }

      // Hard limit: 500 records maximum
      if (recordCount > 500) {
        const response: ApiResponse = {
          success: false,
          error: "Maximum 500 records allowed per generation",
        };
        return res.status(400).json(response);
      }

      // Soft warning threshold: 250+ records
      if (recordCount >= 250) {
        console.log(
          `[Database] Large record generation requested: ${recordCount} records`,
        );
      }

      const result = await generateDatabaseRecords({
        tableName,
        recordCount,
        dataDescription,
        projectId,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          records: result.records,
          creditsUsed: result.creditsUsed,
          complexity: result.complexity,
        },
      };
      res.json(response);
    } catch (error) {
      console.error("[Database] Generate records error:", error);
      const response: ApiResponse = {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate records",
      };
      res.status(500).json(response);
    }
  },
);

/**
 * Insert records into database table
 * POST /api/v1/database/insert-records
 */
router.post(
  "/insert-records",
  validateProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const { projectId, tableName, records } = req.body;

      if (!projectId || !tableName || !records || !Array.isArray(records)) {
        const response: ApiResponse = {
          success: false,
          error: "Project ID, table name, and records array are required",
        };
        return res.status(400).json(response);
      }

      // Get project
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          tursoDatabaseUrl: true,
          tursoDatabaseToken: true,
        },
      });

      if (!project) {
        const response: ApiResponse = {
          success: false,
          error: "Project not found",
        };
        return res.status(404).json(response);
      }

      // Check if project has Turso database
      if (!project.tursoDatabaseUrl || !project.tursoDatabaseToken) {
        const response: ApiResponse = {
          success: false,
          error: "Project does not have a Turso database",
        };
        return res.status(400).json(response);
      }

      // Connect to Turso database
      const turso = createClient({
        url: project.tursoDatabaseUrl,
        authToken: project.tursoDatabaseToken,
      });

      // Validate table name exists (prevent SQL injection)
      const tablesResult = await turso.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      );
      const validTables = tablesResult.rows.map((row: any) => row.name);

      if (!validTables.includes(tableName)) {
        const response: ApiResponse = {
          success: false,
          error: `Table '${tableName}' does not exist in this database`,
        };
        return res.status(400).json(response);
      }

      // Insert records
      let insertedCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const columns = Object.keys(record);
        const values = Object.values(record) as (string | number | null)[];
        const placeholders = columns.map(() => "?").join(", ");

        const insertQuery = `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;

        try {
          await turso.execute(insertQuery, values);
          insertedCount++;
        } catch (error: any) {
          const errorMsg = error?.message || String(error);
          console.error(
            `[Database] Failed to insert record ${i + 1}/${records.length}:`,
            record,
            errorMsg,
          );
          errors.push(`Record ${i + 1}: ${errorMsg}`);

          // If we get a schema error on the first record, fail fast
          if (insertedCount === 0 && errorMsg.includes("no column named")) {
            throw new Error(errorMsg);
          }

          // If we get UNIQUE constraint errors on all records, fail fast
          if (
            insertedCount === 0 &&
            i >= 2 &&
            errors.every((e) => e.includes("UNIQUE constraint"))
          ) {
            throw new Error(
              `All records have UNIQUE constraint failures. This usually means IDs are already in use. ${errorMsg}`,
            );
          }
        }
      }

      if (insertedCount === 0 && errors.length > 0) {
        // Provide helpful error message for UNIQUE constraint failures
        if (errors[0].includes("UNIQUE constraint")) {
          throw new Error(
            `Failed to insert records due to duplicate IDs. The AI may have generated IDs that already exist in the table. Try deleting existing records first or regenerating with different data.`,
          );
        }
        throw new Error(`Failed to insert any records: ${errors[0]}`);
      }

      const response: ApiResponse = {
        success: true,
        data: {
          insertedCount,
          totalRecords: records.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      };
      res.json(response);
    } catch (error) {
      console.error("[Database] Insert records error:", error);
      const response: ApiResponse = {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to insert records",
      };
      res.status(500).json(response);
    }
  },
);

/**
 * Helper function to generate database records using AI
 */
async function generateDatabaseRecords(params: {
  tableName: string;
  recordCount: number;
  dataDescription: string;
  projectId: string;
}): Promise<{
  records: any[];
  creditsUsed: number;
  complexity: "simple" | "complex";
}> {
  const complexity = params.dataDescription.length > 50 ? "complex" : "simple";

  // Get project context and table schema
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: {
      name: true,
      tursoDatabaseUrl: true,
      tursoDatabaseToken: true,
    },
  });

  if (!project?.tursoDatabaseUrl || !project?.tursoDatabaseToken) {
    throw new Error("Project does not have a database");
  }

  // Fetch actual table schema
  const turso = createClient({
    url: project.tursoDatabaseUrl,
    authToken: project.tursoDatabaseToken,
  });

  const schemaResult = await turso.execute(
    `PRAGMA table_info("${params.tableName}")`,
  );
  const columns = schemaResult.rows.map((row: any) => ({
    name: row.name,
    type: row.type,
    notNull: row.notnull === 1,
    defaultValue: row.dflt_value,
    primaryKey: row.pk === 1,
  }));

  // Get the current max ID to avoid UNIQUE constraint errors
  let maxId = 0;
  const primaryKeyColumn = columns.find((col) => col.primaryKey);
  if (primaryKeyColumn) {
    try {
      const maxIdResult = await turso.execute(
        `SELECT MAX("${primaryKeyColumn.name}") as max_id FROM "${params.tableName}"`,
      );
      console.log(
        "[generateDatabaseRecords] Max ID query result:",
        JSON.stringify(maxIdResult.rows),
      );

      // The result might be in different formats depending on the driver
      const firstRow = maxIdResult.rows[0];
      let maxIdValue;

      if (Array.isArray(firstRow)) {
        // Row is an array [value1, value2, ...]
        maxIdValue = firstRow[0];
      } else if (firstRow && typeof firstRow === "object") {
        // Row is an object {max_id: value}
        maxIdValue = firstRow.max_id || firstRow[0];
      }

      maxId = maxIdValue ? Number(maxIdValue) : 0;
      console.log(
        `[generateDatabaseRecords] Current max ID for ${params.tableName}: ${maxId}, will start from ${maxId + 1}`,
      );
    } catch (error) {
      console.log(
        "[generateDatabaseRecords] Could not get max ID, starting from 0:",
        error,
      );
    }
  }

  const columnInfo = columns
    .map(
      (col) =>
        `${col.name} (${col.type}${col.primaryKey ? ", PRIMARY KEY" : ""}${col.notNull ? ", NOT NULL" : ""})`,
    )
    .join("\n");

  const projectContext = project ? `Project: ${project.name}` : "";

  // Use AI to generate realistic sample data
  const startId = maxId + 1;
  const endId = maxId + params.recordCount;

  const prompt = `You are a JSON data generator for a real application. Generate EXACTLY ${params.recordCount} realistic sample records.

${projectContext}

Table Name: ${params.tableName}
Table Schema (MUST USE THESE EXACT COLUMN NAMES):
${columnInfo}

Data Requirements: ${params.dataDescription || "Generate realistic sample data that fits the project context"}

CONTEXT AWARENESS:
- Look at the project name/description above to understand what this app does
- Generate data that would actually be used in THIS specific application
- Make the data realistic and relevant to the app's purpose
- For TEXT columns, use simple readable strings (e.g., "London, UK - See Big Ben and ride London Eye")
- Only use JSON format for columns explicitly typed as JSON/JSONB
- If a column is named "data" but typed as TEXT, use simple descriptive text, NOT JSON
- Use realistic names, emails, and content that fit the app's domain

CRITICAL RULES:
1. Return ONLY a valid JSON array - NO explanations, NO markdown, NO conversation
2. Generate ALL ${params.recordCount} records in a single response
3. Use ONLY the column names from the schema above - DO NOT invent new columns
4. Each record must have realistic, varied data that fits the project context
5. Use proper data types matching the schema (INTEGER for numbers, TEXT for strings, etc.)
6. For PRIMARY KEY columns, generate unique sequential IDs starting from ${startId} to ${endId}
7. For timestamp/date columns, use ISO format: "2024-01-15T10:30:00Z" (no milliseconds)
8. For JSON columns, create valid JSON objects/arrays as strings that match the app's purpose
9. IMPORTANT: The table already has ${maxId} records, so start IDs at ${startId}
10. Make data diverse and realistic - vary the content, don't repeat patterns

Output format (return ONLY this, nothing else):
[
  {column1: value1, column2: value2, ...},
  {column1: value1, column2: value2, ...}
]`;

  const { text } = await generateText({
    model: openrouter("google/gemini-2.5-flash"),
    prompt,
    temperature: 0.7,
  });

  // Parse the AI response
  let records: any[];
  try {
    // Remove markdown code blocks if present
    let cleanedText = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Try to extract JSON array if there's extra text
    const jsonArrayMatch = cleanedText.match(/\[[\s\S]*\]/);
    if (jsonArrayMatch) {
      cleanedText = jsonArrayMatch[0];
    }

    records = JSON.parse(cleanedText);

    // Ensure we have an array
    if (!Array.isArray(records)) {
      throw new Error("Response is not an array");
    }

    // Limit to requested count
    records = records.slice(0, params.recordCount);

    // FALLBACK: Fix IDs if AI didn't respect the range
    if (primaryKeyColumn) {
      const pkName = primaryKeyColumn.name;
      let currentId = startId;
      let needsFixing = false;

      // Check if any IDs are wrong
      for (const record of records) {
        if (record[pkName] !== currentId) {
          needsFixing = true;
          break;
        }
        currentId++;
      }

      // If AI didn't respect IDs, fix them
      if (needsFixing) {
        console.log(
          `[generateDatabaseRecords] AI didn't respect ID range, fixing IDs from ${startId} to ${endId}`,
        );
        currentId = startId;
        for (const record of records) {
          record[pkName] = currentId;
          currentId++;
        }
      }
    }
  } catch (parseError) {
    console.error(
      "[generateDatabaseRecords] Failed to parse AI response:",
      parseError,
    );
    console.error("[generateDatabaseRecords] AI response:", text);
    throw new Error(
      "Failed to parse generated data. The AI returned invalid JSON.",
    );
  }

  // Flat rate pricing: 0.25 credits for any generation
  const creditsUsed = 0.25;

  return {
    records,
    creditsUsed,
    complexity,
  };
}

export default router;
