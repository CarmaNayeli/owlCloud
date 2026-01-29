import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getActiveCharacter, setActiveCharacter } from '../utils/characterCache.js';

export default {
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('View or set your active character')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Character name to set as active')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('View another user\'s active character')
        .setRequired(false)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const discordUserId = interaction.user.id;

    try {
      // Use the cache to get user characters quickly
      const characters = await getUserCharacters(discordUserId);

      // Filter by what user has typed so far
      const filtered = characters
        .filter(char => char.character_name.toLowerCase().includes(focusedValue))
        .slice(0, 25); // Discord limit

      await interaction.respond(
        filtered.map(char => {
          // Build display name with 100 char limit for Discord autocomplete
          let displayName = `${char.character_name} (${char.class || 'Unknown'} Lv${char.level || 1})`;
          if (displayName.length > 100) {
            // Truncate character name if needed, keep the class/level info
            const suffix = ` (${char.class || 'Unknown'} Lv${char.level || 1})`;
            const maxNameLength = 100 - suffix.length - 3; // -3 for "..."
            displayName = `${char.character_name.substring(0, maxNameLength)}...${suffix}`;
          }
          return {
            name: displayName,
            value: char.character_name
          };
        })
      );
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    try {
      // CRITICAL: Defer IMMEDIATELY - Discord only gives 3 seconds!
      // Do this BEFORE any other operations
      await interaction.deferReply({ flags: 64 }); // ephemeral

      const characterName = interaction.options.getString('name');
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const isOwnCharacter = targetUser.id === interaction.user.id;

      console.log('🎭 /character command:', {
        user: interaction.user.id,
        username: interaction.user.username,
        characterName,
        targetUserId: targetUser.id,
        isOwnCharacter
      });

      // If name provided and it's the user's own character, set it as active
      if (characterName && isOwnCharacter) {
        const result = await setActiveCharacter(interaction.user.id, characterName);

        if (!result.success) {
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(0xE74C3C)
              .setTitle('❌ Character Not Found')
              .setDescription(
                `No character matching "${characterName}" found.\n\n` +
                'Use `/characters` to see your synced characters.' +
                (result.error ? `\n\n**Error:** ${result.error}` : '')
              )
            ]
          });
          return;
        }

        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0x4ECDC4)
            .setTitle('✅ Active Character Set')
            .setDescription(`**${result.character.character_name}** is now your active character.`)
            .addFields(
              { name: 'Class', value: `${result.character.class || 'Unknown'} Lv ${result.character.level}`, inline: true },
              { name: 'HP', value: `${result.character.hit_points?.current || 0}/${result.character.hit_points?.max || 0}`, inline: true },
              { name: 'AC', value: `${result.character.armor_class || 10}`, inline: true }
            )
          ]
        });
        return;
      }

      // Otherwise, show the active character
      const character = await getActiveCharacter(targetUser.id);

      if (!character) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xF39C12)
            .setTitle('❌ No Active Character')
            .setDescription(
              isOwnCharacter
                ? 'You don\'t have an active character set.\n\n' +
                  '**To set one:**\n' +
                  '• `/character <name>` - Set by name\n' +
                  '• `/characters` - List all your characters'
                : `${targetUser.username} doesn't have an active character.`
            )
          ]
        });
        return;
      }

      // Build character sheet embed
      const embed = buildCharacterEmbed(character, targetUser);
      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Character command error:', error);

      // Check if we can still reply
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(0xE74C3C)
              .setTitle('❌ Error')
              .setDescription(`Failed to fetch character: ${error.message}`)
            ]
          });
        } else {
          await interaction.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xE74C3C)
              .setTitle('❌ Error')
              .setDescription(`Failed to fetch character: ${error.message}`)
            ],
            flags: 64
          });
        }
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }
};

function buildCharacterEmbed(character, user) {
  const formatMod = (mod) => mod >= 0 ? `+${mod}` : `${mod}`;
  const hp = character.hit_points || { current: 0, max: 0 };

  const embed = new EmbedBuilder()
    .setColor(0x4ECDC4)
    .setTitle(`🎭 ${character.character_name}`)
    .setDescription(
      `**${character.race || 'Unknown'}** ${character.class || 'Unknown'} (Level ${character.level || 1})\n` +
      (character.alignment ? `*${character.alignment}*` : '')
    )
    .addFields(
      { name: '❤️ HP', value: `${hp.current}/${hp.max}`, inline: true },
      { name: '🛡️ AC', value: `${character.armor_class || 10}`, inline: true },
      { name: '⚡ Speed', value: `${character.speed || 30} ft`, inline: true }
    );

  // Ability scores
  if (character.attributes && Object.keys(character.attributes).length > 0) {
    const attrs = character.attributes;
    const mods = character.attribute_mods || {};

    const abilityText = [
      `**STR** ${attrs.strength || 10} (${formatMod(mods.strength || 0)})`,
      `**DEX** ${attrs.dexterity || 10} (${formatMod(mods.dexterity || 0)})`,
      `**CON** ${attrs.constitution || 10} (${formatMod(mods.constitution || 0)})`,
      `**INT** ${attrs.intelligence || 10} (${formatMod(mods.intelligence || 0)})`,
      `**WIS** ${attrs.wisdom || 10} (${formatMod(mods.wisdom || 0)})`,
      `**CHA** ${attrs.charisma || 10} (${formatMod(mods.charisma || 0)})`
    ].join(' | ');

    embed.addFields({ name: '📊 Abilities', value: abilityText, inline: false });
  }

  // Saving throws
  if (character.saves && Object.keys(character.saves).length > 0) {
    const saveText = Object.entries(character.saves)
      .map(([save, proficiency]) => {
        const profIcon = proficiency ? '✓' : ' ';
        return `${profIcon} **${save}**`;
      })
      .join(' • ');

    embed.addFields({ name: '💾 Saving Throws', value: saveText, inline: false });
  }

  // Skills
  if (character.skills && Object.keys(character.skills).length > 0) {
    const skills = character.skills;
    const skillText = Object.entries(skills)
      .map(([skill, bonus]) => {
        const profIcon = bonus >= 0 ? '✓' : ' ';
        return `${profIcon} **${skill}**: ${bonus >= 0 ? '+' : ''}${bonus}`;
      })
      .join(' • ');

    embed.addFields({ name: '🎯 Skills', value: skillText, inline: false });
  }

  // Equipment
  if (character.equipment && character.equipment.length > 0) {
    const equipmentText = character.equipment
      .slice(0, 10)
      .map(item => `• ${item.name}`)
      .join('\n');

    if (character.equipment.length > 10) {
      embed.addFields({ 
        name: '🎒 Equipment', 
        value: `${equipmentText}\n*...and ${character.equipment.length - 10} more items*`, 
        inline: false 
      });
    } else {
      embed.addFields({ name: '🎒 Equipment', value: equipmentText, inline: false });
    }
  }

  // Spells
  if (character.spells && character.spells.length > 0) {
    const spellsByLevel = {};
    character.spells.forEach(spell => {
      const level = spell.level || 0;
      if (!spellsByLevel[level]) spellsByLevel[level] = [];
      spellsByLevel[level].push(spell);
    });

    const spellText = Object.entries(spellsByLevel)
      .sort(([a, b]) => parseInt(a) - parseInt(b))
      .map(([level, spells]) => {
        const levelName = level === 0 ? 'Cantrips' : `Level ${level}`;
        const spellNames = spells.slice(0, 5).map(s => s.name).join(', ');
        return `**${levelName}:** ${spellNames}`;
      })
      .join('\n');

    embed.addFields({ name: '🔮 Spells', value: spellText, inline: false });
  }

  // Features
  if (character.features && character.features.length > 0) {
    const featureText = character.features
      .slice(0, 5)
      .map(feature => `• ${feature.name}`)
      .join('\n');

    if (character.features.length > 5) {
      embed.addFields({ 
        name: '⭐ Features', 
        value: `${featureText}\n*...and ${character.features.length - 5} more features*`, 
        inline: false 
      });
    } else {
      embed.addFields({ name: '⭐ Features', value: featureText, inline: false });
    }
  }

  embed
    .setFooter({ text: `${user.username} • Last synced: ${new Date(character.updated_at).toLocaleString()}` });

  return embed;
}

// Helper function to get user characters (optimized for autocomplete)
async function getUserCharacters(discordUserId) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return [];
  }

  try {
    // Optimized query - only fetch essential fields for autocomplete
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&select=character_name,class,level&order=character_name`,
      {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
      console.error('Error fetching user characters:', error);
      return [];
    }
}
