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
    properties.forEach(prop => {
      switch (prop.type) {
        case 'class':
        case 'classLevel':
          if (prop.name) {
            if (characterData.class) {
              characterData.class += ` / ${prop.name}`;
            } else {
              characterData.class = prop.name;
            }
            if (prop.level) {
              characterData.level += prop.level;
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
    button.addEventListener('click', extractAndStoreCharacterData);

    document.body.appendChild(button);
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

  // Initialize the export button when the page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addExportButton);
  } else {
    addExportButton();
  }
})();
