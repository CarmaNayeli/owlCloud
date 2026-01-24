import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_PATH = join(__dirname, '../../data/rollcloud-webhooks.json');

/**
 * Load webhook data from storage
 */
async function loadWebhooks() {
  try {
    const data = await fs.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/**
 * Save webhook data to storage
 */
async function saveWebhooks(webhooks) {
  const dataDir = dirname(DATA_PATH);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(webhooks, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('rollcloud')
    .setDescription('RollCloud integration commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks)
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Create a webhook for RollCloud turn notifications')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel for turn notifications (defaults to current)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove the RollCloud webhook from this server')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Show RollCloud webhook info for this server')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setup') {
      await handleSetup(interaction);
    } else if (subcommand === 'remove') {
      await handleRemove(interaction);
    } else if (subcommand === 'info') {
      await handleInfo(interaction);
    }
  }
};

/**
 * Create a webhook for RollCloud integration
 */
async function handleSetup(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Get target channel
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    // Check if we already have a webhook for this server
    const webhooks = await loadWebhooks();
    if (webhooks[interaction.guildId]) {
      // Check if the webhook still exists
      try {
        const existingWebhook = await interaction.client.fetchWebhook(webhooks[interaction.guildId].webhookId);
        if (existingWebhook) {
          const embed = new EmbedBuilder()
            .setColor(0xF39C12)
            .setTitle('⚠️ RollCloud Already Configured')
            .setDescription(
              `A webhook already exists in <#${webhooks[interaction.guildId].channelId}>.\n\n` +
              'Use `/rollcloud remove` first if you want to create a new one.'
            )
            .addFields({
              name: '📋 Webhook URL',
              value: `\`\`\`${webhooks[interaction.guildId].webhookUrl}\`\`\`\n*Copy this URL to your RollCloud extension settings*`,
              inline: false
            });

          await interaction.editReply({ embeds: [embed] });
          return;
        }
      } catch {
        // Webhook doesn't exist anymore, continue with creation
      }
    }

    // Create the webhook
    const webhook = await targetChannel.createWebhook({
      name: '🎲 RollCloud',
      avatar: 'https://raw.githubusercontent.com/CarmaNayeli/rollCloud/main/icons/icon128.png',
      reason: 'RollCloud integration for turn notifications'
    });

    // Store webhook info
    webhooks[interaction.guildId] = {
      webhookId: webhook.id,
      webhookUrl: webhook.url,
      channelId: targetChannel.id,
      createdBy: interaction.user.id,
      createdAt: new Date().toISOString()
    };
    await saveWebhooks(webhooks);

    // Send success message
    const embed = new EmbedBuilder()
      .setColor(0x4ECDC4)
      .setTitle('✅ RollCloud Webhook Created!')
      .setDescription(
        `Turn notifications will appear in <#${targetChannel.id}>.\n\n` +
        '**Next Steps:**\n' +
        '1. Copy the webhook URL below\n' +
        '2. Open the RollCloud extension in your browser\n' +
        '3. Expand "🎮 Discord Integration"\n' +
        '4. Paste the URL and enable notifications\n' +
        '5. Click Save!'
      )
      .addFields({
        name: '📋 Webhook URL (click to copy)',
        value: `\`\`\`${webhook.url}\`\`\``,
        inline: false
      })
      .addFields({
        name: '🔒 Security Note',
        value: 'Keep this URL private! Anyone with the URL can post to your channel.',
        inline: false
      })
      .setFooter({ text: 'Pip Bot • RollCloud Integration' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Send a test message to the channel
    await webhook.send({
      embeds: [{
        title: '🎲 RollCloud Connected!',
        description:
          'This channel will now receive turn notifications from RollCloud.\n\n' +
          '**What you\'ll see:**\n' +
          '• Turn announcements (whose turn it is)\n' +
          '• Action economy status (✅ available / ❌ used)\n' +
          '• Round changes\n\n' +
          '*Players can check this on their phones to track combat!*',
        color: 0x4ECDC4,
        footer: { text: 'RollCloud • Dice Cloud → Roll20 Bridge' },
        timestamp: new Date().toISOString()
      }]
    });

  } catch (error) {
    console.error('Error creating RollCloud webhook:', error);

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('❌ Setup Failed')
      .setDescription(
        'Could not create webhook. Make sure I have the **Manage Webhooks** permission in this channel.'
      );

    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Remove the RollCloud webhook
 */
async function handleRemove(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const webhooks = await loadWebhooks();

    if (!webhooks[interaction.guildId]) {
      const embed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle('⚠️ No Webhook Found')
        .setDescription('RollCloud is not configured for this server.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Delete the webhook
    try {
      const webhook = await interaction.client.fetchWebhook(webhooks[interaction.guildId].webhookId);
      await webhook.delete('RollCloud integration removed');
    } catch {
      // Webhook might already be deleted
    }

    // Remove from storage
    delete webhooks[interaction.guildId];
    await saveWebhooks(webhooks);

    const embed = new EmbedBuilder()
      .setColor(0x4ECDC4)
      .setTitle('✅ RollCloud Webhook Removed')
      .setDescription(
        'The webhook has been deleted. Turn notifications will no longer appear.\n\n' +
        'Use `/rollcloud setup` to create a new webhook.'
      );

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error removing RollCloud webhook:', error);

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('❌ Removal Failed')
      .setDescription('Could not remove webhook. It may have already been deleted.');

    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Show RollCloud webhook info
 */
async function handleInfo(interaction) {
  const webhooks = await loadWebhooks();

  if (!webhooks[interaction.guildId]) {
    const embed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setTitle('⚠️ RollCloud Not Configured')
      .setDescription(
        'RollCloud is not set up for this server.\n\n' +
        'Use `/rollcloud setup` to create a webhook for turn notifications.'
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const config = webhooks[interaction.guildId];

  const embed = new EmbedBuilder()
    .setColor(0x4ECDC4)
    .setTitle('🎲 RollCloud Configuration')
    .setDescription(`Turn notifications are active in <#${config.channelId}>.`)
    .addFields(
      {
        name: '📋 Webhook URL',
        value: `\`\`\`${config.webhookUrl}\`\`\`\n*Copy this to your RollCloud extension*`,
        inline: false
      },
      {
        name: '📅 Created',
        value: `<t:${Math.floor(new Date(config.createdAt).getTime() / 1000)}:R>`,
        inline: true
      },
      {
        name: '👤 Created By',
        value: `<@${config.createdBy}>`,
        inline: true
      }
    )
    .setFooter({ text: 'Pip Bot • RollCloud Integration' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
