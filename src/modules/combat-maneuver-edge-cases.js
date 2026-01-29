/**
 * Combat Maneuvers Edge Cases Configuration
 *
 * This file contains all the combat maneuvers and special combat actions
 * that need special handling beyond standard attack/damage/healing buttons.
 */

const COMBAT_MANEUVER_EDGE_CASES = {
  // ===== STANDARD COMBAT ACTIONS =====
  'grapple': {
    type: 'contest_check',
    actionType: 'action',
    attackType: 'athletics',
    defenseType: 'athletics_or_acrobatics',
    effect: 'grappled_condition',
    description: 'Athletics vs Athletics/Acrobatics to grapple target'
  },
  'shove': {
    type: 'contest_check',
    actionType: 'action',
    attackType: 'athletics',
    defenseType: 'athletics_or_acrobatics',
    effects: ['knock_prone', 'push_5_feet'],
    description: 'Athletics vs Athletics/Acrobatics to shove prone or push 5ft'
  },
  'opportunity attack': {
    type: 'reaction',
    timing: 'when_creature_leaves_your_reach',
    action: 'weapon_attack',
    limitation: 'one_per_creature_per_turn',
    description: 'Reaction attack when creature leaves your reach'
  },
  'ready action': {
    type: 'conditional_action',
    actionType: 'action',
    trigger: 'user_specified_condition',
    timing: 'reaction',
    description: 'Set trigger condition, then react with specified action'
  },
  'disarm': {
    type: 'contest_check',
    actionType: 'action',
    attackType: 'attack_roll',
    defenseType: 'athletics_or_acrobatics',
    effect: 'target_drops_item',
    description: 'Attack roll vs Athletics/Acrobatics to disarm target'
  },
  'overrun': {
    type: 'contest_check',
    actionType: 'action',
    attackType: 'athletics',
    defenseType: 'athletics_or_acrobatics',
    effect: 'move_through_space',
    description: 'Athletics vs Athletics/Acrobatics to move through space'
  },

  // ===== BATTLE MASTER MANEUVERS =====
  'bait and switch': {
    type: 'defensive_swap',
    cost: '1_superiority_die',
    timing: 'bonus_action',
    condition: 'move_within_5ft_of_ally',
    effect: 'swap_ac_bonuses',
    duration: '1_minute',
    description: 'Move near ally to swap AC bonuses for 1 minute'
  },
  'brace': {
    type: 'reaction_attack',
    cost: '1_superiority_die',
    timing: 'reaction',
    condition: 'creature_moves_into_your_reach',
    action: 'weapon_attack',
    description: 'Reaction attack when creature moves into reach'
  },
  'commander\'s strike': {
    type: 'ally_reaction',
    cost: '1_superiority_die',
    timing: 'on_your_turn',
    condition: 'forgo_one_attack',
    effect: 'ally_reaction_attack',
    description: 'Forgo attack to give ally reaction attack'
  },
  'disarming attack': {
    type: 'attack_with_debuff',
    cost: '1_superiority_die',
    timing: 'on_hit',
    condition: 'hit_attack',
    saveType: 'strength',
    saveFailure: 'drops_one_item',
    description: 'Hit + Str save or target drops item'
  },
  'distracting strike': {
    type: 'attack_with_debuff',
    cost: '1_superiority_die',
    timing: 'on_hit',
    condition: 'hit_attack',
    effect: 'next_attack_disadvantage',
    duration: 'until_your_next_turn',
    description: 'Hit - next attack vs target has disadvantage'
  },
  'evasive footwork': {
    type: 'bonus_action_defense',
    cost: '1_superiority_die',
    timing: 'bonus_action',
    condition: 'when_you_move',
    effect: 'add_superiority_die_to_ac',
    duration: 'until_you_stop_moving',
    description: 'Move + add superiority die to AC while moving'
  },
  'feinting attack': {
    type: 'bonus_action_setup',
    cost: '1_superiority_die',
    timing: 'bonus_action',
    condition: 'before_attack',
    effect: 'advantage_on_next_attack',
    description: 'Bonus action feint for advantage on next attack'
  },
  'goading attack': {
    type: 'attack_with_debuff',
    cost: '1_superiority_die',
    timing: 'on_hit',
    condition: 'hit_attack',
    saveType: 'wisdom',
    saveFailure: 'disadvantage_on_attacks_against_others',
    duration: '1_minute',
    description: 'Hit - Wis save or target has disadvantage on attacks vs others'
  },
  'lunging attack': {
    type: 'attack_enhancement',
    cost: '1_superiority_die',
    timing: 'when_making_attack',
    effect: 'increase_reach_by_5_feet',
    description: 'Increase reach by 5ft for this attack'
  },
  'maneuvering attack': {
    type: 'ally_movement',
    cost: '1_superiority_die',
    timing: 'on_hit',
    condition: 'hit_attack',
    effect: 'ally_reaction_move',
    distance: 'half_speed',
    description: 'Hit - ally can reaction move half speed without provoking'
  },
  'menacing attack': {
    type: 'attack_with_debuff',
    cost: '1_superiority_die',
    timing: 'on_hit',
    condition: 'hit_attack',
    saveType: 'wisdom',
    saveFailure: 'frightened_condition',
    duration: '1_minute',
    description: 'Hit - Wis save or target is frightened'
  },
  'pushing attack': {
    type: 'attack_with_debuff',
    cost: '1_superiority_die',
    timing: 'on_hit',
    condition: 'hit_attack',
    saveType: 'strength',
    saveFailure: 'push_15_feet',
    description: 'Hit - Str save or push target 15ft'
  },
  'rally': {
    type: 'ally_buff',
    cost: '1_superiority_die',
    timing: 'bonus_action',
    condition: 'ally_can_see_or_hear_you',
    effect: 'temp_hp',
    formula: 'superiority_die',
    description: 'Bonus action - ally gains temp HP equal to superiority die'
  },
  'riposte': {
    type: 'reaction_attack',
    cost: '1_superiority_die',
    timing: 'reaction',
    condition: 'melee_attack_misses_you',
    action: 'weapon_attack',
    description: 'Reaction attack when melee attack misses you'
  },
  'sweeping attack': {
    type: 'area_damage',
    cost: '1_superiority_die',
    timing: 'on_hit',
    condition: 'hit_creature_with_another_enemy_within_5ft',
    effect: 'damage_to_second_creature',
    formula: 'superiority_die',
    description: 'Hit creature - second creature within 5ft takes superiority die damage'
  },
  'trip attack': {
    type: 'attack_with_debuff',
    cost: '1_superiority_die',
    timing: 'on_hit',
    condition: 'hit_attack',
    saveType: 'strength',
    saveFailure: 'knocked_prone',
    description: 'Hit - Str save or target is knocked prone'
  },

  // ===== OPTIONAL COMBAT RULES =====
  'cleave': {
    type: 'bonus_attack',
    condition: 'reduce_creature_to_0_hp_with_melee_attack',
    effect: 'attack_another_creature_within_reach',
    limitation: 'once_per_turn',
    description: 'Reduce creature to 0 HP - bonus attack against another creature'
  },
  'mark': {
    type: 'debuff',
    actionType: 'bonus_action',
    condition: 'hit_creature_with_weapon_attack',
    effect: 'disadvantage_on_attacks_against_others',
    duration: 'until_your_next_turn',
    description: 'Hit - target has disadvantage on attacks vs others'
  },
  'shove aside': {
    type: 'movement_control',
    condition: 'hit_creature_with_melee_attack',
    effect: 'push_creature_5_feet_away',
    description: 'Hit - push creature 5ft away'
  },

  // ===== SPECIAL COMBAT SITUATIONS =====
  'flanking': {
    type: 'situational_advantage',
    condition: 'ally_opposite_side_of_enemy',
    effect: 'advantage_on_melee_attacks',
    description: 'Advantage on melee attacks when flanking with ally'
  },
  'help': {
    type: 'advantage_grant',
    actionType: 'action',
    effect: 'advantage_on_next_ability_check_or_attack_roll',
    target: 'ally',
    description: 'Give ally advantage on next check/attack'
  },
  'dodge': {
    type: 'defensive_action',
    actionType: 'action',
    effects: [
      'attacks_against_you_have_disadvantage',
      'dex_saves_advantage'
    ],
    duration: 'until_your_next_turn',
    description: 'Disadvantage on attacks vs you + advantage on Dex saves'
  },
  'hide': {
    type: 'stealth_action',
    actionType: 'action',
    requirement: 'cannot_be_seen',
    effect: 'hidden_condition',
    description: 'Become hidden if not seen'
  },
  'search': {
    type: 'investigation_action',
    actionType: 'action',
    effect: 'make_intelligence_investigation_check',
    description: 'Search area with Investigation check'
  },
  'improvise weapon': {
    type: 'weapon_substitution',
    effect: 'use_any_object_as_weapon',
    damage: '1d4',
    damageType: 'varies_by_object',
    description: 'Use any object as improvised weapon (1d4 damage)'
  },

  // ===== TWO-WEAPON FIGHTING =====
  'two-weapon fighting': {
    type: 'bonus_action_attack',
    condition: 'taking_attack_action_with_light_melee_weapon',
    requirement: 'must_have_light_melee_weapon_in_other_hand',
    effect: 'bonus_attack_with_offhand_weapon',
    damage: 'no_ability_modifier_to_damage',
    description: 'Bonus action attack with offhand light weapon (no mod to damage)'
  },

  // ===== DUAL WIELDER FEAT =====
  'dual wielder': {
    type: 'two_weapon_enhancement',
    effects: [
      'no_light_weapon_requirement',
      'use_two_handed_melee_weapon_in_one_hand',
      '+1_ac_while_dual_wielding'
    ],
    description: 'Dual wield non-light weapons +1 AC'
  },

  // ===== GRAPPLING SPECIAL CASES =====
  'escape grapple': {
    type: 'contest_check',
    actionType: 'action',
    attackType: 'athletics_or_acrobatics',
    defenseType: 'athletics',
    effect: 'end_grappled_condition',
    description: 'Athletics/Acrobatics vs Athletics to escape grapple'
  },
  'restrain with grapple': {
    type: 'contest_check',
    actionType: 'action',
    condition: 'already_grappling_target',
    attackType: 'athletics',
    defenseType: 'athletics',
    effect: 'restrained_condition',
    description: 'Athletics vs Athletics to restrain grappled target'
  },

  // ===== SHIELD SPECIAL CASES =====
  'shield bash': {
    type: 'bonus_action_attack',
    condition: 'wielding_shield',
    effect: 'melee_weapon_attack_with_shield',
    damage: '1d4_bludgeoning',
    description: 'Bonus action shield bash (1d4 bludgeoning)'
  },
  'shield master feat': {
    type: 'bonus_action_combo',
    condition: 'take_attack_action_while_wielding_shield',
    effect: 'shove_as_bonus_action',
    description: 'Attack action + bonus action shove with shield'
  },

  // ===== MOUNTED COMBAT =====
  'mount combat': {
    type: 'mounted_benefits',
    effects: [
      'advantage_on_attacks_against_creatures_smaller_than_mount',
      'mount_act_as_separate_creature',
      'can_use_mount_as_cover'
    ],
    description: 'Various benefits while mounted'
  },
  'dismount': {
    type: 'movement_action',
    actionType: 'half_action',
    effect: 'dismount_from_mount',
    description: 'Half action to dismount'
  },

  // ===== UNDERWATER COMBAT =====
  'underwater combat': {
    type: 'environmental_modifier',
    effects: [
      'ranged_weapon_attacks_have_disadvantage',
      'melee_weapon_attacks_with_thrown_weapons_have_disadvantage',
      'creatures_without_swim_speed_have_disadvantage_on_attacks'
    ],
    description: 'Underwater combat penalties'
  },

  // ===== COVER =====
  'half cover': {
    type: 'defense_bonus',
    effect: '+2_to_ac_and_dex_saves',
    description: '+2 AC and Dex saves'
  },
  'three-quarters cover': {
    type: 'defense_bonus',
    effect: '+5_to_ac_and_dex_saves',
    description: '+5 AC and Dex saves'
  },
  'total cover': {
    type: 'defense_immunity',
    effect: 'cannot_be_targeted_by_attacks_or_spells',
    description: 'Cannot be targeted by attacks or spells'
  },

  // ===== PRONE CONDITION =====
  'stand up': {
    type: 'movement_action',
    actionType: 'half_action',
    effect: 'end_prone_condition',
    description: 'Half action to stand from prone'
  },
  'attack prone creature': {
    type: 'attack_modifier',
    condition: 'target_prone_and_within_5_feet',
    effect: 'advantage_on_melee_attacks',
    description: 'Advantage on melee attacks vs prone within 5ft'
  },
  'ranged attack prone creature': {
    type: 'attack_modifier',
    condition: 'target_prone_and_beyond_5_feet',
    effect: 'disadvantage_on_ranged_attacks',
    description: 'Disadvantage on ranged attacks vs prone beyond 5ft'
  },

  // ===== MISSING COMBAT MANEUVERS =====
  'climbing onto a bigger creature': {
    type: 'contest_check',
    actionType: 'action',
    attackType: 'athletics',
    defenseType: 'athletics_or_acrobatics',
    condition: 'target_larger_than_you',
    effect: 'grapple_and_mount',
    description: 'Contest to grapple/mount larger creature'
  },
  'tumble': {
    type: 'contest_check',
    actionType: 'bonus_action',
    attackType: 'acrobatics',
    defenseType: 'acrobatics',
    effect: 'move_through_hostile_space',
    description: 'Acrobatics vs Acrobatics to move through hostile space'
  },
  'called shot': {
    type: 'attack_modifier',
    actionType: 'action',
    effect: 'disadvantage_for_specific_effect',
    condition: 'dm_discretion',
    description: 'Disadvantage to attack for specific effect (DM discretion)'
  },
  'disarm self': {
    type: 'free_action',
    actionType: 'free_action',
    effect: 'drop_item',
    description: 'Drop item as free action'
  },
  'don shield': {
    type: 'equipment_action',
    actionType: 'action',
    effect: 'equip_shield',
    description: 'Action to equip shield'
  },
  'doff shield': {
    type: 'equipment_action',
    actionType: 'action',
    effect: 'remove_shield',
    description: 'Action to remove shield'
  },
  'don armor': {
    type: 'equipment_action',
    actionType: 'time_based_action',
    effect: 'equip_armor',
    description: 'Time-based action to equip armor'
  },
  'doff armor': {
    type: 'equipment_action',
    actionType: 'time_based_action',
    effect: 'remove_armor',
    description: 'Time-based action to remove armor'
  },

  // ===== 2024 COMBAT MANEUVER CHANGES =====
  'grapple (2024)': {
    type: 'contest_check',
    actionType: 'action',
    attackType: 'athletics',
    defenseType: 'athletics_or_acrobatics',
    effect: 'grappled_condition',
    ruleset: '2024',
    description: '2024 version of grapple rules'
  },
  'shove (2024)': {
    type: 'contest_check',
    actionType: 'action',
    attackType: 'athletics',
    defenseType: 'athletics_or_acrobatics',
    effects: ['knock_prone', 'push_5_feet'],
    ruleset: '2024',
    description: '2024 version of shove rules'
  },

  // ===== 2024 WEAPON MASTERIES (NEW SYSTEM) =====
  'cleave': {
    type: 'weapon_mastery',
    condition: 'hit_creature',
    effect: 'hit_second_target_within_5ft',
    description: 'Hit second target within 5ft'
  },
  'graze': {
    type: 'weapon_mastery',
    condition: 'miss_attack',
    effect: 'damage_equal_to_ability_mod',
    description: 'Miss still deals damage equal to ability mod'
  },
  'nick': {
    type: 'weapon_mastery',
    condition: 'light_weapon',
    effect: 'extra_attack_no_bonus_action',
    description: 'Make extra attack with light weapon (no bonus action needed)'
  },
  'push': {
    type: 'weapon_mastery',
    condition: 'hit_creature',
    effect: 'push_10ft',
    description: 'Push 10ft on hit'
  },
  'sap': {
    type: 'weapon_mastery',
    condition: 'hit_creature',
    effect: 'disadvantage_on_next_attack',
    description: 'Disadvantage on next attack'
  },
  'slow': {
    type: 'weapon_mastery',
    condition: 'hit_creature',
    effect: 'reduce_speed_by_10ft',
    description: 'Reduce speed by 10ft'
  },
  'topple': {
    type: 'weapon_mastery',
    condition: 'hit_creature',
    effect: 'knock_prone_on_failed_con_save',
    description: 'Knock prone on failed CON save'
  },
  'vex': {
    type: 'weapon_mastery',
    condition: 'hit_creature',
    effect: 'advantage_on_next_attack_vs_same_target',
    description: 'Advantage on next attack vs same target'
  },

  // ===== 2024 FEATS SYSTEM =====
  'alert (2024)': {
    type: 'initiative_bonus',
    effect: 'add_proficiency_to_initiative',
    additionalEffect: 'cannot_be_surprised',
    ruleset: '2024',
    description: '+Initiative equal to proficiency, cannot be surprised'
  },
  'lucky (2024 feat)': {
    type: 'advantage',
    effect: 'advantage_instead_of_reroll',
    ruleset: '2024',
    description: 'Now gives advantage instead of rerolls'
  },
  'great weapon master (2024)': {
    type: 'attack_option',
    choice: 'redesigned_system',
    ruleset: '2024',
    description: 'Redesigned completely'
  },
  'sharpshooter (2024)': {
    type: 'attack_option',
    choice: 'redesigned_system',
    ruleset: '2024',
    description: 'Redesigned completely'
  }
};

/**
 * Check if a combat maneuver is an edge case
 */
function isCombatManeuverEdgeCase(maneuverName) {
  if (!maneuverName) return false;
  const lowerName = maneuverName.toLowerCase().trim();
  return COMBAT_MANEUVER_EDGE_CASES.hasOwnProperty(lowerName);
}

/**
 * Get combat maneuver edge case configuration
 */
function getCombatManeuverEdgeCase(maneuverName) {
  if (!maneuverName) return null;
  const lowerName = maneuverName.toLowerCase().trim();
  return COMBAT_MANEUVER_EDGE_CASES[lowerName] || null;
}

/**
 * Apply combat maneuver edge case modifications to action options
 */
function applyCombatManeuverEdgeCaseModifications(maneuver, options) {
  const edgeCase = getCombatManeuverEdgeCase(maneuver.name);
  if (!edgeCase) {
    return { options, skipNormalButtons: false };
  }

  const modifiedOptions = [...options];
  let skipNormalButtons = false;

  switch (edgeCase.type) {
    case 'contest_check':
      // Add contest check info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `⚔️ ${edgeCase.attackType} vs ${edgeCase.defenseType}`;
      });
      break;

    case 'reaction':
    case 'reaction_attack':
      // Add reaction timing info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `⚡ ${edgeCase.timing}`;
      });
      break;

    case 'bonus_action':
    case 'bonus_action_attack':
    case 'bonus_action_defense':
    case 'bonus_action_setup':
      // Add bonus action indicator
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `⚡ Bonus Action`;
      });
      break;

    case 'attack_with_debuff':
      // Add debuff info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `🎯 Hit + ${edgeCase.saveType} save or ${edgeCase.saveFailure}`;
      });
      break;

    case 'ally_reaction':
    case 'ally_movement':
    case 'ally_buff':
      // Add ally interaction info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `🤝 ${edgeCase.effect}`;
      });
      break;

    case 'area_damage':
      // Add area damage info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `💥 ${edgeCase.condition}: ${edgeCase.effect}`;
      });
      break;

    case 'situational_advantage':
      // Add situational advantage info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `✅ ${edgeCase.condition}`;
      });
      break;

    case 'defensive_action':
      // Add defensive action info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `🛡️ ${edgeCase.effects.join(', ')}`;
      });
      break;

    case 'environmental_modifier':
      // Add environmental modifier info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `🌍 ${edgeCase.effects.join(', ')}`;
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

// Expose to globalThis for importScripts usage
if (typeof globalThis !== 'undefined') {
  globalThis.COMBAT_MANEUVER_EDGE_CASES = COMBAT_MANEUVER_EDGE_CASES;
  globalThis.isCombatManeuverEdgeCase = isCombatManeuverEdgeCase;
  globalThis.getCombatManeuverEdgeCase = getCombatManeuverEdgeCase;
  globalThis.applyCombatManeuverEdgeCaseModifications = applyCombatManeuverEdgeCaseModifications;
}
