import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('coin')
    .setDescription('Flip a coin (or multiple coins)')
    .addIntegerOption(option =>
      option
        .setName('count')
        .setDescription('Number of coins to flip (default: 1)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  async execute(interaction) {
    const count = interaction.options.getInteger('count') || 1;

    const flips = [];
    let heads = 0;
    let tails = 0;

    for (let i = 0; i < count; i++) {
      const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
      flips.push(result);
      if (result === 'Heads') heads++;
      else tails++;
    }

    let response = `🪙 **${interaction.user.displayName}** flipped ${count === 1 ? 'a coin' : `${count} coins`}\n\n`;

    if (count === 1) {
      const emoji = flips[0] === 'Heads' ? '🟡' : '⚪';
      response += `${emoji} **${flips[0]}**`;
    } else if (count <= 20) {
      response += `Results: ${flips.map(f => f === 'Heads' ? '🟡' : '⚪').join(' ')}\n`;
      response += `**${heads} Heads, ${tails} Tails**`;
    } else {
      response += `**${heads} Heads (${Math.round(heads / count * 100)}%)**\n`;
      response += `**${tails} Tails (${Math.round(tails / count * 100)}%)**`;
    }

    await interaction.reply(response);
  }
};
