import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// Supabase config - set via environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use an ability, feature, or item from your character sheet')
    .addStringOption(option =>
      option
        .setName('ability')
        .setDescription('Name of the ability, feature, or item to use')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('target')
        .setDescription('Target of the ability (optional)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('quantity')
        .setDescription('Quantity to use (for consumables)')
        .setMinValue(1)
        .setMaxValue(99)
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('details')
        .setDescription('Additional details about how you\'re using this ability')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const abilityName = interaction.options.getString('ability');
      const target = interaction.options.getString('target');
      const quantity = interaction.options.getInteger('quantity') || 1;
      const details = interaction.options.getString('details');

      // Get character data
      const characterData = await getCharacterData(interaction.user.id);

      if (!characterData) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Character Not Found')
            .setDescription('You need to link your character first. Use `/owlcloud [code]` to connect your OwlCloud extension.')
          ]
        });
        return;
      }

      // Find the ability/feature/item
      const result = findAbility(characterData, abilityName);

      if (!result) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Ability Not Found')
            .setDescription(`Could not find an ability, feature, or item named "**${abilityName}**" in your character sheet.\n\nUse \`/sheet\` to see your available abilities, features, and equipment.`)
          ]
        });
        return;
      }

      // Check if the ability can be used
      const canUse = checkCanUse(result, quantity);

      if (!canUse.allowed) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Cannot Use Ability')
            .setDescription(canUse.reason)
          ]
        });
        return;
      }

      // Use the ability
      const useResult = await useAbility(characterData, result, {
        target,
        quantity,
        details
      });

      // Update character data if needed
      if (useResult.needsUpdate) {
        await updateCharacterData(characterData.id, useResult.updates);
      }

      // Send the result
      await interaction.editReply({ embeds: [useResult.embed] });

      // If there was a roll, also send it as a separate message for clarity
      if (useResult.roll) {
        await interaction.followUp({ content: useResult.roll });
      }

    } catch (error) {
      console.error('Use command error:', error);
      
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('❌ Ability Use Failed')
          .setDescription('Something went wrong while using your ability. Please try again later.')
        ]
      });
    }
  },

  // Handle autocomplete for ability names
  async autocomplete(interaction) {
    try {
      const focusedValue = interaction.options.getFocused();
      const characterData = await getCharacterData(interaction.user.id);

      if (!characterData) {
        await interaction.respond([]);
        return;
      }

      const abilities = [];

      // Add features
      if (characterData.features) {
        characterData.features
          .filter(feature => feature.name.toLowerCase().includes(focusedValue.toLowerCase()))
          .slice(0, 10)
          .forEach(feature => {
            abilities.push({
              name: `🎭 ${feature.name} (Feature)`,
              value: feature.name
            });
          });
      }

      // Add equipment
      if (characterData.equipment) {
        characterData.equipment
          .filter(item => item.name.toLowerCase().includes(focusedValue.toLowerCase()))
          .slice(0, 10)
          .forEach(item => {
            abilities.push({
              name: `🎒 ${item.name} (Item)`,
              value: item.name
            });
          });
      }

      // Add common actions
      const commonActions = [
        'Attack', 'Dash', 'Dodge', 'Help', 'Hide', 'Ready', 'Search', 'Use Object'
      ];

      commonActions
        .filter(action => action.toLowerCase().includes(focusedValue.toLowerCase()))
        .forEach(action => {
          abilities.push({
            name: `⚔️ ${action} (Action)`,
            value: action
          });
        });

      await interaction.respond(abilities.slice(0, 25));
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

  // Find the user's OwlCloud connection
  const connectionResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/owlcloud_pairings?discord_user_id=eq.${discordUserId}&status=eq.connected&select=*`,
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
 * Find an ability, feature, or item by name
 */
function findAbility(character, abilityName) {
  const searchName = abilityName.toLowerCase();

  // Check features first
  if (character.features) {
    let feature = character.features.find(f => f.name.toLowerCase() === searchName);
    if (feature) return { type: 'feature', data: feature };
    
    feature = character.features.find(f => f.name.toLowerCase().includes(searchName));
    if (feature) return { type: 'feature', data: feature };
  }

  // Check equipment
  if (character.equipment) {
    let item = character.equipment.find(i => i.name.toLowerCase() === searchName);
    if (item) return { type: 'item', data: item };
    
    item = character.equipment.find(i => i.name.toLowerCase().includes(searchName));
    if (item) return { type: 'item', data: item };
  }

  // Check common actions
  const commonActions = {
    'attack': { name: 'Attack', description: 'Make a weapon attack or unarmed strike', action: 'attack' },
    'dash': { name: 'Dash', description: 'Move additional distance equal to your speed', action: 'dash' },
    'dodge': { name: 'Dodge', description: 'Focus entirely on avoiding attacks', action: 'dodge' },
    'help': { name: 'Help', description: 'Assist another creature in their task', action: 'help' },
    'hide': { name: 'Hide', description: 'Make a Dexterity (Stealth) check to hide', action: 'hide' },
    'ready': { name: 'Ready', description: 'Prepare an action to trigger later', action: 'ready' },
    'search': { name: 'Search', description: 'Make a Wisdom (Perception) or Intelligence (Investigation) check', action: 'search' },
    'use object': { name: 'Use Object', description: 'Interact with an object in the environment', action: 'use_object' }
  };

  const action = commonActions[searchName];
  if (action) {
    return { type: 'action', data: action };
  }

  return null;
}

/**
 * Check if an ability can be used
 */
function checkCanUse(result, quantity) {
  const { type, data } = result;

  switch (type) {
    case 'item':
      if (data.quantity === undefined || data.quantity >= quantity) {
        return { allowed: true };
      }
      return { 
        allowed: false, 
        reason: `You only have ${data.quantity || 0} ${data.name}(s). You need ${quantity} to use this ability.` 
      };

    case 'feature':
      // Check for limited uses
      if (data.uses_per_day !== undefined) {
        const used = data.uses_used || 0;
        const remaining = data.uses_per_day - used;
        if (remaining < quantity) {
          return { 
            allowed: false, 
            reason: `**${data.name}** has ${remaining} uses remaining today. You need ${quantity}.` 
          };
        }
      }
      return { allowed: true };

    case 'action':
      return { allowed: true };

    default:
      return { allowed: true };
  }
}

/**
 * Use an ability and return the result
 */
function useAbility(character, result, options) {
  const { type, data } = result;
  const { target, quantity, details } = options;

  const embed = new EmbedBuilder()
    .setColor(getColorForType(type))
    .setTitle(`${getIconForType(type)} ${data.name}`)
    .setDescription(`**${interaction.user.displayName}** uses **${data.name}**${target ? ` on **${target}**` : ''}${details ? `\n\n*${details}*` : ''}`);

  let roll = null;
  let needsUpdate = false;
  let updates = {};

  switch (type) {
    case 'item':
      embed.addFields({ 
        name: '🎒 Item Used', 
        value: `Used ${quantity} ${data.name}${quantity > 1 ? 's' : ''}`,
        inline: false 
      });

      if (data.description) {
        embed.addFields({ 
          name: '📖 Description', 
          value: data.description,
          inline: false 
        });
      }

      // Update quantity
      if (data.quantity !== undefined) {
        needsUpdate = true;
        updates = {
          equipment: character.equipment.map(item => 
            item.name === data.name 
              ? { ...item, quantity: Math.max(0, item.quantity - quantity) }
              : item
          ).filter(item => item.quantity > 0)
        };
      }
      break;

    case 'feature':
      embed.addFields({ 
        name: '🎭 Feature Used', 
        value: data.description || 'No description available',
        inline: false 
      });

      // Handle limited uses
      if (data.uses_per_day !== undefined) {
        const used = data.uses_used || 0;
        const remaining = data.uses_per_day - used;
        
        embed.addFields({ 
          name: '📊 Uses Remaining', 
          value: `${remaining - quantity}/${data.uses_per_day}`,
          inline: false 
        });

        needsUpdate = true;
        updates = {
          features: character.features.map(feature => 
            feature.name === data.name 
              ? { ...feature, uses_used: used + quantity }
              : feature
          )
        };
      }

      // Handle features with rolls
      if (data.roll_formula) {
        const rollResult = rollDice(data.roll_formula);
        embed.addFields({ 
          name: '🎲 Roll', 
          value: `${data.roll_formula}: **${rollResult.total}**`,
          inline: false 
        });
        roll = `🎲 Roll for ${data.name}: [${rollResult.rolls.join(', ')}] = **${rollResult.total}**`;
      }
      break;

    case 'action':
      const actionResult = handleAction(data.action, character, target);
      embed.addFields({ 
        name: '⚔️ Action', 
        value: actionResult.description,
        inline: false 
      });

      if (actionResult.roll) {
        embed.addFields({ 
          name: '🎲 Roll', 
          value: actionResult.roll.formula + ': **' + actionResult.roll.total + '**',
          inline: false 
        });
        roll = `🎲 ${actionResult.roll.name}: [${actionResult.roll.rolls.join(', ')}] = **${actionResult.roll.total}**`;
      }
      break;
  }

  embed.setFooter({ text: `${character.name} • ${type.charAt(0).toUpperCase() + type.slice(1)} used` })
    .setTimestamp();

  return { embed, roll, needsUpdate, updates };
}

/**
 * Handle common actions
 */
function handleAction(action, character, target) {
  const abilityScores = character.ability_scores || {};
  
  switch (action) {
    case 'attack':
      return {
        description: 'Make an attack roll. Use `/roll` for specific attack dice.',
        roll: null
      };

    case 'dash':
      return {
        description: `You can move additional distance equal to your speed (${character.speed || 30} ft).`,
        roll: null
      };

    case 'dodge':
      return {
        description: 'Until the start of your next turn, any attack roll made against you has disadvantage if you can see the attacker.',
        roll: null
      };

    case 'help':
      return {
        description: 'You lend aid to another creature in the completion of a task. The creature gains advantage on their next ability check.',
        roll: null
      };

    case 'hide':
      const stealthMod = Math.floor((abilityScores.dexterity || 10 - 10) / 2);
      const stealthRoll = rollDice(`1d20+${stealthMod}`);
      return {
        description: 'You make a Dexterity (Stealth) check to hide.',
        roll: {
          name: 'Stealth Check',
          formula: `1d20+${stealthMod}`,
          ...stealthRoll
        }
      };

    case 'search':
      const wisMod = Math.floor((abilityScores.wisdom || 10 - 10) / 2);
      const intMod = Math.floor((abilityScores.intelligence || 10 - 10) / 2);
      const perceptionRoll = rollDice(`1d20+${wisMod}`);
      return {
        description: 'You make a Wisdom (Perception) check to find something hidden.',
        roll: {
          name: 'Perception Check',
          formula: `1d20+${wisMod}`,
          ...perceptionRoll
        }
      };

    case 'ready':
      return {
        description: 'You can ready an action to trigger later when a specific condition is met.',
        roll: null
      };

    case 'use_object':
      return {
        description: 'You interact with an object in the environment. This could include opening a door, picking up an item, etc.',
        roll: null
      };

    default:
      return {
        description: 'Action performed.',
        roll: null
      };
  }
}

/**
 * Roll dice
 */
function rollDice(formula) {
  const match = formula.match(/(\d+)d(\d+)(?:\s*([+-]\s*\d+))?/);
  if (!match) {
    return { formula, total: 0, rolls: [] };
  }

  const [, count, sides, modifier] = match;
  const numDice = parseInt(count);
  const numSides = parseInt(sides);
  const mod = modifier ? parseInt(modifier.replace(/\s/g, '')) : 0;

  const rolls = [];
  for (let i = 0; i < numDice; i++) {
    rolls.push(Math.floor(Math.random() * numSides) + 1);
  }

  const total = rolls.reduce((a, b) => a + b, 0) + mod;

  return { formula, total, rolls };
}

/**
 * Get color for embed based on type
 */
function getColorForType(type) {
  switch (type) {
    case 'item': return 0x95A5A6;
    case 'feature': return 0x9B59B6;
    case 'action': return 0xE67E22;
    default: return 0x3498DB;
  }
}

/**
 * Get icon for embed based on type
 */
function getIconForType(type) {
  switch (type) {
    case 'item': return '🎒';
    case 'feature': return '🎭';
    case 'action': return '⚔️';
    default: return '✨';
  }
}

/**
 * Update character data in the database
 */
async function updateCharacterData(characterId, updates) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase not configured');
  }

  const updateData = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/dicecloud_characters?id=eq.${characterId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify(updateData)
    }
  );

  if (!response.ok) {
    throw new Error('Failed to update character data');
  }

  return await response.json();
}
