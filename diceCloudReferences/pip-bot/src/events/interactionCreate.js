import { Events, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';

// Supabase config for OwlCloud commands
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
    }

    // Handle button interactions
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }
  }
};

async function handleCommand(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error);

    const errorMessage = { content: 'There was an error executing this command!', ephemeral: true };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

async function handleButtonInteraction(interaction) {
  const [action, ...params] = interaction.customId.split(':');

  if (action === 'create_ticket') {
    await handleCreateTicket(interaction, params);
  } else if (interaction.customId === 'close_ticket') {
    await handleCloseTicket(interaction);
  } else if (action === 'owlcloud') {
    await handleOwlCloudButton(interaction, params);
  }
}

async function handleCloseTicket(interaction) {
  const channel = interaction.channel;

  // Check if this is a ticket channel
  if (!channel.name.startsWith('ticket-')) {
    return await interaction.reply({
      content: '❌ This can only be used in ticket channels!',
      ephemeral: true
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
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

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
// OwlCloud Button Handlers
// ============================================================================

/**
 * Handle OwlCloud button interactions
 * Button customId format: owlcloud:<command_type>:<action_name>:<extra_data>
 *
 * Examples:
 * - owlcloud:roll:Attack:1d20+5
 * - owlcloud:use_action:Longsword
 * - owlcloud:use_bonus:Healing Word
 * - owlcloud:end_turn
 * - owlcloud:use_ability:Fireball:spell
 */
async function handleOwlCloudButton(interaction, params) {
  const [commandType, actionName, ...extraData] = params;

  // Acknowledge immediately
  await interaction.deferReply({ ephemeral: true });

  try {
    // Find the pairing for this channel
    const pairing = await findPairingForChannel(interaction.channelId);

    if (!pairing) {
      await interaction.editReply({
        content: '❌ OwlCloud is not connected to this channel. Use `/owlcloud <code>` to connect.'
      });
      return;
    }

    // Create command in Supabase
    const command = await createOwlCloudCommand({
      pairingId: pairing.id,
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.username,
      discordMessageId: interaction.message.id,
      commandType: commandType,
      actionName: actionName,
      commandData: parseExtraData(commandType, extraData)
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

    console.log(`✅ OwlCloud command sent: ${commandType} ${actionName} by ${interaction.user.tag}`);

  } catch (error) {
    console.error('OwlCloud button error:', error);
    await interaction.editReply({
      content: '❌ Something went wrong. Please try again.'
    });
  }
}

/**
 * Find a OwlCloud pairing for a channel
 */
async function findPairingForChannel(channelId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Supabase not configured');
    return null;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/owlcloud_pairings?discord_channel_id=eq.${channelId}&status=eq.connected&select=*`,
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
 * Create a command in Supabase for the extension to pick up
 */
async function createOwlCloudCommand(options) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log(`[OwlCloud] Creating command:`, {
      pairingId: options.pairingId,
      commandType: options.commandType,
      actionName: options.actionName,
      discordUserId: options.discordUserId
    });

    const response = await fetch(`${SUPABASE_URL}/rest/v1/owlcloud_commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        pairing_id: options.pairingId,
        discord_user_id: options.discordUserId,
        discord_username: options.discordUsername,
        discord_message_id: options.discordMessageId,
        command_type: options.commandType,
        action_name: options.actionName,
        command_data: options.commandData || {},
        status: 'pending'
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[OwlCloud] Command created successfully:`, data[0]?.id);
      return { success: true, command: data[0] };
    } else {
      const errorText = await response.text();
      console.error(`[OwlCloud] Failed to create command (${response.status}):`, errorText);
      
      // Provide more specific error messages
      if (response.status === 400) {
        return { success: false, error: 'Invalid command data. Please check the command format.' };
      } else if (response.status === 403) {
        return { success: false, error: 'Permission denied. Check bot permissions.' };
      } else if (response.status === 422) {
        return { success: false, error: 'Command validation failed. Missing required fields.' };
      } else if (errorText.includes('column') && errorText.includes('does not exist')) {
        return { success: false, error: 'Database schema mismatch. Please run the latest migration.' };
      } else {
        return { success: false, error: `Database error (${response.status}): ${errorText}` };
      }
    }
  } catch (error) {
    console.error('[OwlCloud] Error creating command:', error);
    return { success: false, error: `Network error: ${error.message}` };
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
