/**
 * Roll20 Content Script
 * Imports character data from Dice Cloud into Roll20 character sheets
 */

(function() {
  'use strict';

  console.log('Dice Cloud to Roll20 Importer: Roll20 content script loaded');

  let characterDataToImport = null;

  /**
   * Imports character data into Roll20
   */
  function importCharacterData(characterData) {
    if (!characterData || !characterData.name) {
      showNotification('No character data available to import', 'error');
      return;
    }

    try {
      console.log('Importing character data:', characterData);

      // Roll20 uses input fields and contenteditable elements
      // This is a generic approach - may need adjustment based on Roll20's actual structure

      // Import character name
      setFieldValue('character_name', characterData.name);

      // Import attributes
      if (characterData.attributes) {
        Object.entries(characterData.attributes).forEach(([attr, value]) => {
          const attrName = attr.toLowerCase().replace('ability', '');
          setFieldValue(`${attrName}_base`, value);
          setFieldValue(`strength_base`, characterData.attributes.strength || 10);
          setFieldValue(`dexterity_base`, characterData.attributes.dexterity || 10);
          setFieldValue(`constitution_base`, characterData.attributes.constitution || 10);
          setFieldValue(`intelligence_base`, characterData.attributes.intelligence || 10);
          setFieldValue(`wisdom_base`, characterData.attributes.wisdom || 10);
          setFieldValue(`charisma_base`, characterData.attributes.charisma || 10);
        });
      }

      // Import HP
      if (characterData.hitPoints) {
        setFieldValue('hp', characterData.hitPoints.current);
        setFieldValue('hp_max', characterData.hitPoints.max);
      }

      // Import AC
      if (characterData.armorClass) {
        setFieldValue('ac', characterData.armorClass);
      }

      // Import class and level
      if (characterData.class) {
        setFieldValue('class', characterData.class);
      }
      if (characterData.level) {
        setFieldValue('level', characterData.level);
      }

      // Import race
      if (characterData.race) {
        setFieldValue('race', characterData.race);
      }

      showNotification(`Successfully imported ${characterData.name}!`, 'success');

    } catch (error) {
      console.error('Error importing character data:', error);
      showNotification('Error importing character data. Check console for details.', 'error');
    }
  }

  /**
   * Sets a field value in Roll20
   * Handles both input fields and contenteditable elements
   */
  function setFieldValue(fieldName, value) {
    // Try common Roll20 field selectors
    const selectors = [
      `input[name="${fieldName}"]`,
      `input[name="attr_${fieldName}"]`,
      `textarea[name="${fieldName}"]`,
      `textarea[name="attr_${fieldName}"]`,
      `[data-field="${fieldName}"]`,
      `[name*="${fieldName}"]`
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        elements.forEach(element => {
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (element.isContentEditable) {
            element.textContent = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
        console.log(`Set ${fieldName} to ${value}`);
        return true;
      }
    }

    console.warn(`Could not find field: ${fieldName}`);
    return false;
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
      z-index: 100000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 300px;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }

  /**
   * Adds an import button to the Roll20 UI
   */
  function addImportButton() {
    // Avoid adding duplicate buttons
    if (document.getElementById('dc-roll20-import-btn')) {
      return;
    }

    const button = document.createElement('button');
    button.id = 'dc-roll20-import-btn';
    button.textContent = 'Import from Dice Cloud';
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
      z-index: 100000;
      transition: background 0.3s;
    `;
    button.addEventListener('mouseenter', () => {
      button.style.background = '#c0392b';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#e74c3c';
    });
    button.addEventListener('click', () => {
      // Request character data from background script
      chrome.runtime.sendMessage({ action: 'getCharacterData' }, (response) => {
        if (response && response.data) {
          importCharacterData(response.data);
        } else {
          showNotification('No character data found. Export from Dice Cloud first.', 'error');
        }
      });
    });

    document.body.appendChild(button);
  }

  // Listen for messages from the popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'importCharacter') {
      if (request.data) {
        importCharacterData(request.data);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No character data provided' });
      }
    }
    return true;
  });

  // Initialize the import button when the page loads
  // Roll20 is a complex app, so we wait a bit for it to load
  setTimeout(() => {
    addImportButton();
  }, 2000);

  // Also check periodically in case Roll20 reloads content
  setInterval(() => {
    if (!document.getElementById('dc-roll20-import-btn')) {
      addImportButton();
    }
  }, 5000);
})();
