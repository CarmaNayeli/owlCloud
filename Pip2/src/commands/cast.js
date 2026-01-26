import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('cast')
    .setDescription('Cast a spell from your character\'s spell list in Roll20')
    .addStringOption(option =>
      option
        .setName('spell')
        .setDescription('Name of the spell to cast')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption(option =>
      option
        .setName('level')
        .setDescription('Spell slot level to use (for upcasting)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(9)
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

      const spells = parseSpells(character.raw_dicecloud_data || '{}');

      if (!spells || spells.length === 0) {
        await interaction.respond([]);
        return;
      }

      const filtered = spells
        .filter(spell => spell.name && spell.name.toLowerCase().includes(focusedValue))
        .slice(0, 25);

      await interaction.respond(
        filtered.map(spell => ({
          name: `${spell.name} (Level ${spell.level || 0})`,
          value: spell.name
        }))
      );
    } catch (error) {
      console.error('Cast autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    const spellName = interaction.options.getString('spell');
    const castLevel = interaction.options.getInteger('level');
    const discordUserId = interaction.user.id;

    try {
      const character = await getActiveCharacter(discordUserId);

      if (!character) {
        return await interaction.reply({
          content: '❌ You don\'t have an active character set. Use `/character` to set one.',
          flags: 64
        });
      }

      const spells = parseSpells(character.raw_dicecloud_data || '{}');

      if (!spells || spells.length === 0) {
        return await interaction.reply({
          content: `❌ **${character.character_name}** doesn't have any spells.`,
          flags: 64
        });
      }

      const spell = spells.find(s =>
        s.name && s.name.toLowerCase() === spellName.toLowerCase()
      );

      if (!spell) {
        return await interaction.reply({
          content: `❌ Spell "**${spellName}**" not found. Use \`/spells\` to see your available spells.`,
          flags: 64
        });
      }

      const spellLevel = parseInt(spell.level) || 0;

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

      // Create cast command in Supabase
      const commandPayload = {
        pairing_id: pairing.id,
        discord_user_id: discordUserId,
        discord_username: interaction.user.username,
        command_type: 'cast',
        action_name: spell.name,
        command_data: {
          spell_name: spell.name,
          spell_level: spellLevel,
          cast_level: castLevel || spellLevel,
          character_name: character.character_name,
          character_id: character.id,
          spell_data: spell
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
        console.error('Failed to create cast command:', commandResponse.status, errorBody);
        console.error('Payload was:', JSON.stringify(commandPayload));
        return await interaction.reply({
          content: `❌ Failed to send spell to extension. (${commandResponse.status})`,
          flags: 64
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`🔮 ${character.character_name} casts ${spell.name}`)
        .setColor(0x9b59b6)
        .setDescription(formatSpellDescription(spell, castLevel))
        .addFields(
          { name: 'Spell Level', value: castLevel ? `Level ${castLevel} (upcast)` : `Level ${spellLevel}`, inline: true }
        )
        .setFooter({ text: '✅ Sent to Roll20' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Cast command error:', error);
      await interaction.reply({
        content: '❌ An error occurred while casting the spell. Please try again.',
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

function parseSpells(rawData) {
  try {
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    return data.spells || [];
  } catch (error) {
    console.error('Error parsing spells:', error);
    return [];
  }
}

function formatSpellDescription(spell, castLevel) {
  let description = '';

  if (spell.castingTime) description += `**Casting Time:** ${spell.castingTime}\n`;
  if (spell.range) description += `**Range:** ${spell.range}\n`;
  if (spell.duration && spell.duration !== 'Instantaneous') description += `**Duration:** ${spell.duration}\n`;
  if (spell.components) description += `**Components:** ${spell.components}\n`;

  if (spell.damageRoll) {
    description += `**Damage:** ${spell.damageRoll}`;
    if (castLevel && parseInt(spell.level) > 0 && castLevel > parseInt(spell.level)) {
      description += ` (upcast to level ${castLevel})`;
    }
    description += '\n';
  }

  if (spell.healingRoll) {
    description += `**Healing:** ${spell.healingRoll}\n`;
  }

  if (spell.saveDC && spell.saveAbility) {
    description += `**Save:** ${spell.saveAbility} DC ${spell.saveDC}\n`;
  }

  return description || 'Spell sent to Roll20.';
}
