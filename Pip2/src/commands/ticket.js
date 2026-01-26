import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage support tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Set up the ticket panel in current channel')
        .addRoleOption(option =>
          option
            .setName('support_role')
            .setDescription('Role that can view and manage tickets')
            .setRequired(true)
        )
        .addChannelOption(option =>
          option
            .setName('category')
            .setDescription('Category to create ticket channels in')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('close')
        .setDescription('Close the current ticket')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a user to the current ticket')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to add to ticket')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a user from the current ticket')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to remove from ticket')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'setup':
        return await handleSetup(interaction);
      case 'close':
        return await handleClose(interaction);
      case 'add':
        return await handleAdd(interaction);
      case 'remove':
        return await handleRemove(interaction);
    }
  }
};

async function handleSetup(interaction) {
  const supportRole = interaction.options.getRole('support_role');
  const category = interaction.options.getChannel('category');

  // Create the ticket panel embed
  const embed = new EmbedBuilder()
    .setColor(0x1E88E5)
    .setTitle('🎫 Support Tickets')
    .setDescription(
      'Need help? Click the button below to create a support ticket.\n\n' +
      'A private channel will be created where you can discuss your issue with our support team.'
    )
    .addFields(
      {
        name: '📋 What are tickets for?',
        value:
          '• Report bugs or issues\n' +
          '• Get help with the app\n' +
          '• Ask questions\n' +
          '• Provide feedback',
        inline: false
      }
    )
    .setFooter({ text: 'Dice Cat Support' })
    .setTimestamp();

  // Create the button
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`create_ticket:${supportRole.id}:${category?.id || 'none'}`)
        .setLabel('Create Ticket')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary)
    );

  await interaction.channel.send({
    embeds: [embed],
    components: [row]
  });

  await interaction.reply({
    content: `✅ Ticket panel created! Support role: ${supportRole}`,
    flags: 64 // ephemeral
  });
}

async function handleClose(interaction) {
  const channel = interaction.channel;

  // Check if this is a ticket channel
  if (!channel.name.startsWith('ticket-')) {
    return await interaction.reply({
      content: '❌ This command can only be used in ticket channels!',
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
    } catch (error) {
      console.error('Failed to delete ticket channel:', error);
    }
  }, 10000);
}

async function handleAdd(interaction) {
  const channel = interaction.channel;
  const user = interaction.options.getUser('user');

  // Check if this is a ticket channel
  if (!channel.name.startsWith('ticket-')) {
    return await interaction.reply({
      content: '❌ This command can only be used in ticket channels!',
      flags: 64 // ephemeral
    });
  }

  try {
    await channel.permissionOverwrites.create(user, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });

    await interaction.reply({
      content: `✅ Added ${user} to this ticket.`
    });
  } catch (error) {
    console.error('Failed to add user to ticket:', error);
    await interaction.reply({
      content: '❌ Failed to add user to ticket.',
      flags: 64 // ephemeral
    });
  }
}

async function handleRemove(interaction) {
  const channel = interaction.channel;
  const user = interaction.options.getUser('user');

  // Check if this is a ticket channel
  if (!channel.name.startsWith('ticket-')) {
    return await interaction.reply({
      content: '❌ This command can only be used in ticket channels!',
      flags: 64 // ephemeral
    });
  }

  try {
    await channel.permissionOverwrites.delete(user);

    await interaction.reply({
      content: `✅ Removed ${user} from this ticket.`
    });
  } catch (error) {
    console.error('Failed to remove user from ticket:', error);
    await interaction.reply({
      content: '❌ Failed to remove user from ticket.',
      flags: 64 // ephemeral
    });
  }
}
