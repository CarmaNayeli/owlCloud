/**
 * Optimized Character Cache and Fetching System
 * Prevents duplicate database calls and improves performance
 */

// Simple in-memory cache with TTL
const characterCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes (reduced for fresher data after syncs)

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

/**
 * Get cached character data or fetch from database
 * @param {string} discordUserId - Discord user ID
 * @returns {Promise<Object|null>} Character data or null
 */
async function getActiveCharacter(discordUserId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('Supabase not configured');
    return null;
  }

  // Check cache first
  const cacheKey = `active_${discordUserId}`;
  const cached = characterCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[CACHE HIT] Active character for ${discordUserId}`);
    return cached.data;
  }

  console.log(`[CACHE MISS] Fetching active character for ${discordUserId}`);

  try {
    // Optimized query - only fetch essential fields
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&is_active=eq.true&select=character_name,class,level,race,alignment,hit_points,armor_class,speed,attributes,attribute_mods&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch active character:', response.status);
      return null;
    }

    const data = await response.json();
    const character = data.length > 0 ? data[0] : null;

    // Cache the result
    if (character) {
      characterCache.set(cacheKey, {
        data: character,
        timestamp: Date.now()
      });
    }

    return character;
  } catch (error) {
    console.error('Error fetching active character:', error);
    return null;
  }
}

/**
 * Set active character with caching
 * @param {string} discordUserId - Discord user ID
 * @param {string} characterName - Character name to set as active
 * @returns {Promise<{success: boolean, character?: Object, error?: string}>}
 */
async function setActiveCharacter(discordUserId, characterName) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // First, get all characters for this user
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&select=id,character_name,class,level,race,alignment,hit_points,armor_class,speed,attributes,attribute_mods`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (!response.ok) {
      return { success: false, error: `Failed to fetch characters: ${response.status}` };
    }

    const characters = await response.json();

    // Find the character by name (case-insensitive)
    const character = characters.find(char =>
      char.character_name.toLowerCase() === characterName.toLowerCase()
    );

    if (!character) {
      return { success: false, error: 'Character not found' };
    }

    // Update all characters to set only this one as active
    const updatePromises = characters.map(char => {
      const isActive = char.character_name.toLowerCase() === characterName.toLowerCase();

      return fetch(
        `${SUPABASE_URL}/rest/v1/rollcloud_characters?id=eq.${char.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          },
          body: JSON.stringify({ is_active: isActive })
        }
      );
    });

    await Promise.all(updatePromises);

    // Clear cache for this user
    const cacheKey = `active_${discordUserId}`;
    characterCache.delete(cacheKey);

    // Cache the new active character
    characterCache.set(cacheKey, {
      data: { ...character, is_active: true },
      timestamp: Date.now()
    });

    return { success: true, character };
  } catch (error) {
    console.error('Error setting active character:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clear cache for a specific user
 * @param {string} discordUserId - Discord user ID
 */
function clearUserCache(discordUserId) {
  const cacheKey = `active_${discordUserId}`;
  characterCache.delete(cacheKey);
}

/**
 * Clear expired cache entries
 */
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of characterCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      characterCache.delete(key);
    }
  }
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  const now = Date.now();
  const stats = {
    total: characterCache.size,
    expired: 0,
    valid: 0
  };

  for (const value of characterCache.values()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      stats.expired++;
    } else {
      stats.valid++;
    }
  }

  return stats;
}

// Auto-cleanup every 2 minutes
setInterval(cleanupCache, 2 * 60 * 1000);

export {
  getActiveCharacter,
  setActiveCharacter,
  clearUserCache,
  cleanupCache,
  getCacheStats
};
