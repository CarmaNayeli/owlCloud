import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createClient } from '@supabase/supabase-js';

// Supabase config - set via environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Create Supabase client for broadcast
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Helper to build topic name
const topicName = (id, short) => `topic:${id}:${short}`;

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
          { name: 'Attack Roll', value: 'attack' },
          { name: 'Spell Attack', value: 'spell_attack' }
        )
    )
    .addStringOption(option =>
      option
        .setName('target')
        .setDescription('Target for attacks or spells (optional)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('force_discord')
        .setDescription('Force Discord-only roll (skip Roll20 integration)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const diceNotation = interaction.options.getString('dice');
    const advantage = interaction.options.getString('advantage');
    const checkType = interaction.options.getString('check_type');
    const target = interaction.options.getString('target');
    const forceDiscord = interaction.options.getBoolean('force_discord') || false;

    await interaction.deferReply();

    try {
      // If no dice notation provided, show help message
      if (!diceNotation) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🎲 Roll Command Help')
            .setDescription('The `dice` parameter is optional! Use the autocomplete or provide dice notation directly.')
            .addFields(
              { name: '🎯 Using Autocomplete (Recommended)', value: 'Type `/roll` and click the dice parameter to see available ability checks from your character', inline: false },
              { name: '📝 Direct Input', value: '`/roll 1d20+5`\n`/roll 2d6`\n`/roll 3d10-2`', inline: false },
              { name: '⚡ Quick Examples', value: '`/roll perception` (use autocomplete)\n`/roll strength save`\n`/roll initiative`', inline: false }
            )
            .setFooter({ text: '💡 Tip: Link your character with `/rollcloud [code]` to use ability checks from your sheet' })
          ]
        });
        return;
      }

      // Check if it's an ability check/skill/save
      const checkResult = await tryAbilityCheck(interaction.user.id, diceNotation, { advantage, checkType });
      
      if (checkResult.isCheck) {
        // Add status message based on force_discord flag and character availability
        if (forceDiscord || !checkResult.character) {
          checkResult.embed.setDescription(`**Rolled in Discord: ${checkResult.result.total}**\n\n${checkResult.embed.description}`);
        } else {
          checkResult.embed.setDescription(`**Roll sent to Roll20**\n\n${checkResult.embed.description}`);
        }
        
        await interaction.editReply({ embeds: [checkResult.embed] });

        // Send real-time message to RollCloud extension (unless forced Discord only)
        if (!forceDiscord && checkResult.character) {
          const rollId = await sendRollToExtension(interaction, {
            type: checkResult.type,
            formula: checkResult.formula,
            result: checkResult.result,
            character: {
              ...checkResult.character,
              target: target
            }
          });

          // Wait for Roll20 response with timeout
          if (rollId) {
            await waitForRoll20Response(interaction, checkResult.result.total, rollId);
          }
        }
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

      // Add status message based on force_discord flag
      if (forceDiscord) {
        embed.setDescription(`**Rolled in Discord: ${total}**\n\n**Total: ${total}**`);
      } else {
        embed.setDescription(`**Roll sent to Roll20**\n\n**Total: ${total}**`);
      }

      await interaction.editReply({ embeds: [embed] });

      // Send real-time message to RollCloud extension (unless forced Discord only)
      if (!forceDiscord) {
        const rollId = await sendRollToExtension(interaction, {
          type: 'dice',
          formula: diceNotation,
          result: {
            total,
            rolls,
            sum,
            modifier
          },
          character: null
        });

        // Wait for Roll20 response with timeout
        if (rollId) {
          await waitForRoll20Response(interaction, total, rollId);
        }
      }

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
      const choices = [];

      // Get stored character options from Supabase
      const storedOptions = await getStoredCharacterOptions(interaction.user.id);
      
      if (storedOptions) {
        // Add ability checks from stored options
        storedOptions.ability_checks.forEach(option => {
          if (option.toLowerCase().includes(focusedValue.toLowerCase())) {
            const ability = option.replace(' Check', '').toLowerCase();
            choices.push({ name: option, value: ability });
          }
        });

        // Add saving throws from stored options
        storedOptions.saving_throws.forEach(option => {
          if (option.toLowerCase().includes(focusedValue.toLowerCase())) {
            const ability = option.replace(' Save', '').toLowerCase();
            choices.push({ name: option, value: `${ability} save` });
          }
        });

        // Add skills from stored options
        storedOptions.skills.forEach(option => {
          if (option.toLowerCase().includes(focusedValue.toLowerCase())) {
            const skill = option.replace(' Check', '').toLowerCase();
            choices.push({ name: option, value: skill });
          }
        });

        // Add attacks from stored options
        storedOptions.attacks.forEach(option => {
          if (option.toLowerCase().includes(focusedValue.toLowerCase())) {
            const weaponName = option.replace('Attack: ', '');
            choices.push({ name: `⚔️ ${option}`, value: `attack:${weaponName}` });
          }
        });

        // Add spell attacks from stored options
        storedOptions.spell_attacks.forEach(option => {
          if (option.toLowerCase().includes(focusedValue.toLowerCase())) {
            const spellName = option.replace('Spell Attack: ', '');
            choices.push({ name: `🔮 ${option}`, value: `spell_attack:${spellName}` });
          }
        });

        // Add special options (like Initiative)
        storedOptions.special.forEach(option => {
          if (option.toLowerCase().includes(focusedValue.toLowerCase())) {
            choices.push({ name: option, value: option.toLowerCase() });
          }
        });
      } else {
        // Fallback to live generation if no stored options
        const characterData = await getCharacterData(interaction.user.id);
        
        if (characterData) {
          // Generate options from character data (existing logic)
          const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
          const abilityNames = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
          
          abilities.forEach((ability, index) => {
            if (abilityNames[index].toLowerCase().includes(focusedValue.toLowerCase())) {
              choices.push({ name: `${abilityNames[index]} Check`, value: `${ability} check` });
              choices.push({ name: `${abilityNames[index]} Save`, value: `${ability} save` });
            }
          });

          const skills = [
            'athletics', 'acrobatics', 'sleight of hand', 'stealth',
            'arcana', 'history', 'investigation', 'nature', 'religion',
            'animal handling', 'insight', 'medicine', 'perception', 'survival',
            'deception', 'intimidation', 'performance', 'persuasion'
          ];

          skills.forEach(skill => {
            if (skill.toLowerCase().includes(focusedValue.toLowerCase())) {
              choices.push({ name: `${skill.charAt(0).toUpperCase() + skill.slice(1)} Check`, value: `${skill} check` });
            }
          });

          // Add Initiative (special case)
          if ('initiative'.includes(focusedValue.toLowerCase())) {
            const initiativeBonus = characterData.initiative_bonus || Math.floor((characterData.ability_scores?.dexterity || 10 - 10) / 2);
            choices.push({ 
              name: `🎯 Initiative (${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus})`, 
              value: 'initiative' 
            });
          }
        }
      }

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
  
  // Check for initiative (special case)
  if (inputLower === 'initiative') {
    const initiativeBonus = characterData.initiative_bonus || Math.floor((characterData.ability_scores?.dexterity || 10 - 10) / 2);
    
    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;
    
    let finalRoll, rollDescription, rolls;
    
    if (advantage === 'advantage') {
      finalRoll = Math.max(roll1, roll2);
      rollDescription = `Advantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
      rolls = [roll1, roll2];
    } else if (advantage === 'disadvantage') {
      finalRoll = Math.min(roll1, roll2);
      rollDescription = `Disadvantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
      rolls = [roll1, roll2];
    } else {
      finalRoll = roll1;
      rollDescription = `Roll: **${finalRoll}**`;
      rolls = [roll1];
    }

    const total = finalRoll + initiativeBonus;

    const embed = new EmbedBuilder()
      .setColor(0xFFD700) // Gold for initiative
      .setTitle(`🎯 ${characterData.name} - Initiative`)
      .setDescription(`${rollDescription} ${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus} = **${total}**`)
      .addFields(
        { name: 'Initiative Bonus', value: `${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus}`, inline: true },
        { name: 'Roll Type', value: 'Initiative Check', inline: true }
      )
      .setFooter({ text: `${characterData.name} • Initiative Roll` })
      .setTimestamp();

    return { 
      isCheck: true, 
      embed: embed,
      type: 'initiative',
      formula: `1d20${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus}(initiative)`,
      result: {
        total: total,
        rolls: rolls,
        modifier: initiativeBonus
      },
      character: {
        name: characterData.name,
        id: characterData.id,
        advantage: advantage || 'normal'
      }
    };
  }
  
  // Check for attack rolls
  if (inputLower.startsWith('attack:')) {
    const weaponName = inputLower.replace('attack:', '').trim();
    const result = rollAttack(characterData, weaponName, { advantage });
    return { 
      isCheck: true, 
      embed: result.embed,
      type: 'attack',
      formula: result.formula,
      result: {
        total: result.total,
        rolls: result.rolls,
        modifier: result.modifier
      },
      character: {
        name: characterData.name,
        id: characterData.id,
        weaponName: weaponName,
        advantage: advantage || 'normal'
      }
    };
  }

  // Check for spell attack rolls
  if (inputLower.startsWith('spell_attack:')) {
    const spellName = inputLower.replace('spell_attack:', '').trim();
    const result = rollSpellAttack(characterData, spellName, { advantage });
    return { 
      isCheck: true, 
      embed: result.embed,
      type: 'spell_attack',
      formula: result.formula,
      result: {
        total: result.total,
        rolls: result.rolls,
        modifier: result.modifier
      },
      character: {
        name: characterData.name,
        id: characterData.id,
        spellName: spellName,
        advantage: advantage || 'normal'
      }
    };
  }

  // Check for saving throws
  if (inputLower.includes('save')) {
    const ability = inputLower.replace(' save', '').trim();
    const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    
    if (abilities.includes(ability)) {
      const result = rollSavingThrow(characterData, ability, { advantage });
      return { 
        isCheck: true, 
        embed: result.embed,
        type: 'saving_throw',
        formula: `1d20${result.modifier >= 0 ? '+' : ''}${result.modifier}(${ability} save)`,
        result: {
          total: result.total,
          rolls: result.rolls,
          modifier: result.modifier
        },
        character: {
          name: characterData.name,
          id: characterData.id,
          ability: ability,
          advantage: advantage || 'normal'
        }
      };
    }
  }

  // Check for ability checks
  const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  
  // Handle both "wisdom" and "wisdom check" formats
  let abilityName = inputLower;
  if (inputLower.includes(' check')) {
    abilityName = inputLower.replace(' check', '').trim();
  }
  
  if (abilities.includes(abilityName)) {
    const result = rollAbilityCheck(characterData, inputLower, { advantage });
    return { 
      isCheck: true, 
      embed: result.embed,
      type: 'ability_check',
      formula: `1d20${result.modifier >= 0 ? '+' : ''}${result.modifier}(${inputLower})`,
      result: {
        total: result.total,
        rolls: result.rolls,
        modifier: result.modifier
      },
      character: {
        name: characterData.name,
        id: characterData.id,
        ability: inputLower,
        advantage: advantage || 'normal'
      }
    };
  }

  // Check for skill checks
  const skills = [
    'athletics', 'acrobatics', 'sleight of hand', 'stealth',
    'arcana', 'history', 'investigation', 'nature', 'religion',
    'animal handling', 'insight', 'medicine', 'perception', 'survival',
    'deception', 'intimidation', 'performance', 'persuasion'
  ];

  // Handle both "perception" and "perception check" formats
  let skillName = inputLower;
  if (inputLower.includes(' check')) {
    skillName = inputLower.replace(' check', '').trim();
  }

  if (skills.includes(skillName)) {
    const result = rollSkillCheck(characterData, inputLower, { advantage });
    return { 
      isCheck: true, 
      embed: result.embed,
      type: 'skill_check',
      formula: `1d20${result.modifier >= 0 ? '+' : ''}${result.modifier}(${inputLower})`,
      result: {
        total: result.total,
        rolls: result.rolls,
        modifier: result.modifier
      },
      character: {
        name: characterData.name,
        id: characterData.id,
        skill: inputLower,
        advantage: advantage || 'normal'
      }
    };
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
  
  let finalRoll, rollDescription, rolls;
  
  if (advantage === 'advantage') {
    finalRoll = Math.max(roll1, roll2);
    rollDescription = `Advantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
    rolls = [roll1, roll2];
  } else if (advantage === 'disadvantage') {
    finalRoll = Math.min(roll1, roll2);
    rollDescription = `Disadvantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
    rolls = [roll1, roll2];
  } else {
    finalRoll = roll1;
    rollDescription = `Roll: **${finalRoll}**`;
    rolls = [roll1];
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

  return { embed, total, rolls, modifier: proficiencyBonus };
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
  
  let finalRoll, rollDescription, rolls;
  
  if (advantage === 'advantage') {
    finalRoll = Math.max(roll1, roll2);
    rollDescription = `Advantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
    rolls = [roll1, roll2];
  } else if (advantage === 'disadvantage') {
    finalRoll = Math.min(roll1, roll2);
    rollDescription = `Disadvantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
    rolls = [roll1, roll2];
  } else {
    finalRoll = roll1;
    rollDescription = `Roll: **${finalRoll}**`;
    rolls = [roll1];
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

  return { embed, total, rolls, modifier };
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
  
  let finalRoll, rollDescription, rolls;
  
  if (advantage === 'advantage') {
    finalRoll = Math.max(roll1, roll2);
    rollDescription = `Advantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
    rolls = [roll1, roll2];
  } else if (advantage === 'disadvantage') {
    finalRoll = Math.min(roll1, roll2);
    rollDescription = `Disadvantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
    rolls = [roll1, roll2];
  } else {
    finalRoll = roll1;
    rollDescription = `Roll: **${finalRoll}**`;
    rolls = [roll1];
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

  return { embed, total, rolls, modifier: totalModifier };
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
  
  let finalRoll, rollDescription, rolls;
  
  if (advantage === 'advantage') {
    finalRoll = Math.max(roll1, roll2);
    rollDescription = `Advantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
    rolls = [roll1, roll2];
  } else if (advantage === 'disadvantage') {
    finalRoll = Math.min(roll1, roll2);
    rollDescription = `Disadvantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
    rolls = [roll1, roll2];
  } else {
    finalRoll = roll1;
    rollDescription = `Roll: **${finalRoll}**`;
    rolls = [roll1];
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

  return { embed, total, rolls, modifier: totalModifier };
}

/**
 * Send roll data to RollCloud extension via Supabase broadcast
 */
async function sendRollToExtension(interaction, rollData) {
  try {
    // Get the user's RollCloud pairing
    const pairingResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_pairings?discord_user_id=eq.${interaction.user.id}&status=eq.connected&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (!pairingResponse.ok) {
      console.error('Failed to lookup user pairing for roll');
      return null;
    }

    const pairings = await pairingResponse.json();
    
    if (pairings.length === 0) {
      console.log('No RollCloud pairing found for user, skipping extension notification');
      return null;
    }

    const pairing = pairings[0];

    // Get character data to include Meteor ID
    let meteorCharacterId = null;
    if (rollData.character?.id) {
      const characterResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/dicecloud_characters?id=eq.${rollData.character.id}&select=meteor_character_id`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          }
        }
      );
      
      if (characterResponse.ok) {
        const characters = await characterResponse.json();
        if (characters.length > 0) {
          meteorCharacterId = characters[0].meteor_character_id;
        }
      }
    }

    // Create broadcast channel for this pairing's rolls
    const channel = supabase.channel(topicName(pairing.id, 'rolls'), {
      config: { 
        broadcast: { 
          self: true, 
          ack: true 
        }, 
        private: true 
      }
    });

    // Prepare roll payload
    const rollPayload = {
      id: crypto.randomUUID(), // Generate unique ID for this roll
      pairing_id: pairing.id,
      discord_user_id: interaction.user.id,
      discord_username: interaction.user.displayName,
      discord_message_id: interaction.id,
      roll_type: rollData.type,
      roll_formula: rollData.formula,
      roll_result: rollData.result,
      character_name: rollData.character?.name || null,
      character_id: rollData.character?.id || null,
      meteor_character_id: meteorCharacterId,
      ability_score: rollData.character?.ability || rollData.character?.skill || null,
      skill_name: rollData.character?.skill || null,
      spell_name: rollData.character?.spellName || null,
      weapon_name: rollData.character?.weaponName || null,
      advantage_type: rollData.character?.advantage || 'normal',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    // Subscribe to channel and send broadcast
    return new Promise((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to ${channel.topic}`);
          
          // Send the roll broadcast
          channel.send({
            type: 'broadcast',
            event: 'INSERT',
            payload: rollPayload
          }).then(resp => {
            console.log('🎲 Roll broadcast sent:', resp);
            console.log(`🎲 Roll sent to extension: ${rollData.formula} = ${rollData.result.total} (ID: ${rollPayload.id})`);
            resolve(rollPayload.id);
          }).catch(error => {
            console.error('Failed to send roll broadcast:', error);
            resolve(null);
          });
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel error, falling back to REST');
          resolve(sendRollToExtensionREST(interaction, rollData, pairing, meteorCharacterId));
        }
      });
    });

  } catch (error) {
    console.error('Error sending roll to extension via broadcast:', error);
    return null;
  }
}

/**
 * Fallback REST method for sending roll data
 */
async function sendRollToExtensionREST(interaction, rollData, pairing, meteorCharacterId) {
  try {
    // Insert roll data into Supabase via REST
    const rollInsert = {
      pairing_id: pairing.id,
      discord_user_id: interaction.user.id,
      discord_username: interaction.user.displayName,
      discord_message_id: interaction.id,
      roll_type: rollData.type,
      roll_formula: rollData.formula,
      roll_result: rollData.result,
      character_name: rollData.character?.name || null,
      character_id: rollData.character?.id || null,
      meteor_character_id: meteorCharacterId,
      ability_score: rollData.character?.ability || rollData.character?.skill || null,
      skill_name: rollData.character?.skill || null,
      spell_name: rollData.character?.spellName || null,
      weapon_name: rollData.character?.weaponName || null,
      advantage_type: rollData.character?.advantage || 'normal',
      status: 'pending'
    };

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_rolls`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(rollInsert)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to insert roll data via REST:', error);
      return null;
    }

    const result = await response.json();
    const rollId = result[0].id;
    console.log(`🎲 Roll sent via REST fallback: ${rollData.formula} = ${rollData.result.total} (ID: ${rollId})`);

    // Update pairing activity
    await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_pairings?id=eq.${pairing.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
          last_activity: new Date().toISOString()
        })
      }
    );

    return rollId;

  } catch (error) {
    console.error('Error sending roll to extension via REST:', error);
    return null;
  }
}

/**
 * Wait for Roll20 response with timeout fallback
 */
async function waitForRoll20Response(interaction, originalTotal) {
  const timeout = 30000; // 30 seconds timeout
  const startTime = Date.now();
  
  // Get the roll ID from the interaction (we'll need to modify sendRollToExtension to return this)
  let rollId = null;
  
  const checkInterval = setInterval(async () => {
    try {
      // Query Supabase for the roll status
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/rollcloud_rolls?discord_message_id=eq.${interaction.id}&select=*&order=created_at.desc&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          }
        }
      );

      if (response.ok) {
        const rolls = await response.json();
        if (rolls.length > 0) {
          const roll = rolls[0];
          
          if (roll.status === 'delivered' && roll.roll20_result) {
            // Roll20 processed successfully
            clearInterval(checkInterval);
            console.log(`✅ Roll20 response received for roll ${roll.id}`);
            
            // Update Discord message with Roll20 result
            await updateDiscordMessageWithRoll20Result(interaction, roll.roll20_result, originalTotal);
            return;
          }
          
          if (roll.status === 'failed' || roll.status === 'timeout') {
            // Roll20 failed, show fallback
            clearInterval(checkInterval);
            console.log(`❌ Roll20 failed for roll ${roll.id}: ${roll.error_message}`);
            
            await updateDiscordMessageWithFallback(interaction, roll.error_message || 'Roll20 integration failed');
            return;
          }
        }
      }
      
      // Check timeout
      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        console.log(`⏰ Roll20 timeout for roll ${interaction.id}`);
        
        // Mark as timeout in database
        await markRollAsTimeout(interaction.id);
        
        await updateDiscordMessageWithFallback(interaction, 'Roll20 integration timed out - using Discord roll result');
      }
    } catch (error) {
      console.error('Error checking Roll20 response:', error);
    }
  }, 1000); // Check every second
}

/**
 * Update Discord message with Roll20 result
 */
async function updateDiscordMessageWithRoll20Result(interaction, roll20Result, originalTotal) {
  try {
    const embed = new EmbedBuilder()
      .setColor(0x00FF00) // Green for success
      .setTitle(`🎲 ${interaction.user.displayName} - Roll20 Result`)
      .setDescription(`**Roll20 Total: ${roll20Result.total}**`)
      .addFields(
        { name: 'Discord Roll', value: `**${originalTotal}**`, inline: true },
        { name: 'Roll20 Roll', value: `**${roll20Result.total}**`, inline: true },
        { name: 'Roll20 Formula', value: roll20Result.formula || 'N/A', inline: false }
      )
      .setFooter({ text: 'Roll20 integration successful' })
      .setTimestamp();

    if (roll20Result.rolls) {
      embed.addFields({
        name: 'Roll20 Dice',
        value: `[${roll20Result.rolls.join(', ')}]`,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error updating Discord message with Roll20 result:', error);
  }
}

/**
 * Update Discord message with fallback message
 */
async function updateDiscordMessageWithFallback(interaction, fallbackMessage) {
  try {
    const embed = new EmbedBuilder()
      .setColor(0xFFA500) // Orange for warning
      .setTitle(`🎲 ${interaction.user.displayName} - Rolled in Discord`)
      .setDescription(`**Rolled in Discord (Roll20 unavailable)**\n\n${fallbackMessage}`)
      .setFooter({ text: 'Roll20 integration failed - using Discord roll result' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error updating Discord message with fallback:', error);
  }
}

/**
 * Mark roll as timeout in database
 */
async function markRollAsTimeout(discordMessageId) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_rolls?discord_message_id=eq.${discordMessageId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
          status: 'timeout',
          error_message: 'Roll20 integration timed out after 30 seconds'
        })
      }
    );
  } catch (error) {
    console.error('Error marking roll as timeout:', error);
  }
}

/**
 * Get stored character options from Supabase
 */
async function getStoredCharacterOptions(discordUserId) {
  try {
    // Get the user's RollCloud pairing
    const pairingResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_pairings?discord_user_id=eq.${discordUserId}&status=eq.connected&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (!pairingResponse.ok) {
      console.error('Failed to lookup user pairing for autocomplete options');
      return null;
    }

    const pairings = await pairingResponse.json();
    
    if (pairings.length === 0) {
      return null;
    }

    const pairing = pairings[0];

    // Get stored character options
    const optionsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_character_options?pairing_id=eq.${pairing.id}&status=eq.active&select=*&order=updated_at.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (!optionsResponse.ok) {
      console.error('Failed to lookup stored character options');
      return null;
    }

    const options = await optionsResponse.json();
    return options.length > 0 ? options[0] : null;

  } catch (error) {
    console.error('Error getting stored character options:', error);
    return null;
  }
}

/**
 * Store character options in Supabase for autocomplete
 */
async function storeCharacterOptions(pairingId, characterData) {
  try {
    // Generate options from character data
    const abilityScores = characterData.ability_scores || {};
    const skills = characterData.skills || {};
    const equipment = characterData.equipment || [];
    const spells = characterData.spells || [];
    
    // Generate ability checks
    const abilityNames = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
    const abilityChecks = abilityNames.map(name => `${name} Check`);
    
    // Generate saving throws
    const savingThrows = abilityNames.map(name => `${name} Save`);
    
    // Generate skill checks
    const skillList = [
      'athletics', 'acrobatics', 'sleight of hand', 'stealth',
      'arcana', 'history', 'investigation', 'nature', 'religion',
      'animal handling', 'insight', 'medicine', 'perception', 'survival',
      'deception', 'intimidation', 'performance', 'persuasion'
    ];
    const skillChecks = skillList.map(skill => `${skill.charAt(0).toUpperCase() + skill.slice(1)} Check`);
    
    // Generate attacks
    const weapons = equipment.filter(item => 
      item.type === 'weapon' || item.name.toLowerCase().includes('sword') || 
      item.name.toLowerCase().includes('axe') || item.name.toLowerCase().includes('bow')
    );
    const attacks = weapons.map(weapon => `Attack: ${weapon.name}`);
    
    // Generate spell attacks
    const attackSpells = spells.filter(spell => spell.damage || spell.level > 0);
    const spellAttacks = attackSpells.map(spell => `Spell Attack: ${spell.name}`);
    
    // Generate special options
    const initiativeBonus = characterData.initiative_bonus || Math.floor((abilityScores.dexterity || 10 - 10) / 2);
    const special = [`Initiative (${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus})`];

    // Check if options already exist
    const existingResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_character_options?pairing_id=eq.${pairingId}&character_id=eq.${characterData.id}&select=id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    const optionsData = {
      pairing_id: pairingId,
      character_id: characterData.id,
      character_name: characterData.name,
      meteor_character_id: characterData.meteor_character_id,
      ability_checks: abilityChecks,
      saving_throws: savingThrows,
      skills: skillChecks,
      attacks: attacks,
      spell_attacks: spellAttacks,
      special: special,
      updated_at: new Date().toISOString()
    };

    if (existingResponse.ok) {
      const existing = await existingResponse.json();
      
      if (existing.length > 0) {
        // Update existing options
        await fetch(
          `${SUPABASE_URL}/rest/v1/rollcloud_character_options?id=eq.${existing[0].id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            },
            body: JSON.stringify(optionsData)
          }
        );
      } else {
        // Insert new options
        await fetch(
          `${SUPABASE_URL}/rest/v1/rollcloud_character_options`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            },
            body: JSON.stringify(optionsData)
          }
        );
      }
    }

    console.log(`✅ Stored character options for ${characterData.name}`);

  } catch (error) {
    console.error('Error storing character options:', error);
  }
}

// Export the storeCharacterOptions function for use in other commands
export { storeCharacterOptions };

/**
 * Roll an attack with a weapon
 */
function rollAttack(character, weaponName, options = {}) {
  const { advantage } = options;
  const abilityScores = character.ability_scores || {};
  const proficiencyBonus = character.proficiency_bonus || 2;
  
  // Find the weapon in equipment
  const weapon = character.equipment?.find(item => 
    item.name.toLowerCase().includes(weaponName.toLowerCase())
  );
  
  if (!weapon) {
    // Default to strength-based attack if weapon not found
    const strengthMod = Math.floor((abilityScores.strength || 10 - 10) / 2);
    const attackBonus = strengthMod + proficiencyBonus;
    
    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;
    
    let finalRoll, rollDescription, rolls;
    
    if (advantage === 'advantage') {
      finalRoll = Math.max(roll1, roll2);
      rollDescription = `Advantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
      rolls = [roll1, roll2];
    } else if (advantage === 'disadvantage') {
      finalRoll = Math.min(roll1, roll2);
      rollDescription = `Disadvantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
      rolls = [roll1, roll2];
    } else {
      finalRoll = roll1;
      rollDescription = `Roll: **${finalRoll}**`;
      rolls = [roll1];
    }

    const total = finalRoll + attackBonus;

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle(`⚔️ ${character.name} - ${weaponName} Attack`)
      .setDescription(`${rollDescription} ${attackBonus >= 0 ? '+' : ''}${attackBonus} = **${total}**`)
      .addFields(
        { name: 'Attack Bonus', value: `${strengthMod >= 0 ? '+' : ''}${strengthMod} (STR) + ${proficiencyBonus} (prof)`, inline: true },
        { name: 'Weapon', value: weaponName, inline: true }
      )
      .setFooter({ text: `${character.name} • Attack Roll` })
      .setTimestamp();

    return { 
      embed, 
      total, 
      rolls, 
      modifier: attackBonus,
      formula: `1d20${attackBonus >= 0 ? '+' : ''}${attackBonus}(${weaponName} attack)`
    };
  }

  // Use weapon properties if found
  const ability = weapon.ability || 'strength';
  const abilityMod = Math.floor((abilityScores[ability] || 10 - 10) / 2);
  const attackBonus = abilityMod + proficiencyBonus + (weapon.attack_bonus || 0);
  
  const roll1 = Math.floor(Math.random() * 20) + 1;
  const roll2 = Math.floor(Math.random() * 20) + 1;
  
  let finalRoll, rollDescription, rolls;
  
  if (advantage === 'advantage') {
    finalRoll = Math.max(roll1, roll2);
    rollDescription = `Advantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
    rolls = [roll1, roll2];
  } else if (advantage === 'disadvantage') {
    finalRoll = Math.min(roll1, roll2);
    rollDescription = `Disadvantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
    rolls = [roll1, roll2];
  } else {
    finalRoll = roll1;
    rollDescription = `Roll: **${finalRoll}**`;
    rolls = [roll1];
  }

  const total = finalRoll + attackBonus;

  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle(`⚔️ ${character.name} - ${weapon.name} Attack`)
    .setDescription(`${rollDescription} ${attackBonus >= 0 ? '+' : ''}${attackBonus} = **${total}**`)
    .addFields(
      { name: 'Attack Bonus', value: `${abilityMod >= 0 ? '+' : ''}${abilityMod} (${ability.toUpperCase()}) + ${proficiencyBonus} (prof)${weapon.attack_bonus ? ` + ${weapon.attack_bonus}` : ''}`, inline: true },
      { name: 'Damage', value: weapon.damage || 'N/A', inline: true },
      { name: 'Properties', value: weapon.properties || 'None', inline: true }
    )
    .setFooter({ text: `${character.name} • Attack Roll` })
    .setTimestamp();

  return { 
    embed, 
    total, 
    rolls, 
    modifier: attackBonus,
    formula: `1d20${attackBonus >= 0 ? '+' : ''}${attackBonus}(${weapon.name} attack)`
  };
}

/**
 * Roll a spell attack
 */
function rollSpellAttack(character, spellName, options = {}) {
  const { advantage } = options;
  const abilityScores = character.ability_scores || {};
  const proficiencyBonus = character.proficiency_bonus || 2;
  
  // Find the spell
  const spell = character.spells?.find(s => 
    s.name.toLowerCase().includes(spellName.toLowerCase())
  );
  
  if (!spell) {
    // Default to spellcasting ability if spell not found
    const spellcastingAbility = character.spellcasting_ability || 'intelligence';
    const abilityMod = Math.floor((abilityScores[spellcastingAbility] || 10 - 10) / 2);
    const attackBonus = abilityMod + proficiencyBonus + (character.spell_attack_bonus || 0);
    
    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;
    
    let finalRoll, rollDescription, rolls;
    
    if (advantage === 'advantage') {
      finalRoll = Math.max(roll1, roll2);
      rollDescription = `Advantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
      rolls = [roll1, roll2];
    } else if (advantage === 'disadvantage') {
      finalRoll = Math.min(roll1, roll2);
      rollDescription = `Disadvantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
      rolls = [roll1, roll2];
    } else {
      finalRoll = roll1;
      rollDescription = `Roll: **${finalRoll}**`;
      rolls = [roll1];
    }

    const total = finalRoll + attackBonus;

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(`🔮 ${character.name} - ${spellName} Spell Attack`)
      .setDescription(`${rollDescription} ${attackBonus >= 0 ? '+' : ''}${attackBonus} = **${total}**`)
      .addFields(
        { name: 'Attack Bonus', value: `${abilityMod >= 0 ? '+' : ''}${abilityMod} (${spellcastingAbility.toUpperCase()}) + ${proficiencyBonus} (prof)`, inline: true },
        { name: 'Spell Level', value: spell?.level || 'Unknown', inline: true }
      )
      .setFooter({ text: `${character.name} • Spell Attack` })
      .setTimestamp();

    return { 
      embed, 
      total, 
      rolls, 
      modifier: attackBonus,
      formula: `1d20${attackBonus >= 0 ? '+' : ''}${attackBonus}(${spellName} spell attack)`
    };
  }

  // Use spell properties if found
  const spellcastingAbility = spell.spellcasting_ability || character.spellcasting_ability || 'intelligence';
  const abilityMod = Math.floor((abilityScores[spellcastingAbility] || 10 - 10) / 2);
  const attackBonus = abilityMod + proficiencyBonus + (character.spell_attack_bonus || 0);
  
  const roll1 = Math.floor(Math.random() * 20) + 1;
  const roll2 = Math.floor(Math.random() * 20) + 1;
  
  let finalRoll, rollDescription, rolls;
  
  if (advantage === 'advantage') {
    finalRoll = Math.max(roll1, roll2);
    rollDescription = `Advantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
    rolls = [roll1, roll2];
  } else if (advantage === 'disadvantage') {
    finalRoll = Math.min(roll1, roll2);
    rollDescription = `Disadvantage: [${roll1}, ${roll2}] → **${finalRoll}**`;
    rolls = [roll1, roll2];
  } else {
    finalRoll = roll1;
    rollDescription = `Roll: **${finalRoll}**`;
    rolls = [roll1];
  }

  const total = finalRoll + attackBonus;

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`🔮 ${character.name} - ${spell.name} Spell Attack`)
    .setDescription(`${rollDescription} ${attackBonus >= 0 ? '+' : ''}${attackBonus} = **${total}**`)
    .addFields(
      { name: 'Attack Bonus', value: `${abilityMod >= 0 ? '+' : ''}${abilityMod} (${spellcastingAbility.toUpperCase()}) + ${proficiencyBonus} (prof)`, inline: true },
      { name: 'Spell Level', value: spell.level || 'Cantrip', inline: true },
      { name: 'Damage', value: spell.damage || 'N/A', inline: true }
    )
    .setFooter({ text: `${character.name} • Spell Attack` })
    .setTimestamp();

  return { 
    embed, 
    total, 
    rolls, 
    modifier: attackBonus,
    formula: `1d20${attackBonus >= 0 ? '+' : ''}${attackBonus}(${spell.name} spell attack)`
  };
}
