import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

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
    // Check permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageWebhooks)) {
      await interaction.reply({
        content: '❌ You need the **Manage Webhooks** permission to set up RollCloud.',
        flags: 64 // ephemeral
      });
      return;
    }

    const code = interaction.options.getString('code').toUpperCase();

    // Defer immediately to avoid timeout
    await interaction.deferReply();

    try {
      console.log(`Looking up pairing code: ${code}`);
      
      // 1. Look up pairing code in Supabase
      const pairing = await lookupPairingCode(code);
      
      console.log(`Pairing result:`, pairing);

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

      if (pairing.status === 'connected') {
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
      const webhook = await interaction.channel.createWebhook({
        name: '🎲 RollCloud',
        reason: `RollCloud pairing by ${interaction.user.tag}`
      });

      // 3. Update Supabase with webhook URL and Discord info
      await completePairing(code, {
        webhookUrl: webhook.url,
        guildId: interaction.guild.id,
        guildName: interaction.guild.name,
        channelId: interaction.channel.id,
        channelName: interaction.channel.name,
        userId: interaction.user.id
      });

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
        .setFooter({ text: 'Pip 2 • RollCloud Integration' })
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
  console.log('Supabase config check:', {
    hasUrl: !!SUPABASE_URL,
    hasKey: !!SUPABASE_SERVICE_KEY,
    url: SUPABASE_URL ? SUPABASE_URL.substring(0, 20) + '...' : 'missing'
  });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured');
  }

  const startTime = Date.now();
  const url = `${SUPABASE_URL}/rest/v1/rollcloud_pairings?pairing_code=eq.${code}&select=*`;
  
  console.log(`Fetching from: ${url}`);

  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });

  const endTime = Date.now();
  console.log(`Supabase query took ${endTime - startTime}ms`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Supabase error:', response.status, errorText);
    throw new Error(`Failed to lookup pairing code: ${response.status}`);
  }

  const data = await response.json();
  console.log(`Supabase response data:`, data);
  
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
