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
          { name: 'Discord Integration', value: 'discord' },
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
      case 'discord':
        embed = buildDiscordHelp();
        break;
      case 'all':
        embed = buildAllCommandsHelp();
        break;
      default:
        embed = buildMainHelp();
    }

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};

function buildMainHelp() {
  return new EmbedBuilder()
    .setColor(0x4ECDC4)
    .setTitle('🎲 Pip Bot Help')
    .setDescription(
      'A comprehensive D&D companion bot with RollCloud integration.\n\n' +
      'Use `/help topic:<name>` for detailed help on specific features.'
    )
    .addFields(
      {
        name: '🎮 RollCloud Integration',
        value:
          '`/rollcloud <code>` - Link your Discord to RollCloud\n' +
          '`/characters` - List your synced characters\n' +
          '`/character [name]` - View/set active character\n' +
          '`/spells [level] [search]` - List your character\'s spells\n' +
          '`/actions [type] [search]` - List your character\'s actions\n' +
          '`/check <name>` - View spell/action details without casting\n' +
          '`/cast <spell> [target] [level]` - Cast a spell in Roll20\n' +
          '`/use <action> [target]` - Use an action in Roll20\n' +
          '`/roll20 [character]` - Check Roll20 connection status\n' +
          '`/webhook [action]` - Show Discord webhook status\n' +
          '*Use `/help topic:RollCloud Setup` for setup guide*',
        inline: false
      },
      {
        name: '📜 Character Sheet',
        value:
          '`/sheet [section]` - Full character sheet\n' +
          '`/stats <stat>` - Quick stat lookup\n' +
          '`/spells [level] [search]` - List your character\'s spells\n' +
          '`/actions [type] [search]` - List your character\'s actions\n' +
          '`/check <name>` - View spell/action details without casting\n' +
          '`/cast <spell> [target] [level]` - Cast a spell in Roll20\n' +
          '`/use <action> [target]` - Use an action in Roll20\n' +
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
        name: '🔗 Discord Integration',
        value:
          '`/webhook status` - Check webhook configuration\n' +
          '`/webhook url` - Get webhook URL\n' +
          '`/webhook test` - Test webhook functionality\n' +
          '*Use `/help topic:Discord Integration` for details*',
        inline: false
      },
      {
        name: '⚙️ Utility & Admin',
        value:
          '`/ping` - Check bot latency\n' +
          '`/changelog view` - View Dice Cat updates\n' +
          '`/disconnect` - Remove RollCloud from channel\n' +
          '`/ticket` - Create support tickets\n' +
          '`/reactionrole` - Manage reaction roles',
        inline: false
      }
    )
    .setFooter({ text: 'Pip Bot • Dice Cat Community • 20 commands available' });
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
      },
      {
        name: '/spells [level] [search]',
        value:
          'List your character\'s spells.\n\n' +
          '**Level Filter:** Cantrips, Level 1-9\n' +
          '**Search:** Find spells by name\n\n' +
          'Examples:\n' +
          '`/spells` - All spells\n' +
          '`/spells level:1` - Level 1 spells\n' +
          '`/spells search:fire` - Fire spells',
        inline: false
      },
      {
        name: '/actions [type] [search]',
        value:
          'List your character\'s actions and attacks.\n\n' +
          '**Type Filter:** Actions, Attacks, Features, Legendary, Lair\n' +
          '**Search:** Find actions by name\n\n' +
          'Examples:\n' +
          '`/actions` - All actions\n' +
          '`/actions type:attack` - Attacks only\n' +
          '`/actions search:strike` - Actions with "strike"',
        inline: false
      },
      {
        name: '/cast <spell> [target] [level]',
        value:
          'Cast a spell in Roll20.\n\n' +
          '**Spell:** Spell name (autocomplete)\n' +
          '**Target:** Optional target\n' +
          '**Level:** For upcasting (1-9)\n\n' +
          'Examples:\n' +
          '`/cast Fireball` - Cast Fireball\n' +
          '`/cast Fireball target:Goblins` - Target goblins\n' +
          '`/cast Fireball level:5` - Upcast to level 5',
        inline: false
      },
      {
        name: '/check <name>',
        value:
          'View spell or action details without casting/using.\n\n' +
          '**Name:** Spell or action name (autocomplete)\n\n' +
          'Shows full details including:\n' +
          '• Level, school, concentration, ritual\n' +
          '• Casting time, range, duration, components\n' +
          '• Damage/healing, saves, attack rolls\n' +
          '• Full description\n\n' +
          'Examples:\n' +
          '`/check Fireball` - View Fireball details\n' +
          '`/check Sneak Attack` - View action details',
        inline: false
      },
      {
        name: '/use <action> [target]',
        value:
          'Use an action or ability in Roll20.\n\n' +
          '**Action:** Action name (autocomplete)\n' +
          '**Target:** Optional target\n\n' +
          'Examples:\n' +
          '`/use "Great Weapon Master"` - Use action\n' +
          '`/use Sneak_Attack target:Guard` - Target guard',
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
        name: 'Discord-Only Rolling',
        value:
          '`/rollhere 1d20` - Roll in Discord only (not Roll20)\n' +
          '`/rollhere 2d6+3 "Fire Damage"` - Roll with custom name\n' +
          '`/rollhere 4d8-2` - Complex dice notation\n\n' +
          '*Perfect for quick rolls when Roll20 is not open!*',
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

function buildDiscordHelp() {
  return new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🔗 Discord Integration Help')
    .setDescription('Commands for managing Discord webhooks and Roll20 integration.')
    .addFields(
      {
        name: '/webhook status',
        value:
          'Shows comprehensive Discord webhook status.\n\n' +
          'Displays:\n' +
          '• Connection status and server details\n' +
          '• Webhook URL (hidden for safety)\n' +
          '• Integration type (webhook vs pairing)\n' +
          '• Server and channel information\n' +
          '• Pairing ID and connection date',
        inline: false
      },
      {
        name: '/webhook url',
        value:
          'Shows just the Discord webhook URL.\n\n' +
          'Features:\n' +
          '• URL hidden to prevent accidental clicks\n' +
          '• Copy instructions for easy use\n' +
          '• Server and channel context\n' +
          '• Safe URL sharing format',
        inline: false
      },
      {
        name: '/webhook test',
        value:
          'Tests the Discord webhook functionality.\n\n' +
          'Sends a test message with:\n' +
          '• User and server information\n' +
          '• Timestamp and status\n' +
          '• Success/failure reporting\n' +
          '• Detailed error information',
        inline: false
      },
      {
        name: '/roll20 [character]',
        value:
          'Check Roll20 connection status for your character.\n\n' +
          'Shows:\n' +
          '• Roll20 connection status\n' +
          '• Character details and level\n' +
          '• Discord server information\n' +
          '• Available features when connected\n' +
          '• Troubleshooting guidance when not connected',
        inline: false
      },
      {
        name: '🔧 Troubleshooting',
        value:
          '**Webhook Issues:**\n' +
          '• Use `/webhook status` to check configuration\n' +
          '• Use `/webhook test` to verify functionality\n' +
          '• Check server permissions for webhooks\n\n' +
          '**Roll20 Issues:**\n' +
          '• Use `/roll20` to check connection status\n' +
          '• Ensure Roll20 tab is open with character selected\n' +
          '• Verify RollCloud extension is installed',
        inline: false
      }
    )
    .setFooter({ text: 'Discord integration requires RollCloud extension and proper setup!' });
}

function buildAllCommandsHelp() {
  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('📋 All Pip Bot Commands')
    .setDescription('Complete list of all 21 available commands.')
    .addFields(
      {
        name: '🎮 RollCloud Integration',
        value:
          '`/rollcloud <code>` - Link Discord to RollCloud extension\n' +
          '`/characters` - List your synced characters\n' +
          '`/character [name]` - View or set active character\n' +
          '`/roll20 [character]` - Check Roll20 connection status\n' +
          '`/webhook [action]` - Manage Discord webhooks\n' +
          '`/disconnect` - Remove RollCloud from this channel',
        inline: false
      },
      {
        name: '📜 Character Management',
        value:
          '`/sheet [section]` - View full character sheet\n' +
          '`/stats <stat>` - Quick stat lookup\n' +
          '`/check <name>` - View spell/action details without casting\n' +
          'Sections: overview, abilities, skills, spells, resources',
        inline: false
      },
      {
        name: '🎲 Dice Rolling',
        value:
          '`/roll <dice> [check] [advantage] [disadvantage]` - Roll dice\n' +
          '`/rollhere <dice> [name]` - Roll in Discord only\n' +
          '`/coin [count]` - Flip coins\n' +
          'Supports character modifiers and ability checks',
        inline: false
      },
      {
        name: '📋 Information & Updates',
        value:
          '`/changelog view` - View latest Dice Cat updates\n' +
          '`/changelog post` - Post to channel (Admin)\n' +
          '`/ping` - Check bot latency\n' +
          '`/help [topic]` - Show this help',
        inline: false
      },
      {
        name: '🎭 Server Management',
        value:
          '`/reactionrole create` - Create reaction role message\n' +
          '`/reactionrole add/remove` - Manage roles\n' +
          '`/reactionrole list` - List roles on message\n' +
          '`/ticket` - Create support tickets',
        inline: false
      },
      {
        name: '🔧 Testing & Diagnostics',
        value:
          '`/testdbconnection` - Test database connectivity\n' +
          '`/testdiscordlink` - Test Discord connection\n' +
          '`/testpairing` - Test RollCloud pairing\n' +
          '`/mydiscordinfo` - Show your Discord user info',
        inline: false
      }
    )
    .setFooter({ text: 'Pip Bot • Dice Cat Community • 20 commands available' });
}
