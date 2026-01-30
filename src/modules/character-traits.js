/**
 * Character Traits Module
 *
 * Handles trait objects, initialization, checking, and resource management.
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 *
 * Functions exported to globalThis:
 * - initRacialTraits()
 * - initFeatTraits()
 * - initClassFeatures()
 * - checkRacialTraits(rollResult, rollType, rollName)
 * - checkFeatTraits(rollResult, rollType, rollName)
 * - getBardicInspirationResource()
 * - useBardicInspiration()
 * - updateLuckyButtonText()
 *
 * State variables exported to globalThis:
 * - activeRacialTraits
 * - activeFeatTraits
 */

(function() {
  'use strict';

  // ===== STATE =====

  // Track active racial traits for the character
  let activeRacialTraits = [];

  // Track active feat and class feature traits
  let activeFeatTraits = [];

  // ===== TRAIT OBJECTS =====

  // Halfling Luck Racial Trait
  const HalflingLuck = {
    name: 'Halfling Luck',
    description: 'When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',

    onRoll: function(rollResult, rollType, rollName) {
      debug.log(`🧬 Halfling Luck onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);
      debug.log(`🧬 Halfling Luck DEBUG - rollType exists: ${!!rollType}, includes d20: ${rollType && rollType.includes('d20')}, rollResult === 1: ${parseInt(rollResult) === 1}`);

      // Convert rollResult to number for comparison
      const numericRollResult = parseInt(rollResult);

      // Check if it's a d20 roll and the result is 1
      if (rollType && rollType.includes('d20') && numericRollResult === 1) {
        debug.log(`🧬 Halfling Luck: TRIGGERED! Roll was ${numericRollResult}`);

        // Show the popup with error handling
        try {
          showHalflingLuckPopup({
            rollResult: numericRollResult,
            baseRoll: numericRollResult,
            rollType: rollType,
            rollName: rollName
          });
        } catch (error) {
          debug.error('❌ Error showing Halfling Luck popup:', error);
          // Fallback notification
          showNotification('🍀 Halfling Luck triggered! Check console for details.', 'info');
        }

        return true; // Trait triggered
      }

      debug.log(`🧬 Halfling Luck: No trigger - Roll: ${numericRollResult}, Type: ${rollType}`);
      return false; // No trigger
    }
  };

  // Lucky Feat Trait
  const LuckyFeat = {
    name: 'Lucky',
    description: 'You have 3 luck points. When you make an attack roll, ability check, or saving throw, you can spend one luck point to roll an additional d20. You can then choose which of the d20 rolls to use.',

    onRoll: function(rollResult, rollType, rollName) {
      debug.log(`🎖️ Lucky feat onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

      // Convert rollResult to number for comparison
      const numericRollResult = parseInt(rollResult);

      // Check if it's a d20 roll (attack, ability check, or saving throw)
      if (rollType && rollType.includes('d20')) {
        debug.log(`🎖️ Lucky: Checking if we should offer reroll for ${numericRollResult}`);

        // Check if character has luck points available
        const luckyResource = getLuckyResource();
        if (!luckyResource || luckyResource.current <= 0) {
          debug.log(`🎖️ Lucky: No luck points available (${luckyResource?.current || 0})`);
          return false;
        }

        debug.log(`🎖️ Lucky: Has ${luckyResource.current} luck points available`);

        // For Lucky feat, we offer reroll on any roll (not just 1s)
        // But we should prioritize low rolls
        if (numericRollResult <= 10) { // Offer reroll on rolls of 10 or less
          debug.log(`🎖️ Lucky: TRIGGERED! Offering reroll for roll ${numericRollResult}`);

          // Show the Lucky popup with error handling
          try {
            showLuckyPopup({
              rollResult: numericRollResult,
              baseRoll: numericRollResult,
              rollType: rollType,
              rollName: rollName,
              luckPointsRemaining: luckyResource.current
            });
          } catch (error) {
            debug.error('❌ Error showing Lucky popup:', error);
            // Fallback notification
            showNotification('🎖️ Lucky triggered! Check console for details.', 'info');
          }

          return true; // Trait triggered
        }
      }

      debug.log(`🎖️ Lucky: No trigger - Roll: ${numericRollResult}, Type: ${rollType}`);
      return false; // No trigger
    }
  };

  // Elven Accuracy
  const ElvenAccuracy = {
    name: 'Elven Accuracy',
    description: 'Whenever you have advantage on an attack roll using Dexterity, Intelligence, Wisdom, or Charisma, you can reroll one of the dice once.',

    onRoll: function(rollResult, rollType, rollName) {
      debug.log(`🧝 Elven Accuracy onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

      // Check if it's an attack roll with advantage using DEX/INT/WIS/CHA
      // The rollType should contain "advantage" and the roll should be an attack
      if (rollType && rollType.includes('advantage') && rollType.includes('attack')) {
        debug.log(`🧝 Elven Accuracy: TRIGGERED! Offering to reroll lower die`);

        // Show popup asking if they want to reroll
        showElvenAccuracyPopup({
          rollName: rollName,
          rollType: rollType,
          rollResult: rollResult
        });

        return true;
      }

      return false;
    }
  };

  // Dwarven Resilience
  const DwarvenResilience = {
    name: 'Dwarven Resilience',
    description: 'You have advantage on saving throws against poison.',

    onRoll: function(rollResult, rollType, rollName) {
      debug.log(`⛏️ Dwarven Resilience onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

      // Check if it's a poison save
      const lowerRollName = rollName.toLowerCase();
      if (rollType && rollType.includes('save') && lowerRollName.includes('poison')) {
        debug.log(`⛏️ Dwarven Resilience: TRIGGERED! Auto-applying advantage`);
        showNotification('⛏️ Dwarven Resilience: Advantage on poison saves!', 'success');
        return true;
      }

      return false;
    }
  };

  // Gnome Cunning
  const GnomeCunning = {
    name: 'Gnome Cunning',
    description: 'You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic.',

    onRoll: function(rollResult, rollType, rollName) {
      debug.log(`🎩 Gnome Cunning onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

      // Check if it's an INT/WIS/CHA save against magic
      const lowerRollName = rollName.toLowerCase();
      const isMentalSave = lowerRollName.includes('intelligence') ||
                           lowerRollName.includes('wisdom') ||
                           lowerRollName.includes('charisma') ||
                           lowerRollName.includes('int save') ||
                           lowerRollName.includes('wis save') ||
                           lowerRollName.includes('cha save');

      const isMagic = lowerRollName.includes('spell') ||
                      lowerRollName.includes('magic') ||
                      lowerRollName.includes('charm') ||
                      lowerRollName.includes('illusion');

      if (rollType && rollType.includes('save') && isMentalSave && isMagic) {
        debug.log(`🎩 Gnome Cunning: TRIGGERED! Auto-applying advantage`);
        showNotification('🎩 Gnome Cunning: Advantage on mental saves vs magic!', 'success');
        return true;
      }

      return false;
    }
  };

  // Reliable Talent (Rogue 11+)
  const ReliableTalent = {
    name: 'Reliable Talent',
    description: 'Whenever you make an ability check that lets you add your proficiency bonus, you treat a d20 roll of 9 or lower as a 10.',

    onRoll: function(rollResult, rollType, rollName) {
      debug.log(`🎯 Reliable Talent onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

      const numericRollResult = parseInt(rollResult);

      // Check if it's a skill check (proficient skills would be marked somehow)
      if (rollType && rollType.includes('skill') && numericRollResult < 10) {
        debug.log(`🎯 Reliable Talent: TRIGGERED! Minimum roll is 10`);
        showNotification(`🎯 Reliable Talent: ${numericRollResult} becomes 10!`, 'success');
        return true;
      }

      return false;
    }
  };

  // Jack of All Trades (Bard)
  const JackOfAllTrades = {
    name: 'Jack of All Trades',
    description: 'You can add half your proficiency bonus (rounded down) to any ability check you make that doesn\'t already include your proficiency bonus.',

    onRoll: function(rollResult, rollType, rollName) {
      debug.log(`🎵 Jack of All Trades onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

      // This would need to check if the skill is non-proficient
      // For now, we'll show a reminder
      if (rollType && rollType.includes('skill')) {
        const profBonus = characterData.proficiencyBonus || 2;
        const halfProf = Math.floor(profBonus / 2);
        debug.log(`🎵 Jack of All Trades: Reminder to add +${halfProf} if non-proficient`);
        showNotification(`🎵 Jack: Add +${halfProf} if non-proficient`, 'info');
        return true;
      }

      return false;
    }
  };

  // Rage Damage Bonus (Barbarian)
  const RageDamageBonus = {
    name: 'Rage',
    description: 'While raging, you gain bonus damage on melee weapon attacks using Strength.',

    onRoll: function(rollResult, rollType, rollName) {
      debug.log(`😡 Rage Damage onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

      // Check if character is raging (would need rage tracking)
      const isRaging = characterData.conditions && characterData.conditions.some(c =>
        c.toLowerCase().includes('rage') || c.toLowerCase().includes('raging')
      );

      if (isRaging && rollType && rollType.includes('attack')) {
        const level = characterData.level || 1;
        const rageDamage = level < 9 ? 2 : level < 16 ? 3 : 4;
        debug.log(`😡 Rage Damage: TRIGGERED! Adding +${rageDamage} damage`);
        showNotification(`😡 Rage: Add +${rageDamage} damage!`, 'success');
        return true;
      }

      return false;
    }
  };

  // Brutal Critical (Barbarian)
  const BrutalCritical = {
    name: 'Brutal Critical',
    description: 'You can roll one additional weapon damage die when determining the extra damage for a critical hit with a melee attack.',

    onRoll: function(rollResult, rollType, rollName) {
      debug.log(`💥 Brutal Critical onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

      const numericRollResult = parseInt(rollResult);

      // Check for natural 20 on melee attack
      if (rollType && rollType.includes('attack') && numericRollResult === 20) {
        const level = characterData.level || 1;
        const extraDice = level < 13 ? 1 : level < 17 ? 2 : 3;
        debug.log(`💥 Brutal Critical: TRIGGERED! Roll ${extraDice} extra weapon die/dice`);
        showNotification(`💥 Brutal Critical: Roll ${extraDice} extra weapon die!`, 'success');
        return true;
      }

      return false;
    }
  };

  // Portent Dice (Divination Wizard)
  const PortentDice = {
    name: 'Portent',
    description: 'Roll two d20s and record the numbers. You can replace any attack roll, saving throw, or ability check made by you or a creature you can see with one of these rolls.',

    portentRolls: [], // Store portent rolls for the day

    rollPortentDice: function() {
      const roll1 = Math.floor(Math.random() * 20) + 1;
      const roll2 = Math.floor(Math.random() * 20) + 1;
      this.portentRolls = [roll1, roll2];
      debug.log(`🔮 Portent: Rolled ${roll1} and ${roll2}`);
      showNotification(`🔮 Portent: You rolled ${roll1} and ${roll2}`, 'info');
      return this.portentRolls;
    },

    usePortentRoll: function(index) {
      if (index >= 0 && index < this.portentRolls.length) {
        const roll = this.portentRolls.splice(index, 1)[0];
        debug.log(`🔮 Portent: Used portent roll ${roll}`);
        showNotification(`🔮 Portent: Applied roll of ${roll}`, 'success');
        return roll;
      }
      return null;
    },

    onRoll: function(rollResult, rollType, rollName) {
      // Portent is applied manually, not automatically triggered
      if (this.portentRolls.length > 0) {
        showNotification(`🔮 ${this.portentRolls.length} Portent dice available`, 'info');
      }
      return false;
    }
  };

  // Wild Magic Surge Table (d100)
  const WILD_MAGIC_EFFECTS = [
    "Roll on this table at the start of each of your turns for the next minute, ignoring this result on subsequent rolls.",
    "Roll on this table at the start of each of your turns for the next minute, ignoring this result on subsequent rolls.",
    "For the next minute, you can see any invisible creature if you have line of sight to it.",
    "For the next minute, you can see any invisible creature if you have line of sight to it.",
    "A modron chosen and controlled by the DM appears in an unoccupied space within 5 feet of you, then disappears 1 minute later.",
    "A modron chosen and controlled by the DM appears in an unoccupied space within 5 feet of you, then disappears 1 minute later.",
    "You cast Fireball as a 3rd-level spell centered on yourself.",
    "You cast Fireball as a 3rd-level spell centered on yourself.",
    "You cast Magic Missile as a 5th-level spell.",
    "You cast Magic Missile as a 5th-level spell.",
    "Roll a d10. Your height changes by a number of inches equal to the roll. If the roll is odd, you shrink. If the roll is even, you grow.",
    "Roll a d10. Your height changes by a number of inches equal to the roll. If the roll is odd, you shrink. If the roll is even, you grow.",
    "You cast Confusion centered on yourself.",
    "You cast Confusion centered on yourself.",
    "For the next minute, you regain 5 hit points at the start of each of your turns.",
    "For the next minute, you regain 5 hit points at the start of each of your turns.",
    "You grow a long beard made of feathers that remains until you sneeze, at which point the feathers explode out from your face.",
    "You grow a long beard made of feathers that remains until you sneeze, at which point the feathers explode out from your face.",
    "You cast Grease centered on yourself.",
    "You cast Grease centered on yourself.",
    "Creatures have disadvantage on saving throws against the next spell you cast in the next minute that involves a saving throw.",
    "Creatures have disadvantage on saving throws against the next spell you cast in the next minute that involves a saving throw.",
    "Your skin turns a vibrant shade of blue. A Remove Curse spell can end this effect.",
    "Your skin turns a vibrant shade of blue. A Remove Curse spell can end this effect.",
    "An eye appears on your forehead for the next minute. During that time, you have advantage on Wisdom (Perception) checks that rely on sight.",
    "An eye appears on your forehead for the next minute. During that time, you have advantage on Wisdom (Perception) checks that rely on sight.",
    "For the next minute, all your spells with a casting time of 1 action have a casting time of 1 bonus action.",
    "For the next minute, all your spells with a casting time of 1 action have a casting time of 1 bonus action.",
    "You teleport up to 60 feet to an unoccupied space of your choice that you can see.",
    "You teleport up to 60 feet to an unoccupied space of your choice that you can see.",
    "You are transported to the Astral Plane until the end of your next turn, after which time you return to the space you previously occupied or the nearest unoccupied space if that space is occupied.",
    "You are transported to the Astral Plane until the end of your next turn, after which time you return to the space you previously occupied or the nearest unoccupied space if that space is occupied.",
    "Maximize the damage of the next damaging spell you cast within the next minute.",
    "Maximize the damage of the next damaging spell you cast within the next minute.",
    "Roll a d10. Your age changes by a number of years equal to the roll. If the roll is odd, you get younger (minimum 1 year old). If the roll is even, you get older.",
    "Roll a d10. Your age changes by a number of years equal to the roll. If the roll is odd, you get younger (minimum 1 year old). If the roll is even, you get older.",
    "1d6 flumphs controlled by the DM appear in unoccupied spaces within 60 feet of you and are frightened of you. They vanish after 1 minute.",
    "1d6 flumphs controlled by the DM appear in unoccupied spaces within 60 feet of you and are frightened of you. They vanish after 1 minute.",
    "You regain 2d10 hit points.",
    "You regain 2d10 hit points.",
    "You turn into a potted plant until the start of your next turn. While a plant, you are incapacitated and have vulnerability to all damage. If you drop to 0 hit points, your pot breaks, and your form reverts.",
    "You turn into a potted plant until the start of your next turn. While a plant, you are incapacitated and have vulnerability to all damage. If you drop to 0 hit points, your pot breaks, and your form reverts.",
    "For the next minute, you can teleport up to 20 feet as a bonus action on each of your turns.",
    "For the next minute, you can teleport up to 20 feet as a bonus action on each of your turns.",
    "You cast Levitate on yourself.",
    "You cast Levitate on yourself.",
    "A unicorn controlled by the DM appears in a space within 5 feet of you, then disappears 1 minute later.",
    "A unicorn controlled by the DM appears in a space within 5 feet of you, then disappears 1 minute later.",
    "You can't speak for the next minute. Whenever you try, pink bubbles float out of your mouth.",
    "You can't speak for the next minute. Whenever you try, pink bubbles float out of your mouth.",
    "A spectral shield hovers near you for the next minute, granting you a +2 bonus to AC and immunity to Magic Missile.",
    "A spectral shield hovers near you for the next minute, granting you a +2 bonus to AC and immunity to Magic Missile.",
    "You are immune to being intoxicated by alcohol for the next 5d6 days.",
    "You are immune to being intoxicated by alcohol for the next 5d6 days.",
    "Your hair falls out but grows back within 24 hours.",
    "Your hair falls out but grows back within 24 hours.",
    "For the next minute, any flammable object you touch that isn't being worn or carried by another creature bursts into flame.",
    "For the next minute, any flammable object you touch that isn't being worn or carried by another creature bursts into flame.",
    "You regain your lowest-level expended spell slot.",
    "You regain your lowest-level expended spell slot.",
    "For the next minute, you must shout when you speak.",
    "For the next minute, you must shout when you speak.",
    "You cast Fog Cloud centered on yourself.",
    "You cast Fog Cloud centered on yourself.",
    "Up to three creatures you choose within 30 feet of you take 4d10 lightning damage.",
    "Up to three creatures you choose within 30 feet of you take 4d10 lightning damage.",
    "You are frightened by the nearest creature until the end of your next turn.",
    "You are frightened by the nearest creature until the end of your next turn.",
    "Each creature within 30 feet of you becomes invisible for the next minute. The invisibility ends on a creature when it attacks or casts a spell.",
    "Each creature within 30 feet of you becomes invisible for the next minute. The invisibility ends on a creature when it attacks or casts a spell.",
    "You gain resistance to all damage for the next minute.",
    "You gain resistance to all damage for the next minute.",
    "A random creature within 60 feet of you becomes poisoned for 1d4 hours.",
    "A random creature within 60 feet of you becomes poisoned for 1d4 hours.",
    "You glow with bright light in a 30-foot radius for the next minute. Any creature that ends its turn within 5 feet of you is blinded until the end of its next turn.",
    "You glow with bright light in a 30-foot radius for the next minute. Any creature that ends its turn within 5 feet of you is blinded until the end of its next turn.",
    "You cast Polymorph on yourself. If you fail the saving throw, you turn into a sheep for the spell's duration.",
    "You cast Polymorph on yourself. If you fail the saving throw, you turn into a sheep for the spell's duration.",
    "Illusory butterflies and flower petals flutter in the air within 10 feet of you for the next minute.",
    "Illusory butterflies and flower petals flutter in the air within 10 feet of you for the next minute.",
    "You can take one additional action immediately.",
    "You can take one additional action immediately.",
    "Each creature within 30 feet of you takes 1d10 necrotic damage. You regain hit points equal to the sum of the necrotic damage dealt.",
    "Each creature within 30 feet of you takes 1d10 necrotic damage. You regain hit points equal to the sum of the necrotic damage dealt.",
    "You cast Mirror Image.",
    "You cast Mirror Image.",
    "You cast Fly on a random creature within 60 feet of you.",
    "You cast Fly on a random creature within 60 feet of you.",
    "You become invisible for the next minute. During that time, other creatures can't hear you. The invisibility ends if you attack or cast a spell.",
    "You become invisible for the next minute. During that time, other creatures can't hear you. The invisibility ends if you attack or cast a spell.",
    "If you die within the next minute, you immediately come back to life as if by the Reincarnate spell.",
    "If you die within the next minute, you immediately come back to life as if by the Reincarnate spell.",
    "Your size increases by one size category for the next minute.",
    "Your size increases by one size category for the next minute.",
    "You and all creatures within 30 feet of you gain vulnerability to piercing damage for the next minute.",
    "You and all creatures within 30 feet of you gain vulnerability to piercing damage for the next minute.",
    "You are surrounded by faint, ethereal music for the next minute.",
    "You are surrounded by faint, ethereal music for the next minute.",
    "You regain all expended sorcery points.",
    "You regain all expended sorcery points."
  ];

  // Wild Magic Surge (Wild Magic Sorcerer)
  const WildMagicSurge = {
    name: 'Wild Magic Surge',
    description: 'Immediately after you cast a sorcerer spell of 1st level or higher, the DM can have you roll a d20. If you roll a 1, roll on the Wild Magic Surge table.',

    onSpellCast: function(spellLevel) {
      if (spellLevel >= 1) {
        const surgeRoll = Math.floor(Math.random() * 20) + 1;
        debug.log(`🌀 Wild Magic: Rolled ${surgeRoll} for surge check`);

        if (surgeRoll === 1) {
          const surgeTableRoll = Math.floor(Math.random() * 100) + 1;
          const effect = WILD_MAGIC_EFFECTS[surgeTableRoll - 1];
          debug.log(`🌀 Wild Magic: SURGE! d100 = ${surgeTableRoll}: ${effect}`);
          showWildMagicSurgePopup(surgeTableRoll, effect);
          return true;
        } else {
          showNotification(`🌀 Wild Magic check: ${surgeRoll} (no surge)`, 'info');
        }
      }
      return false;
    },

    onRoll: function(rollResult, rollType, rollName) {
      // Wild Magic is triggered on spell cast, not regular rolls
      return false;
    }
  };

  // Bardic Inspiration (Bard)
  const BardicInspiration = {
    name: 'Bardic Inspiration',
    description: 'You can inspire others through stirring words or music. As a bonus action, grant an ally a Bardic Inspiration die they can add to an ability check, attack roll, or saving throw.',

    onRoll: function(rollResult, rollType, rollName) {
      debug.log(`🎵 Bardic Inspiration onRoll called with: ${rollResult}, ${rollType}, ${rollName}`);

      // Check if it's a d20 roll (ability check, attack, or save)
      if (rollType && rollType.includes('d20')) {
        debug.log(`🎵 Bardic Inspiration: Checking if we should offer inspiration for ${rollName}`);

        // Check if character has Bardic Inspiration uses available
        const inspirationResource = getBardicInspirationResource();
        if (!inspirationResource || inspirationResource.current <= 0) {
          debug.log(`🎵 Bardic Inspiration: No uses available (${inspirationResource?.current || 0})`);
          return false;
        }

        debug.log(`🎵 Bardic Inspiration: Has ${inspirationResource.current} uses available`);

        // Get the inspiration die size based on bard level
        const level = characterData.level || 1;
        const inspirationDie = level < 5 ? 'd6' : level < 10 ? 'd8' : level < 15 ? 'd10' : 'd12';

        // Offer Bardic Inspiration on any d20 roll
        debug.log(`🎵 Bardic Inspiration: TRIGGERED! Offering ${inspirationDie}`);

        // Show the Bardic Inspiration popup with error handling
        try {
          showBardicInspirationPopup({
            rollResult: parseInt(rollResult),
            baseRoll: parseInt(rollResult),
            rollType: rollType,
            rollName: rollName,
            inspirationDie: inspirationDie,
            usesRemaining: inspirationResource.current
          });
        } catch (error) {
          debug.error('❌ Error showing Bardic Inspiration popup:', error);
          // Fallback notification
          showNotification(`🎵 Bardic Inspiration available! (${inspirationDie})`, 'info');
        }

        return true; // Trait triggered
      }

      debug.log(`🎵 Bardic Inspiration: No trigger - Type: ${rollType}`);
      return false; // No trigger
    }
  };

  // ===== INITIALIZATION FUNCTIONS =====

  /**
   * Initialize racial traits based on character race
   */
  function initRacialTraits() {
    debug.log('🧬 Initializing racial traits...');
    debug.log('🧬 Character data:', characterData);
    debug.log('🧬 Character race:', characterData?.race);

    // Reset racial traits
    activeRacialTraits = [];

    if (!characterData || !characterData.race) {
      debug.log('🧬 No race data available');
      return;
    }

    const race = characterData.race.toLowerCase();

    // Halfling Luck
    if (race.includes('halfling')) {
      debug.log('🧬 Halfling detected, adding Halfling Luck trait');
      activeRacialTraits.push(HalflingLuck);
    }

    // Elven Accuracy (check for feat in features)
    if (characterData.features && characterData.features.some(f =>
      f.name && f.name.toLowerCase().includes('elven accuracy')
    )) {
      debug.log('🧝 Elven Accuracy feat detected');
      activeRacialTraits.push(ElvenAccuracy);
    }

    // Dwarven Resilience
    if (race.includes('dwarf')) {
      debug.log('⛏️ Dwarf detected, adding Dwarven Resilience trait');
      activeRacialTraits.push(DwarvenResilience);
    }

    // Gnome Cunning
    if (race.includes('gnome')) {
      debug.log('🎩 Gnome detected, adding Gnome Cunning trait');
      activeRacialTraits.push(GnomeCunning);
    }

    debug.log(`🧬 Initialized ${activeRacialTraits.length} racial traits`);
  }

  /**
   * Initialize feat traits based on character features
   */
  function initFeatTraits() {
    debug.log('🎖️ Initializing feat traits...');
    debug.log('🎖️ Character features:', characterData?.features);

    // Reset feat traits
    activeFeatTraits = [];

    if (!characterData || !characterData.features) {
      debug.log('🎖️ No features data available');
      return;
    }

    // Lucky feat is now handled as an action, not a trait
    debug.log('🎖️ Lucky feat will be available as an action button');

    debug.log(`🎖️ Initialized ${activeFeatTraits.length} feat traits`);
  }

  /**
   * Initialize class features based on character class and level
   */
  function initClassFeatures() {
    debug.log('⚔️ Initializing class features...');
    debug.log('⚔️ Character class:', characterData?.class);
    debug.log('⚔️ Character level:', characterData?.level);

    if (!characterData) {
      debug.log('⚔️ No character data available');
      return;
    }

    const characterClass = (characterData.class || '').toLowerCase();
    const level = characterData.level || 1;

    // Reliable Talent (Rogue 11+)
    if (characterClass.includes('rogue') && level >= 11) {
      debug.log('🎯 Rogue 11+ detected, adding Reliable Talent');
      activeFeatTraits.push(ReliableTalent);
    }

    // Bardic Inspiration (Bard)
    if (characterClass.includes('bard') && level >= 1) {
      debug.log('🎵 Bard detected, adding Bardic Inspiration');
      activeFeatTraits.push(BardicInspiration);
    }

    // Jack of All Trades (Bard)
    if (characterClass.includes('bard') && level >= 2) {
      debug.log('🎵 Bard detected, adding Jack of All Trades');
      activeFeatTraits.push(JackOfAllTrades);
    }

    // Rage Damage Bonus (Barbarian)
    if (characterClass.includes('barbarian')) {
      debug.log('😡 Barbarian detected, adding Rage Damage Bonus');
      activeFeatTraits.push(RageDamageBonus);
    }

    // Brutal Critical (Barbarian 9+)
    if (characterClass.includes('barbarian') && level >= 9) {
      debug.log('💥 Barbarian 9+ detected, adding Brutal Critical');
      activeFeatTraits.push(BrutalCritical);
    }

    // Portent (Divination Wizard 2+)
    if (characterClass.includes('wizard') && level >= 2) {
      // Check for Divination subclass in features
      const isDivination = characterData.features && characterData.features.some(f =>
        f.name && (f.name.toLowerCase().includes('divination') || f.name.toLowerCase().includes('portent'))
      );
      if (isDivination) {
        debug.log('🔮 Divination Wizard detected, adding Portent');
        activeFeatTraits.push(PortentDice);
        // Auto-roll portent dice
        PortentDice.rollPortentDice();
      }
    }

    // Wild Magic Surge (Wild Magic Sorcerer)
    if (characterClass.includes('sorcerer')) {
      // Check for Wild Magic subclass in features
      const isWildMagic = characterData.features && characterData.features.some(f =>
        f.name && f.name.toLowerCase().includes('wild magic')
      );
      if (isWildMagic) {
        debug.log('🌀 Wild Magic Sorcerer detected, adding Wild Magic Surge');
        activeFeatTraits.push(WildMagicSurge);
      }
    }

    debug.log(`⚔️ Initialized ${activeFeatTraits.length} class feature traits`);
  }

  // ===== CHECKING FUNCTIONS =====

  /**
   * Check racial traits for roll triggers
   * @param {number} rollResult - Roll result
   * @param {string} rollType - Type of roll
   * @param {string} rollName - Name of roll
   * @returns {boolean} Whether any trait was triggered
   */
  function checkRacialTraits(rollResult, rollType, rollName) {
    debug.log(`🧬 Checking racial traits for roll: ${rollResult} (${rollType}) - ${rollName}`);
    debug.log(`🧬 Active racial traits count: ${activeRacialTraits.length}`);

    let traitTriggered = false;

    for (const trait of activeRacialTraits) {
      if (trait.onRoll && typeof trait.onRoll === 'function') {
        const result = trait.onRoll(rollResult, rollType, rollName);
        if (result) {
          traitTriggered = true;
          debug.log(`🧬 ${trait.name} triggered!`);
        }
      }
    }

    return traitTriggered;
  }

  /**
   * Check feat traits for roll triggers
   * @param {number} rollResult - Roll result
   * @param {string} rollType - Type of roll
   * @param {string} rollName - Name of roll
   * @returns {boolean} Whether any trait was triggered
   */
  function checkFeatTraits(rollResult, rollType, rollName) {
    debug.log(`🎖️ Checking feat traits for roll: ${rollResult} (${rollType}) - ${rollName}`);
    debug.log(`🎖️ Active feat traits count: ${activeFeatTraits.length}`);

    let traitTriggered = false;

    for (const trait of activeFeatTraits) {
      if (trait.onRoll && typeof trait.onRoll === 'function') {
        const result = trait.onRoll(rollResult, rollType, rollName);
        if (result) {
          traitTriggered = true;
          debug.log(`🎖️ ${trait.name} triggered!`);
        }
      }
    }

    return traitTriggered;
  }

  // ===== RESOURCE MANAGEMENT =====

  /**
   * Get Bardic Inspiration resource from character data
   * @returns {Object|null} Bardic Inspiration resource object
   */
  function getBardicInspirationResource() {
    if (!characterData || !characterData.resources) {
      debug.log('🎵 No characterData or resources for Bardic Inspiration detection');
      return null;
    }

    // Find Bardic Inspiration in resources (flexible matching)
    const inspirationResource = characterData.resources.find(r => {
      const lowerName = r.name.toLowerCase().trim();
      return (
        lowerName.includes('bardic inspiration') ||
        lowerName === 'bardic inspiration' ||
        lowerName === 'inspiration' ||
        lowerName.includes('inspiration die') ||
        lowerName.includes('inspiration dice')
      );
    });

    if (inspirationResource) {
      debug.log(`🎵 Found Bardic Inspiration resource: ${inspirationResource.name} (${inspirationResource.current}/${inspirationResource.max})`);
    } else {
      debug.log('🎵 No Bardic Inspiration resource found in character data');
    }

    return inspirationResource;
  }

  /**
   * Use one Bardic Inspiration charge
   * @returns {boolean} Whether the use was successful
   */
  function useBardicInspiration() {
    debug.log('🎵 useBardicInspiration called');
    const inspirationResource = getBardicInspirationResource();
    debug.log('🎵 Bardic Inspiration resource found:', inspirationResource);

    if (!inspirationResource) {
      debug.error('❌ No Bardic Inspiration resource found');
      return false;
    }

    if (inspirationResource.current <= 0) {
      debug.error(`❌ No Bardic Inspiration uses available (current: ${inspirationResource.current})`);
      return false;
    }

    // Decrement Bardic Inspiration uses
    const oldCurrent = inspirationResource.current;
    inspirationResource.current--;

    debug.log(`✅ Used Bardic Inspiration (${oldCurrent} → ${inspirationResource.current})`);

    // Save to storage
    browserAPI.storage.local.set({ characterData: characterData });

    // Refresh resources display
    buildResourcesDisplay();

    return true;
  }

  /**
   * Update Lucky button text with remaining points
   */
  function updateLuckyButtonText() {
    const luckyButton = document.querySelector('#lucky-action-button');
    if (luckyButton) {
      const luckyResource = getLuckyResource();
      if (luckyResource) {
        const pointsText = luckyResource.current > 0 ? ` (${luckyResource.current}/3)` : ' (0/3)';
        luckyButton.textContent = `🎖️ Lucky${pointsText}`;
      }
    }
  }

  // ===== EXPORTS =====

  // Export functions to globalThis
  globalThis.initRacialTraits = initRacialTraits;
  globalThis.initFeatTraits = initFeatTraits;
  globalThis.initClassFeatures = initClassFeatures;
  globalThis.checkRacialTraits = checkRacialTraits;
  globalThis.checkFeatTraits = checkFeatTraits;
  globalThis.getBardicInspirationResource = getBardicInspirationResource;
  globalThis.useBardicInspiration = useBardicInspiration;
  globalThis.updateLuckyButtonText = updateLuckyButtonText;

  // Export state variables to globalThis
  globalThis.activeRacialTraits = activeRacialTraits;
  globalThis.activeFeatTraits = activeFeatTraits;

  debug.log('✅ Character Traits module loaded');

})();
