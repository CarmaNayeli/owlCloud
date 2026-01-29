import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchWithTimeout } from '../utils/fetch-timeout.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('check')
    .setDescription('View details of a spell or action without casting/using it')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Name of the spell or action to check')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const discordUserId = interaction.user.id;

    try {
      const character = await getActiveCharacter(discordUserId);

      if (!character) {
        await interaction.respond([]);
        return;
      }

      const rawData = character.raw_dicecloud_data || '{}';
      const spells = parseSpells(rawData);
      const actions = parseActions(rawData);

      // Combine spells and actions for autocomplete
      const allItems = [
        ...spells.map(spell => ({
          name: `${spell.name} (Spell - Level ${spell.level || 0})`,
          value: `spell:${spell.name}`,
          sortName: spell.name.toLowerCase()
        })),
        ...actions.map(action => ({
          name: `${action.name} (${action.actionType || 'Action'})`,
          value: `action:${action.name}`,
          sortName: action.name.toLowerCase()
        }))
      ];

      const filtered = allItems
        .filter(item => item.sortName.includes(focusedValue))
        .slice(0, 25);

      await interaction.respond(
        filtered.map(item => ({
          name: item.name,
          value: item.value
        }))
      );
    } catch (error) {
      console.error('Check autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    // CRITICAL: Defer IMMEDIATELY - Discord only gives 3 seconds!
    await interaction.deferReply();

    const nameInput = interaction.options.getString('name');
    const discordUserId = interaction.user.id;

    try {
      const character = await getActiveCharacter(discordUserId);

      if (!character) {
        return await interaction.editReply({
          content: '❌ You don\'t have an active character set. Use `/character` to set one.',
          flags: 64
        });
      }

      const rawData = character.raw_dicecloud_data || '{}';
      const spells = parseSpells(rawData);
      const actions = parseActions(rawData);

      // Parse the input to determine if it's a spell or action
      let isSpell = false;
      let searchName = nameInput;

      if (nameInput.startsWith('spell:')) {
        isSpell = true;
        searchName = nameInput.substring(6);
      } else if (nameInput.startsWith('action:')) {
        isSpell = false;
        searchName = nameInput.substring(7);
      } else {
        // Try to find in spells first, then actions
        const spellMatch = spells.find(s => s.name && s.name.toLowerCase() === nameInput.toLowerCase());
        if (spellMatch) {
          isSpell = true;
          searchName = spellMatch.name;
        }
      }

      if (isSpell || nameInput.startsWith('spell:')) {
        // Find the spell
        const spell = spells.find(s =>
          s.name && s.name.toLowerCase() === searchName.toLowerCase()
        );

        if (!spell) {
          return await interaction.editReply({
            content: `❌ Spell "**${searchName}**" not found. Use \`/spells\` to see your available spells.`,
            flags: 64
          });
        }

        // Build the spell embed
        const embed = buildSpellEmbed(spell, character.character_name);
        await interaction.editReply({ embeds: [embed] });
      } else {
        // Find the action
        const action = actions.find(a =>
          a.name && a.name.toLowerCase() === searchName.toLowerCase()
        );

        if (!action) {
          return await interaction.editReply({
            content: `❌ Action "**${searchName}**" not found. Use \`/actions\` to see your available actions.`,
            flags: 64
          });
        }

        // Build the action embed
        const embed = buildActionEmbed(action, character.character_name);
        await interaction.editReply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Check command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while checking the spell/action. Please try again.',
        flags: 64
      });
    }
  }
};

function buildSpellEmbed(spell, characterName) {
  const spellLevel = parseInt(spell.level) || 0;

  // Build title with tags
  let titleTags = '';
  if (spell.concentration) titleTags += ' 🧠';
  if (spell.ritual) titleTags += ' 📖';

  // Build spell level text with school
  let levelText = spellLevel === 0 ? 'Cantrip' : `Level ${spellLevel}`;
  if (spell.school) {
    levelText += ` ${spell.school}`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📜 ${spell.name}${titleTags}`)
    .setColor(0x9b59b6)
    .setFooter({ text: `${characterName}'s Spellbook • Use /cast to cast this spell` });

  // Build description
  let description = `**${levelText}**`;
  if (spell.concentration) description += ' • Concentration';
  if (spell.ritual) description += ' • Ritual';
  description += '\n\n';

  if (spell.castingTime) description += `**Casting Time:** ${spell.castingTime}\n`;
  if (spell.range) description += `**Range:** ${spell.range}\n`;
  if (spell.duration) description += `**Duration:** ${spell.duration}\n`;
  if (spell.components) description += `**Components:** ${spell.components}\n`;
  if (spell.source) description += `**Source:** ${spell.source}\n`;

  // Add damage/healing info
  if (spell.damageRoll || spell.damageRolls?.length > 0) {
    const damages = spell.damageRolls || [{ damage: spell.damageRoll, damageType: spell.damageType }];
    damages.forEach(d => {
      if (d.damage) {
        const type = d.damageType || 'damage';
        const isHealing = type.toLowerCase() === 'healing';
        const emoji = isHealing ? '💚' : '💥';
        description += `**${isHealing ? 'Healing' : 'Damage'}:** ${emoji} ${d.damage}`;
        if (!isHealing && d.damageType) description += ` ${d.damageType}`;
        description += '\n';
      }
    });
  }

  if (spell.healingRoll) {
    description += `**Healing:** 💚 ${spell.healingRoll}\n`;
  }

  if (spell.attackRoll && spell.attackRoll !== '(none)') {
    description += `**Attack:** ⚔️ Spell Attack\n`;
  }

  if (spell.saveDC && spell.saveAbility) {
    description += `**Save:** 🛡️ ${spell.saveAbility} DC ${spell.saveDC}\n`;
  }

  // Add upcast info if applicable
  if (spellLevel > 0 && spell.description) {
    const upcastMatch = spell.description.match(/at higher levels[.:]/i);
    if (upcastMatch) {
      description += `\n📈 **Can be upcast** (use \`/cast spell level:X\`)\n`;
    }
  }

  // Add full description
  if (spell.summary || spell.description) {
    description += '\n---\n';
    if (spell.summary) {
      description += spell.summary;
    } else if (spell.description) {
      // Truncate very long descriptions for Discord embed
      const maxLength = 1500;
      if (spell.description.length > maxLength) {
        description += spell.description.substring(0, maxLength) + '...';
      } else {
        description += spell.description;
      }
    }
  }

  embed.setDescription(description);
  return embed;
}

function buildActionEmbed(action, characterName) {
  const typeEmojis = {
    attack: '⚔️',
    action: '🎯',
    feature: '✨',
    legendary: '👑',
    lair: '🏰',
    other: '📋'
  };

  const emoji = typeEmojis[action.actionType] || '📋';
  const actionType = action.actionType
    ? action.actionType.charAt(0).toUpperCase() + action.actionType.slice(1)
    : 'Action';

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${action.name}`)
    .setColor(0xe74c3c)
    .setFooter({ text: `${characterName}'s Actions • Use /use to perform this action` });

  let description = `**${actionType}**\n\n`;

  if (action.actionCost) description += `**Action Cost:** ${action.actionCost}\n`;
  if (action.range) description += `**Range:** ${action.range}\n`;
  if (action.target) description += `**Target:** ${action.target}\n`;

  // Attack info
  if (action.attackBonus !== undefined && action.attackBonus !== null) {
    const bonus = action.attackBonus >= 0 ? `+${action.attackBonus}` : action.attackBonus;
    description += `**Attack:** ⚔️ ${bonus} to hit\n`;
  }

  // Damage info
  if (action.damageRoll) {
    description += `**Damage:** 💥 ${action.damageRoll}`;
    if (action.damageType) description += ` ${action.damageType}`;
    description += '\n';
  }

  // Save info
  if (action.saveDC && action.saveAbility) {
    description += `**Save:** 🛡️ ${action.saveAbility} DC ${action.saveDC}\n`;
  }

  // Recharge
  if (action.recharge && action.recharge !== 'None') {
    description += `**Recharge:** ⚡ ${action.recharge}\n`;
  }

  // Uses/resources
  if (action.uses) {
    description += `**Uses:** ${action.uses.current !== undefined ? `${action.uses.current}/${action.uses.max}` : action.uses}\n`;
  }

  // Full description
  if (action.description) {
    description += '\n---\n';
    const maxLength = 1500;
    if (action.description.length > maxLength) {
      description += action.description.substring(0, maxLength) + '...';
    } else {
      description += action.description;
    }
  }

  embed.setDescription(description);
  return embed;
}

// Helper functions
async function getActiveCharacter(discordUserId) {
  try {
    const response = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&is_active=eq.true&select=*&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      },
      10000
    );

    const data = await response.json();

    if (data.length > 0) {
      return data[0];
    }

    const fallbackResponse = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&select=*&order=updated_at.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      },
      10000
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

function parseActions(rawData) {
  try {
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    return data.actions || [];
  } catch (error) {
    console.error('Error parsing actions:', error);
    return [];
  }
}
