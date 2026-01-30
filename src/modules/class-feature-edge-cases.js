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

const CLASS_FEATURE_EDGE_CASES = {
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
  'brutal critical': {
    type: 'damage_bonus',
    timing: 'critical_hit',
    effect: 'extra_damage_dice',
    formula: 'barbarian_level // 2',
    description: 'Extra damage dice on critical hits (scales with level)'
  },
  'feral instinct': {
    type: 'initiative_bonus',
    effect: 'advantage_on_initiative',
    condition: 'while_raging',
    additionalEffect: 'cannot_be_surprised_while_raging',
    description: 'Advantage on initiative, cannot be surprised while raging'
  },
  'primal champion': {
    type: 'ability_score_increase',
    abilities: ['strength', 'constitution'],
    amount: 4,
    maxScore: 24,
    description: 'STR and CON increase by 4 (max 24)'
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
  'defensive duelist': {
    type: 'reaction',
    timing: 'when_attacked_with_finesse_weapon',
    effect: 'add_proficiency_to_ac',
    condition: 'wielding_finesse_weapon',
    description: 'Reaction to add proficiency to AC when wielding finesse weapon'
  },
  'great weapon master': {
    type: 'attack_option',
    choice: 'bonus_attack_on_crit_kill_or_minus_5_plus_10',
    penalty: 'minus_5_to_hit',
    bonus: 'plus_10_damage',
    condition: 'wielding_heavy_weapon',
    description: 'Bonus attack on crit/kill OR -5 to hit for +10 damage'
  },
  'sharpshooter': {
    type: 'attack_option',
    choice: 'ignore_cover_range_or_minus_5_plus_10',
    penalty: 'minus_5_to_hit',
    bonus: 'plus_10_damage',
    condition: 'using_ranged_weapon',
    effects: ['ignore_cover', 'ignore_range_penalty'],
    description: 'Ignore cover/range OR -5 to hit for +10 damage'
  },
  'lucky feat': {
    type: 'resource_tracking',
    resource: 'luck_points',
    maxResource: 3,
    resetCondition: 'long_rest',
    effect: 'reroll_or_force_enemy_reroll',
    description: '3 luck points to reroll or force enemy reroll'
  },
  'sentinel': {
    type: 'reaction_opportunities',
    effects: ['multiple_reaction_attacks', 'stop_creature_movement'],
    condition: 'opportunity_attack',
    description: 'Multiple reaction-based attack opportunities'
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
  'steady aim': {
    type: 'bonus_action',
    effect: 'advantage_on_next_attack',
    penalty: 'lose_movement',
    condition: 'ranged_attack',
    description: 'Bonus action to get advantage but lose movement'
  },
  'soul of deceit': {
    type: 'immunity',
    effects: ['immune_to_telepathy', 'immune_to_mind_reading'],
    description: 'Immune to telepathy/mind reading'
  },
  'death strike': {
    type: 'conditional_damage',
    condition: 'surprised_target',
    effect: 'double_damage',
    trigger: 'failed_save',
    saveType: 'constitution',
    description: 'Failed save = double damage on surprise'
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
  'deflect attacks': {
    type: 'reaction',
    timing: 'when_hit_by_attack',
    effect: 'damage_reduction',
    formula: '1d10 + dex_mod + monk_level',
    special: 'can_redirect_attack_for_1_ki',
    description: '2024 Monk: Reduce melee/ranged damage, can redirect for 1 ki'
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
  'wholeness of body': {
    type: 'healing',
    actionType: 'action',
    healingFormula: 'monk_level * 3',
    cost: 'action',
    description: 'Action to heal monk level × 3 HP'
  },
  'tongue of the sun and moon': {
    type: 'language_understanding',
    effect: 'understand_all_spoken_languages',
    description: 'Understand all spoken languages'
  },
  'timeless body': {
    type: 'immunity',
    effects: ['no_aging', 'no_food_water_requirements'],
    description: "Don't age, no food/water requirements"
  },
  'perfect self': {
    type: 'resource_recovery',
    trigger: 'start_turn_with_0_ki',
    effect: 'regain_4_ki_points',
    condition: 'start_of_turn',
    description: 'Regain 4 ki if you start turn with 0'
  },

  // ===== PALADIN FEATURES =====
  'divine smite': {
    type: 'divine_smite_modal',
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
  'divine health': {
    type: 'immunity',
    effect: 'disease_immunity',
    description: 'Immunity to disease'
  },
  'sacred weapon': {
    type: 'channel_divinity',
    actionType: 'bonus_action',
    effect: 'magical_weapon_plus_cha_to_attacks',
    duration: '1_minute',
    description: 'Channel Divinity for magical weapon + add CHA to attacks'
  },
  'turn the unholy': {
    type: 'channel_divinity',
    actionType: 'action',
    effect: 'turn_fiends_undead',
    saveType: 'charisma',
    saveDC: '8 + proficiency + cha_mod',
    description: 'Channel Divinity to turn fiends/undead'
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
  'primeval awareness': {
    type: 'senses',
    effect: 'detect_creature_types',
    range: '1_to_6_miles',
    description: 'Detect creature types within 1-6 miles'
  },
  'feral senses': {
    type: 'advantage_override',
    effect: 'no_disadvantage_on_attacks_vs_unseen_creatures',
    condition: 'creatures_you_cannot_see',
    description: "Can't have disadvantage on attacks vs creatures you can't see"
  },
  'foe slayer': {
    type: 'conditional_bonus',
    condition: 'once_per_turn',
    effect: 'add_wis_mod_to_attack_or_damage',
    appliesTo: ['attack_roll', 'damage_roll'],
    description: 'Add WIS mod to attack or damage once per turn'
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
  'disciple of life': {
    type: 'healing_bonus',
    effect: 'extra_healing',
    formula: '2_plus_spell_level',
    appliesTo: 'all_healing_spells',
    description: 'Extra 2+spell level healing'
  },
  'potent spellcasting': {
    type: 'damage_bonus',
    appliesTo: 'cantrip_damage',
    effect: 'add_wis_mod_to_damage',
    description: 'Add WIS mod to cantrip damage'
  },
  'divine strike': {
    type: 'conditional_damage',
    condition: 'weapon_attack',
    effect: 'extra_damage',
    formula: '1d8_domain_dependent_2d8_at_14th_level',
    description: 'Extra 1d8/2d8 damage (weapon dependent on domain)'
  },
  'corona of light': {
    type: 'save_penalty',
    appliesTo: 'enemy_saves',
    effects: ['disadvantage_vs_fire', 'disadvantage_vs_radiant'],
    condition: 'within_10_feet',
    description: 'Enemies have disadvantage on saves vs fire/radiant'
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
  'illusory reality': {
    type: 'illusion_enhancement',
    trigger: 'cast_illusion_spell',
    effect: 'make_illusion_object_real',
    duration: '1_minute',
    description: 'Make illusion object real for 1 minute'
  },
  'improved minor illusion': {
    type: 'spell_enhancement',
    appliesTo: 'minor_illusion',
    effect: 'create_sound_and_image_simultaneously',
    description: 'Can create sound AND image simultaneously'
  },
  'spell resistance': {
    type: 'defense_bonus',
    effects: ['advantage_on_saves_vs_spells', 'resistance_to_spell_damage'],
    description: 'Advantage on saves vs spells, resistance to spell damage'
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
  'metamagic variants': {
    type: 'spell_modification_options',
    options: [
      {
        name: 'quicken spell',
        effect: 'cast_as_bonus_action',
        cost: '2_sorcery_points'
      },
      {
        name: 'twinned spell',
        effect: 'target_second_creature',
        cost: '1_sorcery_point'
      },
      {
        name: 'heightened spell',
        effect: 'disadvantage_on_save',
        cost: '3_sorcery_points'
      },
      {
        name: 'empowered spell',
        effect: 'reroll_damage_dice',
        cost: '1_sorcery_point'
      },
      {
        name: 'subtle spell',
        effect: 'no_verbal_somatic_components',
        cost: '1_sorcery_point'
      },
      {
        name: 'distant spell',
        effect: 'double_range',
        cost: '1_sorcery_point'
      },
      {
        name: 'extended spell',
        effect: 'double_duration',
        cost: '1_sorcery_point'
      }
    ],
    description: 'Various spell modification options'
  },
  'elemental affinity': {
    type: 'damage_bonus',
    condition: 'draconic_origin_damage_type',
    effect: 'add_cha_mod_to_one_damage_roll',
    description: 'Add CHA mod to one damage roll of draconic type'
  },
  'bend luck': {
    type: 'reaction_roll_modification',
    timing: 'when_attack_save_or_check_made',
    effect: 'add_or_subtract_1d4',
    description: 'Reaction to add/subtract 1d4 from attack/save/check'
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
  'dark one\'s blessing': {
    type: 'healing_trigger',
    trigger: 'reduce_creature_to_0_hp',
    effect: 'gain_temp_hp',
    tempHpFormula: 'warlock_level',
    description: 'Temp HP when you reduce creature to 0'
  },
  'entropic ward': {
    type: 'reaction',
    timing: 'when_creature_succeeds_on_save_against_your_spell',
    effect: 'impose_disadvantage_then_advantage_on_next_attack',
    description: 'Reaction to impose disadvantage, then advantage on your next attack'
  },
  'thought shield': {
    type: 'defense_bonus',
    effects: ['resistance_to_psychic', 'reflect_psychic_damage'],
    description: 'Resistance to psychic + reflect damage'
  },
  'eldritch invocations': {
    type: 'feature_enhancement',
    notableOptions: [
      {
        name: 'agonizing blast',
        effect: 'add_cha_to_eldritch_blast_damage'
      },
      {
        name: 'repelling blast',
        effect: 'push_10ft_on_eldritch_blast_hit'
      },
      {
        name: 'devil\'s sight',
        effect: 'see_in_magical_darkness_120ft'
      },
      {
        name: 'mask of many faces',
        effect: 'at_will_disguise_self'
      }
    ],
    description: 'Various eldritch invocations (too many to list)'
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
  'magical secrets': {
    type: 'spell_learning',
    effect: 'learn_spells_from_other_classes',
    description: 'Learn spells from other classes'
  },
  'superior inspiration': {
    type: 'resource_recovery',
    trigger: 'roll_initiative_with_no_inspiration_left',
    effect: 'regain_one_use',
    description: 'Regain one use when you roll initiative with none left'
  },
  'incomparable performance': {
    type: 'social_aoe',
    actionType: 'action',
    range: '60_feet',
    effects: ['charm_creatures', 'frighten_creatures'],
    duration: '1_minute',
    description: 'Use action to charm/frighten creatures within 60ft'
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
  },
  'archdruid': {
    type: 'wild_shape_enhancement',
    effect: 'unlimited_wild_shapes',
    additionalEffects: ['ignore_verbal_somatic_components'],
    description: 'Unlimited wild shapes, ignore verbal/somatic components'
  },

  // ===== 2024 PHB CHANGES =====
  'barbarian rage (2024)': {
    type: 'resource_tracking',
    resource: 'rage_points',
    maxResource: 'barbarian_level',
    duration: '1_minute',
    endCondition: 'no_attack_or_damage',
    damageBonus: 'scales_with_level',
    ruleset: '2024',
    description: 'Now adds more damage based on level (not just +2/+3/+4)'
  },
  'fighter second wind (2024)': {
    type: 'healing',
    actionType: 'bonus_action',
    healingFormula: '1d10 + 2 × fighter_level',
    resource: 'once_per_rest',
    ruleset: '2024',
    description: 'Now 1d10 + 2×fighter level (was 1d10 + fighter level)'
  },
  'monk ki (2024)': {
    type: 'resource_tracking',
    resource: 'discipline_points_or_focus_points',
    ruleset: '2024',
    description: 'Now called Discipline Points or Focus Points in some versions'
  },
  'paladin divine smite (2024)': {
    type: 'resource_damage',
    trigger: 'melee_weapon_attack_hit',
    resource: 'spell_slot',
    condition: 'part_of_attack_action',
    ruleset: '2024',
    description: 'Now requires using a spell slot as part of the attack action (can\'t stockpile)'
  },
  'ranger favored enemy (2024)': {
    type: 'advantage',
    appliesTo: ['survival_checks_to_track', 'intelligence_checks_to_recall_info'],
    condition: 'against_favored_enemy',
    ruleset: '2024',
    description: 'Completely redesigned'
  },
  'sorcerer metamagic (2024)': {
    type: 'spell_modification_options',
    ruleset: '2024',
    description: 'Some options changed/rebalanced'
  },
  'warlock pact boon (2024)': {
    type: 'feature_enhancement',
    ruleset: '2024',
    description: 'Features associated with pacts changed significantly'
  },
  'bardic inspiration (2024)': {
    type: 'resource_die',
    resource: 'bardic_inspiration_die',
    duration: '10_minutes',
    trigger: 'attack_roll_ability_check_or_save',
    effect: 'add_die_to_roll',
    recharge: 'short_rest_automatic',
    ruleset: '2024',
    description: 'Now recharges on short rest automatically'
  }
};

/**
 * Check if a class feature is an edge case
 */
function isClassFeatureEdgeCase(featureName) {
  if (!featureName) return false;
  const normalizedLowerName = featureName.toLowerCase()
    .replace(/[^a-z0-9\s:]/g, '') // Remove special chars except colon and space
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
  
  // Exact match first
  if (CLASS_FEATURE_EDGE_CASES.hasOwnProperty(normalizedLowerName)) {
    return true;
  }
  
  // Special handling for Lay on Hands: Heal ONLY (not Restore or other variants)
  if (normalizedLowerName === 'lay on hands: heal') {
    return true;
  }
  
  return false;
}

/**
 * Get class feature edge case configuration
 */
function getClassFeatureEdgeCase(featureName) {
  if (!featureName) return null;
  const normalizedLowerName = featureName.toLowerCase()
    .replace(/[^a-z0-9\s:]/g, '') // Remove special chars except colon and space
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
  
  // Exact match first
  if (CLASS_FEATURE_EDGE_CASES.hasOwnProperty(normalizedLowerName)) {
    return CLASS_FEATURE_EDGE_CASES[normalizedLowerName];
  }
  
  // Special handling for Lay on Hands: Heal ONLY - return the base "lay on hands" config
  if (normalizedLowerName === 'lay on hands: heal') {
    return CLASS_FEATURE_EDGE_CASES['lay on hands'] || null;
  }
  
  return null;
}

/**
 * Get all class features of a specific edge case type
 */
function getClassFeaturesByType(type) {
  return Object.entries(CLASS_FEATURE_EDGE_CASES)
    .filter(([name, config]) => config.type === type)
    .map(([name, config]) => ({ name, ...config }));
}

/**
 * Get all class feature edge case types
 */
function getAllClassFeatureEdgeCaseTypes() {
  const types = new Set();
  Object.values(CLASS_FEATURE_EDGE_CASES).forEach(config => {
    types.add(config.type);
  });
  return Array.from(types);
}

/**
 * Apply class feature edge case modifications to action options
 */
function applyClassFeatureEdgeCaseModifications(feature, options) {
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

    case 'divine_smite_modal':
      // Skip normal buttons and show custom modal
      skipNormalButtons = true;
      break;

    case 'resource_damage':
      // Add resource cost info
      modifiedOptions.forEach(opt => {
        opt.edgeCaseNote = `💰 Cost: ${edgeCase.resource}`;
      });
      break;

    case 'healing_pool':
      // Skip normal buttons and show custom modal for healing pool actions
      skipNormalButtons = true;
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
  globalThis.CLASS_FEATURE_EDGE_CASES = CLASS_FEATURE_EDGE_CASES;
  globalThis.isClassFeatureEdgeCase = isClassFeatureEdgeCase;
  globalThis.getClassFeatureEdgeCase = getClassFeatureEdgeCase;
  globalThis.applyClassFeatureEdgeCaseModifications = applyClassFeatureEdgeCaseModifications;
  globalThis.getClassFeaturesByType = getClassFeaturesByType;
  globalThis.getAllClassFeatureEdgeCaseTypes = getAllClassFeatureEdgeCaseTypes;
}
