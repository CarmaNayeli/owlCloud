import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

// Supabase config - set via environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Disconnect RollCloud from this channel')
    .addBooleanOption(option =>
      option
        .setName('delete_webhook')
        .setDescription('Also delete the RollCloud webhook (default: true)')
        .setRequired(false)
    ),

  async execute(interaction) {
    // Check permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageWebhooks)) {
      await interaction.reply({
        content: '❌ You need the **Manage Webhooks** permission to disconnect RollCloud.',
        flags: 64 // ephemeral
      });
      return;
    }

    const deleteWebhook = interaction.options.getBoolean('delete_webhook') ?? true;

    await interaction.deferReply({ flags: 64 }); // ephemeral

    try {
      const guildId = interaction.guild.id;
      const channelId = interaction.channel.id;

      // 1. Delete from pip2_instances
      const instanceResult = await deleteInstanceRecord(guildId, channelId);
      console.log('Instance deletion result:', instanceResult);

      // 2. Delete associated pairings for this channel
      const pairingResult = await deletePairingRecords(guildId, channelId);
      console.log('Pairing deletion result:', pairingResult);

      // 3. Optionally delete the webhook
      let webhookDeleted = false;
      if (deleteWebhook) {
        try {
          const webhooks = await interaction.channel.fetchWebhooks();
          const rollcloudWebhook = webhooks.find(wh => wh.name === '🎲 RollCloud');
          if (rollcloudWebhook) {
            await rollcloudWebhook.delete('RollCloud disconnect');
            webhookDeleted = true;
          }
        } catch (webhookError) {
          console.error('Failed to delete webhook:', webhookError);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x4ECDC4)
        .setTitle('✅ RollCloud Disconnected')
        .setDescription(
          `This channel is no longer connected to RollCloud.\n\n` +
          '**Cleaned up:**\n' +
          `• Instance record: ${instanceResult.deleted ? 'Removed' : 'Not found'}\n` +
          `• Pairing records: ${pairingResult.count > 0 ? `${pairingResult.count} removed` : 'None found'}\n` +
          `• Webhook: ${webhookDeleted ? 'Deleted' : (deleteWebhook ? 'Not found' : 'Kept')}\n\n` +
          'You can run `/rollcloud` again to reconnect.'
        )
        .setFooter({ text: 'Pip 2 • RollCloud Integration' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('RollCloud disconnect error:', error);

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('❌ Disconnect Failed')
          .setDescription(`Something went wrong: ${error.message}`)
        ]
      });
    }
  }
};

/**
 * Delete instance record from pip2_instances
 */
async function deleteInstanceRecord(guildId, channelId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured');
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/pip2_instances?guild_id=eq.${guildId}&channel_id=eq.${channelId}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Supabase pip2_instances DELETE error:', response.status, errorText);
    // Don't throw - we want to continue cleaning up other records
    return { deleted: false, error: errorText };
  }

  const data = await response.json();
  return { deleted: data.length > 0, count: data.length };
}

/**
 * Delete pairing records for this guild/channel
 */
async function deletePairingRecords(guildId, channelId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured');
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rollcloud_pairings?discord_guild_id=eq.${guildId}&discord_channel_id=eq.${channelId}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Supabase rollcloud_pairings DELETE error:', response.status, errorText);
    // Don't throw - we want to continue
    return { count: 0, error: errorText };
  }

  const data = await response.json();
  return { count: data.length };
}
