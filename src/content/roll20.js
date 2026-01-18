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
    // Try to find iframe with character sheet
    const iframes = document.querySelectorAll('iframe.charactersheet');
    if (iframes.length > 0) {
      try {
        const doc = iframes[0].contentDocument || iframes[0].contentWindow.document;
        console.log('Found charactersheet iframe');
        return doc;
      } catch (e) {
        console.warn('Could not access iframe:', e);
      }
    }

    // Fall back to main document
    console.log('Using main document (no iframe found)');
    return document;
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

      // D&D 5e OGL sheet field mappings
      const fieldMappings = {
        'character_name': characterData.name,
        'strength': characterData.attributes?.strength,
        'dexterity': characterData.attributes?.dexterity,
        'constitution': characterData.attributes?.constitution,
        'intelligence': characterData.attributes?.intelligence,
        'wisdom': characterData.attributes?.wisdom,
        'charisma': characterData.attributes?.charisma,
        'hp': characterData.hitPoints?.current,
        'hp_max': characterData.hitPoints?.max,
        'ac': characterData.armorClass,
        'speed': characterData.speed,
        'class': characterData.class,
        'level': characterData.level,
        'race': characterData.race,
        'background': characterData.background,
        'alignment': characterData.alignment,
        'proficiency': characterData.proficiencyBonus
      };

      // Try to set each field
      Object.entries(fieldMappings).forEach(([fieldName, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (setFieldValue(doc, fieldName, value)) {
            successCount++;
          } else {
            failCount++;
          }
        }
      });

      console.log(`Import complete: ${successCount} fields set, ${failCount} fields not found`);

      if (successCount > 0) {
        showNotification(`Imported ${characterData.name}! (${successCount} fields populated)`, 'success');
      } else {
        showNotification(`Could not populate fields. Try debug mode (Shift+Click)`, 'error');
      }

    } catch (error) {
      console.error('Error importing character data:', error);
      showNotification('Error importing character data. Check console for details.', 'error');
    }
  }

  /**
   * Sets a field value in Roll20
   */
  function setFieldValue(doc, fieldName, value) {
    if (!value && value !== 0) return false;

    // Roll20 D&D 5e OGL sheet uses attr_ prefix
    const selectors = [
      // With attr_ prefix
      `input[name="attr_${fieldName}"]`,
      `textarea[name="attr_${fieldName}"]`,
      `select[name="attr_${fieldName}"]`,
      // Without prefix
      `input[name="${fieldName}"]`,
      `textarea[name="${fieldName}"]`,
      `select[name="${fieldName}"]`,
      // Try with wildcard
      `input[name*="${fieldName}"]`,
      `textarea[name*="${fieldName}"]`
    ];

    for (const selector of selectors) {
      try {
        const elements = doc.querySelectorAll(selector);
        if (elements.length > 0) {
          let updated = false;
          elements.forEach(element => {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
              element.value = value;

              // Trigger all possible events to make Roll20 recognize the change
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              element.dispatchEvent(new Event('blur', { bubbles: true }));

              // Also try triggering on window for sheet workers
              if (doc.defaultView) {
                doc.defaultView.dispatchEvent(new Event('change'));
              }

              updated = true;
            }
          });

          if (updated) {
            console.log(`✓ Set ${fieldName} to ${value} using: ${selector}`);
            return true;
          }
        }
      } catch (e) {
        // Selector might be invalid, continue
      }
    }

    console.warn(`✗ Could not find field: ${fieldName}`);
    return false;
  }

  /**
   * Debug: Lists all input fields
   */
  function debugListFields() {
    console.log('=== ROLL20 FIELD DEBUG ===');
    const doc = getCharacterSheetFrame();

    const inputs = doc.querySelectorAll('input[name], textarea[name], select[name]');
    console.log(`Found ${inputs.length} named form fields`);

    const attrFields = [];
    inputs.forEach(input => {
      if (input.name && input.name.startsWith('attr_')) {
        attrFields.push({
          name: input.name,
          type: input.type || input.tagName.toLowerCase(),
          value: input.value
        });
      }
    });

    console.log('Character sheet fields (attr_* only):');
    console.table(attrFields.slice(0, 50)); // Show first 50

    if (attrFields.length === 0) {
      console.warn('No attr_ fields found! Sheet might be in iframe we cannot access.');
      console.log('Trying to list ALL iframes:');
      document.querySelectorAll('iframe').forEach((iframe, i) => {
        console.log(`Iframe ${i}:`, iframe.className, iframe.src);
      });
    }

    console.log('=== END DEBUG ===');

    showNotification(`Found ${attrFields.length} character fields - check console`, 'info');
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

    button.addEventListener('click', (e) => {
      // Debug mode: Shift+Click
      if (e.shiftKey) {
        debugListFields();
        return;
      }

      // Normal import
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

  // Initialize
  setTimeout(() => {
    addImportButton();
    console.log('Import button added. Shift+Click for field debug.');
  }, 2000);

  // Re-add button if it disappears
  setInterval(() => {
    if (!document.getElementById('dc-roll20-import-btn')) {
      addImportButton();
    }
  }, 5000);
})();
