import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

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
    const actionName = interaction.options.getString('action');
    const discordUserId = interaction.user.id;

    try {
      const character = await getActiveCharacter(discordUserId);

      if (!character) {
        return await interaction.reply({
          content: '❌ You don\'t have an active character set. Use `/character` to set one.',
          flags: 64
        });
      }

      const actions = parseActions(character.raw_dicecloud_data || '{}');

      if (!actions || actions.length === 0) {
        return await interaction.reply({
          content: `❌ **${character.character_name}** doesn't have any actions.`,
          flags: 64
        });
      }

      const action = actions.find(a =>
        a.name && a.name.toLowerCase() === actionName.toLowerCase()
      );

      if (!action) {
        return await interaction.reply({
          content: `❌ Action "**${actionName}**" not found. Use \`/actions\` to see your available actions.`,
          flags: 64
        });
      }

      // Get user's pairing for command queue
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
        return await interaction.reply({
          content: '❌ Failed to check extension connection.',
          flags: 64
        });
      }

      const pairings = await pairingResponse.json();

      if (pairings.length === 0) {
        return await interaction.reply({
          content: '❌ No extension connection found. Use `/rollcloud <code>` to connect your extension.',
          flags: 64
        });
      }

      const pairing = pairings[0];

      // Get notification color from character data
      const rawData = character.raw_dicecloud_data || {};
      const notificationColor = (typeof rawData === 'object' ? rawData.notificationColor : null) || '#3498db';

      // Create use_action command in Supabase
      const commandPayload = {
        pairing_id: pairing.id,
        discord_user_id: discordUserId,
        discord_username: interaction.user.username,
        command_type: 'use_action',
        action_name: action.name,
        command_data: {
          action_name: action.name,
          action_type: action.actionType || 'action',
          character_name: character.character_name,
          character_id: character.dicecloud_character_id || character.id,
          notification_color: notificationColor,
          action_data: action
        },
        status: 'pending'
      };

      // Call Edge Function to insert and broadcast (same as /roll command)
      const commandResponse = await fetch(`${SUPABASE_URL}/functions/v1/broadcast-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ command: commandPayload })
      });

      if (!commandResponse.ok) {
        const errorBody = await commandResponse.text().catch(() => 'no body');
        console.error('Failed to create use command:', commandResponse.status, errorBody);
        console.error('Payload was:', JSON.stringify(commandPayload));
        return await interaction.reply({
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
        .setFooter({ text: '✅ Sent to Roll20' })
        .setTimestamp();

      // Create action buttons for attack and damage rolls
      const components = buildActionButtons(action, character.character_name, pairing.id, discordUserId);

      await interaction.reply({ embeds: [embed], components });

    } catch (error) {
      console.error('Use command error:', error);
      await interaction.reply({
        content: '❌ An error occurred while using the action. Please try again.',
        flags: 64
      });
    }
  }
};

async function getActiveCharacter(discordUserId) {
  try {
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

  // Add damage button if action has damage roll
  if (damageRoll) {
    const damageType = action.damageType || 'damage';
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`rollcloud:roll:${action.name} - ${damageType}:${damageRoll}`)
        .setLabel(`Damage${action.damageType ? ` (${action.damageType})` : ''}`)
        .setStyle(ButtonStyle.Danger)
        .setEmoji('💥')
    );
  }

  // Add all damage rolls if action has multiple (damageRolls array)
  if (action.damageRolls && Array.isArray(action.damageRolls)) {
    for (const roll of action.damageRolls) {
      if (roll.damage && buttons.length < 5) { // Discord limit is 5 buttons per row
        const damageType = roll.damageType || roll.type || 'damage';
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`rollcloud:roll:${action.name} - ${damageType}:${roll.damage}`)
            .setLabel(roll.name || damageType)
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
