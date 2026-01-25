import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('View your linked DiceCloud character')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('View another user\'s character (optional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const character = await getCharacterByDiscordUser(targetUser.id);

      if (!character) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xF39C12)
            .setTitle('❌ No Character Found')
            .setDescription(
              targetUser.id === interaction.user.id
                ? 'You don\'t have a character linked yet.\n\n' +
                  '**To link your character:**\n' +
                  '1. Open the RollCloud extension\n' +
                  '2. Go to a DiceCloud character sheet\n' +
                  '3. Click "Sync to Cloud" in the extension'
                : `${targetUser.username} doesn't have a character linked.`
            )
          ]
        });
        return;
      }

      // Build character embed
      const embed = new EmbedBuilder()
        .setColor(0x4ECDC4)
        .setTitle(`🎭 ${character.character_name}`)
        .setDescription(
          `**${character.race || 'Unknown Race'}** ${character.class || 'Unknown Class'} (Level ${character.level || 1})\n` +
          (character.alignment ? `*${character.alignment}*` : '')
        )
        .addFields(
          {
            name: '❤️ Hit Points',
            value: `${character.hit_points?.current || 0} / ${character.hit_points?.max || 0}`,
            inline: true
          },
          {
            name: '🛡️ Armor Class',
            value: `${character.armor_class || 10}`,
            inline: true
          },
          {
            name: '⚡ Speed',
            value: `${character.speed || 30} ft`,
            inline: true
          }
        );

      // Add ability scores if available
      if (character.attributes && Object.keys(character.attributes).length > 0) {
        const attrs = character.attributes;
        const mods = character.attribute_mods || {};

        const formatMod = (mod) => mod >= 0 ? `+${mod}` : `${mod}`;

        const abilityText = [
          `**STR** ${attrs.strength || 10} (${formatMod(mods.strength || 0)})`,
          `**DEX** ${attrs.dexterity || 10} (${formatMod(mods.dexterity || 0)})`,
          `**CON** ${attrs.constitution || 10} (${formatMod(mods.constitution || 0)})`,
          `**INT** ${attrs.intelligence || 10} (${formatMod(mods.intelligence || 0)})`,
          `**WIS** ${attrs.wisdom || 10} (${formatMod(mods.wisdom || 0)})`,
          `**CHA** ${attrs.charisma || 10} (${formatMod(mods.charisma || 0)})`
        ].join(' | ');

        embed.addFields({ name: '📊 Ability Scores', value: abilityText, inline: false });
      }

      // Add saving throws if available
      if (character.saves && Object.keys(character.saves).length > 0) {
        const saves = character.saves;
        const formatMod = (mod) => mod >= 0 ? `+${mod}` : `${mod}`;

        const saveText = Object.entries(saves)
          .map(([ability, mod]) => `**${ability.slice(0, 3).toUpperCase()}** ${formatMod(mod)}`)
          .join(' | ');

        embed.addFields({ name: '🎯 Saving Throws', value: saveText, inline: false });
      }

      // Add spell slots if available
      if (character.spell_slots && Object.keys(character.spell_slots).length > 0) {
        const slots = character.spell_slots;
        const slotText = Object.entries(slots)
          .filter(([_, data]) => data && (data.max > 0 || data.current > 0))
          .map(([level, data]) => {
            const lvl = level.replace('level', '').replace('SpellSlots', '');
            return `L${lvl}: ${data.current}/${data.max}`;
          })
          .join(' | ');

        if (slotText) {
          embed.addFields({ name: '✨ Spell Slots', value: slotText, inline: false });
        }
      }

      embed.setFooter({
        text: `Last synced: ${new Date(character.updated_at).toLocaleString()}`
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Character command error:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('❌ Error')
          .setDescription(`Failed to fetch character: ${error.message}`)
        ]
      });
    }
  }
};

/**
 * Get character by Discord user ID from Supabase
 */
async function getCharacterByDiscordUser(discordUserId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured');
  }

  // First try direct discord_user_id lookup
  let response = await fetch(
    `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&select=*&order=updated_at.desc&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
  }

  let data = await response.json();

  if (data.length > 0) {
    return data[0];
  }

  // Fallback: try to find via pairing
  response = await fetch(
    `${SUPABASE_URL}/rest/v1/rollcloud_pairings?discord_user_id=eq.${discordUserId}&select=id`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (response.ok) {
    const pairings = await response.json();
    if (pairings.length > 0) {
      const pairingId = pairings[0].id;

      response = await fetch(
        `${SUPABASE_URL}/rest/v1/rollcloud_characters?pairing_id=eq.${pairingId}&select=*&order=updated_at.desc&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          }
        }
      );

      if (response.ok) {
        data = await response.json();
        if (data.length > 0) {
          return data[0];
        }
      }
    }
  }

  return null;
}
