import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('cast')
    .setDescription('Cast a spell from your character\'s spell list')
    .addStringOption(option =>
      option
        .setName('spell')
        .setDescription('Name of the spell to cast')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('target')
        .setDescription('Target of the spell (optional)')
        .setRequired(false)
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
      // Get active character for the user
      const character = await getActiveCharacter(discordUserId);
      
      if (!character) {
        await interaction.respond([]);
        return;
      }

      // Parse spells from character data
      const spells = parseSpells(character.raw_dicecloud_data || '{}');
      
      if (!spells || spells.length === 0) {
        await interaction.respond([]);
        return;
      }

      // Filter by what user has typed so far
      const filtered = spells
        .filter(spell => spell.name && spell.name.toLowerCase().includes(focusedValue))
        .slice(0, 25); // Discord limit

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
    await interaction.deferReply();

    const spellName = interaction.options.getString('spell');
    const target = interaction.options.getString('target');
    const castLevel = interaction.options.getInteger('level');
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

      // Parse spells from character data
      const spells = parseSpells(character.raw_dicecloud_data || '{}');
      
      if (!spells || spells.length === 0) {
        return await interaction.editReply({
          content: `❌ **${character.character_name}** doesn't have any spells.`,
          flags: 64
        });
      }

      // Find the spell (case-insensitive)
      const spell = spells.find(s => 
        s.name && s.name.toLowerCase() === spellName.toLowerCase()
      );

      if (!spell) {
        return await interaction.editReply({
          content: `❌ Spell "**${spellName}**" not found. Use \`/spells\` to see your available spells.`,
          flags: 64
        });
      }

      // Check spell slots if it's not a cantrip
      const spellLevel = parseInt(spell.level) || 0;
      if (spellLevel > 0) {
        const spellSlots = parseSpellSlots(character.raw_dicecloud_data || '{}');
        const slotLevel = castLevel || spellLevel;
        
        if (!spellSlots[`level${slotLevel}`] || spellSlots[`level${slotLevel}`].remaining <= 0) {
          return await interaction.editReply({
            content: `❌ No level ${slotLevel} spell slots remaining for **${character.character_name}**.`,
            flags: 64
          });
        }
      }

      // Create the cast message to send to Roll20
      const castMessage = {
        action: 'cast',
        character: character.character_name,
        spell: spell.name,
        level: castLevel || spellLevel,
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
          body: JSON.stringify(castMessage)
        });

        if (!webhookResponse.ok) {
          throw new Error(`Webhook responded with ${webhookResponse.status}`);
        }

        // Create success embed
        const embed = new EmbedBuilder()
          .setTitle(`🔮 ${character.character_name} casts ${spell.name}`)
          .setColor(0x9b59b6)
          .setDescription(formatSpellDescription(spell, target, castLevel))
          .addFields(
            { name: 'Caster', value: interaction.user.username, inline: true },
            { name: 'Spell Level', value: castLevel ? `Level ${castLevel} (upcast)` : `Level ${spellLevel}`, inline: true }
          );

        if (target) {
          embed.addFields({ name: 'Target', value: target, inline: true });
        }

        embed.setFooter({ text: '✅ Sent to Roll20' });

        await interaction.editReply({ embeds: [embed] });

      } catch (webhookError) {
        console.error('Webhook error:', webhookError);
        return await interaction.editReply({
          content: `❌ Failed to send spell to Roll20. Make sure the RollCloud extension is running and connected to Roll20.`,
          flags: 64
        });
      }

    } catch (error) {
      console.error('Cast command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while casting the spell. Please try again.',
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

function parseSpells(rawData) {
  try {
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    return data.spells || [];
  } catch (error) {
    console.error('Error parsing spells:', error);
    return [];
  }
}

function parseSpellSlots(rawData) {
  try {
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    return data.spellSlots || {};
  } catch (error) {
    console.error('Error parsing spell slots:', error);
    return {};
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

function formatSpellDescription(spell, target, castLevel) {
  let description = '';
  
  if (spell.castingTime) description += `⏱️ **Casting Time:** ${spell.castingTime}\n`;
  if (spell.range) description += `📏 **Range:** ${spell.range}\n`;
  if (spell.duration && spell.duration !== 'Instantaneous') description += `⏳ **Duration:** ${spell.duration}\n`;
  if (spell.components) description += `🔮 **Components:** ${spell.components}\n`;
  
  if (spell.damageRoll) {
    description += `💥 **Damage:** ${spell.damageRoll}`;
    if (castLevel && parseInt(spell.level) > 0 && castLevel > parseInt(spell.level)) {
      description += ` (upcast to level ${castLevel})`;
    }
    description += '\n';
  }
  
  if (spell.healingRoll) {
    description += `💚 **Healing:** ${spell.healingRoll}\n`;
  }
  
  if (spell.saveDC && spell.saveAbility) {
    description += `🛡️ **Save:** ${spell.saveAbility} DC ${spell.saveDC}\n`;
  }
  
  if (spell.description) {
    description += `📜 **Description:** ${spell.description.substring(0, 200)}${spell.description.length > 200 ? '...' : ''}\n`;
  }
  
  if (target) {
    description += `🎯 **Target:** ${target}\n`;
  }
  
  return description || 'No additional details available.';
}
