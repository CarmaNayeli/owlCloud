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
   * Normalize date to ISO 8601 format for PostgreSQL
   * Handles Meteor date formats like "Sat Jan 25 2025 12:00:00 GMT+0300"
   */
  normalizeDate(dateValue) {
    if (!dateValue) return null;
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        debug.warn('⚠️ Invalid date value:', dateValue);
        return null;
      }
      return date.toISOString();
    } catch (e) {
      debug.warn('⚠️ Failed to normalize date:', dateValue, e);
      return null;
    }
  }

  /**
   * Store auth token in Supabase
   */
  async storeToken(tokenData) {
    try {
      debug.log('🌐 Storing token in Supabase...');

      // Use browser fingerprint for consistent storage/retrieval
      const visitorId = this.generateUserId();

      // Normalize token_expires to ISO 8601 format for PostgreSQL
      const normalizedTokenExpires = this.normalizeDate(tokenData.tokenExpires);

      const payload = {
        user_id: visitorId, // Browser fingerprint for cross-session lookup
        dicecloud_token: tokenData.token,
        username: tokenData.username || 'DiceCloud User',
        user_id_dicecloud: tokenData.userId, // Store DiceCloud ID separately
        token_expires: normalizedTokenExpires,
        browser_info: {
          userAgent: navigator.userAgent,
          authId: tokenData.authId, // Store authId in browser_info for reference
          timestamp: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      };

      // Only include Discord fields if provided, to avoid overwriting existing data with null
      if (tokenData.discordUserId) {
        payload.discord_user_id = tokenData.discordUserId;
      }
      if (tokenData.discordUsername) {
        payload.discord_username = tokenData.discordUsername;
      }
      if (tokenData.discordGlobalName) {
        payload.discord_global_name = tokenData.discordGlobalName;
      }

      debug.log('🌐 Storing with browser ID:', visitorId, 'DiceCloud ID:', tokenData.authId);
      if (tokenData.discordUserId) {
        debug.log('🔗 Linking Discord account:', tokenData.discordUsername);
      }

      const response = await fetch(`${this.supabaseUrl}/rest/v1/${this.tableName}`, {
        method: 'POST',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      });

      debug.log('📥 Supabase POST response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        debug.log('⚠️ Supabase POST failed, trying PATCH. Error:', response.status, errorText);

        // Try to update if insert fails (user already exists)
        const updatePayload = {
          dicecloud_token: tokenData.token,
          username: tokenData.username || 'DiceCloud User',
          user_id_dicecloud: tokenData.userId,
          token_expires: normalizedTokenExpires,
          browser_info: {
            userAgent: navigator.userAgent,
            authId: tokenData.authId,
            timestamp: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        };

        // Only include Discord fields if provided, to avoid overwriting existing data with null
        if (tokenData.discordUserId) {
          updatePayload.discord_user_id = tokenData.discordUserId;
        }
        if (tokenData.discordUsername) {
          updatePayload.discord_username = tokenData.discordUsername;
        }
        if (tokenData.discordGlobalName) {
          updatePayload.discord_global_name = tokenData.discordGlobalName;
        }

        const updateResponse = await fetch(`${this.supabaseUrl}/rest/v1/${this.tableName}?user_id=eq.${visitorId}`, {
          method: 'PATCH',
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(updatePayload)
        });

        debug.log('📥 Supabase PATCH response status:', updateResponse.status);

        if (!updateResponse.ok) {
          const patchErrorText = await updateResponse.text();
          debug.error('❌ Supabase PATCH also failed:', updateResponse.status, patchErrorText);
          throw new Error(`Supabase update failed: ${updateResponse.status} - ${patchErrorText}`);
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
          'Authorization': `Bearer ${this.supabaseKey}`,
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
          tokenExpires: tokenData.token_expires,
          discordUserId: tokenData.discord_user_id,
          discordUsername: tokenData.discord_username,
          discordGlobalName: tokenData.discord_global_name
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
          'Authorization': `Bearer ${this.supabaseKey}`,
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

  /**
   * Store character data in Supabase (alias for storeCharacter)
   * Used by popup for character cloud sync
   */
  async storeCharacterData(characterSyncData) {
    try {
      debug.log('🎭 Storing character data in cloud:', characterSyncData.characterId);
      
      // Extract character data from the sync payload
      const characterData = characterSyncData.characterData;
      
      // Use the existing storeCharacter method
      const result = await this.storeCharacter(characterData);
      
      if (result.success) {
        debug.log('✅ Character data stored in cloud successfully');
      } else {
        debug.error('❌ Failed to store character data in cloud:', result.error);
      }
      
      return result;
    } catch (error) {
      debug.error('❌ Error in storeCharacterData:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get character data from Supabase (alias for getCharacter)
   * Used by popup for character cloud sync
   */
  async getCharacterData(diceCloudUserId) {
    try {
      debug.log('🎭 Retrieving character data from cloud for user:', diceCloudUserId);
      
      // Get all characters for this user
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/rollcloud_characters?user_id_dicecloud=eq.${diceCloudUserId}&select=*`,
        {
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch characters: ${response.status}`);
      }

      const data = await response.json();
      
      // Format the response to match expected structure
      const characters = {};
      data.forEach(character => {
        characters[character.dicecloud_character_id] = {
          characterData: character,
          timestamp: character.updated_at
        };
      });
      
      debug.log(`📦 Retrieved ${data.length} characters from cloud`);
      return { 
        success: true, 
        characters: characters,
        count: data.length
      };
    } catch (error) {
      debug.error('❌ Failed to get character data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Store character data in Supabase
   * Links character to Discord pairing for bot commands
   */
  async storeCharacter(characterData, pairingCode = null) {
    try {
      debug.log('🎭 Storing character in Supabase:', characterData.name);

      const payload = {
        user_id_dicecloud: characterData.dicecloudUserId || characterData.userId || null,
        dicecloud_character_id: characterData.id,
        character_name: characterData.name || 'Unknown',
        race: characterData.race || null,
        class: characterData.class || null,
        level: characterData.level || 1,
        alignment: characterData.alignment || null,
        hit_points: characterData.hitPoints || { current: 0, max: 0 },
        hit_dice: characterData.hitDice || { current: 0, max: 0, type: 'd8' },
        temporary_hp: characterData.temporaryHP || 0,
        death_saves: characterData.deathSaves || { successes: 0, failures: 0 },
        inspiration: characterData.inspiration || false,
        armor_class: characterData.armorClass || 10,
        speed: characterData.speed || 30,
        initiative: characterData.initiative || 0,
        proficiency_bonus: characterData.proficiencyBonus || 2,
        attributes: characterData.attributes || {},
        attribute_mods: characterData.attributeMods || {},
        saves: characterData.saves || {},
        skills: characterData.skills || {},
        spell_slots: characterData.spellSlots || {},
        resources: characterData.resources || [],
        conditions: characterData.conditions || [],
        raw_dicecloud_data: characterData.rawDiceCloudData || null,
        updated_at: new Date().toISOString()
      };

      // If pairing code provided, look up the pairing to link
      if (pairingCode) {
        const pairingResponse = await fetch(
          `${this.supabaseUrl}/rest/v1/rollcloud_pairings?pairing_code=eq.${pairingCode}&select=id,discord_user_id`,
          {
            headers: {
              'apikey': this.supabaseKey,
              'Authorization': `Bearer ${this.supabaseKey}`
            }
          }
        );
        if (pairingResponse.ok) {
          const pairings = await pairingResponse.json();
          if (pairings.length > 0) {
            payload.pairing_id = pairings[0].id;
            payload.discord_user_id = pairings[0].discord_user_id;
          }
        }
      } else {
        // No pairing code provided - try to get Discord user ID from auth_tokens or pairings
        let discordUserId = null;

        // First, check auth_tokens
        try {
          const authResponse = await fetch(
            `${this.supabaseUrl}/rest/v1/auth_tokens?user_id=eq.${this.generateUserId()}&select=discord_user_id`,
            {
              headers: {
                'apikey': this.supabaseKey,
                'Authorization': `Bearer ${this.supabaseKey}`
              }
            }
          );
          if (authResponse.ok) {
            const authTokens = await authResponse.json();
            if (authTokens.length > 0 && authTokens[0].discord_user_id) {
              discordUserId = authTokens[0].discord_user_id;
              debug.log('✅ Found Discord user ID from auth_tokens:', discordUserId);
            }
          }
        } catch (error) {
          debug.log('⚠️ Failed to check auth_tokens for Discord user ID:', error.message);
        }

        // If not in auth_tokens, check pairings table for this DiceCloud user
        if (!discordUserId && payload.user_id_dicecloud) {
          try {
            const pairingResponse = await fetch(
              `${this.supabaseUrl}/rest/v1/rollcloud_pairings?dicecloud_user_id=eq.${payload.user_id_dicecloud}&status=eq.connected&select=discord_user_id`,
              {
                headers: {
                  'apikey': this.supabaseKey,
                  'Authorization': `Bearer ${this.supabaseKey}`
                }
              }
            );
            if (pairingResponse.ok) {
              const pairings = await pairingResponse.json();
              if (pairings.length > 0 && pairings[0].discord_user_id) {
                discordUserId = pairings[0].discord_user_id;
                debug.log('✅ Found Discord user ID from pairings:', discordUserId);
              }
            }
          } catch (error) {
            debug.log('⚠️ Failed to check pairings for Discord user ID:', error.message);
          }
        }

        // Set the discord_user_id or use placeholder
        if (discordUserId) {
          payload.discord_user_id = discordUserId;
        } else {
          payload.discord_user_id = 'not_linked';
          debug.log('⚠️ No Discord user ID found, using placeholder');
        }
      }

      // Try to upsert (insert or update on conflict)
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/rollcloud_characters`,
        {
          method: 'POST',
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        debug.log('⚠️ Character POST failed, trying PATCH:', errorText);

        // Try update instead
        const updateResponse = await fetch(
          `${this.supabaseUrl}/rest/v1/rollcloud_characters?dicecloud_character_id=eq.${characterData.id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': this.supabaseKey,
              'Authorization': `Bearer ${this.supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(payload)
          }
        );

        if (!updateResponse.ok) {
          const patchError = await updateResponse.text();
          throw new Error(`Character update failed: ${patchError}`);
        }
      }

      debug.log('✅ Character stored in Supabase:', characterData.name);
      return { success: true };
    } catch (error) {
      debug.error('❌ Failed to store character:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieve character data from Supabase by DiceCloud ID
   */
  async getCharacter(diceCloudCharacterId) {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/rollcloud_characters?dicecloud_character_id=eq.${diceCloudCharacterId}&select=*`,
        {
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch character: ${response.status}`);
      }

      const data = await response.json();
      if (data.length > 0) {
        return { success: true, character: data[0] };
      }
      return { success: false, error: 'Character not found' };
    } catch (error) {
      debug.error('❌ Failed to get character:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get character by Discord user ID (for bot commands)
   */
  async getCharacterByDiscordUser(discordUserId) {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&select=*&order=updated_at.desc&limit=1`,
        {
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch character: ${response.status}`);
      }

      const data = await response.json();
      if (data.length > 0) {
        return { success: true, character: data[0] };
      }
      return { success: false, error: 'No character linked to this Discord user' };
    } catch (error) {
      debug.error('❌ Failed to get character by Discord user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get auth tokens by DiceCloud user ID
   */
  async getAuthTokens(dicecloudUserId) {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/auth_tokens?user_id_dicecloud=eq.${dicecloudUserId}&select=*`,
        {
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get auth tokens: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      debug.error('❌ Failed to get auth tokens:', error);
      throw error;
    }
  }

  /**
   * Update auth tokens with Discord information
   */
  async updateAuthTokens(dicecloudUserId, updateData) {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/auth_tokens?user_id_dicecloud=eq.${dicecloudUserId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update auth tokens: ${errorText}`);
      }

      debug.log('✅ Auth tokens updated successfully');
      return true;
    } catch (error) {
      debug.error('❌ Failed to update auth tokens:', error);
      throw error;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SupabaseTokenManager;
} else {
  window.SupabaseTokenManager = SupabaseTokenManager;
}
