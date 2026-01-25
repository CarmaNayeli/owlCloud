import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help information about Pip Bot')
    .addStringOption(option =>
      option
        .setName('topic')
        .setDescription('Get detailed help on a specific topic')
        .setRequired(false)
        .addChoices(
          { name: 'RollCloud Setup', value: 'rollcloud' },
          { name: 'Character Commands', value: 'characters' },
          { name: 'Rolling Dice', value: 'rolling' },
          { name: 'All Commands', value: 'all' }
        )
    ),

  async execute(interaction) {
    const topic = interaction.options.getString('topic');

    let embed;
    switch (topic) {
      case 'rollcloud':
        embed = buildRollCloudHelp();
        break;
      case 'characters':
        embed = buildCharacterHelp();
        break;
      case 'rolling':
        embed = buildRollingHelp();
        break;
      case 'all':
        embed = buildAllCommandsHelp();
        break;
      default:
        embed = buildMainHelp();
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

function buildMainHelp() {
  return new EmbedBuilder()
    .setColor(0x4ECDC4)
    .setTitle('🎲 Pip Bot Help')
    .setDescription(
      'A D&D companion bot with RollCloud integration.\n\n' +
      'Use `/help topic:<name>` for detailed help on specific features.'
    )
    .addFields(
      {
        name: '🎮 RollCloud Integration',
        value:
          '`/rollcloud <code>` - Link your Discord to RollCloud\n' +
          '`/characters` - List your synced characters\n' +
          '`/character [name]` - View/set active character\n' +
          '*Use `/help topic:RollCloud Setup` for setup guide*',
        inline: false
      },
      {
        name: '📜 Character Sheet',
        value:
          '`/sheet [section]` - Full character sheet\n' +
          '`/stats <stat>` - Quick stat lookup\n' +
          '*Use `/help topic:Character Commands` for details*',
        inline: false
      },
      {
        name: '🎲 Dice Rolling',
        value:
          '`/roll <dice>` - Roll dice (e.g., `2d6+3`)\n' +
          '`/roll <dice> check:<type>` - Roll with character modifier\n' +
          '`/coin [count]` - Flip coins\n' +
          '*Use `/help topic:Rolling Dice` for details*',
        inline: false
      },
      {
        name: '⚙️ Other Commands',
        value:
          '`/ping` - Check bot latency\n' +
          '`/changelog view` - View Dice Cat updates\n' +
          '`/disconnect` - Remove RollCloud from channel',
        inline: false
      }
    )
    .setFooter({ text: 'Pip Bot • Dice Cat Community' });
}

function buildRollCloudHelp() {
  return new EmbedBuilder()
    .setColor(0x4ECDC4)
    .setTitle('🎮 RollCloud Setup Guide')
    .setDescription('Connect your DiceCloud characters to Discord!')
    .addFields(
      {
        name: 'Step 1: Get Pairing Code',
        value:
          '1. Install the RollCloud browser extension\n' +
          '2. Open a DiceCloud character sheet\n' +
          '3. Click the RollCloud extension icon\n' +
          '4. Expand "Discord Integration"\n' +
          '5. Click "Setup Discord"\n' +
          '6. Copy the 6-character code shown',
        inline: false
      },
      {
        name: 'Step 2: Link Discord',
        value:
          'Run `/rollcloud <code>` with your pairing code.\n' +
          'Example: `/rollcloud ABC123`\n\n' +
          '*Each user needs their own code - multiple users can pair in the same channel!*',
        inline: false
      },
      {
        name: 'Step 3: Sync Characters',
        value:
          '1. Open any DiceCloud character sheet\n' +
          '2. Click "Sync Character" in the RollCloud extension\n' +
          '3. Repeat for each character you want to use\n\n' +
          '*Characters sync automatically when you view them!*',
        inline: false
      },
      {
        name: 'Step 4: Select Active Character',
        value:
          '`/characters` - See all your synced characters\n' +
          '`/character Kheia` - Set "Kheia" as active\n\n' +
          '*Partial name matching works: `/character khe` finds "Kheia"*',
        inline: false
      }
    )
    .setFooter({ text: 'Once set up, your character stats work with /roll, /stats, and /sheet!' });
}

function buildCharacterHelp() {
  return new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('📜 Character Commands')
    .setDescription('Commands for managing and viewing your D&D characters.')
    .addFields(
      {
        name: '/characters',
        value:
          'List all your synced characters.\n' +
          'Shows name, class, level, HP, and AC.\n' +
          '✅ marks your active character.',
        inline: false
      },
      {
        name: '/character [name]',
        value:
          '**No args:** View your active character\'s summary\n' +
          '**With name:** Set that character as active\n\n' +
          'Examples:\n' +
          '`/character` - View active character\n' +
          '`/character Kheia` - Set Kheia as active\n' +
          '`/character user:@friend` - View friend\'s character',
        inline: false
      },
      {
        name: '/sheet [section]',
        value:
          'View detailed character sheet.\n\n' +
          '**Sections:**\n' +
          '`overview` - HP bar, AC, speed, abilities (default)\n' +
          '`abilities` - All 6 ability scores with saves\n' +
          '`skills` - Full skill list with modifiers\n' +
          '`spells` - Spell slot tracker\n' +
          '`resources` - Ki, rage, sorcery points, etc.',
        inline: false
      },
      {
        name: '/stats <stat>',
        value:
          'Quick lookup for a single stat.\n\n' +
          '**Options:** HP, AC, Initiative, STR, DEX, CON, INT, WIS, CHA, Perception, Stealth, Athletics, Spell Slots',
        inline: false
      }
    )
    .setFooter({ text: 'Sync characters from the RollCloud browser extension!' });
}

function buildRollingHelp() {
  return new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('🎲 Rolling Dice')
    .setDescription('Roll dice with standard notation or character modifiers.')
    .addFields(
      {
        name: 'Basic Dice Rolling',
        value:
          '`/roll 1d20` - Roll a d20\n' +
          '`/roll 2d6+3` - Roll 2d6 and add 3\n' +
          '`/roll 4d6-1` - Roll 4d6 and subtract 1\n' +
          '`/roll 100d6` - Roll lots of dice!',
        inline: false
      },
      {
        name: 'Character Checks & Saves',
        value:
          'Use the `check` option to roll with your character\'s modifier:\n\n' +
          '`/roll 1d20 check:Strength` - STR check\n' +
          '`/roll 1d20 check:Dexterity Save` - DEX save\n' +
          '`/roll 1d20 check:Perception` - Perception check\n' +
          '`/roll 1d20 check:Initiative` - Initiative roll',
        inline: false
      },
      {
        name: 'Advantage & Disadvantage',
        value:
          '`/roll 1d20 check:Stealth advantage:True`\n' +
          '`/roll 1d20 check:Strength Save disadvantage:True`\n\n' +
          '*Rolls 2d20 and takes higher (advantage) or lower (disadvantage)*',
        inline: false
      },
      {
        name: 'Available Checks',
        value:
          '**Abilities:** Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma\n' +
          '**Saves:** All abilities + "_save" (e.g., Dexterity Save)\n' +
          '**Skills:** Perception, Stealth, Athletics, Acrobatics, Arcana, Insight, Persuasion, Deception, Intimidation\n' +
          '**Other:** Initiative',
        inline: false
      },
      {
        name: '/coin [count]',
        value:
          '`/coin` - Flip one coin\n' +
          '`/coin 10` - Flip 10 coins\n' +
          '`/coin 100` - Flip 100 with statistics',
        inline: false
      }
    )
    .setFooter({ text: 'Character checks require an active character - use /character to set one!' });
}

function buildAllCommandsHelp() {
  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('📋 All Commands')
    .setDescription('Complete list of Pip Bot commands.')
    .addFields(
      {
        name: '🎮 RollCloud',
        value:
          '`/rollcloud <code>` - Link Discord to RollCloud extension\n' +
          '`/disconnect` - Remove RollCloud from this channel',
        inline: false
      },
      {
        name: '🎭 Characters',
        value:
          '`/characters` - List your synced characters\n' +
          '`/character [name]` - View or set active character\n' +
          '`/sheet [section]` - View full character sheet\n' +
          '`/stats <stat>` - Quick stat lookup',
        inline: false
      },
      {
        name: '🎲 Dice',
        value:
          '`/roll <dice> [check] [advantage] [disadvantage]` - Roll dice\n' +
          '`/coin [count]` - Flip coins',
        inline: false
      },
      {
        name: '📋 Changelog',
        value:
          '`/changelog view` - View latest Dice Cat updates\n' +
          '`/changelog post` - Post to channel (Admin)',
        inline: false
      },
      {
        name: '🎭 Reaction Roles (Admin)',
        value:
          '`/reactionrole create` - Create reaction role message\n' +
          '`/reactionrole add` - Add role to message\n' +
          '`/reactionrole list` - List roles on message\n' +
          '`/reactionrole remove` - Remove role from message',
        inline: false
      },
      {
        name: '⚙️ Utility',
        value:
          '`/ping` - Check bot latency\n' +
          '`/help [topic]` - Show this help',
        inline: false
      }
    )
    .setFooter({ text: 'Pip Bot • Dice Cat Community' });
}
