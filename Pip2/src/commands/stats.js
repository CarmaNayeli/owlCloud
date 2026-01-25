import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Skill to ability mapping
const SKILL_ABILITIES = {
  acrobatics: 'dexterity',
  animalHandling: 'wisdom',
  arcana: 'intelligence',
  athletics: 'strength',
  deception: 'charisma',
  history: 'intelligence',
  insight: 'wisdom',
  intimidation: 'charisma',
  investigation: 'intelligence',
  medicine: 'wisdom',
  nature: 'intelligence',
  perception: 'wisdom',
  performance: 'charisma',
  persuasion: 'charisma',
  religion: 'intelligence',
  sleightOfHand: 'dexterity',
  stealth: 'dexterity',
  survival: 'wisdom'
};

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Quick stat lookup for your character')
    .addStringOption(option =>
      option
        .setName('stat')
        .setDescription('The stat to look up')
        .setRequired(true)
        .addChoices(
          { name: 'Strength', value: 'strength' },
          { name: 'Dexterity', value: 'dexterity' },
          { name: 'Constitution', value: 'constitution' },
          { name: 'Intelligence', value: 'intelligence' },
          { name: 'Wisdom', value: 'wisdom' },
          { name: 'Charisma', value: 'charisma' },
          { name: 'HP', value: 'hp' },
          { name: 'AC', value: 'ac' },
          { name: 'Initiative', value: 'initiative' },
          { name: 'Perception', value: 'perception' },
          { name: 'Stealth', value: 'stealth' },
          { name: 'Athletics', value: 'athletics' },
          { name: 'Arcana', value: 'arcana' },
          { name: 'All Skills', value: 'skills' },
          { name: 'All Saves', value: 'saves' },
          { name: 'Spell Slots', value: 'spellslots' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const stat = interaction.options.getString('stat');
      const character = await getCharacterByDiscordUser(interaction.user.id);

      if (!character) {
        await interaction.editReply({
          content: '❌ No character linked. Use the RollCloud extension to sync your character.'
        });
        return;
      }

      const formatMod = (mod) => mod >= 0 ? `+${mod}` : `${mod}`;
      let embed;

      switch (stat) {
        case 'hp':
          embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle(`❤️ ${character.character_name}'s HP`)
            .setDescription(`**${character.hit_points?.current || 0} / ${character.hit_points?.max || 0}**`)
            .setFooter({ text: character.class ? `Level ${character.level} ${character.class}` : '' });
          break;

        case 'ac':
          embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`🛡️ ${character.character_name}'s AC`)
            .setDescription(`**${character.armor_class || 10}**`)
            .setFooter({ text: character.class ? `Level ${character.level} ${character.class}` : '' });
          break;

        case 'initiative':
          embed = new EmbedBuilder()
            .setColor(0xF39C12)
            .setTitle(`⚡ ${character.character_name}'s Initiative`)
            .setDescription(`**${formatMod(character.initiative || 0)}**`)
            .setFooter({ text: character.class ? `Level ${character.level} ${character.class}` : '' });
          break;

        case 'skills':
          const skills = character.skills || {};
          const skillLines = Object.entries(skills)
            .map(([skill, mod]) => {
              const displayName = skill.replace(/([A-Z])/g, ' $1').trim();
              return `**${displayName}**: ${formatMod(mod)}`;
            })
            .join('\n');

          embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle(`📋 ${character.character_name}'s Skills`)
            .setDescription(skillLines || 'No skills recorded')
            .setFooter({ text: character.class ? `Level ${character.level} ${character.class}` : '' });
          break;

        case 'saves':
          const saves = character.saves || {};
          const saveLines = Object.entries(saves)
            .map(([ability, mod]) => `**${ability.slice(0, 3).toUpperCase()}**: ${formatMod(mod)}`)
            .join(' | ');

          embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle(`🎯 ${character.character_name}'s Saving Throws`)
            .setDescription(saveLines || 'No saves recorded')
            .setFooter({ text: character.class ? `Level ${character.level} ${character.class}` : '' });
          break;

        case 'spellslots':
          const slots = character.spell_slots || {};
          const slotLines = Object.entries(slots)
            .filter(([_, data]) => data && (data.max > 0 || data.current > 0))
            .map(([level, data]) => {
              const lvl = level.replace('level', '').replace('SpellSlots', '');
              const filled = '⬛'.repeat(data.current);
              const empty = '⬜'.repeat(Math.max(0, data.max - data.current));
              return `**Level ${lvl}**: ${filled}${empty} (${data.current}/${data.max})`;
            })
            .join('\n');

          embed = new EmbedBuilder()
            .setColor(0x8E44AD)
            .setTitle(`✨ ${character.character_name}'s Spell Slots`)
            .setDescription(slotLines || 'No spell slots')
            .setFooter({ text: character.class ? `Level ${character.level} ${character.class}` : '' });
          break;

        default:
          // Check if it's an ability score
          if (['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].includes(stat)) {
            const score = character.attributes?.[stat] || 10;
            const mod = character.attribute_mods?.[stat] || Math.floor((score - 10) / 2);
            const save = character.saves?.[stat];

            embed = new EmbedBuilder()
              .setColor(0x4ECDC4)
              .setTitle(`📊 ${character.character_name}'s ${stat.charAt(0).toUpperCase() + stat.slice(1)}`)
              .addFields(
                { name: 'Score', value: `**${score}**`, inline: true },
                { name: 'Modifier', value: `**${formatMod(mod)}**`, inline: true }
              )
              .setFooter({ text: character.class ? `Level ${character.level} ${character.class}` : '' });

            if (save !== undefined) {
              embed.addFields({ name: 'Save', value: `**${formatMod(save)}**`, inline: true });
            }
          }
          // Check if it's a skill
          else if (SKILL_ABILITIES[stat]) {
            const skillMod = character.skills?.[stat] || 0;
            const ability = SKILL_ABILITIES[stat];

            embed = new EmbedBuilder()
              .setColor(0x9B59B6)
              .setTitle(`📋 ${character.character_name}'s ${stat.charAt(0).toUpperCase() + stat.slice(1)}`)
              .setDescription(`**${formatMod(skillMod)}** (${ability})`)
              .setFooter({ text: character.class ? `Level ${character.level} ${character.class}` : '' });
          }
          break;
      }

      if (embed) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({ content: `❌ Unknown stat: ${stat}` });
      }

    } catch (error) {
      console.error('Stats command error:', error);
      await interaction.editReply({
        content: `❌ Error: ${error.message}`
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

  const response = await fetch(
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

  const data = await response.json();
  return data.length > 0 ? data[0] : null;
}
