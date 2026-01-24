import { Events, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';

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
