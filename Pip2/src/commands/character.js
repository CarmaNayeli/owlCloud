import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('View or set your active character')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Character name to set as active (partial match OK)')
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('View another user\'s active character')
        .setRequired(false)
    ),

  async execute(interaction) {
    // IMPORTANT: deferReply MUST happen first - Discord only gives 3 seconds!
    await interaction.deferReply({ flags: 64 }); // ephemeral

    try {
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
                'Use `/characters` to see your synced characters.'
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
      .map(([ability, mod]) => `**${ability.slice(0, 3).toUpperCase()}** ${formatMod(mod)}`)
      .join(' | ');
    embed.addFields({ name: '🎯 Saves', value: saveText, inline: false });
  }

  embed.setFooter({
    text: `${user.username} • Last synced: ${new Date(character.updated_at).toLocaleString()}`
  });

  return embed;
}

async function getActiveCharacter(discordUserId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured');
  }

  // First try to get active character by discord_user_id
  let response = await fetch(
    `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&is_active=eq.true&select=*&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Database error: ${response.status}`);
  }

  let data = await response.json();

  // If no active character, get most recently updated
  if (data.length === 0) {
    response = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&select=*&order=updated_at.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (response.ok) {
      data = await response.json();
    }
  }

  // If still no character, try via pairing link
  if (data.length === 0) {
    console.log(`📋 No character found by discord_user_id=${discordUserId}, checking via pairing...`);

    const pairingResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_pairings?discord_user_id=eq.${discordUserId}&status=eq.connected&select=dicecloud_user_id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (pairingResponse.ok) {
      const pairings = await pairingResponse.json();
      if (pairings.length > 0 && pairings[0].dicecloud_user_id) {
        const dicecloudUserId = pairings[0].dicecloud_user_id;
        console.log(`🔗 Found pairing with dicecloud_user_id: ${dicecloudUserId}`);

        // Get active or most recent by dicecloud_user_id
        let fallbackResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/rollcloud_characters?user_id_dicecloud=eq.${dicecloudUserId}&is_active=eq.true&select=*&limit=1`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
          }
        );

        if (fallbackResponse.ok) {
          data = await fallbackResponse.json();
        }

        // If still no active, get most recent
        if (data.length === 0) {
          fallbackResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/rollcloud_characters?user_id_dicecloud=eq.${dicecloudUserId}&select=*&order=updated_at.desc&limit=1`,
            {
              headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
              }
            }
          );

          if (fallbackResponse.ok) {
            data = await fallbackResponse.json();
          }
        }

        // Link the character to discord_user_id for future lookups
        if (data.length > 0 && data[0].discord_user_id !== discordUserId) {
          console.log(`🔗 Linking character "${data[0].character_name}" to discord_user_id=${discordUserId}`);
          await fetch(
            `${SUPABASE_URL}/rest/v1/rollcloud_characters?id=eq.${data[0].id}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ discord_user_id: discordUserId })
            }
          );
          data[0].discord_user_id = discordUserId;
        }
      }
    }
  }

  return data.length > 0 ? data[0] : null;
}

async function setActiveCharacter(discordUserId, characterName) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured');
  }

  // URL encode the character name for the ilike query
  const encodedName = encodeURIComponent(characterName);

  // Find character by name (case-insensitive partial match)
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}&character_name=ilike.*${encodedName}*&select=*`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Database error: ${response.status}`);
  }

  const matches = await response.json();

  console.log(`🔍 Character search for "${characterName}" (discord_user_id=${discordUserId}):`, {
    matchCount: matches.length,
    matches: matches.map(m => ({ id: m.id, name: m.character_name, discord_user_id: m.discord_user_id }))
  });

  // If no matches by discord_user_id, try finding via pairing link
  if (matches.length === 0) {
    console.log('📋 No direct match, checking via pairing...');

    // Get dicecloud_user_id from pairings for this Discord user
    const pairingResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rollcloud_pairings?discord_user_id=eq.${discordUserId}&status=eq.connected&select=dicecloud_user_id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (pairingResponse.ok) {
      const pairings = await pairingResponse.json();
      if (pairings.length > 0 && pairings[0].dicecloud_user_id) {
        const dicecloudUserId = pairings[0].dicecloud_user_id;
        console.log(`🔗 Found pairing with dicecloud_user_id: ${dicecloudUserId}`);

        // Search by dicecloud_user_id instead
        const fallbackResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/rollcloud_characters?user_id_dicecloud=eq.${dicecloudUserId}&character_name=ilike.*${encodedName}*&select=*`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
          }
        );

        if (fallbackResponse.ok) {
          const fallbackMatches = await fallbackResponse.json();
          console.log(`🔍 Fallback search found ${fallbackMatches.length} matches`);

          if (fallbackMatches.length > 0) {
            // Link the character to this Discord user
            const character = fallbackMatches[0];
            console.log(`🔗 Linking character "${character.character_name}" to discord_user_id=${discordUserId}`);

            await fetch(
              `${SUPABASE_URL}/rest/v1/rollcloud_characters?id=eq.${character.id}`,
              {
                method: 'PATCH',
                headers: {
                  'apikey': SUPABASE_SERVICE_KEY,
                  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ discord_user_id: discordUserId })
              }
            );

            // Now continue with this character
            matches.push({ ...character, discord_user_id: discordUserId });
          }
        }
      }
    }
  }

  if (matches.length === 0) {
    return { success: false };
  }

  const character = matches[0];

  // Deactivate all other characters for this user
  await fetch(
    `${SUPABASE_URL}/rest/v1/rollcloud_characters?discord_user_id=eq.${discordUserId}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_active: false })
    }
  );

  // Activate the selected character
  await fetch(
    `${SUPABASE_URL}/rest/v1/rollcloud_characters?id=eq.${character.id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_active: true })
    }
  );

  return { success: true, character };
}
