import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// Supabase config - set via environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('cast')
    .setDescription('Cast a spell from your character sheet')
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
        .setDescription('Spell level (for leveled spells)')
        .setMinValue(1)
        .setMaxValue(9)
    )
    .addBooleanOption(option =>
      option
        .setName('upcast')
        .setDescription('Use higher level spell slot')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('target')
        .setDescription('Target of the spell (optional)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('damage')
        .setDescription('Custom damage roll (overrides default)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const spellName = interaction.options.getString('spell');
      const spellLevel = interaction.options.getInteger('level');
      const upcast = interaction.options.getBoolean('upcast') || false;
      const target = interaction.options.getString('target');
      const customDamage = interaction.options.getInteger('damage');

      // Get character data
      const characterData = await getCharacterData(interaction.user.id);

      if (!characterData) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Character Not Found')
            .setDescription('You need to link your character first. Use `/rollcloud [code]` to connect your RollCloud extension.')
          ]
        });
        return;
      }

      // Find the spell
      const spell = findSpell(characterData.spells || [], spellName);

      if (!spell) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Spell Not Found')
            .setDescription(`Could not find a spell named "**${spellName}**" in your character's spell list.\n\nUse \`/sheet section:spells\` to see your available spells.`)
          ]
        });
        return;
      }

      // Check spell slot availability
      const slotLevel = upcast && spellLevel ? spellLevel : spell.level;
      if (slotLevel > 0) {
        const hasSlot = checkSpellSlot(characterData.spell_slots || {}, slotLevel);
        if (!hasSlot) {
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(0xE74C3C)
              .setTitle('❌ No Spell Slots Available')
              .setDescription(`You don't have any level ${slotLevel} spell slots remaining.\n\nUse \`/sheet section:spells\` to check your remaining spell slots.`)
            ]
          });
          return;
        }
      }

      // Cast the spell
      const castResult = await castSpell(characterData, spell, {
        slotLevel,
        target,
        customDamage,
        upcast
      });

      // Update spell slots in database
      if (slotLevel > 0) {
        await updateSpellSlots(characterData.id, slotLevel);
      }

      // Send the cast result
      await interaction.editReply({ embeds: [castResult.embed] });

      // If there was a damage roll, also send it as a separate message for clarity
      if (castResult.damageRoll) {
        await interaction.followUp({ content: castResult.damageRoll });
      }

    } catch (error) {
      console.error('Cast command error:', error);
      
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('❌ Spell Casting Failed')
          .setDescription('Something went wrong while casting your spell. Please try again later.')
        ]
      });
    }
  },

  // Handle autocomplete for spell names
  async autocomplete(interaction) {
    try {
      const focusedValue = interaction.options.getFocused();
      const characterData = await getCharacterData(interaction.user.id);

      if (!characterData || !characterData.spells) {
        await interaction.respond([]);
        return;
      }

      const spells = characterData.spells
        .filter(spell => spell.name.toLowerCase().includes(focusedValue.toLowerCase()))
        .slice(0, 25)
        .map(spell => ({
          name: `${spell.name} (${spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`})`,
          value: spell.name
        }));

      await interaction.respond(spells);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  }
};

/**
 * Get character data from DiceCloud via Supabase
 */
async function getCharacterData(discordUserId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured');
  }

  // Find the user's RollCloud connection
  const connectionResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/rollcloud_pairings?discord_user_id=eq.${discordUserId}&status=eq.connected&select=*`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!connectionResponse.ok) {
    throw new Error('Failed to lookup user connection');
  }

  const connections = await connectionResponse.json();
  
  if (connections.length === 0) {
    return null;
  }

  const connection = connections[0];
  const dicecloudUserId = connection.dicecloud_user_id;

  // Get character data from DiceCloud
  const characterResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/dicecloud_characters?user_id=eq.${dicecloudUserId}&select=*&order=updated_at.desc&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!characterResponse.ok) {
    throw new Error('Failed to lookup character data');
  }

  const characters = await characterResponse.json();
  return characters.length > 0 ? characters[0] : null;
}

/**
 * Find a spell by name (case-insensitive partial match)
 */
function findSpell(spells, spellName) {
  const searchName = spellName.toLowerCase();
  
  // Try exact match first
  let spell = spells.find(s => s.name.toLowerCase() === searchName);
  if (spell) return spell;
  
  // Try partial match
  spell = spells.find(s => s.name.toLowerCase().includes(searchName));
  if (spell) return spell;
  
  // Try reverse partial match
  spell = spells.find(s => searchName.includes(s.name.toLowerCase()));
  return spell;
}

/**
 * Check if character has available spell slots
 */
function checkSpellSlot(spellSlots, level) {
  const current = spellSlots[`level_${level}_current`] || 0;
  return current > 0;
}

/**
 * Cast a spell and return the result
 */
function castSpell(character, spell, options) {
  const { slotLevel, target, customDamage, upcast } = options;
  
  const embed = new EmbedBuilder()
    .setColor(spell.level === 0 ? 0x9B59B6 : 0xE74C3C)
    .setTitle(`🔮 ${spell.name}`)
    .setDescription(`**${interaction.user.displayName}** casts **${spell.name}**${target ? ` at **${target}**` : ''}`);

  // Add spell details
  const details = [];
  
  if (spell.level === 0) {
    details.push(`**Type:** Cantrip`);
  } else {
    details.push(`**Level:** ${upcast && slotLevel > spell.level ? `${spell.level} (upcast to ${slotLevel})` : spell.level}`);
    details.push(`**School:** ${spell.school || 'Unknown'}`);
  }
  
  if (spell.casting_time) {
    details.push(`**Casting Time:** ${spell.casting_time}`);
  }
  
  if (spell.range) {
    details.push(`**Range:** ${spell.range}`);
  }
  
  if (spell.components) {
    details.push(`**Components:** ${spell.components}`);
  }
  
  if (spell.duration) {
    details.push(`**Duration:** ${spell.duration}`);
  }

  embed.addFields({ name: '📜 Spell Details', value: details.join('\n'), inline: false });

  // Add description
  if (spell.description) {
    embed.addFields({ 
      name: '📖 Description', 
      value: spell.description.length > 1024 ? spell.description.substring(0, 1021) + '...' : spell.description,
      inline: false 
    });
  }

  // Handle damage rolls
  let damageRoll = null;
  if (spell.damage && !customDamage) {
    const damage = rollDamage(spell.damage, slotLevel - spell.level);
    embed.addFields({ 
      name: '⚔️ Damage', 
      value: `${damage.formula}: **${damage.total}**${damage.type ? ` ${damage.type}` : ''}`,
      inline: false 
    });
    damageRoll = `🎲 Damage roll for ${spell.name}: [${damage.rolls.join(', ')}] = **${damage.total}**`;
  } else if (customDamage) {
    embed.addFields({ 
      name: '⚔️ Damage', 
      value: `Custom damage: **${customDamage}**`,
      inline: false 
    });
  }

  // Add concentration indicator
  if (spell.concentration) {
    embed.addFields({ name: '🧘 Concentration', value: 'This spell requires concentration', inline: false });
  }

  // Add spell save DC if applicable
  if (spell.save_dc && character.spell_save_dc) {
    embed.addFields({ 
      name: '🛡️ Save', 
      value: `${spell.save_dc} DC ${character.spell_save_dc}`,
      inline: false 
    });
  }

  embed.setFooter({ text: `${character.name} • Spell Slot ${slotLevel > 0 ? `Level ${slotLevel} used` : 'Cantrip'}` })
    .setTimestamp();

  return { embed, damageRoll };
}

/**
 * Roll damage for a spell
 */
function rollDamage(damageFormula, upcastLevels = 0) {
  // Parse damage formula (e.g., "2d6", "4d4+2", "1d8 per spell level")
  let formula = damageFormula;
  
  // Handle upcasting
  if (upcastLevels > 0 && formula.includes('per spell level')) {
    const baseMatch = formula.match(/(\d+)d(\d+)/);
    if (baseMatch) {
      const [, baseDice, baseSides] = baseMatch;
      const totalDice = parseInt(baseDice) + upcastLevels;
      formula = formula.replace(/(\d+)d(\d+)/, `${totalDice}d${baseSides}`);
    }
  }

  // Simple dice roller
  const diceMatch = formula.match(/(\d+)d(\d+)(?:\s*([+-]\s*\d+))?/);
  if (!diceMatch) {
    return { formula, total: 0, rolls: [], type: '' };
  }

  const [, count, sides, modifier] = diceMatch;
  const numDice = parseInt(count);
  const numSides = parseInt(sides);
  const mod = modifier ? parseInt(modifier.replace(/\s/g, '')) : 0;

  const rolls = [];
  for (let i = 0; i < numDice; i++) {
    rolls.push(Math.floor(Math.random() * numSides) + 1);
  }

  const total = rolls.reduce((a, b) => a + b, 0) + mod;

  return {
    formula,
    total,
    rolls,
    type: extractDamageType(formula)
  };
}

/**
 * Extract damage type from formula
 */
function extractDamageType(formula) {
  const types = ['fire', 'cold', 'lightning', 'thunder', 'acid', 'poison', 'psychic', 'radiant', 'necrotic', 'force', 'bludgeoning', 'piercing', 'slashing'];
  
  for (const type of types) {
    if (formula.toLowerCase().includes(type)) {
      return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }
  
  return '';
}

/**
 * Update spell slots in the database
 */
async function updateSpellSlots(characterId, slotLevel) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured');
  }

  // Get current spell slots
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/dicecloud_characters?id=eq.${characterId}&select=spell_slots`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to get current spell slots');
  }

  const characters = await response.json();
  if (characters.length === 0) {
    throw new Error('Character not found');
  }

  const spellSlots = characters[0].spell_slots || {};
  const currentKey = `level_${slotLevel}_current`;
  const current = spellSlots[currentKey] || 0;
  
  if (current <= 0) {
    throw new Error('No spell slots available');
  }

  // Decrement the slot
  spellSlots[currentKey] = current - 1;

  // Update the database
  const updateResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/dicecloud_characters?id=eq.${characterId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        spell_slots: spellSlots,
        updated_at: new Date().toISOString()
      })
    }
  );

  if (!updateResponse.ok) {
    throw new Error('Failed to update spell slots');
  }

  return await updateResponse.json();
}
