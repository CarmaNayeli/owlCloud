debug.log('✅ Popup HTML loaded');

// Initialize theme manager
if (typeof ThemeManager !== 'undefined') {
  ThemeManager.init().then(() => {
    debug.log('🎨 Theme system initialized');

    // Set up theme button click handlers
    document.addEventListener('DOMContentLoaded', () => {
      const themeButtons = document.querySelectorAll('.theme-btn');
      themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const theme = btn.dataset.theme;
          ThemeManager.setTheme(theme);

          // Update active state
          themeButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      // Set initial active button based on current theme
      const currentTheme = ThemeManager.getCurrentTheme();
      const activeBtn = document.querySelector(`[data-theme="${currentTheme}"]`);
      if (activeBtn) {
        themeButtons.forEach(b => b.classList.remove('active'));
        activeBtn.classList.add('active');
      }
    });
  });
} else {
  debug.warn('⚠️ ThemeManager not available');
}

// Store character data globally so we can update it
let characterData = null;

// Listen for character data from parent window via postMessage
window.addEventListener('message', (event) => {
  debug.log('✅ Received message in popup:', event.data);

  if (event.data && event.data.action === 'initCharacterSheet') {
    debug.log('✅ Initializing character sheet with data:', event.data.data.name);
    characterData = event.data.data;  // Store globally
    buildSheet(characterData);
  }
});

// Tell parent window we're ready - wait for window to be fully loaded
// This prevents race conditions in Firefox
function notifyParentReady() {
  try {
    if (window.opener && !window.opener.closed) {
      debug.log('✅ Sending ready message to parent window...');
      window.opener.postMessage({ action: 'popupReady' }, '*');
    } else {
      debug.warn('⚠️ No parent window available, waiting for postMessage...');
    }
  } catch (error) {
    debug.warn('⚠️ Could not notify parent (this is normal):', error.message);
  }
}

// Send ready message after a short delay to ensure parent is listening
setTimeout(notifyParentReady, 100);

debug.log('✅ Waiting for character data via postMessage...');

// Fallback: If we don't receive data via postMessage within 1 second,
// load directly from storage (Firefox sometimes blocks postMessage between windows)
setTimeout(() => {
  if (!characterData) {
    debug.log('⏱️ No data received via postMessage, loading from storage...');
    loadCharacterWithTabs();
  }
}, 1000);

// Load character data and build tabs
async function loadCharacterWithTabs() {
  try {
    // Get all character profiles
    const profilesResponse = await browserAPI.runtime.sendMessage({ action: 'getAllCharacterProfiles' });
    const profiles = profilesResponse.success ? profilesResponse.profiles : {};

    // Get active character
    const activeResponse = await browserAPI.runtime.sendMessage({ action: 'getCharacterData' });
    const activeCharacter = activeResponse.success ? activeResponse.data : null;

    // Build character tabs
    buildCharacterTabs(profiles, activeCharacter);

    // Load active character
    if (activeCharacter) {
      characterData = activeCharacter;
      buildSheet(characterData);
    } else {
      debug.error('❌ No character data found in storage');
    }
  } catch (error) {
    debug.error('❌ Failed to load characters:', error);
  }
}

// Build character tabs UI
function buildCharacterTabs(profiles, activeCharacter) {
  const tabsContainer = document.getElementById('character-tabs');
  if (!tabsContainer) return;

  tabsContainer.innerHTML = '';
  const maxSlots = 10; // Support up to 10 character slots (matches main's implementation)

  const activeId = activeCharacter ? (activeCharacter.characterId || activeCharacter._id) : null;

  // Create tabs for each slot
  for (let slotNum = 1; slotNum <= maxSlots; slotNum++) {
    const slotId = `slot-${slotNum}`;
    // Find character in this slot using slotId as key
    const charInSlot = profiles[slotId];

    const tab = document.createElement('div');
    tab.className = 'character-tab';
    tab.dataset.slotId = slotId;

    if (charInSlot) {
      const isActive = slotId === activeId ||
                       (charInSlot.characterId && charInSlot.characterId === activeId) ||
                       (charInSlot._id && charInSlot._id === activeId);

      if (isActive) {
        tab.classList.add('active');
      }

      tab.innerHTML = `
        <span class="slot-number">${slotNum}</span>
        <span class="char-name">${charInSlot.name || 'Unknown'}</span>
        <span class="close-tab" title="Clear slot">✕</span>
      `;

      // Click to switch character
      tab.addEventListener('click', (e) => {
        if (!e.target.classList.contains('close-tab')) {
          switchToCharacter(slotId);
        }
      });

      // Close button
      const closeBtn = tab.querySelector('.close-tab');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearCharacterSlot(slotId, slotNum);
      });
    } else {
      // Empty slot
      tab.classList.add('empty');
      tab.innerHTML = `
        <span class="slot-number">${slotNum}</span>
        <span class="char-name">Empty Slot</span>
      `;
    }

    tabsContainer.appendChild(tab);
  }
}

// Switch to a different character
async function switchToCharacter(characterId) {
  try {
    // Set active character
    await browserAPI.runtime.sendMessage({
      action: 'setActiveCharacter',
      characterId: characterId
    });

    // Reload the sheet
    const response = await browserAPI.runtime.sendMessage({
      action: 'getCharacterData',
      characterId: characterId
    });

    if (response && response.data) {
      characterData = response.data;
      buildSheet(characterData);

      // Reload tabs to update active state
      loadCharacterWithTabs();

      showNotification(`✅ Switched to ${response.data.name}`);
    }
  } catch (error) {
    debug.error('❌ Failed to switch character:', error);
    showNotification('❌ Failed to switch character', 'error');
  }
}

// Clear a character slot
async function clearCharacterSlot(slotId, slotNum) {
  if (!confirm(`Clear slot ${slotNum}? This will remove this character from the slot.`)) {
    return;
  }

  try {
    await browserAPI.runtime.sendMessage({
      action: 'clearCharacterData',
      characterId: slotId
    });

    showNotification(`✅ Slot ${slotNum} cleared`);

    // Reload tabs
    loadCharacterWithTabs();
  } catch (error) {
    debug.error('❌ Failed to clear slot:', error);
    showNotification('❌ Failed to clear slot', 'error');
  }
}

// Add event listeners for rest buttons
document.addEventListener('DOMContentLoaded', () => {
  const shortRestBtn = document.getElementById('short-rest-btn');
  const longRestBtn = document.getElementById('long-rest-btn');

  if (shortRestBtn) {
    shortRestBtn.addEventListener('click', takeShortRest);
  }

  if (longRestBtn) {
    longRestBtn.addEventListener('click', takeLongRest);
  }
});

function buildSheet(data) {
  debug.log('Building character sheet...');
  debug.log('📊 Character data received:', data);
  debug.log('✨ Spell slots data:', data.spellSlots);

  // Character name
  const charNameEl = document.getElementById('char-name');
  charNameEl.textContent = data.name || 'Character';

  // Update color picker emoji in systems bar
  const currentColorEmoji = getColorEmoji(data.notificationColor || '#3498db');
  const colorEmojiEl = document.getElementById('color-emoji');
  if (colorEmojiEl) {
    colorEmojiEl.textContent = currentColorEmoji;
  }

  // Populate color palette in systems bar
  const colorPaletteEl = document.getElementById('color-palette');
  if (colorPaletteEl) {
    colorPaletteEl.innerHTML = createColorPalette(data.notificationColor || '#3498db');
    colorPaletteEl.style.display = 'grid';
    colorPaletteEl.style.gridTemplateColumns = 'repeat(4, 1fr)';
    colorPaletteEl.style.gap = '10px';
    colorPaletteEl.style.width = '180px';
  }

  // Initialize hit dice if needed
  initializeHitDice();

  // Initialize temporary HP if needed
  if (data.temporaryHP === undefined) {
    data.temporaryHP = 0;
  }

  // Initialize inspiration if needed
  if (data.inspiration === undefined) {
    data.inspiration = false;
  }

  // Capitalize race name - handle both string and object formats
  let raceName = 'Unknown';
  if (data.race) {
    if (typeof data.race === 'string') {
      raceName = data.race.charAt(0).toUpperCase() + data.race.slice(1);
    } else if (typeof data.race === 'object') {
      // If race is an object, try to extract the value from various possible properties
      let raceValue = data.race.value || data.race.name || data.race.text ||
                      data.race.variableName || data.race.displayName;

      // If still no value, try to get something useful from the object
      if (!raceValue) {
        // Check if it has a tags property that might indicate race type
        if (data.race.tags && Array.isArray(data.race.tags)) {
          const raceTags = data.race.tags.filter(tag =>
            !tag.toLowerCase().includes('class') &&
            !tag.toLowerCase().includes('level')
          );
          if (raceTags.length > 0) {
            raceValue = raceTags[0];
          }
        }

        // Last resort: look for any string property that seems like a race name
        if (!raceValue) {
          const keys = Object.keys(data.race);
          for (const key of keys) {
            if (typeof data.race[key] === 'string' && data.race[key].length > 0 && data.race[key].length < 50) {
              raceValue = data.race[key];
              break;
            }
          }
        }
      }

      // If we found something, capitalize it; otherwise use "Unknown"
      if (raceValue && typeof raceValue === 'string') {
        raceName = raceValue.charAt(0).toUpperCase() + raceValue.slice(1);
      } else {
        debug.warn('Could not extract race name from object:', data.race);
        raceName = 'Unknown Race';
      }
    }
  }

  // Layer 1: Class, Level, Race, Hit Dice
  document.getElementById('char-class').textContent = data.class || 'Unknown';
  document.getElementById('char-level').textContent = data.level || 1;
  document.getElementById('char-race').textContent = raceName;
  document.getElementById('char-hit-dice').textContent = `${data.hitDice.current}/${data.hitDice.max} ${data.hitDice.type}`;

  // Layer 2: AC, Speed, Proficiency, Death Saves, Inspiration
  document.getElementById('char-ac').textContent = data.armorClass || 10;
  document.getElementById('char-speed').textContent = `${data.speed || 30} ft`;
  document.getElementById('char-proficiency').textContent = `+${data.proficiencyBonus || 0}`;

  // Death Saves
  const deathSavesDisplay = document.getElementById('death-saves-display');
  const deathSavesValue = document.getElementById('death-saves-value');
  deathSavesValue.innerHTML = `
    <span style="color: var(--accent-success);">✓${data.deathSaves.successes || 0}</span> /
    <span style="color: var(--accent-danger);">✗${data.deathSaves.failures || 0}</span>
  `;
  if (data.deathSaves.successes > 0 || data.deathSaves.failures > 0) {
    deathSavesDisplay.style.background = 'var(--bg-action)';
  } else {
    deathSavesDisplay.style.background = 'var(--bg-tertiary)';
  }

  // Inspiration
  const inspirationDisplay = document.getElementById('inspiration-display');
  const inspirationValue = document.getElementById('inspiration-value');
  if (data.inspiration) {
    inspirationValue.textContent = '⭐ Active';
    inspirationValue.style.color = '#f57f17';
    inspirationDisplay.style.background = '#fff9c4';
  } else {
    inspirationValue.textContent = '☆ None';
    inspirationValue.style.color = 'var(--text-muted)';
    inspirationDisplay.style.background = 'var(--bg-tertiary)';
  }

  // Layer 3: Hit Points
  const hpValue = document.getElementById('hp-value');
  hpValue.textContent = `${data.hitPoints.current}${data.temporaryHP > 0 ? `+${data.temporaryHP}` : ''} / ${data.hitPoints.max}`;

  // Initiative
  const initiativeValue = document.getElementById('initiative-value');
  initiativeValue.textContent = `+${data.initiative || 0}`;

  // Add click handler for HP display
  document.getElementById('hp-display').addEventListener('click', showHPModal);

  // Add click handler for initiative button
  document.getElementById('initiative-button').addEventListener('click', () => {
    const initiativeBonus = data.initiative || 0;
    roll('Initiative', `1d20+${initiativeBonus}`);
  });

  // Add click handler for death saves display
  document.getElementById('death-saves-display').addEventListener('click', showDeathSavesModal);

  // Add click handler for inspiration display
  document.getElementById('inspiration-display').addEventListener('click', toggleInspiration);

  // Update HP display color based on percentage
  const hpPercent = (data.hitPoints.current / data.hitPoints.max) * 100;
  const hpDisplay = document.getElementById('hp-display');
  if (hpPercent > 50) {
    hpDisplay.style.background = 'var(--accent-success)';
  } else if (hpPercent > 25) {
    hpDisplay.style.background = 'var(--accent-warning)';
  } else {
    hpDisplay.style.background = 'var(--accent-danger)';
  }

  // Resources
  buildResourcesDisplay();

  // Spell Slots
  buildSpellSlotsDisplay();

  // Abilities
  const abilitiesGrid = document.getElementById('abilities-grid');
  abilitiesGrid.innerHTML = ''; // Clear existing
  const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  abilities.forEach(ability => {
    const score = data.attributes?.[ability] || 10;
    const mod = data.attributeMods?.[ability] || 0;
    const card = createCard(ability.substring(0, 3).toUpperCase(), score, `+${mod}`, () => {
      roll(`${ability.charAt(0).toUpperCase() + ability.slice(1)}`, `1d20+${mod}`);
    });
    abilitiesGrid.appendChild(card);
  });

  // Saves
  const savesGrid = document.getElementById('saves-grid');
  savesGrid.innerHTML = ''; // Clear existing
  abilities.forEach(ability => {
    const bonus = data.savingThrows?.[ability] || 0;
    const card = createCard(`${ability.substring(0, 3).toUpperCase()}`, `+${bonus}`, '', () => {
      roll(`${ability.toUpperCase()} Save`, `1d20+${bonus}`);
    });
    savesGrid.appendChild(card);
  });

  // Skills - deduplicate and show unique skills only
  const skillsGrid = document.getElementById('skills-grid');
  skillsGrid.innerHTML = ''; // Clear existing

  // Create a map to deduplicate skills (in case data has duplicates)
  const uniqueSkills = new Map();
  Object.entries(data.skills || {}).forEach(([skill, bonus]) => {
    const normalizedSkill = skill.toLowerCase().trim();
    // Only keep the skill if we haven't seen it, or if this bonus is higher
    if (!uniqueSkills.has(normalizedSkill) || bonus > uniqueSkills.get(normalizedSkill).bonus) {
      uniqueSkills.set(normalizedSkill, { skill, bonus });
    }
  });

  // Sort skills alphabetically and display
  const sortedSkills = Array.from(uniqueSkills.values()).sort((a, b) =>
    a.skill.localeCompare(b.skill)
  );

  sortedSkills.forEach(({ skill, bonus }) => {
    const displayName = skill.charAt(0).toUpperCase() + skill.slice(1).replace(/-/g, ' ');
    const card = createCard(displayName, `${bonus >= 0 ? '+' : ''}${bonus}`, '', () => {
      roll(displayName, `1d20${bonus >= 0 ? '+' : ''}${bonus}`);
    });
    skillsGrid.appendChild(card);
  });

  // Actions & Attacks
  const actionsContainer = document.getElementById('actions-container');
  if (data.actions && data.actions.length > 0) {
    buildActionsDisplay(actionsContainer, data.actions);
  } else {
    actionsContainer.innerHTML = '<p style="text-align: center; color: #666;">No actions available</p>';
  }

  // Companions (Animal Companions, Familiars, Summons, etc.)
  if (data.companions && data.companions.length > 0) {
    buildCompanionsDisplay(data.companions);
  }

  // Spells - organized by source then level
  const spellsContainer = document.getElementById('spells-container');
  if (data.spells && data.spells.length > 0) {
    buildSpellsBySource(spellsContainer, data.spells);
  } else {
    spellsContainer.innerHTML = '<p style="text-align: center; color: #666;">No spells available</p>';
  }

  // Initialize color palette after sheet is built
  initColorPalette();

  debug.log('✅ Sheet built successfully');
}

function buildSpellsBySource(container, spells) {
  // Group spells by actual spell level (not source)
  const spellsByLevel = {};

  spells.forEach((spell, index) => {
    // Add index to spell for tracking
    spell.index = index;

    // Use spell level for grouping
    const spellLevel = parseInt(spell.level) || 0;
    const levelKey = spellLevel === 0 ? 'Cantrips' : `Level ${spellLevel} Spells`;

    if (!spellsByLevel[levelKey]) {
      spellsByLevel[levelKey] = [];
    }
    spellsByLevel[levelKey].push(spell);
  });

  // Clear container
  container.innerHTML = '';

  // Sort by spell level (cantrips first, then 1-9)
  const sortedLevels = Object.keys(spellsByLevel).sort((a, b) => {
    if (a === 'Cantrips') return -1;
    if (b === 'Cantrips') return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  sortedLevels.forEach(levelKey => {
    // Create level section
    const levelSection = document.createElement('div');
    levelSection.style.cssText = 'margin-bottom: 20px;';

    const levelHeader = document.createElement('h4');
    levelHeader.textContent = `📚 ${levelKey}`;
    levelHeader.style.cssText = 'color: #2c3e50; margin-bottom: 10px; padding: 5px; background: #ecf0f1; border-radius: 4px;';
    levelSection.appendChild(levelHeader);

    // Sort spells alphabetically within level
    const sortedSpells = spellsByLevel[levelKey].sort((a, b) => {
      return (a.name || '').localeCompare(b.name || '');
    });

    // Deduplicate spells by name and combine sources
    const deduplicatedSpells = [];
    const spellsByName = {};

    sortedSpells.forEach(spell => {
      const spellName = spell.name || 'Unnamed Spell';

      if (!spellsByName[spellName]) {
        // First occurrence of this spell
        spellsByName[spellName] = spell;
        deduplicatedSpells.push(spell);
      } else {
        // Duplicate spell - combine sources
        const existingSpell = spellsByName[spellName];
        if (spell.source && !existingSpell.source.includes(spell.source)) {
          existingSpell.source += '; ' + spell.source;
          debug.log(`📚 Combined duplicate spell "${spellName}": ${existingSpell.source}`);
        }
      }
    });

    // Add deduplicated spells
    deduplicatedSpells.forEach(spell => {
      const spellCard = createSpellCard(spell, spell.index);
      levelSection.appendChild(spellCard);
    });

    container.appendChild(levelSection);
  });
}

// Store Sneak Attack toggle state (independent from DiceCloud - controlled only by our sheet)
let sneakAttackEnabled = false;  // Always starts unchecked - user manually enables when needed
let sneakAttackDamage = '';

// Store Elemental Weapon toggle state (independent from DiceCloud - controlled only by our sheet)
let elementalWeaponEnabled = false;  // Always starts unchecked - user manually enables when needed
let elementalWeaponDamage = '1d4';  // Default to level 3 (base damage)

function buildActionsDisplay(container, actions) {
  // Clear container
  container.innerHTML = '';

  // DEBUG: Log all actions to see what we have
  debug.log('🔍 buildActionsDisplay called with actions:', actions.map(a => ({ name: a.name, damage: a.damage, actionType: a.actionType })));

  // Check if character has Sneak Attack available (from DiceCloud)
  // We only check if it EXISTS, not whether it's enabled on DiceCloud
  // The toggle state on our sheet is independent and user-controlled
  // Use flexible matching in case the name has slight variations
  const sneakAttackAction = actions.find(a =>
    a.name === 'Sneak Attack' ||
    a.name.toLowerCase().includes('sneak attack')
  );
  debug.log('🎯 Sneak Attack search result:', sneakAttackAction);
  if (sneakAttackAction && sneakAttackAction.damage) {
    sneakAttackDamage = sneakAttackAction.damage;

    // Resolve variables in the damage formula for display
    const resolvedDamage = resolveVariablesInFormula(sneakAttackDamage);
    debug.log(`🎯 Sneak Attack damage: "${sneakAttackDamage}" resolved to "${resolvedDamage}"`);

    // Add toggle section at the top of actions
    const toggleSection = document.createElement('div');
    toggleSection.style.cssText = 'background: #2c3e50; color: white; padding: 10px; border-radius: 5px; margin-bottom: 10px; display: flex; align-items: center; gap: 10px;';

    const toggleLabel = document.createElement('label');
    toggleLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: bold;';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'sneak-attack-toggle';
    checkbox.checked = sneakAttackEnabled;  // Always starts false - IGNORES DiceCloud toggle state
    checkbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
    checkbox.addEventListener('change', (e) => {
      sneakAttackEnabled = e.target.checked;
      debug.log(`🎯 Sneak Attack toggle on our sheet: ${sneakAttackEnabled ? 'ON' : 'OFF'} (independent of DiceCloud)`);
    });

    const labelText = document.createElement('span');
    labelText.textContent = `Add Sneak Attack (${resolvedDamage}) to weapon damage`;

    toggleLabel.appendChild(checkbox);
    toggleLabel.appendChild(labelText);
    toggleSection.appendChild(toggleLabel);
    container.appendChild(toggleSection);
  }

  // Check if character has Elemental Weapon spell prepared (check spells list)
  // We only check if it EXISTS, the toggle is user-controlled
  const hasElementalWeapon = characterData.spells && characterData.spells.some(s =>
    s.name === 'Elemental Weapon' || (s.spell && s.spell.name === 'Elemental Weapon')
  );

  if (hasElementalWeapon) {
    debug.log(`⚔️ Elemental Weapon spell found, adding toggle`);

    // Add toggle section for Elemental Weapon
    const elementalToggleSection = document.createElement('div');
    elementalToggleSection.style.cssText = 'background: #8b4513; color: white; padding: 10px; border-radius: 5px; margin-bottom: 10px; display: flex; align-items: center; gap: 10px;';

    const elementalToggleLabel = document.createElement('label');
    elementalToggleLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: bold;';

    const elementalCheckbox = document.createElement('input');
    elementalCheckbox.type = 'checkbox';
    elementalCheckbox.id = 'elemental-weapon-toggle';
    elementalCheckbox.checked = elementalWeaponEnabled;  // Always starts false
    elementalCheckbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
    elementalCheckbox.addEventListener('change', (e) => {
      elementalWeaponEnabled = e.target.checked;
      debug.log(`⚔️ Elemental Weapon toggle: ${elementalWeaponEnabled ? 'ON' : 'OFF'}`);
    });

    const elementalLabelText = document.createElement('span');
    elementalLabelText.textContent = `Add Elemental Weapon (${elementalWeaponDamage}) to weapon damage`;

    elementalToggleLabel.appendChild(elementalCheckbox);
    elementalToggleLabel.appendChild(elementalLabelText);
    elementalToggleSection.appendChild(elementalToggleLabel);
    container.appendChild(elementalToggleSection);
  }

  actions.forEach((action, index) => {
    // Skip rendering standalone Sneak Attack button if it exists
    if ((action.name === 'Sneak Attack' || action.name.toLowerCase().includes('sneak attack')) && action.actionType === 'feature') {
      debug.log('⏭️ Skipping standalone Sneak Attack button (using toggle instead)');
      return;
    }

    // Clean up weapon damage to remove sneak attack if it was auto-added
    // Pattern: remove any multi-dice formulas like "+3d6", "+4d6", etc. that come after the base damage
    if (action.damage && action.attackRoll && sneakAttackDamage) {
      // Remove the sneak attack damage pattern from weapon damage
      const sneakPattern = new RegExp(`\\+?${sneakAttackDamage.replace(/[+\-]/g, '')}`, 'g');
      const cleanedDamage = action.damage.replace(sneakPattern, '');
      if (cleanedDamage !== action.damage) {
        debug.log(`🧹 Cleaned weapon damage: "${action.damage}" -> "${cleanedDamage}"`);
        action.damage = cleanedDamage;
      }
    }

    const actionCard = document.createElement('div');
    actionCard.className = 'action-card';

    const actionHeader = document.createElement('div');
    actionHeader.className = 'action-header';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'action-name';

    // Show uses if available
    let nameText = action.name;
    if (action.uses) {
      const usesUsed = action.usesUsed || 0;
      const usesTotal = action.uses.total || action.uses.value || action.uses;
      const usesRemaining = usesTotal - usesUsed;
      nameText += ` <span class="uses-badge">${usesRemaining}/${usesTotal} uses</span>`;
    }
    nameDiv.innerHTML = nameText;

    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'action-buttons';

    // Attack button (if attackRoll exists)
    if (action.attackRoll) {
      const attackBtn = document.createElement('button');
      attackBtn.className = 'attack-btn';
      attackBtn.textContent = '🎯 Attack';
      attackBtn.addEventListener('click', () => {
        // Convert to full formula if it's just a number (legacy data)
        let formula = action.attackRoll;
        if (typeof formula === 'number' || !formula.includes('d20')) {
          const bonus = parseInt(formula);
          formula = bonus >= 0 ? `1d20+${bonus}` : `1d20${bonus}`;
        }
        roll(`${action.name} Attack`, formula);
      });
      buttonsDiv.appendChild(attackBtn);
    }

    // Damage button (if damage exists and is a valid dice formula)
    const isValidDiceFormula = action.damage && (/\d+d/.test(action.damage) || /\d+d/.test(action.damage.replace(/\s*\+\s*/g, '+'))); // Check for dice formula
    if (isValidDiceFormula) {
      const damageBtn = document.createElement('button');
      damageBtn.className = 'damage-btn';
      // Use different text for healing vs damage vs features
      let btnText;
      if (action.damageType && action.damageType.toLowerCase().includes('heal')) {
        btnText = '💚 Heal';
      } else if (action.actionType === 'feature' || !action.attackRoll) {
        // If it's a feature OR there's no attack roll (like Deflect Missiles, defensive abilities, etc.)
        // then it's just a roll, not damage
        btnText = '🎲 Roll';
      } else {
        btnText = '💥 Damage';
      }
      damageBtn.textContent = btnText;
      damageBtn.addEventListener('click', () => {
        // Check and decrement uses before rolling
        if (action.uses && !decrementActionUses(action)) {
          return; // No uses remaining
        }

        // Check and decrement Ki points if action costs Ki
        const kiCost = getKiCostFromAction(action);
        if (kiCost > 0) {
          const kiResource = getKiPointsResource();
          if (!kiResource) {
            showNotification(`❌ No Ki Points resource found`, 'error');
            return;
          }
          if (kiResource.current < kiCost) {
            showNotification(`❌ Not enough Ki Points! Need ${kiCost}, have ${kiResource.current}`, 'error');
            return;
          }
          kiResource.current -= kiCost;
          saveCharacterData();
          debug.log(`✨ Used ${kiCost} Ki points for ${action.name}. Remaining: ${kiResource.current}/${kiResource.max}`);
          showNotification(`✨ ${action.name}! (${kiResource.current}/${kiResource.max} Ki left)`);
          buildSheet(characterData); // Refresh display
        }

        // Check and decrement Sorcery Points if action costs them
        const sorceryCost = getSorceryPointCostFromAction(action);
        if (sorceryCost > 0) {
          const sorceryResource = getSorceryPointsResource();
          if (!sorceryResource) {
            showNotification(`❌ No Sorcery Points resource found`, 'error');
            return;
          }
          if (sorceryResource.current < sorceryCost) {
            showNotification(`❌ Not enough Sorcery Points! Need ${sorceryCost}, have ${sorceryResource.current}`, 'error');
            return;
          }
          sorceryResource.current -= sorceryCost;
          saveCharacterData();
          debug.log(`✨ Used ${sorceryCost} Sorcery Points for ${action.name}. Remaining: ${sorceryResource.current}/${sorceryResource.max}`);
          showNotification(`✨ ${action.name}! (${sorceryResource.current}/${sorceryResource.max} SP left)`);
          buildSheet(characterData); // Refresh display
        }

        // Check and decrement other resources (Wild Shape, Breath Weapon, etc.)
        if (!decrementActionResources(action)) {
          return; // Not enough resources
        }

        // Announce the action with description first if it has one
        if (action.description) {
          announceAction(action);
        }

        let damageName = action.damageType ?
          `${action.name} (${action.damageType})` :
          action.name;
        let damageFormula = action.damage;

        // If damage formula is a bare variable that doesn't exist, try to extract from description
        const bareVarPattern = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
        if (bareVarPattern.test(damageFormula.trim()) && !characterData.otherVariables.hasOwnProperty(damageFormula.trim())) {
          debug.log(`⚠️ Damage variable "${damageFormula}" not found, attempting to extract from description`);
          if (action.description) {
            const resolvedDesc = resolveVariablesInFormula(action.description);
            // Extract dice formulas from description (e.g., "5d6", "2d8+3", etc.)
            const dicePattern = /(\d+d\d+(?:[+\-]\d+)?)/gi;
            const matches = resolvedDesc.match(dicePattern);
            if (matches && matches.length > 0) {
              damageFormula = matches[0];
              debug.log(`✅ Extracted damage formula from description: ${damageFormula}`);
            } else {
              debug.log(`⚠️ Could not extract damage formula from description`);
            }
          }
        }

        // Add Sneak Attack if toggle is enabled and this is a weapon attack
        if (sneakAttackEnabled && sneakAttackDamage && action.attackRoll) {
          damageFormula += `+${sneakAttackDamage}`;
          damageName += ' + Sneak Attack';
          debug.log(`🎯 Adding Sneak Attack to ${action.name}: ${damageFormula}`);
        }

        // Add Elemental Weapon if toggle is enabled and this is a weapon attack
        if (elementalWeaponEnabled && elementalWeaponDamage && action.attackRoll) {
          damageFormula += `+${elementalWeaponDamage}`;
          damageName += ' + Elemental Weapon';
          debug.log(`⚔️ Adding Elemental Weapon to ${action.name}: ${damageFormula}`);
        }

        roll(damageName, damageFormula);
      });
      buttonsDiv.appendChild(damageBtn);
    }

    // Use button for non-attack actions (bonus actions, reactions, etc.)
    // Only show if there's no attack roll AND (no damage OR damage is invalid/descriptive text)
    const hasValidDamage = action.damage && /\dd/.test(action.damage); // Check for dice formula (e.g., "1d6", "2d8")
    if (!action.attackRoll && !hasValidDamage && action.description) {
      const useBtn = document.createElement('button');
      useBtn.className = 'use-btn';
      useBtn.textContent = '✨ Use';
      useBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        // Special handling for Font of Magic conversions
        if (action.name === 'Convert Spell Slot to Sorcery Points') {
          showConvertSlotToPointsModal();
          return;
        }

        // Special handling for Lay on Hands
        if (action.name.toLowerCase().includes('lay on hands')) {
          handleLayOnHands(action);
          return;
        }

        // Check and decrement uses before announcing
        if (action.uses && !decrementActionUses(action)) {
          return; // No uses remaining
        }

        // Check and decrement Ki points if action costs Ki
        const kiCost = getKiCostFromAction(action);
        if (kiCost > 0) {
          const kiResource = getKiPointsResource();
          if (!kiResource) {
            showNotification(`❌ No Ki Points resource found`, 'error');
            return;
          }
          if (kiResource.current < kiCost) {
            showNotification(`❌ Not enough Ki Points! Need ${kiCost}, have ${kiResource.current}`, 'error');
            return;
          }
          kiResource.current -= kiCost;
          saveCharacterData();
          debug.log(`✨ Used ${kiCost} Ki points for ${action.name}. Remaining: ${kiResource.current}/${kiResource.max}`);
          showNotification(`✨ ${action.name}! (${kiResource.current}/${kiResource.max} Ki left)`);
          buildSheet(characterData); // Refresh display
        }

        // Check and decrement Sorcery Points if action costs them
        const sorceryCost = getSorceryPointCostFromAction(action);
        if (sorceryCost > 0) {
          const sorceryResource = getSorceryPointsResource();
          if (!sorceryResource) {
            showNotification(`❌ No Sorcery Points resource found`, 'error');
            return;
          }
          if (sorceryResource.current < sorceryCost) {
            showNotification(`❌ Not enough Sorcery Points! Need ${sorceryCost}, have ${sorceryResource.current}`, 'error');
            return;
          }
          sorceryResource.current -= sorceryCost;
          saveCharacterData();
          debug.log(`✨ Used ${sorceryCost} Sorcery Points for ${action.name}. Remaining: ${sorceryResource.current}/${sorceryResource.max}`);
          showNotification(`✨ ${action.name}! (${sorceryResource.current}/${sorceryResource.max} SP left)`);
          buildSheet(characterData); // Refresh display
        }

        // Check and decrement other resources (Wild Shape, Breath Weapon, etc.)
        if (!decrementActionResources(action)) {
          return; // Not enough resources
        }

        // Check if description contains a dice formula to roll
        if (action.description) {
          const resolvedDesc = resolveVariablesInFormula(action.description);
          // Match dice formulas like "1d4", "2d6+3", or standalone "d4", "d6", etc.
          const dicePattern = /(\d*d\d+(?:[+\-]\d+)?)/gi;
          const matches = resolvedDesc.match(dicePattern);
          if (matches && matches.length > 0) {
            // Find the first valid dice formula (must have at least "d" + number)
            let diceFormula = matches[0];
            // If it starts with "d" (like "d4"), assume it's "1d4"
            if (diceFormula.startsWith('d')) {
              diceFormula = '1' + diceFormula;
            }
            debug.log(`🎲 Found dice formula in description: ${diceFormula}`);
            // Announce the action first, then roll
            announceAction(action);
            roll(action.name, diceFormula);
            return;
          }
        }

        announceAction(action);
      });
      buttonsDiv.appendChild(useBtn);
    }

    // Fallback: Add Use button for actions without attackRoll/damage/description
    // This ensures actions like "Convert Sorcery Points to Spell Slot" get a button
    if (!action.attackRoll && !action.damage && !action.description) {
      const useBtn = document.createElement('button');
      useBtn.className = 'use-btn';
      useBtn.textContent = '✨ Use';
      useBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        // Special handling for Font of Magic conversions
        if (action.name === 'Convert Sorcery Points to Spell Slot') {
          showFontOfMagicModal();
          return;
        }

        // Check and decrement uses before announcing
        if (action.uses && !decrementActionUses(action)) {
          return; // No uses remaining
        }

        // Check and decrement Ki points if action costs Ki
        const kiCost = getKiCostFromAction(action);
        if (kiCost > 0) {
          const kiResource = getKiPointsResource();
          if (!kiResource) {
            showNotification(`❌ No Ki Points resource found`, 'error');
            return;
          }
          if (kiResource.current < kiCost) {
            showNotification(`❌ Not enough Ki Points! Need ${kiCost}, have ${kiResource.current}`, 'error');
            return;
          }
          kiResource.current -= kiCost;
          saveCharacterData();
          debug.log(`✨ Used ${kiCost} Ki points for ${action.name}. Remaining: ${kiResource.current}/${kiResource.max}`);
          showNotification(`✨ ${action.name}! (${kiResource.current}/${kiResource.max} Ki left)`);
          buildSheet(characterData); // Refresh display
        }

        // Check and decrement Sorcery Points if action costs them
        const sorceryCost = getSorceryPointCostFromAction(action);
        if (sorceryCost > 0) {
          const sorceryResource = getSorceryPointsResource();
          if (!sorceryResource) {
            showNotification(`❌ No Sorcery Points resource found`, 'error');
            return;
          }
          if (sorceryResource.current < sorceryCost) {
            showNotification(`❌ Not enough Sorcery Points! Need ${sorceryCost}, have ${sorceryResource.current}`, 'error');
            return;
          }
          sorceryResource.current -= sorceryCost;
          saveCharacterData();
          debug.log(`✨ Used ${sorceryCost} Sorcery Points for ${action.name}. Remaining: ${sorceryResource.current}/${sorceryResource.max}`);
          showNotification(`✨ ${action.name}! (${sorceryResource.current}/${sorceryResource.max} SP left)`);
          buildSheet(characterData); // Refresh display
        }

        // Check and decrement other resources (Wild Shape, Breath Weapon, etc.)
        if (!decrementActionResources(action)) {
          return; // Not enough resources
        }

        announceAction(action);
      });
      buttonsDiv.appendChild(useBtn);
    }

    // Add Details toggle button if description exists
    if (action.description) {
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'toggle-btn';
      toggleBtn.textContent = '▼ Details';
      buttonsDiv.appendChild(toggleBtn);
    }

    actionHeader.appendChild(nameDiv);
    actionHeader.appendChild(buttonsDiv);
    actionCard.appendChild(actionHeader);

    // Add collapsible description if available
    if (action.description) {
      const descDiv = document.createElement('div');
      descDiv.className = 'action-description';
      // Resolve any variables in the description (like {bardicInspirationDie})
      const resolvedDescription = resolveVariablesInFormula(action.description);
      descDiv.innerHTML = `
        <div style="margin-top: 10px;">${resolvedDescription}</div>
      `;

      // Toggle functionality
      const toggleBtn = buttonsDiv.querySelector('.toggle-btn');
      actionHeader.addEventListener('click', (e) => {
        // Don't toggle if clicking on action buttons
        if (!e.target.classList.contains('attack-btn') &&
            !e.target.classList.contains('damage-btn') &&
            !e.target.classList.contains('use-btn')) {
          descDiv.classList.toggle('expanded');
          if (toggleBtn) {
            toggleBtn.textContent = descDiv.classList.contains('expanded') ? '▲ Hide' : '▼ Details';
          }
        }
      });

      actionCard.appendChild(descDiv);
    }

    container.appendChild(actionCard);
  });
}

function buildCompanionsDisplay(companions) {
  const container = document.getElementById('companions-container');
  const section = document.getElementById('companions-section');

  // Show the companions section
  section.style.display = 'block';

  container.innerHTML = '';

  companions.forEach(companion => {
    debug.log('🔍 DEBUG: Companion object in popup:', companion);
    debug.log('🔍 DEBUG: Companion abilities:', companion.abilities);
    debug.log('🔍 DEBUG: Companion abilities keys:', Object.keys(companion.abilities));

    const companionCard = document.createElement('div');
    companionCard.className = 'action-card';
    companionCard.style.background = 'var(--bg-card)';
    companionCard.style.borderColor = 'var(--border-card)';

    // Header with name and basic info
    const header = document.createElement('div');
    header.className = 'action-header';
    header.style.cursor = 'pointer';

    const nameDiv = document.createElement('div');
    nameDiv.innerHTML = `
      <div class="action-name">🐾 ${companion.name}</div>
      <div style="font-size: 0.85em; color: var(--text-secondary); font-style: italic;">
        ${companion.size} ${companion.type}${companion.alignment ? ', ' + companion.alignment : ''}
      </div>
    `;

    header.appendChild(nameDiv);
    companionCard.appendChild(header);

    // Stats block
    const statsDiv = document.createElement('div');
    statsDiv.className = 'action-description expanded';
    statsDiv.style.display = 'block';
    statsDiv.style.background = 'var(--bg-secondary)';
    statsDiv.style.padding = '12px';
    statsDiv.style.borderRadius = '4px';
    statsDiv.style.marginTop = '10px';

    let statsHTML = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px;">';

    // AC, HP, Speed
    if (companion.ac) statsHTML += `<div><strong>AC:</strong> ${companion.ac}</div>`;
    if (companion.hp) statsHTML += `<div><strong>HP:</strong> ${companion.hp}</div>`;
    if (companion.speed) statsHTML += `<div style="grid-column: span 3;"><strong>Speed:</strong> ${companion.speed}</div>`;

    statsHTML += '</div>';

    // Abilities
    if (Object.keys(companion.abilities).length > 0) {
      statsHTML += '<div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; text-align: center; margin: 10px 0; padding: 8px; background: var(--bg-tertiary); border-radius: 4px;">';
      ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
        if (companion.abilities[ability]) {
          const abil = companion.abilities[ability];
          statsHTML += `
            <div>
              <div style="font-weight: bold; font-size: 0.75em; color: var(--text-secondary);">${ability.toUpperCase()}</div>
              <div style="font-size: 1.1em; color: var(--text-primary);">${abil.score}</div>
              <div style="font-size: 0.9em; color: var(--accent-success);">(${abil.modifier >= 0 ? '+' : ''}${abil.modifier})</div>
            </div>
          `;
        }
      });
      statsHTML += '</div>';
    }

    // Senses, Languages, PB
    if (companion.senses) statsHTML += `<div style="margin: 5px 0; color: var(--text-primary);"><strong>Senses:</strong> ${companion.senses}</div>`;
    if (companion.languages) statsHTML += `<div style="margin: 5px 0; color: var(--text-primary);"><strong>Languages:</strong> ${companion.languages}</div>`;
    if (companion.proficiencyBonus) statsHTML += `<div style="margin: 5px 0; color: var(--text-primary);"><strong>Proficiency Bonus:</strong> +${companion.proficiencyBonus}</div>`;

    // Features
    if (companion.features && companion.features.length > 0) {
      statsHTML += '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">';
      companion.features.forEach(feature => {
        statsHTML += `<div style="margin: 8px 0; color: var(--text-primary);"><strong>${feature.name}.</strong> ${feature.description}</div>`;
      });
      statsHTML += '</div>';
    }

    // Actions with attack buttons
    if (companion.actions && companion.actions.length > 0) {
      statsHTML += '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color); color: var(--text-primary);"><strong>Actions</strong></div>';
      companion.actions.forEach(action => {
        statsHTML += `
          <div style="margin: 10px 0; padding: 8px; background: var(--bg-action); border: 1px solid var(--accent-danger); border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="color: var(--text-primary);">
                <strong>${action.name}.</strong> Melee Weapon Attack: +${action.attackBonus} to hit, ${action.reach}. <em>Hit:</em> ${action.damage}
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="attack-btn companion-attack-btn" data-name="${companion.name} - ${action.name}" data-bonus="${action.attackBonus}">⚔️ Attack</button>
                <button class="damage-btn companion-damage-btn" data-name="${companion.name} - ${action.name}" data-damage="${action.damage}">💥 Damage</button>
              </div>
            </div>
          </div>
        `;
      });
    }

    statsDiv.innerHTML = statsHTML;
    companionCard.appendChild(statsDiv);

    // Add event listeners for attack/damage buttons
    companionCard.querySelectorAll('.companion-attack-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = btn.dataset.name;
        const bonus = parseInt(btn.dataset.bonus);
        roll(`${name} - Attack`, `1d20+${bonus}`);
      });
    });

    companionCard.querySelectorAll('.companion-damage-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = btn.dataset.name;
        const damage = btn.dataset.damage;
        roll(`${name} - Damage`, damage);
      });
    });

    container.appendChild(companionCard);
  });
}

function decrementActionUses(action) {
  if (!action.uses) {
    return true; // No uses to track, allow action
  }

  const usesUsed = action.usesUsed || 0;
  const usesTotal = action.uses.total || action.uses.value || action.uses;
  const usesRemaining = usesTotal - usesUsed;

  if (usesRemaining <= 0) {
    showNotification(`❌ No uses remaining for ${action.name}`, 'error');
    return false;
  }

  // Increment usesUsed
  action.usesUsed = usesUsed + 1;
  const newRemaining = usesTotal - action.usesUsed;

  // Update character data and save
  saveCharacterData();

  // Show notification
  showNotification(`✅ Used ${action.name} (${newRemaining}/${usesTotal} remaining)`);

  // Rebuild the actions display to show updated count
  const actionsContainer = document.getElementById('actions-container');
  buildActionsDisplay(actionsContainer, characterData.actions);

  return true;
}

function buildResourcesDisplay() {
  const container = document.getElementById('resources-container');

  if (!characterData || !characterData.resources || characterData.resources.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666;">No class resources available</p>';
    debug.log('⚠️ No resources in character data');
    return;
  }

  const resourcesGrid = document.createElement('div');
  resourcesGrid.className = 'spell-slots-grid'; // Reuse spell slot styling

  characterData.resources.forEach(resource => {
    const resourceCard = document.createElement('div');
    resourceCard.className = resource.current > 0 ? 'spell-slot-card' : 'spell-slot-card empty';
    resourceCard.innerHTML = `
      <div class="spell-slot-level">${resource.name}</div>
      <div class="spell-slot-count">${resource.current}/${resource.max}</div>
    `;

    // Add click to manually adjust resource
    resourceCard.addEventListener('click', () => {
      adjustResource(resource);
    });
    resourceCard.style.cursor = 'pointer';

    resourcesGrid.appendChild(resourceCard);
  });

  container.innerHTML = '';
  container.appendChild(resourcesGrid);

  const note = document.createElement('p');
  note.style.cssText = 'text-align: center; color: #95a5a6; font-size: 0.85em; margin-top: 10px;';
  note.textContent = 'Click a resource to manually adjust';
  container.appendChild(note);
}

function adjustResource(resource) {
  const newValue = prompt(`Adjust ${resource.name}\n\nCurrent: ${resource.current}/${resource.max}\n\nEnter new current value (0-${resource.max}):`);

  if (newValue === null) return; // Cancelled

  const parsed = parseInt(newValue);
  if (isNaN(parsed) || parsed < 0 || parsed > resource.max) {
    alert(`Please enter a number between 0 and ${resource.max}`);
    return;
  }

  resource.current = parsed;
  saveCharacterData();
  buildSheet(characterData);

  showNotification(`✅ ${resource.name} updated to ${resource.current}/${resource.max}`);
}

function buildSpellSlotsDisplay() {
  const container = document.getElementById('spell-slots-container');

  if (!characterData || !characterData.spellSlots) {
    container.innerHTML = '<p style="text-align: center; color: #666;">No spell slots available</p>';
    debug.log('⚠️ No spell slots in character data');
    return;
  }

  const slotsGrid = document.createElement('div');
  slotsGrid.className = 'spell-slots-grid';

  let hasAnySlots = false;

  // Check each level (1-9)
  for (let level = 1; level <= 9; level++) {
    const slotVar = `level${level}SpellSlots`;
    const slotMaxVar = `level${level}SpellSlotsMax`;

    const maxSlots = characterData.spellSlots[slotMaxVar] || 0;

    // Only show if character has slots at this level
    if (maxSlots > 0) {
      hasAnySlots = true;
      const currentSlots = characterData.spellSlots[slotVar] || 0;

      const slotCard = document.createElement('div');
      slotCard.className = currentSlots > 0 ? 'spell-slot-card' : 'spell-slot-card empty';
      slotCard.innerHTML = `
        <div class="spell-slot-level">Level ${level}</div>
        <div class="spell-slot-count">${currentSlots}/${maxSlots}</div>
      `;

      // Add click to manually adjust slots
      slotCard.addEventListener('click', () => {
        adjustSpellSlot(level, currentSlots, maxSlots);
      });
      slotCard.style.cursor = 'pointer';

      slotsGrid.appendChild(slotCard);
    }
  }

  if (hasAnySlots) {
    container.innerHTML = '';
    container.appendChild(slotsGrid);

    // Add a small note
    const note = document.createElement('p');
    note.style.cssText = 'text-align: center; color: #666; font-size: 0.85em; margin-top: 8px;';
    note.textContent = 'Click a slot to manually adjust';
    container.appendChild(note);
  } else {
    container.innerHTML = '<p style="text-align: center; color: #666;">No spell slots available</p>';
    debug.log('⚠️ Character has 0 max slots for all levels');
  }
}

function adjustSpellSlot(level, current, max) {
  const newValue = prompt(`Adjust Level ${level} Spell Slots\n\nCurrent: ${current}/${max}\n\nEnter new current value (0-${max}):`);

  if (newValue === null) return; // Cancelled

  const parsed = parseInt(newValue);
  if (isNaN(parsed) || parsed < 0 || parsed > max) {
    showNotification('❌ Invalid value', 'error');
    return;
  }

  const slotVar = `level${level}SpellSlots`;
  characterData.spellSlots[slotVar] = parsed;
  saveCharacterData();
  buildSheet(characterData);

  showNotification(`✅ Level ${level} slots set to ${parsed}/${max}`);
}

function showHPModal() {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); min-width: 300px;';

  const currentHP = characterData.hitPoints.current;
  const maxHP = characterData.hitPoints.max;
  const tempHP = characterData.temporaryHP || 0;

  modalContent.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: #2c3e50; text-align: center;">Adjust Hit Points</h3>
    <div style="text-align: center; font-size: 1.2em; margin-bottom: 20px; color: #7f8c8d;">
      Current: <strong>${currentHP}${tempHP > 0 ? `+${tempHP}` : ''} / ${maxHP}</strong>
    </div>

    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 10px; font-weight: bold; color: #2c3e50;">Amount:</label>
      <input type="number" id="hp-amount" min="1" value="1" style="width: 100%; padding: 10px; font-size: 1.1em; border: 2px solid #bdc3c7; border-radius: 6px; box-sizing: border-box;">
    </div>

    <div style="margin-bottom: 25px;">
      <label style="display: block; margin-bottom: 10px; font-weight: bold; color: #2c3e50;">Action:</label>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
        <button id="hp-toggle-heal" style="padding: 12px; font-size: 0.9em; font-weight: bold; border: 2px solid #27ae60; background: #27ae60; color: white; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
          💚 Heal
        </button>
        <button id="hp-toggle-damage" style="padding: 12px; font-size: 0.9em; font-weight: bold; border: 2px solid #bdc3c7; background: white; color: #7f8c8d; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
          💔 Damage
        </button>
        <button id="hp-toggle-temp" style="padding: 12px; font-size: 0.9em; font-weight: bold; border: 2px solid #bdc3c7; background: white; color: #7f8c8d; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
          🛡️ Temp HP
        </button>
      </div>
    </div>

    <div style="display: flex; gap: 10px;">
      <button id="hp-cancel" style="flex: 1; padding: 12px; font-size: 1em; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        Cancel
      </button>
      <button id="hp-confirm" style="flex: 1; padding: 12px; font-size: 1em; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        Confirm
      </button>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Toggle state: 'heal', 'damage', or 'temp'
  let actionType = 'heal';

  const healBtn = document.getElementById('hp-toggle-heal');
  const damageBtn = document.getElementById('hp-toggle-damage');
  const tempBtn = document.getElementById('hp-toggle-temp');
  const amountInput = document.getElementById('hp-amount');

  // Helper function to reset all buttons
  const resetButtons = () => {
    healBtn.style.background = 'white';
    healBtn.style.color = '#7f8c8d';
    healBtn.style.borderColor = '#bdc3c7';
    damageBtn.style.background = 'white';
    damageBtn.style.color = '#7f8c8d';
    damageBtn.style.borderColor = '#bdc3c7';
    tempBtn.style.background = 'white';
    tempBtn.style.color = '#7f8c8d';
    tempBtn.style.borderColor = '#bdc3c7';
  };

  // Toggle button handlers
  healBtn.addEventListener('click', () => {
    actionType = 'heal';
    resetButtons();
    healBtn.style.background = '#27ae60';
    healBtn.style.color = 'white';
    healBtn.style.borderColor = '#27ae60';
  });

  damageBtn.addEventListener('click', () => {
    actionType = 'damage';
    resetButtons();
    damageBtn.style.background = '#e74c3c';
    damageBtn.style.color = 'white';
    damageBtn.style.borderColor = '#e74c3c';
  });

  tempBtn.addEventListener('click', () => {
    actionType = 'temp';
    resetButtons();
    tempBtn.style.background = '#3498db';
    tempBtn.style.color = 'white';
    tempBtn.style.borderColor = '#3498db';
  });

  // Cancel button
  document.getElementById('hp-cancel').addEventListener('click', () => {
    modal.remove();
  });

  // Confirm button
  document.getElementById('hp-confirm').addEventListener('click', () => {
    const amount = parseInt(amountInput.value);

    if (isNaN(amount) || amount <= 0) {
      showNotification('❌ Please enter a valid amount', 'error');
      return;
    }

    const oldHP = characterData.hitPoints.current;
    const oldTempHP = characterData.temporaryHP || 0;
    const colorBanner = getColoredBanner();
    let messageData;

    if (actionType === 'heal') {
      // Healing: increase current HP (up to max), doesn't affect temp HP (RAW)
      characterData.hitPoints.current = Math.min(currentHP + amount, maxHP);
      const actualHealing = characterData.hitPoints.current - oldHP;

      // Reset death saves on healing
      if (actualHealing > 0 && (characterData.deathSaves.successes > 0 || characterData.deathSaves.failures > 0)) {
        characterData.deathSaves.successes = 0;
        characterData.deathSaves.failures = 0;
        debug.log('♻️ Death saves reset due to healing');
      }

      showNotification(`💚 Healed ${actualHealing} HP! (${characterData.hitPoints.current}${characterData.temporaryHP > 0 ? `+${characterData.temporaryHP}` : ''}/${maxHP})`);

      messageData = {
        action: 'announceSpell',
        message: `&{template:default} {{name=${colorBanner}${characterData.name} regains HP}} {{💚 Healing=${actualHealing} HP}} {{Current HP=${characterData.hitPoints.current}${characterData.temporaryHP > 0 ? `+${characterData.temporaryHP}` : ''}/${maxHP}}}`,
        color: characterData.notificationColor
      };
    } else if (actionType === 'damage') {
      // Damage: deplete temp HP first, then current HP (RAW)
      let remainingDamage = amount;
      let tempHPLost = 0;
      let actualDamage = 0;

      if (characterData.temporaryHP > 0) {
        tempHPLost = Math.min(characterData.temporaryHP, remainingDamage);
        characterData.temporaryHP -= tempHPLost;
        remainingDamage -= tempHPLost;
      }

      if (remainingDamage > 0) {
        characterData.hitPoints.current = Math.max(currentHP - remainingDamage, 0);
        actualDamage = oldHP - characterData.hitPoints.current;
      }

      const damageMsg = tempHPLost > 0
        ? `💔 Took ${amount} damage! (${tempHPLost} temp HP${actualDamage > 0 ? ` + ${actualDamage} HP` : ''})`
        : `💔 Took ${actualDamage} damage!`;

      showNotification(`${damageMsg} (${characterData.hitPoints.current}${characterData.temporaryHP > 0 ? `+${characterData.temporaryHP}` : ''}/${maxHP})`);

      const damageDetails = tempHPLost > 0
        ? `{{Temp HP Lost=${tempHPLost}}}${actualDamage > 0 ? ` {{HP Lost=${actualDamage}}}` : ''}`
        : `{{HP Lost=${actualDamage}}}`;

      messageData = {
        action: 'announceSpell',
        message: `&{template:default} {{name=${colorBanner}${characterData.name} takes damage}} {{💔 Total Damage=${amount}}} ${damageDetails} {{Current HP=${characterData.hitPoints.current}${characterData.temporaryHP > 0 ? `+${characterData.temporaryHP}` : ''}/${maxHP}}}`,
        color: characterData.notificationColor
      };
    } else if (actionType === 'temp') {
      // Temp HP: RAW rules - new temp HP replaces old if higher, otherwise keep old
      const newTempHP = amount;
      if (newTempHP > oldTempHP) {
        characterData.temporaryHP = newTempHP;
        showNotification(`🛡️ Gained ${newTempHP} temp HP! (${characterData.hitPoints.current}+${characterData.temporaryHP}/${maxHP})`);

        messageData = {
          action: 'announceSpell',
          message: `&{template:default} {{name=${colorBanner}${characterData.name} gains temp HP}} {{🛡️ Temp HP=${newTempHP}}} {{Current HP=${characterData.hitPoints.current}+${characterData.temporaryHP}/${maxHP}}}`,
          color: characterData.notificationColor
        };
      } else {
        showNotification(`⚠️ Kept ${oldTempHP} temp HP (higher than ${newTempHP})`);
        modal.remove();
        return; // Don't send message if temp HP wasn't gained
      }
    }

    // Send message to Roll20
    if (messageData) {
      // Try window.opener first (Chrome)
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(messageData, '*');
        } catch (error) {
          debug.warn('⚠️ Could not send via window.opener:', error.message);
          // Fallback to background script relay
          browserAPI.runtime.sendMessage({
            action: 'relayRollToRoll20',
            roll: messageData
          });
        }
      } else {
        // Fallback: Use background script to relay to Roll20 (Firefox)
        browserAPI.runtime.sendMessage({
          action: 'relayRollToRoll20',
          roll: messageData
        });
      }
    }

    saveCharacterData();
    buildSheet(characterData);
    modal.remove();
  });

  // Focus on input
  amountInput.focus();
  amountInput.select();

  // Allow Enter key to confirm
  amountInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('hp-confirm').click();
    }
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function toggleInspiration() {
  if (!characterData) return;

  // Toggle inspiration
  characterData.inspiration = !characterData.inspiration;

  const action = characterData.inspiration ? 'gained' : 'spent';
  const emoji = characterData.inspiration ? '⭐' : '✨';

  debug.log(`${emoji} Inspiration ${action}`);
  showNotification(`${emoji} Inspiration ${action}!`);

  // Announce to Roll20
  const colorBanner = getColoredBanner();
  const messageData = {
    action: 'announceSpell',
    message: `&{template:default} {{name=${colorBanner}${characterData.name} ${characterData.inspiration ? 'gains' : 'spends'} Inspiration}} {{${emoji}=${characterData.inspiration ? 'You now have Inspiration! Use it to gain advantage on an attack roll, saving throw, or ability check.' : 'Inspiration spent. You can earn it again from your DM!'}}}`,
    color: characterData.notificationColor
  };

  // Send to Roll20
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(messageData, '*');
    } catch (error) {
      debug.warn('⚠️ Could not send via window.opener:', error.message);
      browserAPI.runtime.sendMessage({
        action: 'relayRollToRoll20',
        roll: messageData
      });
    }
  } else {
    browserAPI.runtime.sendMessage({
      action: 'relayRollToRoll20',
      roll: messageData
    });
  }

  saveCharacterData();
  buildSheet(characterData);
}

function showDeathSavesModal() {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); min-width: 300px;';

  const successes = characterData.deathSaves.successes || 0;
  const failures = characterData.deathSaves.failures || 0;

  modalContent.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: #2c3e50; text-align: center;">Death Saves</h3>
    <div style="text-align: center; font-size: 1.2em; margin-bottom: 20px;">
      <div style="margin-bottom: 10px;">
        <span style="color: #27ae60; font-weight: bold;">Successes: ${successes}/3</span>
      </div>
      <div>
        <span style="color: #e74c3c; font-weight: bold;">Failures: ${failures}/3</span>
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <button id="roll-death-save" style="width: 100%; padding: 15px; font-size: 1.1em; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-bottom: 15px;">
        🎲 Roll Death Save
      </button>
    </div>

    <div style="margin-bottom: 20px; border-top: 1px solid #ecf0f1; padding-top: 20px;">
      <label style="display: block; margin-bottom: 10px; font-weight: bold; color: #2c3e50;">Manual Adjustment:</label>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
        <button id="add-success" style="padding: 10px; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
          + Success
        </button>
        <button id="add-failure" style="padding: 10px; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
          + Failure
        </button>
      </div>
      <button id="reset-death-saves" style="width: 100%; padding: 10px; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        Reset All
      </button>
    </div>

    <button id="close-modal" style="width: 100%; padding: 12px; font-size: 1em; background: #7f8c8d; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
      Close
    </button>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Roll death save button
  document.getElementById('roll-death-save').addEventListener('click', () => {
    // Roll 1d20 locally to determine outcome
    const rollResult = Math.floor(Math.random() * 20) + 1;
    debug.log(`🎲 Death Save rolled: ${rollResult}`);

    // Determine outcome based on D&D 5e rules
    let message = '';
    let isSuccess = false;

    if (rollResult === 20) {
      // Natural 20: regain 1 HP (represented as 2 successes in death saves)
      if (characterData.deathSaves.successes < 3) {
        characterData.deathSaves.successes += 2;
        if (characterData.deathSaves.successes > 3) characterData.deathSaves.successes = 3;
      }
      message = `💚 NAT 20! Death Save Success x2 (${characterData.deathSaves.successes}/3)`;
      isSuccess = true;
    } else if (rollResult === 1) {
      // Natural 1: counts as 2 failures
      if (characterData.deathSaves.failures < 3) {
        characterData.deathSaves.failures += 2;
        if (characterData.deathSaves.failures > 3) characterData.deathSaves.failures = 3;
      }
      message = `💀 NAT 1! Death Save Failure x2 (${characterData.deathSaves.failures}/3)`;
    } else if (rollResult >= 10) {
      // Success
      if (characterData.deathSaves.successes < 3) {
        characterData.deathSaves.successes++;
      }
      message = `✓ Death Save Success (${characterData.deathSaves.successes}/3)`;
      isSuccess = true;
    } else {
      // Failure
      if (characterData.deathSaves.failures < 3) {
        characterData.deathSaves.failures++;
      }
      message = `✗ Death Save Failure (${characterData.deathSaves.failures}/3)`;
    }

    // Save updated death saves
    saveCharacterData();
    showNotification(message);

    // Send roll result to Roll20 (show result in name since we rolled locally)
    roll(`Death Save: ${rollResult}`, '1d20', rollResult);

    // Rebuild sheet to show updated death saves
    buildSheet(characterData);
    modal.remove();
  });

  // Add success button
  document.getElementById('add-success').addEventListener('click', () => {
    if (characterData.deathSaves.successes < 3) {
      characterData.deathSaves.successes++;
      saveCharacterData();
      showNotification(`✓ Death Save Success (${characterData.deathSaves.successes}/3)`);
      buildSheet(characterData);
      modal.remove();
    }
  });

  // Add failure button
  document.getElementById('add-failure').addEventListener('click', () => {
    if (characterData.deathSaves.failures < 3) {
      characterData.deathSaves.failures++;
      saveCharacterData();
      showNotification(`✗ Death Save Failure (${characterData.deathSaves.failures}/3)`);
      buildSheet(characterData);
      modal.remove();
    }
  });

  // Reset button
  document.getElementById('reset-death-saves').addEventListener('click', () => {
    characterData.deathSaves.successes = 0;
    characterData.deathSaves.failures = 0;
    saveCharacterData();
    showNotification('♻️ Death saves reset');
    buildSheet(characterData);
    modal.remove();
  });

  // Close button
  document.getElementById('close-modal').addEventListener('click', () => {
    modal.remove();
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// ===== CARD CREATION =====
// Moved to modules/card-creator.js - using wrapper for compatibility
function createCard(title, main, sub, onClick) {
  return window.CardCreator.createCard(title, main, sub, onClick);
}

function createSpellCard(spell, index) {
  const card = document.createElement('div');
  card.className = 'spell-card';

  const header = document.createElement('div');
  header.className = 'spell-header';

  // Build tags string
  let tags = '';
  if (spell.concentration) {
    tags += '<span class="concentration-tag">🧠 Concentration</span>';
  }
  if (spell.ritual) {
    tags += '<span class="ritual-tag">📖 Ritual</span>';
  }

  header.innerHTML = `
    <div>
      <span style="font-weight: bold;">${spell.name}</span>
      ${spell.level ? `<span style="margin-left: 10px; color: #666;">Level ${spell.level}</span>` : ''}
      ${tags}
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="cast-btn" data-spell-index="${index}">✨ Cast</button>
      <button class="toggle-btn">▼ Details</button>
    </div>
  `;

  const desc = document.createElement('div');
  desc.className = 'spell-description';
  desc.id = `spell-desc-${index}`;
  desc.innerHTML = `
    ${spell.castingTime ? `<div><strong>Casting Time:</strong> ${spell.castingTime}</div>` : ''}
    ${spell.range ? `<div><strong>Range:</strong> ${spell.range}</div>` : ''}
    ${spell.components ? `<div><strong>Components:</strong> ${spell.components}</div>` : ''}
    ${spell.duration ? `<div><strong>Duration:</strong> ${spell.duration}</div>` : ''}
    ${spell.school ? `<div><strong>School:</strong> ${spell.school}</div>` : ''}
    ${spell.source ? `<div><strong>Source:</strong> ${spell.source}</div>` : ''}
    ${spell.description ? `<div style="margin-top: 10px;">${spell.description}</div>` : ''}
    ${spell.formula ? `<button class="roll-btn">🎲 Roll ${spell.formula}</button>` : ''}
  `;

  // Toggle functionality
  const toggleBtn = header.querySelector('.toggle-btn');
  header.addEventListener('click', (e) => {
    if (!e.target.classList.contains('roll-btn') && !e.target.classList.contains('cast-btn')) {
      desc.classList.toggle('expanded');
      toggleBtn.textContent = desc.classList.contains('expanded') ? '▲ Hide' : '▼ Details';
    }
  });

  // Cast button
  const castBtn = header.querySelector('.cast-btn');
  castBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    castSpell(spell, index);
  });

  // Roll button
  const rollBtn = desc.querySelector('.roll-btn');
  if (rollBtn && spell.formula) {
    rollBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      roll(spell.name, spell.formula);
    });
  }

  card.appendChild(header);
  card.appendChild(desc);
  return card;
}

function castSpell(spell, index) {
  debug.log('✨ Attempting to cast:', spell.name, spell);

  if (!characterData) {
    showNotification('❌ Character data not available', 'error');
    return;
  }

  // Cantrips (level 0) don't need slots
  if (!spell.level || spell.level === 0 || spell.level === '0') {
    debug.log('✨ Casting cantrip (no resource needed)');
    announceSpellCast(spell);
    showNotification(`✨ Cast ${spell.name}!`);
    return;
  }

  const spellLevel = parseInt(spell.level);

  // Check spell slots
  const slotVar = `level${spellLevel}SpellSlots`;
  const slotMaxVar = `level${spellLevel}SpellSlotsMax`;

  const currentSlots = characterData.spellSlots?.[slotVar] || 0;
  const maxSlots = characterData.spellSlots?.[slotMaxVar] || 0;

  debug.log(`📊 Spell slots for level ${spellLevel}:`, { current: currentSlots, max: maxSlots });

  // In D&D 5e, spells are cast using spell slots (not class resources like Ki or Sorcery Points)
  // Class resources are used for class features, and Sorcery Points are used for metamagic
  // Metamagic is handled in showUpcastChoice(), not here

  // Use spell slot - but check if there are higher level slots for upcasting
  if (currentSlots <= 0) {
    // Check if there are any higher level slots available for upcasting
    let hasHigherSlots = false;
    for (let level = spellLevel + 1; level <= 9; level++) {
      const higherSlotVar = `level${level}SpellSlots`;
      if ((characterData.spellSlots?.[higherSlotVar] || 0) > 0) {
        hasHigherSlots = true;
        break;
      }
    }

    if (hasHigherSlots) {
      // Show upcast choice even though base level is empty
      showUpcastChoice(spell, spellLevel);
      return;
    } else {
      showNotification(`❌ No spell slots remaining for level ${spellLevel} or higher!`, 'error');
      return;
    }
  }

  // Has slots at this level - show upcast choice
  showUpcastChoice(spell, spellLevel);
}

function detectClassResources(spell) {
  const resources = [];
  const otherVars = characterData.otherVariables || {};

  // Check for Ki (Monk)
  if (otherVars.ki !== undefined || otherVars.kiPoints !== undefined) {
    const ki = otherVars.ki || otherVars.kiPoints || 0;
    const kiMax = otherVars.kiMax || otherVars.kiPointsMax || 0;
    if (ki > 0) {
      resources.push({ name: 'Ki', current: ki, max: kiMax, varName: otherVars.ki !== undefined ? 'ki' : 'kiPoints' });
    }
  }

  // NOTE: Sorcery Points are NOT a casting resource - they're only used for metamagic
  // Metamagic is handled in the spell slot casting flow, not as an alternative resource

  // Check for Pact Magic slots (Warlock)
  if (otherVars.pactMagicSlots !== undefined) {
    const slots = otherVars.pactMagicSlots || 0;
    const slotsMax = otherVars.pactMagicSlotsMax || 0;
    if (slots > 0) {
      resources.push({ name: 'Pact Magic', current: slots, max: slotsMax, varName: 'pactMagicSlots' });
    }
  }

  // Check for Channel Divinity (Cleric/Paladin)
  if (otherVars.channelDivinity !== undefined) {
    const uses = otherVars.channelDivinity || 0;
    const usesMax = otherVars.channelDivinityMax || 0;
    if (uses > 0) {
      resources.push({ name: 'Channel Divinity', current: uses, max: usesMax, varName: 'channelDivinity' });
    }
  }

  return resources;
}

function showResourceChoice(spell, spellLevel, spellSlots, maxSlots, classResources) {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px; width: 90%;';

  let buttonsHTML = `
    <h3 style="margin: 0 0 20px 0; color: #2c3e50; text-align: center;">Cast ${spell.name}</h3>
    <p style="text-align: center; color: #7f8c8d; margin-bottom: 25px;">Choose a resource:</p>
    <div style="display: flex; flex-direction: column; gap: 12px;">
  `;

  // Add spell slot option if available
  if (spellSlots > 0) {
    buttonsHTML += `
      <button class="resource-choice-btn" data-type="spell-slot" data-level="${spellLevel}" style="padding: 15px; font-size: 1em; font-weight: bold; background: #9b59b6; color: white; border: 2px solid #9b59b6; border-radius: 8px; cursor: pointer; transition: all 0.2s; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>Level ${spellLevel} Spell Slot</span>
          <span style="background: rgba(255,255,255,0.3); padding: 4px 8px; border-radius: 4px; font-size: 0.9em;">${spellSlots}/${maxSlots}</span>
        </div>
      </button>
    `;
  }

  // Add class resource options
  classResources.forEach((resource, idx) => {
    const colors = {
      'Ki': { bg: '#f39c12', border: '#f39c12' },
      'Sorcery Points': { bg: '#e74c3c', border: '#e74c3c' },
      'Pact Magic': { bg: '#16a085', border: '#16a085' },
      'Channel Divinity': { bg: '#3498db', border: '#3498db' }
    };
    const color = colors[resource.name] || { bg: '#95a5a6', border: '#95a5a6' };

    buttonsHTML += `
      <button class="resource-choice-btn" data-type="class-resource" data-index="${idx}" style="padding: 15px; font-size: 1em; font-weight: bold; background: ${color.bg}; color: white; border: 2px solid ${color.border}; border-radius: 8px; cursor: pointer; transition: all 0.2s; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>${resource.name}</span>
          <span style="background: rgba(255,255,255,0.3); padding: 4px 8px; border-radius: 4px; font-size: 0.9em;">${resource.current}/${resource.max}</span>
        </div>
      </button>
    `;
  });

  buttonsHTML += `
    </div>
    <button id="resource-cancel" style="width: 100%; margin-top: 20px; padding: 12px; font-size: 1em; background: #95a5a6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
      Cancel
    </button>
  `;

  modalContent.innerHTML = buttonsHTML;
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Add hover effects
  const resourceBtns = modalContent.querySelectorAll('.resource-choice-btn');
  resourceBtns.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = 'none';
    });

    btn.addEventListener('click', () => {
      const type = btn.dataset.type;

      if (type === 'spell-slot') {
        const level = parseInt(btn.dataset.level);
        modal.remove();
        // Check if they want to upcast
        showUpcastChoice(spell, level);
      } else if (type === 'class-resource') {
        const resourceIdx = parseInt(btn.dataset.index);
        const resource = classResources[resourceIdx];
        modal.remove();
        if (useClassResource(resource, spell)) {
          announceSpellCast(spell, resource.name);
        }
      }
    });
  });

  // Cancel button
  document.getElementById('resource-cancel').addEventListener('click', () => {
    modal.remove();
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function showUpcastChoice(spell, originalLevel) {
  // Get all available spell slots at this level or higher
  const availableSlots = [];
  for (let level = originalLevel; level <= 9; level++) {
    const slotVar = `level${level}SpellSlots`;
    const slotMaxVar = `level${level}SpellSlotsMax`;
    const current = characterData.spellSlots?.[slotVar] || 0;
    const max = characterData.spellSlots?.[slotMaxVar] || 0;

    if (current > 0) {
      availableSlots.push({ level, current, max, slotVar, slotMaxVar });
    }
  }

  // Check for metamagic options
  const metamagicOptions = getAvailableMetamagic();
  const sorceryPoints = getSorceryPointsResource();
  debug.log('🔮 Metamagic detection:', {
    metamagicOptions,
    sorceryPoints,
    hasMetamagic: metamagicOptions.length > 0 && sorceryPoints && sorceryPoints.current > 0
  });
  const hasMetamagic = metamagicOptions.length > 0 && sorceryPoints && sorceryPoints.current > 0;

  // If only the original level is available and no metamagic, just cast it
  if (availableSlots.length === 1 && !hasMetamagic) {
    castWithSlot(spell, availableSlots[0]);
    return;
  }

  // Show upcast modal
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px; width: 90%;';

  let dropdownHTML = `
    <h3 style="margin: 0 0 20px 0; color: #2c3e50; text-align: center;">Cast ${spell.name}</h3>
    <p style="text-align: center; color: #7f8c8d; margin-bottom: 20px;">Level ${originalLevel} spell</p>

    <div style="margin-bottom: 25px;">
      <label style="display: block; margin-bottom: 10px; font-weight: bold; color: #2c3e50;">Spell Slot Level:</label>
      <select id="upcast-slot-select" style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid #bdc3c7; border-radius: 6px; box-sizing: border-box; background: white;">
  `;

  availableSlots.forEach(slot => {
    const label = slot.level === originalLevel
      ? `Level ${slot.level} (Normal) - ${slot.current}/${slot.max} remaining`
      : `Level ${slot.level} (Upcast) - ${slot.current}/${slot.max} remaining`;
    dropdownHTML += `<option value="${slot.level}">${label}</option>`;
  });

  dropdownHTML += `
      </select>
    </div>
  `;

  // Add metamagic options if available
  if (hasMetamagic) {
    dropdownHTML += `
      <div style="margin-bottom: 20px; padding: 12px; background: #f8f9fa; border-radius: 8px; border: 2px solid #9b59b6;">
        <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; margin-bottom: 8px;" onclick="document.getElementById('metamagic-container').style.display = document.getElementById('metamagic-container').style.display === 'none' ? 'flex' : 'none'; this.querySelector('.toggle-arrow').textContent = document.getElementById('metamagic-container').style.display === 'none' ? '▶' : '▼';">
          <label style="font-weight: bold; color: #9b59b6; cursor: pointer;">✨ Metamagic (Sorcery Points: ${sorceryPoints.current}/${sorceryPoints.max})</label>
          <span class="toggle-arrow" style="color: #9b59b6; font-size: 0.8em;">▼</span>
        </div>
        <div id="metamagic-container" style="display: flex; flex-direction: column; gap: 6px;">
    `;

    metamagicOptions.forEach((meta, index) => {
      const cost = meta.cost === 'variable' ? calculateMetamagicCost(meta.name, originalLevel) : meta.cost;
      const canAfford = sorceryPoints.current >= cost;
      const disabledStyle = !canAfford ? 'opacity: 0.5; cursor: not-allowed;' : '';

      dropdownHTML += `
          <label style="display: flex; align-items: center; padding: 8px; background: white; border-radius: 4px; cursor: pointer; ${disabledStyle}" title="${meta.description || ''}">
            <input type="checkbox" class="metamagic-option" data-name="${meta.name}" data-cost="${cost}" ${!canAfford ? 'disabled' : ''} style="margin-right: 8px; width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;">
            <span style="flex: 1; color: #2c3e50; font-size: 0.95em;">${meta.name}</span>
            <span style="color: #9b59b6; font-weight: bold; font-size: 0.9em;">${cost} SP</span>
          </label>
      `;
    });

    dropdownHTML += `
        </div>
        <div id="metamagic-cost" style="margin-top: 8px; text-align: right; font-weight: bold; color: #2c3e50; font-size: 0.9em;">Total Cost: 0 SP</div>
      </div>
    `;
  }

  dropdownHTML += `
    <div style="display: flex; gap: 10px;">
      <button id="upcast-cancel" style="flex: 1; padding: 12px; font-size: 1em; background: #95a5a6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
        Cancel
      </button>
      <button id="upcast-confirm" style="flex: 1; padding: 12px; font-size: 1em; background: #9b59b6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
        Cast Spell
      </button>
    </div>
  `;

  modalContent.innerHTML = dropdownHTML;
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  const selectElement = document.getElementById('upcast-slot-select');
  const confirmBtn = document.getElementById('upcast-confirm');
  const cancelBtn = document.getElementById('upcast-cancel');

  // Track metamagic selections
  let selectedMetamagic = [];

  if (hasMetamagic) {
    const metamagicCheckboxes = document.querySelectorAll('.metamagic-option');
    const costDisplay = document.getElementById('metamagic-cost');

    // Update selected spell level when it changes (affects Twinned Spell cost)
    selectElement.addEventListener('change', () => {
      const selectedLevel = parseInt(selectElement.value);

      // Recalculate costs for variable-cost metamagic
      metamagicCheckboxes.forEach(checkbox => {
        const metaName = checkbox.dataset.name;
        const metaOption = metamagicOptions.find(m => m.name === metaName);
        if (metaOption && metaOption.cost === 'variable') {
          const newCost = calculateMetamagicCost(metaName, selectedLevel);
          checkbox.dataset.cost = newCost;

          // Update display
          const label = checkbox.closest('label');
          const costSpan = label.querySelector('span:last-child');
          costSpan.textContent = `${newCost} SP`;

          // Check if still affordable
          if (sorceryPoints.current < newCost && checkbox.checked) {
            checkbox.checked = false;
          }
        }
      });

      // Update total cost
      updateMetamagicCost();
    });

    function updateMetamagicCost() {
      let totalCost = 0;
      selectedMetamagic = [];

      metamagicCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
          const cost = parseInt(checkbox.dataset.cost);
          totalCost += cost;
          selectedMetamagic.push({
            name: checkbox.dataset.name,
            cost: cost
          });
        }
      });

      costDisplay.textContent = `Total Cost: ${totalCost} SP`;

      // Disable confirm if not enough sorcery points
      if (totalCost > sorceryPoints.current) {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        confirmBtn.style.cursor = 'not-allowed';
      } else {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.style.cursor = 'pointer';
      }
    }

    metamagicCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', updateMetamagicCost);
    });
  }

  confirmBtn.addEventListener('click', () => {
    const selectedLevel = parseInt(selectElement.value);
    const selectedSlot = availableSlots.find(s => s.level === selectedLevel);
    modal.remove();
    castWithSlot(spell, selectedSlot, selectedMetamagic);
  });

  cancelBtn.addEventListener('click', () => {
    modal.remove();
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function castWithSlot(spell, slot, metamagicOptions = []) {
  // Deduct spell slot
  characterData.spellSlots[slot.slotVar] = slot.current - 1;

  // Deduct sorcery points for metamagic
  let totalMetamagicCost = 0;
  let metamagicNames = [];

  if (metamagicOptions && metamagicOptions.length > 0) {
    const sorceryPoints = getSorceryPointsResource();
    if (sorceryPoints) {
      metamagicOptions.forEach(meta => {
        totalMetamagicCost += meta.cost;
        metamagicNames.push(meta.name);
      });

      // Deduct sorcery points
      sorceryPoints.current = Math.max(0, sorceryPoints.current - totalMetamagicCost);
      debug.log(`✨ Used ${totalMetamagicCost} sorcery points for metamagic. Remaining: ${sorceryPoints.current}/${sorceryPoints.max}`);
    }
  }

  saveCharacterData();

  let resourceText = slot.level > parseInt(spell.level)
    ? `Level ${slot.level} slot (upcast from ${spell.level})`
    : `Level ${slot.level} slot`;

  // Add metamagic to resource text
  if (metamagicNames.length > 0) {
    resourceText += ` + ${metamagicNames.join(', ')} (${totalMetamagicCost} SP)`;
  }

  debug.log(`✅ Used spell slot. Remaining: ${characterData.spellSlots[slot.slotVar]}/${slot.max}`);

  let notificationText = `✨ Cast ${spell.name}! (${characterData.spellSlots[slot.slotVar]}/${slot.max} slots left)`;
  if (metamagicNames.length > 0) {
    const sorceryPoints = getSorceryPointsResource();
    notificationText += ` with ${metamagicNames.join(', ')}! (${sorceryPoints.current}/${sorceryPoints.max} SP left)`;
  }

  announceSpellCast(spell, resourceText);
  showNotification(notificationText);

  // Update the display
  buildSheet(characterData);
}

function useClassResource(resource, spell) {
  if (resource.current <= 0) {
    showNotification(`❌ No ${resource.name} remaining!`, 'error');
    return false;
  }

  characterData.otherVariables[resource.varName] = resource.current - 1;
  saveCharacterData();

  debug.log(`✅ Used ${resource.name}. Remaining: ${characterData.otherVariables[resource.varName]}/${resource.max}`);
  showNotification(`✨ Cast ${spell.name}! (${characterData.otherVariables[resource.varName]}/${resource.max} ${resource.name} left)`);

  buildSheet(characterData);
  return true;
}

// ===== COLOR UTILITIES =====
// Moved to modules/color-utils.js - using wrapper functions for compatibility
function getColorEmoji(color) {
  return window.ColorUtils.getColorEmoji(color);
}

function getColoredBanner() {
  return window.ColorUtils.getColoredBanner(characterData);
}

function getColorName(hexColor) {
  return window.ColorUtils.getColorName(hexColor);
}

function announceSpellCast(spell, resourceUsed) {
  // Build a fancy formatted message using Roll20 template syntax with custom color
  const colorBanner = getColoredBanner();
  let message = `&{template:default} {{name=${colorBanner}${characterData.name} casts ${spell.name}!}}`;

  // Add resource usage if applicable
  if (resourceUsed) {
    message += ` {{Resource=${resourceUsed}}}`;
  }

  // Add spell level and school
  if (spell.level && spell.level > 0) {
    let levelText = `Level ${spell.level}`;
    if (spell.school) {
      levelText += ` ${spell.school}`;
    }
    message += ` {{Level=${levelText}}}`;
  } else if (spell.school) {
    message += ` {{Level=${spell.school} cantrip}}`;
  }

  // Add casting details
  if (spell.castingTime) {
    message += ` {{Casting Time=${spell.castingTime}}}`;
  }
  if (spell.range) {
    message += ` {{Range=${spell.range}}}`;
  }
  if (spell.duration) {
    message += ` {{Duration=${spell.duration}}}`;
  }

  // Add components if available
  if (spell.components) {
    message += ` {{Components=${spell.components}}}`;
  }

  // Add description
  if (spell.description) {
    message += ` {{Description=${spell.description}}}`;
  }

  // Send to Roll20 chat
  const messageData = {
    action: 'announceSpell',
    spellName: spell.name,
    characterName: characterData.name,
    message: message,
    color: characterData.notificationColor
  };

  // Try window.opener first (Chrome)
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(messageData, '*');
      debug.log('✅ Spell announcement sent via window.opener');
    } catch (error) {
      debug.warn('⚠️ Could not send via window.opener:', error.message);
      // Fall through to background script relay
    }
  } else {
    // Fallback: Use background script to relay to Roll20 (Firefox)
    debug.log('📡 Using background script to relay spell announcement to Roll20...');
    browserAPI.runtime.sendMessage({
      action: 'relayRollToRoll20',
      roll: messageData
    }, (response) => {
      if (browserAPI.runtime.lastError) {
        debug.error('❌ Error relaying spell announcement:', browserAPI.runtime.lastError);
      } else if (response && response.success) {
        debug.log('✅ Spell announcement relayed to Roll20');
      }
    });
  }

  // Also roll if there's a formula
  if (spell.formula) {
    setTimeout(() => {
      roll(spell.name, spell.formula);
    }, 500);
  }
}

// ===== METAMAGIC SYSTEM =====

function getAvailableMetamagic() {
  // Metamagic costs (in sorcery points)
  const metamagicCosts = {
    'Careful Spell': 1,
    'Distant Spell': 1,
    'Empowered Spell': 1,
    'Extended Spell': 1,
    'Heightened Spell': 3,
    'Quickened Spell': 2,
    'Subtle Spell': 1,
    'Twinned Spell': 'variable' // Cost equals spell level (min 1 for cantrips)
  };

  if (!characterData || !characterData.features) {
    debug.log('🔮 No characterData or features for metamagic detection');
    return [];
  }

  // DEBUG: Log all features to see what we have
  debug.log('🔮 All character features:', characterData.features.map(f => f.name));

  // Find metamagic features (case-insensitive matching)
  const metamagicOptions = characterData.features.filter(feature => {
    const name = feature.name.trim();
    // Try exact match first
    let matchedName = null;
    if (metamagicCosts.hasOwnProperty(name)) {
      matchedName = name;
    } else {
      // Try case-insensitive match
      matchedName = Object.keys(metamagicCosts).find(key =>
        key.toLowerCase() === name.toLowerCase()
      );
    }

    if (matchedName) {
      debug.log(`🔮 Found metamagic feature: "${name}" (matched as "${matchedName}")`);
      feature._matchedName = matchedName; // Store for later use
      return true;
    }
    return false;
  }).map(feature => {
    const matchedName = feature._matchedName || feature.name.trim();
    return {
      name: matchedName,
      cost: metamagicCosts[matchedName],
      description: feature.description || ''
    };
  });

  debug.log('🔮 Found metamagic options:', metamagicOptions.map(m => m.name));
  return metamagicOptions;
}

function getSorceryPointsResource() {
  if (!characterData || !characterData.resources) {
    debug.log('🔮 No characterData or resources for sorcery points detection');
    return null;
  }

  // DEBUG: Log all resources to see what we have
  debug.log('🔮 All character resources:', characterData.resources.map(r => ({ name: r.name, current: r.current, max: r.max })));

  // Find sorcery points in resources (flexible matching)
  const sorceryResource = characterData.resources.find(r => {
    const lowerName = r.name.toLowerCase().trim();
    const isSorceryPoints =
      lowerName.includes('sorcery point') ||
      lowerName === 'sorcery points' ||
      lowerName === 'sorcery' ||
      lowerName.includes('sorcerer point');
    if (isSorceryPoints) {
      debug.log(`🔮 Found sorcery points resource: "${r.name}" (${r.current}/${r.max})`);
    }
    return isSorceryPoints;
  });

  if (!sorceryResource) {
    debug.log('🔮 No sorcery points resource found');
  }

  return sorceryResource || null;
}

function getKiPointsResource() {
  if (!characterData || !characterData.resources) return null;

  // Find ki points in resources
  const kiResource = characterData.resources.find(r => {
    const lowerName = r.name.toLowerCase();
    return lowerName.includes('ki point') || lowerName === 'ki points' || lowerName === 'ki';
  });

  return kiResource || null;
}

function getLayOnHandsResource() {
  if (!characterData || !characterData.resources) return null;

  // Find Lay on Hands pool in resources
  const layOnHandsResource = characterData.resources.find(r => {
    const lowerName = r.name.toLowerCase();
    return lowerName.includes('lay on hands') || lowerName === 'lay on hands pool';
  });

  return layOnHandsResource || null;
}

function handleLayOnHands(action) {
  const layOnHandsPool = getLayOnHandsResource();

  if (!layOnHandsPool) {
    showNotification(`❌ No Lay on Hands pool resource found`, 'error');
    return;
  }

  if (layOnHandsPool.current <= 0) {
    showNotification(`❌ No Lay on Hands points remaining!`, 'error');
    return;
  }

  // Prompt user for how many points to spend
  const maxPoints = layOnHandsPool.current;
  const amountStr = prompt(
    `Lay on Hands\n\n` +
    `Available Points: ${layOnHandsPool.current}/${layOnHandsPool.max}\n\n` +
    `How many hit points do you want to restore?\n` +
    `(Enter 1-${maxPoints}, or 5 to cure disease/poison)`
  );

  if (amountStr === null) return; // Cancelled

  const amount = parseInt(amountStr);
  if (isNaN(amount) || amount < 1) {
    showNotification(`❌ Please enter a valid number`, 'error');
    return;
  }

  if (amount > maxPoints) {
    showNotification(`❌ Not enough points! You have ${maxPoints} remaining`, 'error');
    return;
  }

  // Deduct points
  layOnHandsPool.current -= amount;
  saveCharacterData();

  // Announce the healing
  debug.log(`💚 Used ${amount} Lay on Hands points. Remaining: ${layOnHandsPool.current}/${layOnHandsPool.max}`);

  if (amount === 5) {
    // Might be curing disease/poison
    announceAction({
      name: 'Lay on Hands',
      description: `Restored ${amount} HP (or cured disease/poison)`
    });
    showNotification(`💚 Lay on Hands: ${amount} HP (${layOnHandsPool.current}/${layOnHandsPool.max} points left)`);
  } else {
    announceAction({
      name: 'Lay on Hands',
      description: `Restored ${amount} HP`
    });
    showNotification(`💚 Lay on Hands: Restored ${amount} HP (${layOnHandsPool.current}/${layOnHandsPool.max} points left)`);
  }

  // Refresh display to show updated pool
  buildSheet(characterData);
}

function getResourceCostsFromAction(action) {
  // Use DiceCloud's structured resource consumption data instead of regex parsing
  if (!action || !action.resources || !action.resources.attributesConsumed) {
    return [];
  }

  const costs = action.resources.attributesConsumed.map(consumed => {
    const quantity = consumed.quantity?.value || 0;
    return {
      name: consumed.statName || '',
      variableName: consumed.variableName || '',
      quantity: quantity
    };
  });

  if (costs.length > 0) {
    debug.log(`💰 Resource costs for ${action.name}:`, costs);
  }

  return costs;
}

// Legacy functions for backwards compatibility (now use structured data)
function getKiCostFromAction(action) {
  const costs = getResourceCostsFromAction(action);
  const kiCost = costs.find(c =>
    c.variableName === 'kiPoints' ||
    c.name.toLowerCase().includes('ki point')
  );

  if (kiCost) {
    debug.log(`💨 Ki cost for ${action.name}: ${kiCost.quantity} ki points`);
    return kiCost.quantity;
  }

  return 0;
}

function getSorceryPointCostFromAction(action) {
  const costs = getResourceCostsFromAction(action);
  const sorceryCost = costs.find(c =>
    c.variableName === 'sorceryPoints' ||
    c.name.toLowerCase().includes('sorcery point')
  );

  if (sorceryCost) {
    debug.log(`✨ Sorcery Point cost for ${action.name}: ${sorceryCost.quantity} SP`);
    return sorceryCost.quantity;
  }

  return 0;
}

function decrementActionResources(action) {
  // Decrement all resource costs for an action (Wild Shape uses, Breath Weapon uses, etc.)
  const costs = getResourceCostsFromAction(action);

  if (!costs || costs.length === 0) {
    return true; // No resources to decrement
  }

  // Check all resources have sufficient quantities before decrementing any
  for (const cost of costs) {
    // Skip Ki and Sorcery Points as they're handled separately
    if (cost.variableName === 'kiPoints' || cost.variableName === 'sorceryPoints') {
      continue;
    }

    if (!cost.variableName) {
      debug.log(`⚠️ Resource cost missing variableName for ${action.name}:`, cost);
      continue;
    }

    // Find the resource in character data
    const resource = characterData.resources?.find(r => r.variableName === cost.variableName);

    if (!resource) {
      debug.log(`⚠️ Resource not found: ${cost.variableName} for ${action.name}`);
      continue;
    }

    if (resource.current < cost.quantity) {
      showNotification(`❌ Not enough ${cost.name || cost.variableName}! Need ${cost.quantity}, have ${resource.current}`, 'error');
      return false;
    }
  }

  // All checks passed, now decrement the resources
  for (const cost of costs) {
    // Skip Ki and Sorcery Points as they're handled separately
    if (cost.variableName === 'kiPoints' || cost.variableName === 'sorceryPoints') {
      continue;
    }

    if (!cost.variableName) {
      continue;
    }

    const resource = characterData.resources?.find(r => r.variableName === cost.variableName);

    if (resource) {
      resource.current -= cost.quantity;
      debug.log(`✅ Used ${cost.quantity} ${cost.name || cost.variableName} for ${action.name}. Remaining: ${resource.current}/${resource.max}`);
      showNotification(`✅ Used ${action.name}! (${resource.current}/${resource.max} ${cost.name || cost.variableName} left)`);
    }
  }

  saveCharacterData();
  buildSheet(characterData); // Refresh display
  return true;
}

function calculateMetamagicCost(metamagicName, spellLevel) {
  const metamagicCosts = {
    'Careful Spell': 1,
    'Distant Spell': 1,
    'Empowered Spell': 1,
    'Extended Spell': 1,
    'Heightened Spell': 3,
    'Quickened Spell': 2,
    'Subtle Spell': 1,
    'Twinned Spell': 'variable'
  };

  const cost = metamagicCosts[metamagicName];
  if (cost === 'variable') {
    // Twinned Spell costs spell level (minimum 1 for cantrips)
    return Math.max(1, spellLevel);
  }
  return cost || 0;
}

function showConvertSlotToPointsModal() {
  const sorceryPoints = getSorceryPointsResource();

  if (!sorceryPoints) {
    showNotification('❌ No Sorcery Points resource found', 'error');
    return;
  }

  // Get available spell slots
  const availableSlots = [];
  for (let level = 1; level <= 9; level++) {
    const slotVar = `level${level}SpellSlots`;
    const maxSlotVar = `level${level}SpellSlotsMax`;
    const current = characterData.spellSlots?.[slotVar] || 0;
    const max = characterData.spellSlots?.[maxSlotVar] || 0;

    if (current > 0) {
      availableSlots.push({ level, current, max, slotVar, maxSlotVar });
    }
  }

  if (availableSlots.length === 0) {
    showNotification('❌ No spell slots available to convert!', 'error');
    return;
  }

  // Create modal
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px; width: 90%;';

  let optionsHTML = `
    <h3 style="margin: 0 0 15px 0; color: #2c3e50; text-align: center;">Convert Spell Slot to Sorcery Points</h3>
    <p style="text-align: center; color: #e74c3c; margin-bottom: 20px; font-weight: bold;">Current: ${sorceryPoints.current}/${sorceryPoints.max} SP</p>

    <div style="margin-bottom: 25px;">
      <label style="display: block; margin-bottom: 10px; font-weight: bold; color: #2c3e50;">Expend Spell Slot:</label>
      <select id="slot-to-points-level" style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid #bdc3c7; border-radius: 6px; box-sizing: border-box; background: white;">
  `;

  availableSlots.forEach(slot => {
    optionsHTML += `<option value="${slot.level}">Level ${slot.level} - Gain ${slot.level} SP (${slot.current}/${slot.max} slots)</option>`;
  });

  optionsHTML += `
      </select>
    </div>

    <div style="display: flex; gap: 10px;">
      <button id="slot-cancel" style="flex: 1; padding: 12px; font-size: 1em; background: #95a5a6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
        Cancel
      </button>
      <button id="slot-confirm" style="flex: 1; padding: 12px; font-size: 1em; background: #9b59b6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
        Convert
      </button>
    </div>
  `;

  modalContent.innerHTML = optionsHTML;
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  const selectElement = document.getElementById('slot-to-points-level');
  const confirmBtn = document.getElementById('slot-confirm');
  const cancelBtn = document.getElementById('slot-cancel');

  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  confirmBtn.addEventListener('click', () => {
    const selectedLevel = parseInt(selectElement.value);
    const slotVar = `level${selectedLevel}SpellSlots`;
    const currentSlots = characterData.spellSlots?.[slotVar] || 0;

    if (currentSlots <= 0) {
      showNotification(`❌ No Level ${selectedLevel} spell slots available!`, 'error');
      return;
    }

    // Remove spell slot
    characterData.spellSlots[slotVar] -= 1;

    // Gain sorcery points equal to slot level
    const pointsGained = selectedLevel;
    sorceryPoints.current = Math.min(sorceryPoints.current + pointsGained, sorceryPoints.max);

    saveCharacterData();

    const maxSlotVar = `level${selectedLevel}SpellSlotsMax`;
    const newSlotCount = characterData.spellSlots[slotVar];
    const maxSlots = characterData.spellSlots[maxSlotVar];
    showNotification(`✨ Gained ${pointsGained} Sorcery Points! (${sorceryPoints.current}/${sorceryPoints.max} SP, ${newSlotCount}/${maxSlots} slots)`);

    // Announce to Roll20
    const colorBanner = getColoredBanner();
    const message = `&{template:default} {{name=${colorBanner}${characterData.name} uses Font of Magic⚡}} {{Action=Convert Spell Slot to Sorcery Points}} {{Result=Expended Level ${selectedLevel} spell slot for ${pointsGained} SP}} {{Sorcery Points=${sorceryPoints.current}/${sorceryPoints.max}}}`;

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({
        action: 'roll',
        characterName: characterData.name,
        message: message,
        color: characterData.notificationColor
      }, '*');
    }

    document.body.removeChild(modal);
    buildSheet(characterData); // Refresh display
  });
}

function showFontOfMagicModal() {
  const sorceryPoints = getSorceryPointsResource();

  if (!sorceryPoints) {
    showNotification('❌ No Sorcery Points resource found', 'error');
    return;
  }

  // Font of Magic spell slot creation costs (D&D 5e rules)
  const slotCosts = {
    1: 2,
    2: 3,
    3: 5,
    4: 6,
    5: 7
  };

  // Create modal
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px; width: 90%;';

  let optionsHTML = `
    <h3 style="margin: 0 0 15px 0; color: #2c3e50; text-align: center;">Convert Sorcery Points to Spell Slot</h3>
    <p style="text-align: center; color: #e74c3c; margin-bottom: 20px; font-weight: bold;">Current: ${sorceryPoints.current}/${sorceryPoints.max} SP</p>

    <div style="margin-bottom: 25px;">
      <label style="display: block; margin-bottom: 10px; font-weight: bold; color: #2c3e50;">Create Spell Slot Level:</label>
      <select id="font-of-magic-slot" style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid #bdc3c7; border-radius: 6px; box-sizing: border-box; background: white;">
  `;

  // Add options for each spell slot level
  for (let level = 1; level <= 5; level++) {
    const cost = slotCosts[level];
    const canAfford = sorceryPoints.current >= cost;
    const slotVar = `level${level}SpellSlots`;
    const maxSlotVar = `level${level}SpellSlotsMax`;
    const currentSlots = characterData.spellSlots?.[slotVar] || 0;
    const maxSlots = characterData.spellSlots?.[maxSlotVar] || 0;

    const disabledAttr = canAfford ? '' : 'disabled';
    const affordText = canAfford ? '' : ' (not enough SP)';

    optionsHTML += `<option value="${level}" ${disabledAttr}>Level ${level} - ${cost} SP${affordText} (${currentSlots}/${maxSlots} slots)</option>`;
  }

  optionsHTML += `
      </select>
    </div>

    <div style="display: flex; gap: 10px;">
      <button id="font-cancel" style="flex: 1; padding: 12px; font-size: 1em; background: #95a5a6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
        Cancel
      </button>
      <button id="font-confirm" style="flex: 1; padding: 12px; font-size: 1em; background: #e74c3c; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
        Convert
      </button>
    </div>
  `;

  modalContent.innerHTML = optionsHTML;
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  const selectElement = document.getElementById('font-of-magic-slot');
  const confirmBtn = document.getElementById('font-confirm');
  const cancelBtn = document.getElementById('font-cancel');

  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  confirmBtn.addEventListener('click', () => {
    const selectedLevel = parseInt(selectElement.value);
    const cost = slotCosts[selectedLevel];

    if (sorceryPoints.current < cost) {
      showNotification(`❌ Not enough Sorcery Points! Need ${cost}, have ${sorceryPoints.current}`, 'error');
      return;
    }

    // Deduct sorcery points
    sorceryPoints.current -= cost;

    // Add spell slot
    const slotVar = `level${selectedLevel}SpellSlots`;
    const maxSlotVar = `level${selectedLevel}SpellSlotsMax`;
    const maxSlots = characterData.spellSlots?.[maxSlotVar] || 0;

    characterData.spellSlots[slotVar] = Math.min((characterData.spellSlots[slotVar] || 0) + 1, maxSlots);

    saveCharacterData();

    const currentSlots = characterData.spellSlots[slotVar];
    showNotification(`✨ Created Level ${selectedLevel} spell slot! (${sorceryPoints.current}/${sorceryPoints.max} SP left, ${currentSlots}/${maxSlots} slots)`);

    // Announce to Roll20
    const colorBanner = getColoredBanner();
    const message = `&{template:default} {{name=${colorBanner}${characterData.name} uses Font of Magic⚡}} {{Action=Convert Sorcery Points to Spell Slot}} {{Result=Created Level ${selectedLevel} spell slot for ${cost} SP}} {{Sorcery Points=${sorceryPoints.current}/${sorceryPoints.max}}}`;

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({
        action: 'roll',
        characterName: characterData.name,
        message: message,
        color: characterData.notificationColor
      }, '*');
    }

    document.body.removeChild(modal);
    buildSheet(characterData); // Refresh display
  });
}

function announceAction(action) {
  // Announce the use of an action (bonus action, reaction, etc.) to Roll20 chat
  const colorBanner = getColoredBanner();

  // Determine action type emoji
  const actionTypeEmoji = {
    'bonus': '⚡',
    'reaction': '🛡️',
    'action': '⚔️',
    'free': '💨',
    'legendary': '👑',
    'lair': '🏰',
    'other': '✨'
  };

  const emoji = actionTypeEmoji[action.actionType?.toLowerCase()] || '✨';
  const actionTypeText = action.actionType ? ` (${action.actionType})` : '';

  let message = `&{template:default} {{name=${colorBanner}${characterData.name} uses ${action.name}${emoji}}} {{Action Type=${action.actionType || 'Other'}}}`;

  // Add description (resolve variables first)
  if (action.description) {
    const resolvedDescription = resolveVariablesInFormula(action.description);
    message += ` {{Description=${resolvedDescription}}}`;
  }

  // Add uses if available
  if (action.uses) {
    const usesUsed = action.usesUsed || 0;
    const usesTotal = action.uses.total || action.uses.value || action.uses;
    const usesRemaining = usesTotal - usesUsed;
    const usesText = `${usesRemaining} / ${usesTotal}`;
    message += ` {{Uses=${usesText}}}`;
  }

  // Send to Roll20 chat
  const messageData = {
    action: 'announceSpell',
    message: message,
    color: characterData.notificationColor
  };

  // Try window.opener first (Chrome)
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(messageData, '*');
      showNotification(`✨ ${action.name} used!`);
      debug.log('✅ Action announcement sent via window.opener');
      return;
    } catch (error) {
      debug.warn('⚠️ Could not send via window.opener:', error.message);
    }
  }

  // Fallback: Use background script to relay to Roll20 (Firefox)
  debug.log('📡 Using background script to relay action announcement to Roll20...');
  browserAPI.runtime.sendMessage({
    action: 'relayRollToRoll20',
    roll: messageData
  }, (response) => {
    if (browserAPI.runtime.lastError) {
      debug.error('❌ Error relaying action announcement:', browserAPI.runtime.lastError);
      showNotification('❌ Failed to announce action');
    } else if (response && response.success) {
      debug.log('✅ Action announcement relayed to Roll20');
      showNotification(`✨ ${action.name} used!`);
    }
  });
}

function createColorPalette(selectedColor) {
  const colors = [
    { name: 'Blue', value: '#3498db', emoji: '🔵' },
    { name: 'Red', value: '#e74c3c', emoji: '🔴' },
    { name: 'Green', value: '#27ae60', emoji: '🟢' },
    { name: 'Purple', value: '#9b59b6', emoji: '🟣' },
    { name: 'Orange', value: '#e67e22', emoji: '🟠' },
    { name: 'Teal', value: '#1abc9c', emoji: '🔷' },
    { name: 'Pink', value: '#e91e63', emoji: '🩷' },
    { name: 'Yellow', value: '#f1c40f', emoji: '🟡' },
    { name: 'Grey', value: '#95a5a6', emoji: '⚪' },
    { name: 'Black', value: '#34495e', emoji: '⚫' },
    { name: 'Brown', value: '#8b4513', emoji: '🟤' }
  ];

  return colors.map(color => {
    const isSelected = color.value === selectedColor;
    return `
      <div class="color-swatch"
           data-color="${color.value}"
           style="font-size: 1.5em; cursor: pointer; transition: all 0.2s; opacity: ${isSelected ? '1' : '0.85'}; transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'}; filter: ${isSelected ? 'drop-shadow(0 0 4px white)' : 'none'}; text-align: center;"
           title="${color.name}">${color.emoji}</div>
    `;
  }).join('');
}

function initColorPalette() {
  // Set default color if not set
  if (!characterData.notificationColor) {
    characterData.notificationColor = '#3498db';
  }

  const toggleBtn = document.getElementById('color-toggle');
  const palette = document.getElementById('color-palette');

  if (!toggleBtn || !palette) return;

  // Toggle palette visibility
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = palette.style.display === 'grid';
    palette.style.display = isVisible ? 'none' : 'grid';
  });

  // Close palette when clicking outside
  document.addEventListener('click', (e) => {
    if (!palette.contains(e.target) && e.target !== toggleBtn) {
      palette.style.display = 'none';
    }
  });

  // Add click handlers to color swatches
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      const newColor = e.target.dataset.color;
      const oldColor = characterData.notificationColor;
      characterData.notificationColor = newColor;

      // Update all swatches appearance
      document.querySelectorAll('.color-swatch').forEach(s => {
        const isSelected = s.dataset.color === newColor;
        s.style.opacity = isSelected ? '1' : '0.6';
        s.style.transform = isSelected ? 'scale(1.2)' : 'scale(1)';
        s.style.filter = isSelected ? 'drop-shadow(0 0 4px white)' : 'none';
      });

      // Update the toggle button emoji
      const newEmoji = getColorEmoji(newColor);
      const colorEmojiEl = document.getElementById('color-emoji');
      if (colorEmojiEl) {
        colorEmojiEl.textContent = newEmoji;
      }

      // Close the palette
      palette.style.display = 'none';

      // Save to storage
      saveCharacterData();
      showNotification(`🎨 Notification color changed to ${e.target.title}!`);
    });
  });
}

function saveCharacterData() {
  // Send updated data to background script for storage
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      action: 'updateCharacterData',
      data: characterData
    }, '*');
    debug.log('💾 Sent character data update to parent window');
  }
}

function resolveVariablesInFormula(formula) {
  if (!formula || typeof formula !== 'string') {
    return formula;
  }

  debug.log(`🔧 resolveVariablesInFormula called with: "${formula}"`);

  // Check if characterData has otherVariables
  if (!characterData.otherVariables || typeof characterData.otherVariables !== 'object') {
    debug.log('⚠️ No otherVariables available for formula resolution');
    return formula;
  }

  let resolvedFormula = formula;
  let variablesResolved = [];

  // Pattern 0: Check if the entire formula is just a bare variable name (e.g., "breathWeaponDamage")
  // This must be checked BEFORE other patterns to handle cases like action.damage = "breathWeaponDamage"
  const bareVariablePattern = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
  if (bareVariablePattern.test(formula.trim())) {
    const varName = formula.trim();
    if (characterData.otherVariables.hasOwnProperty(varName)) {
      const variableValue = characterData.otherVariables[varName];

      // Extract the value
      let value = null;
      if (typeof variableValue === 'number') {
        value = variableValue;
      } else if (typeof variableValue === 'string') {
        value = variableValue;
      } else if (typeof variableValue === 'object' && variableValue.value !== undefined) {
        value = variableValue.value;
      }

      if (value !== null && value !== undefined) {
        debug.log(`✅ Resolved bare variable: ${varName} = ${value}`);
        return String(value);
      }
    }
    debug.log(`⚠️ Bare variable not found in otherVariables: ${varName}`);
  }

  // Helper function to get variable value (handles dot notation like "bard.level")
  const getVariableValue = (varPath) => {
    // Strip # prefix if present (DiceCloud reference notation)
    const cleanPath = varPath.startsWith('#') ? varPath.substring(1) : varPath;

    // Try direct lookup first
    if (characterData.otherVariables.hasOwnProperty(cleanPath)) {
      const val = characterData.otherVariables[cleanPath];
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'object' && val.value !== undefined) return val.value;
      if (typeof val === 'string') return val;
    }

    // Try converting dot notation (e.g., "bard.level" -> "bardLevel")
    const camelCase = cleanPath.replace(/\.([a-z])/g, (_, letter) => letter.toUpperCase());
    if (characterData.otherVariables.hasOwnProperty(camelCase)) {
      const val = characterData.otherVariables[camelCase];
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'object' && val.value !== undefined) return val.value;
    }

    // Try other common patterns
    const alternatives = [
      cleanPath.replace(/\./g, ''), // Remove dots
      cleanPath.split('.').pop(), // Just the last part
      cleanPath.replace(/\./g, '_') // Underscores instead
    ];

    for (const alt of alternatives) {
      if (characterData.otherVariables.hasOwnProperty(alt)) {
        const val = characterData.otherVariables[alt];
        if (typeof val === 'number') return val;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'object' && val.value !== undefined) return val.value;
      }
    }

    return null;
  };

  // Pattern 1: Find variables in parentheses like (variableName)
  const parenthesesPattern = /\(([a-zA-Z_][a-zA-Z0-9_]*)\)/g;
  let match;

  while ((match = parenthesesPattern.exec(formula)) !== null) {
    const variableName = match[1];
    const fullMatch = match[0]; // e.g., "(sneakAttackDieAmount)"

    // Look up the variable value
    if (characterData.otherVariables.hasOwnProperty(variableName)) {
      const variableValue = characterData.otherVariables[variableName];

      // Extract numeric value
      let numericValue = null;
      if (typeof variableValue === 'number') {
        numericValue = variableValue;
      } else if (typeof variableValue === 'object' && variableValue.value !== undefined) {
        numericValue = variableValue.value;
      }

      if (numericValue !== null) {
        resolvedFormula = resolvedFormula.replace(fullMatch, numericValue);
        variablesResolved.push(`${variableName}=${numericValue}`);
        debug.log(`✅ Resolved variable: ${variableName} = ${numericValue}`);
      } else {
        debug.log(`⚠️ Could not extract numeric value from variable: ${variableName}`, variableValue);
      }
    } else {
      debug.log(`⚠️ Variable not found in otherVariables: ${variableName}`);
    }
  }

  // Pattern 2: Handle math functions like ceil{expression}, floor{expression}, etc.
  const mathFuncPattern = /(ceil|floor|round|abs)\{([^}]+)\}/gi;

  while ((match = mathFuncPattern.exec(resolvedFormula)) !== null) {
    const funcName = match[1].toLowerCase();
    const expression = match[2];
    const fullMatch = match[0]; // e.g., "ceil{proficiencyBonus/2}"

    // Replace variables in the expression
    let evalExpression = expression;
    for (const varName in characterData.otherVariables) {
      if (evalExpression.includes(varName)) {
        const variableValue = characterData.otherVariables[varName];
        let value = null;

        if (typeof variableValue === 'number') {
          value = variableValue;
        } else if (typeof variableValue === 'object' && variableValue.value !== undefined) {
          value = variableValue.value;
        }

        if (value !== null && typeof value === 'number') {
          evalExpression = evalExpression.replace(new RegExp(varName, 'g'), value);
        }
      }
    }

    // Evaluate the expression with the appropriate math function
    try {
      if (/^[\d\s+\-*/().]+$/.test(evalExpression)) {
        const evalResult = eval(evalExpression);
        let result;

        switch (funcName) {
          case 'ceil':
            result = Math.ceil(evalResult);
            break;
          case 'floor':
            result = Math.floor(evalResult);
            break;
          case 'round':
            result = Math.round(evalResult);
            break;
          case 'abs':
            result = Math.abs(evalResult);
            break;
          default:
            result = evalResult;
        }

        resolvedFormula = resolvedFormula.replace(fullMatch, result);
        variablesResolved.push(`${funcName}{${expression}}=${result}`);
        debug.log(`✅ Resolved math function: ${funcName}{${expression}} = ${result}`);
      }
    } catch (e) {
      debug.log(`⚠️ Failed to evaluate ${funcName}{${expression}}`, e);
    }
  }

  // Pattern 2.5: Handle max/min functions outside of curly braces (e.g., "1d6+max(strengthModifier, dexterityModifier)")
  // Helper function to find matching closing parenthesis
  function findMatchingParen(str, startIndex) {
    let depth = 1;
    for (let i = startIndex; i < str.length; i++) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  // Helper function to split arguments respecting nested parentheses
  function splitArgs(argsString) {
    const args = [];
    let currentArg = '';
    let depth = 0;

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];
      if (char === '(') {
        depth++;
        currentArg += char;
      } else if (char === ')') {
        depth--;
        currentArg += char;
      } else if (char === ',' && depth === 0) {
        args.push(currentArg.trim());
        currentArg = '';
      } else {
        currentArg += char;
      }
    }

    if (currentArg) {
      args.push(currentArg.trim());
    }

    return args;
  }

  debug.log(`🔍 Looking for max/min in formula: "${resolvedFormula}"`);

  const maxMinPattern = /(max|min)\(/gi;

  while ((match = maxMinPattern.exec(resolvedFormula)) !== null) {
    const func = match[1].toLowerCase();
    const funcStart = match.index;
    const argsStart = funcStart + match[0].length;

    // Find the matching closing parenthesis
    const closingParen = findMatchingParen(resolvedFormula, argsStart);
    if (closingParen === -1) {
      debug.log(`⚠️ No matching closing parenthesis for ${func} at position ${funcStart}`);
      continue;
    }

    const argsString = resolvedFormula.substring(argsStart, closingParen);
    const fullMatch = resolvedFormula.substring(funcStart, closingParen + 1);
    debug.log(`🔍 Found max/min match: ${func}(${argsString})`)

    try {
      const args = splitArgs(argsString).map(arg => {
        const trimmed = arg;
        debug.log(`🔍 Resolving arg: "${trimmed}"`);

        // Try to parse as number first
        const num = parseFloat(trimmed);
        if (!isNaN(num)) {
          debug.log(`  ✅ Parsed as number: ${num}`);
          return num;
        }

        // Try to resolve as simple variable
        const varVal = getVariableValue(trimmed);
        debug.log(`  🔍 Variable lookup result: ${varVal}`);
        if (varVal !== null && typeof varVal === 'number') {
          debug.log(`  ✅ Resolved as variable: ${varVal}`);
          return varVal;
        }

        // Try to evaluate as expression (e.g., "strength.modifier")
        let evalExpression = trimmed;
        const varPattern = /[a-zA-Z_][a-zA-Z0-9_.]*/g;
        let varMatch;
        const replacements = [];

        while ((varMatch = varPattern.exec(trimmed)) !== null) {
          const varName = varMatch[0];
          const value = getVariableValue(varName);
          if (value !== null && typeof value === 'number') {
            replacements.push({ name: varName, value: value });
          }
        }

        // Sort by length (longest first) to avoid partial replacements
        replacements.sort((a, b) => b.name.length - a.name.length);

        for (const {name, value} of replacements) {
          evalExpression = evalExpression.replace(new RegExp(name.replace(/\./g, '\\.'), 'g'), value);
        }

        // Handle math functions (ceil, floor, round, abs) in the expression
        evalExpression = evalExpression.replace(/ceil\(/g, 'Math.ceil(');
        evalExpression = evalExpression.replace(/floor\(/g, 'Math.floor(');
        evalExpression = evalExpression.replace(/round\(/g, 'Math.round(');
        evalExpression = evalExpression.replace(/abs\(/g, 'Math.abs(');

        // Try to evaluate
        try {
          if (/^[\d\s+\-*/().Math]+$/.test(evalExpression)) {
            const result = eval(evalExpression);
            debug.log(`  ✅ Evaluated expression "${trimmed}" = ${result}`);
            return result;
          }
        } catch (e) {
          debug.log(`  ❌ Failed to evaluate: "${trimmed}"`, e);
        }

        debug.log(`  ❌ Could not resolve: "${trimmed}"`);
        return null;
      }).filter(v => v !== null);

      if (args.length > 0) {
        const result = func === 'max' ? Math.max(...args) : Math.min(...args);
        resolvedFormula = resolvedFormula.replace(fullMatch, result);
        variablesResolved.push(`${func}(...)=${result}`);
        debug.log(`✅ Resolved ${func} function: ${fullMatch} = ${result}`);
        // Reset regex lastIndex since we modified the string
        maxMinPattern.lastIndex = 0;
      }
    } catch (e) {
      debug.log(`⚠️ Failed to resolve ${func} function: ${fullMatch}`, e);
    }
  }

  // Pattern 2.5: Handle ternary conditionals in parentheses for dice formulas like (condition?value1:value2)d6
  const parenTernaryPattern = /\(([^)]+\?[^)]+:[^)]+)\)/g;

  while ((match = parenTernaryPattern.exec(resolvedFormula)) !== null) {
    const expression = match[1];
    const fullMatch = match[0];

    // Check if this is a ternary conditional
    if (expression.includes('?') && expression.includes(':')) {
      const ternaryParts = expression.match(/^(.+?)\s*\?\s*(.+?)\s*:\s*(.+?)$/);
      if (ternaryParts) {
        const condition = ternaryParts[1].trim();
        const trueValue = ternaryParts[2].trim();
        const falseValue = ternaryParts[3].trim();

        // Evaluate the condition
        let conditionResult = false;
        const varValue = getVariableValue(condition);
        if (varValue !== null) {
          conditionResult = Boolean(varValue);
          debug.log(`✅ Evaluated parentheses ternary condition: ${condition} = ${conditionResult}`);
        }

        // Choose the appropriate value
        const chosenValue = conditionResult ? trueValue : falseValue;

        // Replace the entire match with the chosen value
        resolvedFormula = resolvedFormula.replace(fullMatch, chosenValue);
        variablesResolved.push(`(${condition}?${trueValue}:${falseValue}) = ${chosenValue}`);
        debug.log(`✅ Resolved parentheses ternary: (${expression}) => ${chosenValue}`);

        // Reset regex lastIndex since we modified the string
        parenTernaryPattern.lastIndex = 0;
      }
    }
  }

  // Pattern 3: Find variables/expressions in curly braces like {variableName} or {3*cleric.level}
  const bracesPattern = /\{([^}]+)\}/g;

  while ((match = bracesPattern.exec(resolvedFormula)) !== null) {
    const expression = match[1];
    const fullMatch = match[0];

    // Strip markdown formatting
    let cleanExpr = expression.replace(/\*\*/g, '');

    // Handle ternary operators: {condition ? trueValue : falseValue}
    // First try complex ternary with concatenation and functions: level >= 5 ? "+ " + floor((level+1)/6) + "d8" : ""
    const complexTernaryPattern = /^(.+?)\s*\?\s*(.+?)\s*:\s*(.+?)$/;
    const complexTernaryMatch = cleanExpr.match(complexTernaryPattern);
    if (complexTernaryMatch && cleanExpr.includes('?') && cleanExpr.includes(':')) {
      const condition = complexTernaryMatch[1].trim();
      const trueBranch = complexTernaryMatch[2].trim();
      const falseBranch = complexTernaryMatch[3].trim();

      // Evaluate the condition
      let conditionResult = false;
      try {
        // Check if condition is just a simple variable name
        const simpleVarPattern = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
        if (simpleVarPattern.test(condition.trim())) {
          const varValue = getVariableValue(condition.trim());
          if (varValue !== null) {
            // Convert to boolean: numbers, strings, booleans
            conditionResult = Boolean(varValue);
          } else {
            // Variable doesn't exist, treat as false
            conditionResult = false;
          }
          debug.log(`✅ Evaluated simple variable condition: ${condition} = ${conditionResult}`);
        } else {
          // Complex condition with operators
          // Replace variables in condition
          let evalCondition = condition;
          const varPattern = /[a-zA-Z_][a-zA-Z0-9_.]*/g;
          let varMatch;
          const replacements = [];

          while ((varMatch = varPattern.exec(condition)) !== null) {
            const varName = varMatch[0];
            // Skip reserved words
            if (['true', 'false', 'null', 'undefined'].includes(varName.toLowerCase())) {
              continue;
            }
            const value = getVariableValue(varName);
            if (value !== null) {
              // Handle numbers, strings, and booleans
              if (typeof value === 'number') {
                replacements.push({ name: varName, value: value });
              } else if (typeof value === 'boolean') {
                replacements.push({ name: varName, value: value });
              } else if (typeof value === 'string') {
                // Convert string to boolean for condition evaluation
                const boolValue = value !== '' && value !== '0' && value.toLowerCase() !== 'false';
                replacements.push({ name: varName, value: boolValue });
              }
            } else {
              // Variable doesn't exist, replace with false
              replacements.push({ name: varName, value: false });
            }
          }

          // Sort by length (longest first) to avoid partial replacements
          replacements.sort((a, b) => b.name.length - a.name.length);

          for (const {name, value} of replacements) {
            evalCondition = evalCondition.replace(new RegExp(name.replace(/\./g, '\\.'), 'g'), value);
          }

          // Evaluate condition
          if (/^[\w\s+\-*/><=!&|()\.]+$/.test(evalCondition)) {
            conditionResult = eval(evalCondition);
          }
        }
      } catch (e) {
        debug.log(`⚠️ Failed to evaluate ternary condition: ${condition}`, e);
      }

      // Evaluate the chosen branch
      const chosenBranch = conditionResult ? trueBranch : falseBranch;
      let result = '';

      try {
        // Handle string concatenation with + operator
        // Pattern: "string" + expression + "string"
        if (chosenBranch.includes('+')) {
          const parts = [];
          let current = '';
          let inString = false;
          let i = 0;

          while (i < chosenBranch.length) {
            const char = chosenBranch[i];

            if (char === '"') {
              if (inString) {
                // End of string
                parts.push({ type: 'string', value: current });
                current = '';
                inString = false;
              } else {
                // Start of string
                inString = true;
              }
              i++;
            } else if (char === '+' && !inString) {
              // Operator outside string
              if (current.trim()) {
                parts.push({ type: 'expr', value: current.trim() });
                current = '';
              }
              i++;
            } else {
              current += char;
              i++;
            }
          }

          // Add remaining part
          if (current.trim()) {
            if (inString) {
              parts.push({ type: 'string', value: current });
            } else {
              parts.push({ type: 'expr', value: current.trim() });
            }
          }

          // Evaluate each part and concatenate
          for (const part of parts) {
            if (part.type === 'string') {
              result += part.value;
            } else {
              // Evaluate expression (may contain floor(), variables, etc.)
              let exprResult = part.value;

              // Handle floor() function
              const floorMatch = exprResult.match(/floor\(([^)]+)\)/);
              if (floorMatch) {
                const floorExpr = floorMatch[1];
                // Resolve variables in floor expression
                let evalExpr = floorExpr;
                const varPattern = /[a-zA-Z_][a-zA-Z0-9_.]*/g;
                let varMatch;
                const replacements = [];

                while ((varMatch = varPattern.exec(floorExpr)) !== null) {
                  const varName = varMatch[0];
                  const value = getVariableValue(varName);
                  if (value !== null && typeof value === 'number') {
                    replacements.push({ name: varName, value: value });
                  }
                }

                replacements.sort((a, b) => b.name.length - a.name.length);
                for (const {name, value} of replacements) {
                  evalExpr = evalExpr.replace(new RegExp(name.replace(/\./g, '\\.'), 'g'), value);
                }

                if (/^[\d\s+\-*/().]+$/.test(evalExpr)) {
                  const floorResult = Math.floor(eval(evalExpr));
                  exprResult = exprResult.replace(floorMatch[0], floorResult);
                }
              }

              // Try to resolve as variable or evaluate
              const varValue = getVariableValue(exprResult);
              if (varValue !== null) {
                result += varValue;
              } else if (/^[\d\s+\-*/().]+$/.test(exprResult)) {
                result += eval(exprResult);
              } else {
                result += exprResult;
              }
            }
          }
        } else if (chosenBranch.startsWith('"') && chosenBranch.endsWith('"')) {
          // Simple quoted string
          result = chosenBranch.slice(1, -1);
        } else {
          // Try to evaluate as expression
          result = chosenBranch;
        }

        resolvedFormula = resolvedFormula.replace(fullMatch, result);
        variablesResolved.push(`${condition} ? ... : ... = "${result}"`);
        debug.log(`✅ Resolved complex ternary: ${condition} (${conditionResult}) => "${result}"`);
        continue;
      } catch (e) {
        debug.log(`⚠️ Failed to resolve ternary expression: ${cleanExpr}`, e);
      }
    }

    // Try as simple variable first
    let simpleValue = getVariableValue(cleanExpr);
    if (simpleValue !== null) {
      resolvedFormula = resolvedFormula.replace(fullMatch, simpleValue);
      variablesResolved.push(`${cleanExpr}=${simpleValue}`);
      debug.log(`✅ Resolved variable: ${cleanExpr} = ${simpleValue}`);
      continue;
    }

    // Handle array indexing: [array][index]
    const arrayPattern = /^\[([^\]]+)\]\[([^\]]+)\]$/;
    const arrayMatch = cleanExpr.match(arrayPattern);
    if (arrayMatch) {
      try {
        const arrayPart = arrayMatch[1];
        const indexPart = arrayMatch[2];

        // Parse array (handle both numbers and string values like "N/A")
        const arrayValues = arrayPart.split(',').map(v => {
          const trimmed = v.trim();
          // Remove quotes if present
          const unquoted = trimmed.replace(/^["']|["']$/g, '');
          // Try to parse as number, otherwise keep as string
          const num = parseFloat(unquoted);
          return isNaN(num) ? unquoted : num;
        });

        // Resolve index variable
        let indexValue = getVariableValue(indexPart);

        if (indexValue !== null && !isNaN(indexValue)) {
          // Try direct index first
          let result = arrayValues[indexValue];

          // If out of bounds and index > 0, try index-1 (for 1-based level arrays)
          if (result === undefined && indexValue > 0) {
            result = arrayValues[indexValue - 1];
            if (result !== undefined) {
              debug.log(`📊 Array index ${indexValue} out of bounds, using ${indexValue - 1} instead`);
              indexValue = indexValue - 1;
            }
          }

          if (result !== undefined) {
            resolvedFormula = resolvedFormula.replace(fullMatch, result);
            variablesResolved.push(`array[${indexValue}]=${result}`);
            debug.log(`✅ Resolved array indexing: ${cleanExpr} = ${result}`);
            continue;
          } else {
            debug.log(`⚠️ Array index ${indexValue} out of bounds (array length: ${arrayValues.length})`);
          }
        } else {
          debug.log(`⚠️ Could not resolve index variable: ${indexPart}`);
        }
      } catch (e) {
        debug.log(`⚠️ Failed to resolve array indexing: ${cleanExpr}`, e);
      }
    }

    // Handle max/min functions (can be standalone or part of larger expression)
    const maxMinPattern = /^(max|min)\(([^)]+)\)$/i;
    const maxMinMatch = cleanExpr.match(maxMinPattern);
    if (maxMinMatch) {
      try {
        const func = maxMinMatch[1].toLowerCase();
        const args = maxMinMatch[2].split(',').map(arg => {
          const trimmed = arg.trim();
          // Try to parse as number first
          const num = parseFloat(trimmed);
          if (!isNaN(num)) return num;

          // Try to resolve as variable
          const varVal = getVariableValue(trimmed);
          if (varVal !== null) return varVal;

          return null;
        }).filter(v => v !== null);

        if (args.length > 0) {
          const result = func === 'max' ? Math.max(...args) : Math.min(...args);
          resolvedFormula = resolvedFormula.replace(fullMatch, result);
          variablesResolved.push(`${func}(...)=${result}`);
          debug.log(`✅ Resolved ${func} function: ${cleanExpr} = ${result}`);
          continue;
        }
      } catch (e) {
        debug.log(`⚠️ Failed to resolve ${cleanExpr}`, e);
      }
    }

    // Handle ceil/floor/round/abs functions with parentheses: ceil(expr), floor(expr), etc.
    const mathFuncParenPattern = /^(ceil|floor|round|abs)\(([^)]+)\)$/i;
    const mathFuncParenMatch = cleanExpr.match(mathFuncParenPattern);
    if (mathFuncParenMatch) {
      try {
        const funcName = mathFuncParenMatch[1].toLowerCase();
        const expression = mathFuncParenMatch[2];

        // Replace variables in the expression
        let evalExpression = expression;
        const varPattern = /[a-zA-Z_][a-zA-Z0-9_.]*/g;
        let varMatch;
        const replacements = [];

        while ((varMatch = varPattern.exec(expression)) !== null) {
          const varName = varMatch[0];
          const value = getVariableValue(varName);
          if (value !== null && typeof value === 'number') {
            replacements.push({ name: varName, value: value });
          }
        }

        // Sort by length (longest first) to avoid partial replacements
        replacements.sort((a, b) => b.name.length - a.name.length);

        for (const {name, value} of replacements) {
          evalExpression = evalExpression.replace(new RegExp(name.replace(/\./g, '\\.'), 'g'), value);
        }

        // Evaluate the expression
        if (/^[\d\s+\-*/().]+$/.test(evalExpression)) {
          const evalResult = eval(evalExpression);
          let result;

          switch (funcName) {
            case 'ceil':
              result = Math.ceil(evalResult);
              break;
            case 'floor':
              result = Math.floor(evalResult);
              break;
            case 'round':
              result = Math.round(evalResult);
              break;
            case 'abs':
              result = Math.abs(evalResult);
              break;
            default:
              result = evalResult;
          }

          resolvedFormula = resolvedFormula.replace(fullMatch, result);
          variablesResolved.push(`${funcName}(${expression})=${result}`);
          debug.log(`✅ Resolved math function: ${funcName}(${expression}) = ${result}`);
          continue;
        }
      } catch (e) {
        debug.log(`⚠️ Failed to resolve ${cleanExpr}`, e);
      }
    }

    // Try to evaluate as math expression
    let evalExpression = cleanExpr;

    // Replace all variable names with their values (sorted by length to avoid partial matches)
    const varPattern = /[a-zA-Z_][a-zA-Z0-9_.]*/g;
    let varMatch;
    const replacements = [];

    while ((varMatch = varPattern.exec(cleanExpr)) !== null) {
      const varName = varMatch[0];
      const value = getVariableValue(varName);
      if (value !== null && typeof value === 'number') {
        replacements.push({ name: varName, value: value });
      }
    }

    // Sort by length (longest first) to avoid partial replacements
    replacements.sort((a, b) => b.name.length - a.name.length);

    for (const {name, value} of replacements) {
      evalExpression = evalExpression.replace(new RegExp(name.replace(/\./g, '\\.'), 'g'), value);
    }

    // Try to evaluate the expression
    try {
      if (/^[\d\s+\-*/().]+$/.test(evalExpression)) {
        const result = eval(evalExpression);
        resolvedFormula = resolvedFormula.replace(fullMatch, Math.floor(result));
        variablesResolved.push(`${cleanExpr}=${Math.floor(result)}`);
        debug.log(`✅ Resolved expression: ${cleanExpr} = ${Math.floor(result)}`);
      } else {
        debug.log(`⚠️ Could not resolve expression: ${cleanExpr} (eval: ${evalExpression})`);
      }
    } catch (e) {
      debug.log(`⚠️ Failed to evaluate expression: ${cleanExpr}`, e);
    }
  }

  if (variablesResolved.length > 0) {
    debug.log(`🔧 Formula resolution: "${formula}" -> "${resolvedFormula}" (${variablesResolved.join(', ')})`);
  }

  // Strip remaining markdown formatting
  resolvedFormula = resolvedFormula.replace(/\*\*/g, ''); // Remove bold markers

  return resolvedFormula;
}

function roll(name, formula, prerolledResult = null) {
  debug.log('🎲 Rolling:', name, formula, prerolledResult ? `(prerolled: ${prerolledResult})` : '');

  // Resolve any variables in the formula
  const resolvedFormula = resolveVariablesInFormula(formula);

  const colorBanner = getColoredBanner();
  // Format: "🔵 CharacterName rolls Initiative"
  const rollName = `${colorBanner}${characterData.name} rolls ${name}`;

  // If we have a prerolled result (e.g., from death saves), include it
  const messageData = {
    action: 'rollFromPopout',
    name: rollName,
    formula: resolvedFormula,
    color: characterData.notificationColor,
    characterName: characterData.name
  };

  if (prerolledResult !== null) {
    messageData.prerolledResult = prerolledResult;
  }

  // Try window.opener first (Chrome)
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(messageData, '*');
      showNotification(`🎲 Rolling ${name}...`);
      debug.log('✅ Roll sent via window.opener');
      return;
    } catch (error) {
      debug.warn('⚠️ Could not send via window.opener:', error.message);
    }
  }

  // Fallback: Use background script to relay to Roll20 (Firefox)
  debug.log('📡 Using background script to relay roll to Roll20...');
  browserAPI.runtime.sendMessage({
    action: 'relayRollToRoll20',
    roll: messageData
  }, (response) => {
    if (browserAPI.runtime.lastError) {
      debug.error('❌ Error relaying roll:', browserAPI.runtime.lastError);
      showNotification('Failed to send roll. Please try from Roll20 page.', 'error');
    } else if (response && response.success) {
      debug.log('✅ Roll relayed to Roll20 via background script');
      showNotification(`🎲 Rolling ${name}...`);
    } else {
      debug.error('❌ Failed to relay roll:', response?.error);
      showNotification('Failed to send roll. Make sure Roll20 tab is open.', 'error');
    }
  });
}

function showNotification(message) {
  const notif = document.createElement('div');
  notif.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #27AE60; color: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000;';
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 2000);
}

function takeShortRest() {
  if (!characterData) {
    showNotification('❌ Character data not available', 'error');
    return;
  }

  const confirmed = confirm('Take a Short Rest?\n\nThis will:\n- Allow you to spend Hit Dice to restore HP\n- Restore Warlock spell slots\n- Restore some class features');

  if (!confirmed) return;

  debug.log('☕ Taking short rest...');

  // Clear temporary HP (RAW: temp HP doesn't persist through rest)
  if (characterData.temporaryHP > 0) {
    characterData.temporaryHP = 0;
    debug.log('✅ Cleared temporary HP');
  }

  // Note: Inspiration is NOT restored on short rest (DM grants it)
  debug.log(`ℹ️ Inspiration status unchanged (${characterData.inspiration ? 'active' : 'none'})`);

  // Restore Warlock Pact Magic slots (they recharge on short rest)
  if (characterData.otherVariables) {
    if (characterData.otherVariables.pactMagicSlotsMax !== undefined) {
      characterData.otherVariables.pactMagicSlots = characterData.otherVariables.pactMagicSlotsMax;
      debug.log('✅ Restored Pact Magic slots');
    }

    // Restore Ki points for Monk (short rest feature)
    if (characterData.otherVariables.kiMax !== undefined) {
      characterData.otherVariables.ki = characterData.otherVariables.kiMax;
      debug.log('✅ Restored Ki points');
    } else if (characterData.otherVariables.kiPointsMax !== undefined) {
      characterData.otherVariables.kiPoints = characterData.otherVariables.kiPointsMax;
      debug.log('✅ Restored Ki points');
    }

    // Restore Action Surge, Second Wind (short rest features)
    if (characterData.otherVariables.actionSurgeMax !== undefined) {
      characterData.otherVariables.actionSurge = characterData.otherVariables.actionSurgeMax;
    }
    if (characterData.otherVariables.secondWindMax !== undefined) {
      characterData.otherVariables.secondWind = characterData.otherVariables.secondWindMax;
    }
  }

  // Handle Hit Dice spending for HP restoration
  spendHitDice();

  // Restore class resources that recharge on short rest
  // Most resources restore on short rest (Ki, Channel Divinity, Action Surge, etc.)
  // Notable exceptions: Sorcery Points and Rage restore on long rest only
  if (characterData.resources && characterData.resources.length > 0) {
    characterData.resources.forEach(resource => {
      const lowerName = resource.name.toLowerCase();

      // Long rest only resources
      if (lowerName.includes('sorcery') || lowerName.includes('rage')) {
        debug.log(`⏭️ Skipping ${resource.name} (long rest only)`);
        return;
      }

      // Restore all other resources
      resource.current = resource.max;
      debug.log(`✅ Restored ${resource.name} (${resource.current}/${resource.max})`);
    });
  }

  // Reset limited uses for short rest abilities
  if (characterData.actions) {
    characterData.actions.forEach(action => {
      // Reset usesUsed for actions that recharge on short rest
      // Most limited use abilities in D&D 5e recharge on short rest
      if (action.uses && action.usesUsed > 0) {
        action.usesUsed = 0;
        debug.log(`✅ Reset uses for ${action.name}`);
      }
    });
  }

  saveCharacterData();
  buildSheet(characterData);

  showNotification('☕ Short Rest complete! Resources recharged.');
  debug.log('✅ Short rest complete');

  // Announce to Roll20 with fancy formatting
  const colorBanner = getColoredBanner();
  const messageData = {
    action: 'announceSpell',
    message: `&{template:default} {{name=${colorBanner}${characterData.name} takes a short rest}} {{=☕ Short rest complete. Resources recharged!}}`,
    color: characterData.notificationColor
  };

  // Try window.opener first (Chrome)
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(messageData, '*');
    } catch (error) {
      debug.warn('⚠️ Could not send via window.opener:', error.message);
      // Fallback to background script relay
      browserAPI.runtime.sendMessage({
        action: 'relayRollToRoll20',
        roll: messageData
      });
    }
  } else {
    // Fallback: Use background script to relay to Roll20 (Firefox)
    browserAPI.runtime.sendMessage({
      action: 'relayRollToRoll20',
      roll: messageData
    });
  }
}

function getHitDieType() {
  // Determine hit die based on class (D&D 5e)
  const className = (characterData.class || '').toLowerCase();

  const hitDiceMap = {
    'barbarian': 'd12',
    'fighter': 'd10',
    'paladin': 'd10',
    'ranger': 'd10',
    'bard': 'd8',
    'cleric': 'd8',
    'druid': 'd8',
    'monk': 'd8',
    'rogue': 'd8',
    'warlock': 'd8',
    'sorcerer': 'd6',
    'wizard': 'd6'
  };

  for (const [classKey, die] of Object.entries(hitDiceMap)) {
    if (className.includes(classKey)) {
      return die;
    }
  }

  // Default to d8 if class not found
  return 'd8';
}

function initializeHitDice() {
  // Initialize hit dice if not already set
  if (characterData.hitDice === undefined) {
    const level = characterData.level || 1;
    characterData.hitDice = {
      current: level,
      max: level,
      type: getHitDieType()
    };
  }
}

function spendHitDice() {
  initializeHitDice();

  const conMod = characterData.attributeMods?.constitution || 0;
  const hitDie = characterData.hitDice.type;
  const maxDice = parseInt(hitDie.substring(1)); // Extract number from "d8" -> 8

  if (characterData.hitDice.current <= 0) {
    alert('You have no Hit Dice remaining to spend!');
    return;
  }

  let totalHealed = 0;
  let diceSpent = 0;

  while (characterData.hitDice.current > 0 && characterData.hitPoints.current < characterData.hitPoints.max) {
    const spend = confirm(
      `Spend a Hit Die? (${characterData.hitDice.current}/${characterData.hitDice.max} remaining)\n\n` +
      `Hit Die: ${hitDie}\n` +
      `CON Modifier: ${conMod >= 0 ? '+' : ''}${conMod}\n` +
      `Current HP: ${characterData.hitPoints.current}/${characterData.hitPoints.max}\n` +
      `HP Healed so far: ${totalHealed}`
    );

    if (!spend) break;

    // Roll the hit die
    const roll = Math.floor(Math.random() * maxDice) + 1;
    const healing = Math.max(1, roll + conMod); // Minimum 1 HP restored

    characterData.hitDice.current--;
    diceSpent++;

    const oldHP = characterData.hitPoints.current;
    characterData.hitPoints.current = Math.min(
      characterData.hitPoints.current + healing,
      characterData.hitPoints.max
    );
    const actualHealing = characterData.hitPoints.current - oldHP;
    totalHealed += actualHealing;

    debug.log(`🎲 Rolled ${hitDie}: ${roll} + ${conMod} = ${healing} HP (restored ${actualHealing})`);

    // Announce the roll with fancy formatting
    if (window.opener && !window.opener.closed) {
      const colorBanner = getColoredBanner();
      window.opener.postMessage({
        action: 'announceSpell',
        message: `&{template:default} {{name=${colorBanner}${characterData.name} spends hit dice}} {{Roll=🎲 ${hitDie}: ${roll} + ${conMod} CON}} {{HP Restored=${healing}}} {{Current HP=${characterData.hitPoints.current}/${characterData.hitPoints.max}}}`,
        color: characterData.notificationColor
      }, '*');
    }
  }

  if (diceSpent > 0) {
    showNotification(`🎲 Spent ${diceSpent} Hit Dice and restored ${totalHealed} HP!`);
  } else {
    showNotification('No Hit Dice spent.');
  }
}

function takeLongRest() {
  if (!characterData) {
    showNotification('❌ Character data not available', 'error');
    return;
  }

  const confirmed = confirm('Take a Long Rest?\n\nThis will:\n- Fully restore HP\n- Restore all spell slots\n- Restore all class features\n- Restore half your hit dice (minimum 1)');

  if (!confirmed) return;

  debug.log('🌙 Taking long rest...');

  // Initialize hit dice if needed
  initializeHitDice();

  // Restore all HP
  characterData.hitPoints.current = characterData.hitPoints.max;
  debug.log('✅ Restored HP to max');

  // Clear temporary HP (RAW: temp HP doesn't persist through rest)
  if (characterData.temporaryHP > 0) {
    characterData.temporaryHP = 0;
    debug.log('✅ Cleared temporary HP');
  }

  // Note: Inspiration is NOT automatically restored on long rest
  // It must be granted by the DM, so we don't touch it here
  debug.log(`ℹ️ Inspiration status unchanged (${characterData.inspiration ? 'active' : 'none'})`);

  // Restore hit dice (half of max, minimum 1)
  const hitDiceRestored = Math.max(1, Math.floor(characterData.hitDice.max / 2));
  const oldHitDice = characterData.hitDice.current;
  characterData.hitDice.current = Math.min(
    characterData.hitDice.current + hitDiceRestored,
    characterData.hitDice.max
  );
  debug.log(`✅ Restored ${characterData.hitDice.current - oldHitDice} hit dice (${characterData.hitDice.current}/${characterData.hitDice.max})`);

  // Restore all spell slots
  if (characterData.spellSlots) {
    for (let level = 1; level <= 9; level++) {
      const slotVar = `level${level}SpellSlots`;
      const slotMaxVar = `level${level}SpellSlotsMax`;

      if (characterData.spellSlots[slotMaxVar] !== undefined) {
        characterData.spellSlots[slotVar] = characterData.spellSlots[slotMaxVar];
        debug.log(`✅ Restored level ${level} spell slots`);
      }
    }
  }

  // Restore all class resources (Ki, Sorcery Points, Rage, etc.)
  if (characterData.resources && characterData.resources.length > 0) {
    characterData.resources.forEach(resource => {
      resource.current = resource.max;
      debug.log(`✅ Restored ${resource.name} (${resource.current}/${resource.max})`);
    });
  }

  // Restore all class resources
  if (characterData.otherVariables) {
    Object.keys(characterData.otherVariables).forEach(key => {
      // If there's a Max variant, restore to max
      if (key.endsWith('Max')) {
        const baseKey = key.replace('Max', '');
        if (characterData.otherVariables[baseKey] !== undefined) {
          characterData.otherVariables[baseKey] = characterData.otherVariables[key];
          debug.log(`✅ Restored ${baseKey}`);
        }
      }
    });

    // Also restore specific resources that might not follow the Max pattern
    if (characterData.otherVariables.kiMax !== undefined) {
      characterData.otherVariables.ki = characterData.otherVariables.kiMax;
    } else if (characterData.otherVariables.kiPointsMax !== undefined) {
      characterData.otherVariables.kiPoints = characterData.otherVariables.kiPointsMax;
    }

    if (characterData.otherVariables.sorceryPointsMax !== undefined) {
      characterData.otherVariables.sorceryPoints = characterData.otherVariables.sorceryPointsMax;
    }

    if (characterData.otherVariables.pactMagicSlotsMax !== undefined) {
      characterData.otherVariables.pactMagicSlots = characterData.otherVariables.pactMagicSlotsMax;
    }

    if (characterData.otherVariables.channelDivinityMax !== undefined) {
      characterData.otherVariables.channelDivinity = characterData.otherVariables.channelDivinityMax;
    }
  }

  // Reset limited uses for all abilities
  if (characterData.actions) {
    characterData.actions.forEach(action => {
      if (action.uses && action.usesUsed > 0) {
        action.usesUsed = 0;
        debug.log(`✅ Reset uses for ${action.name}`);
      }
    });
  }

  saveCharacterData();
  buildSheet(characterData);

  showNotification('🌙 Long Rest complete! All resources restored.');
  debug.log('✅ Long rest complete');

  // Announce to Roll20 with fancy formatting
  const colorBanner = getColoredBanner();
  const messageData = {
    action: 'announceSpell',
    message: `&{template:default} {{name=${colorBanner}${characterData.name} takes a long rest}} {{=🌙 Long rest complete!}} {{HP=${characterData.hitPoints.current}/${characterData.hitPoints.max} (Fully Restored)}} {{=All spell slots and resources restored!}}`,
    color: characterData.notificationColor
  };

  // Try window.opener first (Chrome)
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(messageData, '*');
    } catch (error) {
      debug.warn('⚠️ Could not send via window.opener:', error.message);
      // Fallback to background script relay
      browserAPI.runtime.sendMessage({
        action: 'relayRollToRoll20',
        roll: messageData
      });
    }
  } else {
    // Fallback: Use background script to relay to Roll20 (Firefox)
    browserAPI.runtime.sendMessage({
      action: 'relayRollToRoll20',
      roll: messageData
    });
  }
}

// Initialize collapsible sections
function initCollapsibleSections() {
  const sections = document.querySelectorAll('.section h3');

  sections.forEach(header => {
    header.addEventListener('click', function() {
      const section = this.parentElement;
      const content = section.querySelector('.section-content');

      // Toggle collapsed class
      this.classList.toggle('collapsed');
      content.classList.toggle('collapsed');
    });
  });
}

// Call collapsible initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCollapsibleSections);
} else {
  initCollapsibleSections();
}

// Add close button event listener (CSP-compliant, no inline onclick)
function initCloseButton() {
  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.close();
    });
  }
}

// Initialize close button when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCloseButton);
} else {
  initCloseButton();
}

debug.log('✅ Popup script fully loaded');
