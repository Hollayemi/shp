interface EnchargeUser {
  email: string;
  firstName?: string;
  lastName?: string;
  userId?: string;
  [key: string]: any;
}

interface EnchargeEvent {
  name: string;
  user: EnchargeUser;
  properties?: {
    [key: string]: any;
  };
  occurredAt?: string;
}

class EnchargeClient {
  private apiKey: string;
  private ingestUrl: string = 'https://ingest.encharge.io/v1';

  constructor() {
    this.apiKey = process.env.ENCHARGE_WRITE_KEY || '';

    if (!this.apiKey) {
      console.warn('ENCHARGE_WRITE_KEY not found in environment variables');
    }
  }

  private async makeRequest(data: any): Promise<Response> {
    console.log('🔄 Encharge API Request:');
    console.log('URL:', this.ingestUrl);
    console.log('Headers:', {
      'X-Encharge-Token': this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'NOT_SET',
      'Content-Type': 'application/json',
    });
    console.log('Payload:', JSON.stringify(data, null, 2));

    const response = fetch(this.ingestUrl, {
      method: 'POST',
      headers: {
        'X-Encharge-Token': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return response;
  }

  /**
   * Track an event in Encharge
   */
  async trackEvent(event: EnchargeEvent): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('❌ Encharge write key not configured, skipping event tracking');
      return false;
    }

    console.log('📊 Tracking Encharge event:', event.name);
    console.log('📋 Event details:', {
      name: event.name,
      userEmail: event.user.email,
      userFirstName: event.user.firstName,
      userLastName: event.user.lastName,
      userId: event.user.userId,
      properties: event.properties,
    });

    try {
      // Match the documentation example exactly
      const payload = {
        name: event.name,
        user: {
          email: event.user.email,
          userId: event.user.userId,
          firstName: event.user.firstName,
          lastName: event.user.lastName,
        },
        properties: event.properties || {},
      };

      const response = await this.makeRequest(payload);

      console.log('📡 Encharge API Response:');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Encharge API error:', response.status, errorText);
        return false;
      }

      const responseText = await response.text();
      console.log('✅ Encharge API Response Body:', responseText);

      // Let's see if there are any hints in the response
      try {
        const responseJson = JSON.parse(responseText);
        console.log('📊 Parsed Response:', responseJson);

        if (responseJson.status === 'success' && !responseJson.errors) {
          console.log('✅ Encharge event tracked successfully:', event.name);
        } else {
          console.warn('⚠️ Response success but with potential issues:', responseJson);
        }
      } catch (e) {
        console.log('📄 Response is not JSON:', responseText);
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to track Encharge event:', error);
      return false;
    }
  }

  /**
   * Track user registration event - EXACT copy of docs example
   */
  async trackUserRegistration(user: {
    id: string;
    name: string;
    email: string;
  }): Promise<boolean> {
    console.log('🚀 Starting user registration tracking for:', user.email);
    console.log('👤 Raw user data:', user);

    const [firstName, ...lastNameParts] = user.name.split(' ');
    const lastName = lastNameParts.join(' ');

    // Simple payload - no properties needed
    const payload = {
      name: "Registered user",
      user: {
        email: user.email,
        userId: user.id,
        firstName: firstName || user.name,
        lastName: lastName || undefined,
      }
    };

    console.log('📦 Simple payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await this.makeRequest(payload);

      console.log('📡 Response Status:', response.status);
      console.log('📡 Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        return false;
      }

      const responseText = await response.text();
      console.log('✅ API Response Body:', responseText);

      return true;
    } catch (error) {
      console.error('❌ Error in user registration tracking:', error);
      return false;
    }
  }

  /**
   * Update or create user in Encharge
   */
  async upsertUser(user: EnchargeUser): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('Encharge write key not configured, skipping user upsert');
      return false;
    }

    try {
      const response = await this.makeRequest({
        name: 'identify',
        user: user,
        properties: {},
      });

      console.log('🔍 Identify Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Encharge user upsert error:', response.status, errorText);
        return false;
      }

      const responseText = await response.text();
      console.log('✅ Identify Response Body:', responseText);
      console.log('✅ Encharge user upserted successfully:', user.email);
      return true;
    } catch (error) {
      console.error('Failed to upsert Encharge user:', error);
      return false;
    }
  }

  /**
   * Track password reset request - triggers reset email automation
 */
  async trackPasswordResetRequested(user: {
    id: string;
    name?: string;
    email: string;
    resetUrl: string
  }, resetUrl: string): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('Encharge write key not configured, skipping password reset tracking');
      return false;
    }

    console.log('🔄 Tracking password reset request for:', user.email);

    // Extract first and last name
    const [firstName, ...lastNameParts] = (user.name || user.email || "").trim().split(" ");
    const lastName = lastNameParts.join(" ") || undefined;

    // Build payload explicitly with properties containing resetUrl
    const payload: EnchargeEvent = {
      name: 'Password reset requested',
      user: {
        email: user.email,
        userId: user.id,
        firstName: firstName || user.name,
        lastName,
      },
      properties: {
        resetUrl, // MUST match template variable
      },
      occurredAt: new Date().toISOString(), // optional but recommended
    };

    console.log('📦 Final Encharge payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await this.makeRequest(payload);

      console.log('📡 Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Encharge API error:', response.status, errorText);
        return false;
      }

      const responseText = await response.text();
      console.log('✅ Encharge API Response Body:', responseText);
      console.log('✅ Password reset request tracked successfully for:', user.email);

      return true;
    } catch (error) {
      console.error('❌ Error tracking password reset request:', error);
      return false;
    }
  }

  /**
   * Track password reset completion - triggers confirmation email automation
   */
  async trackPasswordResetCompleted(user: {
    id: string;
    name?: string;
    email: string;
  }): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('Encharge write key not configured, skipping password reset completion tracking');
      return false;
    }

    console.log('✅ Tracking password reset completion for:', user.email);

    const [firstName, ...lastNameParts] = (user.name || user.email || "").trim().split(" ");
    const lastName = lastNameParts.join(" ") || undefined;

    const payload = {
      name: 'Password reset completed',
      user: {
        email: user.email,
        userId: user.id,
        firstName: firstName || user.name,
        lastName,
      },
      properties: {
        timestamp: new Date().toISOString(),
      }
    };

    console.log('📦 Password reset completion payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await this.makeRequest(payload);

      console.log('📡 Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        return false;
      }

      const responseText = await response.text();
      console.log('✅ API Response Body:', responseText);
      console.log('✅ Password reset completion tracked:', user.email);

      return true;
    } catch (error) {
      console.error('❌ Error tracking password reset completion:', error);
      return false;
    }
  }
}

// Export singleton instance
export const encharge = new EnchargeClient();

// Export types for use in other files
export type { EnchargeUser, EnchargeEvent }; 