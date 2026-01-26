import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use an action or ability from your character\'s action list')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Name of the action to use')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('target')
        .setDescription('Target of the action (optional)')
        .setRequired(false)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const discordUserId = interaction.user.id;

    try {
      // Get active character for the user
      const character = await getActiveCharacter(discordUserId);
      
      if (!character) {
        await interaction.respond([]);
        return;
      }

      // Parse actions from character data
      const actions = parseActions(character.raw_dicecloud_data || '{}');
      
      if (!actions || actions.length === 0) {
        await interaction.respond([]);
        return;
      }

      // Filter by what user has typed so far
      const filtered = actions
        .filter(action => action.name && action.name.toLowerCase().includes(focusedValue))
        .slice(0, 25); // Discord limit

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
    await interaction.deferReply();

    const actionName = interaction.options.getString('action');
    const target = interaction.options.getString('target');
    const discordUserId = interaction.user.id;

    try {
      // Get active character for the user
      const character = await getActiveCharacter(discordUserId);
      
      if (!character) {
        return await interaction.editReply({
          content: '❌ You don\'t have an active character set. Use `/character` to set one.',
          flags: 64
        });
      }

      // Parse actions from character data
      const actions = parseActions(character.raw_dicecloud_data || '{}');
      
      if (!actions || actions.length === 0) {
        return await interaction.editReply({
          content: `❌ **${character.character_name}** doesn't have any actions.`,
          flags: 64
        });
      }

      // Find the action (case-insensitive)
      const action = actions.find(a => 
        a.name && a.name.toLowerCase() === actionName.toLowerCase()
      );

      if (!action) {
        return await interaction.editReply({
          content: `❌ Action "**${actionName}**" not found. Use \`/actions\` to see your available actions.`,
          flags: 64
        });
      }

      // Check for action limitations (recharge, limited uses, etc.)
      const limitationCheck = checkActionLimitations(action, character);
      if (!limitationCheck.canUse) {
        return await interaction.editReply({
          content: `❌ ${limitationCheck.reason}`,
          flags: 64
        });
      }

      // Create the use message to send to Roll20
      const useMessage = {
        action: 'use',
        character: character.character_name,
        actionName: action.name,
        actionType: action.actionType,
        target: target,
        user: interaction.user.username,
        timestamp: new Date().toISOString()
      };

      // Send message to Roll20 via webhook
      const webhookUrl = await getWebhookUrl(character);
      
      if (!webhookUrl) {
        return await interaction.editReply({
          content: `❌ No Roll20 webhook found for **${character.character_name}**. Make sure the RollCloud extension is running and connected.`,
          flags: 64
        });
      }

      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(useMessage)
        });

        if (!webhookResponse.ok) {
          throw new Error(`Webhook responded with ${webhookResponse.status}`);
        }

        // Create success embed
        const embed = new EmbedBuilder()
          .setTitle(`⚔️ ${character.character_name} uses ${action.name}`)
          .setColor(getActionColor(action.actionType))
          .setDescription(formatActionDescription(action, target))
          .addFields(
            { name: 'User', value: interaction.user.username, inline: true },
            { name: 'Type', value: action.actionType || 'action', inline: true }
          );

        if (target) {
          embed.addFields({ name: 'Target', value: target, inline: true });
        }

        if (action.recharge && action.recharge !== 'None') {
          embed.addFields({ name: 'Recharge', value: action.recharge, inline: true });
        }

        embed.setFooter({ text: '✅ Sent to Roll20' });

        await interaction.editReply({ embeds: [embed] });

      } catch (webhookError) {
        console.error('Webhook error:', webhookError);
        return await interaction.editReply({
          content: `❌ Failed to send action to Roll20. Make sure the RollCloud extension is running and connected to Roll20.`,
          flags: 64
        });
      }

    } catch (error) {
      console.error('Use command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while using the action. Please try again.',
        flags: 64
      });
    }
  }
};

// Helper functions
async function getActiveCharacter(discordUserId) {
  try {
    // First try direct lookup by discord_user_id
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

    // If no active character, get most recently updated
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

async function getWebhookUrl(character) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_characters?id=eq.${character.id}&select=roll20_webhook_url`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    const data = await response.json();
    return data.length > 0 ? data[0].roll20_webhook_url : null;

  } catch (error) {
    console.error('Error getting webhook URL:', error);
    return null;
  }
}

function checkActionLimitations(action, character) {
  // This is a basic implementation - you could expand this to track actual usage
  if (action.recharge && action.recharge !== 'None') {
    // For recharge actions, we'll assume they're available unless recently used
    // In a real implementation, you'd track last usage time
    return { canUse: true };
  }

  if (action.actionType === 'legendary') {
    // Legendary actions - you might want to track usage per round
    return { canUse: true };
  }

  if (action.actionType === 'lair') {
    // Lair actions - usually once per round, initiative count 20
    return { canUse: true };
  }

  // Default: can use
  return { canUse: true };
}

function getActionColor(actionType) {
  const colors = {
    attack: 0xe74c3c,     // Red
    action: 0x3498db,    // Blue
    feature: 0x2ecc71,   // Green
    legendary: 0xf39c12,  // Orange
    lair: 0x9b59b6,      // Purple
    other: 0x95a5a6      // Gray
  };
  return colors[actionType] || colors.other;
}

function formatActionDescription(action, target) {
  let description = '';
  
  if (action.actionType === 'attack') {
    if (action.damageRoll) description += `💥 **Damage:** ${action.damageRoll}\n`;
    if (action.attackBonus) description += `⚔️ **Attack Bonus:** ${action.attackBonus}\n`;
    if (action.saveDC && action.saveAbility) description += `🛡️ **Save:** ${action.saveAbility} DC ${action.saveDC}\n`;
  }
  
  if (action.range) description += `📏 **Range:** ${action.range}\n`;
  if (action.duration && action.duration !== 'Instantaneous') description += `⏳ **Duration:** ${action.duration}\n`;
  
  if (action.description) {
    description += `📜 **Description:** ${action.description.substring(0, 200)}${action.description.length > 200 ? '...' : ''}\n`;
  }
  
  if (target) {
    description += `🎯 **Target:** ${target}\n`;
  }
  
  if (action.recharge && action.recharge !== 'None') {
    description += `⚡ **Recharge:** ${action.recharge}\n`;
  }
  
  return description || 'No additional details available.';
}
