// Spell Edge Cases Configuration
// Note: debug utility is available globally via window.debug from debug.js
// Handles special spell mechanics that need custom behavior

const SPELL_EDGE_CASES = {
  // Healing spells that should announce when used
  'cure wounds': {
    type: 'healing_announcement',
    description: 'Healing spell that announces usage'
  },
  'healing word': {
    type: 'healing_announcement',
    description: 'Healing spell that announces usage'
  },
  'lesser restoration': {
    type: 'healing_announcement',
    description: 'Healing spell that announces usage'
  },
  'mass cure wounds': {
    type: 'healing_announcement',
    description: 'Healing spell that announces usage'
  },
  'mass healing word': {
    type: 'healing_announcement',
    description: 'Healing spell that announces usage'
  },
  'heal': {
    type: 'healing_announcement',
    description: 'Healing spell that announces usage'
  },
  'regenerate': {
    type: 'healing_announcement',
    description: 'Healing spell that announces usage'
  },
  'mass heal': {
    type: 'healing_announcement',
    description: 'Healing spell that announces usage'
  },
  'true resurrection': {
    type: 'healing_announcement',
    description: 'Healing spell that announces usage'
  },
  
  // Spells that are too complicated for normal casting
  'wish': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'miracle': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention',
    ruleset: '2014',
    notes: '3.5e spell, not in 2024 PHB'
  },
  'true polymorph': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'shapechange': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'astral projection': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'etherealness': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'plane shift': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'teleport': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'word of recall': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'contingency': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'glyph of warding': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'symbol': {
    type: 'conditional_damage',
    description: 'Has conditional/situational damage - adds Cast button'
  },
  'meld into stone': {
    type: 'conditional_damage',
    description: 'Has conditional/situational damage - adds Cast button'
  },
  'geas': {
    type: 'conditional_damage',
    description: 'Has conditional/situational damage - adds Cast button'
  },
  'programmed illusion': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'sequester': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'clone': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'magic jar': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'imprisonment': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'time stop': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention',
    ruleset: '2014',
    notes: '1d4+1 rounds'
  },
  'time stop (2024)': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention',
    ruleset: '2024',
    notes: '1d4+1 turns (changed from rounds)'
  },
  'mirage arcane': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'forcecage': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'maze': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'simulacrum': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  'gate': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention'
  },
  
  // Reusable spells that need checkbox
  'spiritual weapon': {
    type: 'reusable',
    description: 'Can be recast without using spell slot',
    ruleset: '2014',
    notes: 'Bonus action to summon, separate action to attack'
  },
  'spiritual weapon (2024)': {
    type: 'reusable',
    description: 'Can be recast without using spell slot',
    ruleset: '2024',
    notes: 'Bonus action to summon AND attack on same turn'
  },
  'mage armor': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'shield': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'detect magic': {
    type: 'reusable',
    description: 'Can be recast without using spell slot',
    ruleset: '2014',
    notes: 'Standard casting'
  },
  'detect magic (2024)': {
    type: 'reusable',
    description: 'Can be recast without using spell slot',
    ruleset: '2024',
    notes: 'Now a ritual spell'
  },
  'guidance': {
    type: 'reusable',
    description: 'Can be recast without using spell slot',
    ruleset: '2014',
    notes: 'Action, must be used before roll'
  },
  'guidance (2024)': {
    type: 'reusable',
    description: 'Can be recast without using spell slot',
    ruleset: '2024',
    notes: 'Reaction, can be used after the roll'
  },
  'resistance': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'virtue': {
    type: 'reusable',
    description: 'Can be recast without using spell slot',
    ruleset: '2014',
    notes: '3.5e spell, not in 2024 PHB'
  },
  'light': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'fire bolt': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'ray of frost': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'shocking grasp': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'toll the dead': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'sacred flame': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'eldritch blast': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'poison spray': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'frostbite': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'true strike': {
    type: 'reusable',
    description: 'Can be recast without using spell slot',
    ruleset: '2014',
    notes: 'Advantage on next attack roll'
  },
  'true strike (2024)': {
    type: 'reusable',
    description: 'Can be recast without using spell slot',
    ruleset: '2024',
    notes: 'COMPLETELY REDESIGNED - advantage on next attack within same turn + extra damage'
  },
  'blade ward': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'chill touch': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'minor illusion': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'prestidigitation': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'thaumaturgy': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'druidcraft': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'mending': {
    type: 'reusable',
    description: 'Can be recast without using spell slot'
  },
  'arcane vigor': {
    type: 'reusable',
    description: 'Can be recast without using spell slot',
    ruleset: '2024',
    notes: 'New 2024 cantrip - grants temporary HP'
  },
  'starry wisp': {
    type: 'reusable',
    description: 'Can be recast without using spell slot',
    ruleset: '2024',
    notes: 'New 2024 cantrip - light and guidance effect'
  },
  'sorcerous burst': {
    type: 'reusable',
    description: 'Can be recast without using spell slot',
    ruleset: '2024',
    notes: 'New 2024 sorcerer cantrip'
  },
  'conjure minor elementals': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention',
    ruleset: '2024',
    notes: '2024 replacement for old summoning spells'
  },
  'conjure celestial': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention',
    ruleset: '2024',
    notes: '2024 redesigned summoning spell'
  },
  'summon beast': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention',
    ruleset: '2024',
    notes: '2024 standardized summoning spell'
  },
  'summon fey': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention',
    ruleset: '2024',
    notes: '2024 standardized summoning spell'
  },
  'hunter\'s mark (2024)': {
    type: 'reusable',
    description: 'Can be recast without using spell slot',
    ruleset: '2024',
    notes: 'Now a spell known for free, concentration changes'
  },
  'hex (2024)': {
    type: 'reusable',
    description: 'Can be recast without using spell slot',
    ruleset: '2024',
    notes: 'Similar to Hunter\'s Mark changes'
  },
  'counterspell (2024)': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention',
    ruleset: '2024',
    notes: 'Different DC calculation in 2024'
  },
  'healing spirit (2024)': {
    type: 'too_complicated',
    description: 'Too complicated for normal casting - requires DM intervention',
    ruleset: '2024',
    notes: 'Nerfed heavily in 2024'
  }
};

// Check if a spell has an edge case
function isEdgeCase(spellName) {
  if (!spellName) return false;
  return SPELL_EDGE_CASES.hasOwnProperty(spellName.toLowerCase());
}

// Get edge case configuration for a spell
function getEdgeCase(spellName, ruleset = null) {
  if (!spellName) return null;
  const lowerName = spellName.toLowerCase();
  
  // If ruleset is specified, try to get the specific version
  if (ruleset) {
    const specificVersion = SPELL_EDGE_CASES[`${lowerName} (${ruleset})`];
    if (specificVersion) return specificVersion;
  }
  
  // Fall back to default version
  return SPELL_EDGE_CASES[lowerName] || null;
}

// Apply edge case modifications to spell options
function applyEdgeCaseModifications(spell, options, characterData = null) {
  // Detect ruleset from character data if not provided
  const ruleset = characterData ? detectRulesetFromCharacterData(characterData) : '2014';
  const edgeCase = getEdgeCase(spell.name, ruleset);

  if (!edgeCase) return { options, skipNormalButtons: false };

  debug.log(`🎯 Applying ${ruleset} edge case for spell: ${spell.name}`);

  let modifiedOptions = options;
  let skipNormalButtons = false;

  // Apply edge case logic based on type
  switch (edgeCase.type) {
    case 'healing_announcement':
      // Healing spells should announce usage
      modifiedOptions = options.map(option => ({
        ...option,
        edgeCaseNote: edgeCase.notes || 'Announces healing usage'
      }));
      break;

    case 'too_complicated':
      // Too complicated spells get special handling
      modifiedOptions = [];
      skipNormalButtons = true;
      break;

    case 'reusable':
      // Reusable spells get checkbox option
      modifiedOptions = options.map(option => ({
        ...option,
        edgeCaseNote: edgeCase.notes || 'Can be recast without spell slot'
      }));
      break;

    case 'conditional_damage':
      // Spells with conditional/situational damage get a "Cast" button
      if (options.length > 0) {
        modifiedOptions = [
          {
            type: 'cast',
            label: 'Cast Spell',
            icon: '✨',
            color: '#9b59b6',
            edgeCaseNote: edgeCase.notes || 'Spell has conditional damage'
          },
          ...options
        ];
      }
      break;

    default:
      break;
  }

  return { options: modifiedOptions, skipNormalButtons };
}

// Check if a spell is reusable
function isReuseableSpell(spellName, characterData = null) {
  const ruleset = characterData ? detectRulesetFromCharacterData(characterData) : '2014';
  const edgeCase = getEdgeCase(spellName, ruleset);
  return edgeCase && edgeCase.type === 'reusable';
}

// Check if a spell is too complicated
function isTooComplicatedSpell(spellName, characterData = null) {
  const ruleset = characterData ? detectRulesetFromCharacterData(characterData) : '2014';
  const edgeCase = getEdgeCase(spellName, ruleset);
  return edgeCase && edgeCase.type === 'too_complicated';
}

// Detect ruleset from character data (shared function)
function detectRulesetFromCharacterData(characterData) {
  if (!characterData) return '2014'; // Default to 2014
  
  // Check for 2024-specific features or changes
  const features = characterData.features || [];
  const actions = characterData.actions || [];
  const spells = characterData.spells || [];
  
  // More specific detection logic
  const has2024Indicators = [
    // Explicit 2024 markers (most reliable)
    () => features.some(f => f.name && f.name.includes('2024')),
    () => spells.some(s => s.description && s.description.includes('2024')),
    
    // 2024-specific resource patterns
    () => (characterData.resources || []).some(r => r.name && (
      r.name.includes('proficiency') && r.name.includes('uses')
    )),
    
    // 2024-specific feature wording (more specific)
    () => features.some(f => f.description && typeof f.description === 'string' && (
      f.description.includes('uses = proficiency bonus') ||
      f.description.includes('proficiency bonus uses')
    )),

    // 2024-specific class feature patterns
    () => features.some(f => f.description && typeof f.description === 'string' && (
      f.description.includes('bonus action') && f.description.includes('reaction')
    )),

    // 2024-specific spell patterns
    () => spells.some(s => s.description && typeof s.description === 'string' && (
      s.description.includes('ritual') && s.level > 0
    ))
  ];
  
  // If any 2024 indicators are found, assume 2024 ruleset
  const has2024Features = has2024Indicators.some(check => check());
  
  if (has2024Features) {
    debug.log('🔍 Detected 2024 ruleset from character data');
    return '2024';
  }
  
  // Default to 2014
  debug.log('🔍 Defaulting to 2014 ruleset');
  return '2014';
}

// Expose to globalThis for importScripts usage
if (typeof globalThis !== 'undefined') {
  globalThis.SPELL_EDGE_CASES = SPELL_EDGE_CASES;
  globalThis.isEdgeCase = isEdgeCase;
  globalThis.getEdgeCase = getEdgeCase;
  globalThis.applyEdgeCaseModifications = applyEdgeCaseModifications;
  globalThis.isReuseableSpell = isReuseableSpell;
  globalThis.isTooComplicatedSpell = isTooComplicatedSpell;
  globalThis.detectRulesetFromCharacterData = detectRulesetFromCharacterData;
}
