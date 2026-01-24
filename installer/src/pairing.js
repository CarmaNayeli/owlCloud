/**
 * Pairing Module
 * Handles pairing code generation and Supabase communication
 */

/**
 * Generate a random 6-character pairing code
 * Excludes confusing characters: I, O, 0, 1
 */
function generatePairingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a pairing entry in Supabase
 */
async function createPairing(code, config) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rollcloud_pairings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': config.supabaseAnonKey,
      'Authorization': `Bearer ${config.supabaseAnonKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      pairing_code: code,
      source: 'installer',
      status: 'pending'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create pairing: ${error}`);
  }

  return await response.json();
}

/**
 * Check if pairing has been completed
 */
async function checkPairing(code, config) {
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/rollcloud_pairings?pairing_code=eq.${code}&select=*`,
    {
      headers: {
        'apikey': config.supabaseAnonKey,
        'Authorization': `Bearer ${config.supabaseAnonKey}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to check pairing status');
  }

  const data = await response.json();

  if (data.length === 0) {
    return { success: false, error: 'Pairing code not found' };
  }

  const pairing = data[0];

  if (pairing.status === 'connected' && pairing.webhook_url) {
    return {
      success: true,
      connected: true,
      webhookUrl: pairing.webhook_url,
      serverName: pairing.discord_guild_name,
      channelName: pairing.discord_channel_name
    };
  }

  return { success: true, connected: false };
}

module.exports = {
  generatePairingCode,
  createPairing,
  checkPairing
};
