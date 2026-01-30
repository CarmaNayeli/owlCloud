import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchWithTimeout } from '../utils/fetch-timeout.js';

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
        .setDescription('Dice notation (2d6+3) - leave empty when using check option')
        .setRequired(false)
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
    // CRITICAL: Defer IMMEDIATELY - Discord only gives 3 seconds!
    // Character lookups can take longer, especially with caching/database calls
    await interaction.deferReply();

    const diceInput = interaction.options.getString('dice');
    const checkType = interaction.options.getString('check');
    const advantage = interaction.options.getBoolean('advantage') || false;
    const disadvantage = interaction.options.getBoolean('disadvantage') || false;

    // If check type specified, roll with character modifier
    if (checkType) {
      return await rollCharacterCheck(interaction, checkType, advantage, disadvantage);
    }

    // If no dice input provided, show help
    if (!diceInput) {
      return await interaction.editReply({
        content: '❌ Please provide either:\n• **Dice notation**: `/roll 2d6+3`\n• **Character check**: `/roll check:strength`\n\nUse `/roll help` for more examples.',
        flags: 64 // ephemeral
      });
    }

    // Otherwise, send plain dice roll to extension
    const parsed = parseDiceNotation(diceInput);

    if (!parsed) {
      return await interaction.editReply({
        content: '❌ Invalid dice notation! Use format like: `2d6`, `1d20+5`, `3d10-2`\n\nOr use the `check` option for character-based rolls.',
        flags: 64 // ephemeral
      });
    }

    const { count, sides, modifier } = parsed;

    if (count > 100 || sides > 1000) {
      return await interaction.editReply({
        content: '❌ Dice limits: max 100 dice, max 1000 sides.',
        flags: 64 // ephemeral
      });
    }

    // Send roll command to extension via Supabase
    await sendRollToExtension(interaction, {
      rollString: diceInput,
      count,
      sides,
      modifier,
      advantage,
      disadvantage,
      rollName: `Roll ${diceInput}`,
      checkType: null
    });
  }
};

async function rollCharacterCheck(interaction, checkType, advantage, disadvantage) {
  const character = await getActiveCharacter(interaction.user.id);

  if (!character) {
    return await interaction.editReply({
      content: '❌ No active character. Use `/character <name>` to set one, or use plain dice notation.',
      flags: 64 // ephemeral
    });
  }

  // Determine the modifier and roll name
  let modifier = 0;
  let rollName = checkType;

  if (checkType.endsWith('_save')) {
    // Saving throw
    const ability = checkType.replace('_save', '');
    modifier = character.saves?.[ability] || character.attribute_mods?.[ability] || 0;
    rollName = `${ability.charAt(0).toUpperCase() + ability.slice(1)} Save`;
  } else if (checkType === 'initiative') {
    modifier = character.initiative || character.attribute_mods?.dexterity || 0;
    rollName = 'Initiative';
  } else if (SKILL_ABILITIES[checkType]) {
    // Skill check
    modifier = character.skills?.[checkType] || character.attribute_mods?.[SKILL_ABILITIES[checkType]] || 0;
    rollName = checkType.replace(/([A-Z])/g, ' $1').trim();
    rollName = rollName.charAt(0).toUpperCase() + rollName.slice(1);
  } else {
    // Ability check
    modifier = character.attribute_mods?.[checkType] || 0;
    rollName = `${checkType.charAt(0).toUpperCase() + checkType.slice(1)} Check`;
  }

  // Send character check to extension via Supabase
  await sendRollToExtension(interaction, {
    rollString: `1d20${modifier >= 0 ? '+' : ''}${modifier}`,
    count: 1,
    sides: 20,
    modifier,
    advantage,
    disadvantage,
    rollName: `${character.character_name} - ${rollName}`,
    checkType,
    characterName: character.character_name,
    characterId: character.dicecloud_character_id || character.id,
    notificationColor: character.notification_color || '#3498db'  // Include character's color for Roll20 announcements
  });
}

async function sendRollToExtension(interaction, rollData) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return await interaction.editReply({
      content: '❌ Extension integration not available. Supabase configuration is missing.',
      flags: 64 // ephemeral
    });
  }

  try {
    // Get user's pairing
    const pairingResponse = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/rollcloud_pairings?discord_user_id=eq.${interaction.user.id}&status=eq.connected&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      },
      10000
    );

    if (!pairingResponse.ok) {
      return await interaction.editReply({
        content: '❌ Failed to check extension connection.',
        flags: 64 // ephemeral
      });
    }

    const pairings = await pairingResponse.json();
    
    if (pairings.length === 0) {
      return await interaction.editReply({
        content: '❌ No extension connection found. Use `/rollcloud <code>` to connect your extension.',
        flags: 64 // ephemeral
      });
    }

    const pairing = pairings[0];

    // Create roll command payload
    const commandPayload = {
      pairing_id: pairing.id,
      discord_user_id: interaction.user.id,
      discord_username: interaction.user.username,
      command_type: 'roll',
      action_name: rollData.rollName,
      command_data: {
        roll_string: rollData.rollString,
        roll_name: rollData.rollName,
        check_type: rollData.checkType,
        character_name: rollData.characterName,
        character_id: rollData.characterId,
        advantage: rollData.advantage,
        disadvantage: rollData.disadvantage,
        count: rollData.count,
        sides: rollData.sides,
        modifier: rollData.modifier,
        notification_color: rollData.notificationColor || '#3498db'  // Include character's color for colored Roll20 announcements
      },
      status: 'pending'
    };

    // Call Edge Function to insert and broadcast
    const commandResponse = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/broadcast-command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({ command: commandPayload })
    }, 15000);

    if (!commandResponse.ok) {
      const errorBody = await commandResponse.text().catch(() => 'no body');
      console.error('Failed to create roll command:', commandResponse.status, errorBody);
      console.error('Payload was:', JSON.stringify(commandPayload));
      return await interaction.editReply({
        content: `❌ Failed to send roll to extension. (${commandResponse.status})`,
        flags: 64 // ephemeral
      });
    }

    // Acknowledge the roll command
    const embed = new EmbedBuilder()
      .setColor(0x4ECDC4)
      .setTitle('🎲 Roll Sent to Roll20')
      .setDescription(`**${rollData.rollName}**\n\nThe roll has been sent to your Roll20 extension and will appear in the chat.`)
      .addFields(
        { name: 'Roll Formula', value: rollData.rollString, inline: true },
        { name: 'Character', value: rollData.characterName || 'Plain Dice', inline: true }
      )
      .setFooter({ text: 'RollCloud Extension Integration' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error sending roll to extension:', error);
    await interaction.editReply({
      content: '❌ Failed to send roll to extension. Please try again.',
      flags: 64 // ephemeral
    });
  }
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

  let response = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&is_active=eq.true&select=*&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    },
    10000
  );

  if (!response.ok) return null;

  let data = await response.json();

  if (data.length === 0) {
    response = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&select=*&order=updated_at.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      },
      10000
    );

    if (response.ok) {
      data = await response.json();
    }
  }

  return data.length > 0 ? data[0] : null;
}
