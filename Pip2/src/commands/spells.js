import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('spells')
    .setDescription('List your character\'s spells')
    .addStringOption(option =>
      option
        .setName('level')
        .setDescription('Filter by spell level')
        .setRequired(false)
        .addChoices(
          { name: 'Cantrips', value: '0' },
          { name: 'Level 1', value: '1' },
          { name: 'Level 2', value: '2' },
          { name: 'Level 3', value: '3' },
          { name: 'Level 4', value: '4' },
          { name: 'Level 5', value: '5' },
          { name: 'Level 6', value: '6' },
          { name: 'Level 7', value: '7' },
          { name: 'Level 8', value: '8' },
          { name: 'Level 9', value: '9' }
        )
    )
    .addStringOption(option =>
      option
        .setName('search')
        .setDescription('Search spells by name')
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('View another user\'s spells')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const levelFilter = interaction.options.getString('level');
    const searchTerm = interaction.options.getString('search');
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const discordUserId = targetUser.id;

    try {
      // Get active character for the user
      const character = await getActiveCharacter(discordUserId);
      
      if (!character) {
        return await interaction.editReply({
          content: targetUser.id === interaction.user.id 
            ? '❌ You don\'t have an active character set. Use `/character` to set one.'
            : `❌ ${targetUser.username} doesn\'t have an active character set.`,
          flags: 64 // ephemeral
        });
      }

      // Parse spells from character data
      const rawData = character.raw_dicecloud_data || '{}';
      const spells = parseSpells(rawData);

      // Debug logging to help diagnose missing spells
      console.log(`📚 Parsing spells for ${character.character_name}:`, {
        hasRawData: !!character.raw_dicecloud_data,
        rawDataType: typeof rawData,
        spellCount: spells?.length || 0
      });

      if (!spells || spells.length === 0) {
        // Provide helpful message about potential sync issues
        const syncHint = character.updated_at
          ? `\nLast synced: ${new Date(character.updated_at).toLocaleString()}`
          : '\n*Note: Character may need to be re-synced from DiceCloud.*';
        return await interaction.editReply({
          content: `❌ **${character.character_name}** doesn't have any spells.${syncHint}\n\n*If you recently added spells in DiceCloud, try syncing your character again using the extension.*`,
          flags: 64
        });
      }

      // Apply filters
      let filteredSpells = spells;
      
      if (levelFilter !== null) {
        filteredSpells = filteredSpells.filter(spell => 
          (parseInt(spell.level) || 0) === parseInt(levelFilter)
        );
      }
      
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredSpells = filteredSpells.filter(spell =>
          spell.name && spell.name.toLowerCase().includes(searchLower)
        );
      }

      if (filteredSpells.length === 0) {
        return await interaction.editReply({
          content: `❌ No spells found matching your criteria for **${character.character_name}**.`,
          flags: 64
        });
      }

      // Group spells by level
      const spellsByLevel = {};
      filteredSpells.forEach(spell => {
        const level = parseInt(spell.level) || 0;
        const levelKey = level === 0 ? 'Cantrips' : `Level ${level}`;
        
        if (!spellsByLevel[levelKey]) {
          spellsByLevel[levelKey] = [];
        }
        spellsByLevel[levelKey].push(spell);
      });

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`📚 ${character.character_name}'s Spells`)
        .setColor(0x3498db)
        .setFooter({ 
          text: `Use /cast <spell> to cast a spell • Total: ${filteredSpells.length} spells` 
        });

      // Add spell lists by level
      Object.keys(spellsByLevel).sort((a, b) => {
        if (a === 'Cantrips') return -1;
        if (b === 'Cantrips') return 1;
        return parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]);
      }).forEach(levelKey => {
        const spells = spellsByLevel[levelKey].slice(0, 25); // Discord field limit
        const spellList = spells.map(spell => {
          let emoji = '🔮';
          if (spell.damageRoll) emoji = '⚡';
          if (spell.healingRoll) emoji = '💚';
          if (spell.saveDC) emoji = '🛡️';
          
          let description = '';
          if (spell.castingTime) description += `⏱️ ${spell.castingTime}`;
          if (spell.range) description += ` 📏 ${spell.range}`;
          if (spell.duration && spell.duration !== 'Instantaneous') description += ` ⏳ ${spell.duration}`;
          
          return `${emoji} **${spell.name}**${description ? ` - ${description}` : ''}`;
        }).join('\n');

        embed.addFields({
          name: `${levelKey} (${spells.length})`,
          value: spellList || 'No spells',
          inline: false
        });
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Spells command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching spells. Please try again.',
        flags: 64
      });
    }
  }
};

// Helper functions
async function getActiveCharacter(discordUserId) {
  try {
    // First try direct lookup by discord_user_id
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&is_active=eq.true&select=*&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    const data = await response.json();
    
    if (data.length > 0) {
      return data[0];
    }

    // If no active character, get most recently updated
    const fallbackResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&select=*&order=updated_at.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    const fallbackData = await fallbackResponse.json();
    return fallbackData.length > 0 ? fallbackData[0] : null;

  } catch (error) {
    console.error('Error getting active character:', error);
    return null;
  }
}

function parseSpells(rawData) {
  try {
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    return data.spells || [];
  } catch (error) {
    console.error('Error parsing spells:', error);
    return [];
  }
}
