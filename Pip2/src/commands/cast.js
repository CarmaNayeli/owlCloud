import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { fetchWithTimeout } from '../utils/fetch-timeout.js';

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
    // CRITICAL: Defer IMMEDIATELY - Discord only gives 3 seconds!
    await interaction.deferReply();

    const spellName = interaction.options.getString('spell');
    const castLevel = interaction.options.getInteger('level');
    const discordUserId = interaction.user.id;

    try {
      const character = await getActiveCharacter(discordUserId);

      if (!character) {
        return await interaction.editReply({
          content: '❌ You don\'t have an active character set. Use `/character` to set one.',
          flags: 64
        });
      }

      const spells = parseSpells(character.raw_dicecloud_data || '{}');

      if (!spells || spells.length === 0) {
        return await interaction.editReply({
          content: `❌ **${character.character_name}** doesn't have any spells.`,
          flags: 64
        });
      }

      const spell = spells.find(s =>
        s.name && s.name.toLowerCase() === spellName.toLowerCase()
      );

      if (!spell) {
        return await interaction.editReply({
          content: `❌ Spell "**${spellName}**" not found. Use \`/spells\` to see your available spells.`,
          flags: 64
        });
      }

      const spellLevel = parseInt(spell.level) || 0;

      // Validate upcast level - cantrips (level 0) cannot be upcast
      if (castLevel && spellLevel === 0) {
        return await interaction.editReply({
          content: `❌ **${spell.name}** is a cantrip and cannot be upcast.`,
          flags: 64
        });
      }

      // Validate cast level is at least spell level
      if (castLevel && castLevel < spellLevel) {
        return await interaction.editReply({
          content: `❌ Cannot cast **${spell.name}** (Level ${spellLevel}) at a lower level (${castLevel}).`,
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

      // Create spell buttons for attack and damage rolls FIRST to determine if we need them
      const components = buildSpellButtons(spell, character.character_name, pairing.id, discordUserId);

      // ALWAYS send announcement command to Roll20, regardless of buttons
      // Buttons are for player convenience in Discord, but announcement should always happen
      const commandPayload = {
        pairing_id: pairing.id,
        discord_user_id: discordUserId,
        discord_username: interaction.user.username,
        command_type: 'cast',
        action_name: spell.name,
        command_data: {
          spell: spell,
          cast_level: castLevel,
          spell_level: spellLevel,
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
        console.error('Failed to create cast command:', commandResponse.status, errorBody);
        return await interaction.editReply({
          content: `❌ Failed to send spell to extension. (${commandResponse.status})`,
          flags: 64
        });
      }

      // Build title with tags
      let titleTags = '';
      if (spell.concentration) titleTags += ' 🧠 Concentration';
      if (spell.ritual) titleTags += ' 📖 Ritual';

      // Build spell level text with school
      let levelText = spellLevel === 0 ? 'Cantrip' : `Level ${spellLevel}`;
      if (castLevel && castLevel > spellLevel) {
        levelText = `Level ${castLevel} (upcast from ${spellLevel})`;
      }
      if (spell.school) {
        levelText += ` ${spell.school}`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🔮 ${character.character_name} casts ${spell.name}`)
        .setColor(0x9b59b6)
        .setDescription(`${levelText}${titleTags}\n\n${formatSpellDescription(spell, castLevel)}`)
        .setFooter({ text: components.length > 0 ? 'Click buttons below to roll attack/damage' : 'Spell cast in Roll20' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed], components });

    } catch (error) {
      console.error('Cast command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while casting the spell. Please try again.',
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
  if (spell.duration) description += `**Duration:** ${spell.duration}\n`;
  if (spell.school) description += `**School:** ${spell.school}\n`;
  if (spell.components) description += `**Components:** ${spell.components}\n`;
  if (spell.source) description += `**Source:** ${spell.source}\n`;

  // Use correct field names from DiceCloud data
  if (spell.damageRolls && Array.isArray(spell.damageRolls) && spell.damageRolls.length > 0) {
    spell.damageRolls.forEach(roll => {
      if (roll.damage) {
        const type = roll.damageType || 'damage';
        const isHealing = type.toLowerCase() === 'healing';
        const label = isHealing ? 'Healing' : type.charAt(0).toUpperCase() + type.slice(1);
        description += `**${label}:** ${roll.damage}`;
        if (castLevel && parseInt(spell.level) > 0 && castLevel > parseInt(spell.level)) {
          description += ` (upcast to level ${castLevel})`;
        }
        description += '\n';
      }
    });
  } else if (spell.damage) {
    const type = spell.damageType || 'damage';
    const isHealing = type.toLowerCase() === 'healing';
    const label = isHealing ? 'Healing' : 'Damage';
    description += `**${label}:** ${spell.damage}`;
    if (castLevel && parseInt(spell.level) > 0 && castLevel > parseInt(spell.level)) {
      description += ` (upcast to level ${castLevel})`;
    }
    description += '\n';
  }

  // Backward compat: also check damageRoll/healingRoll if present (for old data)
  if (!spell.damage && !spell.damageRolls) {
    if (spell.damageRoll) description += `**Damage:** ${spell.damageRoll}\n`;
    if (spell.healingRoll) description += `**Healing:** ${spell.healingRoll}\n`;
  }

  if (spell.saveDC && spell.saveAbility) {
    description += `**Save:** ${spell.saveAbility} DC ${spell.saveDC}\n`;
  }

  // Add full spell description/summary at the end
  if (spell.summary || spell.description) {
    description += '\n';
    if (spell.summary) {
      description += spell.summary;
    } else if (spell.description) {
      // Truncate very long descriptions for Discord embed
      const maxLength = 800;
      if (spell.description.length > maxLength) {
        description += spell.description.substring(0, maxLength) + '...';
      } else {
        description += spell.description;
      }
    }
  }

  return description || 'Spell sent to Roll20.';
}

/**
 * Build spell buttons for attack and damage rolls
 */
function buildSpellButtons(spell, characterName, pairingId, discordUserId) {
  const rows = [];
  const buttons = [];

  // Check for spell attack roll
  const attackRoll = spell.attackRoll || spell.attackBonus || spell.spellAttack;

  // Add spell attack button if spell has attack roll
  if (attackRoll) {
    const attackFormula = attackRoll.includes?.('d') ? attackRoll : `1d20+${attackRoll}`;
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`rollcloud:roll:${spell.name} - Spell Attack:${attackFormula}`)
        .setLabel('Spell Attack')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎯')
    );
  }

  // Add damage/healing buttons for damageRolls array
  if (spell.damageRolls && Array.isArray(spell.damageRolls)) {
    for (const roll of spell.damageRolls) {
      if (roll.damage && buttons.length < 5) {
        const damageType = roll.damageType || roll.type || 'damage';
        const isHealing = damageType.toLowerCase() === 'healing';
        const label = roll.name || (isHealing ? 'Healing' : damageType.charAt(0).toUpperCase() + damageType.slice(1));
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`rollcloud:roll:${spell.name} - ${damageType}:${roll.damage}`)
            .setLabel(label)
            .setStyle(isHealing ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji(isHealing ? '💚' : '💥')
        );
      }
    }
  } else if (spell.damage || spell.damageRoll || spell.healingRoll) {
    // Single damage/healing roll
    const damageRoll = spell.damage || spell.damageRoll;
    const healingRoll = spell.healingRoll;

    if (damageRoll) {
      const damageType = spell.damageType || 'damage';
      const isHealing = damageType.toLowerCase() === 'healing';
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`rollcloud:roll:${spell.name} - ${damageType}:${damageRoll}`)
          .setLabel(isHealing ? 'Healing' : `Damage${spell.damageType ? ` (${spell.damageType})` : ''}`)
          .setStyle(isHealing ? ButtonStyle.Success : ButtonStyle.Danger)
          .setEmoji(isHealing ? '💚' : '💥')
      );
    }

    if (healingRoll && buttons.length < 5) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`rollcloud:roll:${spell.name} - healing:${healingRoll}`)
          .setLabel('Healing')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💚')
      );
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
