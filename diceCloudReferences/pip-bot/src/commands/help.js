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
            '`/roll [dice/check]` - Roll dice or make ability checks\n' +
            '`/coin [count]` - Flip one or more coins',
          inline: false
        },
        {
          name: '🎮 RollCloud Integration',
          value:
            '`/rollcloud [code]` - Connect RollCloud extension\n' +
            '`/sheet [section]` - View character sheet information\n' +
            '`/cast [spell]` - Cast a spell from your character\n' +
            '`/use [ability]` - Use abilities, features, or items\n' +
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
        name: '📝 Dice & Check Examples',
        value:
          '`/roll 2d6` - Roll two 6-sided dice\n' +
          '`/roll 1d20+5` - Roll d20 and add 5\n' +
          '`/roll perception` - Make a Perception check\n' +
          '`/roll strength save` - Make a Strength saving throw\n' +
          '`/roll stealth advantage:advantage` - Roll Stealth with advantage',
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
      .addFields({
        name: '📋 Character Sheet Examples',
        value:
          '`/sheet` - View full character sheet\n' +
          '`/sheet section:abilities` - View ability scores\n' +
          '`/sheet section:spells` - View spell list\n' +
          '`/sheet section:combat` - View combat stats',
        inline: false
      })
      .addFields({
        name: '🔮 Spell Casting Examples',
        value:
          '`/cast Fireball` - Cast Fireball spell\n' +
          '`/cast Cure Wounds target:Bob` - Cast Cure Wounds on Bob\n' +
          '`/cast Magic Missile upcast:true level:4` - Upcast Magic Missile',
        inline: false
      })
      .addFields({
        name: '⚔️ Ability Usage Examples',
        value:
          '`/use Sneak Attack` - Use Sneak Attack feature\n' +
          '`use Potion of Healing quantity:2` - Use 2 healing potions\n' +
          '`/use Hide` - Make a Stealth check to hide\n' +
          '`/use Dash` - Take the Dash action',
        inline: false
      })
      .setFooter({ text: 'Pip Bot • Dice Cat Community' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
