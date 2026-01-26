import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('actions')
    .setDescription('List your character\'s actions and attacks')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Filter by action type')
        .setRequired(false)
        .addChoices(
          { name: 'Actions', value: 'action' },
          { name: 'Attacks', value: 'attack' },
          { name: 'Features', value: 'feature' },
          { name: 'Legendary', value: 'legendary' },
          { name: 'Lair', value: 'lair' }
        )
    )
    .addStringOption(option =>
      option
        .setName('search')
        .setDescription('Search actions by name')
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('View another user\'s actions')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const typeFilter = interaction.options.getString('type');
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

      // Parse actions from character data
      const rawData = character.raw_dicecloud_data || '{}';
      const actions = parseActions(rawData);

      // Debug logging to help diagnose missing actions
      console.log(`⚔️ Parsing actions for ${character.character_name}:`, {
        hasRawData: !!character.raw_dicecloud_data,
        rawDataType: typeof rawData,
        actionCount: actions?.length || 0
      });

      if (!actions || actions.length === 0) {
        // Provide helpful message about potential sync issues
        const syncHint = character.updated_at
          ? `\nLast synced: ${new Date(character.updated_at).toLocaleString()}`
          : '\n*Note: Character may need to be re-synced from DiceCloud.*';
        return await interaction.editReply({
          content: `❌ **${character.character_name}** doesn't have any actions.${syncHint}\n\n*If you recently added actions in DiceCloud, try syncing your character again using the extension.*`,
          flags: 64
        });
      }

      // Apply filters
      let filteredActions = actions;
      
      if (typeFilter) {
        filteredActions = filteredActions.filter(action => 
          action.actionType === typeFilter
        );
      }
      
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredActions = filteredActions.filter(action =>
          action.name && action.name.toLowerCase().includes(searchLower)
        );
      }

      if (filteredActions.length === 0) {
        return await interaction.editReply({
          content: `❌ No actions found matching your criteria for **${character.character_name}**.`,
          flags: 64
        });
      }

      // Group actions by type
      const actionsByType = {};
      filteredActions.forEach(action => {
        const type = action.actionType || 'other';
        
        if (!actionsByType[type]) {
          actionsByType[type] = [];
        }
        actionsByType[type].push(action);
      });

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${character.character_name}'s Actions`)
        .setColor(0xe74c3c)
        .setFooter({ 
          text: `Use /use <action> to perform an action • Total: ${filteredActions.length} actions` 
        });

      // Add action lists by type
      const typeOrder = ['attack', 'action', 'feature', 'legendary', 'lair', 'other'];
      const typeEmojis = {
        attack: '⚔️',
        action: '🎯',
        feature: '✨',
        legendary: '👑',
        lair: '🏰',
        other: '📋'
      };

      typeOrder.forEach(type => {
        if (actionsByType[type]) {
          const actions = actionsByType[type].slice(0, 25); // Discord field limit
          const actionList = actions.map(action => {
            let emoji = typeEmojis[type] || '📋';
            let description = '';
            
            if (action.damageRoll) description += `💥 ${action.damageRoll}`;
            if (action.saveDC && action.saveAbility) description += ` 🛡️ ${action.saveAbility} DC ${action.saveDC}`;
            if (action.range) description += ` 📏 ${action.range}`;
            if (action.recharge && action.recharge !== 'None') description += ` ⚡ ${action.recharge}`;
            
            return `${emoji} **${action.name}**${description ? ` - ${description}` : ''}`;
          }).join('\n');

          embed.addFields({
            name: `${typeEmojis[type]} ${type.charAt(0).toUpperCase() + type.slice(1)} (${actions.length})`,
            value: actionList || 'No actions',
            inline: false
          });
        }
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Actions command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching actions. Please try again.',
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

function parseActions(rawData) {
  try {
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    return data.actions || [];
  } catch (error) {
    console.error('Error parsing actions:', error);
    return [];
  }
}
