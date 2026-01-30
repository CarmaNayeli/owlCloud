import { Events, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';

// Supabase config for RollCloud commands
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Cache for guild command configs (5 minute TTL)
const guildConfigCache = new Map();
const GUILD_CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a command is enabled for a specific guild
 * @param {string} commandName - The slash command name
 * @param {string} guildId - The Discord guild ID
 * @returns {Promise<boolean>} - Whether the command is enabled
 */
async function isCommandEnabledForGuild(commandName, guildId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    // If Supabase isn't configured, allow all commands
    return true;
  }

  try {
    // Check cache first
    const cacheKey = guildId;
    const cached = guildConfigCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < GUILD_CONFIG_CACHE_TTL) {
      // Use cached config
      return !cached.disabledCommands.includes(commandName);
    }

    // Fetch from Supabase
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/guild_command_config?guild_id=eq.${guildId}&select=disabled_commands`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch guild config:', response.status);
      // On error, allow the command (fail open)
      return true;
    }

    const data = await response.json();

    // If no config exists for this guild, all commands are enabled
    if (!data || data.length === 0) {
      // Cache the empty result
      guildConfigCache.set(cacheKey, {
        disabledCommands: [],
        timestamp: now
      });
      return true;
    }

    const disabledCommands = data[0].disabled_commands || [];

    // Cache the result
    guildConfigCache.set(cacheKey, {
      disabledCommands,
      timestamp: now
    });

    return !disabledCommands.includes(commandName);
  } catch (error) {
    console.error('Error checking command enablement:', error);
    // On error, allow the command (fail open)
    return true;
  }
}

export default {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
    }

    // Handle autocomplete
    if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);
    }

    // Handle button interactions
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }
  }
};

async function handleAutocomplete(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command || !command.autocomplete) {
    return;
  }

  try {
    await command.autocomplete(interaction);
  } catch (error) {
    console.error(`Autocomplete error for ${interaction.commandName}:`, error);
  }
}

async function handleCommand(interaction) {
  console.log(`📥 Received command: /${interaction.commandName} from ${interaction.user.username} (${interaction.user.id})`);

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  // Check if command is enabled for this guild
  if (interaction.guildId) {
    const isEnabled = await isCommandEnabledForGuild(interaction.commandName, interaction.guildId);
    if (!isEnabled) {
      console.log(`⛔ Command /${interaction.commandName} is disabled for guild ${interaction.guildId}`);
      try {
        await interaction.reply({
          content: `The \`/${interaction.commandName}\` command is disabled on this server. A server admin can enable it in the [Pip Dashboard](https://rollcloud.app/configure-pip).`,
          flags: 64 // ephemeral
        });
      } catch (replyError) {
        console.error('Failed to reply about disabled command:', replyError.message);
      }
      return;
    }
  }

  console.log(`📦 Found command handler for: ${interaction.commandName}`);

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error);

    const errorMessage = { content: 'There was an error executing this command!', flags: 64 }; // 64 = ephemeral

    try {
      // Check if interaction is already replied or deferred
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    } catch (replyError) {
      // If interaction has expired or already acknowledged, we can't reply - just log it
      if (replyError.message.includes('already been acknowledged') || 
          replyError.message.includes('Unknown interaction') ||
          replyError.message.includes('Interaction has already been acknowledged')) {
        console.error('Interaction already acknowledged or expired - cannot reply:', replyError.message);
      } else if (replyError.message.includes('Maximum call stack size exceeded')) {
        console.error('Stack overflow detected in command execution - likely character data too complex');
      } else {
        console.error('Failed to reply to interaction:', replyError.message);
      }
    }
  }
}

async function handleButtonInteraction(interaction) {
  const [action, ...params] = interaction.customId.split(':');

  if (action === 'create_ticket') {
    await handleCreateTicket(interaction, params);
  } else if (interaction.customId === 'close_ticket') {
    await handleCloseTicket(interaction);
  } else if (action === 'rollcloud') {
    await handleRollCloudButton(interaction, params);
  }
}

async function handleCloseTicket(interaction) {
  const channel = interaction.channel;

  // Check if this is a ticket channel
  if (!channel.name.startsWith('ticket-')) {
    return await interaction.reply({
      content: '❌ This can only be used in ticket channels!',
      flags: 64 // ephemeral
    });
  }

  // Create close confirmation
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('🔒 Ticket Closed')
    .setDescription(
      `Ticket closed by ${interaction.user}\n\n` +
      'This channel will be deleted in 10 seconds.'
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  // Delete channel after 10 seconds
  setTimeout(async () => {
    try {
      await channel.delete();
      console.log(`✅ Deleted ticket: ${channel.name}`);
    } catch (error) {
      console.error('Failed to delete ticket channel:', error);
    }
  }, 10000);
}

async function handleCreateTicket(interaction, params) {
  const [supportRoleId, categoryId] = params;

  // Check if user already has an open ticket
  const existingTicket = interaction.guild.channels.cache.find(
    ch => ch.name === `ticket-${interaction.user.username.toLowerCase()}`
  );

  if (existingTicket) {
    return await interaction.reply({
      content: `❌ You already have an open ticket: ${existingTicket}`,
      flags: 64 // ephemeral
    });
  }

  await interaction.deferReply({ flags: 64 }); // ephemeral

  try {
    const supportRole = await interaction.guild.roles.fetch(supportRoleId);

    // Create ticket channel
    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: categoryId !== 'none' ? categoryId : null,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles
          ]
        },
        {
          id: supportRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ]
    });

    // Send welcome message in ticket
    const embed = new EmbedBuilder()
      .setColor(0x1E88E5)
      .setTitle('🎫 Support Ticket Created')
      .setDescription(
        `Welcome ${interaction.user}!\n\n` +
        'Please describe your issue and our support team will assist you shortly.\n\n' +
        `Support team: ${supportRole}`
      )
      .addFields(
        {
          name: '📋 Tips',
          value:
            '• Be as detailed as possible\n' +
            '• Include screenshots if helpful\n' +
            '• Use `/ticket close` when your issue is resolved',
          inline: false
        }
      )
      .setFooter({ text: 'Dice Cat Support' })
      .setTimestamp();

    const closeButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Close Ticket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

    await ticketChannel.send({
      content: `${interaction.user} ${supportRole}`,
      embeds: [embed],
      components: [closeButton]
    });

    await interaction.editReply({
      content: `✅ Ticket created: ${ticketChannel}`
    });

    console.log(`✅ Created ticket for ${interaction.user.tag}`);
  } catch (error) {
    console.error('Failed to create ticket:', error);
    await interaction.editReply({
      content: '❌ Failed to create ticket. Please contact an administrator.'
    });
  }
}

// ============================================================================
// RollCloud Button Handlers
// ============================================================================

/**
 * Handle RollCloud button interactions
 * Button customId format: rollcloud:<command_type>:<action_name>:<extra_data>
 *
 * Examples:
 * - rollcloud:roll:Attack:1d20+5
 * - rollcloud:use_action:Longsword
 * - rollcloud:use_bonus:Healing Word
 * - rollcloud:end_turn
 * - rollcloud:use_ability:Fireball:spell
 */
async function handleRollCloudButton(interaction, params) {
  const [commandType, actionName, ...extraData] = params;

  // Acknowledge immediately
  await interaction.deferReply({ flags: 64 }); // ephemeral

  try {
    // Find the pairing for this channel
    const pairing = await findPairingForChannel(interaction.channelId);

    if (!pairing) {
      await interaction.editReply({
        content: '❌ RollCloud is not connected to this channel. Use `/rollcloud <code>` to connect.'
      });
      return;
    }

    // Get character data for roll commands to include name and color
    let commandData = parseExtraData(commandType, extraData);

    if (commandType === 'roll') {
      // For roll commands from buttons, fetch character data to include name and color
      const character = await getActiveCharacter(interaction.user.id);
      if (character) {
        commandData.character_name = character.character_name;
        commandData.character_id = character.id;
        commandData.notification_color = character.notification_color || '#3498db';
      }
    }

    // Create command in Supabase
    const command = await createRollCloudCommand({
      pairingId: pairing.id,
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.username,
      discordMessageId: interaction.message.id,
      commandType: commandType,
      actionName: actionName,
      commandData: commandData
    });

    if (!command.success) {
      await interaction.editReply({
        content: `❌ Failed to send command: ${command.error}`
      });
      return;
    }

    // Respond based on command type
    const responseMessages = {
      roll: `🎲 Rolling **${actionName}**...`,
      use_action: `⚔️ Using action: **${actionName}**`,
      use_bonus: `✨ Using bonus action: **${actionName}**`,
      end_turn: `⏭️ Ending turn...`,
      use_ability: `🔮 Using **${actionName}**...`
    };

    await interaction.editReply({
      content: responseMessages[commandType] || `📤 Sent: ${commandType}`
    });

    console.log(`✅ RollCloud command sent: ${commandType} ${actionName} by ${interaction.user.tag}`);

  } catch (error) {
    console.error('RollCloud button error:', error);
    await interaction.editReply({
      content: '❌ Something went wrong. Please try again.'
    });
  }
}

/**
 * Find a RollCloud pairing for a channel
 */
async function findPairingForChannel(channelId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Supabase not configured');
    return null;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_pairings?discord_channel_id=eq.${channelId}&status=eq.connected&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to find pairing:', response.status);
      return null;
    }

    const data = await response.json();
    return data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error finding pairing:', error);
    return null;
  }
}

/**
 * Create a command via broadcast-command edge function with retry logic
 */
async function createRollCloudCommand(options) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const commandPayload = {
      pairing_id: options.pairingId,
      discord_user_id: options.discordUserId,
      discord_username: options.discordUsername,
      discord_message_id: options.discordMessageId,
      command_type: options.commandType,
      action_name: options.actionName,
      command_data: options.commandData || {},
      status: 'pending'
    };

    // Use broadcast-command edge function with retry logic
    const response = await fetch(`${SUPABASE_URL}/functions/v1/broadcast-command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({ command: commandPayload })
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, command: data.command };
    } else {
      const error = await response.text();
      console.error('Failed to create command via broadcast-command:', error);
      return { success: false, error: 'Failed to create command' };
    }
  } catch (error) {
    console.error('Error creating command:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Parse extra data from button customId based on command type
 */
function parseExtraData(commandType, extraData) {
  const data = {};

  switch (commandType) {
    case 'roll':
      // extraData[0] is the roll string, e.g., "1d20+5"
      if (extraData[0]) {
        data.roll_string = extraData.join(':'); // Rejoin in case roll had colons
      }
      break;

    case 'use_ability':
      // extraData[0] might be ability type (spell, feature, etc.)
      if (extraData[0]) {
        data.ability_type = extraData[0];
      }
      if (extraData[1]) {
        data.spell_level = extraData[1];
      }
      break;

    default:
      // Store any extra data as-is
      if (extraData.length > 0) {
        data.extra = extraData;
      }
  }

  return data;
}

/**
 * Get active character for a Discord user
 */
async function getActiveCharacter(discordUserId) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&is_active=eq.true&select=*&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    const data = await response.json();

    if (data.length > 0) {
      return data[0];
    }

    // Fallback: get most recently updated character
    const fallbackResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&select=*&order=updated_at.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    const fallbackData = await fallbackResponse.json();
    return fallbackData.length > 0 ? fallbackData[0] : null;

  } catch (error) {
    console.error('Error getting active character:', error);
    return null;
  }
}
