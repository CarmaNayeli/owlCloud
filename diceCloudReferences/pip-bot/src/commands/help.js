import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help information about Pip Bot'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x1E88E5)
      .setTitle('🎲 Pip Bot Help')
      .setDescription(
        'A lightweight utility bot for the Dice Cat community.\n\n' +
        '**Main Features:**'
      )
      .addFields(
        {
          name: '📋 Changelog Commands',
          value:
            '`/changelog view` - View the latest Dice Cat app updates\n' +
            '`/changelog post` - Post changelog to channel (Admin only)',
          inline: false
        },
        {
          name: '🎭 Reaction Roles (Admin)',
          value:
            '`/reactionrole create` - Create a reaction role message\n' +
            '`/reactionrole add` - Add a role to a message\n' +
            '`/reactionrole list` - List roles on a message\n' +
            '`/reactionrole remove` - Remove a role from a message',
          inline: false
        },
        {
          name: '🎲 Fun Commands',
          value:
            '`/roll [dice]` - Roll dice (e.g., `/roll 2d6+3`)\n' +
            '`/coin [count]` - Flip one or more coins',
          inline: false
        },
        {
          name: '🎮 RollCloud Integration',
          value:
            '`/rollcloud [code]` - Connect RollCloud extension\n' +
            '*Get the code from your RollCloud extension*',
          inline: false
        },
        {
          name: '⚙️ Utility Commands',
          value: '`/ping` - Check bot responsiveness',
          inline: false
        }
      )
      .addFields({
        name: '📝 Dice Notation Examples',
        value:
          '`/roll 2d6` - Roll two 6-sided dice\n' +
          '`/roll 1d20+5` - Roll d20 and add 5\n' +
          '`/roll 3d10-2` - Roll 3d10 and subtract 2\n' +
          '`/roll 100d6` - Roll 100 d6',
        inline: false
      })
      .addFields({
        name: '🪙 Coin Flip Examples',
        value:
          '`/coin` - Flip one coin\n' +
          '`/coin 10` - Flip 10 coins\n' +
          '`/coin 100` - Flip 100 coins with stats',
        inline: false
      })
      .setFooter({ text: 'Pip Bot • Dice Cat Community' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
