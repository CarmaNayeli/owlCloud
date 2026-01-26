import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('mydiscordinfo')
    .setDescription('Get your Discord user information for manual database linking'),

  async execute(interaction) {
    try {
      const embed = new EmbedBuilder()
        .setColor(0x4ECDC4)
        .setTitle('🔗 Your Discord Information')
        .setDescription('Use this information to manually update your database record')
        .addFields(
          { 
            name: 'Discord User ID', 
            value: `\`${interaction.user.id}\``,
            inline: false 
          },
          { 
            name: 'Discord Username', 
            value: `\`${interaction.user.username}\``,
            inline: false 
          },
          { 
            name: 'Discord Global Name (Display Name)', 
            value: `\`${interaction.user.globalName || interaction.user.username}\``,
            inline: false 
          },
          { 
            name: 'Full Discord Tag', 
            value: `\`${interaction.user.tag}\``,
            inline: false 
          }
        )
        .setFooter({ text: 'Copy these values to update your auth_tokens record' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: 64 }); // ephemeral
    } catch (error) {
      console.error('Error getting Discord info:', error);
      await interaction.reply({
        content: '❌ Failed to get Discord information',
        flags: 64 // ephemeral
      });
    }
  }
};
