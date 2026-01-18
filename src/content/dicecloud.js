/**
 * Dice Cloud Content Script
 * Extracts character data from Dice Cloud using the REST API
 */

(function() {
  'use strict';

  console.log('Dice Cloud to Roll20 Importer: Content script loaded');

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
      proficiencyBonus: variables.proficiencyBonus?.value || 0
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
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 10000;
      transition: background 0.3s;
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
      cursor: pointer;
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
   * Sends roll data to all Roll20 tabs
   */
  function sendRollToRoll20(rollData) {
    chrome.runtime.sendMessage({
      action: 'sendRollToRoll20',
      roll: rollData
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending roll to Roll20:', chrome.runtime.lastError);
      } else {
        console.log('Roll sent to Roll20:', response);
      }
    });
  }

  // Initialize the export button when the page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      addExportButton();
      observeRollLog();
    });
  } else {
    addExportButton();
    observeRollLog();
  }
})();
