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
let rollMode = 'normal'; // 'advantage', 'normal', or 'disadvantage'

// ============== DOM Elements ==============

const statusText = document.getElementById('status-text');
const characterSection = document.getElementById('character-section');
const noCharacterSection = document.getElementById('no-character-section');
const characterInfo = document.getElementById('character-info');
const syncCharacterBtn = document.getElementById('sync-character-btn');
const openExtensionBtn = document.getElementById('open-extension-btn');
const linkExtensionBtn = document.getElementById('link-extension-btn');
const openChatWindowBtn = document.getElementById('open-chat-window-btn');

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

// ============== Owlbear SDK Initialization ==============

OBR.onReady(async () => {
  isOwlbearReady = true;
  console.log('🦉 Owlbear SDK ready');
  statusText.textContent = 'Connected to Owlbear Rodeo';

  // Set character sheet height to half viewport minus action bar
  // TODO: Make this dynamic based on actual viewport height
  // Currently using fixed 460px as workaround since window.innerHeight doesn't work in popovers
  const sheetHeight = 460;

  try {
    await OBR.popover.setHeight(sheetHeight);
  } catch (error) {
    console.error('Error setting popover height:', error);
  }

  // Check for active character
  checkForActiveCharacter();

  // Note: We don't auto-refresh character data because the local sheet state
  // is the source of truth during gameplay. Only sync when user explicitly requests it.
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
  // TODO: Save previous character's local state (HP, spell slots, etc.) before switching
  // so that it persists when switching back. Could use a Map keyed by character ID
  // or store in room metadata per character.

  currentCharacter = character;

  // Update UI
  characterSection.style.display = 'block';
  noCharacterSection.style.display = 'none';

  // Get portrait URL for use in multiple places
  // Portrait data is stored in rawDiceCloudData.creature
  console.log('🖼️ Checking for portrait in character data:');
  console.log('  character.picture:', character.picture);
  console.log('  character.avatarPicture:', character.avatarPicture);
  console.log('  character.rawDiceCloudData?.creature?.picture:', character.rawDiceCloudData?.creature?.picture);
  console.log('  character.rawDiceCloudData?.creature?.avatarPicture:', character.rawDiceCloudData?.creature?.avatarPicture);

  // Try top-level fields first, then check inside rawDiceCloudData.creature
  const portraitUrl = character.picture ||
                      character.avatarPicture ||
                      character.rawDiceCloudData?.creature?.picture ||
                      character.rawDiceCloudData?.creature?.avatarPicture;

  // Populate character info in Settings tab
  characterInfo.innerHTML = `
    <div style="display: flex; align-items: center; gap: 16px;">
      ${portraitUrl ? `<img src="${portraitUrl}" alt="Character Portrait" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid #8B5CF6; object-fit: cover; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);">` : ''}
      <div style="flex: 1;">
        <div class="character-name">${character.name || 'Unknown Character'}</div>
        <div class="character-detail">Level ${character.level || '?'} ${character.race || ''} ${character.class || ''}</div>
        <div class="character-detail">HP: ${character.hitPoints?.current || 0} / ${character.hitPoints?.max || 0}</div>
      </div>
    </div>
  `;

  // Update character header for other tabs
  const characterHeaderName = document.getElementById('character-header-name');
  const characterHeaderDetails = document.getElementById('character-header-details');
  const characterPortrait = document.getElementById('character-portrait');

  if (characterHeaderName && characterHeaderDetails) {
    characterHeaderName.textContent = character.name || 'Unknown Character';
    characterHeaderDetails.textContent = `Level ${character.level || '?'} ${character.race || ''} ${character.class || ''}`;
  }

  // Set character portrait if available
  if (characterPortrait) {
    if (portraitUrl) {
      characterPortrait.src = portraitUrl;
      characterPortrait.style.display = 'block';
      characterPortrait.style.cursor = 'grab';
      characterPortrait.title = 'Drag to map to create token';
      console.log('✅ Portrait loaded from:', portraitUrl);

      // Set up drag-and-drop to create token
      setupPortraitDrag(characterPortrait, character, portraitUrl);
    } else {
      characterPortrait.style.display = 'none';
      console.log('❌ No portrait found');
    }
  }

  // Populate other tabs
  populateStatsTab(character);
  populateAbilitiesTab(character);
  populateFeaturesTab(character);
  populateActionsTab(character);
  populateSpellsTab(character);
  populateInventoryTab(character);

  console.log('🎭 Displaying character:', character.name);
}

/**
 * Set up drag-and-drop for character portrait to create tokens
 */
function setupPortraitDrag(portraitElement, character, portraitUrl) {
  if (!isOwlbearReady) return;

  // Remove any existing drag listener
  portraitElement.ondragstart = null;
  portraitElement.onmousedown = null;

  // Make portrait draggable
  portraitElement.draggable = true;

  portraitElement.onmousedown = async () => {
    if (!isOwlbearReady) return;

    // Change cursor during drag
    portraitElement.style.cursor = 'grabbing';

    try {
      // Create token data
      const tokenData = [{
        height: 200,  // Default size in pixels (will scale to grid)
        width: 200,
        position: { x: 0, y: 0 },  // Will be set by drag position
        rotation: 0,
        layer: "CHARACTER",
        locked: false,
        visible: true,
        metadata: {
          owlcloud: {
            characterId: character.id,
            characterName: character.name,
            diceCloudId: character.diceCloudId
          }
        },
        name: character.name || 'Character',
        image: {
          url: portraitUrl,
          mime: 'image/png'
        },
        text: {
          plainText: character.name || 'Character',
          type: 'PLAIN'
        },
        attachedTo: undefined
      }];

      console.log('🎨 Starting token drag with data:', tokenData);

      // Start the drag operation
      await OBR.interaction.startItemDrag(tokenData);
    } catch (error) {
      console.error('❌ Error starting drag:', error);
    }
  };

  // Reset cursor when drag ends
  portraitElement.addEventListener('dragend', () => {
    portraitElement.style.cursor = 'grab';
  });

  portraitElement.addEventListener('mouseup', () => {
    portraitElement.style.cursor = 'grab';
  });
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
      <div class="stat-box" style="cursor: pointer;" onclick="adjustHP()" title="Click to adjust HP">
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

      <div class="stat-box" style="cursor: pointer;" onclick="rollInitiative(${initiative})" title="Click to roll initiative">
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
      <button class="rest-btn" onclick="rollDeathSave()" style="margin-top: 8px;">💀 Roll Death Save</button>
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
          <div class="slot-card ${current === 0 ? 'empty' : ''}" style="cursor: pointer;" onclick="adjustSpellSlot(${level})" title="Click to adjust spell slots">
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
        <div class="slot-card pact-magic ${pactCurrent === 0 ? 'empty' : ''}" style="cursor: pointer;" onclick="adjustSpellSlot(null, true)" title="Click to adjust pact magic slots">
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
          <div class="resource-card" style="cursor: pointer;" onclick="adjustResource('${resource.name.replace(/'/g, "\\'")}') " title="Click to adjust ${resource.name}">
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
      <button class="rest-btn" onclick="takeShortRest()">
        ⏸️ Short Rest
      </button>
      <button class="rest-btn" onclick="takeLongRest()">
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
    const abilityLabel = abilityShortNames[abilityName];

    html += `
      <div class="ability-box ${isProficient ? 'save-proficient' : ''}">
        <div style="padding: 8px; text-align: center;">
          <div class="ability-name">${abilityLabel}</div>
          <div class="ability-score" style="font-size: 18px; font-weight: bold;">${score}</div>
        </div>
        <div style="display: flex; border-top: 1px solid rgba(139, 92, 246, 0.3);">
          <div style="flex: 1; padding: 6px; cursor: pointer; text-align: center; border-right: 1px solid rgba(139, 92, 246, 0.3);" onclick="event.stopPropagation(); event.preventDefault(); rollAbilityCheck('${abilityLabel}', ${modifier})" title="Roll ${abilityLabel} check">
            <div style="font-size: 11px; color: #A78BFA; pointer-events: none;">Check</div>
            <div style="font-weight: bold; pointer-events: none;">${modifier >= 0 ? '+' : ''}${modifier}</div>
          </div>
          <div style="flex: 1; padding: 6px; cursor: pointer; text-align: center;" onclick="event.stopPropagation(); event.preventDefault(); rollSavingThrow('${abilityLabel}', ${saveMod})" title="Roll ${abilityLabel} save">
            <div style="font-size: 11px; color: ${isProficient ? '#10B981' : '#A78BFA'}; pointer-events: none;">Save</div>
            <div style="font-weight: bold; color: ${isProficient ? '#10B981' : 'inherit'}; pointer-events: none;">${saveMod >= 0 ? '+' : ''}${saveMod}</div>
          </div>
        </div>
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
        <div class="skill-item ${proficiencyClass}" onclick="rollSkillCheck('${skillName}', ${bonus})" title="Click to roll ${skillName}">
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
 * Populate Features & Traits tab
 */
function populateFeaturesTab(character) {
  const featuresContent = document.getElementById('features-content');

  let html = '';

  // Features & Traits Section
  if (character.features && character.features.length > 0) {
    // Filter out generic spellcasting features
    const filteredFeatures = character.features.filter(feature => {
      const name = (feature.name || '').toLowerCase();
      // Exclude generic spellcasting features
      return !name.match(/^spellcasting\s*\[/i) && name !== 'spellcasting';
    });

    if (filteredFeatures.length > 0) {
      html += '<div class="feature-list">';

      filteredFeatures.forEach((feature, index) => {
        const featureId = `feature-${index}`;

        // Infer resource usage from feature name
        let resourceName = null;
        const featureName = (feature.name || '').toLowerCase();
        if (featureName.includes('channel divinity')) {
          resourceName = 'Channel Divinity';
        } else if (featureName.includes('ki point') || featureName.includes('ki ')) {
          resourceName = 'Ki Points';
        } else if (featureName.includes('bardic inspiration')) {
          resourceName = 'Bardic Inspiration';
        } else if (featureName.includes('superiority')) {
          resourceName = 'Superiority Dice';
        } else if (featureName.includes('sorcery point')) {
          resourceName = 'Sorcery Points';
        }

        const useButtonHtml = resourceName ?
          `<button class="rest-btn" style="margin-top: 8px; width: 100%;" onclick="event.stopPropagation(); useFeature('${(feature.name || 'Feature').replace(/'/g, "\\'")}', '${resourceName}')">✨ Use</button>` : '';

        // Combine summary and description
        let featureText = '';
        if (feature.summary) {
          featureText += `<div class="feature-description">${feature.summary}</div>`;
        }
        if (feature.description) {
          featureText += `<div class="feature-description">${feature.description}</div>`;
        }

        html += `
          <div class="feature-card">
            <div class="feature-header" onclick="toggleFeatureCard('${featureId}')" style="cursor: pointer;">
              <div class="feature-name">${feature.name || 'Unknown Feature'}</div>
              <span class="expand-icon">▼</span>
            </div>
            <div id="${featureId}" class="feature-details">
              ${featureText}
              ${feature.source ? `<div class="feature-metadata"><div class="feature-meta-item"><span class="feature-meta-label">Source:</span> ${feature.source}</div></div>` : ''}
              ${useButtonHtml}
            </div>
          </div>
        `;
      });

      html += '</div>';
    } else {
      html = '<div class="empty-state">No features available</div>';
    }
  } else {
    html = '<div class="empty-state">No features available</div>';
  }

  featuresContent.innerHTML = html;
}

/**
 * Populate Actions & Attacks tab
 */
function populateActionsTab(character) {
  const actionsContent = document.getElementById('actions-content');

  let html = '';

  // Actions Section
  if (character.actions && character.actions.length > 0) {
    // Deduplicate and filter actions
    const deduplicatedActions = deduplicateActions(character.actions);

    html += '<div class="feature-list">';

    deduplicatedActions.forEach((action, index) => {
      const actionId = `action-${index}`;
      const actionType = action.actionType || 'Action';
      const damage = action.damage || '';
      const attackRoll = action.attackRoll || '';
      const uses = action.uses;

      // Parse attack bonus from attackRoll string (like "+5" or "1d20+5")
      let attackBonus = 0;
      if (attackRoll) {
        const bonusMatch = attackRoll.match(/[+-](\d+)/);
        if (bonusMatch) {
          attackBonus = parseInt(bonusMatch[0]);
        }
      }

      // Parse damage formula (like "1d8+3" or "2d6")
      let damageFormula = damage;

      // Create separate attack and damage buttons
      const hasAttack = attackRoll && attackRoll.trim();
      const hasDamage = damage && damage.trim();

      let rollButtonHtml = '';
      if (hasAttack || hasDamage) {
        rollButtonHtml = '<div style="display: flex; gap: 8px; margin-top: 8px;">';

        if (hasAttack) {
          rollButtonHtml += `<button class="rest-btn" style="flex: 1;" onclick="event.stopPropagation(); rollAttackOnly('${(action.name || 'Action').replace(/'/g, "\\'")}', ${attackBonus})">🎯 Attack</button>`;
        }

        if (hasDamage) {
          rollButtonHtml += `<button class="rest-btn" style="flex: 1;" onclick="event.stopPropagation(); rollDamageOnly('${(action.name || 'Action').replace(/'/g, "\\'")}', '${damageFormula}')">💥 Damage</button>`;
        }

        rollButtonHtml += '</div>';
      }

      // Add Use button if action has uses
      const useButtonHtml = (uses && uses.value !== undefined) ?
        `<button class="rest-btn" style="margin-top: 8px; width: 100%;" onclick="event.stopPropagation(); useAction('${(action.name || 'Action').replace(/'/g, "\\'")}')">✨ Use</button>` : '';

      const hasRollAction = hasAttack || hasDamage;

      // Determine full action type (e.g., "attack | action" or "utility | bonus action")
      const attackTypePrefix = hasRollAction ? 'attack' : 'utility';
      const fullActionType = `${attackTypePrefix} | ${actionType.toLowerCase()}`;

      // Combine summary and description
      let actionText = '';
      if (action.summary) {
        actionText += `<div class="feature-description">${action.summary}</div>`;
      }
      if (action.description) {
        actionText += `<div class="feature-description">${action.description}</div>`;
      }

      html += `
        <div class="feature-card">
          <div class="feature-header" onclick="toggleFeatureCard('${actionId}')" style="cursor: pointer;">
            <div class="feature-name">${action.name || 'Unknown Action'}</div>
            <span class="expand-icon">▼</span>
          </div>
          <div id="${actionId}" class="feature-details">
            <div class="feature-metadata">
              <div class="feature-meta-item"><span class="feature-meta-label">Type:</span> ${fullActionType}</div>
              ${attackRoll ? `<div class="feature-meta-item"><span class="feature-meta-label">Attack:</span> ${attackRoll}</div>` : ''}
              ${damage ? `<div class="feature-meta-item"><span class="feature-meta-label">Damage:</span> ${damage}</div>` : ''}
              ${uses && uses.value !== undefined ? `<div class="feature-meta-item"><span class="feature-meta-label">Uses:</span> ${uses.value}/${uses.max || uses.value}</div>` : ''}
            </div>
            ${actionText}
            ${rollButtonHtml}
            ${useButtonHtml}
          </div>
        </div>
      `;
    });

    html += '</div>';
  } else {
    html = '<div class="empty-state">No actions available</div>';
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

    spells.forEach((spell, spellIndex) => {
      const spellCardId = `spell-${index}-${spellIndex}`;
      const isConcentration = spell.concentration || false;
      const isRitual = spell.ritual || false;
      const castingTime = spell.castingTime || '';
      const range = spell.range || '';
      const components = spell.components || '';
      const duration = spell.duration || '';
      const spellLevel = parseInt(spell.level) || 0;
      const attackRoll = spell.attackRoll || spell.attack || '';
      const damage = spell.damage || '';
      const healing = spell.healing || '';

      // Parse attack bonus from attackRoll string
      let attackBonus = 0;
      if (attackRoll) {
        const bonusMatch = attackRoll.match(/[+-](\d+)/);
        if (bonusMatch) {
          attackBonus = parseInt(bonusMatch[0]);
        }
      }

      // Create spell buttons - always include Cast, plus Attack/Damage/Healing as needed
      let spellButtonsHtml = '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">';

      // Cast button (always present)
      spellButtonsHtml += `<button class="rest-btn" style="flex: 1; min-width: 100px;" onclick="event.stopPropagation(); castSpell('${(spell.name || 'Unknown Spell').replace(/'/g, "\\'")}', ${spellLevel})">✨ Cast</button>`;

      // Attack button (if spell has attack roll)
      if (attackRoll && attackRoll.trim()) {
        spellButtonsHtml += `<button class="rest-btn" style="flex: 1; min-width: 100px;" onclick="event.stopPropagation(); rollAttackOnly('${(spell.name || 'Unknown Spell').replace(/'/g, "\\'")}', ${attackBonus})">🎯 Attack</button>`;
      }

      // Detect if this is a healing spell by checking name and description
      const spellNameLower = (spell.name || '').toLowerCase();
      const spellTextLower = ((spell.summary || '') + ' ' + (spell.description || '')).toLowerCase();
      const isHealingSpell = spellNameLower.includes('cure') ||
                            spellNameLower.includes('heal') ||
                            spellNameLower.includes('restoration') ||
                            spellNameLower.includes('revivify') ||
                            spellNameLower.includes('regenerate') ||
                            spellTextLower.includes('regain') ||
                            spellTextLower.includes('regains') ||
                            spellTextLower.includes('restores') ||
                            (spellTextLower.includes('hit points') && !spellTextLower.includes('damage'));

      // Damage or Healing button (if spell has damage/healing formula)
      if (damage && damage.trim()) {
        if (isHealingSpell) {
          spellButtonsHtml += `<button class="rest-btn" style="flex: 1; min-width: 100px;" onclick="event.stopPropagation(); rollHealing('${(spell.name || 'Unknown Spell').replace(/'/g, "\\'")}', '${damage}')">💚 Healing</button>`;
        } else {
          spellButtonsHtml += `<button class="rest-btn" style="flex: 1; min-width: 100px;" onclick="event.stopPropagation(); rollDamageOnly('${(spell.name || 'Unknown Spell').replace(/'/g, "\\'")}', '${damage}')">💥 Damage</button>`;
        }
      }

      // Healing button (if spell has explicit healing field)
      if (healing && healing.trim()) {
        spellButtonsHtml += `<button class="rest-btn" style="flex: 1; min-width: 100px;" onclick="event.stopPropagation(); rollHealing('${(spell.name || 'Unknown Spell').replace(/'/g, "\\'")}', '${healing}')">💚 Healing</button>`;
      }

      spellButtonsHtml += '</div>';

      // Combine summary and description
      let spellText = '';
      if (spell.summary) {
        spellText += `<div class="spell-description">${spell.summary}</div>`;
      }
      if (spell.description) {
        spellText += `<div class="spell-description">${spell.description}</div>`;
      }

      html += `
        <div class="spell-card ${isConcentration ? 'concentration' : ''} ${isRitual ? 'ritual' : ''}">
          <div class="spell-card-header" onclick="toggleFeatureCard('${spellCardId}')" style="cursor: pointer;">
            <span class="spell-name">${spell.name || 'Unknown Spell'}</span>
            <div class="spell-badges">
              ${isConcentration ? '<span class="spell-concentration-badge">C</span>' : ''}
              ${isRitual ? '<span class="spell-ritual-badge">R</span>' : ''}
              <span class="expand-icon">▼</span>
            </div>
          </div>
          <div id="${spellCardId}" class="spell-details">
            <div class="feature-metadata">
              ${castingTime ? `<div class="feature-meta-item"><span class="feature-meta-label">Casting Time:</span> ${castingTime}</div>` : ''}
              ${range ? `<div class="feature-meta-item"><span class="feature-meta-label">Range:</span> ${range}</div>` : ''}
              ${components ? `<div class="feature-meta-item"><span class="feature-meta-label">Components:</span> ${components}</div>` : ''}
              ${duration ? `<div class="feature-meta-item"><span class="feature-meta-label">Duration:</span> ${duration}</div>` : ''}
              ${isConcentration ? '<div class="feature-meta-item"><span class="feature-meta-label">Concentration:</span> Yes</div>' : ''}
              ${isRitual ? '<div class="feature-meta-item"><span class="feature-meta-label">Ritual:</span> Yes</div>' : ''}
              ${attackRoll ? `<div class="feature-meta-item"><span class="feature-meta-label">Attack:</span> ${attackRoll}</div>` : ''}
              ${damage ? `<div class="feature-meta-item"><span class="feature-meta-label">Damage:</span> ${damage}</div>` : ''}
              ${healing ? `<div class="feature-meta-item"><span class="feature-meta-label">Healing:</span> ${healing}</div>` : ''}
            </div>
            ${spellText}
            ${spellButtonsHtml}
          </div>
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
 * Toggle chat window
 */
let isChatOpen = false;

openChatWindowBtn.addEventListener('click', async () => {
  if (!isOwlbearReady) {
    alert('Owlbear SDK not ready. Please wait a moment and try again.');
    return;
  }

  if (isChatOpen) {
    // Close the chat window
    await OBR.popover.close('com.owlcloud.chat');
    isChatOpen = false;
    openChatWindowBtn.textContent = '💬 Open Chat Window';
  } else {
    // Set chat height to match sheet height (half viewport minus action bar)
    // TODO: Make this dynamic based on actual viewport height
    // Currently using fixed 460px as workaround since window.innerHeight doesn't work in popovers
    const chatHeight = 460;

    // Open chat as a persistent popover at bottom-left
    await OBR.popover.open({
      id: 'com.owlcloud.chat',
      url: '/extension/chat.html',
      height: chatHeight,
      width: 400,
      anchorOrigin: { horizontal: 'LEFT', vertical: 'BOTTOM' },
      transformOrigin: { horizontal: 'LEFT', vertical: 'BOTTOM' },
      disableClickAway: true
    });
    isChatOpen = true;
    openChatWindowBtn.textContent = '💬 Close Chat Window';
  }
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

// ============== Chat Integration ==============

/**
 * Send message to chat window via OBR metadata
 */
async function sendToChatWindow(type, data) {
  if (!isOwlbearReady || !currentCharacter) return;

  try {
    const message = {
      type: type,
      data: data,
      character: {
        name: currentCharacter.name,
        id: currentCharacter.id
      },
      timestamp: Date.now()
    };

    // Store in room metadata for chat window to pick up
    await OBR.room.setMetadata({
      'com.owlcloud.chat/latest-message': message
    });
  } catch (error) {
    console.error('Error sending to chat:', error);
  }
}

/**
 * Add a message to the shared chat history
 * This adds messages to the persistent chat that all players can see
 * @param {string} text - Message text
 * @param {string} type - Message type: 'system', 'roll', 'action', 'spell', 'combat', 'user'
 * @param {string} author - Message author (optional)
 */
async function addChatMessage(text, type = 'system', author = null, details = null) {
  if (!isOwlbearReady) return;

  try {
    const playerId = await OBR.player.getId();
    const metadata = await OBR.room.getMetadata();
    const messages = metadata['com.owlcloud.chat/messages'] || [];

    const newMessage = {
      id: Date.now() + Math.random(),
      text: text,
      type: type,
      author: author || (currentCharacter ? currentCharacter.name : 'Character'),
      playerId: playerId,
      timestamp: Date.now(),
      details: details // Optional expandable details
    };

    // Keep last 100 messages
    const updatedMessages = [...messages, newMessage].slice(-100);

    await OBR.room.setMetadata({
      'com.owlcloud.chat/messages': updatedMessages
    });

    console.log('📨 Chat message added:', text);
  } catch (error) {
    console.error('Error adding chat message:', error);
  }
}

// ============== Dice Rolling System ==============

/**
 * Roll dice and return result
 * @param {string} formula - Dice formula like "1d20+5" or "2d6"
 * @returns {object} - {total, rolls, formula}
 */
/**
 * Set roll mode (advantage, normal, disadvantage)
 */
window.setRollMode = function(mode) {
  rollMode = mode;

  // Update button active states
  document.querySelectorAll('.roll-mode-btn').forEach(btn => btn.classList.remove('active'));
  if (mode === 'advantage') {
    document.getElementById('roll-advantage-btn')?.classList.add('active');
  } else if (mode === 'disadvantage') {
    document.getElementById('roll-disadvantage-btn')?.classList.add('active');
  } else {
    document.getElementById('roll-normal-btn')?.classList.add('active');
  }
};

/**
 * Roll a d20 with advantage/disadvantage based on current roll mode
 */
function rollD20() {
  if (rollMode === 'advantage') {
    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;
    const total = Math.max(roll1, roll2);
    return {total, rolls: [roll1, roll2], modifier: 0, formula: '2d20 (advantage)', count: 2, sides: 20, mode: 'advantage'};
  } else if (rollMode === 'disadvantage') {
    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;
    const total = Math.min(roll1, roll2);
    return {total, rolls: [roll1, roll2], modifier: 0, formula: '2d20 (disadvantage)', count: 2, sides: 20, mode: 'disadvantage'};
  } else {
    const roll = Math.floor(Math.random() * 20) + 1;
    return {total: roll, rolls: [roll], modifier: 0, formula: '1d20', count: 1, sides: 20, mode: 'normal'};
  }
}

function rollDice(formula) {
  // Parse formula like "2d6+3" or "1d20"
  const match = formula.match(/(\d+)?d(\d+)([+-]\d+)?/i);
  if (!match) {
    console.error('Invalid dice formula:', formula);
    return {total: 0, rolls: [], formula};
  }

  const count = parseInt(match[1] || '1');
  const sides = parseInt(match[2]);
  const modifier = parseInt(match[3] || '0');

  const rolls = [];
  let total = modifier;

  for (let i = 0; i < count; i++) {
    const roll = Math.floor(Math.random() * sides) + 1;
    rolls.push(roll);
    total += roll;
  }

  return {total, rolls, modifier, formula, count, sides};
}

/**
 * Show roll result notification and send to chat
 */
async function showRollResult(name, result) {
  let detailsHtml = '';
  const finalTotal = result.modifier !== undefined ? result.total : result.total;

  // Build detailed breakdown for expandable section
  if (result.mode === 'advantage' && result.rolls.length === 2) {
    detailsHtml = `<strong>Advantage:</strong> Rolled 2d20, taking higher<br>
                   Roll 1: ${result.rolls[0]}<br>
                   Roll 2: ${result.rolls[1]}<br>
                   <strong>Selected:</strong> ${result.total}`;
    if (result.modifier !== 0) {
      detailsHtml += `<br><strong>Modifier:</strong> ${result.modifier >= 0 ? '+' : ''}${result.modifier}`;
    }
    detailsHtml += `<br><strong>Formula:</strong> ${result.total}`;
    if (result.modifier !== 0) {
      detailsHtml += ` ${result.modifier >= 0 ? '+' : ''}${result.modifier}`;
    }
    detailsHtml += ` = ${finalTotal}`;
  } else if (result.mode === 'disadvantage' && result.rolls.length === 2) {
    detailsHtml = `<strong>Disadvantage:</strong> Rolled 2d20, taking lower<br>
                   Roll 1: ${result.rolls[0]}<br>
                   Roll 2: ${result.rolls[1]}<br>
                   <strong>Selected:</strong> ${result.total}`;
    if (result.modifier !== 0) {
      detailsHtml += `<br><strong>Modifier:</strong> ${result.modifier >= 0 ? '+' : ''}${result.modifier}`;
    }
    detailsHtml += `<br><strong>Formula:</strong> ${result.total}`;
    if (result.modifier !== 0) {
      detailsHtml += ` ${result.modifier >= 0 ? '+' : ''}${result.modifier}`;
    }
    detailsHtml += ` = ${finalTotal}`;
  } else {
    // Normal roll details
    detailsHtml = `<strong>Roll:</strong> 1d20 = ${result.rolls[0]}`;
    if (result.modifier !== 0) {
      detailsHtml += `<br><strong>Modifier:</strong> ${result.modifier >= 0 ? '+' : ''}${result.modifier}`;
    }
    detailsHtml += `<br><strong>Formula:</strong> ${result.rolls[0]}`;
    if (result.modifier !== 0) {
      detailsHtml += ` ${result.modifier >= 0 ? '+' : ''}${result.modifier}`;
    }
    detailsHtml += ` = ${finalTotal}`;
  }

  // Create concise message showing just the result
  const modText = result.modifier !== 0 ? ` (${result.modifier >= 0 ? '+' : ''}${result.modifier})` : '';
  const message = `${name}${modText}: <strong>${finalTotal}</strong>`;

  if (isOwlbearReady) {
    OBR.notification.show(`${currentCharacter?.name || 'Character'}: ${name} = ${finalTotal}`, 'INFO');
  }
  console.log('🎲', message);

  // Send to persistent chat with expandable details
  await addChatMessage(message, 'roll', currentCharacter?.name, detailsHtml);
}

/**
 * Roll ability check
 */
window.rollAbilityCheck = async function(abilityName, modifier) {
  console.log('🎲 rollAbilityCheck called:', abilityName, modifier);
  const result = rollD20();
  const total = result.total + modifier;
  await showRollResult(`${abilityName} Check (${modifier >= 0 ? '+' : ''}${modifier})`, {...result, total, modifier});
};

/**
 * Roll saving throw
 */
window.rollSavingThrow = async function(abilityName, modifier) {
  console.log('🎲 rollSavingThrow called:', abilityName, modifier);
  console.trace('Call stack');
  const result = rollD20();
  const total = result.total + modifier;
  await showRollResult(`${abilityName} Save (${modifier >= 0 ? '+' : ''}${modifier})`, {...result, total, modifier});
};

/**
 * Roll skill check
 */
window.rollSkillCheck = async function(skillName, bonus) {
  const result = rollD20();
  const total = result.total + bonus;
  await showRollResult(`${skillName} (${bonus >= 0 ? '+' : ''}${bonus})`, {...result, total, modifier: bonus});
};

/**
 * Roll initiative
 */
window.rollInitiative = async function(initiativeBonus) {
  const result = rollD20();
  const total = result.total + initiativeBonus;
  await showRollResult(`Initiative (${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus})`, {...result, total, modifier: initiativeBonus});
};

/**
 * Roll death save
 */
window.rollDeathSave = async function() {
  if (!currentCharacter) return;

  const result = rollDice('1d20');
  const roll = result.total;

  let message = '';
  let messageType = 'combat';

  if (roll === 20) {
    message = `💀 Death Save: <strong>20 (Natural 20!)</strong> - Regain 1 HP!`;
    // Automatically heal 1 HP on nat 20
    if (!currentCharacter.hitPoints) {
      currentCharacter.hitPoints = { current: 0, max: 0 };
    }
    currentCharacter.hitPoints.current = 1;
    populateStatsTab(currentCharacter);
  } else if (roll === 1) {
    message = `💀 Death Save: <strong>1 (Natural 1!)</strong> - Two failures!`;
  } else if (roll >= 10) {
    message = `💀 Death Save: <strong>${roll}</strong> - Success`;
  } else {
    message = `💀 Death Save: <strong>${roll}</strong> - Failure`;
  }

  if (isOwlbearReady) {
    OBR.notification.show(`${currentCharacter.name}: Death Save = ${roll}`, roll >= 10 ? 'SUCCESS' : 'ERROR');
  }
  console.log('💀', message);

  // Send to persistent chat
  await addChatMessage(message, messageType, currentCharacter.name);
};

/**
 * Roll attack only (no damage)
 */
window.rollAttackOnly = async function(actionName, attackBonus) {
  const attackRoll = rollD20();
  const attackTotal = attackRoll.total + (attackBonus || 0);

  // Create concise message
  const bonusText = attackBonus ? ` (+${attackBonus})` : '';
  const message = `${actionName} Attack${bonusText}: <strong>${attackTotal}</strong>`;

  // Build details for expandable view
  let detailsHtml = '';
  if (attackRoll.mode === 'advantage' && attackRoll.rolls.length === 2) {
    detailsHtml = `<strong>Advantage:</strong> Rolled 2d20, taking higher<br>
                   Roll 1: ${attackRoll.rolls[0]}<br>
                   Roll 2: ${attackRoll.rolls[1]}<br>
                   <strong>Selected:</strong> ${attackRoll.total}`;
  } else if (attackRoll.mode === 'disadvantage' && attackRoll.rolls.length === 2) {
    detailsHtml = `<strong>Disadvantage:</strong> Rolled 2d20, taking lower<br>
                   Roll 1: ${attackRoll.rolls[0]}<br>
                   Roll 2: ${attackRoll.rolls[1]}<br>
                   <strong>Selected:</strong> ${attackRoll.total}`;
  } else {
    detailsHtml = `<strong>Attack Roll:</strong> 1d20 = ${attackRoll.rolls[0]}`;
  }
  if (attackBonus) {
    detailsHtml += `<br><strong>Attack Bonus:</strong> +${attackBonus}`;
  }
  detailsHtml += `<br><strong>Formula:</strong> ${attackRoll.total}`;
  if (attackBonus) {
    detailsHtml += ` + ${attackBonus}`;
  }
  detailsHtml += ` = ${attackTotal}`;

  if (isOwlbearReady) {
    OBR.notification.show(`${currentCharacter?.name || 'Character'}: ${actionName} Attack = ${attackTotal}`, 'INFO');
  }
  console.log('⚔️', message);

  // Send to persistent chat with details
  await addChatMessage(message, 'action', currentCharacter?.name, detailsHtml);
};

/**
 * Roll damage only (no attack)
 */
window.rollDamageOnly = async function(actionName, damageFormula) {
  if (!damageFormula || !damageFormula.trim()) return;

  const damageRoll = rollDice(damageFormula);

  // Create concise message
  const message = `${actionName} Damage: <strong>${damageRoll.total}</strong>`;

  // Build details for expandable view
  let detailsHtml = `<strong>Formula:</strong> ${damageFormula}<br>
                     <strong>Rolls:</strong> ${damageRoll.rolls.join(', ')}`;
  if (damageRoll.modifier) {
    detailsHtml += `<br>Modifier: ${damageRoll.modifier >= 0 ? '+' : ''}${damageRoll.modifier}`;
  }
  detailsHtml += `<br>Calculation: ${damageRoll.rolls.join(' + ')}`;
  if (damageRoll.modifier) {
    detailsHtml += ` ${damageRoll.modifier >= 0 ? '+' : ''}${damageRoll.modifier}`;
  }
  detailsHtml += ` = ${damageRoll.total}`;

  if (isOwlbearReady) {
    OBR.notification.show(`${currentCharacter?.name || 'Character'}: ${actionName} Damage = ${damageRoll.total}`, 'INFO');
  }
  console.log('⚔️', message);

  // Send to persistent chat with details
  await addChatMessage(message, 'damage', currentCharacter?.name, detailsHtml);
};

/**
 * Roll healing
 */
window.rollHealing = async function(spellName, healingFormula) {
  if (!healingFormula || !healingFormula.trim()) return;

  const healingRoll = rollDice(healingFormula);

  // Create concise message
  const message = `${spellName} Healing: <strong>${healingRoll.total}</strong>`;

  // Build details for expandable view
  let detailsHtml = `<strong>Formula:</strong> ${healingFormula}<br>
                     <strong>Rolls:</strong> ${healingRoll.rolls.join(', ')}`;
  if (healingRoll.modifier) {
    detailsHtml += `<br>Modifier: ${healingRoll.modifier >= 0 ? '+' : ''}${healingRoll.modifier}`;
  }
  detailsHtml += `<br>Calculation: ${healingRoll.rolls.join(' + ')}`;
  if (healingRoll.modifier) {
    detailsHtml += ` ${healingRoll.modifier >= 0 ? '+' : ''}${healingRoll.modifier}`;
  }
  detailsHtml += ` = ${healingRoll.total}`;

  if (isOwlbearReady) {
    OBR.notification.show(`${currentCharacter?.name || 'Character'}: ${spellName} Healing = ${healingRoll.total}`, 'INFO');
  }
  console.log('💚', message);

  // Send to persistent chat with details (using 'healing' type for green color)
  await addChatMessage(message, 'healing', currentCharacter?.name, detailsHtml);
};

/**
 * Roll attack (kept for backwards compatibility, calls both)
 */
window.rollAttack = async function(actionName, attackBonus, damageFormula) {
  await rollAttackOnly(actionName, attackBonus);
  if (damageFormula && damageFormula.trim()) {
    await rollDamageOnly(actionName, damageFormula);
  }
};

// ============== Spell Casting ==============

/**
 * Cast a spell
 */
window.castSpell = async function(spellName, level) {
  if (!currentCharacter) return;

  // Cantrips don't use spell slots
  if (level > 0) {
    if (!currentCharacter.spellSlots) {
      console.warn('No spell slots available on character');
      return;
    }

    const slotKey = `level${level}SpellSlots`;
    const current = currentCharacter.spellSlots[slotKey] || 0;

    if (current === 0) {
      if (isOwlbearReady) {
        OBR.notification.show(`No Level ${level} spell slots remaining!`, 'ERROR');
      }
      return;
    }

    // Decrement spell slot
    currentCharacter.spellSlots[slotKey] = current - 1;
    populateStatsTab(currentCharacter);
  }

  const levelText = level === 0 ? 'Cantrip' : `Level ${level} Spell`;
  const message = `✨ Casts <strong>${spellName}</strong> (${levelText})`;

  // Create expandable details
  let details = `<strong>${spellName}</strong><br>${levelText}`;
  if (level > 0 && slotKey) {
    const remaining = currentCharacter.spellSlots[slotKey] || 0;
    details += `<br>Spell Slot Used: Level ${level}<br>Remaining Slots: ${remaining}`;
  }

  if (isOwlbearReady) {
    OBR.notification.show(`${currentCharacter?.name || 'Character'} casts ${spellName}`, 'INFO');
  }
  console.log('✨', message);

  // Send to persistent chat with details
  await addChatMessage(message, 'spell', currentCharacter?.name, details);
};

// ============== HP & Resource Management ==============

/**
 * Adjust HP
 */
window.adjustHP = async function() {
  if (!currentCharacter) return;

  console.log('🩺 adjustHP called, current character:', currentCharacter.name);
  console.log('  Current HP object:', currentCharacter.hitPoints);

  const currentHP = currentCharacter.hitPoints?.current || 0;
  const maxHP = currentCharacter.hitPoints?.max || 0;

  const adjustment = prompt(`Current HP: ${currentHP}/${maxHP}\n\nEnter HP adjustment (negative for damage, positive for healing):`);
  if (adjustment === null) return;

  const amount = parseInt(adjustment);
  if (isNaN(amount)) return;

  const newHP = Math.max(0, Math.min(maxHP, currentHP + amount));

  console.log(`  Adjustment: ${amount}, New HP: ${newHP}/${maxHP}`);

  // Ensure hitPoints object exists
  if (!currentCharacter.hitPoints) {
    currentCharacter.hitPoints = { current: 0, max: 0 };
  }

  // Update character data
  currentCharacter.hitPoints.current = newHP;
  console.log('  Updated currentCharacter.hitPoints:', currentCharacter.hitPoints);

  // Show notification
  const message = amount > 0
    ? `${currentCharacter.name} heals ${amount} HP (${newHP}/${maxHP})`
    : `${currentCharacter.name} takes ${Math.abs(amount)} damage (${newHP}/${maxHP})`;

  if (isOwlbearReady) {
    OBR.notification.show(message, amount > 0 ? 'SUCCESS' : 'WARNING');
  }

  // Send message to chat (use different type for healing vs damage)
  const messageType = amount > 0 ? 'healing' : 'damage';
  console.log('  Sending message to chat:', message);
  await addChatMessage(message, messageType, currentCharacter.name);

  // Re-render stats tab
  console.log('  Re-rendering stats tab with currentCharacter:', currentCharacter.hitPoints);
  populateStatsTab(currentCharacter);

  // Note: HP changes are kept local during gameplay. They persist in the extension state
  // until the user syncs the character or switches characters. This avoids constantly
  // hitting Supabase for every stat change during play.
};

/**
 * Adjust spell slot count
 */
window.adjustSpellSlot = function(level, isPactMagic = false) {
  if (!currentCharacter || !currentCharacter.spellSlots) return;

  const slotKey = isPactMagic ? 'pactMagicSlots' : `level${level}SpellSlots`;
  const maxKey = isPactMagic ? 'pactMagicSlotsMax' : `level${level}SpellSlotsMax`;
  const current = currentCharacter.spellSlots[slotKey] || 0;
  const max = currentCharacter.spellSlots[maxKey] || 0;

  const slotName = isPactMagic ? `Pact Magic` : `Level ${level} Spell Slot`;
  const adjustment = prompt(`${slotName}: ${current}/${max}\n\nEnter adjustment (negative to use, positive to restore):`);
  if (adjustment === null) return;

  const amount = parseInt(adjustment);
  if (isNaN(amount)) return;

  const newCount = Math.max(0, Math.min(max, current + amount));
  currentCharacter.spellSlots[slotKey] = newCount;

  // Re-render stats tab
  populateStatsTab(currentCharacter);

  if (isOwlbearReady) {
    const message = amount > 0 ? `Restored ${amount} ${slotName}` : `Used ${Math.abs(amount)} ${slotName}`;
    OBR.notification.show(message, 'INFO');
  }
};

/**
 * Adjust class resource (like Channel Divinity, Ki Points, etc.)
 */
window.adjustResource = function(resourceName) {
  if (!currentCharacter || !currentCharacter.resources) return;

  const resource = currentCharacter.resources.find(r => r.name === resourceName);
  if (!resource) return;

  const current = resource.current || 0;
  const max = resource.max || 0;

  const adjustment = prompt(`${resourceName}: ${current}/${max}\n\nEnter adjustment (negative to use, positive to restore):`);
  if (adjustment === null) return;

  const amount = parseInt(adjustment);
  if (isNaN(amount)) return;

  const newCount = Math.max(0, Math.min(max, current + amount));
  resource.current = newCount;

  // Re-render stats tab
  populateStatsTab(currentCharacter);

  if (isOwlbearReady) {
    const message = amount > 0 ? `Restored ${amount} ${resourceName}` : `Used ${Math.abs(amount)} ${resourceName}`;
    OBR.notification.show(message, 'INFO');
  }
};

/**
 * Use a feature or action (decrements uses or associated resource and announces in chat)
 */
window.useFeature = async function(featureName, resourceName = null) {
  if (!currentCharacter) return;

  // If it has an associated resource, decrement it
  if (resourceName && currentCharacter.resources) {
    const resource = currentCharacter.resources.find(r => r.name === resourceName);
    if (resource && resource.current > 0) {
      resource.current -= 1;
      populateStatsTab(currentCharacter);
    } else if (resource && resource.current === 0) {
      if (isOwlbearReady) {
        OBR.notification.show(`No ${resourceName} remaining!`, 'ERROR');
      }
      return;
    }
  }

  // Announce in chat
  const message = `✨ Uses <strong>${featureName}</strong>${resourceName ? ` (${resourceName})` : ''}`;
  await addChatMessage(message, 'action', currentCharacter.name);

  if (isOwlbearReady) {
    OBR.notification.show(`${currentCharacter.name} uses ${featureName}`, 'INFO');
  }
};

/**
 * Use an action that has limited uses
 */
window.useAction = async function(actionName) {
  if (!currentCharacter || !currentCharacter.actions) return;

  // Find the action by name
  const action = currentCharacter.actions.find(a => a.name === actionName);
  if (!action) {
    console.warn(`Action "${actionName}" not found`);
    return;
  }

  // Check if action has uses
  if (!action.uses || action.uses.value === undefined) {
    console.warn(`Action "${actionName}" has no uses tracking`);
    return;
  }

  // Check if uses remaining
  if (action.uses.value <= 0) {
    if (isOwlbearReady) {
      OBR.notification.show(`No uses of ${actionName} remaining!`, 'ERROR');
    }
    return;
  }

  // Decrement uses
  action.uses.value -= 1;

  // Refresh the actions tab to show updated uses
  populateActionsTab(currentCharacter);

  // Announce in chat
  const message = `✨ Uses <strong>${actionName}</strong> (${action.uses.value}/${action.uses.max || action.uses.value + 1} remaining)`;
  await addChatMessage(message, 'action', currentCharacter.name);

  if (isOwlbearReady) {
    OBR.notification.show(`${currentCharacter.name} uses ${actionName}`, 'INFO');
  }
};

// ============== Rest System ==============

/**
 * Take a short rest
 */
window.takeShortRest = async function() {
  if (!currentCharacter) return;

  const confirm = window.confirm(
    'Take a Short Rest?\n\n' +
    '• Spend Hit Dice to recover HP\n' +
    '• Recover some class resources\n' +
    '• Takes 1 hour'
  );

  if (!confirm) return;

  // Allow spending hit dice
  const hitDice = currentCharacter.hitDice;
  if (hitDice && hitDice.current > 0) {
    const spend = window.prompt(`You have ${hitDice.current}/${hitDice.max} Hit Dice (d${hitDice.type})\n\nHow many do you want to spend?`);
    if (spend) {
      const count = Math.min(parseInt(spend) || 0, hitDice.current);
      if (count > 0) {
        let totalHealing = 0;
        for (let i = 0; i < count; i++) {
          const roll = Math.floor(Math.random() * (hitDice.type)) + 1;
          const conMod = currentCharacter.attributeMods?.constitution || 0;
          totalHealing += roll + conMod;
        }

        const currentHP = currentCharacter.hitPoints?.current || 0;
        const maxHP = currentCharacter.hitPoints?.max || 0;
        const newHP = Math.min(maxHP, currentHP + totalHealing);

        currentCharacter.hitPoints.current = newHP;
        currentCharacter.hitDice.current -= count;

        if (isOwlbearReady) {
          OBR.notification.show(`Short Rest: Spent ${count} Hit Dice, recovered ${totalHealing} HP`, 'SUCCESS');
        }
      }
    }
  }

  // Refresh tabs
  populateStatsTab(currentCharacter);

  // TODO: Recover short rest resources
  // TODO: Save to Supabase
};

/**
 * Take a long rest
 */
window.takeLongRest = async function() {
  if (!currentCharacter) return;

  const confirm = window.confirm(
    'Take a Long Rest?\n\n' +
    '• Recover all HP\n' +
    '• Recover all spell slots\n' +
    '• Recover half of total Hit Dice\n' +
    '• Recover all resources\n' +
    '• Takes 8 hours'
  );

  if (!confirm) return;

  // Recover HP to max
  const maxHP = currentCharacter.hitPoints?.max || 0;
  currentCharacter.hitPoints.current = maxHP;

  // Recover spell slots
  if (currentCharacter.spellSlots) {
    for (let level = 1; level <= 9; level++) {
      const maxKey = `level${level}SpellSlotsMax`;
      const currentKey = `level${level}SpellSlots`;
      if (currentCharacter.spellSlots[maxKey]) {
        currentCharacter.spellSlots[currentKey] = currentCharacter.spellSlots[maxKey];
      }
    }
    // Pact magic
    if (currentCharacter.spellSlots.pactMagicSlotsMax) {
      currentCharacter.spellSlots.pactMagicSlots = currentCharacter.spellSlots.pactMagicSlotsMax;
    }
  }

  // Recover hit dice (half of total)
  if (currentCharacter.hitDice) {
    const recovered = Math.max(1, Math.floor(currentCharacter.hitDice.max / 2));
    currentCharacter.hitDice.current = Math.min(
      currentCharacter.hitDice.max,
      currentCharacter.hitDice.current + recovered
    );
  }

  // Recover resources
  if (currentCharacter.resources) {
    currentCharacter.resources.forEach(resource => {
      resource.current = resource.max;
    });
  }

  if (isOwlbearReady) {
    OBR.notification.show(`Long Rest: ${currentCharacter.name} is fully rested!`, 'SUCCESS');
  }

  // Refresh tabs
  populateStatsTab(currentCharacter);

  // TODO: Save to Supabase
};

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

/**
 * Toggle expansion of a feature/action/spell card
 */
window.toggleFeatureCard = function(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;

  // Find the parent card element
  const parentCard = card.parentElement;
  if (parentCard) {
    parentCard.classList.toggle('expanded');
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

console.log('🎲 OwlCloud popover initialized');
