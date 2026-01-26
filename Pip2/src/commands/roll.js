import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Skill to ability mapping
const SKILL_ABILITIES = {
  acrobatics: 'dexterity', animalHandling: 'wisdom', arcana: 'intelligence',
  athletics: 'strength', deception: 'charisma', history: 'intelligence',
  insight: 'wisdom', intimidation: 'charisma', investigation: 'intelligence',
  medicine: 'wisdom', nature: 'intelligence', perception: 'wisdom',
  performance: 'charisma', persuasion: 'charisma', religion: 'intelligence',
  sleightOfHand: 'dexterity', stealth: 'dexterity', survival: 'wisdom'
};

export default {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll dice or make a character check')
    .addStringOption(option =>
      option
        .setName('dice')
        .setDescription('Dice notation (2d6+3) OR check type')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('check')
        .setDescription('Type of check using your character')
        .setRequired(false)
        .addChoices(
          { name: 'Strength Check', value: 'strength' },
          { name: 'Dexterity Check', value: 'dexterity' },
          { name: 'Constitution Check', value: 'constitution' },
          { name: 'Intelligence Check', value: 'intelligence' },
          { name: 'Wisdom Check', value: 'wisdom' },
          { name: 'Charisma Check', value: 'charisma' },
          { name: 'Strength Save', value: 'strength_save' },
          { name: 'Dexterity Save', value: 'dexterity_save' },
          { name: 'Constitution Save', value: 'constitution_save' },
          { name: 'Intelligence Save', value: 'intelligence_save' },
          { name: 'Wisdom Save', value: 'wisdom_save' },
          { name: 'Charisma Save', value: 'charisma_save' },
          { name: 'Initiative', value: 'initiative' },
          { name: 'Perception', value: 'perception' },
          { name: 'Stealth', value: 'stealth' },
          { name: 'Athletics', value: 'athletics' },
          { name: 'Acrobatics', value: 'acrobatics' },
          { name: 'Arcana', value: 'arcana' },
          { name: 'Insight', value: 'insight' },
          { name: 'Persuasion', value: 'persuasion' },
          { name: 'Deception', value: 'deception' },
          { name: 'Intimidation', value: 'intimidation' }
        )
    )
    .addBooleanOption(option =>
      option
        .setName('advantage')
        .setDescription('Roll with advantage')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('disadvantage')
        .setDescription('Roll with disadvantage')
        .setRequired(false)
    ),

  async execute(interaction) {
    const diceInput = interaction.options.getString('dice');
    const checkType = interaction.options.getString('check');
    const advantage = interaction.options.getBoolean('advantage') || false;
    const disadvantage = interaction.options.getBoolean('disadvantage') || false;

    // If check type specified, roll with character modifier
    if (checkType) {
      return await rollCharacterCheck(interaction, checkType, advantage, disadvantage);
    }

    // Otherwise, roll plain dice
    const parsed = parseDiceNotation(diceInput);

    if (!parsed) {
      return await interaction.reply({
        content: '❌ Invalid dice notation! Use format like: `2d6`, `1d20+5`, `3d10-2`\n\nOr use the `check` option for character-based rolls.',
        flags: 64 // ephemeral
      });
    }

    const { count, sides, modifier } = parsed;

    if (count > 100 || sides > 1000) {
      return await interaction.reply({
        content: '❌ Dice limits: max 100 dice, max 1000 sides.',
        flags: 64 // ephemeral
      });
    }

    const rolls = rollDice(count, sides);
    const sum = rolls.reduce((a, b) => a + b, 0);
    const total = sum + modifier;

    const embed = new EmbedBuilder()
      .setColor(0x4ECDC4)
      .setTitle(`🎲 ${interaction.user.displayName} rolled ${diceInput}`)
      .setDescription(
        (rolls.length <= 20 ? `[${rolls.join(', ')}]` : `${count} dice rolled`) +
        `\n\n**Total: ${total}**` +
        (modifier !== 0 ? ` (${sum} ${modifier > 0 ? '+' : ''}${modifier})` : '')
      );

    await interaction.reply({ embeds: [embed] });
  }
};

async function rollCharacterCheck(interaction, checkType, advantage, disadvantage) {
  const character = await getActiveCharacter(interaction.user.id);

  if (!character) {
    return await interaction.reply({
      content: '❌ No active character. Use `/character <name>` to set one, or use plain dice notation.',
      flags: 64 // ephemeral
    });
  }

  // Determine the modifier
  let modifier = 0;
  let checkName = checkType;

  if (checkType.endsWith('_save')) {
    // Saving throw
    const ability = checkType.replace('_save', '');
    modifier = character.saves?.[ability] || character.attribute_mods?.[ability] || 0;
    checkName = `${ability.charAt(0).toUpperCase() + ability.slice(1)} Save`;
  } else if (checkType === 'initiative') {
    modifier = character.initiative || character.attribute_mods?.dexterity || 0;
    checkName = 'Initiative';
  } else if (SKILL_ABILITIES[checkType]) {
    // Skill check
    modifier = character.skills?.[checkType] || character.attribute_mods?.[SKILL_ABILITIES[checkType]] || 0;
    checkName = checkType.replace(/([A-Z])/g, ' $1').trim();
    checkName = checkName.charAt(0).toUpperCase() + checkName.slice(1);
  } else {
    // Ability check
    modifier = character.attribute_mods?.[checkType] || 0;
    checkName = `${checkType.charAt(0).toUpperCase() + checkType.slice(1)} Check`;
  }

  // Roll the d20
  let rolls = [rollDice(1, 20)[0]];
  let roll = rolls[0];
  let rollType = '';

  if (advantage && !disadvantage) {
    const roll2 = rollDice(1, 20)[0];
    rolls.push(roll2);
    roll = Math.max(rolls[0], roll2);
    rollType = ' (Advantage)';
  } else if (disadvantage && !advantage) {
    const roll2 = rollDice(1, 20)[0];
    rolls.push(roll2);
    roll = Math.min(rolls[0], roll2);
    rollType = ' (Disadvantage)';
  }

  const total = roll + modifier;
  const isCrit = roll === 20;
  const isFail = roll === 1;

  const formatMod = (m) => m >= 0 ? `+${m}` : `${m}`;

  const embed = new EmbedBuilder()
    .setColor(isCrit ? 0x2ECC71 : isFail ? 0xE74C3C : 0x4ECDC4)
    .setTitle(`🎲 ${character.character_name} - ${checkName}${rollType}`)
    .setDescription(
      (rolls.length > 1 ? `Rolls: [${rolls.join(', ')}] → **${roll}**\n` : `Roll: **${roll}**\n`) +
      `Modifier: ${formatMod(modifier)}\n\n` +
      `**Total: ${total}**` +
      (isCrit ? ' 🌟 NAT 20!' : '') +
      (isFail ? ' 💀 NAT 1!' : '')
    )
    .setFooter({ text: `${character.class || 'Unknown'} Lv ${character.level}` });

  await interaction.reply({ embeds: [embed] });
}

function parseDiceNotation(notation) {
  const match = notation.match(/^(\d+)d(\d+)([\+\-]\d+)?$/i);
  if (!match) return null;
  return {
    count: parseInt(match[1]),
    sides: parseInt(match[2]),
    modifier: match[3] ? parseInt(match[3]) : 0
  };
}

function rollDice(count, sides) {
  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  return rolls;
}

async function getActiveCharacter(discordUserId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;

  let response = await fetch(
    `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&is_active=eq.true&select=*&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!response.ok) return null;

  let data = await response.json();

  if (data.length === 0) {
    response = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&select=*&order=updated_at.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (response.ok) {
      data = await response.json();
    }
  }

  return data.length > 0 ? data[0] : null;
}
