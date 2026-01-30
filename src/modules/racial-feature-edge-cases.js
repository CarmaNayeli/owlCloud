/**
 * Racial Features Edge Cases Configuration
 *
 * This file contains all the racial features that need special handling
 * beyond standard attack/damage/healing buttons.
 */

const RACIAL_FEATURE_EDGE_CASES = {
  // ===== HALFLING FEATURES =====
  'lucky': {
    type: 'reroll',
    trigger: 'roll_1_on_attack_save_or_check',
    condition: 'self_or_ally_within_30_feet',
    effect: 'reroll_the_die',
    description: 'Reroll 1s on attacks/saves/checks (self or ally within 30ft)'
  },
  'brave': {
    type: 'save_advantage',
    condition: 'save_against_frightened',
    effect: 'advantage',
    description: 'Advantage on saves against being frightened'
  },
  'halfling nimbleness': {
    type: 'movement_enhancement',
    effect: 'can_move_through_space_of_creature_larger_than_you',
    description: 'Move through space of creatures larger than you'
  },

  // ===== DWARF FEATURES =====
  'dwarven resilience': {
    type: 'damage_resistance_and_save_advantage',
    damageType: 'poison',
    saveAdvantage: 'poison_saves',
    description: 'Poison resistance + advantage on poison saves'
  },
  'stonecunning': {
    type: 'skill_bonus',
    condition: 'intelligence_check_recall_information_about_stonework',
    effect: 'double_proficiency_bonus',
    description: 'Double prof bonus on stonework history checks'
  },
  'dwarven toughness': {
    type: 'hp_increase',
    effect: '+1_hp_per_level',
    description: '+1 HP per level'
  },

  // ===== ELF FEATURES =====
  'fey ancestry': {
    type: 'save_advantage_and_immunity',
    saveAdvantage: 'charmed_saves',
    immunity: 'magic_sleep',
    description: 'Advantage on charm saves + immune to magic sleep'
  },
  'trance': {
    type: 'rest_replacement',
    effect: 'meditate_4_hours_instead_of_sleep_8_hours',
    description: 'Meditate 4 hours instead of sleeping 8 hours'
  },
  'mask of the wild': {
    type: 'stealth_enhancement',
    condition: 'in_natural_surroundings',
    effect: 'attempt_to_hide_even_only_lightly_obscured',
    description: 'Hide in natural surroundings when only lightly obscured'
  },

  // ===== HUMAN FEATURES =====
  'variant human': {
    type: 'customizable',
    options: ['skill_proficiency', 'feat'],
    description: 'Choose 1 skill proficiency + 1 feat'
  },

  // ===== DRAGONBORN FEATURES =====
  'breath weapon': {
    type: 'area_damage',
    actionType: 'action',
    recharge: 'short_rest',
    area: '15_foot_cone_30_foot_line',
    damageFormula: '2d6',
    damageType: 'chosen_draconic_ancestry',
    saveType: 'dexterity',
    saveDC: '8 + con_mod + prof_bonus',
    description: 'Cone/line damage, Dex save for half'
  },
  'damage resistance': {
    type: 'damage_resistance',
    damageType: 'chosen_draconic_ancestry',
    description: 'Resistance to chosen damage type'
  },

  // ===== GNOME FEATURES =====
  'gnome cunning': {
    type: 'save_advantage',
    saveTypes: ['intelligence', 'wisdom', 'charisma'],
    effect: 'advantage',
    description: 'Advantage on Int/Wis/Cha saves'
  },
  'artificer\'s lore': {
    type: 'skill_bonus',
    condition: 'intelligence_check_magical_technological_item',
    effect: 'double_proficiency_bonus',
    description: 'Double prof bonus on magic/tech item checks'
  },
  'tinker': {
    type: 'crafting_ability',
    options: ['tiny_clockwork_device', 'explosive_device', 'minor_magic_item'],
    description: 'Create tiny clockwork devices, explosives, or minor magic items'
  },

  // ===== HALF-ORC FEATURES =====
  'relentless endurance': {
    type: 'death_prevention',
    trigger: 'reduced_to_0_hp_but_not_killed',
    effect: 'drop_to_1_hp_instead',
    resource: 'once_per_long_rest',
    description: 'Drop to 1 HP instead of 0 (once per long rest)'
  },
  'savage attacks': {
    type: 'damage_bonus',
    trigger: 'critical_hit_with_melee_weapon',
    effect: 'add_one_damage_die',
    description: 'Add one damage die to melee crits'
  },

  // ===== HALF-ELF FEATURES =====
  'skill versatility': {
    type: 'skill_proficiency',
    effect: 'two_skill_proficiencies',
    description: 'Choose two skill proficiencies'
  },
  'fey ancestry': {
    type: 'save_advantage_and_immunity',
    saveAdvantage: 'charmed_saves',
    immunity: 'magic_sleep',
    description: 'Advantage on charm saves + immune to magic sleep'
  },

  // ===== TIEFLING FEATURES =====
  'hellish resistance': {
    type: 'damage_resistance',
    damageType: 'fire',
    description: 'Fire resistance'
  },
  'innate spellcasting': {
    type: 'innate_magic',
    spells: ['thaumaturgy', 'hellish_rebuke', 'darkness'],
    spellLevels: [0, 1, 2],
    description: 'Innate ability to cast Thaumaturgy, Hellish Rebuke, Darkness'
  },

  // ===== AASIMAR FEATURES =====
  'celestial resistance': {
    type: 'damage_resistance_and_save_advantage',
    damageTypes: ['necrotic', 'radiant'],
    saveAdvantage: 'charmed_frightened_saves',
    description: 'Necrotic/radiant resistance + advantage on charm/frighten saves'
  },
  'healing hands': {
    type: 'healing',
    resource: 'once_per_long_rest',
    healingFormula: 'character_level',
    action: 'touch',
    description: 'Heal HP equal to your level (once per long rest)'
  },
  'light bearer': {
    type: 'light_cantrip',
    spell: 'light',
    description: 'Can cast Light cantrip at will'
  },
  'necrotic shroud': {
    type: 'area_effect',
    actionType: 'bonus_action',
    resource: 'once_per_long_rest',
    area: '10_foot_radius',
    duration: '1_minute',
    effects: [
      'frightened_creatures_in_area',
      'extra_necrotic_damage_against_frightened'
    ],
    description: 'Frighten creatures in 10ft, extra necrotic damage vs frightened'
  },
  'radiant consumption': {
    type: 'area_damage_and_buff',
    actionType: 'bonus_action',
    resource: 'once_per_long_rest',
    area: '10_foot_radius',
    duration: '1_minute',
    effects: [
      'radiant_damage_to_hostile_creatures',
      'radiant_damage_to_self',
      'bright_light'
    ],
    description: 'Radiant damage to enemies + self, bright light'
  },
  'radiant soul': {
    type: 'flight_and_damage',
    actionType: 'bonus_action',
    resource: 'once_per_long_rest',
    duration: '1_minute',
    effects: [
      'fly_speed_equal_to_walking_speed',
      'extra_radiant_damage'
    ],
    description: 'Fly + extra radiant damage'
  },
  'transformed': {
    type: 'transformation',
    actionType: 'action',
    resource: 'once_per_long_rest',
    duration: '1_minute',
    effects: [
      'special_armor_class',
      'special_weapons',
      'fear_aura',
      'once_per_turn_blinding_light'
    ],
    description: 'Transform with special AC, weapons, fear aura, blinding light'
  },

  // ===== FIRBOLG FEATURES =====
  'firbolg magic': {
    type: 'innate_magic',
    spells: ['detect_magic', 'disguise_self'],
    description: 'Innate Detect Magic + Disguise Self'
  },
  'hidden step': {
    type: 'stealth',
    actionType: 'bonus_action',
    resource: 'once_per_short_rest',
    effect: 'invisible_until_next_turn_or_attack_or_cast_spell',
    description: 'Bonus action invisibility until next turn/attack/cast'
  },
  'speech of beast and leaf': {
    type: 'communication',
    effects: [
      'communicate_with_beasts_and_plants',
      'cannot_be_charmed_or_frightened_by_elementals_or_fey'
    ],
    description: 'Talk to beasts/plants + immune to elemental/fey charm/frighten'
  },
  'powerful build': {
    type: 'carry_capacity',
    effect: 'double_carry_capacity_push_pull_lift',
    description: 'Double carry/push/pull/lift capacity'
  },

  // ===== GOLIATH FEATURES =====
  'stone\'s endurance': {
    type: 'damage_reduction',
    timing: 'reaction',
    trigger: 'take_damage',
    effect: 'reduce_damage_by_1d12_plus_con_mod',
    resource: 'once_per_short_rest',
    description: 'Reaction: reduce damage by 1d12 + Con mod'
  },
  'powerful build': {
    type: 'carry_capacity',
    effect: 'double_carry_capacity_push_pull_lift',
    description: 'Double carry/push/pull/lift capacity'
  },
  'mountain born': {
    type: 'environmental_adaptation',
    effects: ['cold_resistance', 'acclimated_to_high_altitude'],
    description: 'Cold resistance + acclimated to high altitude'
  },

  // ===== KENKU FEATURES =====
  'mimicry': {
    type: 'sound_imitation',
    effect: 'mimic_sounds_heard',
    limitation: 'cannot_create_new_sounds',
    description: 'Mimic sounds heard, cannot create new sounds'
  },
  'expert forgery': {
    type: 'skill_bonus',
    condition: 'forgery_duplications',
    effect: 'add_double_proficiency_bonus',
    description: 'Double prof bonus on forgery attempts'
  },

  // ===== LIZARDFOLK FEATURES =====
  'bite': {
    type: 'natural_weapon',
    damageFormula: '1d4',
    damageType: 'piercing',
    description: 'Natural bite attack'
  },
  'cunning artisan': {
    type: 'crafting_ability',
    effect: 'craft_simple_weapon_from_corpse_bones',
    limitation: 'one_per_long_rest',
    description: 'Craft simple weapon from corpse/bone (1 per long rest)'
  },
  'hold breath': {
    type: 'survival_ability',
    effect: 'hold_breath_for_15_minutes',
    description: 'Hold breath for 15 minutes'
  },
  'natural armor': {
    type: 'armor_class',
    baseAC: '13 + dexterity_modifier',
    limitation: 'cannot_wear_armor',
    description: 'AC 13 + Dex (no armor)'
  },
  'hungry jaws': {
    type: 'bonus_action_attack',
    actionType: 'bonus_action',
    resource: 'once_per_short_rest',
    damageFormula: '1d6',
    damageType: 'piercing',
    condition: 'must_hit_with_attack',
    description: 'Bonus action bite attack for 1d6 piercing'
  },

  // ===== TABAXI FEATURES =====
  'cat\'s claws': {
    type: 'natural_weapon',
    damageFormula: '1d4',
    damageType: 'slashing',
    description: 'Natural claw attacks (unarmed)'
  },
  'cat\'s talent': {
    type: 'skill_bonus',
    skills: ['stealth', 'perception'],
    effect: 'double_proficiency_bonus',
    description: 'Double prof bonus in Stealth and Perception'
  },
  'feline agility': {
    type: 'movement_boost',
    trigger: 'move_on_turn',
    effect: 'double_speed_until_end_of_turn',
    limitation: 'once_per_turn',
    resetType: 'special', // Resets when you move 0 feet on a turn, NOT on rest
    description: 'Double speed until end of turn. Recharges when you move 0 feet on a turn (not on rest).'
  },

  // ===== TRITON FEATURES =====
  'amphibious': {
    type: 'environmental_adaptation',
    effects: ['breathe_air_and_water', 'swim_speed_40ft'],
    description: 'Breathe air/water + 40ft swim speed'
  },
  'control air and water': {
    type: 'elemental_control',
    spells: ['fog_cloud', 'gust_of_wind', 'wall_of_water'],
    description: 'Cast Fog Cloud, Gust of Wind, Wall of Water'
  },
  'guardian of the depths': {
    type: 'environmental_resistance',
    condition: '10_minutes_in_crushing_pressure',
    effect: 'resistance_to_cold_damage',
    description: 'Cold resistance after 10min in crushing pressure'
  },
  'emissary of the sea': {
    type: 'communication',
    effects: [
      'communicate_simple_ideas_with_beasts_aquatic',
      'understand_any_language_aquatic'
    ],
    description: 'Talk to aquatic beasts + understand aquatic languages'
  },

  // ===== VERDAN FEATURES =====
  'black blood healing': {
    type: 'healing',
    trigger: 'take_poison_damage',
    effect: 'regain_hp_equal_to_poison_damage_taken',
    description: 'Regain HP when taking poison damage'
  },
  'persuasive': {
    type: 'skill_bonus',
    skills: ['persuasion', 'deception'],
    effect: 'advantage',
    description: 'Advantage on Persuasion and Deception checks'
  },
  'limited telepathy': {
    type: 'telepathy',
    range: '30_feet',
    condition: 'creatures_understand_at_least_one_language',
    description: '30ft telepathy with creatures that know a language'
  },

  // ===== CHANGELING FEATURES =====
  'shapechanger': {
    type: 'transformation',
    actionType: 'action',
    effect: 'polymorph_into_humanoid',
    limitation: 'same_size_and_sex',
    description: 'Shapechange into humanoid of same size/sex'
  },
  'deceptive': {
    type: 'skill_bonus',
    skills: ['deception', 'stealth'],
    effect: 'advantage',
    description: 'Advantage on Deception and Stealth checks'
  },

  // ===== SATYR FEATURES =====
  'fey magic': {
    type: 'innate_magic',
    spells: ['druidcraft', 'charm_person'],
    description: 'Innate Druidcraft + Charm Person'
  },
  'mirthful leapers': {
    type: 'movement_enhancement',
    effects: [
      'jump_distance_doubled',
      'advantage_on_strength_athletics_checks_to_jump'
    ],
    description: 'Double jump distance + advantage on jump Athletics checks'
  },
  'reveler': {
    type: 'skill_bonus',
    skills: ['acrobatics', 'persuasion'],
    effect: 'advantage',
    description: 'Advantage on Acrobatics and Persuasion checks'
  },

  // ===== OWLIN FEATURES =====
  'flight': {
    type: 'flight',
    speed: 'walking_speed',
    limitation: 'medium_armor_only',
    description: 'Fly at walking speed (medium armor only)'
  },
  'silent hunt': {
    type: 'stealth_enhancement',
    effect: 'no_disadvantage_on_stealth_checks_from_perception',
    description: 'No disadvantage on Stealth from Perception'
  },

  // ===== LEONIN FEATURES =====
  'daunting roar': {
    type: 'area_effect',
    actionType: 'action',
    resource: 'once_per_short_rest',
    area: '10_foot_radius',
    duration: '1_minute',
    effects: [
      'frightened_creatures_in_area',
      'creatures_can_use_save_to_end_effect_early'
    ],
    saveType: 'wisdom',
    saveDC: '8 + strength_mod + prof_bonus',
    description: 'Frighten creatures in 10ft for 1 minute (Wis save)'
  },
  'damage resistance': {
    type: 'damage_resistance',
    damageType: 'necrotic',
    description: 'Necrotic resistance'
  },
  'leonine agility': {
    type: 'defense_bonus',
    condition: 'not_wearing_heavy_armor',
    effect: 'advantage_on_dexterity_saving_throws',
    description: 'Advantage on Dex saves (not heavy armor)'
  },

  // ===== RAVENITE FEATURES =====
  'fire resistance': {
    type: 'damage_resistance',
    damageType: 'fire',
    description: 'Fire resistance'
  },
  'wings of the raven': {
    type: 'flight',
    speed: '30_feet',
    limitation: 'no_heavy_armor',
    description: '30ft fly speed (no heavy armor)'
  },

  // ===== GITH FEATURES =====
  'astral knowledge': {
    type: 'skill_bonus',
    effect: 'proficient_in_two_skills',
    description: 'Choose two skill proficiencies'
  },
  'gith psionics': {
    type: 'innate_magic',
    spells: ['mage_hand', 'jump', 'misty_step'],
    description: 'Innate Mage Hand, Jump, Misty Step'
  },
  'decadent mastery': {
    type: 'skill_bonus',
    effect: 'proficient_with_light_armor',
    description: 'Light armor proficiency'
  },
  'void resistance': {
    type: 'damage_resistance_and_save_advantage',
    damageTypes: ['psychic', 'force'],
    saveAdvantage: 'charmed_frightened_saves',
    description: 'Psychic/force resistance + advantage on charm/frighten saves'
  },

  // ===== MISSING RACES =====
  'warf forged': {
    type: 'defense_calculation',
    effect: 'integrated_protection',
    description: 'AC calculation includes integrated protection'
  },
  'warf constructed resilience': {
    type: 'immunity',
    effects: ['poison_resistance', 'disease_resistance', 'advantage_vs_poison_disease_saves'],
    description: 'Various immunities and resistances'
  },
  'aarakocra': {
    type: 'flight_ability',
    effect: 'fly_speed',
    description: 'Flight speed'
  },
  'bugbear surprise attack': {
    type: 'surprise_attack',
    effect: 'advantage_on_attack_against_surprised_creatures',
    description: 'Surprise attack advantage'
  },
  'bugbear long-limbed': {
    type: 'reach_extension',
    effect: '5ft_reach',
    description: 'Long-limbed reach'
  },
  'goblin fury of the small': {
    type: 'damage_bonus',
    condition: 'creature_larger_than_you',
    effect: 'bonus_damage',
    description: 'Bonus damage against larger creatures'
  },
  'goblin nimble escape': {
    type: 'disengage',
    actionType: 'bonus_action',
    effect: 'hide_as_bonus_action',
    description: 'Hide as bonus action'
  },
  'hobgoblin saving face': {
    type: 'reroll',
    trigger: 'failed_attack_or_check',
    effect: 'reroll_with_advantage',
    description: 'Reroll failed attack or check with advantage'
  },
  'kobold pack tactics': {
    type: 'attack_bonus',
    condition: 'ally_within_5ft',
    effect: 'advantage_on_attack',
    description: 'Advantage on attack when ally within 5ft'
  },
  'kobold sunlight sensitivity': {
    type: 'disadvantage',
    condition: 'in_sunlight',
    effect: 'disadvantage_on_attacks_and_perception_checks',
    description: 'Disadvantage in sunlight'
  },
  'orc aggressive': {
    type: 'movement_bonus',
    actionType: 'bonus_action',
    effect: 'dash_toward_enemy',
    description: 'Bonus action dash toward enemy'
  },
  'orc powerful build': {
    type: 'carry_capacity',
    effect: 'double_carrying_capacity',
    description: 'Double carrying capacity'
  },
  'yuan-ti pureblood': {
    type: 'immunity',
    effects: ['magic_resistance', 'poison_immunity'],
    description: 'Magic resistance + poison immunity'
  },
  'tortle natural armor': {
    type: 'defense_bonus',
    effect: 'ac_17_natural_armor',
    description: 'Natural armor AC 17'
  },
  'tortle shell defense': {
    type: 'defense_action',
    actionType: 'action',
    effect: 'add_shield_bonus_to_ac',
    description: 'Action to add shield bonus to AC'
  },
  'grung poison skin': {
    type: 'contact_poison',
    effect: 'poison_on_contact',
    description: 'Poison skin'
  },
  'grung standing leap': {
    type: 'movement_enhancement',
    effect: 'standing_jump',
    jumpDistance: 'height',
    description: 'Standing jump equal to height'
  },
  'centaur equine build': {
    type: 'movement_type',
    effects: ['cannot_be_ridden', 'no_climbing_swimming_costs_extra'],
    description: 'Equine build limitations'
  },
  'centaur hooves': {
    type: 'attack',
    actionType: 'action',
    damageFormula: '2d4 + strength_mod',
    description: 'Hooves attack'
  },
  'centaur charge': {
    type: 'attack_bonus',
    condition: 'move_at_least_20ft_straight_line',
    effect: 'bonus_damage',
    description: 'Bonus damage on charge'
  },

  // ===== 2024 RACIAL CHANGES =====
  'lucky (2024)': {
    type: 'advantage',
    trigger: 'roll_1_on_attack_save_or_check',
    condition: 'self_or_ally_within_30_feet',
    effect: 'advantage_instead_of_reroll',
    ruleset: '2024',
    description: 'Now gives advantage instead of rerolls'
  },
  'breath weapon (2024)': {
    type: 'damage_aoe',
    actionType: 'action',
    damageFormula: '2d6_dragon_breath',
    saveType: 'dexterity',
    saveDC: '8 + proficiency + con_mod',
    recharge: 'short_rest',
    ruleset: '2024',
    description: '2024 version of dragonborn breath weapon'
  }
};

/**
 * Check if a racial feature is an edge case
 */
function isRacialFeatureEdgeCase(featureName) {
  if (!featureName) return false;
  const lowerName = featureName.toLowerCase().trim();
  return RACIAL_FEATURE_EDGE_CASES.hasOwnProperty(lowerName);
}

/**
 * Get racial feature edge case configuration
 */
function getRacialFeatureEdgeCase(featureName) {
  if (!featureName) return null;
  const lowerName = featureName.toLowerCase().trim();
  return RACIAL_FEATURE_EDGE_CASES[lowerName] || null;
}

/**
 * Apply racial feature edge case modifications to action options
 */
function applyRacialFeatureEdgeCaseModifications(feature, options) {
  const edgeCase = getRacialFeatureEdgeCase(feature.name);
  if (!edgeCase) {
    return { options, skipNormalButtons: false };
  }

  const modifiedOptions = [...options];
  let skipNormalButtons = false;

  switch (edgeCase.type) {
    case 'innate_magic':
      // Add spell casting info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `🔮 ${edgeCase.spells.join(', ')}`;
      });
      break;

    case 'damage_resistance':
      // Add resistance info
      if (Array.isArray(edgeCase.damageTypes)) {
        modifiedOptions.forEach(opt => {
          opt.edgeCaseNote = `🛡️ Resistance to: ${edgeCase.damageTypes.join(', ')}`;
        });
      } else {
        modifiedOptions.forEach(opt => {
          opt.edgeCaseNote = `🛡️ Resistance to: ${edgeCase.damageType}`;
        });
      }
      break;

    case 'save_advantage':
      // Add save advantage info
      if (Array.isArray(edgeCase.saveTypes)) {
        modifiedOptions.forEach(opt => {
          opt.edgeCaseNote = `✅ Advantage on: ${edgeCase.saveTypes.join(', ')} saves`;
        });
      } else {
        modifiedOptions.forEach(opt => {
          opt.edgeCaseNote = `✅ Advantage on: ${edgeCase.saveAdvantage}`;
        });
      }
      break;

    case 'flight':
      // Add flight info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `🪶 Fly ${edgeCase.speed} ${edgeCase.limitation ? `(${edgeCase.limitation})` : ''}`;
      });
      break;

    case 'natural_weapon':
      // Add natural weapon info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `⚔️ ${edgeCase.damageFormula} ${edgeCase.damageType}`;
      });
      break;

    case 'telepathy':
      // Add telepathy info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `🧠 ${edgeCase.range} telepathy`;
      });
      break;

    case 'skill_bonus':
      // Add skill bonus info
      if (Array.isArray(edgeCase.skills)) {
        modifiedOptions.forEach(opt => {
          opt.edgeCaseNote = `📚 Bonus to: ${edgeCase.skills.join(', ')}`;
        });
      } else {
        modifiedOptions.forEach(opt => {
          opt.edgeCaseNote = `📚 ${edgeCase.condition}`;
        });
      }
      break;

    default:
      // Add description note for other types
      if (edgeCase.description) {
        modifiedOptions.forEach(opt => {
          opt.edgeCaseNote = edgeCase.description;
        });
      }
      break;
  }

  return { options: modifiedOptions, skipNormalButtons };
}

// Expose to globalThis for importScripts usage
if (typeof globalThis !== 'undefined') {
  globalThis.RACIAL_FEATURE_EDGE_CASES = RACIAL_FEATURE_EDGE_CASES;
  globalThis.isRacialFeatureEdgeCase = isRacialFeatureEdgeCase;
  globalThis.getRacialFeatureEdgeCase = getRacialFeatureEdgeCase;
  globalThis.applyRacialFeatureEdgeCaseModifications = applyRacialFeatureEdgeCaseModifications;
}
