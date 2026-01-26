import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// Supabase config - set via environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('sheet')
    .setDescription('View detailed character sheet information')
    .addStringOption(option =>
      option
        .setName('character')
        .setDescription('Character name (optional - uses your linked character if not provided)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('section')
        .setDescription('Specific section to view')
        .setRequired(false)
        .addChoices(
          { name: 'Basic Info', value: 'basic' },
          { name: 'Ability Scores', value: 'abilities' },
          { name: 'Skills', value: 'skills' },
          { name: 'Spells', value: 'spells' },
          { name: 'Features & Traits', value: 'features' },
          { name: 'Equipment', value: 'equipment' },
          { name: 'Combat Stats', value: 'combat' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const characterName = interaction.options.getString('character');
      const section = interaction.options.getString('section');

      // Get character data from DiceCloud via Supabase
      const characterData = await getCharacterData(interaction.user.id, characterName);

      if (!characterData) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Character Not Found')
            .setDescription(
              'Could not find a character for your Discord account.\n\n' +
              '**To link your character:**\n' +
              '1. Use the RollCloud extension\n' +
              '2. Connect it to this server with `/rollcloud [code]`\n' +
              '3. Your character will be automatically linked'
            )
          ]
        });
        return;
      }

      // Generate the appropriate embed based on section
      const embed = section 
        ? generateSectionEmbed(characterData, section)
        : generateFullSheetEmbed(characterData);

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Sheet command error:', error);
      
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('❌ Error Loading Character')
          .setDescription('Something went wrong while loading your character data. Please try again later.')
        ]
      });
    }
  }
};

/**
 * Get character data from DiceCloud via Supabase
 */
async function getCharacterData(discordUserId, characterName = null) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured');
  }

  // First, find the user's RollCloud connection
  const connectionResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/rollcloud_pairings?discord_user_id=eq.${discordUserId}&status=eq.connected&select=*`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!connectionResponse.ok) {
    throw new Error('Failed to lookup user connection');
  }

  const connections = await connectionResponse.json();
  
  if (connections.length === 0) {
    return null;
  }

  const connection = connections[0];
  const dicecloudUserId = connection.dicecloud_user_id;

  // Get character data from DiceCloud
  const characterResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/dicecloud_characters?user_id=eq.${dicecloudUserId}${characterName ? `&name=ilike.*${characterName}*` : ''}&select=*&order=updated_at.desc&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!characterResponse.ok) {
    throw new Error('Failed to lookup character data');
  }

  const characters = await characterResponse.json();
  return characters.length > 0 ? characters[0] : null;
}

/**
 * Generate a full character sheet embed
 */
function generateFullSheetEmbed(character) {
  const embed = new EmbedBuilder()
    .setColor(0x4ECDC4)
    .setTitle(`📋 ${character.name} - Character Sheet`)
    .setDescription(`Level ${character.level || 1} ${character.race || 'Unknown'} ${character.class || 'Unknown'}`)
    .setThumbnail(character.portrait_url || null)
    .addFields(
      {
        name: '🎯 Basic Info',
        value: 
          `**Name:** ${character.name}\n` +
          `**Class:** ${character.class || 'Unknown'} ${character.subclass ? `(${character.subclass})` : ''}\n` +
          `**Level:** ${character.level || 1}\n` +
          `**Race:** ${character.race || 'Unknown'}\n` +
          `**Background:** ${character.background || 'Unknown'}\n` +
          `**Alignment:** ${character.alignment || 'Unknown'}`,
        inline: true
      },
      {
        name: '💪 Ability Scores',
        value: formatAbilityScores(character.ability_scores || {}),
        inline: true
      },
      {
        name: '⚔️ Combat Stats',
        value: 
          `**HP:** ${character.hp_current || 0}/${character.hp_max || 0}\n` +
          `**AC:** ${character.armor_class || 10}\n` +
          `**Speed:** ${character.speed || 30} ft\n` +
          `**Proficiency Bonus:** +${character.proficiency_bonus || 2}`,
        inline: true
      }
    );

  // Add spell information if available
  if (character.spells && character.spells.length > 0) {
    const spellSlots = character.spell_slots || {};
    embed.addFields({
      name: '🔮 Spellcasting',
      value: 
        `**Spell Save DC:** ${character.spell_save_dc || 0}\n` +
        `**Spell Attack Bonus:** +${character.spell_attack_bonus || 0}\n` +
        `**Spell Slots:** ${formatSpellSlots(spellSlots)}\n` +
        `**Cantrips:** ${character.spells.filter(s => s.level === 0).length} known`,
      inline: false
    });
  }

  // Add equipment summary
  if (character.equipment && character.equipment.length > 0) {
    const items = character.equipment.slice(0, 5).map(item => item.name).join(', ');
    const more = character.equipment.length > 5 ? ` +${character.equipment.length - 5} more` : '';
    embed.addFields({
      name: '🎒 Equipment (showing first 5)',
      value: items + more,
      inline: false
    });
  }

  return embed
    .setFooter({ text: `Last updated: ${new Date(character.updated_at).toLocaleDateString()}` })
    .setTimestamp();
}

/**
 * Generate a section-specific embed
 */
function generateSectionEmbed(character, section) {
  const embed = new EmbedBuilder()
    .setColor(0x4ECDC4)
    .setTitle(`📋 ${character.name} - ${section.charAt(0).toUpperCase() + section.slice(1)}`);

  switch (section) {
    case 'basic':
      embed.setDescription(
        `**Name:** ${character.name}\n` +
        `**Class:** ${character.class || 'Unknown'} ${character.subclass ? `(${character.subclass})` : ''}\n` +
        `**Level:** ${character.level || 1}\n` +
        `**Race:** ${character.race || 'Unknown'}\n` +
        `**Background:** ${character.background || 'Unknown'}\n` +
        `**Alignment:** ${character.alignment || 'Unknown'}\n` +
        `**XP:** ${character.experience_points || 0}\n` +
        `**Inspiration:** ${character.inspiration || 0}`
      );
      break;

    case 'abilities':
      embed.setDescription(formatAbilityScores(character.ability_scores || {}));
      embed.addFields({
        name: 'Saving Throws',
        value: formatSavingThrows(character.saving_throws || {}, character.ability_scores || {}),
        inline: false
      });
      break;

    case 'skills':
      embed.setDescription(formatSkills(character.skills || {}, character.ability_scores || {}));
      break;

    case 'spells':
      embed.setDescription(formatSpells(character.spells || []));
      if (character.spell_slots) {
        embed.addFields({
          name: 'Spell Slots',
          value: formatSpellSlots(character.spell_slots),
          inline: false
        });
      }
      break;

    case 'features':
      embed.setDescription(formatFeatures(character.features || []));
      break;

    case 'equipment':
      embed.setDescription(formatEquipment(character.equipment || []));
      break;

    case 'combat':
      embed.setDescription(
        `**HP:** ${character.hp_current || 0}/${character.hp_max || 0}\n` +
        `**AC:** ${character.armor_class || 10}\n` +
        `**Speed:** ${character.speed || 30} ft\n` +
        `**Initiative:** +${character.initiative_bonus || 0}\n` +
        `**Proficiency Bonus:** +${character.proficiency_bonus || 2}\n` +
        `**Hit Dice:** ${character.hit_dice || '1d6'}\n` +
        `**Death Saves:** ${character.death_saves_success || 0} successes, ${character.death_saves_failure || 0} failures`
      );
      break;
  }

  return embed
    .setFooter({ text: `Last updated: ${new Date(character.updated_at).toLocaleDateString()}` })
    .setTimestamp();
}

/**
 * Format ability scores for display
 */
function formatAbilityScores(scores) {
  const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  const names = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  
  return abilities.map((ability, index) => {
    const score = scores[ability] || 10;
    const modifier = Math.floor((score - 10) / 2);
    const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    return `**${names[index]}:** ${score} (${modStr})`;
  }).join('\n');
}

/**
 * Format saving throws
 */
function formatSavingThrows(saves, scores) {
  const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  const names = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  
  return abilities.map((ability, index) => {
    const score = scores[ability] || 10;
    const modifier = Math.floor((score - 10) / 2);
    const proficiency = saves[ability] || false;
    const total = modifier + (proficiency ? (scores.proficiency_bonus || 2) : 0);
    const profStr = proficiency ? '✓' : ' ';
    return `${profStr} **${names[index]}:** ${total >= 0 ? '+' : ''}${total}`;
  }).join(' • ');
}

/**
 * Format skills for display
 */
function formatSkills(skills, scores) {
  const skillData = [
    { key: 'athletics', ability: 'strength', name: 'Athletics' },
    { key: 'acrobatics', ability: 'dexterity', name: 'Acrobatics' },
    { key: 'sleight_of_hand', ability: 'dexterity', name: 'Sleight of Hand' },
    { key: 'stealth', ability: 'dexterity', name: 'Stealth' },
    { key: 'arcana', ability: 'intelligence', name: 'Arcana' },
    { key: 'history', ability: 'intelligence', name: 'History' },
    { key: 'investigation', ability: 'intelligence', name: 'Investigation' },
    { key: 'nature', ability: 'intelligence', name: 'Nature' },
    { key: 'religion', ability: 'intelligence', name: 'Religion' },
    { key: 'animal_handling', ability: 'wisdom', name: 'Animal Handling' },
    { key: 'insight', ability: 'wisdom', name: 'Insight' },
    { key: 'medicine', ability: 'wisdom', name: 'Medicine' },
    { key: 'perception', ability: 'wisdom', name: 'Perception' },
    { key: 'survival', ability: 'wisdom', name: 'Survival' },
    { key: 'deception', ability: 'charisma', name: 'Deception' },
    { key: 'intimidation', ability: 'charisma', name: 'Intimidation' },
    { key: 'performance', ability: 'charisma', name: 'Performance' },
    { key: 'persuasion', ability: 'charisma', name: 'Persuasion' }
  ];

  return skillData.map(skill => {
    const abilityMod = Math.floor((scores[skill.ability] || 10 - 10) / 2);
    const proficiency = skills[skill.key] || 0; // 0 = none, 1 = proficient, 2 = expertise
    const profBonus = proficiency * (scores.proficiency_bonus || 2);
    const total = abilityMod + profBonus;
    const profStr = proficiency === 2 ? '⭐' : proficiency === 1 ? '✓' : ' ';
    return `${profStr} **${skill.name}:** ${total >= 0 ? '+' : ''}${total}`;
  }).join('\n');
}

/**
 * Format spells for display
 */
function formatSpells(spells) {
  if (spells.length === 0) return 'No spells known';

  const byLevel = {};
  spells.forEach(spell => {
    const level = spell.level || 0;
    if (!byLevel[level]) byLevel[level] = [];
    byLevel[level].push(spell);
  });

  let result = '';
  Object.keys(byLevel).sort().forEach(level => {
    const levelName = level === 0 ? 'Cantrips' : `Level ${level}`;
    const spellNames = byLevel[level].slice(0, 10).map(s => s.name).join(', ');
    const more = byLevel[level].length > 10 ? ` +${byLevel[level].length - 10} more` : '';
    result += `**${levelName}:** ${spellNames}${more}\n`;
  });

  return result;
}

/**
 * Format spell slots
 */
function formatSpellSlots(slots) {
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  return levels.map(level => {
    const current = slots[`level_${level}_current`] || 0;
    const max = slots[`level_${level}_max`] || 0;
    return max > 0 ? `L${level}: ${current}/${max}` : null;
  }).filter(Boolean).join(' • ') || 'No spell slots';
}

/**
 * Format features and traits
 */
function formatFeatures(features) {
  if (features.length === 0) return 'No features or traits';
  
  return features.slice(0, 10).map(feature => {
    return `**${feature.name}:** ${feature.description || 'No description'}`;
  }).join('\n\n') + (features.length > 10 ? `\n\n*...and ${features.length - 10} more features*` : '');
}

/**
 * Format equipment
 */
function formatEquipment(equipment) {
  if (equipment.length === 0) return 'No equipment';
  
  return equipment.slice(0, 15).map(item => {
    const quantity = item.quantity > 1 ? ` (${item.quantity})` : '';
    return `• ${item.name}${quantity}`;
  }).join('\n') + (equipment.length > 15 ? `\n\n*...and ${equipment.length - 15} more items*` : '');
}
