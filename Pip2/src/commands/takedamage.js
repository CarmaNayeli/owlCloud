import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchWithTimeout } from '../utils/fetch-timeout.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('takedamage')
    .setDescription('Apply damage to your character')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Amount of damage to take')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type of damage (optional)')
        .setRequired(false)
        .addChoices(
          { name: 'Acid', value: 'acid' },
          { name: 'Bludgeoning', value: 'bludgeoning' },
          { name: 'Cold', value: 'cold' },
          { name: 'Fire', value: 'fire' },
          { name: 'Force', value: 'force' },
          { name: 'Lightning', value: 'lightning' },
          { name: 'Necrotic', value: 'necrotic' },
          { name: 'Piercing', value: 'piercing' },
          { name: 'Poison', value: 'poison' },
          { name: 'Psychic', value: 'psychic' },
          { name: 'Radiant', value: 'radiant' },
          { name: 'Slashing', value: 'slashing' },
          { name: 'Thunder', value: 'thunder' }
        )
    ),

  async execute(interaction) {
    // CRITICAL: Defer IMMEDIATELY - Discord only gives 3 seconds!
    await interaction.deferReply();

    const amount = interaction.options.getInteger('amount');
    const damageType = interaction.options.getString('type') || 'untyped';
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
        command_type: 'takedamage',
        action_name: `Take Damage: ${amount} ${damageType}`,
        command_data: {
          amount: amount,
          damage_type: damageType,
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
        console.error('Failed to create takedamage command:', commandResponse.status, errorBody);
        return await interaction.editReply({
          content: `❌ Failed to send damage to extension. (${commandResponse.status})`,
          flags: 64
        });
      }

      const damageTypeDisplay = damageType !== 'untyped' ? ` (${damageType})` : '';
      const embed = new EmbedBuilder()
        .setTitle(`💔 ${character.character_name} takes damage`)
        .setColor(0xe74c3c)
        .setDescription(
          `**Damage Taken:** ${amount}${damageTypeDisplay}\n\n${character.character_name} is hurt.`
        )
        .setFooter({ text: 'Damage sent to Roll20' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('TakeDamage command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while applying damage. Please try again.',
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
