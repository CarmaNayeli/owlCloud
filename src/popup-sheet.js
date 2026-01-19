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

function buildSheet(data) {
  console.log('Building character sheet...');

  // Character name and info
  document.getElementById('char-name').textContent = `🎲 ${data.name || 'Character'}`;
  document.getElementById('char-info').innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center;">
      <div><strong>Class:</strong> ${data.class || 'Unknown'}</div>
      <div><strong>Level:</strong> ${data.level || 1}</div>
      <div><strong>Race:</strong> ${data.race || 'Unknown'}</div>
    </div>
  `;

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

  // Spells
  const spellsContainer = document.getElementById('spells-container');
  if (data.spells && data.spells.length > 0) {
    data.spells.forEach((spell, index) => {
      const spellCard = createSpellCard(spell, index);
      spellsContainer.appendChild(spellCard);
    });
  } else {
    spellsContainer.innerHTML = '<p style="text-align: center; color: #666;">No spells available</p>';
  }

  console.log('✅ Sheet built successfully');
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

console.log('✅ Popup script fully loaded');
