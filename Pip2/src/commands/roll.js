import { SlashCommandBuilder } from 'discord.js';

/**
 * Parse dice notation (e.g., "2d6+3", "1d20", "3d10-2")
 */
function parseDiceNotation(notation) {
  const match = notation.match(/^(\d+)d(\d+)([\+\-]\d+)?$/i);

  if (!match) {
    return null;
  }

  return {
    count: parseInt(match[1]),
    sides: parseInt(match[2]),
    modifier: match[3] ? parseInt(match[3]) : 0
  };
}

/**
 * Roll dice and return results
 */
function rollDice(count, sides) {
  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  return rolls;
}

export default {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll dice using dice notation')
    .addStringOption(option =>
      option
        .setName('dice')
        .setDescription('Dice to roll (e.g., 2d6, 1d20+5, 3d10-2)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const diceNotation = interaction.options.getString('dice');
    const parsed = parseDiceNotation(diceNotation);

    if (!parsed) {
      return await interaction.reply({
        content: '❌ Invalid dice notation! Use format like: 2d6, 1d20+5, 3d10-2',
        ephemeral: true
      });
    }

    const { count, sides, modifier } = parsed;

    // Validate reasonable limits
    if (count > 100) {
      return await interaction.reply({
        content: '❌ Too many dice! Maximum is 100.',
        ephemeral: true
      });
    }

    if (sides > 1000) {
      return await interaction.reply({
        content: '❌ Too many sides! Maximum is 1000.',
        ephemeral: true
      });
    }

    const rolls = rollDice(count, sides);
    const sum = rolls.reduce((a, b) => a + b, 0);
    const total = sum + modifier;

    let response = `🎲 **${interaction.user.displayName}** rolled **${diceNotation}**\n\n`;

    if (rolls.length <= 20) {
      response += `Rolls: [${rolls.join(', ')}]`;
    } else {
      response += `Rolled ${rolls.length} dice (too many to display)`;
    }

    response += `\nSum: **${sum}**`;

    if (modifier !== 0) {
      response += ` ${modifier > 0 ? '+' : ''}${modifier}`;
    }

    response += `\n**Total: ${total}**`;

    await interaction.reply(response);
  }
};
