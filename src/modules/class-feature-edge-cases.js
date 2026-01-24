/**
 * Class Features Edge Cases Configuration
 *
 * This file contains all the "weird" class features, racial features, and combat actions
 * that need special handling beyond standard attack/damage/healing buttons.
 *
 * Each feature can have:
 * - type: Category of edge case
 * - Custom properties for that category
 */

export const CLASS_FEATURE_EDGE_CASES = {
  // ===== BARBARIAN FEATURES =====
  'rage': {
    type: 'resource_tracking',
    resource: 'rage_points',
    maxResource: 'barbarian_level',
    duration: '1_minute',
    endCondition: 'no_attack_or_damage',
    description: 'Ends if no attack or damage since last turn'
  },
  'reckless attack': {
    type: 'advantage_disadvantage',
    selfAdvantage: 'attack',
    selfDisadvantage: 'defense',
    description: 'Advantage on attacks, disadvantage on attacks against you'
  },
  'danger sense': {
    type: 'conditional_advantage',
    condition: 'can_see_dex_save_source',
    appliesTo: 'dexterity_save',
    description: 'Advantage on Dex saves if you can see the source'
  },
  'relentless rage': {
    type: 'death_save',
    trigger: 'drop_to_0_hp_while_raging',
    saveType: 'constitution',
    baseDC: 10,
    dcIncrement: 5,
    resetCondition: 'short_rest',
    description: 'Con save to drop to 1 HP instead of 0'
  },
  'persistent rage': {
    type: 'override_condition',
    overrides: 'rage_end_condition',
    description: 'Rage doesn\'t end from not attacking/taking damage'
  },
  'retaliation': {
    type: 'reaction',
    timing: 'when_damaged_within_5ft',
    action: 'melee_attack',
    description: 'Reaction melee attack when damaged within 5ft'
  },

  // ===== FIGHTER FEATURES =====
  'action surge': {
    type: 'bonus_action',
    effect: 'additional_action',
    limitation: 'one_additional_action_even_with_multiple_uses',
    description: 'Take one additional action on your turn'
  },
  'second wind': {
    type: 'healing',
    actionType: 'bonus_action',
    healingFormula: '1d10 + fighter_level',
    resource: 'once_per_rest',
    description: 'Bonus action to regain HP'
  },
  'indomitable': {
    type: 'save_reroll',
    trigger: 'failed_save',
    resource: 'uses_per_long_rest',
    description: 'Reroll a failed save'
  },
  'riposte': {
    type: 'reaction',
    timing: 'when_melee_attack_misses_you',
    action: 'melee_attack',
    description: 'Reaction attack when melee attack misses you'
  },
  'parry': {
    type: 'reaction',
    timing: 'when_hit',
    effect: 'damage_reduction',
    formula: 'superiority_die + dex_mod',
    description: 'Reduce damage by superiority die + Dex mod'
  },
  'precision attack': {
    type: 'attack_bonus',
    timing: 'when_making_attack_roll',
    effect: 'add_superiority_die',
    description: 'Add superiority die to attack roll'
  },
  'eldritch strike': {
    type: 'debuff',
    trigger: 'weapon_attack_hit',
    effect: 'disadvantage_on_next_spell_save',
    duration: 'until_end_of_next_turn',
    description: 'Target has disadvantage on next save vs your spell'
  },
  'war magic': {
    type: 'bonus_action_combo',
    trigger: 'cast_cantrip',
    action: 'weapon_attack',
    description: 'Cast cantrip + bonus action weapon attack'
  },
  'arcane charge': {
    type: 'teleport',
    trigger: 'action_surge',
    distance: '30_feet',
    description: 'Teleport 30ft when using Action Surge'
  },

  // ===== ROGUE FEATURES =====
  'sneak attack': {
    type: 'conditional_damage',
    condition: 'advantage_or_ally_within_5ft',
    damageFormula: 'sneak_attack_dice',
    limitation: 'once_per_turn',
    description: 'Extra damage with advantage or ally adjacent'
  },
  'cunning action': {
    type: 'bonus_action',
    options: ['dash', 'disengage', 'hide'],
    description: 'Dash/Disengage/Hide as bonus action'
  },
  'uncanny dodge': {
    type: 'reaction',
    timing: 'when_hit_by_attack_you_can_see',
    effect: 'half_damage',
    description: 'Reaction to halve damage when hit'
  },
  'evasion': {
    type: 'save_modifier',
    saveType: 'dexterity',
    effect: 'no_damage_on_success_half_on_failure',
    description: 'Dex save: no damage on success, half on failure'
  },
  'reliable talent': {
    type: 'minimum_roll',
    appliesTo: 'proficient_ability_checks',
    minimum: 10,
    description: 'Treat rolls below 10 as 10 on proficient checks'
  },
  'blindsense': {
    type: 'senses',
    range: '10_feet',
    detects: 'hidden_invisible_creatures',
    description: 'Know location of hidden/invisible creatures within 10ft'
  },
  'slippery mind': {
    type: 'save_reroll',
    trigger: 'failed_wisdom_save',
    timing: 'reaction',
    resource: 'once_per_long_rest',
    description: 'Reaction to succeed on failed Wis save'
  },
  'elusive': {
    type: 'immunity',
    effect: 'no_advantage_against_you_when_visible',
    description: 'Attackers don\'t have advantage when they can see you'
  },
  'stroke of luck': {
    type: 'success_conversion',
    trigger: 'miss_attack_or_fail_ability_check',
    effect: 'turn_into_hit_or_success',
    resource: 'once_per_long_rest',
    description: 'Turn miss into hit or failure into success'
  },

  // ===== MONK FEATURES =====
  'flurry of blows': {
    type: 'bonus_action_attacks',
    trigger: 'take_attack_action',
    cost: '1_ki_point',
    attacks: 'two_unarmed_strikes',
    description: 'Bonus action: 2 unarmed strikes for 1 ki'
  },
  'patient defense': {
    type: 'bonus_action',
    cost: '1_ki_point',
    effect: 'dodge_action',
    description: 'Bonus action: Dodge for 1 ki'
  },
  'step of the wind': {
    type: 'bonus_action',
    cost: '1_ki_point',
    effects: ['disengage_or_dash', 'jump_distance_doubles'],
    description: 'Bonus action: Disengage/Dash + double jump distance'
  },
  'deflect missiles': {
    type: 'reaction',
    timing: 'when_hit_by_ranged_weapon',
    effect: 'damage_reduction',
    formula: '1d10 + dex_mod + monk_level',
    special: 'can_catch_and_throw_missile_for_1_ki',
    description: 'Reduce ranged damage, can throw back for 1 ki'
  },
  'slow fall': {
    type: 'damage_reduction',
    trigger: 'falling',
    formula: '5 × monk_level',
    description: 'Reduce falling damage by 5 × monk level'
  },
  'stunning strike': {
    type: 'save_effect',
    trigger: 'melee_weapon_attack_hit',
    cost: '1_ki_point',
    saveType: 'constitution',
    effect: 'stunned',
    description: 'Force Con save or be stunned (1 ki)'
  },
  'stillness of mind': {
    type: 'condition_end',
    timing: 'action',
    conditions: ['charmed', 'frightened'],
    description: 'Action to end charmed or frightened'
  },
  'purity of body': {
    type: 'immunity',
    effects: ['poison_immunity', 'disease_immunity'],
    description: 'Immune to poison and disease'
  },
  'diamond soul': {
    type: 'save_reroll',
    trigger: 'failed_save',
    cost: '1_ki_point',
    description: 'Reroll failed save for 1 ki'
  },
  'empty body': {
    type: 'defensive_buff',
    cost: '4_ki_points',
    effects: ['invisible', 'resistance_to_all_damage_except_force'],
    description: 'Invisible + resistance (except force) for 4 ki'
  },

  // ===== PALADIN FEATURES =====
  'divine smite': {
    type: 'resource_damage',
    trigger: 'melee_weapon_attack_hit',
    resource: 'spell_slot',
    damageFormula: '2d8 + 1d8_per_spell_level_above_1st',
    damageType: 'radiant',
    description: 'Expend spell slot for extra radiant damage'
  },
  'lay on hands': {
    type: 'healing_pool',
    resource: 'lay_on_hands_pool',
    poolSize: '5 × paladin_level',
    action: 'touch',
    description: 'Heal from pool (5 × level total)'
  },
  'divine sense': {
    type: 'senses',
    actionType: 'action',
    range: '60_feet',
    detects: ['celestials', 'fiends', 'undead'],
    description: 'Detect celestials/fiends/undead within 60ft'
  },
  'aura of protection': {
    type: 'save_bonus',
    range: '10_feet',
    bonus: 'charisma_modifier',
    appliesTo: 'saves',
    targets: 'self_and_allies',
    description: 'Allies within 10ft add Cha mod to saves'
  },
  'aura of courage': {
    type: 'immunity',
    range: '10_feet',
    effect: 'frightened_immunity',
    targets: 'self_and_allies',
    description: 'Allies within 10ft immune to frightened'
  },
  'cleansing touch': {
    type: 'spell_end',
    actionType: 'action',
    cost: 'uses_equal_to_charisma_modifier',
    effect: 'end_one_spell',
    description: 'End one spell on touched creature'
  },
  'avenging angel': {
    type: 'attack_penalty',
    range: '10_feet',
    condition: 'attack_target_other_than_you',
    effect: 'disadvantage',
    description: 'Disadvantage on attacks against others within 10ft'
  },
  'improved divine smite': {
    type: 'passive_damage',
    trigger: 'melee_weapon_hit',
    damageFormula: '1d8',
    damageType: 'radiant',
    description: 'Always deal +1d8 radiant on melee weapon hits'
  },

  // ===== RANGER FEATURES =====
  'favored enemy': {
    type: 'advantage',
    appliesTo: ['survival_checks_to_track', 'intelligence_checks_to_recall_info'],
    condition: 'against_favored_enemy',
    description: 'Advantage on tracking/recall checks vs favored enemy'
  },
  'natural explorer': {
    type: 'terrain_benefits',
    condition: 'in_favored_terrain',
    effects: [
      'difficult_terrain_no_slow',
      'cannot_get_lost_except_by_magic',
      'advantage_on_initiative_checks',
      'advantage_on_attacks_against_creatures_that_havent_acted_yet'
    ],
    description: 'Various benefits in favored terrain'
  },
  'hunter\'s mark': {
    type: 'conditional_damage',
    trigger: 'hit_marked_creature',
    damageFormula: '1d6',
    moveable: true,
    description: 'Extra 1d6 damage vs marked creature'
  },
  'colossus slayer': {
    type: 'conditional_damage',
    trigger: 'hit_creature_below_max_hp',
    damageFormula: '1d8',
    limitation: 'once_per_turn',
    description: 'Extra 1d8 damage vs creatures below max HP'
  },
  'horde breaker': {
    type: 'bonus_attack',
    trigger: 'attack_creature_with_enemy_within_5ft',
    condition: 'second_enemy_within_reach',
    description: 'Bonus attack against second enemy within 5ft'
  },
  'escape the horde': {
    type: 'defense_bonus',
    trigger: 'opportunity_attack_against_you',
    effect: 'disadvantage_on_attack',
    description: 'Opportunity attacks against you have disadvantage'
  },
  'multiattack defense': {
    type: 'defense_bonus',
    trigger: 'hit_by_attack',
    effect: '+4_ac_against_same_attacker_this_turn',
    description: '+4 AC against subsequent attacks from same attacker'
  },
  'vanish': {
    type: 'stealth',
    actionType: 'bonus_action',
    effect: 'hide_plus_cannot_be_tracked_nonmagically',
    description: 'Hide + cannot be tracked nonmagically'
  },

  // ===== CLERIC FEATURES =====
  'channel divinity': {
    type: 'resource_feature',
    resource: 'channel_divinity_uses',
    reset: 'short_rest',
    options: 'domain_specific',
    description: 'Domain-specific abilities (uses reset on short rest)'
  },
  'turn undead': {
    type: 'save_effect',
    actionType: 'action',
    saveType: 'wisdom',
    effect: 'turned_and_flee',
    targets: 'undead',
    description: 'Undead fail save = turned and must flee'
  },
  'destroy undead': {
    type: 'instant_kill',
    trigger: 'undead_fails_turn_undead_save',
    condition: 'cr_equal_or_below_threshold',
    description: 'Destroy weak undead that fail Turn Undead'
  },
  'divine intervention': {
    type: 'utility_dm_discretion',
    trigger: 'roll_d100_equal_or_below_cleric_level',
    cooldown: '7_days',
    description: 'Deity intervention on successful d100 roll'
  },
  'preserve life': {
    type: 'aoe_healing',
    resource: 'channel_divinity',
    healingFormula: '5 × cleric_level',
    distribution: 'among_creatures',
    description: 'Heal 5 × level distributed among creatures'
  },
  'wrath of the storm': {
    type: 'reaction_damage',
    timing: 'when_creature_within_5ft_hits_you',
    damageTypes: ['lightning', 'thunder'],
    description: 'Reaction lightning/thunder damage when hit within 5ft'
  },
  'blessed healer': {
    type: 'self_healing',
    trigger: 'cast_healing_spell_on_other',
    effect: 'regain_hp_equal_to_2_plus_spell_level',
    description: 'Heal yourself when healing others'
  },

  // ===== WIZARD FEATURES =====
  'arcane recovery': {
    type: 'resource_recovery',
    timing: 'short_rest',
    resource: 'spell_slots',
    formula: 'wizard_level ÷ 2_rounded_up',
    maxLevel: 'half_wizard_level',
    description: 'Recover spell slots during short rest'
  },
  'spell mastery': {
    type: 'at_will_casting',
    condition: 'chosen_1st_and_2nd_level_spells',
    effect: 'cast_without_slot',
    description: 'Cast chosen 1st/2nd level spells at will'
  },
  'signature spells': {
    type: 'free_casting',
    condition: 'two_chosen_3rd_level_spells',
    trigger: 'no_3rd_level_slots_remaining',
    limitation: 'once_each_per_long_rest',
    description: 'Free casting of chosen 3rd level spells when out of slots'
  },
  'sculpt spells': {
    type: 'save_modification',
    condition: 'evocation_spell',
    effect: 'choose_creatures_to_auto_succeed_and_take_no_damage',
    description: 'Protect allies from evocation spells'
  },
  'potent cantrip': {
    type: 'damage_modification',
    condition: 'cantrip_save_for_half_damage',
    effect: 'still_take_half_damage_on_save',
    description: 'Cantrips still deal half damage on successful save'
  },
  'empowered evocation': {
    type: 'damage_bonus',
    condition: 'evocation_spell',
    effect: 'add_int_modifier_to_one_damage_roll',
    description: 'Add Int mod to one evocation damage roll'
  },
  'overchannel': {
    type: 'max_damage',
    condition: '1st_to_5th_level_spell',
    effect: 'damage_rolls_are_maximum',
    drawback: 'take_necrotic_damage',
    description: 'Max damage but you take necrotic damage'
  },
  'portent': {
    type: 'roll_replacement',
    resource: 'portent_dice',
    trigger: 'attack_roll_save_or_ability_check',
    condition: 'creature_you_can_see',
    description: 'Replace roll with portent die'
  },
  'expert divination': {
    type: 'slot_recovery',
    trigger: 'cast_divination_spell_2nd_level_or_higher',
    effect: 'recover_spell_slot',
    maxLevel: 'half_spell_level_rounded_down',
    description: 'Recover spell slot after casting divination spells'
  },
  'benign transposition': {
    type: 'teleport',
    trigger: 'action_or_conjuration_spell_1st_level_or_higher',
    distance: '30_feet',
    options: ['teleport_self', 'swap_places_with_willing_creature'],
    description: 'Teleport or swap places when casting conjuration'
  },
  'instinctive charm': {
    type: 'reaction_redirect',
    timing: 'when_creature_attacks_you',
    effect: 'wisdom_save_to_redirect_attack',
    description: 'Reaction to redirect attack to another target'
  },

  // ===== SORCERER FEATURES =====
  'flexible casting': {
    type: 'resource_conversion',
    resource: 'sorcery_points',
    conversion: 'spell_slots_to_sorcery_points_and_vice_versa',
    description: 'Convert spell slots ↔ sorcery points'
  },
  'font of magic': {
    type: 'resource_recovery',
    timing: 'short_rest',
    resource: 'sorcery_points',
    amount: 'half_sorcery_points',
    limitation: 'once_per_long_rest',
    description: 'Regain half sorcery points on short rest'
  },
  'tides of chaos': {
    type: 'advantage_with_wild_magic_trigger',
    trigger: 'attack_roll_ability_check_or_save',
    effect: 'advantage',
    drawback: 'dm_may_trigger_wild_magic_surge',
    description: 'Advantage but may trigger Wild Magic surge'
  },

  // ===== WARLOCK FEATURES =====
  'pact magic': {
    type: 'resource_recovery',
    timing: 'short_rest',
    resource: 'all_spell_slots',
    description: 'Regain all spell slots on short rest'
  },
  'mystic arcanum': {
    type: 'limited_casting',
    resource: 'once_per_long_rest_per_spell',
    spellLevels: [6, 7, 8, 9],
    description: 'Cast 6th-9th level spells once per long rest each'
  },

  // ===== BARD FEATURES =====
  'bardic inspiration': {
    type: 'resource_die',
    resource: 'bardic_inspiration_die',
    duration: '10_minutes',
    trigger: 'attack_roll_ability_check_or_save',
    effect: 'add_die_to_roll',
    description: 'Give d6/d8/d10/d12 to add to rolls'
  },
  'jack of all trades': {
    type: 'skill_bonus',
    condition: 'non_proficient_ability_checks',
    bonus: 'half_proficiency_bonus',
    description: 'Add half prof bonus to non-proficient checks'
  },
  'song of rest': {
    type: 'healing_bonus',
    timing: 'short_rest',
    condition: 'allies_regain_hp',
    effect: 'extra_hp',
    formula: 'bardic_inspiration_die',
    description: 'Allies regain extra HP during short rest'
  },
  'countercharm': {
    type: 'save_bonus',
    range: '30_feet',
    condition: 'saves_against_frightened_or_charmed',
    effect: 'advantage',
    targets: 'self_and_allies',
    description: 'Advantage on saves vs frightened/charmed'
  },
  'cutting words': {
    type: 'roll_subtraction',
    trigger: 'attack_roll_ability_check_or_damage_roll',
    condition: 'creature_you_can_see',
    effect: 'subtract_bardic_inspiration_die',
    description: 'Subtract Bardic Inspiration die from enemy rolls'
  },
  'peerless skill': {
    type: 'roll_bonus',
    trigger: 'ability_check',
    effect: 'add_bardic_inspiration_die',
    description: 'Add Bardic Inspiration die to ability check'
  },
  'mantle of inspiration': {
    type: 'defensive_buff',
    actionType: 'bonus_action',
    cost: 'bardic_inspiration_die',
    effects: ['temp_hp_to_allies', 'reaction_movement'],
    description: 'Allies gain temp HP + reaction movement'
  },

  // ===== DRUID FEATURES =====
  'wild shape': {
    type: 'transformation',
    resource: 'uses',
    reset: 'short_rest',
    revertCondition: 'drop_to_0_hp',
    effect: 'revert_with_previous_hp',
    description: 'Transform into beast, revert with previous HP at 0 HP'
  },
  'combat wild shape': {
    type: 'wild_shape_enhancement',
    actionType: 'bonus_action',
    options: ['bonus_action_transform', 'expend_spell_slots_to_heal_in_beast_form'],
    description: 'Bonus action Wild Shape + heal in beast form'
  },
  'primal strike': {
    type: 'damage_enhancement',
    condition: 'in_beast_form',
    effect: 'attacks_count_as_magical',
    description: 'Beast form attacks count as magical'
  },
  'elemental wild shape': {
    type: 'wild_shape_enhancement',
    condition: 'wild_shape_use',
    options: ['transform_into_elemental'],
    description: 'Wild Shape into elementals instead of beasts'
  },
  'thousand forms': {
    type: 'at_will_spell',
    spell: 'alter_self',
    description: 'Cast Alter Self at will'
  },
  'circle forms': {
    type: 'wild_shape_enhancement',
    effect: 'higher_cr_beast_forms_based_on_level',
    description: 'Transform into higher CR beasts based on level'
  },
  'symbiotic entity': {
    type: 'alternative_wild_shape',
    condition: 'use_wild_shape_charges',
    effects: ['temp_hp', 'melee_damage_boost'],
    description: 'Temp HP + damage boost instead of transforming'
  }
};

/**
 * Check if a class feature is an edge case
 */
export function isClassFeatureEdgeCase(featureName) {
  if (!featureName) return false;
  const lowerName = featureName.toLowerCase().trim();
  return CLASS_FEATURE_EDGE_CASES.hasOwnProperty(lowerName);
}

/**
 * Get class feature edge case configuration
 */
export function getClassFeatureEdgeCase(featureName) {
  if (!featureName) return null;
  const lowerName = featureName.toLowerCase().trim();
  return CLASS_FEATURE_EDGE_CASES[lowerName] || null;
}

/**
 * Get all class features of a specific edge case type
 */
export function getClassFeaturesByType(type) {
  return Object.entries(CLASS_FEATURE_EDGE_CASES)
    .filter(([name, config]) => config.type === type)
    .map(([name, config]) => ({ name, ...config }));
}

/**
 * Get all class feature edge case types
 */
export function getAllClassFeatureEdgeCaseTypes() {
  const types = new Set();
  Object.values(CLASS_FEATURE_EDGE_CASES).forEach(config => {
    types.add(config.type);
  });
  return Array.from(types);
}

/**
 * Apply class feature edge case modifications to action options
 */
export function applyClassFeatureEdgeCaseModifications(feature, options) {
  const edgeCase = getClassFeatureEdgeCase(feature.name);
  if (!edgeCase) {
    return { options, skipNormalButtons: false };
  }

  const modifiedOptions = [...options];
  let skipNormalButtons = false;

  switch (edgeCase.type) {
    case 'utility_dm_discretion':
      // Skip all normal buttons, just show action button for DM-dependent features
      skipNormalButtons = true;
      break;

    case 'resource_tracking':
      // Add resource tracking info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `Resource: ${edgeCase.resource} (${edgeCase.maxResource})`;
      });
      break;

    case 'advantage_disadvantage':
      // Add advantage/disadvantage info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `⚖️ ${edgeCase.description}`;
      });
      break;

    case 'conditional_advantage':
      // Add condition for advantage
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `✅ ${edgeCase.condition}`;
      });
      break;

    case 'reaction':
      // Add reaction timing info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `⚡ ${edgeCase.timing}`;
      });
      break;

    case 'save_reroll':
      // Add reroll info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `🔄 ${edgeCase.trigger}`;
      });
      break;

    case 'bonus_action':
      // Add bonus action indicator
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `⚡ Bonus Action`;
      });
      break;

    case 'resource_damage':
      // Add resource cost info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `💰 Cost: ${edgeCase.resource}`;
      });
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
