/**
 * Database API Client
 *
 * Helper functions to interact with the Express API database endpoints
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Get chat token for API authentication
 */
async function getChatToken(): Promise<string> {
  const response = await fetch("/api/get-chat-token");
  const data = await response.json();
  
  if (!data.success || !data.data?.token) {
    throw new Error("Failed to get chat token");
  }
  
  return data.data.token;
}

export interface GenerateRecordsParams {
  projectId: string;
  tableName: string;
  recordCount: number;
  dataDescription: string;
}

export interface GenerateRecordsResponse {
  success: boolean;
  data?: {
    records: any[];
    creditsUsed: number;
    complexity: "simple" | "complex";
  };
  error?: string;
}

export interface InsertRecordsParams {
  projectId: string;
  tableName: string;
  records: any[];
}

export interface InsertRecordsResponse {
  success: boolean;
  data?: {
    insertedCount: number;
    totalRecords: number;
    errors?: string[];
  };
  error?: string;
}

/**
 * Generate database records using AI
 */
export async function generateDatabaseRecords(
  params: GenerateRecordsParams
): Promise<GenerateRecordsResponse> {
  try {
    const chatToken = await getChatToken();

    const response = await fetch(`${API_BASE_URL}/api/v1/database/generate-records`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-chat-token": chatToken,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[Database API] Generate records error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate records",
    };
  }
}

/**
 * Insert records into database table
 */
export async function insertDatabaseRecords(
  params: InsertRecordsParams
): Promise<InsertRecordsResponse> {
  try {
    const chatToken = await getChatToken();

    const response = await fetch(`${API_BASE_URL}/api/v1/database/insert-records`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-chat-token": chatToken,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[Database API] Insert records error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to insert records",
    };
  }
}
