import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

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
          character_id: character.id,
          action_data: action
        },
        status: 'pending'
      };

      const commandResponse = await fetch(`${SUPABASE_URL}/rest/v1/rollcloud_commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(commandPayload)
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

      await interaction.reply({ embeds: [embed] });

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

  if (action.actionType === 'attack') {
    if (action.damageRoll) description += `**Damage:** ${action.damageRoll}\n`;
    if (action.attackBonus) description += `**Attack Bonus:** ${action.attackBonus}\n`;
    if (action.saveDC && action.saveAbility) description += `**Save:** ${action.saveAbility} DC ${action.saveDC}\n`;
  }

  if (action.range) description += `**Range:** ${action.range}\n`;
  if (action.duration && action.duration !== 'Instantaneous') description += `**Duration:** ${action.duration}\n`;

  if (action.recharge && action.recharge !== 'None') {
    description += `**Recharge:** ${action.recharge}\n`;
  }

  return description || 'Action sent to Roll20.';
}
