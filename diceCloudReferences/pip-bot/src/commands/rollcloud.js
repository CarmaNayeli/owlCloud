import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

// Import the storeCharacterOptions function
import { storeCharacterOptions } from './roll.js';

// Supabase config - set via environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('rollcloud')
    .setDescription('Connect RollCloud extension to this Discord server')
    .addStringOption(option =>
      option
        .setName('code')
        .setDescription('The 6-character pairing code from your RollCloud extension')
        .setRequired(true)
        .setMinLength(6)
        .setMaxLength(6)
    ),

  async execute(interaction) {
    console.log(`[DEBUG] /rollcloud command executed by ${interaction.user.tag}`);
    console.log(`[DEBUG] Options:`, interaction.options.data);
    
    // Check permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageWebhooks)) {
      console.log('[DEBUG] User lacks Manage Webhooks permission');
      await interaction.reply({
        content: '❌ You need the **Manage Webhooks** permission to set up RollCloud.',
        ephemeral: true
      });
      return;
    }

    const code = interaction.options.getString('code').toUpperCase();
    console.log(`[DEBUG] Processing pairing code: ${code}`);

    await interaction.deferReply();

    try {
      // 1. Look up pairing code in Supabase
      console.log('[DEBUG] Step 1: Looking up pairing code...');
      const pairing = await lookupPairingCode(code);
      console.log(`[DEBUG] Pairing result:`, pairing ? 'FOUND' : 'NOT FOUND');

      if (!pairing) {
        console.log('[DEBUG] Pairing not found, sending error message');
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

      if (pairing.status === 'connected') {
        console.log('[DEBUG] Pairing already connected');
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xF39C12)
            .setTitle('⚠️ Already Connected')
            .setDescription(
              `This code has already been used.\n\n` +
              'If you need to reconnect, click "Setup Discord" in the extension to generate a new code.'
            )
          ]
        });
        return;
      }

      // 2. Create webhook in this channel
      console.log('[DEBUG] Step 2: Creating webhook...');
      const webhook = await interaction.channel.createWebhook({
        name: '🎲 RollCloud',
        reason: `RollCloud pairing by ${interaction.user.tag}`
      });
      console.log(`[DEBUG] Webhook created: ${webhook.url}`);

      // 3. Update Supabase with webhook URL and Discord info
      console.log('[DEBUG] Step 3: Updating Supabase with webhook info...');
      await completePairing(code, {
        webhookUrl: webhook.url,
        guildId: interaction.guild.id,
        guildName: interaction.guild.name,
        channelId: interaction.channel.id,
        channelName: interaction.channel.name,
        userId: interaction.user.id
      });
      console.log('[DEBUG] Supabase updated successfully');

      // 3.5. Store character options for autocomplete
      // Get character data to store options
      const characterResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/dicecloud_characters?user_id=eq.${pairing.dicecloud_user_id}&select=*&order=updated_at.desc&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          }
        }
      );

      if (characterResponse.ok) {
        const characters = await characterResponse.json();
        if (characters.length > 0) {
          const characterData = characters[0];
          await storeCharacterOptions(pairing.id, characterData);
        }
      }

      // 4. Send success message
      const embed = new EmbedBuilder()
        .setColor(0x4ECDC4)
        .setTitle('✅ RollCloud Connected!')
        .setDescription(
          `Turn notifications will now appear in this channel.\n\n` +
          '**What happens next:**\n' +
          '• Your RollCloud extension will auto-connect in a few seconds\n' +
          '• When combat starts in Roll20, turns will appear here\n' +
          '• Players can check their phones to see whose turn it is!'
        )
        .addFields(
          { name: 'DiceCloud User', value: pairing.dicecloud_username || 'Unknown', inline: true },
          { name: 'Channel', value: `#${interaction.channel.name}`, inline: true }
        )
        .setFooter({ text: 'Pip Bot • RollCloud Integration' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // 5. Send a test message via the webhook
      await webhook.send({
        embeds: [{
          title: '🎲 RollCloud Ready!',
          description:
            'This channel is now connected to RollCloud.\n\n' +
            '**You\'ll see:**\n' +
            '• Turn announcements\n' +
            '• Action economy status (✅ ❌)\n' +
            '• Round changes\n\n' +
            '*Check this on your phone during combat!*',
          color: 0x4ECDC4,
          timestamp: new Date().toISOString()
        }]
      });

    } catch (error) {
      console.error('RollCloud setup error:', error);

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('❌ Setup Failed')
          .setDescription(
            `Something went wrong: ${error.message}\n\n` +
            'Make sure Pip Bot has **Manage Webhooks** permission in this channel.'
          )
        ]
      });
    }
  }
};

/**
 * Look up a pairing code in Supabase
 */
async function lookupPairingCode(code) {
  console.log(`[DEBUG] Looking up pairing code: ${code}`);
  console.log(`[DEBUG] SUPABASE_URL: ${SUPABASE_URL ? 'SET' : 'NOT SET'}`);
  console.log(`[DEBUG] SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY ? 'SET' : 'NOT SET'}`);
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[ERROR] Supabase not configured');
    throw new Error('Supabase not configured');
  }

  const url = `${SUPABASE_URL}/rest/v1/rollcloud_pairings?pairing_code=eq.${code}&select=*`;
  console.log(`[DEBUG] Fetching from: ${url}`);

  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });

  console.log(`[DEBUG] Response status: ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ERROR] Failed to lookup pairing code: ${response.status} - ${errorText}`);
    throw new Error(`Failed to lookup pairing code: ${response.status}`);
  }

  const data = await response.json();
  console.log(`[DEBUG] Found ${data.length} pairings`);
  return data.length > 0 ? data[0] : null;
}

/**
 * Complete a pairing by storing the webhook URL in Supabase
 */
async function completePairing(code, discordInfo) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured');
  }

  const response = await fetch(
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to complete pairing: ${error}`);
  }

  return await response.json();
}
