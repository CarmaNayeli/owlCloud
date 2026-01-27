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
      // Use fallback for screen in service workers
      (typeof screen !== 'undefined' ? screen.width + 'x' + screen.height : 'unknown'),
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
   * Generate a unique session ID for this browser instance
   */
  generateSessionId() {
    // Create a more unique session ID using additional entropy
    const sessionData = [
      navigator.userAgent,
      navigator.language,
      // Use fallback for screen in service workers
      (typeof screen !== 'undefined' ? screen.width + 'x' + screen.height : 'unknown'),
      new Date().getTimezoneOffset(),
      Math.random().toString(36),
      Date.now().toString(36)
    ].join('|');
    
    let hash = 0;
    for (let i = 0; i < sessionData.length; i++) {
      const char = sessionData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'session_' + Math.abs(hash).toString(36);
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

      // Clear any previous invalidation/conflict info FIRST when logging in
      // This prevents stale data from causing login failures
      await browserAPI.storage.local.remove(['sessionInvalidated', 'sessionConflict']);

      // Use browser fingerprint for consistent storage/retrieval
      const visitorId = this.generateUserId();
      const sessionId = this.generateSessionId();

      // Invalidate all OTHER sessions for this DiceCloud account (different browsers)
      // This ensures only one browser can be logged in at a time per account
      if (tokenData.userId) {
        await this.invalidateOtherSessions(tokenData.userId, sessionId);
      }

      // Check for existing sessions with different tokens (same browser, different account)
      const conflictCheck = await this.checkForTokenConflicts(visitorId, tokenData.token);

      if (conflictCheck.hasConflict) {
        debug.log('⚠️ Token conflict detected - different browser logged in');
        // Store conflict info for later display
        await this.storeConflictInfo(conflictCheck);
      }

      // Normalize token_expires to ISO 8601 format for PostgreSQL
      const normalizedTokenExpires = this.normalizeDate(tokenData.tokenExpires);

      const payload = {
        user_id: visitorId, // Browser fingerprint for cross-session lookup
        session_id: sessionId, // Unique session identifier
        dicecloud_token: tokenData.token,
        username: tokenData.username || 'DiceCloud User',
        user_id_dicecloud: tokenData.userId, // Store DiceCloud ID separately
        token_expires: normalizedTokenExpires,
        browser_info: {
          userAgent: navigator.userAgent,
          authId: tokenData.authId, // Store authId in browser_info for reference
          timestamp: new Date().toISOString(),
          sessionId: sessionId
        },
        updated_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        // Clear any previous invalidation (this is a fresh login)
        invalidated_at: null,
        invalidated_by_session: null,
        invalidated_reason: null
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

      debug.log('🌐 Storing with browser ID:', visitorId, 'Session ID:', sessionId, 'DiceCloud ID:', tokenData.authId);
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
          session_id: sessionId, // Update session ID to match local storage
          browser_info: {
            userAgent: navigator.userAgent,
            authId: tokenData.authId,
            timestamp: new Date().toISOString(),
            sessionId: sessionId
          },
          updated_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          // Clear any previous invalidation (this is a fresh login)
          invalidated_at: null,
          invalidated_by_session: null,
          invalidated_reason: null
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

      // Store session ID locally AFTER database update succeeds to avoid race condition
      await this.storeCurrentSession(sessionId);

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

        // Check if this session was invalidated by another login
        if (tokenData.invalidated_at) {
          debug.log('🚫 Session was invalidated at:', tokenData.invalidated_at);
          debug.log('🚫 Invalidated reason:', tokenData.invalidated_reason);

          // Clear local auth data to prevent auto-restore loops
          await browserAPI.storage.local.remove(['diceCloudToken', 'diceCloudUserId', 'tokenExpires', 'username', 'currentSessionId']);

          // Store info about who logged us out for display
          await browserAPI.storage.local.set({
            sessionInvalidated: {
              at: tokenData.invalidated_at,
              reason: tokenData.invalidated_reason || 'logged_in_elsewhere',
              bySession: tokenData.invalidated_by_session
            }
          });

          // Delete the invalidated record from Supabase to clean up
          await this.deleteToken();

          return {
            success: false,
            error: 'Session invalidated',
            invalidated: true,
            reason: tokenData.invalidated_reason || 'Another browser logged in with this account'
          };
        }

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

        // Restore session ID locally to match database for session validity checks
        if (tokenData.session_id) {
          await this.storeCurrentSession(tokenData.session_id);
          debug.log('💾 Restored session ID from Supabase:', tokenData.session_id);
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
        raw_dicecloud_data: characterData, // Store the FULL character object
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

  /**
   * Store current session ID locally
   */
  async storeCurrentSession(sessionId) {
    try {
      await browserAPI.storage.local.set({
        currentSessionId: sessionId,
        sessionStartTime: Date.now()
      });
      debug.log('💾 Stored current session ID:', sessionId);
    } catch (error) {
      debug.error('❌ Failed to store session ID:', error);
    }
  }

  /**
   * Invalidate all other sessions for the same DiceCloud account
   * Called when logging in to ensure only one browser is logged in at a time
   * Only invalidates sessions from OTHER browsers (different user_id)
   */
  async invalidateOtherSessions(diceCloudUserId, currentSessionId) {
    try {
      if (!diceCloudUserId) {
        debug.warn('⚠️ No DiceCloud user ID provided, skipping invalidation');
        return;
      }

      debug.log('🔒 Invalidating other sessions for DiceCloud user:', diceCloudUserId);

      // Get our browser fingerprint to exclude our own sessions
      const ourBrowserId = this.generateUserId();
      debug.log('🔍 Our browser ID:', ourBrowserId);

      // Find all sessions for this DiceCloud account
      const queryUrl = `${this.supabaseUrl}/rest/v1/${this.tableName}?user_id_dicecloud=eq.${encodeURIComponent(diceCloudUserId)}&select=user_id,session_id,username,browser_info,invalidated_at`;
      debug.log('🔍 Query URL:', queryUrl);

      const response = await fetch(queryUrl, {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        debug.warn('⚠️ Failed to fetch other sessions:', response.status, errorText);
        return;
      }

      const otherSessions = await response.json();
      debug.log('🔍 Found sessions for this account:', otherSessions.length, otherSessions);

      if (otherSessions.length === 0) {
        debug.log('ℹ️ No other sessions found for this DiceCloud account');
        return;
      }

      // Mark sessions from OTHER browsers as invalidated (exclude our browser)
      let invalidatedCount = 0;
      for (const session of otherSessions) {
        // Skip our own browser's sessions - we're replacing them, not invalidating
        if (session.user_id === ourBrowserId) {
          debug.log('⏭️ Skipping our own browser session:', session.session_id);
          continue;
        }

        // Skip already invalidated sessions
        if (session.invalidated_at) {
          debug.log('⏭️ Session already invalidated:', session.session_id);
          continue;
        }

        debug.log('🚫 Invalidating session from other browser:', session.session_id, 'browser:', session.user_id);

        // Update the session to mark it as invalidated
        const invalidateResponse = await fetch(
          `${this.supabaseUrl}/rest/v1/${this.tableName}?user_id=eq.${encodeURIComponent(session.user_id)}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': this.supabaseKey,
              'Authorization': `Bearer ${this.supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              invalidated_at: new Date().toISOString(),
              invalidated_by_session: currentSessionId,
              invalidated_reason: 'logged_in_elsewhere'
            })
          }
        );

        if (invalidateResponse.ok) {
          const result = await invalidateResponse.json();
          debug.log('✅ Session invalidated:', session.session_id, 'Result:', result);
          invalidatedCount++;
        } else {
          const errorText = await invalidateResponse.text();
          debug.warn('⚠️ Failed to invalidate session:', session.session_id, 'Status:', invalidateResponse.status, 'Error:', errorText);

          // If the column doesn't exist, log a helpful message
          if (errorText.includes('column') && errorText.includes('does not exist')) {
            debug.error('❌ Database migration needed! Run supabase/add_session_invalidation.sql');
          }
        }
      }

      debug.log(`🔒 Invalidation complete: ${invalidatedCount} session(s) invalidated`);
    } catch (error) {
      debug.error('❌ Error invalidating other sessions:', error);
    }
  }

  /**
   * Check for token conflicts with existing sessions
   */
  async checkForTokenConflicts(userId, newToken) {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/${this.tableName}?user_id=eq.${userId}&select=dicecloud_token,session_id,browser_info,username,last_seen`,
        {
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        debug.warn('⚠️ Failed to check for conflicts:', response.status);
        return { hasConflict: false };
      }

      const existingSessions = await response.json();
      debug.log('🔍 Checking for conflicts with existing sessions:', existingSessions.length);

      for (const session of existingSessions) {
        if (session.dicecloud_token !== newToken) {
          debug.log('⚠️ Found session with different token:', session.session_id);
          return {
            hasConflict: true,
            conflictingSession: {
              sessionId: session.session_id,
              username: session.username,
              lastSeen: session.last_seen,
              browserInfo: session.browser_info
            }
          };
        }
      }

      return { hasConflict: false };
    } catch (error) {
      debug.error('❌ Error checking for conflicts:', error);
      return { hasConflict: false };
    }
  }

  /**
   * Store conflict information for later display
   */
  async storeConflictInfo(conflictCheck) {
    try {
      await browserAPI.storage.local.set({
        sessionConflict: {
          detected: true,
          conflictingSession: conflictCheck.conflictingSession,
          detectedAt: Date.now()
        }
      });
      debug.log('💾 Stored conflict information');
    } catch (error) {
      debug.error('❌ Failed to store conflict info:', error);
    }
  }

  /**
   * Check if current session has been invalidated by another login
   */
  async checkSessionValidity() {
    try {
      const { currentSessionId, sessionConflict, sessionInvalidated } = await browserAPI.storage.local.get(['currentSessionId', 'sessionConflict', 'sessionInvalidated']);

      debug.log('🔍 checkSessionValidity - currentSessionId:', currentSessionId);
      debug.log('🔍 checkSessionValidity - sessionConflict:', sessionConflict);
      debug.log('🔍 checkSessionValidity - sessionInvalidated:', sessionInvalidated);

      if (!currentSessionId) {
        debug.log('✅ No session ID stored - session valid (new/fresh state)');
        return { valid: true, reason: 'no_session' };
      }

      // Check if we already have an invalidation notification (another browser logged in)
      if (sessionInvalidated) {
        debug.log('⚠️ Found sessionInvalidated flag in local storage');
        return {
          valid: false,
          reason: 'invalidated_by_other_login',
          invalidatedAt: sessionInvalidated.at,
          invalidatedReason: sessionInvalidated.reason
        };
      }

      // Check if we already have a conflict notification
      if (sessionConflict && sessionConflict.detected) {
        debug.log('⚠️ Found sessionConflict flag in local storage');
        return { valid: false, reason: 'conflict_detected', conflict: sessionConflict };
      }

      // Verify session still exists in Supabase and check for invalidation
      const userId = this.generateUserId();
      debug.log('🔍 Checking session in database for user:', userId);

      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/${this.tableName}?user_id=eq.${userId}&select=dicecloud_token,username,session_id,invalidated_at,invalidated_reason,invalidated_by_session`,
        {
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        debug.warn('⚠️ Database check failed with status:', response.status);
        return { valid: false, reason: 'check_failed' };
      }

      const sessions = await response.json();
      debug.log('🔍 Found sessions in database:', sessions.length, sessions);

      if (sessions.length === 0) {
        debug.warn('⚠️ No session found in database for this browser');
        return { valid: false, reason: 'session_not_found' };
      }

      const session = sessions[0];

      // Check if session was invalidated by another login
      if (session.invalidated_at) {
        debug.log('🚫 Session was invalidated by another login at:', session.invalidated_at);

        // Store invalidation info locally so we don't keep checking
        await browserAPI.storage.local.set({
          sessionInvalidated: {
            at: session.invalidated_at,
            reason: session.invalidated_reason || 'logged_in_elsewhere',
            bySession: session.invalidated_by_session
          }
        });

        return {
          valid: false,
          reason: 'invalidated_by_other_login',
          invalidatedAt: session.invalidated_at,
          invalidatedReason: session.invalidated_reason
        };
      }

      // Check if session ID matches (another browser might have taken over)
      if (session.session_id !== currentSessionId) {
        debug.log('⚠️ Session ID mismatch - local:', currentSessionId, 'remote:', session.session_id);
        return { valid: false, reason: 'session_replaced' };
      }

      // Check if local token matches remote token
      const { diceCloudToken } = await browserAPI.storage.local.get('diceCloudToken');
      if (diceCloudToken && session.dicecloud_token !== diceCloudToken) {
        debug.log('⚠️ Token mismatch - local token differs from database');
        return { valid: false, reason: 'token_mismatch' };
      }

      debug.log('✅ Session is valid');

      // Session is valid - update heartbeat
      await this.updateSessionHeartbeat(currentSessionId);

      return { valid: true };
    } catch (error) {
      debug.error('❌ Error checking session validity:', error);
      return { valid: true }; // Assume valid on error to avoid false logouts
    }
  }

  /**
   * Update session heartbeat to keep session alive
   */
  async updateSessionHeartbeat(sessionId) {
    try {
      const userId = this.generateUserId();
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/${this.tableName}?user_id=eq.${userId}&session_id=eq.${sessionId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            last_seen: new Date().toISOString()
          })
        }
      );

      if (!response.ok) {
        debug.error('❌ Failed to update session heartbeat:', response.status);
      }
    } catch (error) {
      debug.error('❌ Error updating session heartbeat:', error);
    }
  }

  /**
   * Clear conflict information
   */
  async clearConflictInfo() {
    try {
      await browserAPI.storage.local.remove(['sessionConflict']);
      debug.log('🗑️ Cleared conflict information');
    } catch (error) {
      debug.error('❌ Failed to clear conflict info:', error);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SupabaseTokenManager;
} else if (typeof window !== 'undefined') {
  window.SupabaseTokenManager = SupabaseTokenManager;
} else if (typeof self !== 'undefined') {
  // Service worker context
  self.SupabaseTokenManager = SupabaseTokenManager;
}
