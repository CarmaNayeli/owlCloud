import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('rollhere')
    .setDescription('Roll dice in Discord (not Roll20) using Roll20-style notation')
    .addStringOption(option =>
      option
        .setName('dice')
        .setDescription('Dice notation (2d6+3, 1d20, 3d8-2, etc.)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Custom name for the roll (optional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const diceInput = interaction.options.getString('dice');
    const rollName = interaction.options.getString('name') || `Roll ${diceInput}`;

    // Validate dice notation
    const parsed = parseDiceNotation(diceInput);

    if (!parsed) {
      return await interaction.reply({
        content: '❌ Invalid dice notation! Use format like: `2d6`, `1d20+5`, `3d10-2`',
        flags: 64 // ephemeral
      });
    }

    const { count, sides, modifier } = parsed;

    // Check limits
    if (count > 100 || sides > 1000) {
      return await interaction.reply({
        content: '❌ Dice limits: max 100 dice, max 1000 sides.',
        flags: 64 // ephemeral
      });
    }

    // Get active character for context (optional)
    const character = await getActiveCharacter(interaction.user.id);
    const characterName = character?.name || interaction.user.username;

    // Send rollhere command to extension via Supabase
    await sendRollHereToExtension(interaction, {
      rollString: diceInput,
      count,
      sides,
      modifier,
      rollName,
      characterName,
      checkType: null
    });
  }
};

/**
 * Parse dice notation like "2d6+3", "1d20", "3d10-2"
 */
function parseDiceNotation(notation) {
  const match = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;

  const [, count, sides, modifierStr] = match;
  const modifier = modifierStr ? parseInt(modifierStr) : 0;

  return {
    count: parseInt(count),
    sides: parseInt(sides),
    modifier
  };
}

/**
 * Get the active character for the user
 */
async function getActiveCharacter(discordUserId) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&is_active=eq.true&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (response.ok) {
      const characters = await response.json();
      return characters.length > 0 ? characters[0] : null;
    }
  } catch (error) {
    console.error('Error fetching active character:', error);
  }
  return null;
}

/**
 * Send rollhere command to extension via Supabase
 */
async function sendRollHereToExtension(interaction, rollData) {
  try {
    // Get the pairing for this Discord user
    const pairingResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_pairings?discord_user_id=eq.${interaction.user.id}&status=eq.connected&select=id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (!pairingResponse.ok) {
      throw new Error('Failed to get pairing information');
    }

    const pairings = await pairingResponse.json();
    if (pairings.length === 0) {
      return await interaction.reply({
        content: '❌ No active RollCloud connection. Use `/connect` first.',
        flags: 64 // ephemeral
      });
    }

    const pairingId = pairings[0].id;

    // Create command in Supabase for the extension to pick up
    const commandPayload = {
      pairing_id: pairingId,
      command_type: 'rollhere',
      action_name: rollData.rollName,
      command_data: {
        roll_string: rollData.rollString,
        roll_name: rollData.rollName,
        character_name: rollData.characterName,
        count: rollData.count,
        sides: rollData.sides,
        modifier: rollData.modifier,
        check_type: rollData.checkType
      },
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rollcloud_commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(commandPayload)
    });

    if (response.ok) {
      // Acknowledge the command
      await interaction.reply({
        content: `🎲 Rolling ${rollData.rollString} in Discord...`,
        flags: 64 // ephemeral
      });
    } else {
      throw new Error('Failed to create command');
    }
  } catch (error) {
    console.error('Error sending rollhere command:', error);
    await interaction.reply({
      content: '❌ Failed to send roll command. Please try again.',
      flags: 64 // ephemeral
    });
  }
}
