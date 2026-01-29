import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchWithTimeout } from '../utils/fetch-timeout.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('rest')
    .setDescription('Take a short or long rest with your character')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type of rest to take')
        .setRequired(true)
        .addChoices(
          { name: 'Short Rest', value: 'short' },
          { name: 'Long Rest', value: 'long' }
        )
    ),

  async execute(interaction) {
    // CRITICAL: Defer IMMEDIATELY - Discord only gives 3 seconds!
    await interaction.deferReply();

    const restType = interaction.options.getString('type');
    const discordUserId = interaction.user.id;

    try {
      const character = await getActiveCharacter(discordUserId);

      if (!character) {
        return await interaction.editReply({
          content: '❌ You don\'t have an active character set. Use `/character` to set one.',
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

      // Create command payload for broadcast-command
      const commandPayload = {
        pairing_id: pairing.id,
        discord_user_id: discordUserId,
        discord_username: interaction.user.username,
        command_type: 'rest',
        action_name: `${restType} rest`,
        command_data: {
          rest_type: restType,
          character_name: character.character_name,
          character_id: character.id
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
        console.error('Failed to create rest command:', commandResponse.status, errorBody);
        return await interaction.editReply({
          content: `❌ Failed to send rest to extension. (${commandResponse.status})`,
          flags: 64
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`${restType === 'short' ? '☕' : '🛏️'} ${character.character_name} takes a ${restType} rest`)
        .setColor(restType === 'short' ? 0x3498db : 0x9b59b6)
        .setDescription(
          restType === 'short'
            ? '**Short Rest**\n\nSpend hit dice to recover HP and regain short rest abilities.'
            : '**Long Rest**\n\nRecover all HP, spell slots, and abilities. Reset hit dice.'
        )
        .setFooter({ text: 'Rest sent to Roll20' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Rest command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while taking a rest. Please try again.',
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
