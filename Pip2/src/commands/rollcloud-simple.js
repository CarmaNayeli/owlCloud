import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

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
        flags: 64
      });
      return;
    }

    const code = interaction.options.getString('code').toUpperCase();

    // Respond immediately with basic info
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x4ECDC4)
        .setTitle('🔍 Processing RollCloud Connection')
        .setDescription(
          `**Pairing Code:** \`${code}\`\n\n` +
          '🔄 Checking the database...\n\n' +
          'If this takes too long, the command may have timed out. Please try again.'
        )
        .setFooter({ text: 'Pip 2 • RollCloud Integration' })
      ],
      flags: 64
    });

    // Process in background without waiting for interaction
    setTimeout(async () => {
      try {
        // TODO: Add actual database processing here
        console.log(`Background processing for code: ${code}`);
        
        // For now, just log it - we'll add the real logic once we confirm this works
      } catch (error) {
        console.error('Background processing error:', error);
      }
    }, 1000);
  }
};
