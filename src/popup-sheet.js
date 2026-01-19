console.log('✅ Popup HTML loaded');

// Store character data globally so we can update it
let characterData = null;

// Listen for character data from parent window via postMessage
window.addEventListener('message', (event) => {
  console.log('✅ Received message in popup:', event.data);

  if (event.data && event.data.action === 'initCharacterSheet') {
    console.log('✅ Initializing character sheet with data:', event.data.data.name);
    characterData = event.data.data;  // Store globally
    buildSheet(characterData);
  }
});

// Tell parent window we're ready
if (window.opener && !window.opener.closed) {
  console.log('✅ Sending ready message to parent window...');
  window.opener.postMessage({ action: 'popupReady' }, '*');
} else {
  console.error('❌ No parent window available');
}

console.log('✅ Waiting for character data via postMessage...');

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
  console.log('Building character sheet...');
  console.log('📊 Character data received:', data);
  console.log('✨ Spell slots data:', data.spellSlots);

  // Character name and info
  document.getElementById('char-name').textContent = `🎲 ${data.name || 'Character'}`;

  // Initialize hit dice if needed
  initializeHitDice();

  // Capitalize race name
  const raceName = data.race ? data.race.charAt(0).toUpperCase() + data.race.slice(1) : 'Unknown';

  document.getElementById('char-info').innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center;">
      <div><strong>Class:</strong> ${data.class || 'Unknown'}</div>
      <div><strong>Level:</strong> ${data.level || 1}</div>
      <div><strong>Race:</strong> ${raceName}</div>
      <div><strong>Hit Dice:</strong> ${data.hitDice.current}/${data.hitDice.max} ${data.hitDice.type}</div>
    </div>
  `;

  // Spell Slots
  buildSpellSlotsDisplay();

  // Abilities
  const abilitiesGrid = document.getElementById('abilities-grid');
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
  abilities.forEach(ability => {
    const bonus = data.savingThrows?.[ability] || 0;
    const card = createCard(`${ability.substring(0, 3).toUpperCase()}`, `+${bonus}`, '', () => {
      roll(`${ability.toUpperCase()} Save`, `1d20+${bonus}`);
    });
    savesGrid.appendChild(card);
  });

  // Skills
  const skillsGrid = document.getElementById('skills-grid');
  Object.entries(data.skills || {}).forEach(([skill, bonus]) => {
    const displayName = skill.charAt(0).toUpperCase() + skill.slice(1).replace(/-/g, ' ');
    const card = createCard(displayName, `${bonus >= 0 ? '+' : ''}${bonus}`, '', () => {
      roll(displayName, `1d20${bonus >= 0 ? '+' : ''}${bonus}`);
    });
    skillsGrid.appendChild(card);
  });

  // Spells - organized by source then level
  const spellsContainer = document.getElementById('spells-container');
  if (data.spells && data.spells.length > 0) {
    buildSpellsBySource(spellsContainer, data.spells);
  } else {
    spellsContainer.innerHTML = '<p style="text-align: center; color: #666;">No spells available</p>';
  }

  console.log('✅ Sheet built successfully');
}

function buildSpellsBySource(container, spells) {
  // Group spells by source
  const spellsBySource = {};

  spells.forEach((spell, index) => {
    // Add index to spell for tracking
    spell.index = index;

    const source = spell.source || 'Unknown Source';
    if (!spellsBySource[source]) {
      spellsBySource[source] = [];
    }
    spellsBySource[source].push(spell);
  });

  // Clear container
  container.innerHTML = '';

  // Sort sources alphabetically
  const sortedSources = Object.keys(spellsBySource).sort();

  sortedSources.forEach(source => {
    // Create source section
    const sourceSection = document.createElement('div');
    sourceSection.style.cssText = 'margin-bottom: 20px;';

    const sourceHeader = document.createElement('h4');
    sourceHeader.textContent = `📚 ${source}`;
    sourceHeader.style.cssText = 'color: #2c3e50; margin-bottom: 10px; padding: 5px; background: #ecf0f1; border-radius: 4px;';
    sourceSection.appendChild(sourceHeader);

    // Sort spells by level within source
    const sortedSpells = spellsBySource[source].sort((a, b) => {
      const levelA = parseInt(a.level) || 0;
      const levelB = parseInt(b.level) || 0;
      return levelA - levelB;
    });

    // Add spells
    sortedSpells.forEach(spell => {
      const spellCard = createSpellCard(spell, spell.index);
      sourceSection.appendChild(spellCard);
    });

    container.appendChild(sourceSection);
  });
}

function buildSpellSlotsDisplay() {
  const container = document.getElementById('spell-slots-container');

  if (!characterData || !characterData.spellSlots) {
    container.innerHTML = '<p style="text-align: center; color: #666;">No spell slots available</p>';
    console.log('⚠️ No spell slots in character data');
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
    console.log('⚠️ Character has 0 max slots for all levels');
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

function createCard(title, main, sub, onClick) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <strong>${title}</strong><br>
    <span class="bonus">${main}</span><br>
    ${sub ? `<span class="bonus">${sub}</span>` : ''}
  `;
  card.addEventListener('click', onClick);
  return card;
}

function createSpellCard(spell, index) {
  const card = document.createElement('div');
  card.className = 'spell-card';

  const header = document.createElement('div');
  header.className = 'spell-header';
  header.innerHTML = `
    <div>
      <span style="font-weight: bold;">${spell.name}</span>
      ${spell.level ? `<span style="margin-left: 10px; color: #666;">Level ${spell.level}</span>` : ''}
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
    ${spell.duration ? `<div><strong>Duration:</strong> ${spell.duration}</div>` : ''}
    ${spell.school ? `<div><strong>School:</strong> ${spell.school}</div>` : ''}
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
  console.log('✨ Attempting to cast:', spell.name, spell);

  if (!characterData) {
    showNotification('❌ Character data not available', 'error');
    return;
  }

  // Cantrips (level 0) don't need slots
  if (!spell.level || spell.level === 0 || spell.level === '0') {
    console.log('✨ Casting cantrip (no resource needed)');
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

  console.log(`📊 Spell slots for level ${spellLevel}:`, { current: currentSlots, max: maxSlots });

  // Check for class-specific casting resources
  const classResources = detectClassResources(spell);

  if (classResources.length > 0) {
    // Show choice dialog if multiple options
    if (classResources.length > 1 || (classResources.length === 1 && currentSlots > 0)) {
      showResourceChoice(spell, spellLevel, currentSlots, maxSlots, classResources);
      return;
    }

    // Use the only available resource
    const resource = classResources[0];
    if (useClassResource(resource, spell)) {
      announceSpellCast(spell, resource.name);
      return;
    }
  }

  // Use spell slot
  if (currentSlots <= 0) {
    showNotification(`❌ No level ${spellLevel} spell slots remaining! (${currentSlots}/${maxSlots})`, 'error');
    return;
  }

  // Deduct spell slot
  characterData.spellSlots[slotVar] = currentSlots - 1;
  saveCharacterData();

  console.log(`✅ Used spell slot. Remaining: ${characterData.spellSlots[slotVar]}/${maxSlots}`);
  announceSpellCast(spell, `Level ${spellLevel} slot`);
  showNotification(`✨ Cast ${spell.name}! (${characterData.spellSlots[slotVar]}/${maxSlots} slots left)`);

  // Update the display
  buildSheet(characterData);
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

  // Check for Sorcery Points (Sorcerer)
  if (otherVars.sorceryPoints !== undefined) {
    const points = otherVars.sorceryPoints || 0;
    const pointsMax = otherVars.sorceryPointsMax || 0;
    if (points > 0) {
      resources.push({ name: 'Sorcery Points', current: points, max: pointsMax, varName: 'sorceryPoints' });
    }
  }

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
  const options = [];

  if (spellSlots > 0) {
    options.push(`Level ${spellLevel} Spell Slot (${spellSlots}/${maxSlots} remaining)`);
  }

  classResources.forEach(resource => {
    options.push(`${resource.name} (${resource.current}/${resource.max} remaining)`);
  });

  const choice = prompt(`Cast ${spell.name} using:\n\n${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}\n\nEnter number (1-${options.length}):`);

  if (!choice) return; // Cancelled

  const index = parseInt(choice) - 1;

  if (index < 0 || index >= options.length) {
    showNotification('❌ Invalid choice', 'error');
    return;
  }

  // If spell slot was chosen
  if (spellSlots > 0 && index === 0) {
    const slotVar = `level${spellLevel}SpellSlots`;
    characterData.spellSlots[slotVar] = spellSlots - 1;
    saveCharacterData();
    announceSpellCast(spell, `Level ${spellLevel} slot`);
    showNotification(`✨ Cast ${spell.name}! (${characterData.spellSlots[slotVar]}/${maxSlots} slots left)`);
    buildSheet(characterData);
    return;
  }

  // Class resource was chosen
  const resourceIndex = spellSlots > 0 ? index - 1 : index;
  const resource = classResources[resourceIndex];

  if (useClassResource(resource, spell)) {
    announceSpellCast(spell, resource.name);
  }
}

function useClassResource(resource, spell) {
  if (resource.current <= 0) {
    showNotification(`❌ No ${resource.name} remaining!`, 'error');
    return false;
  }

  characterData.otherVariables[resource.varName] = resource.current - 1;
  saveCharacterData();

  console.log(`✅ Used ${resource.name}. Remaining: ${characterData.otherVariables[resource.varName]}/${resource.max}`);
  showNotification(`✨ Cast ${spell.name}! (${characterData.otherVariables[resource.varName]}/${resource.max} ${resource.name} left)`);

  buildSheet(characterData);
  return true;
}

function announceSpellCast(spell, resourceUsed) {
  const message = resourceUsed ?
    `${characterData.name} casts ${spell.name}! (using ${resourceUsed})` :
    `${characterData.name} casts ${spell.name}!`;

  // Send to Roll20 chat
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      action: 'announceSpell',
      spellName: spell.name,
      characterName: characterData.name,
      message: message
    }, '*');
  }

  // Also roll if there's a formula
  if (spell.formula) {
    setTimeout(() => {
      roll(spell.name, spell.formula);
    }, 500);
  }
}

function saveCharacterData() {
  // Send updated data to background script for storage
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      action: 'updateCharacterData',
      data: characterData
    }, '*');
    console.log('💾 Sent character data update to parent window');
  }
}

function roll(name, formula) {
  console.log('🎲 Rolling:', name, formula);

  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      action: 'rollFromPopout',
      name: name,
      formula: formula
    }, '*');

    showNotification(`🎲 Rolling ${name}...`);
  } else {
    alert('Parent window not available');
  }
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

  console.log('☕ Taking short rest...');

  // Restore Warlock Pact Magic slots (they recharge on short rest)
  if (characterData.otherVariables) {
    if (characterData.otherVariables.pactMagicSlotsMax !== undefined) {
      characterData.otherVariables.pactMagicSlots = characterData.otherVariables.pactMagicSlotsMax;
      console.log('✅ Restored Pact Magic slots');
    }

    // Restore Ki points for Monk (short rest feature)
    if (characterData.otherVariables.kiMax !== undefined) {
      characterData.otherVariables.ki = characterData.otherVariables.kiMax;
      console.log('✅ Restored Ki points');
    } else if (characterData.otherVariables.kiPointsMax !== undefined) {
      characterData.otherVariables.kiPoints = characterData.otherVariables.kiPointsMax;
      console.log('✅ Restored Ki points');
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

  saveCharacterData();
  buildSheet(characterData);

  showNotification('☕ Short Rest complete! Resources recharged.');
  console.log('✅ Short rest complete');

  // Announce to Roll20
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      action: 'announceSpell',
      message: `${characterData.name} takes a short rest.`
    }, '*');
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

    console.log(`🎲 Rolled ${hitDie}: ${roll} + ${conMod} = ${healing} HP (restored ${actualHealing})`);

    // Announce the roll
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({
        action: 'announceSpell',
        message: `${characterData.name} spends a Hit Die (${hitDie}): ${roll} + ${conMod} = ${healing} HP restored!`
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

  console.log('🌙 Taking long rest...');

  // Initialize hit dice if needed
  initializeHitDice();

  // Restore all HP
  characterData.hitPoints.current = characterData.hitPoints.max;
  console.log('✅ Restored HP to max');

  // Restore hit dice (half of max, minimum 1)
  const hitDiceRestored = Math.max(1, Math.floor(characterData.hitDice.max / 2));
  const oldHitDice = characterData.hitDice.current;
  characterData.hitDice.current = Math.min(
    characterData.hitDice.current + hitDiceRestored,
    characterData.hitDice.max
  );
  console.log(`✅ Restored ${characterData.hitDice.current - oldHitDice} hit dice (${characterData.hitDice.current}/${characterData.hitDice.max})`);

  // Restore all spell slots
  if (characterData.spellSlots) {
    for (let level = 1; level <= 9; level++) {
      const slotVar = `level${level}SpellSlots`;
      const slotMaxVar = `level${level}SpellSlotsMax`;

      if (characterData.spellSlots[slotMaxVar] !== undefined) {
        characterData.spellSlots[slotVar] = characterData.spellSlots[slotMaxVar];
        console.log(`✅ Restored level ${level} spell slots`);
      }
    }
  }

  // Restore all class resources
  if (characterData.otherVariables) {
    Object.keys(characterData.otherVariables).forEach(key => {
      // If there's a Max variant, restore to max
      if (key.endsWith('Max')) {
        const baseKey = key.replace('Max', '');
        if (characterData.otherVariables[baseKey] !== undefined) {
          characterData.otherVariables[baseKey] = characterData.otherVariables[key];
          console.log(`✅ Restored ${baseKey}`);
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

  saveCharacterData();
  buildSheet(characterData);

  showNotification('🌙 Long Rest complete! All resources restored.');
  console.log('✅ Long rest complete');

  // Announce to Roll20
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      action: 'announceSpell',
      message: `${characterData.name} completes a long rest and is fully restored!`
    }, '*');
  }
}

console.log('✅ Popup script fully loaded');
