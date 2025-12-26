import { openai } from "@inngest/agent-kit";

export function createAzureOpenAIModel(deploymentName: string) {
    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
    const azureDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || deploymentName;
    const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";
  
    // Validate Azure OpenAI configuration
    if (!azureEndpoint || !azureApiKey || !azureDeploymentName) {
      // console.warn("[Azure OpenAI] Missing configuration, falling back to OpenAI");
      return openai({
        model: "gpt-4.1",
        apiKey: process.env.OPENAI_API_KEY!,
        defaultParameters: {
          temperature: 0.1,
        },
      });
    }
  
    // console.log(`[Azure OpenAI] Using Azure OpenAI (agent-kit v0.9.0 compatible)`);
    // console.log(`[Azure OpenAI] Endpoint: ${azureEndpoint}`);
    // console.log(`[Azure OpenAI] Deployment: ${azureDeploymentName}`);
    // console.log(`[Azure OpenAI] API Version: ${azureApiVersion}`);
  
    // Create base OpenAI model first
    const baseModel = openai({
      model: azureDeploymentName,
      apiKey: azureApiKey,
      defaultParameters: {
        temperature: 0.1,
      },
    });
  
    // Construct proper Azure OpenAI URL (following Inngest's pattern)
    const cleanEndpoint = azureEndpoint.endsWith('/') ? azureEndpoint.slice(0, -1) : azureEndpoint;
    const azureUrl = `${cleanEndpoint}/openai/deployments/${azureDeploymentName}/chat/completions?api-version=${azureApiVersion}`;
    
    // console.log(`[Azure OpenAI] Using URL: ${azureUrl}`);
  
    // Return model with minimal Azure configuration (compatible with agent-kit v0.9.0)
    return {
      ...baseModel,
      url: azureUrl,
      // Keep format as "openai-chat" for compatibility with agent-kit v0.9.0
      authKey: azureApiKey, // Override auth key for Azure
      onCall(model: any, body: any) {
        // Enhanced logging for debugging
        // console.log(`[Azure OpenAI] Making request to deployment: ${azureDeploymentName}`);
        // console.log(`[Azure OpenAI] Request body model: ${body.model}`);
        
        // Ensure Azure-specific parameters
        body.model = azureDeploymentName;
        if (baseModel.onCall) {
          baseModel.onCall(model, body);
        }
      },
    };
}

// Test function to verify Azure OpenAI connectivity
export async function testAzureOpenAIConnection(deploymentName: string = "gpt-4.1"): Promise<{
  success: boolean;
  error?: string;
  response?: string;
  config: {
    endpoint: string | undefined;
    deployment: string;
    hasApiKey: boolean;
  };
}> {
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
  const azureDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || deploymentName;
  const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";

  console.log(`[Azure OpenAI Test] Testing connection to deployment: ${azureDeploymentName}`);

  const config = {
    endpoint: azureEndpoint,
    deployment: azureDeploymentName,
    hasApiKey: !!azureApiKey,
  };

  // Check configuration
  if (!azureEndpoint || !azureApiKey || !azureDeploymentName) {
    return {
      success: false,
      error: "Missing Azure OpenAI configuration (endpoint, API key, or deployment name)",
      config,
    };
  }

  try {
    // Create a simple test request
    const cleanEndpoint = azureEndpoint.endsWith('/') ? azureEndpoint.slice(0, -1) : azureEndpoint;
    const azureUrl = `${cleanEndpoint}/openai/deployments/${azureDeploymentName}/chat/completions?api-version=${azureApiVersion}`;
    
    console.log(`[Azure OpenAI Test] Making test request to: ${azureUrl}`);

    const response = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'api-key': azureApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: azureDeploymentName,
        messages: [
          {
            role: 'user',
            content: 'Reply with exactly: "Azure OpenAI connection successful"'
          }
        ],
        max_tokens: 20,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Azure OpenAI Test] HTTP ${response.status}: ${errorText}`);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        config,
      };
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    console.log(`[Azure OpenAI Test] ✅ Connection successful! Response: ${aiResponse}`);

    return {
      success: true,
      response: aiResponse,
      config,
    };
  } catch (error: any) {
    console.error(`[Azure OpenAI Test] ❌ Connection failed:`, error);
    return {
      success: false,
      error: error.message,
      config,
    };
  }
}
  