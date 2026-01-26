import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// Supabase config - set via environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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
    .setDescription('Roll dice or make ability checks from your character sheet')
    .addStringOption(option =>
      option
        .setName('dice')
        .setDescription('Dice to roll (e.g., 2d6, 1d20+5, 3d10-2) or ability check (e.g., perception, stealth, strength)')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('advantage')
        .setDescription('Roll with advantage or disadvantage')
        .setRequired(false)
        .addChoices(
          { name: 'Advantage', value: 'advantage' },
          { name: 'Disadvantage', value: 'disadvantage' }
        )
    )
    .addStringOption(option =>
      option
        .setName('check_type')
        .setDescription('Type of check (ability, skill, saving throw)')
        .setRequired(false)
        .addChoices(
          { name: 'Ability Check', value: 'ability' },
          { name: 'Skill Check', value: 'skill' },
          { name: 'Saving Throw', value: 'save' },
          { name: 'Attack Roll', value: 'attack' }
        )
    ),

  async execute(interaction) {
    const diceNotation = interaction.options.getString('dice');
    const advantage = interaction.options.getString('advantage');
    const checkType = interaction.options.getString('check_type');

    await interaction.deferReply();

    try {
      // If no dice notation provided, try to roll from character sheet
      if (!diceNotation) {
        const characterData = await getCharacterData(interaction.user.id);
        
        if (!characterData) {
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(0xE74C3C)
              .setTitle('❌ Character Not Found')
              .setDescription('You need to link your character first. Use `/rollcloud [code]` to connect your RollCloud extension, or provide dice notation like `/roll 1d20+5`.')
            ]
          });
          return;
        }

        // Roll a generic d20 check with character's proficiency bonus
        const result = rollCharacterCheck(characterData, { advantage, checkType });
        await interaction.editReply({ embeds: [result.embed] });
        return;
      }

      // Check if it's an ability check/skill/save
      const checkResult = await tryAbilityCheck(interaction.user.id, diceNotation, { advantage, checkType });
      
      if (checkResult.isCheck) {
        await interaction.editReply({ embeds: [checkResult.embed] });
        return;
      }

      // Otherwise, treat as regular dice notation
      const parsed = parseDiceNotation(diceNotation);

      if (!parsed) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Invalid Input')
            .setDescription('Invalid dice notation or unrecognized check. Use format like: `2d6`, `1d20+5`, `3d10-2`, or try ability checks like: `perception`, `strength save`, `stealth`')
          ]
        });
        return;
      }

      const { count, sides, modifier } = parsed;

      // Validate reasonable limits
      if (count > 100) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Too Many Dice')
            .setDescription('Maximum is 100 dice.')
          ]
        });
        return;
      }

      if (sides > 1000) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Too Many Sides')
            .setDescription('Maximum is 1000 sides.')
          ]
        });
        return;
      }

      const rolls = rollDice(count, sides);
      const sum = rolls.reduce((a, b) => a + b, 0);
      const total = sum + modifier;

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`🎲 ${interaction.user.displayName} rolled ${diceNotation}`)
        .setDescription(`**Total: ${total}**`)
        .addFields(
          { name: 'Rolls', value: rolls.length <= 20 ? `[${rolls.join(', ')}]` : `Rolled ${rolls.length} dice (too many to display)`, inline: false },
          { name: 'Sum', value: `**${sum}**${modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : ''}`, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Roll command error:', error);
      
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('❌ Roll Failed')
          .setDescription('Something went wrong while rolling. Please try again later.')
        ]
      });
    }
  },

  // Handle autocomplete for ability checks
  async autocomplete(interaction) {
    try {
      const focusedValue = interaction.options.getFocused();
      const characterData = await getCharacterData(interaction.user.id);

      if (!characterData) {
        await interaction.respond([]);
        return;
      }

      const choices = [];

      // Add ability scores
      const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
      const abilityNames = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
      
      abilities.forEach((ability, index) => {
        if (abilityNames[index].toLowerCase().includes(focusedValue.toLowerCase())) {
          choices.push({ name: `${abilityNames[index]} Check`, value: ability });
          choices.push({ name: `${abilityNames[index]} Save`, value: `${ability} save` });
        }
      });

      // Add skills
      const skills = [
        'athletics', 'acrobatics', 'sleight of hand', 'stealth',
        'arcana', 'history', 'investigation', 'nature', 'religion',
        'animal handling', 'insight', 'medicine', 'perception', 'survival',
        'deception', 'intimidation', 'performance', 'persuasion'
      ];

      skills.forEach(skill => {
        if (skill.toLowerCase().includes(focusedValue.toLowerCase())) {
          choices.push({ name: `${skill.charAt(0).toUpperCase() + skill.slice(1)} Check`, value: skill });
        }
      });

      // Add common dice notations
      const commonDice = ['1d20', '1d20+5', '2d6', '1d8+4', '1d10+2'];
      commonDice.forEach(dice => {
        if (dice.includes(focusedValue.toLowerCase())) {
          choices.push({ name: `${dice} (Dice Roll)`, value: dice });
        }
      });

      await interaction.respond(choices.slice(0, 25));
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  }
};

/**
 * Get character data from DiceCloud via Supabase
 */
async function getCharacterData(discordUserId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured');
  }

  // Find the user's RollCloud connection
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
    `${SUPABASE_URL}/rest/v1/dicecloud_characters?user_id=eq.${dicecloudUserId}&select=*&order=updated_at.desc&limit=1`,
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
 * Try to parse and roll an ability check
 */
async function tryAbilityCheck(discordUserId, input, options = {}) {
  const { advantage, checkType } = options;
  const characterData = await getCharacterData(discordUserId);

  if (!characterData) {
    return { isCheck: false };
  }

  const inputLower = input.toLowerCase();
  
  // Check for saving throws
  if (inputLower.includes('save')) {
    const ability = inputLower.replace(' save', '').trim();
    const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    
    if (abilities.includes(ability)) {
      const result = rollSavingThrow(characterData, ability, { advantage });
      return { isCheck: true, embed: result.embed };
    }
  }

  // Check for ability checks
  const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  if (abilities.includes(inputLower)) {
    const result = rollAbilityCheck(characterData, inputLower, { advantage });
    return { isCheck: true, embed: result.embed };
  }

  // Check for skill checks
  const skills = [
    'athletics', 'acrobatics', 'sleight of hand', 'stealth',
    'arcana', 'history', 'investigation', 'nature', 'religion',
    'animal handling', 'insight', 'medicine', 'perception', 'survival',
    'deception', 'intimidation', 'performance', 'persuasion'
  ];

  if (skills.includes(inputLower)) {
    const result = rollSkillCheck(characterData, inputLower, { advantage });
    return { isCheck: true, embed: result.embed };
  }

  return { isCheck: false };
}

/**
 * Roll a generic character check
 */
function rollCharacterCheck(character, options = {}) {
  const { advantage } = options;
  const proficiencyBonus = character.proficiency_bonus || 2;
  
  const roll1 = Math.floor(Math.random() * 20) + 1;
  const roll2 = Math.floor(Math.random() * 20) + 1;
  
  let finalRoll, rollDescription;
  
  if (advantage === 'advantage') {
    finalRoll = Math.max(roll1, roll2);
    rollDescription = `Advantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
  } else if (advantage === 'disadvantage') {
    finalRoll = Math.min(roll1, roll2);
    rollDescription = `Disadvantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
  } else {
    finalRoll = roll1;
    rollDescription = `Roll: **${finalRoll}**`;
  }

  const total = finalRoll + proficiencyBonus;

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`🎲 ${character.name} makes a check`)
    .setDescription(`${rollDescription} + ${proficiencyBonus} (proficiency) = **${total}**`)
    .addFields(
      { name: 'Check Type', value: 'Generic Ability Check', inline: true },
      { name: 'Proficiency Bonus', value: `+${proficiencyBonus}`, inline: true }
    )
    .setFooter({ text: `${character.name} • D20 Check` })
    .setTimestamp();

  return { embed };
}

/**
 * Roll an ability check
 */
function rollAbilityCheck(character, ability, options = {}) {
  const { advantage } = options;
  const abilityScores = character.ability_scores || {};
  const proficiencyBonus = character.proficiency_bonus || 2;
  
  const score = abilityScores[ability] || 10;
  const modifier = Math.floor((score - 10) / 2);
  
  const roll1 = Math.floor(Math.random() * 20) + 1;
  const roll2 = Math.floor(Math.random() * 20) + 1;
  
  let finalRoll, rollDescription;
  
  if (advantage === 'advantage') {
    finalRoll = Math.max(roll1, roll2);
    rollDescription = `Advantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
  } else if (advantage === 'disadvantage') {
    finalRoll = Math.min(roll1, roll2);
    rollDescription = `Disadvantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
  } else {
    finalRoll = roll1;
    rollDescription = `Roll: **${finalRoll}**`;
  }

  const total = finalRoll + modifier;

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`🎲 ${character.name} - ${ability.charAt(0).toUpperCase() + ability.slice(1)} Check`)
    .setDescription(`${rollDescription} ${modifier >= 0 ? '+' : ''}${modifier} (${ability}) = **${total}**`)
    .addFields(
      { name: 'Ability Score', value: `${score} (${modifier >= 0 ? '+' : ''}${modifier})`, inline: true },
      { name: 'Check Type', value: 'Ability Check', inline: true }
    )
    .setFooter({ text: `${character.name} • ${ability.charAt(0).toUpperCase() + ability.slice(1)} Check` })
    .setTimestamp();

  return { embed };
}

/**
 * Roll a skill check
 */
function rollSkillCheck(character, skill, options = {}) {
  const { advantage } = options;
  const abilityScores = character.ability_scores || {};
  const skills = character.skills || {};
  const proficiencyBonus = character.proficiency_bonus || 2;
  
  // Determine which ability the skill uses
  const skillAbilities = {
    'athletics': 'strength',
    'acrobatics': 'dexterity',
    'sleight of hand': 'dexterity',
    'stealth': 'dexterity',
    'arcana': 'intelligence',
    'history': 'intelligence',
    'investigation': 'intelligence',
    'nature': 'intelligence',
    'religion': 'intelligence',
    'animal handling': 'wisdom',
    'insight': 'wisdom',
    'medicine': 'wisdom',
    'perception': 'wisdom',
    'survival': 'wisdom',
    'deception': 'charisma',
    'intimidation': 'charisma',
    'performance': 'charisma',
    'persuasion': 'charisma'
  };
  
  const ability = skillAbilities[skill] || 'dexterity';
  const abilityScore = abilityScores[ability] || 10;
  const abilityModifier = Math.floor((abilityScore - 10) / 2);
  
  const proficiency = skills[skill] || 0; // 0 = none, 1 = proficient, 2 = expertise
  const profBonus = proficiency * proficiencyBonus;
  const totalModifier = abilityModifier + profBonus;
  
  const roll1 = Math.floor(Math.random() * 20) + 1;
  const roll2 = Math.floor(Math.random() * 20) + 1;
  
  let finalRoll, rollDescription;
  
  if (advantage === 'advantage') {
    finalRoll = Math.max(roll1, roll2);
    rollDescription = `Advantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
  } else if (advantage === 'disadvantage') {
    finalRoll = Math.min(roll1, roll2);
    rollDescription = `Disadvantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
  } else {
    finalRoll = roll1;
    rollDescription = `Roll: **${finalRoll}**`;
  }

  const total = finalRoll + totalModifier;
  const profStr = proficiency === 2 ? '⭐ Expert' : proficiency === 1 ? '✓ Proficient' : '○ Not proficient';

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`🎲 ${character.name} - ${skill.charAt(0).toUpperCase() + skill.slice(1)} Check`)
    .setDescription(`${rollDescription} ${totalModifier >= 0 ? '+' : ''}${totalModifier} = **${total}**`)
    .addFields(
      { name: 'Modifier Breakdown', value: `${abilityModifier >= 0 ? '+' : ''}${abilityModifier} (${ability}) ${profBonus >= 0 ? '+' : ''}${profBonus} (proficiency)`, inline: true },
      { name: 'Proficiency', value: profStr, inline: true },
      { name: 'Skill Type', value: `${ability.charAt(0).toUpperCase() + ability.slice(1)}-based`, inline: true }
    )
    .setFooter({ text: `${character.name} • ${skill.charAt(0).toUpperCase() + skill.slice(1)} Check` })
    .setTimestamp();

  return { embed };
}

/**
 * Roll a saving throw
 */
function rollSavingThrow(character, ability, options = {}) {
  const { advantage } = options;
  const abilityScores = character.ability_scores || {};
  const savingThrows = character.saving_throws || {};
  const proficiencyBonus = character.proficiency_bonus || 2;
  
  const score = abilityScores[ability] || 10;
  const modifier = Math.floor((score - 10) / 2);
  const proficient = savingThrows[ability] || false;
  const profBonus = proficient ? proficiencyBonus : 0;
  const totalModifier = modifier + profBonus;
  
  const roll1 = Math.floor(Math.random() * 20) + 1;
  const roll2 = Math.floor(Math.random() * 20) + 1;
  
  let finalRoll, rollDescription;
  
  if (advantage === 'advantage') {
    finalRoll = Math.max(roll1, roll2);
    rollDescription = `Advantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
  } else if (advantage === 'disadvantage') {
    finalRoll = Math.min(roll1, roll2);
    rollDescription = `Disadvantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
  } else {
    finalRoll = roll1;
    rollDescription = `Roll: **${finalRoll}**`;
  }

  const total = finalRoll + totalModifier;
  const profStr = proficient ? '✓ Proficient' : '○ Not proficient';

  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle(`🛡️ ${character.name} - ${ability.charAt(0).toUpperCase() + ability.slice(1)} Saving Throw`)
    .setDescription(`${rollDescription} ${totalModifier >= 0 ? '+' : ''}${totalModifier} = **${total}**`)
    .addFields(
      { name: 'Modifier Breakdown', value: `${modifier >= 0 ? '+' : ''}${modifier} (${ability}) ${profBonus >= 0 ? '+' : ''}${profBonus} (proficiency)`, inline: true },
      { name: 'Proficiency', value: profStr, inline: true },
      { name: 'Save DC', value: `DC ${total}`, inline: true }
    )
    .setFooter({ text: `${character.name} • ${ability.charAt(0).toUpperCase() + ability.slice(1)} Save` })
    .setTimestamp();

  return { embed };
}
