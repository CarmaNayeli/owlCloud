/**
 * Supabase Client for Token Persistence
 * Stores and retrieves DiceCloud auth tokens across sessions/browsers
 */

// Supabase configuration
const SUPABASE_URL = 'https://gkfpxwvmumaylahtxqrk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrZnB4d3ZtdW1heWxhaHR4cXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NDA4MDIsImV4cCI6MjA4MDAxNjgwMn0.P4a17PQ7i1ZgUvLnFdQGupOtKxx8-CWvPhIaFOl2i7g';

/**
 * Supabase Token Manager
 */
class SupabaseTokenManager {
  constructor() {
    this.supabaseUrl = SUPABASE_URL;
    this.supabaseKey = SUPABASE_ANON_KEY;
    this.tableName = 'auth_tokens';
  }

  /**
   * Generate a unique user ID based on browser fingerprint
   */
  generateUserId() {
    // Create a simple fingerprint from available browser info
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset()
    ].join('|');
    
    // Simple hash to create a consistent ID
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return 'user_' + Math.abs(hash).toString(36);
  }

  /**
   * Store auth token in Supabase
   */
  async storeToken(tokenData) {
    try {
      debug.log('🌐 Storing token in Supabase...');
      
      const userId = this.generateUserId();
      const payload = {
        user_id: userId,
        dicecloud_token: tokenData.token,
        username: tokenData.username || 'DiceCloud User',
        user_id_dicecloud: tokenData.userId,
        token_expires: tokenData.tokenExpires,
        browser_info: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      };

      const response = await fetch(`${this.supabaseUrl}/rest/v1/${this.tableName}`, {
        method: 'POST',
        headers: {
          'apikey': this.supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        // Try to update if insert fails (user already exists)
        const updateResponse = await fetch(`${this.supabaseUrl}/rest/v1/${this.tableName}?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: {
            'apikey': this.supabaseKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            dicecloud_token: tokenData.token,
            username: tokenData.username || 'DiceCloud User',
            user_id_dicecloud: tokenData.userId,
            token_expires: tokenData.tokenExpires,
            browser_info: {
              userAgent: navigator.userAgent,
              timestamp: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
        });

        if (!updateResponse.ok) {
          throw new Error(`Supabase update failed: ${updateResponse.status}`);
        }
      }

      debug.log('✅ Token stored in Supabase successfully');
      return { success: true };
    } catch (error) {
      debug.error('❌ Failed to store token in Supabase:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieve auth token from Supabase
   */
  async retrieveToken() {
    try {
      debug.log('🌐 Retrieving token from Supabase...');
      
      const userId = this.generateUserId();
      debug.log('🔍 Generated user ID for lookup:', userId);
      
      const url = `${this.supabaseUrl}/rest/v1/${this.tableName}?user_id=eq.${userId}&select=*`;
      debug.log('🌐 Supabase query URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': this.supabaseKey,
          'Content-Type': 'application/json'
        }
      });

      debug.log('📥 Supabase response status:', response.status);
      debug.log('📥 Supabase response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        debug.error('❌ Supabase fetch failed:', response.status, errorText);
        throw new Error(`Supabase fetch failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      debug.log('📦 Supabase response data:', data);
      
      if (data && data.length > 0) {
        const tokenData = data[0];
        debug.log('🔍 Found token data:', tokenData);
        
        // Check if token is expired
        if (tokenData.token_expires) {
          const expiryDate = new Date(tokenData.token_expires);
          const now = new Date();
          debug.log('⏰ Token expiry check:', { expiryDate, now, expired: now >= expiryDate });
          
          if (now >= expiryDate) {
            debug.log('⚠️ Supabase token expired, removing...');
            await this.deleteToken();
            return { success: false, error: 'Token expired' };
          }
        }

        debug.log('✅ Token retrieved from Supabase');
        return {
          success: true,
          token: tokenData.dicecloud_token,
          username: tokenData.username,
          userId: tokenData.user_id_dicecloud,
          tokenExpires: tokenData.token_expires
        };
      } else {
        debug.log('ℹ️ No token found in Supabase for user:', userId);
        return { success: false, error: 'No token found' };
      }
    } catch (error) {
      debug.error('❌ Failed to retrieve token from Supabase:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete token from Supabase (logout)
   */
  async deleteToken() {
    try {
      debug.log('🌐 Deleting token from Supabase...');
      
      const userId = this.generateUserId();
      const response = await fetch(`${this.supabaseUrl}/rest/v1/${this.tableName}?user_id=eq.${userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': this.supabaseKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Supabase delete failed: ${response.status}`);
      }

      debug.log('✅ Token deleted from Supabase');
      return { success: true };
    } catch (error) {
      debug.error('❌ Failed to delete token from Supabase:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SupabaseTokenManager;
} else {
  window.SupabaseTokenManager = SupabaseTokenManager;
}
