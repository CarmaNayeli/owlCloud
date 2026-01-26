import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

// Supabase config - set via environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('rollcloud')
    .setDescription('Connect your RollCloud extension to Discord')
    .addStringOption(option =>
      option
        .setName('code')
        .setDescription('The 6-character pairing code from your RollCloud extension')
        .setRequired(true)
        .setMinLength(6)
        .setMaxLength(6)
    ),

  async execute(interaction) {
    const code = interaction.options.getString('code').toUpperCase();

    await interaction.deferReply({ flags: 64 }); // 64 = ephemeral (fixed deprecation warning)

    try {
      console.log(`User ${interaction.user.tag} pairing with code: ${code}`);

      // 1. Look up pairing code in Supabase
      const pairing = await lookupPairingCode(code);

      if (!pairing) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Invalid Code')
            .setDescription(
              `The code **${code}** was not found or has expired.\n\n` +
              '**To get a new code:**\n' +
              '1. Open RollCloud extension\n' +
              '2. Expand "Discord Integration"\n' +
              '3. Click "Setup Discord"\n' +
              '4. Copy the new code shown'
            )
          ]
        });
        return;
      }

      if (pairing.status === 'connected' && pairing.discord_user_id !== interaction.user.id) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xF39C12)
            .setTitle('⚠️ Already Used')
            .setDescription(
              `This code has already been used by another user.\n\n` +
              'Generate a new code in the RollCloud extension.'
            )
          ]
        });
        return;
      }

      // 2. Check if we need to create a webhook (first user in channel)
      let webhookUrl = null;
      try {
        // Check for existing RollCloud webhook in channel
        if (interaction.channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageWebhooks)) {
          const webhooks = await interaction.channel.fetchWebhooks();
          let rollcloudWebhook = webhooks.find(wh => wh.name === '🎲 RollCloud');

          if (!rollcloudWebhook) {
            // Create new webhook
            rollcloudWebhook = await interaction.channel.createWebhook({
              name: '🎲 RollCloud',
              reason: `RollCloud pairing by ${interaction.user.tag}`
            });
          }
          webhookUrl = rollcloudWebhook.url;
        }
      } catch (webhookError) {
        console.log('Could not create/get webhook (no permission):', webhookError.message);
        // Continue without webhook - character features will still work
      }

      // 3. Update Supabase with Discord info
      await completePairing(code, {
        webhookUrl: webhookUrl,
        guildId: interaction.guild.id,
        guildName: interaction.guild.name,
        channelId: interaction.channel.id,
        channelName: interaction.channel.name,
        userId: interaction.user.id,
        username: interaction.user.username,
        globalName: interaction.user.globalName || interaction.user.username,
        client: interaction.client
      });

      // 4. Send success message
      const embed = new EmbedBuilder()
        .setColor(0x4ECDC4)
        .setTitle('✅ RollCloud Connected!')
        .setDescription(
          `Your account is now linked to RollCloud!\n\n` +
          '**Next steps:**\n' +
          '• Open a DiceCloud character sheet\n' +
          '• Click "Sync Character" in the extension\n' +
          '• Use `/character` to set your active character\n\n' +
          '**Available commands:**\n' +
          '`/characters` - List your synced characters\n' +
          '`/character` - Set active character\n' +
          '`/sheet` - View character sheet\n' +
          '`/stats` - Quick stat lookup\n' +
          '`/roll` - Roll with modifiers'
        )
        .addFields(
          { name: 'DiceCloud User', value: pairing.dicecloud_username || 'Unknown', inline: true },
          { name: 'Discord User', value: interaction.user.tag, inline: true }
        )
        .setFooter({ text: 'Pip 2 • RollCloud Integration' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // 5. Optionally send a public notification
      if (webhookUrl) {
        try {
          const webhook = await interaction.client.fetchWebhook(webhookUrl.split('/').slice(-2)[0]);
          await webhook.send({
            embeds: [{
              description: `🎭 **${interaction.user.tag}** connected their RollCloud account!`,
              color: 0x4ECDC4
            }]
          });
        } catch (e) {
          // Ignore webhook errors
        }
      }

    } catch (error) {
      console.error('RollCloud setup error:', error);

      // Handle Discord interaction timeouts/expired errors
      if (error.code === 10062 || error.message.includes('Unknown interaction') || error.message.includes('already acknowledged')) {
        console.log('⚠️ Discord interaction expired, cannot reply to user');
        return; // Don't try to editReply if interaction is expired
      }

      try {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Setup Failed')
            .setDescription(`Something went wrong: ${error.message}`)
          ]
        });
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
        // Interaction is probably expired, nothing we can do
      }
    }
  }
};

/**
 * Look up a pairing code in Supabase
 */
async function lookupPairingCode(code) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_pairings?pairing_code=eq.${code}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Database error: ${response.status}`);
    }

    const data = await response.json();
    return data.length > 0 ? data[0] : null;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Database query timed out');
    }
    throw error;
  }
}

/**
 * Complete a pairing by storing Discord info in Supabase
 */
async function completePairing(code, discordInfo) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured');
  }

  // First, update the pairing table
  const pairingResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/rollcloud_pairings?pairing_code=eq.${code}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        webhook_url: discordInfo.webhookUrl,
        discord_guild_id: discordInfo.guildId,
        discord_guild_name: discordInfo.guildName,
        discord_channel_id: discordInfo.channelId,
        discord_channel_name: discordInfo.channelName,
        discord_user_id: discordInfo.userId,
        status: 'connected',
        connected_at: new Date().toISOString()
      })
    }
  );

  if (!pairingResponse.ok) {
    const errorText = await pairingResponse.text();
    throw new Error(`Failed to complete pairing: ${errorText}`);
  }

  const pairingData = await pairingResponse.json();
  
  // Send Discord linking info to extension via webhook instead of direct database update
  if (pairingData.length > 0 && pairingData[0].dicecloud_user_id) {
    try {
      await sendDiscordLinkToExtension(pairingData[0].dicecloud_user_id, discordInfo);
      console.log(`Sent Discord linking info to extension for: ${pairingData[0].dicecloud_user_id}`);
    } catch (webhookError) {
      console.error('Failed to send Discord linking to extension:', webhookError);
      // Don't fail the pairing if webhook fails
    }
  }

  return pairingData;
}

/**
 * Send Discord linking information to extension via webhook
 */
async function sendDiscordLinkToExtension(dicecloudUserId, discordInfo) {
  // Find the pairing to get the webhook URL
  const pairingResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/rollcloud_pairings?dicecloud_user_id=eq.${dicecloudUserId}&select=webhook_url&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!pairingResponse.ok) {
    throw new Error(`Failed to find pairing webhook: ${pairingResponse.status}`);
  }

  const pairingData = await pairingResponse.json();
  if (pairingData.length === 0 || !pairingData[0].webhook_url) {
    throw new Error('No webhook URL found for pairing');
  }

  const webhookUrl = pairingData[0].webhook_url;

  // Send Discord linking message to extension
  const linkMessage = {
    action: 'discordLink',
    dicecloudUserId: dicecloudUserId,
    discordInfo: {
      userId: discordInfo.userId,
      username: discordInfo.username,
      globalName: discordInfo.globalName
    },
    timestamp: new Date().toISOString()
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(linkMessage)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send Discord link to extension: ${errorText}`);
  }

  console.log(`✅ Discord linking info sent to extension via webhook`);
  return response;
}
