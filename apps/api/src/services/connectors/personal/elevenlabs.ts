/**
 * ElevenLabs Personal Connector
 *
 * Connects to ElevenLabs API to access user's voices, models, and audio generation.
 * Uses API Key authentication (stored securely in database).
 *
 * Available Capabilities:
 * - List user's voices
 * - Get available TTS models
 * - Generate audio from text
 * - Access voice history
 *
 * @see https://elevenlabs.io/docs/api-reference
 */

import type {
  PersonalConnectorDefinition,
  TokenResponse,
  ResourceQuery,
  Resource,
} from "../types.js";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

// Type definitions for ElevenLabs API responses
interface ElevenLabsUser {
  subscription: {
    tier: string;
    character_count: number;
    character_limit: number;
  };
  xi_api_key?: string;
  first_name?: string;
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

interface ElevenLabsVoicesResponse {
  voices: ElevenLabsVoice[];
}

interface ElevenLabsModel {
  model_id: string;
  name: string;
  description?: string;
  can_be_finetuned: boolean;
  can_do_voice_conversion: boolean;
  token_cost_factor: number;
  languages: Array<{ language_id: string; name: string }>;
}


/**
 * ElevenLabs connector implementation
 */
export const elevenlabsConnector: PersonalConnectorDefinition = {
  id: "ELEVENLABS",
  name: "ElevenLabs",
  description:
    "Access your ElevenLabs voices and generate AI-powered audio for your apps",
  icon: "/icons/elevenlabs.svg",

  auth: {
    type: "api_key",
    // No OAuth URLs needed for API key auth
  },

  capabilities: {
    read: ["voices", "models", "history", "user"],
    write: ["audio"],
  },

  /**
   * Generate auth URL - Not used for API key auth
   * For API key connectors, the frontend shows an input form instead
   */
  getAuthUrl(_redirectUri: string, _state: string): string {
    // Return empty - API key auth doesn't use OAuth redirect
    return "";
  },

  /**
   * Handle API key submission
   * Called when user submits their API key
   */
  async handleCallback(
    apiKey: string,
    _redirectUri: string,
    _state?: string,
  ): Promise<TokenResponse> {
    // Validate the API key by making a test request
    const response = await fetch(`${ELEVENLABS_API_URL}/user`, {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Invalid API key";
      
      // Try to parse the error response to extract user-friendly message
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.detail?.message) {
          errorMessage = errorJson.detail.message;
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        } else if (errorJson.detail?.status === "invalid_api_key") {
          errorMessage = "Invalid API key. Please check your API key and try again.";
        }
      } catch {
        // If parsing fails, use a default message
        errorMessage = "Invalid API key. Please check your API key and try again.";
      }
      
      throw new Error(errorMessage);
    }

    const userData = (await response.json()) as ElevenLabsUser;

    return {
      accessToken: apiKey, // Store API key as "accessToken"
      // No refresh token for API keys
      // No expiration for API keys
      metadata: {
        subscriptionTier: userData.subscription?.tier,
        characterCount: userData.subscription?.character_count,
        characterLimit: userData.subscription?.character_limit,
        firstName: userData.first_name,
      },
    };
  },

  /**
   * Fetch resources from ElevenLabs
   */
  async fetchResources(
    accessToken: string,
    query: ResourceQuery,
  ): Promise<Resource[]> {
    const headers = {
      "xi-api-key": accessToken,
    };

    switch (query.resourceType) {
      case "voices": {
        const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
          headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch voices: ${response.status}`);
        }

        const data = (await response.json()) as ElevenLabsVoicesResponse;
        return data.voices.map((voice) => ({
          id: voice.voice_id,
          type: "voice",
          name: voice.name,
          description: voice.description || voice.category,
          url: voice.preview_url,
          metadata: {
            category: voice.category,
            labels: voice.labels,
          },
        }));
      }

      case "models": {
        const response = await fetch(`${ELEVENLABS_API_URL}/models`, {
          headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`);
        }

        const models = (await response.json()) as ElevenLabsModel[];
        return models.map((model) => ({
          id: model.model_id,
          type: "model",
          name: model.name,
          description: model.description,
          metadata: {
            canBeFineTuned: model.can_be_finetuned,
            canDoVoiceConversion: model.can_do_voice_conversion,
            tokenCostFactor: model.token_cost_factor,
            languages: model.languages,
          },
        }));
      }

      case "user": {
        const response = await fetch(`${ELEVENLABS_API_URL}/user`, {
          headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch user info: ${response.status}`);
        }

        const user = (await response.json()) as ElevenLabsUser;
        return [
          {
            id: "user",
            type: "user",
            name: user.first_name || "ElevenLabs User",
            description: `Subscription: ${user.subscription?.tier}`,
            metadata: {
              subscription: user.subscription,
            },
          },
        ];
      }

      default: {
        // Default: return voices
        return this.fetchResources(accessToken, {
          ...query,
          resourceType: "voices",
        });
      }
    }
  },

  /**
   * Validate that the API key is still working
   */
  async validateConnection(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/user`, {
        headers: {
          "xi-api-key": accessToken,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Refresh metadata from ElevenLabs API
   * Returns updated subscription info and all capabilities based on actual API data
   */
  async refreshMetadata(accessToken: string): Promise<{
    metadata: Record<string, unknown>;
    capabilities: Record<string, unknown>;
  } | null> {
    try {
      const headers = { "xi-api-key": accessToken };
      
      // Fetch user data
      const userResponse = await fetch(`${ELEVENLABS_API_URL}/user`, { headers });
      if (!userResponse.ok) return null;

      const userData = (await userResponse.json()) as ElevenLabsUser;
      const tier = userData.subscription?.tier || "free";
      
      // Fetch voices to determine voice-related capabilities
      const voicesResponse = await fetch(`${ELEVENLABS_API_URL}/voices`, { headers });
      let voicesData: ElevenLabsVoicesResponse | null = null;
      if (voicesResponse.ok) {
        voicesData = (await voicesResponse.json()) as ElevenLabsVoicesResponse;
      }

      // Fetch models to determine model capabilities
      const modelsResponse = await fetch(`${ELEVENLABS_API_URL}/models`, { headers });
      let modelsData: ElevenLabsModel[] | null = null;
      if (modelsResponse.ok) {
        modelsData = (await modelsResponse.json()) as ElevenLabsModel[];
      }

      // Determine capabilities from actual API data
      const capabilities: Record<string, unknown> = {
        // Subscription info
        subscriptionTier: tier,
        characterCount: userData.subscription?.character_count || 0,
        characterLimit: userData.subscription?.character_limit || 0,
        charactersRemaining: (userData.subscription?.character_limit || 0) - (userData.subscription?.character_count || 0),
        
        // Voice capabilities
        totalVoices: voicesData?.voices.length || 0,
        premadeVoices: voicesData?.voices.filter(v => v.category?.toLowerCase() === "premade").length || 0,
        clonedVoices: voicesData?.voices.filter(v => v.category?.toLowerCase() === "cloned").length || 0,
        customVoices: voicesData?.voices.filter(v => v.category && !["premade", "cloned"].includes(v.category.toLowerCase())).length || 0,
        voiceCloning: (voicesData?.voices.some(v => v.category && v.category.toLowerCase() !== "premade") || false) || tier.toLowerCase() !== "free",
        hasCustomVoices: (voicesData?.voices.some(v => v.category && v.category.toLowerCase() !== "premade") || false),
        
        // Model capabilities
        availableModels: modelsData?.length || 0,
        highQualityModels: modelsData?.some(m => m.name?.toLowerCase().includes("turbo") || m.name?.toLowerCase().includes("multilingual")) || false,
        canFineTune: modelsData?.some(m => m.can_be_finetuned) || false,
        canVoiceConversion: modelsData?.some(m => m.can_do_voice_conversion) || false,
        multilingualSupport: modelsData?.some(m => m.languages && m.languages.length > 1) || false,
        
        // Feature availability (based on tier and actual data)
        textToSpeech: true, // All plans support TTS
        realTimeSynthesis: tier.toLowerCase() !== "free",
        professionalVoiceCloning: tier.toLowerCase().includes("pro") || tier.toLowerCase().includes("scale") || tier.toLowerCase().includes("enterprise"),
        speechToSpeech: tier.toLowerCase() !== "free",
        aiDubbing: tier.toLowerCase() !== "free",
      };

      // Add all voice categories found
      if (voicesData) {
        const categories = new Set(voicesData.voices.map(v => v.category).filter(Boolean));
        capabilities.voiceCategories = Array.from(categories);
      }

      // Add all model names
      if (modelsData) {
        capabilities.modelNames = modelsData.map(m => m.name);
      }
      
      return {
        metadata: {
          subscriptionTier: tier,
          characterCount: userData.subscription?.character_count,
          characterLimit: userData.subscription?.character_limit,
          firstName: userData.first_name,
          lastRefreshed: new Date().toISOString(),
        },
        capabilities,
      };
    } catch {
      return null;
    }
  },
};

/**
 * Generate text-to-speech audio
 * This is a helper function that can be used by AI tools
 */
export async function generateElevenLabsAudio(
  apiKey: string,
  options: {
    text: string;
    voiceId: string;
    modelId?: string;
    voiceSettings?: {
      stability?: number;
      similarity_boost?: number;
      style?: number;
      use_speaker_boost?: boolean;
    };
  },
): Promise<Buffer> {
  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${options.voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: options.text,
        model_id: options.modelId || "eleven_multilingual_v2",
        voice_settings: options.voiceSettings || {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TTS generation failed: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

