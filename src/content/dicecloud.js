/**
 * Dice Cloud Content Script
 * Extracts character data from Dice Cloud using the REST API
 */

(function() {
  'use strict';

  console.log('RollCloud: DiceCloud content script loaded');

  // DiceCloud API endpoint
  const API_BASE = 'https://dicecloud.com/api';

  // Standardized DiceCloud variable names
  const STANDARD_VARS = {
    abilities: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
    abilityMods: ['strengthMod', 'dexterityMod', 'constitutionMod', 'intelligenceMod', 'wisdomMod', 'charismaMod'],
    saves: ['strengthSave', 'dexteritySave', 'constitutionSave', 'intelligenceSave', 'wisdomSave', 'charismaSave'],
    skills: [
      'acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history',
      'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception',
      'performance', 'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival'
    ],
    combat: ['armorClass', 'hitPoints', 'speed', 'initiative', 'proficiencyBonus']
  };

  /**
   * Extracts character ID from the current URL
   */
  function getCharacterIdFromUrl() {
    const match = window.location.pathname.match(/\/character\/([^/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Fetches character data from DiceCloud API
   */
  async function fetchCharacterDataFromAPI() {
    const characterId = getCharacterIdFromUrl();

    if (!characterId) {
      throw new Error('Not on a character page. Navigate to a character sheet first.');
    }

    // Get stored API token from background script
    const tokenResponse = await chrome.runtime.sendMessage({ action: 'getApiToken' });

    if (!tokenResponse.success || !tokenResponse.token) {
      throw new Error('Not logged in to DiceCloud. Please login via the extension popup.');
    }

    console.log('Fetching character data for ID:', characterId);

    // Fetch character data from API
    const response = await fetch(`${API_BASE}/creature/${characterId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenResponse.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API token expired. Please login again via the extension popup.');
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Received API data:', data);

    return parseCharacterData(data);
  }

  /**
   * Parses API response into structured character data
   */
  function parseCharacterData(apiData) {
    const creature = apiData.creatures[0];
    const variables = apiData.creatureVariables[0] || {};
    const properties = apiData.creatureProperties || [];

    const characterData = {
      name: creature.name || '',
      race: '',
      class: '',
      level: 0,
      background: '',
      alignment: creature.alignment || '',
      attributes: {},
      attributeMods: {},
      saves: {},
      skills: {},
      features: [],
      spells: [],
      inventory: [],
      proficiencies: [],
      hitPoints: {
        current: variables.hitPoints?.value || 0,
        max: variables.hitPoints?.total || 0
      },
      armorClass: variables.armorClass?.value || 10,
      speed: variables.speed?.value || 30,
      initiative: variables.initiative?.value || 0,
      proficiencyBonus: variables.proficiencyBonus?.value || 0,
      kingdom: {},
      army: {},
      otherVariables: {}
    };

    // Extract ability scores
    STANDARD_VARS.abilities.forEach(ability => {
      if (variables[ability]) {
        characterData.attributes[ability] = variables[ability].value || 10;
      }
    });

    // Extract ability modifiers
    STANDARD_VARS.abilityMods.forEach(mod => {
      if (variables[mod]) {
        const abilityName = mod.replace('Mod', '');
        characterData.attributeMods[abilityName] = variables[mod].value || 0;
      }
    });

    // Extract saves
    STANDARD_VARS.saves.forEach(save => {
      if (variables[save]) {
        const abilityName = save.replace('Save', '');
        characterData.saves[abilityName] = variables[save].value || 0;
      }
    });

    // Extract skills
    STANDARD_VARS.skills.forEach(skill => {
      if (variables[skill]) {
        characterData.skills[skill] = variables[skill].value || 0;
      }
    });

    // Extract ALL kingdom attributes (Pathfinder Kingmaker / Kingdom Builder)
    const kingdomSkills = [
      'agriculture', 'arts', 'boating', 'defense', 'engineering', 'exploration',
      'folklore', 'industry', 'intrigue', 'magic', 'politics', 'scholarship',
      'statecraft', 'trade', 'warfare', 'wilderness'
    ];

    kingdomSkills.forEach(skill => {
      // Base skill value (e.g., kingdomAgriculture)
      const skillVar = `kingdom${skill.charAt(0).toUpperCase() + skill.slice(1)}`;
      if (variables[skillVar]) {
        characterData.kingdom[skill] = variables[skillVar].value || 0;
      }

      // Proficiency total (e.g., kingdomAgricultureProficiencyTotal)
      const profVar = `${skillVar}ProficiencyTotal`;
      if (variables[profVar]) {
        characterData.kingdom[`${skill}_proficiency_total`] = variables[profVar].value || 0;
      }
    });

    // Extract economy/culture/loyalty/stability (kingdom core stats)
    const kingdomCoreStats = ['culture', 'economy', 'loyalty', 'stability'];
    kingdomCoreStats.forEach(stat => {
      const statVar = `kingdom${stat.charAt(0).toUpperCase() + stat.slice(1)}`;
      if (variables[statVar]) {
        characterData.kingdom[stat] = variables[statVar].value || 0;
      }
    });

    // Extract army attributes
    const armySkills = ['scouting', 'maneuver', 'morale', 'ranged'];
    armySkills.forEach(skill => {
      const skillVar = `army${skill.charAt(0).toUpperCase() + skill.slice(1)}`;
      if (variables[skillVar]) {
        characterData.army[skill] = variables[skillVar].value || 0;
      }
    });

    // Extract other useful variables
    if (variables.heroPoints) {
      characterData.otherVariables.hero_points = variables.heroPoints.value || 0;
    }

    // Extract ALL remaining variables (catch-all for anything we haven't specifically extracted)
    const knownVars = new Set([
      ...STANDARD_VARS.abilities,
      ...STANDARD_VARS.abilityMods,
      ...STANDARD_VARS.saves,
      ...STANDARD_VARS.skills,
      'armorClass', 'hitPoints', 'speed', 'initiative', 'proficiencyBonus', 'heroPoints',
      '_id', '_creatureId' // Skip internal MongoDB fields
    ]);

    // Also skip kingdom/army vars we already extracted
    kingdomSkills.forEach(skill => {
      knownVars.add(`kingdom${skill.charAt(0).toUpperCase() + skill.slice(1)}`);
      knownVars.add(`kingdom${skill.charAt(0).toUpperCase() + skill.slice(1)}ProficiencyTotal`);
    });
    kingdomCoreStats.forEach(stat => {
      knownVars.add(`kingdom${stat.charAt(0).toUpperCase() + stat.slice(1)}`);
    });
    armySkills.forEach(skill => {
      knownVars.add(`army${skill.charAt(0).toUpperCase() + skill.slice(1)}`);
    });

    // Extract everything else
    Object.keys(variables).forEach(varName => {
      if (!knownVars.has(varName) && !varName.startsWith('_')) {
        const value = variables[varName]?.value;
        if (value !== undefined && value !== null) {
          characterData.otherVariables[varName] = value;
        }
      }
    });

    console.log(`Extracted ${Object.keys(characterData.otherVariables).length} additional variables`);

    // Parse properties for classes, race, features, spells, etc.
    // Track unique classes to avoid duplicates
    const uniqueClasses = new Set();

    properties.forEach(prop => {
      switch (prop.type) {
        case 'class':
          // Only add class name once, even if there are multiple classLevel entries
          if (prop.name && !uniqueClasses.has(prop.name)) {
            uniqueClasses.add(prop.name);
            if (characterData.class) {
              characterData.class += ` / ${prop.name}`;
            } else {
              characterData.class = prop.name;
            }
          }
          break;

        case 'classLevel':
          // Count each classLevel entry as 1 level
          characterData.level += 1;
          // Also add the class name if not already added
          if (prop.name && !uniqueClasses.has(prop.name)) {
            uniqueClasses.add(prop.name);
            if (characterData.class) {
              characterData.class += ` / ${prop.name}`;
            } else {
              characterData.class = prop.name;
            }
          }
          break;

        case 'race':
          if (prop.name) {
            characterData.race = prop.name;
          }
          break;

        case 'background':
          if (prop.name) {
            characterData.background = prop.name;
          }
          break;

        case 'feature':
          characterData.features.push({
            name: prop.name || 'Unnamed Feature',
            description: prop.description || '',
            uses: prop.uses
          });
          break;

        case 'spell':
          characterData.spells.push({
            name: prop.name || 'Unnamed Spell',
            level: prop.level || 0,
            school: prop.school || '',
            castingTime: prop.castingTime || '',
            range: prop.range || '',
            components: prop.components || '',
            duration: prop.duration || '',
            description: prop.description || '',
            prepared: prop.prepared || false
          });
          break;

        case 'item':
        case 'equipment':
          characterData.inventory.push({
            name: prop.name || 'Unnamed Item',
            quantity: prop.quantity || 1,
            weight: prop.weight || 0,
            description: prop.description || '',
            equipped: prop.equipped || false
          });
          break;

        case 'proficiency':
          characterData.proficiencies.push({
            name: prop.name || '',
            type: prop.proficiencyType || 'other'
          });
          break;
      }
    });

    console.log('Parsed character data:', characterData);
    return characterData;
  }

  /**
   * Extracts character data and sends to background script
   */
  async function extractAndStoreCharacterData() {
    try {
      showNotification('Extracting character data...', 'info');

      const characterData = await fetchCharacterDataFromAPI();

      if (characterData && characterData.name) {
        // Send to background script for storage
        chrome.runtime.sendMessage({
          action: 'storeCharacterData',
          data: characterData
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error storing character data:', chrome.runtime.lastError);
            showNotification('Error storing character data', 'error');
          } else {
            console.log('Character data stored successfully');
            showNotification(`${characterData.name} extracted! Navigate to Roll20 to import.`, 'success');
          }
        });
      } else {
        showNotification('Failed to extract character data', 'error');
      }
    } catch (error) {
      console.error('Error extracting character:', error);
      showNotification(error.message, 'error');
    }
  }

  /**
   * Shows a notification to the user
   */
  function showNotification(message, type = 'info') {
    const colors = {
      success: '#4CAF50',
      error: '#f44336',
      info: '#2196F3'
    };

    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 16px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 300px;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }

  /**
   * Adds an export button to the Dice Cloud UI
   */
  function addExportButton() {
    // Wait for page to fully load
    if (document.readyState !== 'complete') {
      window.addEventListener('load', addExportButton);
      return;
    }

    // Avoid adding duplicate buttons
    if (document.getElementById('dc-roll20-export-btn')) {
      return;
    }

    const button = document.createElement('button');
    button.id = 'dc-roll20-export-btn';
    button.textContent = 'Export to Roll20';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #e74c3c;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: move;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 10000;
      transition: background 0.3s;
      user-select: none;
    `;
    button.addEventListener('mouseenter', () => {
      button.style.background = '#c0392b';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#e74c3c';
    });
    button.addEventListener('click', (e) => {
      // Shift+Click for debug mode
      if (e.shiftKey) {
        debugPageStructure();
        showNotification('Debug info logged to console (F12)', 'info');
      } else {
        extractAndStoreCharacterData();
      }
    });

    document.body.appendChild(button);
    makeDraggable(button);

    // Add debug button
    const debugButton = document.createElement('button');
    debugButton.id = 'dc-roll20-debug-btn';
    debugButton.textContent = '🔍 Debug Rolls';
    debugButton.style.cssText = `
      position: fixed;
      bottom: 70px;
      right: 20px;
      background: #3498db;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: move;
      font-size: 12px;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 10000;
      transition: background 0.3s;
    `;
    debugButton.addEventListener('mouseenter', () => {
      debugButton.style.background = '#2980b9';
    });
    debugButton.addEventListener('mouseleave', () => {
      debugButton.style.background = '#3498db';
    });
    debugButton.addEventListener('click', () => {
      debugPageStructure();
      showNotification('Debug info logged to console - Press F12 to view', 'info');
    });

    document.body.appendChild(debugButton);
    makeDraggable(debugButton);
  }

  // Listen for messages from the popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractCharacter') {
      extractAndStoreCharacterData()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response
    }
  });

  /**
   * Debug: Analyzes the page structure to find roll-related elements
   */
  function debugPageStructure() {
    console.log('=== DICECLOUD ROLL LOG DEBUG ===');

    // Find all elements that might be the roll log
    const potentialSelectors = [
      '.dice-stream',
      '[class*="dice"]',
      '[class*="roll"]',
      '[class*="log"]',
      '[class*="sidebar"]',
      '[class*="right"]',
      'aside',
      '[role="complementary"]'
    ];

    console.log('Searching for roll log container...');
    potentialSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`Found ${elements.length} element(s) matching "${selector}":`);
        elements.forEach((el, i) => {
          console.log(`  [${i}] Classes:`, el.className);
          console.log(`  [${i}] ID:`, el.id);
          console.log(`  [${i}] Tag:`, el.tagName);
          console.log(`  [${i}] Text preview:`, el.textContent?.substring(0, 100));
        });
      }
    });

    // Look for elements containing dice notation patterns
    console.log('\nSearching for elements with dice notation (e.g., "1d20 [ 6 ]", "2d6+3")...');
    const allElements = document.querySelectorAll('*');
    const dicePattern = /\d+d\d+\s*\[/i; // DiceCloud format: 1d20 [ 6 ]
    const elementsWithDice = [];

    allElements.forEach(el => {
      const text = el.textContent || '';
      if (text.match(dicePattern)) {
        elementsWithDice.push({
          tag: el.tagName,
          classes: el.className,
          id: el.id,
          text: text.substring(0, 100),
          parent: el.parentElement?.className,
          childCount: el.children.length,
          element: el // Store reference for inspection
        });
      }
    });

    if (elementsWithDice.length > 0) {
      console.log(`Found ${elementsWithDice.length} elements with dice notation:`);
      console.table(elementsWithDice.slice(0, 20));
      console.log('\n📋 Full element details (expand to inspect):');
      elementsWithDice.slice(0, 5).forEach((item, i) => {
        console.log(`\n[${i}] Element:`, item.element);
        console.log(`[${i}] Full text (first 200 chars):\n`, item.element.textContent.substring(0, 200));
        console.log(`[${i}] Parent chain:`, getParentChain(item.element));
      });
    } else {
      console.log('❌ No elements with dice notation found!');
      console.log('This might mean:');
      console.log('1. No rolls have been made yet - try making a roll');
      console.log('2. Rolls appear in a different format');
      console.log('3. Rolls are in a shadow DOM or iframe');
    }

    // Helper to show parent chain
    function getParentChain(el) {
      const chain = [];
      let current = el;
      for (let i = 0; i < 5 && current; i++) {
        chain.push({
          tag: current.tagName,
          class: current.className,
          id: current.id
        });
        current = current.parentElement;
      }
      return chain;
    }

    console.log('\n=== END DEBUG ===');
    console.log('Instructions:');
    console.log('1. Make a test roll in DiceCloud');
    console.log('2. Run debugPageStructure() again to see the new elements');
    console.log('3. Right-click on the roll in the page and select "Inspect" to see its HTML structure');
  }

  /**
   * Observes the DiceCloud roll log and sends rolls to Roll20
   */
  function observeRollLog() {
    // Find the roll log container - DiceCloud uses .card-raised-background
    const findRollLog = () => {
      // DiceCloud v2+ roll log structure
      const selectors = [
        '.card-raised-background', // Primary roll log container
        '.character-log',          // Alternative log container
        '[class*="log"]'           // Fallback
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          console.log('✓ Roll log detection: Found roll log using selector:', selector);
          console.log('Roll log element:', element);
          return element;
        }
      }
      return null;
    };

    const rollLog = findRollLog();
    if (!rollLog) {
      console.log('⏳ Roll log not found, will retry in 2 seconds...');
      console.log('💡 Run window.debugDiceCloudRolls() in console for detailed debug info');
      setTimeout(observeRollLog, 2000);
      return;
    }

    console.log('✅ Observing DiceCloud roll log for new rolls');
    console.log('📋 Roll log classes:', rollLog.className);
    console.log('🎲 Ready to detect rolls!');

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this is a log-entry (individual roll)
            if (node.className && node.className.includes('log-entry')) {
              console.log('🎲 New roll detected:', node);

              // Try to parse the roll from the added node
              const rollData = parseRollFromElement(node);
              if (rollData) {
                console.log('✅ Successfully parsed roll:', rollData);
                sendRollToRoll20(rollData);
              } else {
                console.log('⚠️  Could not parse roll data from element');
              }
            }
          }
        });
      });
    });

    observer.observe(rollLog, {
      childList: true,
      subtree: true
    });

    console.log('💡 TIP: Make a test roll to see if it gets detected');
  }

  // Expose debug function globally for console access
  window.debugDiceCloudRolls = debugPageStructure;

  /**
   * Parses roll data from a DOM element
   * DiceCloud v2 format:
   * <div class="log-entry">
   *   <h4 class="content-name">Strength check</h4>
   *   <div class="content-value"><p>1d20 [ 6 ] + 0 = <strong>6</strong></p></div>
   * </div>
   */
  function parseRollFromElement(element) {
    try {
      // Extract roll name from .content-name
      const nameElement = element.querySelector('.content-name');
      if (!nameElement) {
        console.log('⚠️  No .content-name found');
        return null;
      }

      const name = nameElement.textContent.trim();

      // Extract formula and result from .content-value
      const valueElement = element.querySelector('.content-value');
      if (!valueElement) {
        console.log('⚠️  No .content-value found');
        return null;
      }

      const valueText = valueElement.textContent.trim();

      // Parse DiceCloud format: "1d20 [ 6 ] + 0 = 6"
      // Extract the dice formula before the equals sign
      const formulaMatch = valueText.match(/^(.+?)\s*=\s*(.+)$/);

      if (!formulaMatch) {
        console.log('⚠️  Could not parse formula from:', valueText);
        return null;
      }

      // Clean up the formula - remove the [ actual roll ] part for Roll20
      // "1d20 [ 6 ] + 0" -> "1d20+0"
      let formula = formulaMatch[1].replace(/\s*\[\s*\d+\s*\]\s*/g, '').trim();

      // Remove extra spaces
      formula = formula.replace(/\s+/g, '');

      const result = formulaMatch[2].trim();

      console.log(`📊 Parsed: name="${name}", formula="${formula}", result="${result}"`);

      return {
        name: name,
        formula: formula,
        result: result,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Error parsing roll element:', error);
      return null;
    }
  }

  /**
   * Draggable Element System
   */
  const dragState = {
    positions: {},
    isDragging: false,
    currentElement: null,
    startX: 0,
    startY: 0,
    elementX: 0,
    elementY: 0
  };

  // Load saved positions from storage
  chrome.storage.local.get(['panelPositions'], (result) => {
    if (result.panelPositions) {
      dragState.positions = result.panelPositions;
    }
  });

  function savePositions() {
    chrome.storage.local.set({ panelPositions: dragState.positions });
  }

  function makeDraggable(element, handleSelector) {
    const elementId = element.id;
    let hasMoved = false;
    let clickTimeout = null;

    // Restore saved position
    if (dragState.positions[elementId]) {
      const pos = dragState.positions[elementId];
      element.style.left = pos.x + 'px';
      element.style.top = pos.y + 'px';
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    }

    const handle = handleSelector ? element.querySelector(handleSelector) : element;
    if (!handle) return;

    handle.addEventListener('mousedown', (e) => {
      // Don't drag if clicking toggle button
      if (e.target.classList.contains('history-toggle') ||
          e.target.classList.contains('stats-toggle') ||
          e.target.classList.contains('settings-toggle')) {
        return;
      }

      hasMoved = false;
      dragState.isDragging = false;
      dragState.currentElement = element;
      dragState.startX = e.clientX;
      dragState.startY = e.clientY;

      // Get current position
      const rect = element.getBoundingClientRect();
      dragState.elementX = rect.left;
      dragState.elementY = rect.top;

      // Wait a bit before starting drag (prevents accidental drags on click)
      clickTimeout = setTimeout(() => {
        if (dragState.currentElement === element) {
          dragState.isDragging = true;
          element.style.transition = 'none';
          element.style.opacity = '0.8';
          handle.style.cursor = 'grabbing';
        }
      }, 100);

      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (dragState.currentElement !== element) return;

      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;

      // Check if we've moved enough to count as dragging
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasMoved = true;

        if (dragState.isDragging) {
          const newX = dragState.elementX + dx;
          const newY = dragState.elementY + dy;

          // Keep element on screen
          const maxX = window.innerWidth - element.offsetWidth;
          const maxY = window.innerHeight - element.offsetHeight;

          const clampedX = Math.max(0, Math.min(newX, maxX));
          const clampedY = Math.max(0, Math.min(newY, maxY));

          element.style.left = clampedX + 'px';
          element.style.top = clampedY + 'px';
          element.style.right = 'auto';
          element.style.bottom = 'auto';
        }
      }

      e.preventDefault();
    });

    document.addEventListener('mouseup', (e) => {
      if (dragState.currentElement !== element) return;

      clearTimeout(clickTimeout);

      const wasDragging = dragState.isDragging && hasMoved;

      dragState.isDragging = false;
      dragState.currentElement = null;

      element.style.transition = '';
      element.style.opacity = '1';
      handle.style.cursor = 'move';

      // Save position if we actually dragged
      if (wasDragging) {
        const rect = element.getBoundingClientRect();
        dragState.positions[elementId] = {
          x: rect.left,
          y: rect.top
        };
        savePositions();
      }
    });
  }

  /**
   * Roll Statistics and History Tracking
   */
  const rollStats = {
    history: [],
    settings: {
      enabled: true,
      showNotifications: true,
      showHistory: true,
      maxHistorySize: 20,
      advantageMode: 'normal' // 'normal', 'advantage', 'disadvantage'
    },
    stats: {
      totalRolls: 0,
      averageRoll: 0,
      highestRoll: 0,
      lowestRoll: Infinity,
      criticalSuccesses: 0,
      criticalFailures: 0
    }
  };

  // Load settings from storage
  chrome.storage.local.get(['rollSettings'], (result) => {
    if (result.rollSettings) {
      Object.assign(rollStats.settings, result.rollSettings);
    }
    // Update settings panel if it exists
    updateSettingsPanel();
  });

  function saveSettings() {
    chrome.storage.local.set({ rollSettings: rollStats.settings });
  }

  function detectAdvantageDisadvantage(rollData) {
    const name = rollData.name.toLowerCase();
    if (name.includes('advantage') || name.includes('adv')) {
      return 'advantage';
    } else if (name.includes('disadvantage') || name.includes('dis')) {
      return 'disadvantage';
    }
    return 'normal';
  }

  function detectCritical(rollData) {
    const result = parseInt(rollData.result);
    const formula = rollData.formula.toLowerCase();

    // Check for d20 rolls
    if (formula.includes('d20') || formula.includes('1d20')) {
      if (result === 20) return 'critical-success';
      if (result === 1) return 'critical-failure';
    }
    return null;
  }

  function updateRollStatistics(rollData) {
    const result = parseInt(rollData.result);
    if (isNaN(result)) return;

    rollStats.stats.totalRolls++;
    rollStats.stats.highestRoll = Math.max(rollStats.stats.highestRoll, result);
    rollStats.stats.lowestRoll = Math.min(rollStats.stats.lowestRoll, result);

    // Update average (running average)
    rollStats.stats.averageRoll =
      (rollStats.stats.averageRoll * (rollStats.stats.totalRolls - 1) + result) /
      rollStats.stats.totalRolls;

    const critical = detectCritical(rollData);
    if (critical === 'critical-success') rollStats.stats.criticalSuccesses++;
    if (critical === 'critical-failure') rollStats.stats.criticalFailures++;
  }

  function addToRollHistory(rollData) {
    const advantageType = detectAdvantageDisadvantage(rollData);
    const criticalType = detectCritical(rollData);

    rollStats.history.unshift({
      ...rollData,
      advantageType,
      criticalType,
      timestamp: Date.now()
    });

    // Trim history
    if (rollStats.history.length > rollStats.settings.maxHistorySize) {
      rollStats.history = rollStats.history.slice(0, rollStats.settings.maxHistorySize);
    }

    updateRollStatistics(rollData);
    updateRollHistoryPanel();
    updateStatsPanel();
  }

  /**
   * Animated Roll Notification
   */
  function showRollNotification(rollData) {
    if (!rollStats.settings.showNotifications) return;

    const critical = detectCritical(rollData);
    const advantage = detectAdvantageDisadvantage(rollData);

    let bgGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    let icon = '🎲';

    if (critical === 'critical-success') {
      bgGradient = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
      icon = '⭐';
    } else if (critical === 'critical-failure') {
      bgGradient = 'linear-gradient(135deg, #4e54c8 0%, #8f94fb 100%)';
      icon = '💀';
    }

    const notification = document.createElement('div');
    notification.className = 'dc-roll-notification';
    notification.innerHTML = `
      <div class="notification-icon">${icon}</div>
      <div class="notification-content">
        <div class="notification-title">${rollData.name}</div>
        <div class="notification-formula">${rollData.formula} = <strong>${rollData.result}</strong></div>
        <div class="notification-status">
          ${critical ? `<span class="critical-badge">${critical.toUpperCase().replace('-', ' ')}</span>` : ''}
          ${advantage !== 'normal' ? `<span class="advantage-badge">${advantage.toUpperCase()}</span>` : ''}
          <span>Sent to Roll20! 🚀</span>
        </div>
      </div>
    `;

    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: -450px;
      background: ${bgGradient};
      color: white;
      padding: 20px;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.4);
      z-index: 100001;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      min-width: 350px;
      display: flex;
      align-items: center;
      gap: 16px;
      transition: right 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      animation: pulse-glow 2s infinite;
    `;

    addNotificationStyles();
    document.body.appendChild(notification);

    // Slide in
    setTimeout(() => {
      notification.style.right = '20px';
    }, 10);

    // Slide out
    setTimeout(() => {
      notification.style.right = '-450px';
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 500);
    }, 4000);
  }

  function addNotificationStyles() {
    if (document.querySelector('.dc-roll-notification-styles')) return;

    const style = document.createElement('style');
    style.className = 'dc-roll-notification-styles';
    style.textContent = `
      .dc-roll-notification .notification-icon {
        font-size: 40px;
        animation: roll-bounce 0.8s ease-in-out infinite alternate;
      }

      .dc-roll-notification .notification-title {
        font-weight: bold;
        font-size: 15px;
        margin-bottom: 6px;
        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }

      .dc-roll-notification .notification-formula {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
        font-family: 'Courier New', monospace;
      }

      .dc-roll-notification .notification-status {
        font-size: 12px;
        opacity: 0.95;
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }

      .dc-roll-notification .critical-badge,
      .dc-roll-notification .advantage-badge {
        background: rgba(255,255,255,0.3);
        padding: 3px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: bold;
        letter-spacing: 0.5px;
      }

      @keyframes roll-bounce {
        0% { transform: rotate(-5deg) scale(1); }
        100% { transform: rotate(5deg) scale(1.15); }
      }

      @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 12px 32px rgba(0,0,0,0.4); }
        50% { box-shadow: 0 12px 48px rgba(255,255,255,0.3), 0 0 32px rgba(255,255,255,0.2); }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Roll History Panel
   */
  function createRollHistoryPanel() {
    if (document.getElementById('dc-roll-history')) return;

    const panel = document.createElement('div');
    panel.id = 'dc-roll-history';
    panel.innerHTML = `
      <div class="history-header">
        <span class="history-title">🎲 Roll History</span>
        <button class="history-toggle">−</button>
      </div>
      <div class="history-content">
        <div class="history-list"></div>
      </div>
    `;

    panel.style.cssText = `
      position: fixed;
      bottom: 180px;
      right: 20px;
      background: rgba(20, 20, 30, 0.98);
      backdrop-filter: blur(12px);
      color: white;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.5);
      z-index: 10000;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      width: 380px;
      max-height: 500px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: ${rollStats.settings.showHistory ? 'block' : 'none'};
    `;

    addHistoryStyles();
    document.body.appendChild(panel);

    // Make draggable
    makeDraggable(panel, '.history-header');

    // Toggle functionality
    let isCollapsed = false;
    panel.querySelector('.history-header').addEventListener('click', (e) => {
      // Only toggle if not dragging
      if (e.target === panel.querySelector('.history-toggle')) {
        const content = panel.querySelector('.history-content');
        const toggle = panel.querySelector('.history-toggle');

        if (isCollapsed) {
          content.style.display = 'block';
          toggle.textContent = '−';
        } else {
          content.style.display = 'none';
          toggle.textContent = '+';
        }

        isCollapsed = !isCollapsed;
      }
    });
  }

  function addHistoryStyles() {
    if (document.querySelector('.dc-roll-history-styles')) return;

    const style = document.createElement('style');
    style.className = 'dc-roll-history-styles';
    style.textContent = `
      #dc-roll-history .history-header {
        padding: 16px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        border-radius: 16px 16px 0 0;
      }

      #dc-roll-history .history-title {
        font-weight: bold;
        font-size: 16px;
      }

      #dc-roll-history .history-toggle {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: background 0.2s;
      }

      #dc-roll-history .history-toggle:hover {
        background: rgba(255,255,255,0.3);
      }

      #dc-roll-history .history-content {
        max-height: 440px;
        overflow-y: auto;
        padding: 12px;
      }

      #dc-roll-history .history-content::-webkit-scrollbar {
        width: 8px;
      }

      #dc-roll-history .history-content::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
      }

      #dc-roll-history .history-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }

      #dc-roll-history .history-item {
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
        padding: 12px 14px;
        border-radius: 12px;
        margin-bottom: 8px;
        animation: slide-in-history 0.4s ease-out;
        border-left: 4px solid #667eea;
        transition: all 0.2s;
      }

      #dc-roll-history .history-item:hover {
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
        transform: translateX(-4px);
      }

      #dc-roll-history .history-item.critical-success {
        border-left-color: #f5576c;
        background: linear-gradient(135deg, rgba(245, 87, 108, 0.2) 0%, rgba(240, 147, 251, 0.1) 100%);
      }

      #dc-roll-history .history-item.critical-failure {
        border-left-color: #4e54c8;
        background: linear-gradient(135deg, rgba(78, 84, 200, 0.2) 0%, rgba(143, 148, 251, 0.1) 100%);
      }

      #dc-roll-history .history-item-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
        align-items: center;
      }

      #dc-roll-history .history-name {
        font-weight: 600;
        font-size: 14px;
      }

      #dc-roll-history .history-time {
        font-size: 11px;
        opacity: 0.6;
      }

      #dc-roll-history .history-formula {
        font-size: 13px;
        opacity: 0.95;
        font-family: 'Courier New', monospace;
        margin-bottom: 4px;
      }

      #dc-roll-history .history-badges {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      #dc-roll-history .history-badge {
        background: rgba(255,255,255,0.15);
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      @keyframes slide-in-history {
        from {
          opacity: 0;
          transform: translateX(30px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `;

    document.head.appendChild(style);
  }

  function updateRollHistoryPanel() {
    const panel = document.getElementById('dc-roll-history');
    if (!panel) return;

    const list = panel.querySelector('.history-list');
    if (!list) return;

    list.innerHTML = rollStats.history.map((roll, index) => {
      const timeAgo = getTimeAgo(roll.timestamp);
      const criticalClass = roll.criticalType ? roll.criticalType : '';

      let badges = '';
      if (roll.criticalType) {
        badges += `<span class="history-badge">${roll.criticalType.replace('-', ' ')}</span>`;
      }
      if (roll.advantageType && roll.advantageType !== 'normal') {
        badges += `<span class="history-badge">${roll.advantageType}</span>`;
      }

      return `
        <div class="history-item ${criticalClass}" style="animation-delay: ${index * 0.03}s">
          <div class="history-item-header">
            <span class="history-name">${roll.name}</span>
            <span class="history-time">${timeAgo}</span>
          </div>
          <div class="history-formula">${roll.formula} = <strong>${roll.result}</strong></div>
          ${badges ? `<div class="history-badges">${badges}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  /**
   * Roll Statistics Panel
   */
  function createStatsPanel() {
    if (document.getElementById('dc-roll-stats')) return;

    const panel = document.createElement('div');
    panel.id = 'dc-roll-stats';
    panel.innerHTML = `
      <div class="stats-header">
        <span class="stats-title">📊 Statistics</span>
        <button class="stats-toggle">−</button>
      </div>
      <div class="stats-content">
        <div class="stat-item">
          <span class="stat-label">Total Rolls</span>
          <span class="stat-value" id="stat-total">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Average</span>
          <span class="stat-value" id="stat-average">0.0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Highest</span>
          <span class="stat-value" id="stat-highest">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Lowest</span>
          <span class="stat-value" id="stat-lowest">∞</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">⭐ Critical Hits</span>
          <span class="stat-value" id="stat-crits">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">💀 Critical Fails</span>
          <span class="stat-value" id="stat-fails">0</span>
        </div>
      </div>
    `;

    panel.style.cssText = `
      position: fixed;
      bottom: 690px;
      right: 20px;
      background: rgba(20, 20, 30, 0.98);
      backdrop-filter: blur(12px);
      color: white;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.5);
      z-index: 10000;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      width: 380px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: ${rollStats.settings.showHistory ? 'block' : 'none'};
    `;

    addStatsStyles();
    document.body.appendChild(panel);

    // Make draggable
    makeDraggable(panel, '.stats-header');

    // Toggle functionality
    let isCollapsed = false;
    panel.querySelector('.stats-header').addEventListener('click', (e) => {
      // Only toggle if clicking the toggle button
      if (e.target === panel.querySelector('.stats-toggle')) {
        const content = panel.querySelector('.stats-content');
        const toggle = panel.querySelector('.stats-toggle');

        if (isCollapsed) {
          content.style.display = 'grid';
          toggle.textContent = '−';
        } else {
          content.style.display = 'none';
          toggle.textContent = '+';
        }

        isCollapsed = !isCollapsed;
      }
    });
  }

  function addStatsStyles() {
    if (document.querySelector('.dc-roll-stats-styles')) return;

    const style = document.createElement('style');
    style.className = 'dc-roll-stats-styles';
    style.textContent = `
      #dc-roll-stats .stats-header {
        padding: 16px 20px;
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        border-radius: 16px 16px 0 0;
      }

      #dc-roll-stats .stats-title {
        font-weight: bold;
        font-size: 16px;
      }

      #dc-roll-stats .stats-toggle {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: background 0.2s;
      }

      #dc-roll-stats .stats-toggle:hover {
        background: rgba(255,255,255,0.3);
      }

      #dc-roll-stats .stats-content {
        padding: 16px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      #dc-roll-stats .stat-item {
        background: rgba(255,255,255,0.05);
        padding: 12px;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      #dc-roll-stats .stat-label {
        font-size: 12px;
        opacity: 0.7;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      #dc-roll-stats .stat-value {
        font-size: 24px;
        font-weight: bold;
        color: #667eea;
      }
    `;

    document.head.appendChild(style);
  }

  function updateStatsPanel() {
    document.getElementById('stat-total')?.setAttribute('data-value', rollStats.stats.totalRolls);
    document.getElementById('stat-total')?.textContent = rollStats.stats.totalRolls.toString();
    document.getElementById('stat-average')?.textContent = rollStats.stats.averageRoll.toFixed(1);
    document.getElementById('stat-highest')?.textContent = rollStats.stats.highestRoll.toString();
    document.getElementById('stat-lowest')?.textContent =
      rollStats.stats.lowestRoll === Infinity ? '∞' : rollStats.stats.lowestRoll.toString();
    document.getElementById('stat-crits')?.textContent = rollStats.stats.criticalSuccesses.toString();
    document.getElementById('stat-fails')?.textContent = rollStats.stats.criticalFailures.toString();
  }

  /**
   * Roll Settings Panel
   */
  function createSettingsPanel() {
    if (document.getElementById('dc-roll-settings')) return;

    const panel = document.createElement('div');
    panel.id = 'dc-roll-settings';
    panel.innerHTML = `
      <div class="settings-header">
        <span class="settings-title">⚙️ Roll Settings</span>
        <button class="settings-toggle">−</button>
      </div>
      <div class="settings-content">
        <div class="setting-group">
          <label class="setting-label">Roll Mode</label>
          <div class="toggle-buttons">
            <button class="toggle-btn ${rollStats.settings.advantageMode === 'normal' ? 'active' : ''}" data-mode="normal">
              Normal
            </button>
            <button class="toggle-btn ${rollStats.settings.advantageMode === 'advantage' ? 'active' : ''}" data-mode="advantage">
              Advantage
            </button>
            <button class="toggle-btn ${rollStats.settings.advantageMode === 'disadvantage' ? 'active' : ''}" data-mode="disadvantage">
              Disadvantage
            </button>
          </div>
          <div class="setting-description">
            <span id="mode-description">
              ${rollStats.settings.advantageMode === 'advantage' ? '🎲 Rolling with advantage (2d20kh1)' :
                rollStats.settings.advantageMode === 'disadvantage' ? '🎲 Rolling with disadvantage (2d20kl1)' :
                '🎲 Rolling normally (1d20)'}
            </span>
          </div>
        </div>
      </div>
    `;

    panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(20, 20, 30, 0.98);
      backdrop-filter: blur(12px);
      color: white;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.5);
      z-index: 10001;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      width: 380px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;

    addSettingsStyles();
    document.body.appendChild(panel);

    // Make draggable
    makeDraggable(panel, '.settings-header');

    // Toggle functionality
    let isCollapsed = false;
    panel.querySelector('.settings-header').addEventListener('click', (e) => {
      if (e.target === panel.querySelector('.settings-toggle')) {
        const content = panel.querySelector('.settings-content');
        const toggle = panel.querySelector('.settings-toggle');

        if (isCollapsed) {
          content.style.display = 'block';
          toggle.textContent = '−';
        } else {
          content.style.display = 'none';
          toggle.textContent = '+';
        }

        isCollapsed = !isCollapsed;
      }
    });

    // Advantage/Disadvantage toggle buttons
    panel.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        rollStats.settings.advantageMode = mode;

        // Update active state
        panel.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update description
        const description = panel.querySelector('#mode-description');
        if (mode === 'advantage') {
          description.textContent = '🎲 Rolling with advantage (2d20kh1)';
        } else if (mode === 'disadvantage') {
          description.textContent = '🎲 Rolling with disadvantage (2d20kl1)';
        } else {
          description.textContent = '🎲 Rolling normally (1d20)';
        }

        // Save to storage
        chrome.storage.local.set({ rollSettings: rollStats.settings });
        console.log('Roll mode changed to:', mode);
        showNotification(`Roll mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`, 'info');
      });
    });
  }

  function addSettingsStyles() {
    if (document.querySelector('.dc-roll-settings-styles')) return;

    const style = document.createElement('style');
    style.className = 'dc-roll-settings-styles';
    style.textContent = `
      #dc-roll-settings .settings-header {
        padding: 16px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        border-radius: 16px 16px 0 0;
      }

      #dc-roll-settings .settings-title {
        font-weight: bold;
        font-size: 16px;
      }

      #dc-roll-settings .settings-toggle {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: background 0.2s;
      }

      #dc-roll-settings .settings-toggle:hover {
        background: rgba(255,255,255,0.3);
      }

      #dc-roll-settings .settings-content {
        padding: 20px;
      }

      #dc-roll-settings .setting-group {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      #dc-roll-settings .setting-label {
        font-size: 14px;
        font-weight: 600;
        opacity: 0.9;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      #dc-roll-settings .toggle-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 8px;
      }

      #dc-roll-settings .toggle-btn {
        background: rgba(255,255,255,0.08);
        border: 2px solid rgba(255,255,255,0.15);
        color: white;
        padding: 12px 16px;
        border-radius: 10px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s;
        text-align: center;
      }

      #dc-roll-settings .toggle-btn:hover {
        background: rgba(255,255,255,0.15);
        border-color: rgba(255,255,255,0.3);
        transform: translateY(-2px);
      }

      #dc-roll-settings .toggle-btn.active {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-color: #667eea;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      #dc-roll-settings .setting-description {
        background: rgba(255,255,255,0.05);
        padding: 12px;
        border-radius: 8px;
        font-size: 12px;
        opacity: 0.8;
        text-align: center;
      }
    `;

    document.head.appendChild(style);
  }

  function updateSettingsPanel() {
    const panel = document.getElementById('dc-roll-settings');
    if (!panel) return;

    // Update active state on toggle buttons
    panel.querySelectorAll('.toggle-btn').forEach(btn => {
      const mode = btn.getAttribute('data-mode');
      if (mode === rollStats.settings.advantageMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update description
    const description = panel.querySelector('#mode-description');
    if (description) {
      if (rollStats.settings.advantageMode === 'advantage') {
        description.textContent = '🎲 Rolling with advantage (2d20kh1)';
      } else if (rollStats.settings.advantageMode === 'disadvantage') {
        description.textContent = '🎲 Rolling with disadvantage (2d20kl1)';
      } else {
        description.textContent = '🎲 Rolling normally (1d20)';
      }
    }
  }

  /**
   * Transforms a roll formula based on advantage mode
   */
  function applyAdvantageMode(formula, mode) {
    if (mode === 'normal') return formula;

    // Transform d20 rolls to advantage/disadvantage
    // 1d20 -> 2d20kh1 (advantage) or 2d20kl1 (disadvantage)
    const d20Regex = /(\d*)d20\b/gi;

    return formula.replace(d20Regex, (match, count) => {
      const diceCount = count ? parseInt(count) : 1;

      if (mode === 'advantage') {
        // Roll twice as many dice, keep highest
        return `${diceCount * 2}d20kh${diceCount}`;
      } else if (mode === 'disadvantage') {
        // Roll twice as many dice, keep lowest
        return `${diceCount * 2}d20kl${diceCount}`;
      }

      return match;
    });
  }

  /**
   * Sends roll data to all Roll20 tabs with visual feedback
   */
  function sendRollToRoll20(rollData) {
    if (!rollStats.settings.enabled) return;

    // Apply advantage/disadvantage to the formula
    const modifiedRoll = {
      ...rollData,
      formula: applyAdvantageMode(rollData.formula, rollStats.settings.advantageMode)
    };

    // Log if formula was modified
    if (modifiedRoll.formula !== rollData.formula) {
      console.log(`Formula modified: ${rollData.formula} -> ${modifiedRoll.formula} (${rollStats.settings.advantageMode})`);
    }

    // Add visual feedback and tracking
    showRollNotification(modifiedRoll);
    addToRollHistory(modifiedRoll);

    // Send to Roll20
    chrome.runtime.sendMessage({
      action: 'sendRollToRoll20',
      roll: modifiedRoll
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending roll to Roll20:', chrome.runtime.lastError);
        showNotification('Failed to send roll to Roll20', 'error');
      } else {
        console.log('Roll sent to Roll20:', response);
      }
    });
  }

  // Initialize the export button and roll panels when the page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      addExportButton();
      observeRollLog();
      createRollHistoryPanel();
      createStatsPanel();
      createSettingsPanel();
    });
  } else {
    addExportButton();
    observeRollLog();
    createRollHistoryPanel();
    createStatsPanel();
    createSettingsPanel();
  }
})();
