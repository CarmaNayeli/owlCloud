import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { fetchWithTimeout } from '../utils/fetch-timeout.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use an action or ability from your character in Roll20')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Name of the action to use')
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

      const actions = parseActions(character.raw_dicecloud_data || '{}');

      if (!actions || actions.length === 0) {
        await interaction.respond([]);
        return;
      }

      const filtered = actions
        .filter(action => action.name && action.name.toLowerCase().includes(focusedValue))
        .slice(0, 25);

      await interaction.respond(
        filtered.map(action => ({
          name: `${action.name} (${action.actionType || 'action'})`,
          value: action.name
        }))
      );
    } catch (error) {
      console.error('Use autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    // CRITICAL: Defer IMMEDIATELY - Discord only gives 3 seconds!
    await interaction.deferReply();

    const actionName = interaction.options.getString('action');
    const discordUserId = interaction.user.id;

    try {
      const character = await getActiveCharacter(discordUserId);

      if (!character) {
        return await interaction.editReply({
          content: '❌ You don\'t have an active character set. Use `/character` to set one.',
          flags: 64
        });
      }

      const actions = parseActions(character.raw_dicecloud_data || '{}');

      if (!actions || actions.length === 0) {
        return await interaction.editReply({
          content: `❌ **${character.character_name}** doesn't have any actions.`,
          flags: 64
        });
      }

      const action = actions.find(a =>
        a.name && a.name.toLowerCase() === actionName.toLowerCase()
      );

      if (!action) {
        return await interaction.editReply({
          content: `❌ Action "**${actionName}**" not found. Use \`/actions\` to see your available actions.`,
          flags: 64
        });
      }

      // Get user's pairing for command queue
      const pairingResponse = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/rollcloud_pairings?discord_user_id=eq.${discordUserId}&status=eq.connected&select=*`,
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
          flags: 64
        });
      }

      const pairings = await pairingResponse.json();

      if (pairings.length === 0) {
        return await interaction.editReply({
          content: '❌ No extension connection found. Use `/rollcloud <code>` to connect your extension.',
          flags: 64
        });
      }

      const pairing = pairings[0];

      // Create action buttons for attack and damage rolls
      const components = buildActionButtons(action, character.character_name, pairing.id, discordUserId);

      // ALWAYS send announcement command to Roll20, regardless of buttons
      // Buttons are for player convenience in Discord, but announcement should always happen
      const commandPayload = {
        pairing_id: pairing.id,
        discord_user_id: discordUserId,
        discord_username: interaction.user.username,
        command_type: 'use',
        action_name: action.name,
        command_data: {
          action: action,
          character_name: character.character_name,
          character_id: character.id,
          notification_color: character.notification_color || '#3498db',  // Include character's color
          has_buttons: components.length > 0  // Tell extension whether buttons are shown in Discord
        },
        status: 'pending'
      };

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
        console.error('Failed to create use command:', commandResponse.status, errorBody);
        return await interaction.editReply({
          content: `❌ Failed to send action to extension. (${commandResponse.status})`,
          flags: 64
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${character.character_name} uses ${action.name}`)
        .setColor(getActionColor(action.actionType))
        .setDescription(formatActionDescription(action))
        .addFields(
          { name: 'Type', value: action.actionType || 'action', inline: true }
        )
        .setFooter({ text: components.length > 0 ? 'Click buttons below to roll attack/damage' : 'Action sent to Roll20' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed], components });

    } catch (error) {
      console.error('Use command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while using the action. Please try again.',
        flags: 64
      });
    }
  }
};

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

function parseActions(rawData) {
  try {
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    return data.actions || [];
  } catch (error) {
    console.error('Error parsing actions:', error);
    return [];
  }
}

function getActionColor(actionType) {
  const colors = {
    attack: 0xe74c3c,
    action: 0x3498db,
    feature: 0x2ecc71,
    legendary: 0xf39c12,
    lair: 0x9b59b6,
    other: 0x95a5a6
  };
  return colors[actionType] || colors.other;
}

function formatActionDescription(action) {
  let description = '';

  // Check both field name variants for compatibility
  const attackRoll = action.attackRoll || action.attackBonus;
  const damageRoll = action.damage || action.damageRoll;

  if (attackRoll) description += `**Attack:** ${attackRoll.includes?.('d') ? attackRoll : `1d20+${attackRoll}`}\n`;
  if (damageRoll) description += `**Damage:** ${damageRoll}${action.damageType ? ` (${action.damageType})` : ''}\n`;
  if (action.saveDC && action.saveAbility) description += `**Save:** ${action.saveAbility} DC ${action.saveDC}\n`;

  if (action.range) description += `**Range:** ${action.range}\n`;
  if (action.duration && action.duration !== 'Instantaneous') description += `**Duration:** ${action.duration}\n`;

  if (action.recharge && action.recharge !== 'None') {
    description += `**Recharge:** ${action.recharge}\n`;
  }

  return description || 'Action sent to Roll20.';
}

/**
 * Build action buttons for attack and damage rolls
 */
function buildActionButtons(action, characterName, pairingId, discordUserId) {
  const rows = [];
  const buttons = [];

  // Check both field name variants for compatibility
  const attackRoll = action.attackRoll || action.attackBonus;
  const damageRoll = action.damage || action.damageRoll;

  // Add attack button if action has attack roll
  if (attackRoll) {
    const attackFormula = attackRoll.includes?.('d') ? attackRoll : `1d20+${attackRoll}`;
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`rollcloud:roll:${action.name} - Attack:${attackFormula}`)
        .setLabel('Attack')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚔️')
    );
  }

  // Add damage button if action has a single damage roll
  if (damageRoll && (!action.damageRolls || !Array.isArray(action.damageRolls) || action.damageRolls.length === 0)) {
    const damageType = action.damageType || 'damage';
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`rollcloud:roll:${action.name} - ${damageType}:${damageRoll}`)
        .setLabel(`Damage${action.damageType ? ` (${action.damageType})` : ''}`)
        .setStyle(ButtonStyle.Danger)
        .setEmoji('💥')
    );
  }

  // Add damage buttons for multiple damage rolls (damageRolls array)
  if (action.damageRolls && Array.isArray(action.damageRolls)) {
    for (const roll of action.damageRolls) {
      if (roll.damage && buttons.length < 5) {
        const damageType = roll.damageType || roll.type || 'damage';
        const label = roll.name || damageType.charAt(0).toUpperCase() + damageType.slice(1);
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`rollcloud:roll:${action.name} - ${damageType}:${roll.damage}`)
            .setLabel(label)
            .setStyle(ButtonStyle.Danger)
            .setEmoji('💥')
        );
      }
    }
  }

  // Add buttons to rows (max 5 per row)
  if (buttons.length > 0) {
    let currentRow = new ActionRowBuilder();
    for (let i = 0; i < buttons.length; i++) {
      if (i > 0 && i % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }
      currentRow.addComponents(buttons[i]);
    }
    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }
  }

  return rows;
}
