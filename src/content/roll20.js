/**
 * Roll20 Content Script
 * Imports character data from Dice Cloud into Roll20 character sheets
 */

(function() {
  'use strict';

  console.log('Dice Cloud to Roll20 Importer: Roll20 content script loaded');

  /**
   * Finds the character sheet iframe
   */
  function getCharacterSheetFrame() {
    // Roll20 character sheets are often in iframes
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        if (iframe.contentDocument && iframe.contentDocument.querySelector('.charsheet')) {
          console.log('Found character sheet iframe');
          return iframe.contentDocument;
        }
      } catch (e) {
        // Cross-origin iframe, skip
      }
    }
    return document; // Fall back to main document
  }

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
      const doc = getCharacterSheetFrame();

      let successCount = 0;
      let failCount = 0;

      // Import character name
      if (setFieldValue(doc, 'character_name', characterData.name)) successCount++; else failCount++;

      // Import ability scores
      if (characterData.attributes) {
        const abilityMap = {
          strength: 'strength',
          dexterity: 'dexterity',
          constitution: 'constitution',
          intelligence: 'intelligence',
          wisdom: 'wisdom',
          charisma: 'charisma'
        };

        Object.entries(abilityMap).forEach(([key, roll20Name]) => {
          if (characterData.attributes[key]) {
            if (setFieldValue(doc, roll20Name, characterData.attributes[key])) {
              successCount++;
            } else {
              failCount++;
            }
          }
        });
      }

      // Import HP
      if (characterData.hitPoints) {
        if (setFieldValue(doc, 'hp', characterData.hitPoints.current)) successCount++; else failCount++;
        if (setFieldValue(doc, 'hp_max', characterData.hitPoints.max)) successCount++; else failCount++;
      }

      // Import AC
      if (characterData.armorClass) {
        if (setFieldValue(doc, 'ac', characterData.armorClass)) successCount++; else failCount++;
      }

      // Import class and level
      if (characterData.class) {
        if (setFieldValue(doc, 'class', characterData.class)) successCount++; else failCount++;
      }
      if (characterData.level) {
        if (setFieldValue(doc, 'level', characterData.level)) successCount++; else failCount++;
        if (setFieldValue(doc, 'base_level', characterData.level)) successCount++;
      }

      // Import race
      if (characterData.race) {
        if (setFieldValue(doc, 'race', characterData.race)) successCount++; else failCount++;
      }

      // Import proficiency bonus
      if (characterData.proficiencyBonus) {
        if (setFieldValue(doc, 'pb', characterData.proficiencyBonus)) successCount++; else failCount++;
        if (setFieldValue(doc, 'proficiency', characterData.proficiencyBonus)) successCount++;
      }

      // Import speed
      if (characterData.speed) {
        if (setFieldValue(doc, 'speed', characterData.speed)) successCount++; else failCount++;
      }

      console.log(`Import complete: ${successCount} fields set, ${failCount} fields not found`);

      if (successCount > 0) {
        showNotification(`Imported ${characterData.name}! (${successCount} fields populated)`, 'success');
      } else {
        showNotification(`Could not populate fields. Check console for details.`, 'error');
      }

    } catch (error) {
      console.error('Error importing character data:', error);
      showNotification('Error importing character data. Check console for details.', 'error');
    }
  }

  /**
   * Sets a field value in Roll20
   * Handles both input fields and contenteditable elements
   */
  function setFieldValue(doc, fieldName, value) {
    if (!value) return false;

    // Try various Roll20 field naming conventions
    const selectors = [
      // Standard attribute names
      `input[name="attr_${fieldName}"]`,
      `textarea[name="attr_${fieldName}"]`,
      // Base attribute names (for ability scores)
      `input[name="attr_${fieldName}_base"]`,
      // Without attr_ prefix
      `input[name="${fieldName}"]`,
      `textarea[name="${fieldName}"]`,
      // Data attributes
      `[data-attribute="${fieldName}"]`,
      `[data-attr="${fieldName}"]`,
      // Wildcard search
      `input[name*="${fieldName}"]`,
      `textarea[name*="${fieldName}"]`
    ];

    for (const selector of selectors) {
      const elements = doc.querySelectorAll(selector);
      if (elements.length > 0) {
        let updated = false;
        elements.forEach(element => {
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
            updated = true;
          } else if (element.isContentEditable) {
            element.textContent = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
            updated = true;
          }
        });
        if (updated) {
          console.log(`✓ Set ${fieldName} to ${value} using selector: ${selector}`);
          return true;
        }
      }
    }

    console.warn(`✗ Could not find field: ${fieldName}`);
    return false;
  }

  /**
   * Debug: Lists all input fields on the page
   */
  function debugListFields() {
    const doc = getCharacterSheetFrame();
    const inputs = doc.querySelectorAll('input, textarea');
    console.log('=== Available Roll20 Fields ===');
    inputs.forEach(input => {
      if (input.name) {
        console.log(`Field: ${input.name}, Type: ${input.type}, Value: ${input.value}`);
      }
    });
    console.log('=== End of Fields ===');
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

    // Add debug button (Shift + Click to list fields)
    button.addEventListener('click', (e) => {
      if (e.shiftKey) {
        debugListFields();
      }
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
