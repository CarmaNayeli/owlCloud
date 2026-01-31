/**
 * OwlCloud Owlbear Extension - Popover Script
 *
 * This script runs inside the Owlbear extension popover and:
 * 1. Communicates with the browser extension via window.postMessage
 * 2. Uses the Owlbear SDK to interact with the scene
 * 3. Displays character information and controls
 */

/* global OBR */

// ============== State ==============

let currentCharacter = null;
let allCharacters = [];
let isOwlbearReady = false;

// ============== DOM Elements ==============

const statusText = document.getElementById('status-text');
const characterSection = document.getElementById('character-section');
const noCharacterSection = document.getElementById('no-character-section');
const characterInfo = document.getElementById('character-info');
const syncCharacterBtn = document.getElementById('sync-character-btn');
const openExtensionBtn = document.getElementById('open-extension-btn');
const linkExtensionBtn = document.getElementById('link-extension-btn');
const toggleChatTabBtn = document.getElementById('toggle-chat-tab-btn');

// ============== Tab Management ==============

/**
 * Initialize tab switching functionality
 */
function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const brandingHeader = document.getElementById('branding-header');
  const characterHeader = document.getElementById('character-header');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');

      // Remove active class from all tabs and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked tab and corresponding content
      button.classList.add('active');
      document.getElementById(`tab-${tabName}`).classList.add('active');

      // Toggle header based on tab
      if (tabName === 'settings') {
        brandingHeader.style.display = 'block';
        characterHeader.style.display = 'none';
      } else {
        brandingHeader.style.display = 'none';
        characterHeader.style.display = 'block';
      }

      console.log(`📑 Switched to tab: ${tabName}`);
    });
  });
}

// Initialize tabs when DOM is ready
initializeTabs();

// ============== Chat Tab Toggle ==============

let isChatTabEnabled = localStorage.getItem('owlcloud-chat-tab-enabled') === 'true';

/**
 * Update chat tab visibility
 */
function updateChatTabVisibility() {
  const chatTabButton = document.querySelector('[data-tab="chat"]');
  const toggleBtn = document.getElementById('toggle-chat-tab-btn');

  if (chatTabButton && toggleBtn) {
    if (isChatTabEnabled) {
      chatTabButton.style.display = 'block';
      toggleBtn.textContent = '💬 Disable Chat Tab';
    } else {
      chatTabButton.style.display = 'none';
      toggleBtn.textContent = '💬 Enable Chat Tab';

      // If chat tab is currently active, switch to settings
      const chatTab = document.getElementById('tab-chat');
      if (chatTab && chatTab.classList.contains('active')) {
        document.querySelector('[data-tab="settings"]').click();
      }
    }
  }
}

/**
 * Toggle chat tab visibility
 */
function toggleChatTab() {
  isChatTabEnabled = !isChatTabEnabled;
  localStorage.setItem('owlcloud-chat-tab-enabled', isChatTabEnabled);
  updateChatTabVisibility();
}

// Initialize chat tab visibility on load
setTimeout(() => {
  updateChatTabVisibility();
}, 100);

// ============== Owlbear SDK Initialization ==============

OBR.onReady(async () => {
  isOwlbearReady = true;
  console.log('🦉 Owlbear SDK ready');
  statusText.textContent = 'Connected to Owlbear Rodeo';

  // Check for active character
  checkForActiveCharacter();

  // Set up periodic check for character updates
  setInterval(checkForActiveCharacter, 5000);
});

// ============== Character Management ==============

/**
 * Check if there's an active character from Supabase using Owlbear player ID
 */
async function checkForActiveCharacter() {
  try {
    // Get current player's Owlbear ID
    const playerId = await OBR.player.getId();

    console.log('🎭 Checking for character with player ID:', playerId);

    // Call Supabase Edge Function to get active character by player ID
    const response = await fetch(
      `https://gkfpxwvmumaylahtxqrk.supabase.co/functions/v1/get-active-character?owlbear_player_id=${encodeURIComponent(playerId)}`
    );

    if (!response.ok) {
      console.error('Failed to get character:', response.statusText);
      showNoCharacter();
      return;
    }

    const data = await response.json();

    if (data.success && data.character) {
      displayCharacter(data.character);
      // Also fetch all available characters
      await fetchAllCharacters();
    } else {
      showNoCharacter();
    }
  } catch (error) {
    console.error('Error checking for active character:', error);
    showNoCharacter();
  }
}

/**
 * Fetch all available characters for the current player
 */
async function fetchAllCharacters() {
  try {
    const playerId = await OBR.player.getId();

    // Call Supabase Edge Function to get all characters
    const response = await fetch(
      `https://gkfpxwvmumaylahtxqrk.supabase.co/functions/v1/get-all-characters?owlbear_player_id=${encodeURIComponent(playerId)}`
    );

    if (!response.ok) {
      console.error('Failed to get characters:', response.statusText);
      return;
    }

    const data = await response.json();

    if (data.success && data.characters && data.characters.length > 0) {
      allCharacters = data.characters;
      displayCharacterList();
    }
  } catch (error) {
    console.error('Error fetching all characters:', error);
  }
}

/**
 * Display the character list in the Settings tab
 */
function displayCharacterList() {
  const characterListSection = document.getElementById('character-list-section');
  const characterList = document.getElementById('character-list');

  if (!allCharacters || allCharacters.length <= 1) {
    // Hide character list if there's only one or no characters
    characterListSection.style.display = 'none';
    return;
  }

  // Show character list
  characterListSection.style.display = 'block';

  let html = '';
  allCharacters.forEach((character) => {
    const isActive = currentCharacter && character.id === currentCharacter.id;
    html += `
      <div class="character-list-item ${isActive ? 'active' : ''}" onclick="switchToCharacter('${character.id}')">
        <div class="character-list-item-name">${character.name || 'Unknown Character'}</div>
        <div class="character-list-item-details">
          Level ${character.level || '?'} ${character.race || ''} ${character.class || ''}
          ${isActive ? '• Active' : ''}
        </div>
      </div>
    `;
  });

  characterList.innerHTML = html;
}

/**
 * Switch to a different character
 */
window.switchToCharacter = async function(characterId) {
  try {
    // Find the character in the list
    const character = allCharacters.find(c => c.id === characterId);
    if (!character) {
      console.error('Character not found:', characterId);
      return;
    }

    // Update active character in Supabase
    const playerId = await OBR.player.getId();
    const response = await fetch(
      'https://gkfpxwvmumaylahtxqrk.supabase.co/functions/v1/set-active-character',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          owlbearPlayerId: playerId,
          characterId: characterId
        })
      }
    );

    const result = await response.json();

    if (response.ok && result.success) {
      // Display the new character
      displayCharacter(character);
      displayCharacterList(); // Refresh the list to update active state

      if (isOwlbearReady) {
        OBR.notification.show(`Switched to ${character.name}`, 'SUCCESS');
      }
    } else {
      console.error('Failed to switch character:', result.error);
      if (isOwlbearReady) {
        OBR.notification.show('Failed to switch character', 'ERROR');
      }
    }
  } catch (error) {
    console.error('Error switching character:', error);
    if (isOwlbearReady) {
      OBR.notification.show('Error switching character', 'ERROR');
    }
  }
};

/**
 * Display character information
 */
function displayCharacter(character) {
  currentCharacter = character;

  // Update UI
  characterSection.style.display = 'block';
  noCharacterSection.style.display = 'none';

  // Populate character info in Settings tab
  characterInfo.innerHTML = `
    <div class="character-name">${character.name || 'Unknown Character'}</div>
    <div class="character-detail">Level ${character.level || '?'} ${character.race || ''} ${character.class || ''}</div>
    <div class="character-detail">HP: ${character.hitPoints?.current || 0} / ${character.hitPoints?.max || 0}</div>
  `;

  // Update character header for other tabs
  const characterHeaderName = document.getElementById('character-header-name');
  const characterHeaderDetails = document.getElementById('character-header-details');
  if (characterHeaderName && characterHeaderDetails) {
    characterHeaderName.textContent = character.name || 'Unknown Character';
    characterHeaderDetails.textContent = `Level ${character.level || '?'} ${character.race || ''} ${character.class || ''}`;
  }

  // Populate other tabs
  populateStatsTab(character);
  populateAbilitiesTab(character);
  populateActionsTab(character);
  populateSpellsTab(character);
  populateInventoryTab(character);

  console.log('🎭 Displaying character:', character.name);
}

/**
 * Populate Stats & Resources tab (combined)
 */
function populateStatsTab(character) {
  const statsContent = document.getElementById('stats-content');

  const hp = character.hitPoints || {};
  const tempHP = character.temporaryHP || 0;
  const ac = character.armorClass || 10;
  const speed = character.speed || 30;
  const initiative = character.initiative || 0;
  const proficiencyBonus = character.proficiencyBonus || Math.floor((character.level || 1) / 4) + 2;

  // Build core stats section
  let html = `
    <div class="stat-grid">
      <div class="stat-box" style="cursor: pointer;" title="Click to adjust HP">
        <div class="stat-label">HP</div>
        <div class="stat-value">${hp.current || 0}</div>
        <div class="stat-modifier">/ ${hp.max || 0}</div>
      </div>

      ${tempHP > 0 ? `
      <div class="stat-box">
        <div class="stat-label">Temp HP</div>
        <div class="stat-value" style="color: #60A5FA;">${tempHP}</div>
      </div>
      ` : ''}

      <div class="stat-box">
        <div class="stat-label">AC</div>
        <div class="stat-value">${ac}</div>
      </div>

      <div class="stat-box">
        <div class="stat-label">Speed</div>
        <div class="stat-value">${speed}</div>
        <div class="stat-modifier">ft</div>
      </div>

      <div class="stat-box">
        <div class="stat-label">Initiative</div>
        <div class="stat-value">${initiative >= 0 ? '+' : ''}${initiative}</div>
      </div>

      <div class="stat-box">
        <div class="stat-label">Prof Bonus</div>
        <div class="stat-value">+${proficiencyBonus}</div>
      </div>
    </div>
  `;

  // Hit Dice section
  if (character.hitDice) {
    const hitDice = character.hitDice;
    html += `
      <div class="section-header">Hit Dice</div>
      <div class="stat-grid">
        <div class="stat-box">
          <div class="stat-label">Hit Dice</div>
          <div class="stat-value">${hitDice.current || 0}</div>
          <div class="stat-modifier">/ ${hitDice.max || 0} d${hitDice.type || '8'}</div>
        </div>
      </div>
    `;
  }

  // Death Saves section (if character is unconscious)
  if (character.deathSaves && (character.deathSaves.successes > 0 || character.deathSaves.failures > 0)) {
    html += `
      <div class="section-header">Death Saves</div>
      <div class="stat-grid">
        <div class="stat-box" style="border-color: #10B981;">
          <div class="stat-label">Successes</div>
          <div class="stat-value" style="color: #10B981;">${character.deathSaves.successes || 0}</div>
        </div>
        <div class="stat-box" style="border-color: #EF4444;">
          <div class="stat-label">Failures</div>
          <div class="stat-value" style="color: #EF4444;">${character.deathSaves.failures || 0}</div>
        </div>
      </div>
    `;
  }

  // === RESOURCES SECTION ===

  // Spell Slots Section
  const hasSpellSlots = character.spellSlots && Object.keys(character.spellSlots).some(key =>
    key.includes('Max') && character.spellSlots[key] > 0
  );

  if (hasSpellSlots) {
    html += '<div class="section-header">Spell Slots</div>';
    html += '<div class="spell-slots-grid">';

    // Regular spell slots (levels 1-9)
    for (let level = 1; level <= 9; level++) {
      const current = character.spellSlots[`level${level}SpellSlots`] || 0;
      const max = character.spellSlots[`level${level}SpellSlotsMax`] || 0;

      if (max > 0) {
        html += `
          <div class="slot-card ${current === 0 ? 'empty' : ''}">
            <div class="slot-level">Level ${level}</div>
            <div class="slot-count">${current}/${max}</div>
          </div>
        `;
      }
    }

    // Pact Magic slots (Warlock)
    const pactCurrent = character.spellSlots.pactMagicSlots || 0;
    const pactMax = character.spellSlots.pactMagicSlotsMax || 0;
    const pactLevel = character.spellSlots.pactMagicSlotLevel || 1;

    if (pactMax > 0) {
      html += `
        <div class="slot-card pact-magic ${pactCurrent === 0 ? 'empty' : ''}">
          <div class="slot-level">Pact ${pactLevel}</div>
          <div class="slot-count">${pactCurrent}/${pactMax}</div>
        </div>
      `;
    }

    html += '</div>';
  }

  // Class Resources Section
  if (character.resources && character.resources.length > 0) {
    const filteredResources = character.resources.filter(r => {
      if (r.max === 0) return false;
      const lowerName = r.name.toLowerCase().trim();
      if (lowerName.includes('lucky point') || lowerName === 'lucky') return false;
      if (lowerName.includes('hit point') || lowerName === 'hp') return false;
      if (lowerName === 'spell level') return false;
      return true;
    });

    if (filteredResources.length > 0) {
      html += '<div class="section-header">Class Resources</div>';
      html += '<div class="resource-grid">';

      filteredResources.forEach(resource => {
        html += `
          <div class="resource-card">
            <div class="resource-name">${resource.name}</div>
            <div class="resource-value">${resource.current || 0}</div>
            <div class="resource-max">/ ${resource.max || 0}</div>
          </div>
        `;
      });

      html += '</div>';
    }
  }

  // Rest Buttons
  html += `
    <div class="rest-buttons">
      <button class="rest-btn" onclick="alert('Short rest functionality coming soon!')">
        ⏸️ Short Rest
      </button>
      <button class="rest-btn" onclick="alert('Long rest functionality coming soon!')">
        🛌 Long Rest
      </button>
    </div>
  `;

  statsContent.innerHTML = html;
}


/**
 * Populate Abilities & Saves tab
 */
function populateAbilitiesTab(character) {
  const abilitiesContent = document.getElementById('abilities-content');

  // Ability scores and modifiers
  const abilityNames = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  const abilityShortNames = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };

  let html = '<div class="section-header">Ability Scores & Saving Throws</div>';
  html += '<div class="ability-grid">';

  abilityNames.forEach(abilityName => {
    const score = character.attributes?.[abilityName] || 10;
    const modifier = character.attributeMods?.[abilityName] || Math.floor((score - 10) / 2);
    const saveMod = character.savingThrows?.[abilityName] || modifier;
    const isProficient = saveMod !== modifier;

    html += `
      <div class="ability-box ${isProficient ? 'save-proficient' : ''}" title="${isProficient ? 'Proficient in this save' : ''}">
        <div class="ability-name">${abilityShortNames[abilityName]}</div>
        <div class="ability-modifier">${modifier >= 0 ? '+' : ''}${modifier}</div>
        <div class="ability-score">${score}</div>
        ${isProficient ? `<div class="ability-score" style="color: #10B981;">Save: ${saveMod >= 0 ? '+' : ''}${saveMod}</div>` : ''}
      </div>
    `;
  });

  html += '</div>';

  // Skills Section
  if (character.skills && Object.keys(character.skills).length > 0) {
    html += '<div class="section-header">Skills</div>';
    html += '<div class="skill-list">';

    const skillNames = {
      acrobatics: 'Acrobatics', animalHandling: 'Animal Handling', arcana: 'Arcana',
      athletics: 'Athletics', deception: 'Deception', history: 'History',
      insight: 'Insight', intimidation: 'Intimidation', investigation: 'Investigation',
      medicine: 'Medicine', nature: 'Nature', perception: 'Perception',
      performance: 'Performance', persuasion: 'Persuasion', religion: 'Religion',
      sleightOfHand: 'Sleight of Hand', stealth: 'Stealth', survival: 'Survival'
    };

    Object.entries(character.skills).forEach(([skillKey, bonus]) => {
      const skillName = skillNames[skillKey] || skillKey;

      // Determine proficiency level by comparing to base ability modifier
      const skillAbilityMap = {
        acrobatics: 'dexterity', animalHandling: 'wisdom', arcana: 'intelligence',
        athletics: 'strength', deception: 'charisma', history: 'intelligence',
        insight: 'wisdom', intimidation: 'charisma', investigation: 'intelligence',
        medicine: 'wisdom', nature: 'intelligence', perception: 'wisdom',
        performance: 'charisma', persuasion: 'charisma', religion: 'intelligence',
        sleightOfHand: 'dexterity', stealth: 'dexterity', survival: 'wisdom'
      };

      const baseAbility = skillAbilityMap[skillKey] || 'strength';
      const baseMod = character.attributeMods?.[baseAbility] || 0;
      const profBonus = character.proficiencyBonus || 2;

      let proficiencyClass = '';
      if (bonus === baseMod + profBonus) {
        proficiencyClass = 'skill-proficient';
      } else if (bonus === baseMod + (profBonus * 2)) {
        proficiencyClass = 'skill-expert';
      }

      html += `
        <div class="skill-item ${proficiencyClass}">
          <span class="skill-name">${skillName}</span>
          <span class="skill-bonus">${bonus >= 0 ? '+' : ''}${bonus}</span>
        </div>
      `;
    });

    html += '</div>';
  }

  abilitiesContent.innerHTML = html;
}

/**
 * Populate Actions & Attacks tab
 */
function populateActionsTab(character) {
  const actionsContent = document.getElementById('actions-content');

  let html = '';

  // Features & Traits Section
  if (character.features && character.features.length > 0) {
    const featuresId = 'features-list-' + Date.now();
    html += `<div class="section-header collapsible" onclick="toggleCollapsible('${featuresId}')">Features & Traits (${character.features.length})</div>`;
    html += `<div id="${featuresId}" class="collapsible-content">`;
    html += '<div class="feature-list">';

    character.features.forEach(feature => {
      html += `
        <div class="feature-card">
          <div class="feature-name">${feature.name || 'Unknown Feature'}</div>
          ${feature.description ? `<div class="feature-description">${feature.description.substring(0, 150)}${feature.description.length > 150 ? '...' : ''}</div>` : ''}
        </div>
      `;
    });

    html += '</div>';
    html += '</div>';
  }

  // Actions Section
  if (character.actions && character.actions.length > 0) {
    // Deduplicate and filter actions
    const deduplicatedActions = deduplicateActions(character.actions);

    const actionsId = 'actions-list-' + Date.now();
    html += `<div class="section-header collapsible" onclick="toggleCollapsible('${actionsId}')">Actions & Attacks (${deduplicatedActions.length})</div>`;
    html += `<div id="${actionsId}" class="collapsible-content">`;
    html += '<div class="feature-list">';

    deduplicatedActions.forEach(action => {
      const actionType = action.actionType || 'Action';
      const damage = action.damage || '';
      const attackRoll = action.attackRoll || '';
      const uses = action.uses;

      let actionDetails = [];
      if (actionType) actionDetails.push(actionType);
      if (attackRoll) actionDetails.push(`Attack: ${attackRoll}`);
      if (damage) actionDetails.push(`Damage: ${damage}`);
      if (uses && uses.value !== undefined) actionDetails.push(`Uses: ${uses.value}/${uses.max || uses.value}`);

      html += `
        <div class="feature-card" style="cursor: pointer;" title="Click to use action">
          <div class="feature-name">${action.name || 'Unknown Action'}</div>
          ${actionDetails.length > 0 ? `<div class="feature-description" style="color: #A78BFA;">${actionDetails.join(' • ')}</div>` : ''}
          ${action.description ? `<div class="feature-description">${action.description.substring(0, 100)}${action.description.length > 100 ? '...' : ''}</div>` : ''}
        </div>
      `;
    });

    html += '</div>';
    html += '</div>';
  }

  if (!character.features && !character.actions) {
    html = '<div class="empty-state">No features or actions available</div>';
  }

  actionsContent.innerHTML = html;
}

/**
 * Deduplicate actions by normalized name
 */
function deduplicateActions(actions) {
  const normalizeActionName = (name) => {
    if (!name) return '';
    const suffixPatterns = [
      /\s*\(free\)$/i,
      /\s*\(free action\)$/i,
      /\s*\(bonus action\)$/i,
      /\s*\(bonus\)$/i,
      /\s*\(reaction\)$/i,
      /\s*\(action\)$/i,
      /\s*\(no spell slot\)$/i,
      /\s*\(at will\)$/i
    ];

    let normalized = name.trim();
    for (const pattern of suffixPatterns) {
      normalized = normalized.replace(pattern, '');
    }
    return normalized.trim();
  };

  const deduplicatedActions = [];
  const actionsByNormalizedName = {};

  // Sort actions: prefer shorter names (base versions)
  const sortedActions = [...actions].sort((a, b) => {
    const normA = normalizeActionName(a.name || '');
    const normB = normalizeActionName(b.name || '');
    if (normA !== normB) return normA.localeCompare(normB);
    return (a.name || '').length - (b.name || '').length;
  });

  sortedActions.forEach(action => {
    const normalizedName = normalizeActionName(action.name || '');
    if (!normalizedName) return;

    // Filter out duplicate Divine Smite variants
    const actionLower = (action.name || '').toLowerCase();
    if (actionLower.includes('divine smite') && actionLower !== 'divine smite') {
      return;
    }

    if (!actionsByNormalizedName[normalizedName]) {
      actionsByNormalizedName[normalizedName] = action;
      deduplicatedActions.push(action);
    } else {
      // Merge duplicate action properties
      const existing = actionsByNormalizedName[normalizedName];
      if (action.source && !existing.source?.includes(action.source)) {
        existing.source = existing.source ? existing.source + '; ' + action.source : action.source;
      }
      if (action.damage && !existing.damage) existing.damage = action.damage;
      if (action.attackRoll && !existing.attackRoll) existing.attackRoll = action.attackRoll;
      if (action.uses && !existing.uses) existing.uses = action.uses;
    }
  });

  return deduplicatedActions;
}

/**
 * Populate Spells tab
 */
function populateSpellsTab(character) {
  const spellsContent = document.getElementById('spells-content');

  if (!character.spells || character.spells.length === 0) {
    spellsContent.innerHTML = '<div class="empty-state">No spells available</div>';
    return;
  }

  // Filter out Divine Smite duplicates
  const filteredSpells = character.spells.filter(spell => {
    const spellName = (spell.name || '').toLowerCase();
    if (spellName.includes('divine smite') && spellName !== 'divine smite') {
      return false;
    }
    return true;
  });

  // Group spells by level
  const spellsByLevel = {};
  filteredSpells.forEach(spell => {
    const spellLevel = parseInt(spell.level) || 0;
    const levelKey = spellLevel === 0 ? 'Cantrips' : `Level ${spellLevel}`;

    if (!spellsByLevel[levelKey]) {
      spellsByLevel[levelKey] = [];
    }
    spellsByLevel[levelKey].push(spell);
  });

  // Build HTML
  let html = '';

  // Order levels properly (Cantrips, then 1-9)
  const levelOrder = ['Cantrips', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6', 'Level 7', 'Level 8', 'Level 9'];

  levelOrder.forEach((levelKey, index) => {
    if (!spellsByLevel[levelKey]) return;

    const spells = spellsByLevel[levelKey];
    const spellLevelId = 'spell-level-' + index + '-' + Date.now();

    html += `<div class="spell-level-group">`;
    html += `<div class="spell-level-header collapsible" onclick="toggleCollapsible('${spellLevelId}')" style="cursor: pointer; user-select: none; display: flex; justify-content: space-between; align-items: center;">${levelKey} (${spells.length})<span style="font-size: 12px; transition: transform 0.2s ease;">▼</span></div>`;
    html += `<div id="${spellLevelId}" class="collapsible-content">`;
    html += `<div class="spell-list">`;

    spells.forEach(spell => {
      const isConcentration = spell.concentration || false;
      const castingTime = spell.castingTime || '';
      const range = spell.range || '';

      let metaInfo = [];
      if (castingTime) metaInfo.push(castingTime);
      if (range) metaInfo.push(range);

      html += `
        <div class="spell-card ${isConcentration ? 'concentration' : ''}" title="Click to cast spell">
          <div class="spell-card-header">
            <span class="spell-name">${spell.name || 'Unknown Spell'}</span>
            ${isConcentration ? '<span class="spell-concentration-badge">Concentration</span>' : ''}
          </div>
          ${metaInfo.length > 0 ? `<div class="spell-meta">${metaInfo.join(' • ')}</div>` : ''}
          ${spell.description ? `<div class="spell-description">${spell.description.substring(0, 100)}${spell.description.length > 100 ? '...' : ''}</div>` : ''}
        </div>
      `;
    });

    html += `</div></div></div>`;
  });

  spellsContent.innerHTML = html;
}

/**
 * Populate Inventory tab
 */
function populateInventoryTab(character) {
  const inventoryContent = document.getElementById('inventory-content');

  if (!character.inventory || character.inventory.length === 0) {
    inventoryContent.innerHTML = '<div class="empty-state">No items in inventory</div>';
    return;
  }

  // Filter out coins
  const coinPatterns = ['platinum piece', 'gold piece', 'silver piece', 'copper piece', 'electrum piece',
                        'platinum coin', 'gold coin', 'silver coin', 'copper coin', 'electrum coin',
                        'pp', 'gp', 'sp', 'cp', 'ep'];

  const filteredInventory = character.inventory.filter(item => {
    const lowerName = (item.name || '').toLowerCase();
    const isCoin = coinPatterns.some(pattern => {
      if (pattern.length <= 2) {
        return lowerName === pattern || lowerName === pattern + 's' || lowerName.match(new RegExp(`^\\d+\\s*${pattern}s?$`));
      }
      return lowerName.includes(pattern);
    });
    return !isCoin;
  });

  if (filteredInventory.length === 0) {
    inventoryContent.innerHTML = '<div class="empty-state">No items in inventory</div>';
    return;
  }

  // Sort: equipped first, then alphabetically
  filteredInventory.sort((a, b) => {
    if (a.equipped && !b.equipped) return -1;
    if (!a.equipped && b.equipped) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  let html = '<div class="inventory-grid">';

  filteredInventory.forEach(item => {
    const itemClass = item.equipped ? 'equipped' : (item.attuned ? 'attuned' : '');
    const tags = [];

    if (item.equipped) tags.push('Equipped');
    if (item.attuned) tags.push('Attuned');
    if (item.type) tags.push(item.type);

    html += `
      <div class="item-card ${itemClass}">
        <div class="item-info">
          <div class="item-name">
            ${item.name || 'Unknown Item'}
            ${item.quantity > 1 ? `<span class="item-quantity">×${item.quantity}</span>` : ''}
          </div>
          ${tags.length > 0 ? `<div class="item-tags">${tags.join(' • ')}</div>` : ''}
        </div>
      </div>
    `;
  });

  html += '</div>';

  inventoryContent.innerHTML = html;
}

/**
 * Show no character state
 */
function showNoCharacter() {
  characterSection.style.display = 'none';
  noCharacterSection.style.display = 'block';
  statusText.textContent = 'No character selected';
}

// ============== Event Handlers ==============

/**
 * Sync character from DiceCloud
 */
syncCharacterBtn.addEventListener('click', () => {
  // Send message to browser extension to sync character
  const message = {
    type: 'OWLCLOUD_SYNC_CHARACTER',
    source: 'owlbear-extension'
  };

  window.parent.postMessage(message, 'https://www.owlbear.rodeo');

  // Show notification in Owlbear
  if (isOwlbearReady) {
    OBR.notification.show('Syncing character from DiceCloud...', 'INFO');
  }

  // Update status
  statusText.textContent = 'Syncing character...';

  // Refresh character data after a delay
  setTimeout(checkForActiveCharacter, 2000);
});

/**
 * Open browser extension popup
 */
openExtensionBtn.addEventListener('click', () => {
  // Send message to browser extension to open popup
  const message = {
    type: 'OWLCLOUD_OPEN_POPUP',
    source: 'owlbear-extension'
  };

  window.parent.postMessage(message, 'https://www.owlbear.rodeo');

  alert('Please click the OwlCloud extension icon in your browser toolbar to select a character.');
});

/**
 * Toggle chat tab
 */
toggleChatTabBtn.addEventListener('click', () => {
  toggleChatTab();
});

/**
 * Link Owlbear player to browser extension characters
 */
linkExtensionBtn.addEventListener('click', async () => {
  try {
    if (!isOwlbearReady) {
      alert('Owlbear SDK not ready. Please wait a moment and try again.');
      return;
    }

    // Get Owlbear player ID
    const playerId = await OBR.player.getId();
    console.log('🔗 Linking player ID:', playerId);

    // Prompt user for their DiceCloud user ID
    const dicecloudUserId = prompt(
      'Enter your DiceCloud User ID:\n\n' +
      'You can find this in the OwlCloud extension popup after syncing a character.\n' +
      'It looks like: aBcDeFgHiJkLmNoP1'
    );

    if (!dicecloudUserId || dicecloudUserId.trim() === '') {
      return; // User cancelled
    }

    // Show loading state
    linkExtensionBtn.textContent = '⏳ Linking...';
    linkExtensionBtn.disabled = true;

    // Call Supabase edge function to link
    const response = await fetch(
      'https://gkfpxwvmumaylahtxqrk.supabase.co/functions/v1/link-owlbear-player',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          owlbearPlayerId: playerId,
          dicecloudUserId: dicecloudUserId.trim()
        })
      }
    );

    const result = await response.json();

    if (response.ok && result.success) {
      alert(`✅ Successfully linked! ${result.linkedCharacters} character(s) are now connected to Owlbear.`);

      // Refresh character data
      checkForActiveCharacter();
    } else {
      alert(`❌ Linking failed: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error linking to extension:', error);
    alert(`❌ Error: ${error.message}`);
  } finally {
    // Restore button state
    linkExtensionBtn.textContent = '🔗 Link to Browser Extension';
    linkExtensionBtn.disabled = false;
  }
});

// ============== Message Listener ==============

/**
 * Listen for messages from the browser extension content script
 */
window.addEventListener('message', (event) => {
  // Verify origin for security
  if (event.origin !== 'https://www.owlbear.rodeo') {
    return;
  }

  const { type, data } = event.data;

  switch (type) {
    case 'OWLCLOUD_ACTIVE_CHARACTER_RESPONSE':
      if (data && data.character) {
        displayCharacter(data.character);
      } else {
        showNoCharacter();
      }
      break;

    case 'OWLCLOUD_CHARACTER_UPDATED':
      if (data && data.character) {
        displayCharacter(data.character);
        if (isOwlbearReady) {
          OBR.notification.show(`Character updated: ${data.character.name}`, 'SUCCESS');
        }
      }
      break;

    case 'OWLCLOUD_SYNC_COMPLETE':
      if (isOwlbearReady) {
        OBR.notification.show('Character synced successfully', 'SUCCESS');
      }
      statusText.textContent = 'Connected to Owlbear Rodeo';
      checkForActiveCharacter();
      break;

    case 'OWLCLOUD_ERROR':
      if (isOwlbearReady) {
        OBR.notification.show(`Error: ${data.message}`, 'ERROR');
      }
      statusText.textContent = `Error: ${data.message}`;
      break;

    default:
      // Ignore unknown message types
      break;
  }
});

// ============== Dice Rolling Integration ==============

/**
 * Post a dice roll to Owlbear chat
 * This will be called when the browser extension sends roll data
 */
function postRollToOwlbear(rollData) {
  if (!isOwlbearReady) {
    console.warn('Owlbear not ready, cannot post roll');
    return;
  }

  // Use Owlbear notification system to display roll
  // TODO: In the future, this could create scene items or use a custom roll display
  const rollResult = rollData.result || '?';
  const rollName = rollData.name || 'Roll';
  const characterName = rollData.characterName || 'Unknown';

  OBR.notification.show(
    `${characterName} rolled ${rollName}: ${rollResult}`,
    'INFO'
  );

  console.log('🎲 Roll posted to Owlbear:', rollData);
}

// Listen for roll messages from browser extension
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://www.owlbear.rodeo') {
    return;
  }

  if (event.data.type === 'OWLCLOUD_POST_ROLL') {
    postRollToOwlbear(event.data.data);
  }
});

// ============== Collapsible Sections ==============

/**
 * Toggle a collapsible section
 */
window.toggleCollapsible = function(elementId) {
  const element = document.getElementById(elementId);
  const header = element.previousElementSibling;

  if (element && header) {
    element.classList.toggle('collapsed');
    header.classList.toggle('collapsed');

    // Handle arrow rotation for spell level headers
    const arrow = header.querySelector('span[style*="transition"]');
    if (arrow) {
      const isCollapsed = element.classList.contains('collapsed');
      arrow.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
  }
};

// ============== Initialization ==============

console.log('🎲 OwlCloud Owlbear extension popover loaded');
statusText.textContent = 'Initializing...';

// Initial check for character (will happen after OBR.onReady)
setTimeout(() => {
  if (!isOwlbearReady) {
    statusText.textContent = 'Waiting for Owlbear SDK...';
  }
}, 1000);

// ============== Chat System ==============

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');

/**
 * Scroll chat to bottom
 */
function scrollChatToBottom() {
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 100);
}

/**
 * Add a message to the chat
 * @param {string} text - Message text
 * @param {string} type - Message type: 'system', 'roll', 'action', 'spell', 'combat', 'user'
 * @param {string} author - Message author (optional)
 */
function addChatMessage(text, type = 'system', author = null) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${type}`;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (author) {
    messageDiv.innerHTML = `
      <div class="chat-message-header">
        <span class="chat-message-author">${author}</span>
        <span class="chat-message-time">${timeStr}</span>
      </div>
      <div class="chat-message-text">${text}</div>
    `;
  } else {
    messageDiv.innerHTML = `
      <div class="chat-message-text">${text}</div>
    `;
  }

  chatMessages.appendChild(messageDiv);
  scrollChatToBottom();

  // Limit chat history to last 100 messages
  const messages = chatMessages.querySelectorAll('.chat-message');
  if (messages.length > 100) {
    messages[0].remove();
  }
}

/**
 * Send a user message
 */
function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  // Add user message to chat
  const characterName = currentCharacter?.name || 'You';
  addChatMessage(text, 'user', characterName);

  // Send message to Owlbear via notification (placeholder - you can customize this)
  if (isOwlbearReady) {
    OBR.notification.show(`${characterName}: ${text}`, 'INFO');
  }

  // Clear input
  chatInput.value = '';
}

/**
 * Add a dice roll announcement to chat
 */
function announceDiceRoll(rollName, formula, result) {
  const characterName = currentCharacter?.name || 'Character';
  const text = `🎲 ${rollName}: ${formula} = <strong>${result}</strong>`;
  addChatMessage(text, 'roll', characterName);
}

/**
 * Add an action announcement to chat
 */
function announceAction(actionName, details = '') {
  const characterName = currentCharacter?.name || 'Character';
  const text = details ? `⚔️ ${actionName} - ${details}` : `⚔️ ${actionName}`;
  addChatMessage(text, 'action', characterName);
}

/**
 * Add a spell announcement to chat
 */
function announceSpell(spellName, level, details = '') {
  const characterName = currentCharacter?.name || 'Character';
  const levelText = level === 0 ? 'Cantrip' : `Level ${level}`;
  const text = details ? `✨ ${spellName} (${levelText}) - ${details}` : `✨ ${spellName} (${levelText})`;
  addChatMessage(text, 'spell', characterName);
}

/**
 * Add a combat log entry to chat
 */
function announceCombat(text) {
  const characterName = currentCharacter?.name || 'Character';
  addChatMessage(text, 'combat', characterName);
}

// Event Listeners
chatSendBtn.addEventListener('click', sendChatMessage);

chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendChatMessage();
  }
});

// Expose chat functions globally for use by other modules
window.owlcloudChat = {
  addMessage: addChatMessage,
  announceRoll: announceDiceRoll,
  announceAction: announceAction,
  announceSpell: announceSpell,
  announceCombat: announceCombat
};

console.log('💬 Chat system initialized');
