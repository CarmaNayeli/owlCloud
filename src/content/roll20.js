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
    // Try multiple strategies to find the character sheet iframe
    let targetIframe = null;

    // Strategy 1: Look for iframe with title containing "Character sheet"
    const allIframes = document.querySelectorAll('iframe');
    for (const iframe of allIframes) {
      if (iframe.title && iframe.title.toLowerCase().includes('character sheet')) {
        targetIframe = iframe;
        console.log('Found character sheet iframe by title:', iframe.title);
        break;
      }
    }

    // Strategy 2: Look for iframe with class="charactersheet"
    if (!targetIframe) {
      const classIframes = document.querySelectorAll('iframe.charactersheet');
      if (classIframes.length > 0) {
        targetIframe = classIframes[0];
        console.log('Found character sheet iframe by class');
      }
    }

    // Try to access the iframe document
    if (targetIframe) {
      try {
        const doc = targetIframe.contentDocument || targetIframe.contentWindow.document;
        console.log('Successfully accessed iframe document');
        return doc;
      } catch (e) {
        console.warn('Could not access iframe (cross-origin restriction):', e);
      }
    }

    // Fall back to main document
    console.log('Using main document (no accessible iframe found)');
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
        // Core character info
        'character_name': characterData.name,
        'class': characterData.class,
        'level': characterData.level,
        'race': characterData.race,
        'background': characterData.background,
        'alignment': characterData.alignment,

        // Ability scores
        'strength': characterData.attributes?.strength,
        'dexterity': characterData.attributes?.dexterity,
        'constitution': characterData.attributes?.constitution,
        'intelligence': characterData.attributes?.intelligence,
        'wisdom': characterData.attributes?.wisdom,
        'charisma': characterData.attributes?.charisma,

        // Ability modifiers
        'strength_mod': characterData.attributeMods?.strength,
        'dexterity_mod': characterData.attributeMods?.dexterity,
        'constitution_mod': characterData.attributeMods?.constitution,
        'intelligence_mod': characterData.attributeMods?.intelligence,
        'wisdom_mod': characterData.attributeMods?.wisdom,
        'charisma_mod': characterData.attributeMods?.charisma,

        // Saving throws
        'strength_save_bonus': characterData.saves?.strength,
        'dexterity_save_bonus': characterData.saves?.dexterity,
        'constitution_save_bonus': characterData.saves?.constitution,
        'intelligence_save_bonus': characterData.saves?.intelligence,
        'wisdom_save_bonus': characterData.saves?.wisdom,
        'charisma_save_bonus': characterData.saves?.charisma,

        // Skills
        'acrobatics_bonus': characterData.skills?.acrobatics,
        'animal_handling_bonus': characterData.skills?.animalHandling,
        'arcana_bonus': characterData.skills?.arcana,
        'athletics_bonus': characterData.skills?.athletics,
        'deception_bonus': characterData.skills?.deception,
        'history_bonus': characterData.skills?.history,
        'insight_bonus': characterData.skills?.insight,
        'intimidation_bonus': characterData.skills?.intimidation,
        'investigation_bonus': characterData.skills?.investigation,
        'medicine_bonus': characterData.skills?.medicine,
        'nature_bonus': characterData.skills?.nature,
        'perception_bonus': characterData.skills?.perception,
        'performance_bonus': characterData.skills?.performance,
        'persuasion_bonus': characterData.skills?.persuasion,
        'religion_bonus': characterData.skills?.religion,
        'sleight_of_hand_bonus': characterData.skills?.sleightOfHand,
        'stealth_bonus': characterData.skills?.stealth,
        'survival_bonus': characterData.skills?.survival,

        // Combat stats
        'hp': characterData.hitPoints?.current,
        'hp_max': characterData.hitPoints?.max,
        'ac': characterData.armorClass,
        'speed': characterData.speed,
        'initiative_bonus': characterData.initiative,
        'proficiency': characterData.proficiencyBonus,

        // Kingdom skills (Pathfinder Kingmaker / Kingdom Builder)
        'kingdom_agriculture': characterData.kingdom?.agriculture,
        'kingdom_arts': characterData.kingdom?.arts,
        'kingdom_boating': characterData.kingdom?.boating,
        'kingdom_defense': characterData.kingdom?.defense,
        'kingdom_engineering': characterData.kingdom?.engineering,
        'kingdom_exploration': characterData.kingdom?.exploration,
        'kingdom_folklore': characterData.kingdom?.folklore,
        'kingdom_industry': characterData.kingdom?.industry,
        'kingdom_intrigue': characterData.kingdom?.intrigue,
        'kingdom_magic': characterData.kingdom?.magic,
        'kingdom_politics': characterData.kingdom?.politics,
        'kingdom_scholarship': characterData.kingdom?.scholarship,
        'kingdom_statecraft': characterData.kingdom?.statecraft,
        'kingdom_trade': characterData.kingdom?.trade,
        'kingdom_warfare': characterData.kingdom?.warfare,
        'kingdom_wilderness': characterData.kingdom?.wilderness,

        // Kingdom proficiency totals
        'kingdom_agriculture_proficiency_total': characterData.kingdom?.agriculture_proficiency_total,
        'kingdom_arts_proficiency_total': characterData.kingdom?.arts_proficiency_total,
        'kingdom_boating_proficiency_total': characterData.kingdom?.boating_proficiency_total,
        'kingdom_defense_proficiency_total': characterData.kingdom?.defense_proficiency_total,
        'kingdom_engineering_proficiency_total': characterData.kingdom?.engineering_proficiency_total,
        'kingdom_exploration_proficiency_total': characterData.kingdom?.exploration_proficiency_total,
        'kingdom_folklore_proficiency_total': characterData.kingdom?.folklore_proficiency_total,
        'kingdom_industry_proficiency_total': characterData.kingdom?.industry_proficiency_total,
        'kingdom_intrigue_proficiency_total': characterData.kingdom?.intrigue_proficiency_total,
        'kingdom_magic_proficiency_total': characterData.kingdom?.magic_proficiency_total,
        'kingdom_politics_proficiency_total': characterData.kingdom?.politics_proficiency_total,
        'kingdom_scholarship_proficiency_total': characterData.kingdom?.scholarship_proficiency_total,
        'kingdom_statecraft_proficiency_total': characterData.kingdom?.statecraft_proficiency_total,
        'kingdom_trade_proficiency_total': characterData.kingdom?.trade_proficiency_total,
        'kingdom_warfare_proficiency_total': characterData.kingdom?.warfare_proficiency_total,
        'kingdom_wilderness_proficiency_total': characterData.kingdom?.wilderness_proficiency_total,

        // Kingdom core stats
        'kingdom_culture': characterData.kingdom?.culture,
        'kingdom_economy': characterData.kingdom?.economy,
        'kingdom_loyalty': characterData.kingdom?.loyalty,
        'kingdom_stability': characterData.kingdom?.stability,

        // Army attributes
        'army_scouting': characterData.army?.scouting,
        'army_maneuver': characterData.army?.maneuver,
        'army_morale': characterData.army?.morale,
        'army_ranged': characterData.army?.ranged,

        // Other variables
        'hero_points': characterData.otherVariables?.hero_points
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

  /**
   * Posts a message to Roll20 chat (similar to Beyond20)
   */
  function postChatMessage(message, characterName = null) {
    const chat = document.getElementById("textchat-input");
    const txt = chat?.querySelector("textarea");
    const btn = chat?.querySelector("button");
    const speakingAs = document.getElementById("speakingas");

    if (!chat || !txt || !btn || !speakingAs) {
      console.error('Error: Unable to post message to chat. Chat elements not found.');
      return false;
    }

    // Set speaking as character if specified
    let setSpeakingAs = true;
    const oldAs = speakingAs.value;

    if (characterName) {
      characterName = characterName.toLowerCase().trim();
      for (let i = 0; i < speakingAs.children.length; i++) {
        if (speakingAs.children[i].text.toLowerCase().trim() === characterName) {
          speakingAs.children[i].selected = true;
          setSpeakingAs = false;
          break;
        }
      }
    }

    if (setSpeakingAs) {
      speakingAs.children[0].selected = true;
    }

    // Set message and send
    const oldText = txt.value;
    txt.value = message;
    btn.click();
    txt.value = oldText;
    speakingAs.value = oldAs;

    return true;
  }

  /**
   * Formats a roll from DiceCloud into Roll20 template syntax
   */
  function formatRollForRoll20(rollData) {
    // Extract character name from stored data if available
    let characterName = '';
    chrome.runtime.sendMessage({ action: 'getCharacterData' }, (response) => {
      if (response && response.data) {
        characterName = response.data.name;
      }
    });

    // Format roll using Roll20's simple template
    // &{template:simple} {{rname=Attack}} {{mod=+5}} {{r1=[[1d20+5]]}} {{charname=Bob}}
    const rollFormula = `[[${rollData.formula}]]`;

    const message = `&{template:simple} {{rname=${rollData.name}}} {{r1=${rollFormula}}} {{normal=1}}` +
      (characterName ? ` {{charname=${characterName}}}` : '');

    return message;
  }

  /**
   * Handles a roll from DiceCloud
   */
  function handleDiceCloudRoll(rollData) {
    console.log('Received roll from DiceCloud:', rollData);

    const message = formatRollForRoll20(rollData);
    const success = postChatMessage(message);

    if (success) {
      showNotification(`Rolled ${rollData.name}: ${rollData.formula}`, 'success');
    } else {
      showNotification('Failed to post roll to chat', 'error');
    }
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
    } else if (request.action === 'postRollToChat') {
      // Handle roll from DiceCloud
      if (request.roll) {
        handleDiceCloudRoll(request.roll);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No roll data provided' });
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
