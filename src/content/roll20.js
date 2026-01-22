/**
 * Roll20 Content Script
 * Handles roll announcements and character sheet overlay
 */

(function() {
  'use strict';

  debug.log('RollCloud: Roll20 content script loaded');

  /**
   * Posts a message to Roll20 chat
   */
  function postChatMessage(message) {
    try {
      // Find the chat input textarea
      const chatInput = document.querySelector('#textchat-input textarea');
      if (chatInput) {
        chatInput.value = message;
        chatInput.focus();

        // Trigger the send button
        const sendButton = document.querySelector('#textchat-input .btn');
        if (sendButton) {
          sendButton.click();
          debug.log('✅ Message posted to Roll20 chat:', message);
          return true;
        } else {
          debug.error('❌ Could not find Roll20 chat send button');
          return false;
        }
      } else {
        debug.error('❌ Could not find Roll20 chat input');
        return false;
      }
    } catch (error) {
      debug.error('❌ Error posting to Roll20 chat:', error);
      return false;
    }
  }

  /**
   * Handles roll messages from Dice Cloud
   */
  function handleDiceCloudRoll(rollData) {
    debug.log('🎲 Handling Dice Cloud roll:', rollData);

    // Use pre-formatted message if it exists (for spells, actions, etc.)
    // Otherwise format the roll data
    const formattedMessage = rollData.message || formatRollForRoll20(rollData);

    const success = postChatMessage(formattedMessage);

    if (success) {
      debug.log('✅ Roll successfully posted to Roll20');

      // Wait for Roll20 to process the roll and add it to chat
      // Then parse the actual Roll20 result (not DiceCloud's roll)
      observeNextRollResult(rollData);
    } else {
      debug.error('❌ Failed to post roll to Roll20');
    }
  }

  /**
   * Observes Roll20 chat for the next roll result and checks for natural 1s/20s
   */
  function observeNextRollResult(originalRollData) {
    debug.log('👀 Setting up observer for Roll20 roll result...');

    const chatLog = document.querySelector('#textchat .content');
    if (!chatLog) {
      debug.error('❌ Could not find Roll20 chat log');
      return;
    }

    // Create observer to watch for new messages
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this is a message with an inline roll
            const inlineRoll = node.querySelector('.inlinerollresult');
            if (inlineRoll) {
              debug.log('🎲 Found new Roll20 inline roll:', inlineRoll);

              // Parse the roll result from Roll20's display
              const rollResult = parseRoll20InlineRoll(inlineRoll, originalRollData);

              if (rollResult) {
                debug.log('🎲 Parsed Roll20 roll result:', rollResult);

                // Check for natural 1s or 20s
                if (rollResult.baseRoll === 1 || rollResult.baseRoll === 20) {
                  const rollType = rollResult.baseRoll === 1 ? 'Natural 1' : 'Natural 20';
                  debug.log(`🎯 ${rollType} detected in Roll20 roll!`);

                  // Send to popup for racial trait checking
                  browserAPI.runtime.sendMessage({
                    action: 'rollResult',
                    rollResult: rollResult.total.toString(),
                    baseRoll: rollResult.baseRoll.toString(),
                    rollType: originalRollData.formula,
                    rollName: originalRollData.name,
                    checkRacialTraits: true
                  });

                  debug.log(`🧬 Sent ${rollType} result to popup`);
                }
              }

              // Disconnect after processing first roll
              observer.disconnect();
              break;
            }
          }
        }
      }
    });

    // Start observing
    observer.observe(chatLog, { childList: true, subtree: true });
    debug.log('✅ Observer set up for Roll20 chat');

    // Auto-disconnect after 5 seconds to prevent memory leaks
    setTimeout(() => {
      observer.disconnect();
      debug.log('⏱️ Roll observer timed out and disconnected');
    }, 5000);
  }

  /**
   * Parses Roll20's inline roll result to extract the base d20 roll
   */
  function parseRoll20InlineRoll(inlineRollElement, originalRollData) {
    try {
      // Roll20 inline rolls have a title attribute with the full roll breakdown
      // e.g., "Rolling 1d20+5 = (<span class="basicdiceroll">17</span>)+5"
      const title = inlineRollElement.getAttribute('title') || '';
      debug.log('📊 Roll20 inline roll title:', title);

      // Strip HTML tags from the title to get plain text
      const plainTitle = title.replace(/<[^>]*>/g, '');
      debug.log('📊 Plain title:', plainTitle);

      // Extract the base roll from parentheses in the title
      // Format after stripping HTML: "Rolling 1d20+5 = (17)+5" or "Rolling 1d20 = (1)"
      const baseRollMatch = plainTitle.match(/=\s*\(\s*(\d+)\s*\)/);
      const baseRoll = baseRollMatch ? parseInt(baseRollMatch[1]) : null;

      // Get the total from the visible text
      const totalText = inlineRollElement.textContent?.trim() || '';
      const total = parseInt(totalText);

      debug.log(`📊 Extracted: baseRoll=${baseRoll}, total=${total}`);

      // Only return if we successfully extracted a d20 roll (1-20)
      if (baseRoll && baseRoll >= 1 && baseRoll <= 20) {
        return {
          baseRoll: baseRoll,
          total: total,
          formula: originalRollData.formula,
          name: originalRollData.name
        };
      }

      return null;
    } catch (error) {
      debug.error('❌ Error parsing Roll20 inline roll:', error);
      return null;
    }
  }

  /**
   * Calculates the base d20 roll from formula and final result
   */
  function calculateBaseRoll(formula, result) {
    try {
      debug.log(`🧮 Calculating base roll - Formula: "${formula}", Result: "${result}"`);
      
      // Parse the formula to extract the modifier
      // Formula format: "1d20+X" or "1d20-X"
      const modifierMatch = formula.match(/1d20([+-]\d+)/i);
      
      if (modifierMatch) {
        const modifier = parseInt(modifierMatch[1]);
        const totalResult = parseInt(result);
        const baseRoll = totalResult - modifier;
        
        debug.log(`🧮 Calculation: ${totalResult} - (${modifier}) = ${baseRoll}`);
        
        // Ensure the base roll is within valid d20 range (1-20)
        if (baseRoll >= 1 && baseRoll <= 20) {
          return baseRoll;
        } else {
          debug.warn(`⚠️ Calculated base roll ${baseRoll} is outside valid d20 range (1-20)`);
          return baseRoll; // Still return it, but log warning
        }
      } else {
        // No modifier found, assume the result is the base roll
        debug.log(`🧮 No modifier found in formula, using result as base roll: ${result}`);
        return parseInt(result);
      }
    } catch (error) {
      debug.error('❌ Error calculating base roll:', error);
      return parseInt(result); // Fallback to using the result directly
    }
  }

  /**
   * Checks Roll20's inline roll elements for natural 1s
   */
  function checkRoll20InlineRolls(characterName) {
    debug.log('🔍 Checking Roll20 inline rolls for natural 1s for:', characterName);
    
    // Find all inline roll elements
    const inlineRolls = document.querySelectorAll('.inlinerollresult, .rollresult');
    debug.log(`🔍 Found ${inlineRolls.length} inline roll elements`);
    
    inlineRolls.forEach((rollElement, index) => {
      try {
        // Get the roll data from Roll20's inline roll system
        const rollData = getRoll20RollData(rollElement);
        debug.log(`🔍 Checking inline roll ${index + 1}:`, rollData);
        
        if (rollData && rollData.baseRoll === 1 && rollData.name.includes(characterName)) {
          debug.log('🍀 Natural 1 detected in Roll20 inline roll!');
          debug.log('🍀 Roll data:', rollData);
          
          // Send message to popup for Halfling Luck
          browserAPI.runtime.sendMessage({
            action: 'rollResult',
            rollResult: rollData.total.toString(),
            baseRoll: rollData.baseRoll.toString(),
            rollType: rollData.formula,
            rollName: rollData.name,
            checkRacialTraits: true
          });
          
          debug.log('🧬 Sent natural 1 result to popup for Halfling Luck');
        }
      } catch (error) {
        debug.warn('⚠️ Error checking inline roll:', error);
      }
    });
    
    debug.log('🔍 Finished checking inline rolls');
  }

  /**
   * Extracts roll data from Roll20's inline roll elements
   */
  function getRoll20RollData(rollElement) {
    try {
      // Roll20 stores roll data in the element's dataset or in a script tag
      const rollName = rollElement.closest('.message')?.querySelector('.message-name')?.textContent || 
                     rollElement.closest('.message')?.textContent?.split('\n')[0]?.trim() || '';
      
      // Try to get the roll formula from the inline roll
      const formulaElement = rollElement.querySelector('.formula') || rollElement;
      const formula = formulaElement.textContent?.trim() || '';
      
      // Look for the base roll value in the roll details
      const rollDetails = rollElement.textContent || rollElement.innerText || '';
      const baseRollMatch = rollDetails.match(/^(\d+)/);
      const baseRoll = baseRollMatch ? parseInt(baseRollMatch[1]) : null;
      
      // Look for the total result
      const totalMatch = rollDetails.match(/(\d+)\s*$/);
      const total = totalMatch ? parseInt(totalMatch[1]) : baseRoll;
      
      debug.log(`🔍 Extracted roll data - Name: ${rollName}, Formula: ${formula}, Base: ${baseRoll}, Total: ${total}`);
      
      return {
        name: rollName,
        formula: formula,
        baseRoll: baseRoll,
        total: total
      };
    } catch (error) {
      debug.warn('⚠️ Error extracting roll data:', error);
      return null;
    }
  }

  /**
   * Formats roll data for Roll20 chat display with fancy template
   */
  function formatRollForRoll20(rollData) {
    const { name, formula, result } = rollData;

    // Use Roll20's template system with inline rolls for fancy formatting
    // [[formula]] creates an inline roll that Roll20 will calculate
    return `&{template:default} {{name=${name}}} {{Roll=[[${formula}]]}}`;
  }

  /**
   * Listen for messages from other parts of the extension
   */
  browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debug.log('📨 Roll20 content script received message:', request.action, request);
    
    if (request.action === 'postRollToChat') {
      handleDiceCloudRoll(request.roll);
      sendResponse({ success: true });
    } else if (request.action === 'sendRollToRoll20') {
      // Handle the message that Dice Cloud is actually sending
      debug.log('🎲 Received sendRollToRoll20 message:', request.roll);
      handleDiceCloudRoll(request.roll);
      sendResponse({ success: true });
    } else if (request.action === 'rollFromPopout') {
      // Post roll directly to Roll20 - no DiceCloud needed!
      debug.log('🎲 Received roll request from popup:', request);

      const rollData = {
        name: request.name || request.roll?.name,
        formula: request.formula || request.roll?.formula,
        characterName: request.characterName || request.roll?.characterName
      };

      // Check if silent rolls mode is enabled - if so, hide the roll instead of posting
      if (silentRollsEnabled) {
        debug.log('🔇 Silent rolls active - hiding roll instead of posting');
        const hiddenRoll = {
          id: Date.now() + Math.random(), // Unique ID
          name: rollData.name,
          formula: rollData.formula,
          characterName: rollData.characterName,
          timestamp: new Date().toLocaleTimeString(),
          result: null // Will be filled when revealed
        };
        hiddenRolls.push(hiddenRoll);
        updateHiddenRollsDisplay();
        sendResponse({ success: true, hidden: true });
      } else {
        // Normal flow - post to Roll20 chat
        const formattedMessage = formatRollForRoll20(rollData);
        const success = postChatMessage(formattedMessage);

        if (success) {
          debug.log('✅ Roll posted directly to Roll20 (no DiceCloud!)');
          // Observe Roll20's result for natural 1s/20s
          observeNextRollResult(rollData);
        }

        sendResponse({ success: success });
      }
    } else if (request.action === 'announceSpell') {
      // Handle spell/action announcements relayed from background script (Firefox)
      if (request.message) {
        postChatMessage(request.message);
      } else {
        handleDiceCloudRoll(request);
      }
      sendResponse({ success: true });
    } else if (request.action === 'postChatMessageFromPopup') {
      // Handle character broadcast messages from popup
      if (request.message) {
        debug.log('📨 Received postChatMessageFromPopup:', request.message);
        const success = postChatMessage(request.message);
        sendResponse({ success: success });
      } else {
        debug.warn('⚠️ postChatMessageFromPopup missing message');
        sendResponse({ success: false, error: 'No message provided' });
      }
    } else if (request.action === 'testRoll20Connection') {
      // Test if we can access Roll20 chat
      const chatInput = document.querySelector('#textchat-input textarea');
      sendResponse({
        success: !!chatInput,
        message: chatInput ? 'Roll20 chat accessible' : 'Roll20 chat not found'
      });
    } else if (request.action === 'showCharacterSheet') {
      // Show the character sheet overlay
      try {
        // Try to access the character sheet overlay script
        // This will work if the overlay is already loaded
        const overlayElement = document.getElementById('rollcloud-character-overlay');
        if (overlayElement) {
          overlayElement.style.display = 'block';
          sendResponse({ success: true });
        } else {
          // Try to trigger the overlay creation
          const event = new CustomEvent('showRollCloudSheet');
          document.dispatchEvent(event);
          sendResponse({ success: true });
        }
      } catch (error) {
        debug.error('Error showing character sheet:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else if (request.action === 'forwardToPopup') {
      // Forward roll result to popup for racial traits checking
      debug.log('🧬 Forwarding roll result to popup:', request);
      debug.log('🧬 Available popups:', Object.keys(characterPopups));
      
      // Send to all registered popup windows
      Object.keys(characterPopups).forEach(characterName => {
        const popup = characterPopups[characterName];
        try {
          if (popup && !popup.closed) {
            debug.log(`🧬 Sending to popup for ${characterName}:`, popup);
            popup.postMessage({
              action: 'rollResult',
              rollResult: request.rollResult,
              baseRoll: request.baseRoll,
              rollType: request.rollType,
              rollName: request.rollName,
              checkRacialTraits: request.checkRacialTraits
            }, '*');
            
            debug.log(`📤 Sent rollResult to popup for ${characterName}`);
          } else {
            // Clean up closed popups
            delete characterPopups[characterName];
            debug.log(`🗑️ Removed closed popup for ${characterName}`);
          }
        } catch (error) {
          debug.warn(`⚠️ Error sending rollResult to popup "${characterName}":`, error);
          delete characterPopups[characterName];
        }
      });
      
      sendResponse({ success: true });
    }
  });

  /**
   * Listen for messages from popup windows
   */
  window.addEventListener('message', (event) => {
    if (event.data.action === 'postRollToChat') {
      handleDiceCloudRoll(event.data.roll);
    } else if (event.data.action === 'postChat') {
      // Handle general chat messages (like spell descriptions)
      postChatMessage(event.data.message);
    } else if (event.data.action === 'rollFromPopout') {
      // Post roll directly to Roll20 - no DiceCloud needed!
      debug.log('🎲 Received roll request from popup via postMessage:', event.data);

      const rollData = {
        name: event.data.name,
        formula: event.data.formula,
        characterName: event.data.characterName
      };

      // Check if silent rolls mode is enabled - if so, hide the roll instead of posting
      if (silentRollsEnabled) {
        debug.log('🔇 Silent rolls active - hiding roll instead of posting');
        const hiddenRoll = {
          id: Date.now() + Math.random(), // Unique ID
          name: rollData.name,
          formula: rollData.formula,
          characterName: rollData.characterName,
          timestamp: new Date().toLocaleTimeString(),
          result: null // Will be filled when revealed
        };
        hiddenRolls.push(hiddenRoll);
        updateHiddenRollsDisplay();

        // Send confirmation back to popup
        if (event.source) {
          event.source.postMessage({
            action: 'rollHidden',
            roll: hiddenRoll
          }, '*');
        }
      } else {
        // Normal flow - post to Roll20 chat
        const formattedMessage = formatRollForRoll20(rollData);
        const success = postChatMessage(formattedMessage);

        if (success) {
          debug.log('✅ Roll posted directly to Roll20 (no DiceCloud!)');
          // Observe Roll20's result for natural 1s/20s
          observeNextRollResult(rollData);
        }
      }
    } else if (event.data.action === 'announceSpell') {
      // Handle spell/action announcements with pre-formatted messages
      if (event.data.message) {
        postChatMessage(event.data.message);
      } else {
        handleDiceCloudRoll(event.data);
      }
    }
  });

  // ============================================================================
  // GM INITIATIVE TRACKER
  // ============================================================================

  let gmModeEnabled = false;
  let silentRollsEnabled = false; // Separate toggle for silent rolls
  let gmPanel = null;
  const characterPopups = {}; // Track popup windows by character name
  let combatStarted = false; // Track if combat has been initiated
  let initiativeTracker = {
    combatants: [],
    currentTurnIndex: 0,
    round: 1,
    delayedCombatants: [] // Track combatants who have delayed their turn
  };
  let hiddenRolls = []; // Store hidden GM rolls
  let turnHistory = []; // Store turn history for logging
  let playerData = {}; // Store player overview data { characterName: { hp, maxHp, ac, etc } }

  /**
   * Create GM Initiative Tracker Panel
   */
  function createGMPanel() {
    if (gmPanel) return gmPanel;

    // Create panel
    gmPanel = document.createElement('div');
    gmPanel.id = 'gm-panel';
    gmPanel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 500px;
      height: 600px;
      min-width: 400px;
      min-height: 400px;
      max-width: 90vw;
      max-height: 90vh;
      background: #1e1e1e;
      border: 2px solid #4ECDC4;
      border-radius: 12px;
      z-index: 999998;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #fff;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      resize: both;
    `;

    // Create tab content containers
    const initiativeTab = document.createElement('div');
    initiativeTab.className = 'gm-tab-content';
    initiativeTab.dataset.tab = 'initiative';
    initiativeTab.style.display = 'block';

    const hiddenRollsTab = document.createElement('div');
    hiddenRollsTab.className = 'gm-tab-content';
    hiddenRollsTab.dataset.tab = 'hidden-rolls';
    hiddenRollsTab.style.display = 'none';

    const playersTab = document.createElement('div');
    playersTab.className = 'gm-tab-content';
    playersTab.dataset.tab = 'players';
    playersTab.style.display = 'none';

    const historyTab = document.createElement('div');
    historyTab.className = 'gm-tab-content';
    historyTab.dataset.tab = 'history';
    historyTab.style.display = 'none';

    // ===== INITIATIVE TAB CONTENT =====
    const controls = document.createElement('div');
    controls.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 15px;
    `;
    controls.innerHTML = `
      <button id="start-combat-btn" style="padding: 12px; background: #27ae60; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1em; grid-column: span 2; box-shadow: 0 2px 8px rgba(39, 174, 96, 0.3);">⚔️ Start Combat</button>
      <button id="prev-turn-btn" style="padding: 8px 12px; background: #3498db; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85em; display: none;">← Prev</button>
      <button id="next-turn-btn" style="padding: 8px 12px; background: #4ECDC4; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85em; display: none;">Next →</button>
      <button id="clear-all-btn" style="padding: 8px 12px; background: #e74c3c; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85em; grid-column: span 2;">🗑️ Clear All</button>
    `;

    const roundDisplay = document.createElement('div');
    roundDisplay.id = 'round-display';
    roundDisplay.style.cssText = `
      text-align: center;
      padding: 8px;
      background: #34495e;
      border-radius: 6px;
      margin-bottom: 15px;
      font-weight: bold;
    `;
    roundDisplay.textContent = 'Round 1';

    const initiativeList = document.createElement('div');
    initiativeList.id = 'initiative-list';
    initiativeList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 15px;
    `;

    const addFormSection = document.createElement('div');
    addFormSection.style.cssText = `
      margin-top: 15px;
      padding-top: 15px;
      border-top: 2px solid #34495e;
    `;

    const addFormHeader = document.createElement('div');
    addFormHeader.style.cssText = `
      cursor: pointer;
      user-select: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      margin-bottom: 10px;
      background: #34495e;
      border-radius: 6px;
      font-weight: bold;
      transition: background 0.2s;
    `;
    addFormHeader.innerHTML = `
      <span>➕ Add Combatant</span>
      <span id="add-form-toggle" style="transition: transform 0.3s; transform: rotate(-90deg);">▼</span>
    `;

    const addForm = document.createElement('div');
    addForm.id = 'add-combatant-form';
    addForm.style.cssText = `
      display: block;
      transition: max-height 0.3s ease-out, opacity 0.3s ease-out;
      overflow: hidden;
      max-height: 0;
      opacity: 0;
    `;
    addForm.innerHTML = `
      <input type="text" id="combatant-name-input" placeholder="Combatant name" style="width: 100%; padding: 8px; margin-bottom: 8px; border: 2px solid #34495e; border-radius: 4px; background: #34495e; color: #fff; font-size: 0.9em;" />
      <input type="number" id="combatant-init-input" placeholder="Initiative" style="width: 100%; padding: 8px; margin-bottom: 8px; border: 2px solid #34495e; border-radius: 4px; background: #34495e; color: #fff; font-size: 0.9em;" />
      <button id="add-combatant-btn" style="width: 100%; padding: 8px 12px; background: #3498db; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">➕ Add</button>
    `;

    addFormSection.appendChild(addFormHeader);
    addFormSection.appendChild(addForm);

    // Add initiative content to initiative tab
    initiativeTab.appendChild(controls);
    initiativeTab.appendChild(roundDisplay);
    initiativeTab.appendChild(initiativeList);
    initiativeTab.appendChild(addFormSection);

    // ===== HIDDEN ROLLS TAB CONTENT =====
    hiddenRollsTab.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #888;">
        <div style="font-size: 3em; margin-bottom: 10px;">🎲</div>
        <p style="margin: 0;">No hidden rolls yet</p>
        <p style="font-size: 0.85em; margin-top: 8px;">Rolls made while GM Mode is active will appear here</p>
      </div>
      <div id="hidden-rolls-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
    `;

    // ===== PLAYER OVERVIEW TAB CONTENT =====
    playersTab.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; font-size: 1.2em; color: #4ECDC4;">Party Overview</h3>
        <div style="display: flex; gap: 8px;">
          <button id="import-players-btn" style="padding: 8px 14px; background: #27ae60; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95em; font-weight: bold;">📥 Import</button>
          <button id="refresh-players-btn" style="padding: 8px 14px; background: #9b59b6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95em; font-weight: bold;">🔄 Refresh</button>
        </div>
      </div>
      <div style="text-align: center; padding: 20px; color: #888;">
        <div style="font-size: 3em; margin-bottom: 10px;">👥</div>
        <p style="margin: 0; font-size: 1.1em;">No players tracked yet</p>
        <p style="font-size: 1em; margin-top: 8px;">Click Import to load character data from storage</p>
      </div>
      <div id="player-overview-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
    `;

    // ===== TURN HISTORY TAB CONTENT =====
    historyTab.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; font-size: 1em; color: #4ECDC4;">Last 10 Turns</h3>
        <button id="export-history-btn" style="padding: 6px 12px; background: #3498db; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8em;">📋 Copy</button>
      </div>
      <div style="text-align: center; padding: 20px; color: #888;">
        <div style="font-size: 3em; margin-bottom: 10px;">📜</div>
        <p style="margin: 0;">No turn history yet</p>
        <p style="font-size: 0.85em; margin-top: 8px;">Combat actions will be logged here</p>
      </div>
      <div id="turn-history-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
    `;

    // ===== CREATE HEADER =====
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px;
      background: #1e1e1e;
      border-bottom: 2px solid #4ECDC4;
      cursor: move;
      user-select: none;
    `;
    header.innerHTML = `
      <div>
        <h2 style="margin: 0; font-size: 1.2em; color: #4ECDC4;">👑 GM Panel</h2>
        <div style="display: flex; align-items: center; gap: 15px; margin-top: 8px;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9em; color: #aaa; cursor: pointer;">
            <input type="checkbox" id="silent-rolls-toggle" style="width: 16px; height: 16px; cursor: pointer;" />
            <span>🔇 Silent Rolls</span>
          </label>
        </div>
      </div>
      <button id="gm-panel-close" style="background: #e74c3c; color: #fff; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9em;">✖</button>
    `;

    // ===== CREATE TAB NAVIGATION =====
    const tabNav = document.createElement('div');
    tabNav.style.cssText = `
      display: flex;
      gap: 0;
      background: #1e1e1e;
      border-bottom: 1px solid #34495e;
    `;
    tabNav.innerHTML = `
      <button class="gm-tab-btn" data-tab="initiative" style="flex: 1; padding: 12px; background: #2a2a2a; color: #4ECDC4; border: none; border-bottom: 3px solid #4ECDC4; cursor: pointer; font-weight: bold; font-size: 0.9em; transition: all 0.2s;">⚔️ Initiative</button>
      <button class="gm-tab-btn" data-tab="history" style="flex: 1; padding: 12px; background: transparent; color: #888; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: bold; font-size: 0.9em; transition: all 0.2s;">📜 History</button>
      <button class="gm-tab-btn" data-tab="hidden-rolls" style="flex: 1; padding: 12px; background: transparent; color: #888; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: bold; font-size: 0.9em; transition: all 0.2s;">🎲 Hidden Rolls</button>
      <button class="gm-tab-btn" data-tab="players" style="flex: 1; padding: 12px; background: transparent; color: #888; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: bold; font-size: 0.9em; transition: all 0.2s;">👥 Players</button>
    `;

    // ===== CREATE CONTENT WRAPPER =====
    const contentWrapper = document.createElement('div');
    contentWrapper.style.cssText = `
      padding: 15px;
      background: #2a2a2a;
      color: #fff;
      border-radius: 0 0 12px 12px;
      overflow-y: auto;
      flex: 1;
    `;

    // Assemble all tabs into content wrapper
    contentWrapper.appendChild(initiativeTab);
    contentWrapper.appendChild(hiddenRollsTab);
    contentWrapper.appendChild(playersTab);
    contentWrapper.appendChild(historyTab);

    // Assemble panel
    gmPanel.appendChild(header);
    gmPanel.appendChild(tabNav);
    gmPanel.appendChild(contentWrapper);
    document.body.appendChild(gmPanel);

    // Make draggable
    makeDraggable(gmPanel, header);

    // Start listening for character broadcasts
    startCharacterBroadcastListener();

    // Load player data from storage
    loadPlayerDataFromStorage();
    
    // Test storage functionality immediately
    debug.log('🧪 Testing storage functionality...');
    
    // Test 1: Promise-based API
    if (browserAPI.storage.local.get instanceof Function) {
      browserAPI.storage.local.get(['characterProfiles']).then(result => {
        debug.log('🧪 Promise storage test result:', result);
        if (result.characterProfiles) {
          debug.log('🧪 Found characterProfiles:', Object.keys(result.characterProfiles));
          Object.keys(result.characterProfiles).forEach(key => {
            debug.log(`🧪 Profile ${key}:`, result.characterProfiles[key].type);
          });
        } else {
          debug.log('🧪 No characterProfiles found in storage (Promise)');
        }
      }).catch(error => {
        debug.error('🧪 Promise storage error:', error);
      });
    }
    
    // Test 2: Callback-based API (fallback)
    try {
      browserAPI.storage.local.get(['characterProfiles'], (result) => {
        debug.log('🧪 Callback storage test result:', result);
        if (browserAPI.runtime.lastError) {
          debug.error('🧪 Callback storage error:', browserAPI.runtime.lastError);
        } else if (result.characterProfiles) {
          debug.log('🧪 Found characterProfiles (callback):', Object.keys(result.characterProfiles));
        } else {
          debug.log('🧪 No characterProfiles found in storage (callback)');
        }
      });
    } catch (error) {
      debug.error('🧪 Callback storage test failed:', error);
    }

    // Attach event listeners
    attachGMPanelListeners();

    debug.log('✅ GM Panel created');
    return gmPanel;
  }

  /**
   * Start listening for character broadcasts from players
   */
  function startCharacterBroadcastListener() {
    // Monitor chat for character broadcasts
    const chatObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check for character broadcast messages
            const messageContent = node.textContent || node.innerText || '';
            debug.log('🔍 Chat message detected:', messageContent.substring(0, 100));
            if (messageContent.includes('👑[ROLLCLOUD:CHARACTER:') && messageContent.includes(']👑')) {
              debug.log('👑 Detected character broadcast in chat');
              parseCharacterBroadcast(messageContent);
            }
          }
        });
      });
    });

    // Find the chat container and observe it
    const chatContainer = document.querySelector('.chat-content') || 
                         document.querySelector('.chatlog') || 
                         document.querySelector('#textchat') ||
                         document.querySelector('.chat');

    if (chatContainer) {
      chatObserver.observe(chatContainer, {
        childList: true,
        subtree: true
      });
      debug.log('👑 Started listening for character broadcasts in chat');
    } else {
      debug.warn('⚠️ Could not find chat container for character broadcast listener');
    }
  }

  /**
   * Parse character broadcast message and import data
   */
  function parseCharacterBroadcast(message) {
    try {
      // Extract the encoded data
      const match = message.match(/👑\[ROLLCLOUD:CHARACTER:(.+?)\]👑/);
      if (!match) {
        debug.warn('⚠️ Invalid character broadcast format');
        return;
      }

      const encodedData = match[1];
      const decodedData = JSON.parse(decodeURIComponent(escape(atob(encodedData))));
      
      if (decodedData.type !== 'ROLLCLOUD_CHARACTER_BROADCAST') {
        debug.warn('⚠️ Not a character broadcast message');
        return;
      }

      const character = decodedData.character;
      const fullSheet = decodedData.fullSheet || character; // Use full sheet if available
      debug.log('👑 Received character broadcast:', character.name);
      debug.log('🔍 Full sheet data keys:', fullSheet ? Object.keys(fullSheet) : 'null');
      debug.log('🔍 Full sheet sample:', fullSheet ? JSON.stringify(fullSheet, null, 2).substring(0, 500) + '...' : 'null');

      // Import COMPLETE character data to GM panel
      updatePlayerData(character.name, fullSheet);
      
      // Show notification to GM
      debug.log(`✅ ${character.name} shared their character sheet! 👑`);
      
    } catch (error) {
      debug.error('❌ Error parsing character broadcast:', error);
    }
  }

  /**
   * Make element draggable with boundary constraints
   */
  function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;

      // Calculate new position
      let newTop = element.offsetTop - pos2;
      let newLeft = element.offsetLeft - pos1;

      // Apply boundary constraints
      const minTop = 0;
      const minLeft = 0;
      const maxLeft = window.innerWidth - element.offsetWidth;
      const maxTop = window.innerHeight - element.offsetHeight;

      // Constrain within viewport
      newTop = Math.max(minTop, Math.min(newTop, maxTop));
      newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));

      element.style.top = newTop + "px";
      element.style.left = newLeft + "px";
      element.style.right = 'auto';
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  /**
   * Attach event listeners to GM panel controls
   */
  function attachGMPanelListeners() {
    // Silent rolls toggle
    const silentRollsToggle = document.getElementById('silent-rolls-toggle');
    if (silentRollsToggle) {
      silentRollsToggle.addEventListener('change', (e) => {
        silentRollsEnabled = e.target.checked;
        debug.log(`🔇 Silent rolls ${silentRollsEnabled ? 'enabled' : 'disabled'}`);
        
        // Update hidden rolls tab description
        const hiddenRollsTab = gmPanel.querySelector('[data-tab="hidden-rolls"]');
        if (hiddenRollsTab) {
          const description = hiddenRollsTab.querySelector('p:nth-child(2)');
          if (description) {
            description.textContent = silentRollsEnabled 
              ? 'Rolls made while silent rolls is enabled will appear here'
              : 'Rolls made while GM Mode is active will appear here';
          }
        }
      });
    }

    // Tab switching
    const tabButtons = gmPanel.querySelectorAll('.gm-tab-btn');
    const tabContents = gmPanel.querySelectorAll('.gm-tab-content');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;

        // Update button styles
        tabButtons.forEach(b => {
          if (b.dataset.tab === targetTab) {
            b.style.background = '#2a2a2a';
            b.style.color = '#4ECDC4';
            b.style.borderBottom = '3px solid #4ECDC4';
          } else {
            b.style.background = 'transparent';
            b.style.color = '#888';
            b.style.borderBottom = '3px solid transparent';
          }
        });

        // Show target tab content, hide others
        tabContents.forEach(content => {
          content.style.display = content.dataset.tab === targetTab ? 'block' : 'none';
        });

        debug.log(`📑 Switched to GM tab: ${targetTab}`);
      });
    });

    // Close button
    const closeBtn = document.getElementById('gm-panel-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => toggleGMMode(false));
    }

    // Turn controls
    const startCombatBtn = document.getElementById('start-combat-btn');
    const nextBtn = document.getElementById('next-turn-btn');
    const prevBtn = document.getElementById('prev-turn-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');

    debug.log('🔍 GM Panel controls found:', {
      startCombatBtn: !!startCombatBtn,
      nextBtn: !!nextBtn,
      prevBtn: !!prevBtn,
      clearAllBtn: !!clearAllBtn
    });

    if (startCombatBtn) startCombatBtn.addEventListener('click', startCombat);
    if (nextBtn) nextBtn.addEventListener('click', nextTurn);
    if (prevBtn) prevBtn.addEventListener('click', prevTurn);
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllCombatants);

    // Collapsible add form toggle
    const addFormHeader = gmPanel.querySelector('div[style*="cursor: pointer"]');
    const addForm = document.getElementById('add-combatant-form');
    const addFormToggle = document.getElementById('add-form-toggle');
    let isFormCollapsed = true; // Start collapsed

    if (addFormHeader && addForm && addFormToggle) {
      addFormHeader.addEventListener('click', () => {
        isFormCollapsed = !isFormCollapsed;
        if (isFormCollapsed) {
          addForm.style.maxHeight = '0';
          addForm.style.opacity = '0';
          addFormToggle.style.transform = 'rotate(-90deg)';
        } else {
          addForm.style.maxHeight = '500px';
          addForm.style.opacity = '1';
          addFormToggle.style.transform = 'rotate(0deg)';
        }
      });
    }

    // Add combatant form
    const addBtn = document.getElementById('add-combatant-btn');
    const nameInput = document.getElementById('combatant-name-input');
    const initInput = document.getElementById('combatant-init-input');

    if (addBtn && nameInput && initInput) {
      addBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        const initiative = parseInt(initInput.value);
        if (name && !isNaN(initiative)) {
          addCombatant(name, initiative, 'manual');
          nameInput.value = '';
          initInput.value = '';
        }
      });

      // Enter key to add
      initInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          addBtn.click();
        }
      });
    }

    // Export turn history button
    const exportHistoryBtn = document.getElementById('export-history-btn');
    if (exportHistoryBtn) {
      exportHistoryBtn.addEventListener('click', exportTurnHistory);
    }

    // Import players button
    const importPlayersBtn = document.getElementById('import-players-btn');
    if (importPlayersBtn) {
      importPlayersBtn.addEventListener('click', importPlayerData);
    }

    // Refresh players button
    const refreshPlayersBtn = document.getElementById('refresh-players-btn');
    if (refreshPlayersBtn) {
      refreshPlayersBtn.addEventListener('click', () => {
        updatePlayerOverviewDisplay();
        debug.log('🔄 Refreshed player overview');
      });
    }

    debug.log('✅ GM Panel listeners attached');
  }

  /**
   * Update Hidden Rolls Display
   */
  function updateHiddenRollsDisplay() {
    const hiddenRollsList = document.getElementById('hidden-rolls-list');
    if (!hiddenRollsList) return;

    if (hiddenRolls.length === 0) {
      hiddenRollsList.innerHTML = '';
      // Show empty state if tab content exists
      const tabContent = gmPanel.querySelector('[data-tab="hidden-rolls"]');
      if (tabContent) {
        const emptyState = tabContent.querySelector('div[style*="text-align: center"]');
        if (emptyState) emptyState.style.display = 'block';
      }
      return;
    }

    // Hide empty state
    const tabContent = gmPanel.querySelector('[data-tab="hidden-rolls"]');
    if (tabContent) {
      const emptyState = tabContent.querySelector('div[style*="text-align: center"]');
      if (emptyState) emptyState.style.display = 'none';
    }

    hiddenRollsList.innerHTML = hiddenRolls.map((roll, index) => `
      <div style="background: #34495e; padding: 12px; border-radius: 8px; border-left: 4px solid #f39c12;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <div style="flex: 1;">
            <div style="font-weight: bold; color: #f39c12; margin-bottom: 4px;">${roll.characterName}</div>
            <div style="font-size: 0.9em; color: #ccc;">${roll.name}</div>
            <div style="font-size: 0.85em; color: #888; margin-top: 4px;">${roll.timestamp}</div>
          </div>
          <div style="font-size: 1.2em; color: #f39c12;">🔒</div>
        </div>
        <div style="background: #2c3e50; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 0.9em; margin-bottom: 10px;">
          ${roll.formula}
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="reveal-roll-btn" data-roll-id="${roll.id}" style="flex: 1; padding: 8px; background: #27ae60; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85em;">
            📢 Publish Roll
          </button>
          <button class="delete-roll-btn" data-roll-id="${roll.id}" style="padding: 8px 12px; background: #e74c3c; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85em;">
            🗑️
          </button>
        </div>
      </div>
    `).join('');

    // Add event listeners to reveal and delete roll buttons
    const revealRollBtns = hiddenRollsList.querySelectorAll('.reveal-roll-btn');
    const deleteRollBtns = hiddenRollsList.querySelectorAll('.delete-roll-btn');

    revealRollBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const rollId = btn.dataset.rollId;
        revealHiddenRoll(rollId);
      });
    });

    deleteRollBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const rollId = btn.dataset.rollId;
        deleteHiddenRoll(rollId);
      });
    });

    debug.log(`📋 Updated hidden rolls display: ${hiddenRolls.length} rolls`);
  }

  /**
   * Reveal a hidden roll (post it to Roll20 chat)
   */
  window.revealHiddenRoll = function(rollId) {
    const rollIndex = hiddenRolls.findIndex(r => r.id === rollId);
    if (rollIndex === -1) return;

    const roll = hiddenRolls[rollIndex];
    debug.log('🔓 Revealing hidden roll:', roll);

    // Format the message as "GM roll: [Name] rolled [roll name]! **[calculated value]**"
    // Use Roll20's inline roll syntax [[formula]] to evaluate the roll
    const formattedMessage = `GM roll: **${roll.characterName}** rolled ${roll.name}! **[[${roll.formula}]]**`;
    const success = postChatMessage(formattedMessage);

    if (success) {
      debug.log('✅ Hidden roll revealed to Roll20');
      // Remove from hidden rolls
      hiddenRolls.splice(rollIndex, 1);
      updateHiddenRollsDisplay();
    } else {
      debug.error('❌ Failed to reveal hidden roll');
    }
  };

  /**
   * Delete a hidden roll without revealing
   */
  window.deleteHiddenRoll = function(rollId) {
    const rollIndex = hiddenRolls.findIndex(r => r.id === rollId);
    if (rollIndex === -1) return;

    hiddenRolls.splice(rollIndex, 1);
    updateHiddenRollsDisplay();
    debug.log('🗑️ Deleted hidden roll');
  };

  /**
   * Create player header HTML
   */
  function createPlayerHeader(name, player, playerId) {
    const hpPercent = player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0;
    const hpColor = hpPercent > 50 ? '#27ae60' : hpPercent > 25 ? '#f39c12' : '#e74c3c';
    
    return `
      <div style="background: #34495e; border-radius: 8px; border-left: 4px solid ${hpColor}; overflow: hidden;">
        <!-- Player Header (always visible) -->
        <div class="player-header-btn" data-player-name="${name}" style="padding: 12px; cursor: pointer; user-select: none; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;" onmouseover="this.style.background='#3d5a6e'" onmouseout="this.style.background='transparent'">
          <div style="flex: 1;">
            <div style="font-weight: bold; font-size: 1.1em; color: #4ECDC4; margin-bottom: 4px;">${name}</div>
            <div style="display: flex; gap: 12px; font-size: 0.95em; color: #ccc;">
              <span>HP: ${player.hp}/${player.maxHp}</span>
              <span>AC: ${player.ac || '—'}</span>
              <span>Init: ${player.initiative || '—'}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="${playerId}-toggle" style="transition: transform 0.3s; transform: rotate(-90deg); color: #888; font-size: 1.1em;">▼</span>
            <button class="player-delete-btn" data-player-name="${name}" style="padding: 4px 8px; background: #e74c3c; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8em; font-weight: bold;" title="Remove player">🗑️</button>
          </div>
        </div>
    `;
  }

  /**
   * Update Player Overview Display
   */
  function updatePlayerOverviewDisplay() {
    const playerOverviewList = document.getElementById('player-overview-list');
    if (!playerOverviewList) return;

    const players = Object.keys(playerData);

    if (players.length === 0) {
      playerOverviewList.innerHTML = '';
      // Show empty state
      const tabContent = gmPanel.querySelector('[data-tab="players"]');
      if (tabContent) {
        const emptyState = tabContent.querySelector('div[style*="text-align: center"]');
        if (emptyState) emptyState.style.display = 'block';
      }
      return;
    }

    // Hide empty state
    const tabContent = gmPanel.querySelector('[data-tab="players"]');
    if (tabContent) {
      const emptyState = tabContent.querySelector('div[style*="text-align: center"]');
      if (emptyState) emptyState.style.display = 'none';
    }

    playerOverviewList.innerHTML = players.map((name, index) => {
      const player = playerData[name];
      const playerId = `player-${index}`;
      const hpPercent = player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0;
      const hpColor = hpPercent > 50 ? '#27ae60' : hpPercent > 25 ? '#f39c12' : '#e74c3c';

      return createPlayerHeader(name, player, playerId) + `

          <!-- Detailed View (collapsible) -->
          <div id="${playerId}-details" style="max-height: 0; opacity: 0; overflow: hidden; transition: max-height 0.3s ease-out, opacity 0.3s ease-out;">
            <div style="padding: 0 12px 12px 12px;">
              <!-- Character Sub-tabs -->
              <div style="display: flex; gap: 4px; margin-bottom: 10px; border-bottom: 1px solid #2c3e50;">
                <button class="player-subtab-btn" data-player="${playerId}" data-subtab="overview" style="padding: 8px 12px; background: transparent; color: #4ECDC4; border: none; border-bottom: 2px solid #4ECDC4; cursor: pointer; font-size: 0.9em; font-weight: bold;">Overview</button>
                <button class="player-subtab-btn" data-player="${playerId}" data-subtab="combat" style="padding: 8px 12px; background: transparent; color: #888; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-size: 0.9em;">Combat</button>
                <button class="player-subtab-btn" data-player="${playerId}" data-subtab="status" style="padding: 8px 12px; background: transparent; color: #888; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-size: 0.9em;">Status</button>
              </div>

              <!-- Overview Tab -->
              <div class="player-subtab-content" data-player="${playerId}" data-subtab="overview" style="display: block;">
                <!-- HP Bar -->
                <div style="margin-bottom: 10px;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.95em; color: #ccc; margin-bottom: 4px;">
                    <span>Hit Points</span>
                    <span>${player.hp}/${player.maxHp}</span>
                  </div>
                  <div style="width: 100%; height: 12px; background: #2c3e50; border-radius: 5px; overflow: hidden;">
                    <div style="width: ${hpPercent}%; height: 100%; background: ${hpColor}; transition: width 0.3s;"></div>
                  </div>
                </div>

                <!-- Stats Grid -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                  <div style="background: #2c3e50; padding: 8px; border-radius: 4px; text-align: center;">
                    <div style="font-size: 0.85em; color: #888;">Armor Class</div>
                    <div style="font-weight: bold; color: #fff; font-size: 1.3em;">${player.ac || '—'}</div>
                  </div>
                  <div style="background: #2c3e50; padding: 8px; border-radius: 4px; text-align: center;">
                    <div style="font-size: 0.85em; color: #888;">Passive Perception</div>
                    <div style="font-weight: bold; color: #fff; font-size: 1.3em;">${player.passivePerception || '—'}</div>
                  </div>
                  <div style="background: #2c3e50; padding: 8px; border-radius: 4px; text-align: center;">
                    <div style="font-size: 0.85em; color: #888;">Initiative</div>
                    <div style="font-weight: bold; color: #fff; font-size: 1.3em;">${player.initiative || '—'}</div>
                  </div>
                </div>
              </div>

              <!-- Combat Tab -->
              <div class="player-subtab-content" data-player="${playerId}" data-subtab="combat" style="display: none;">
                <div style="background: #2c3e50; padding: 10px; border-radius: 4px; margin-bottom: 8px;">
                  <div style="font-size: 0.95em; color: #888; margin-bottom: 6px;">Attack Roll</div>
                  <div style="font-size: 0.9em; color: #ccc;">Click character sheet to make attacks</div>
                </div>
                <div style="background: #2c3e50; padding: 10px; border-radius: 4px;">
                  <div style="font-size: 0.95em; color: #888; margin-bottom: 6px;">Combat Stats</div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 0.9em; color: #ccc;">AC:</span>
                    <span style="font-size: 0.9em; color: #fff; font-weight: bold;">${player.ac || '—'}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="font-size: 0.9em; color: #ccc;">Initiative:</span>
                    <span style="font-size: 0.9em; color: #fff; font-weight: bold;">${player.initiative || '—'}</span>
                  </div>
                </div>
              </div>

              <!-- Status Tab -->
              <div class="player-subtab-content" data-player="${playerId}" data-subtab="status" style="display: none;">
                <!-- Conditions -->
                ${player.conditions && player.conditions.length > 0 ? `
                  <div style="margin-bottom: 10px;">
                    <div style="font-size: 0.95em; color: #888; margin-bottom: 6px;">Active Conditions</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                      ${player.conditions.map(c => `<span style="background: #e74c3c; padding: 5px 12px; border-radius: 4px; font-size: 0.9em; font-weight: bold;">${c}</span>`).join('')}
                    </div>
                  </div>
                ` : '<div style="padding: 10px; text-align: center; color: #888; font-size: 0.95em;">No active conditions</div>'}

                <!-- Concentration -->
                ${player.concentration ? `
                  <div style="background: #9b59b6; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                    <div style="font-size: 0.95em; font-weight: bold; margin-bottom: 4px;">🧠 Concentrating</div>
                    <div style="font-size: 0.9em;">${player.concentration}</div>
                  </div>
                ` : ''}

                <!-- Death Saves (if unconscious) -->
                ${player.deathSaves ? `
                  <div style="background: #c0392b; padding: 10px; border-radius: 4px;">
                    <div style="font-size: 0.95em; font-weight: bold; margin-bottom: 6px;">💀 Death Saving Throws</div>
                    <div style="display: flex; justify-content: space-around; font-size: 0.9em;">
                      <div>
                        <div style="color: #27ae60; font-weight: bold;">Successes</div>
                        <div style="font-size: 1.3em; text-align: center;">✓ ${player.deathSaves.successes || 0}</div>
                      </div>
                      <div>
                        <div style="color: #e74c3c; font-weight: bold;">Failures</div>
                        <div style="font-size: 1.3em; text-align: center;">✗ ${player.deathSaves.failures || 0}</div>
                      </div>
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    debug.log(`👥 Updated player overview: ${players.length} players`);

    // Add event listeners for player header buttons
    document.querySelectorAll('.player-header-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const playerName = btn.dataset.playerName;
        showFullCharacterModal(playerName);
      });
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('.player-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const playerName = btn.dataset.playerName;
        deletePlayerFromGM(playerName);
      });
    });
  }

  /**
   * Update player data from character sheet
   */
  function updatePlayerData(characterName, data) {
    if (!playerData[characterName]) {
      playerData[characterName] = {};
    }

    // Merge new data
    Object.assign(playerData[characterName], data);

    // Save to storage
    savePlayerDataToStorage();

    // Update display if GM panel is open
    if (gmModeEnabled) {
      updatePlayerOverviewDisplay();
    }

    debug.log(`👤 Updated player data for ${characterName}:`, playerData[characterName]);
  }

  /**
   * Save player data to storage
   */
  function savePlayerDataToStorage() {
    try {
      debug.log('💾 Attempting to save player data:', Object.keys(playerData));
      
      // Store player data in characterProfiles like character sheets
      const characterProfiles = {};
      Object.keys(playerData).forEach(playerName => {
        characterProfiles[playerName] = {
          ...playerData[playerName],
          type: 'rollcloudPlayer',
          lastUpdated: new Date().toISOString()
        };
        debug.log(`💾 Preparing to save player: ${playerName}, type: rollcloudPlayer`);
      });
      
      browserAPI.storage.local.set({
        characterProfiles: characterProfiles
      }, () => {
        debug.log('✅ Successfully saved player data to characterProfiles storage');
      });
    } catch (error) {
      debug.error('❌ Error saving player data to storage:', error);
    }
  }

  /**
   * Load player data from storage
   */
  function loadPlayerDataFromStorage() {
    try {
      // Use Promise-based API like the working test
      browserAPI.storage.local.get(['characterProfiles']).then(result => {
        debug.log('🔍 Storage check - characterProfiles:', result.characterProfiles ? Object.keys(result.characterProfiles) : 'none');
        
        if (result.characterProfiles) {
          // Load only rollcloudPlayer entries from characterProfiles
          playerData = {};
          Object.keys(result.characterProfiles).forEach(key => {
            const profile = result.characterProfiles[key];
            debug.log(`🔍 Checking profile: ${key}, type: ${profile.type}`);
            if (profile.type === 'rollcloudPlayer') {
              playerData[key] = profile;
              debug.log(`✅ Loaded rollcloudPlayer: ${key}`);
            }
          });
          
          debug.log(`📂 Loaded ${Object.keys(playerData).length} players from characterProfiles storage`);
          debug.log('👥 Player data loaded:', Object.keys(playerData));
          
          // Update display if GM panel is open
          if (gmModeEnabled) {
            updatePlayerOverviewDisplay();
          }
        } else {
          debug.log('⚠️ No characterProfiles found in storage');
        }
      }).catch(error => {
        debug.error('❌ Error loading player data from storage:', error);
      });
    } catch (error) {
      debug.error('❌ Error in loadPlayerDataFromStorage:', error);
    }
  }

  /**
   * Delete player data
   */
  function deletePlayerData(characterName) {
    if (playerData[characterName]) {
      delete playerData[characterName];
      
      // Save to storage
      savePlayerDataToStorage();
      
      // Update display if GM panel is open
      if (gmModeEnabled) {
        updatePlayerOverviewDisplay();
      }
      
      debug.log(`🗑️ Deleted player data for ${characterName}`);
    }
  }

  /**
   * Delete player from GM panel
   */
  window.deletePlayerFromGM = function(characterName) {
    if (confirm(`Remove ${characterName} from GM Panel?`)) {
      deletePlayerData(characterName);
    }
  };

  /**
   * Toggle player details expansion
   */
  window.togglePlayerDetails = function(playerId) {
    const details = document.getElementById(`${playerId}-details`);
    const toggle = document.getElementById(`${playerId}-toggle`);

    if (!details || !toggle) return;

    const isExpanded = details.style.maxHeight && details.style.maxHeight !== '0px';

    if (isExpanded) {
      // Collapse
      details.style.maxHeight = '0';
      details.style.opacity = '0';
      toggle.style.transform = 'rotate(-90deg)';
    } else {
      // Expand
      details.style.maxHeight = '1000px';
      details.style.opacity = '1';
      toggle.style.transform = 'rotate(0deg)';

      // Attach sub-tab listeners for this player
      attachPlayerSubtabListeners(playerId);
    }
  };

  /**
   * Show full character sheet as popout window
   */
  window.showFullCharacterModal = function(playerName) {
    const player = playerData[playerName];
    if (!player) {
      debug.warn(`⚠️ No data found for player: ${playerName}`);
      return;
    }

    // Create popout window
    const popup = window.open('', `character-${playerName}`, 'width=900,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no');
    
    if (!popup) {
      debug.error('❌ Failed to open popup window - please allow popups for this site');
      return;
    }

    // Generate character HTML
    const hpPercent = player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0;
    const hpColor = hpPercent > 50 ? '#27ae60' : hpPercent > 25 ? '#f39c12' : '#e74c3c';

    let abilitiesHTML = '';
    if (player.attributes) {
      abilitiesHTML = `
        <div class="section">
          <h3>Abilities</h3>
          <div class="abilities-grid">
            ${['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(ability => {
              const score = player.attributes[ability] || 10;
              const mod = Math.floor((score - 10) / 2);
              const sign = mod >= 0 ? '+' : '';
              return `
                <div class="ability-card">
                  <div class="ability-name">${ability}</div>
                  <div class="ability-score">${score}</div>
                  <div class="ability-mod">${sign}${mod}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    let skillsHTML = '';
    if (player.skills && player.skills.length > 0) {
      skillsHTML = `
        <div class="section">
          <h3>Skills</h3>
          <div class="skills-grid">
            ${player.skills.slice(0, 12).map(skill => `
              <div class="skill-item">
                <span class="skill-name">${skill.name || skill}</span>
                <span class="skill-bonus">${skill.bonus ? `+${skill.bonus}` : '—'}</span>
              </div>
            `).join('')}
            ${player.skills.length > 12 ? `<div style="color: #aaa; font-size: 0.9em; text-align: center; padding: 12px;">... and ${player.skills.length - 12} more skills</div>` : ''}
          </div>
        </div>
      `;
    }

    let actionsHTML = '';
    if (player.actions && player.actions.length > 0) {
      actionsHTML = player.actions.slice(0, 5).map(action => `
        <div class="action-card">
          <div class="action-name">${action.name}</div>
          ${action.description ? `<div class="action-description">${action.description.substring(0, 200)}${action.description.length > 200 ? '...' : ''}</div>` : ''}
        </div>
      `).join('');
    }

    // Write EXACT popup sheet HTML to popup
    popup.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Character Sheet - ${playerName}</title>
        <meta charset="UTF-8">
        <style>
          /* CSS Variables for Theming */
          :root {
            /* Light theme (default) */
            --bg-primary: #f5f5f5;
            --bg-secondary: #ffffff;
            --bg-tertiary: #f0f0f0;
            --bg-card: #f0fff4;
            --bg-card-hover: #e8f5e8;
            --bg-spell: #fff3cd;
            --bg-action: #e3f2fd;
            --bg-resource: #f3e5f5;
            --bg-feature: #fef5e7;

            --text-primary: #2C3E50;
            --text-secondary: #666666;
            --text-muted: #999999;
            --text-inverse: #ffffff;

            --border-color: #ddd;
            --border-card: #2D8B83;
            --border-spell: #f39c12;
            --border-action: #2196f3;

            --accent-primary: #2D8B83;
            --accent-success: #27ae60;
            --accent-danger: #E74C3C;
            --accent-warning: #f39c12;
            --accent-info: #2196f3;
            --accent-purple: #9b59b6;
            --accent-purple-dark: #8e44ad;

            --shadow: rgba(0,0,0,0.1);
            --shadow-hover: rgba(0,0,0,0.15);
          }

          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background: var(--bg-primary);
            color: var(--text-primary);
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: var(--bg-secondary);
            padding: 0;
            border-radius: 8px;
            box-shadow: 0 2px 10px var(--shadow);
          }
          .systems-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 15px;
            background: var(--bg-tertiary);
            border-bottom: 1px solid var(--border-color);
            border-radius: 8px 8px 0 0;
            gap: 10px;
          }
          .close-btn {
            background: #E74C3C;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85em;
          }
          .content-area {
            padding: 20px;
          }
          .header {
            margin-bottom: 20px;
          }
          .char-name-section {
            font-size: 1.5em;
            font-weight: bold;
            color: var(--text-primary);
            margin-bottom: 15px;
          }
          .char-info-layer {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
            flex-wrap: wrap;
          }
          .char-info-layer.layer-1 {
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 15px;
          }
          .char-info-layer.layer-2 {
            margin-bottom: 15px;
          }
          .layer-3 {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
          }
          .stat-box {
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 10px;
            text-align: center;
            min-width: 80px;
          }
          .stat-label {
            font-size: 0.8em;
            color: var(--text-secondary);
            margin-bottom: 5px;
          }
          .stat-value {
            font-size: 1.3em;
            font-weight: bold;
            color: var(--text-primary);
          }
          .hp-box, .initiative-box {
            background: var(--bg-card);
            border: 2px solid var(--accent-primary);
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            flex: 1;
          }
          .hp-box {
            border-color: var(--accent-success);
          }
          .initiative-box {
            border-color: var(--accent-info);
          }
          .section {
            margin-bottom: 25px;
          }
          .section h3 {
            color: var(--text-primary);
            margin-bottom: 15px;
            font-size: 1.2em;
            border-bottom: 2px solid var(--accent-primary);
            padding-bottom: 5px;
          }
          .section-content {
            background: var(--bg-secondary);
            border-radius: 6px;
            padding: 15px;
          }
          .abilities-grid, .saves-grid, .skills-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 10px;
          }
          .ability-card, .save-card, .skill-card {
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 10px;
            text-align: center;
          }
          .ability-name, .save-name, .skill-name {
            font-size: 0.9em;
            color: var(--text-secondary);
            margin-bottom: 5px;
            text-transform: capitalize;
          }
          .ability-score, .save-value, .skill-value {
            font-size: 1.3em;
            font-weight: bold;
            color: var(--text-primary);
            margin-bottom: 5px;
          }
          .ability-mod, .save-mod, .skill-mod {
            font-size: 1.1em;
            font-weight: bold;
            color: var(--accent-primary);
          }
          .action-card, .spell-card, .feature-card {
            background: var(--bg-action);
            border: 1px solid var(--border-action);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
          }
          .spell-card {
            background: var(--bg-spell);
            border-color: var(--border-spell);
          }
          .feature-card {
            background: var(--bg-feature);
            border-color: var(--accent-warning);
          }
          .action-name, .spell-name, .feature-name {
            font-weight: bold;
            font-size: 1.1em;
            color: var(--text-primary);
            margin-bottom: 8px;
          }
          .action-description, .spell-description, .feature-description {
            color: var(--text-secondary);
            font-size: 0.9em;
            line-height: 1.4;
          }
          .spell-level {
            font-size: 0.85em;
            color: var(--accent-warning);
            font-weight: bold;
            margin-bottom: 5px;
          }
          .resources-container, .spell-slots-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
          }
          .resource-card, .spell-slot-card {
            background: var(--bg-resource);
            border: 1px solid var(--accent-purple);
            border-radius: 6px;
            padding: 10px;
            text-align: center;
          }
          .resource-name, .spell-slot-level {
            font-size: 0.9em;
            color: var(--text-secondary);
            margin-bottom: 5px;
          }
          .resource-value, .spell-slot-value {
            font-size: 1.2em;
            font-weight: bold;
            color: var(--accent-purple);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Systems Bar -->
          <div class="systems-bar">
            <div style="font-weight: bold;">🎲 ${playerName} - Read Only Character Sheet</div>
            <button class="close-btn" onclick="window.close()">✕</button>
          </div>

          <!-- Content Area -->
          <div class="content-area">
            <div class="header">
              <!-- Character Name -->
              <div class="char-name-section">
                🎲 ${playerName}
              </div>

              <!-- Layer 1: Class, Level, Race, Hit Dice -->
              <div class="char-info-layer layer-1">
                <div><strong>Class:</strong> <span>${player.class || 'Unknown'}</span></div>
                <div><strong>Level:</strong> <span>${player.level || '1'}</span></div>
                <div><strong>Race:</strong> <span>${player.race || 'Unknown'}</span></div>
                <div><strong>Hit Dice:</strong> <span>1d${player.hitDice || '10'}</span></div>
              </div>

              <!-- Layer 2: AC, Speed, Proficiency, Passive Perception, Initiative -->
              <div class="char-info-layer layer-2">
                <div class="stat-box">
                  <div class="stat-label">Armor Class</div>
                  <div class="stat-value">${player.ac || '10'}</div>
                </div>
                <div class="stat-box">
                  <div class="stat-label">Speed</div>
                  <div class="stat-value">${player.speed || '30 ft'}</div>
                </div>
                <div class="stat-box">
                  <div class="stat-label">Proficiency</div>
                  <div class="stat-value">+${player.proficiency || '0'}</div>
                </div>
                <div class="stat-box">
                  <div class="stat-label">Passive Perception</div>
                  <div class="stat-value">${player.passivePerception || '10'}</div>
                </div>
                <div class="stat-box">
                  <div class="stat-label">Initiative</div>
                  <div class="stat-value">+${player.initiative || '0'}</div>
                </div>
              </div>

              <!-- Layer 3: Hit Points -->
              <div class="layer-3">
                <div class="hp-box">
                  <div style="font-size: 0.8em; margin-bottom: 5px;">Hit Points</div>
                  <div style="font-size: 1.5em;">${player.hp || '0'} / ${player.maxHp || '0'}</div>
                </div>
                <div class="initiative-box">
                  <div style="font-size: 0.8em; margin-bottom: 5px;">Initiative</div>
                  <div style="font-size: 1.5em;">+${player.initiative || '0'}</div>
                </div>
              </div>
            </div>

            <!-- Resources & Spell Slots -->
            ${player.resources && Object.keys(player.resources).length > 0 ? `
              <div class="section">
                <h3>💎 Resources</h3>
                <div class="section-content">
                  <div class="resources-container">
                    ${Object.entries(player.resources).map(([key, value]) => `
                      <div class="resource-card">
                        <div class="resource-name">${key}</div>
                        <div class="resource-value">${value.current || value.value || 0}/${value.max || value.total || '-'}</div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            ` : ''}

            ${player.spellSlots && Object.keys(player.spellSlots).length > 0 ? `
              <div class="section">
                <h3>✨ Spell Slots</h3>
                <div class="section-content">
                  <div class="spell-slots-container">
                    ${Object.entries(player.spellSlots).map(([level, slots]) => `
                      <div class="spell-slot-card">
                        <div class="spell-slot-level">Level ${level}</div>
                        <div class="spell-slot-value">${slots.used || 0}/${slots.total || slots.max || 0}</div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Abilities -->
            ${abilitiesHTML ? `
              <div class="section">
                <h3>⚡ Abilities</h3>
                <div class="section-content">
                  <div class="abilities-grid">
                    ${abilitiesHTML}
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Saving Throws -->
            ${player.savingThrows ? `
              <div class="section">
                <h3>🛡️ Saving Throws</h3>
                <div class="section-content">
                  <div class="saves-grid">
                    ${['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(saveName => {
                      const save = player.savingThrows[saveName] || {};
                      const mod = player.attributes?.[saveName] ? Math.floor((player.attributes[saveName] - 10) / 2) : 0;
                      const profBonus = player.proficiency || 0;
                      const total = mod + (save.proficient ? profBonus : 0);
                      const sign = total >= 0 ? '+' : '';
                      return `
                        <div class="save-card">
                          <div class="save-name">${saveName}</div>
                          <div class="save-value">${sign}${total}</div>
                          <div class="save-mod">${save.proficient ? '✓' : ''}</div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Skills -->
            ${skillsHTML ? `
              <div class="section">
                <h3>🎯 Skills</h3>
                <div class="section-content">
                  <div class="skills-grid">
                    ${skillsHTML}
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Features -->
            ${player.features && player.features.length > 0 ? `
              <div class="section">
                <h3>🌟 Features</h3>
                <div class="section-content">
                  ${player.features.slice(0, 10).map(feature => `
                    <div class="feature-card">
                      <div class="feature-name">${feature.name}</div>
                      ${feature.description ? `<div class="feature-description">${(feature.description.text || feature.description).substring(0, 200)}${(feature.description.text || feature.description).length > 200 ? '...' : ''}</div>` : ''}
                    </div>
                  `).join('')}
                  ${player.features.length > 10 ? `<div style="color: var(--text-muted); text-align: center; padding: 12px;">... and ${player.features.length - 10} more features</div>` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Actions -->
            ${actionsHTML ? `
              <div class="section">
                <h3>⚔️ Actions & Attacks</h3>
                <div class="section-content">
                  ${actionsHTML}
                </div>
              </div>
            ` : ''}

            <!-- Spells -->
            ${player.spells && player.spells.length > 0 ? `
              <div class="section">
                <h3>🔮 Spells</h3>
                <div class="section-content">
                  ${player.spells.slice(0, 15).map(spell => `
                    <div class="spell-card">
                      <div class="spell-name">${spell.name}</div>
                      ${spell.level ? `<div class="spell-level">Level ${spell.level}</div>` : ''}
                      ${spell.description ? `<div class="spell-description">${spell.description.substring(0, 150)}${spell.description.length > 150 ? '...' : ''}</div>` : ''}
                    </div>
                  `).join('')}
                  ${player.spells.length > 15 ? `<div style="color: var(--text-muted); text-align: center; padding: 12px;">... and ${player.spells.length - 15} more spells</div>` : ''}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </body>
      </html>
    `);

    popup.document.close();
    debug.log(`🪟 Opened character popup for ${playerName}`);
  };

  /**
   * Attach event listeners for player sub-tabs
   */
  function attachPlayerSubtabListeners(playerId) {
    const subtabBtns = document.querySelectorAll(`.player-subtab-btn[data-player="${playerId}"]`);
    const subtabContents = document.querySelectorAll(`.player-subtab-content[data-player="${playerId}"]`);

    subtabBtns.forEach(btn => {
      // Remove existing listener if any
      btn.replaceWith(btn.cloneNode(true));
    });

    // Re-query after replacing
    const newSubtabBtns = document.querySelectorAll(`.player-subtab-btn[data-player="${playerId}"]`);

    newSubtabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetSubtab = btn.dataset.subtab;

        // Update button styles
        newSubtabBtns.forEach(b => {
          if (b.dataset.subtab === targetSubtab) {
            b.style.color = '#4ECDC4';
            b.style.borderBottom = '2px solid #4ECDC4';
          } else {
            b.style.color = '#888';
            b.style.borderBottom = '2px solid transparent';
          }
        });

        // Show target content, hide others
        subtabContents.forEach(content => {
          content.style.display = content.dataset.subtab === targetSubtab ? 'block' : 'none';
        });
      });
    });
  }

  /**
   * Import player data from chrome storage
   */
  function importPlayerData() {
    debug.log('📥 Importing player data from storage...');

    chrome.storage.local.get(['characterProfiles'], (result) => {
      if (chrome.runtime.lastError) {
        debug.error('❌ Failed to import player data:', chrome.runtime.lastError);
        postChatMessage('❌ Failed to import character data');
        return;
      }

      const characterProfiles = result.characterProfiles || {};
      const profileKeys = Object.keys(characterProfiles);

      if (profileKeys.length === 0) {
        debug.log('⚠️ No character profiles found in storage');
        postChatMessage('⚠️ No character data found. Please sync a character from Dice Cloud first.');
        return;
      }

      // Clear existing player data
      playerData = {};

      // Import each character profile
      profileKeys.forEach(profileId => {
        const character = characterProfiles[profileId];

        if (!character || !character.name) {
          debug.warn(`⚠️ Skipping invalid character profile: ${profileId}`);
          return;
        }

        // Import complete character data
        playerData[character.name] = {
          // Basic stats
          hp: character.hp?.current ?? character.hitPoints?.current ?? 0,
          maxHp: character.hp?.max ?? character.hitPoints?.max ?? 0,
          ac: character.armorClass ?? character.ac ?? 10,
          initiative: character.initiative ?? 0,
          passivePerception: character.passivePerception ?? 10,
          proficiency: character.proficiency ?? 0,
          speed: character.speed ?? '30 ft',
          
          // Character info
          name: character.name,
          class: character.class || 'Unknown',
          level: character.level || 1,
          race: character.race || 'Unknown',
          hitDice: character.hitDice || '10',
          
          // Abilities
          attributes: character.attributes || {
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10
          },
          
          // Skills
          skills: character.skills || [],
          
          // Actions
          actions: character.actions || [],
          
          // Combat status
          conditions: character.conditions || [],
          concentration: character.concentration || null,
          deathSaves: character.deathSaves || null,
          
          // Type marking for storage
          type: 'rollcloudPlayer',
          lastUpdated: new Date().toISOString()
        };

        debug.log(`✅ Imported player: ${character.name} (HP: ${character.hp?.current ?? character.hitPoints?.current ?? 0}/${character.hp?.max ?? character.hitPoints?.max ?? 0}, AC: ${character.armorClass ?? character.ac ?? 10})`);
      });

      // Update display
      updatePlayerOverviewDisplay();

      const playerCount = Object.keys(playerData).length;
      debug.log(`✅ Successfully imported ${playerCount} player(s)`);
      postChatMessage(`✅ GM imported ${playerCount} character(s) to party overview`);
    });
  }

  /**
   * Export player data to clipboard
   */
  function exportPlayerData() {
    if (Object.keys(playerData).length === 0) {
      debug.log('⚠️ No player data to export');
      return;
    }

    const exportText = Object.keys(playerData).map(name => {
      const player = playerData[name];
      return `**${name}**
HP: ${player.hp}/${player.maxHp}
AC: ${player.ac || '—'}
Initiative: ${player.initiative || '—'}
Passive Perception: ${player.passivePerception || '—'}
${player.conditions && player.conditions.length > 0 ? `Conditions: ${player.conditions.join(', ')}` : ''}
${player.concentration ? `Concentrating: ${player.concentration}` : ''}
${player.deathSaves ? `Death Saves: ✓${player.deathSaves.successes || 0} / ✗${player.deathSaves.failures || 0}` : ''}
`;
    }).join('\n---\n\n');

    // Copy to clipboard
    navigator.clipboard.writeText(exportText).then(() => {
      debug.log('✅ Player data copied to clipboard');
      postChatMessage('📋 GM exported party overview to clipboard');
    }).catch(err => {
      debug.error('❌ Failed to copy player data:', err);
    });
  }

  /**
   * Log turn action to history
   */
  function logTurnAction(action) {
    const historyEntry = {
      timestamp: new Date().toLocaleTimeString(),
      round: initiativeTracker.round,
      turnIndex: initiativeTracker.currentTurnIndex,
      combatant: getCurrentCombatant()?.name || 'Unknown',
      ...action
    };

    turnHistory.unshift(historyEntry); // Add to beginning
    if (turnHistory.length > 10) {
      turnHistory = turnHistory.slice(0, 10); // Keep only last 10
    }

    updateTurnHistoryDisplay();
    debug.log('📜 Logged turn action:', historyEntry);
  }

  /**
   * Update Turn History Display
   */
  function updateTurnHistoryDisplay() {
    const turnHistoryList = document.getElementById('turn-history-list');
    if (!turnHistoryList) return;

    if (turnHistory.length === 0) {
      turnHistoryList.innerHTML = '';
      // Show empty state
      const tabContent = gmPanel.querySelector('[data-tab="history"]');
      if (tabContent) {
        const emptyState = tabContent.querySelector('div[style*="text-align: center"]');
        if (emptyState) emptyState.style.display = 'block';
      }
      return;
    }

    // Hide empty state
    const tabContent = gmPanel.querySelector('[data-tab="history"]');
    if (tabContent) {
      const emptyState = tabContent.querySelector('div[style*="text-align: center"]');
      if (emptyState) emptyState.style.display = 'none';
    }

    turnHistoryList.innerHTML = turnHistory.map((entry, index) => {
      const actionIcon = entry.action === 'attack' ? '⚔️' :
                        entry.action === 'spell' ? '✨' :
                        entry.action === 'damage' ? '💔' :
                        entry.action === 'healing' ? '💚' :
                        entry.action === 'condition' ? '🎯' :
                        entry.action === 'turn' ? '🔄' : '📝';

      return `
        <div style="background: #34495e; padding: 10px; border-radius: 6px; border-left: 4px solid #3498db;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
            <div>
              <span style="font-weight: bold; color: #4ECDC4;">${entry.combatant}</span>
              <span style="font-size: 0.75em; color: #888; margin-left: 8px;">Round ${entry.round}</span>
            </div>
            <span style="font-size: 0.75em; color: #888;">${entry.timestamp}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; font-size: 0.9em;">
            <span style="font-size: 1.2em;">${actionIcon}</span>
            <span style="color: #ccc;">${entry.description}</span>
          </div>
          ${entry.damage ? `<div style="margin-top: 4px; font-size: 0.85em; color: #e74c3c;">Damage: ${entry.damage}</div>` : ''}
          ${entry.healing ? `<div style="margin-top: 4px; font-size: 0.85em; color: #27ae60;">Healing: ${entry.healing}</div>` : ''}
          ${entry.condition ? `<div style="margin-top: 4px; font-size: 0.85em; color: #f39c12;">Condition: ${entry.condition}</div>` : ''}
        </div>
      `;
    }).join('');

    debug.log(`📜 Updated turn history: ${turnHistory.length} entries`);
  }

  /**
   * Export turn history to clipboard
   */
  function exportTurnHistory() {
    const historyText = turnHistory.map(entry => {
      let text = `[Round ${entry.round}] ${entry.combatant} - ${entry.description}`;
      if (entry.damage) text += ` (Damage: ${entry.damage})`;
      if (entry.healing) text += ` (Healing: ${entry.healing})`;
      if (entry.condition) text += ` (Condition: ${entry.condition})`;
      return text;
    }).join('\n');

    navigator.clipboard.writeText(historyText).then(() => {
      postChatMessage('📋 Turn history copied to clipboard');
      debug.log('📋 Turn history exported to clipboard');
    }).catch(err => {
      debug.error('❌ Failed to copy turn history:', err);
    });
  }

  /**
   * Toggle GM Mode
   */
  function toggleGMMode(enabled) {
    const previousState = gmModeEnabled;
    gmModeEnabled = enabled !== undefined ? enabled : !gmModeEnabled;

    if (!gmPanel) {
      createGMPanel();
    }

    gmPanel.style.display = gmModeEnabled ? 'block' : 'none';

    // Visual feedback - enhance glow when active
    if (gmModeEnabled) {
      gmPanel.style.borderColor = '#4ECDC4'; // Cyan border
      gmPanel.style.boxShadow = '0 8px 32px rgba(78, 205, 196, 0.6)'; // Enhanced cyan glow when active
    } else {
      gmPanel.style.borderColor = '#4ECDC4'; // Cyan border
      gmPanel.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)'; // Default shadow
    }

    // Start/stop chat monitoring
    if (gmModeEnabled) {
      startChatMonitoring();
    } else {
      stopChatMonitoring();
    }

    // Post chat announcement only when state actually changes
    if (previousState !== gmModeEnabled) {
      const message = gmModeEnabled
        ? '👑 GM Panel is now active - rolls will be hidden from players'
        : '👑 GM Panel deactivated - rolls will post normally';

      // Use setTimeout to ensure the chat is ready
      setTimeout(() => {
        postChatMessage(message);
      }, 100);
    }

    debug.log(`👑 GM Mode ${gmModeEnabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Add combatant to initiative tracker
   */
  function addCombatant(name, initiative, source = 'chat') {
    // Check if already exists
    const exists = initiativeTracker.combatants.find(c => c.name === name);
    if (exists) {
      debug.log(`⚠️ Combatant ${name} already in tracker, updating initiative`);
      exists.initiative = initiative;
      updateInitiativeDisplay();
      return;
    }

    initiativeTracker.combatants.push({
      name,
      initiative,
      source
    });

    // Sort by initiative (highest first)
    initiativeTracker.combatants.sort((a, b) => b.initiative - a.initiative);

    updateInitiativeDisplay();
    debug.log(`✅ Added combatant: ${name} (Init: ${initiative})`);
  }

  /**
   * Remove combatant from tracker
   */
  function removeCombatant(name) {
    const index = initiativeTracker.combatants.findIndex(c => c.name === name);
    if (index !== -1) {
      initiativeTracker.combatants.splice(index, 1);

      // Adjust current turn index if necessary
      if (initiativeTracker.currentTurnIndex >= initiativeTracker.combatants.length) {
        initiativeTracker.currentTurnIndex = 0;
      }

      updateInitiativeDisplay();
      debug.log(`🗑️ Removed combatant: ${name}`);
    }
  }

  /**
   * Clear all combatants
   */
  function clearAllCombatants() {
    if (confirm('Clear all combatants from initiative tracker?')) {
      initiativeTracker.combatants = [];
      initiativeTracker.currentTurnIndex = 0;
      initiativeTracker.round = 1;
      combatStarted = false;

      // Show Start Combat button again
      const startBtn = document.getElementById('start-combat-btn');
      const prevBtn = document.getElementById('prev-turn-btn');
      const nextBtn = document.getElementById('next-turn-btn');

      if (startBtn) startBtn.style.display = 'block';
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';

      updateInitiativeDisplay();
      postChatMessage('🛑 Combat ended. Initiative tracker cleared.');
      debug.log('🗑️ All combatants cleared');
    }
  }

  /**
   * Start combat - initialize first turn
   */
  function startCombat() {
    if (initiativeTracker.combatants.length === 0) {
      debug.warn('⚠️ Cannot start combat with no combatants');
      return;
    }

    // Reset to beginning
    initiativeTracker.currentTurnIndex = 0;
    initiativeTracker.round = 1;
    combatStarted = true;

    // Update UI
    document.getElementById('round-display').textContent = 'Round 1';
    const startBtn = document.getElementById('start-combat-btn');
    const prevBtn = document.getElementById('prev-turn-btn');
    const nextBtn = document.getElementById('next-turn-btn');

    if (startBtn) {
      startBtn.style.display = 'none';
    }
    if (prevBtn) prevBtn.style.display = 'block';
    if (nextBtn) nextBtn.style.display = 'block';

    updateInitiativeDisplay();
    notifyCurrentTurn();

    // Announce combat start
    postChatMessage('⚔️ Combat has begun! Round 1 starts!');
    announceTurn();

    debug.log('⚔️ Combat started!');
  }

  /**
   * Next turn
   */
  function nextTurn() {
    if (initiativeTracker.combatants.length === 0) return;

    initiativeTracker.currentTurnIndex++;
    if (initiativeTracker.currentTurnIndex >= initiativeTracker.combatants.length) {
      initiativeTracker.currentTurnIndex = 0;
      initiativeTracker.round++;
      document.getElementById('round-display').textContent = `Round ${initiativeTracker.round}`;
      // Announce new round
      postChatMessage(`⚔️ Round ${initiativeTracker.round} begins!`);
    }

    updateInitiativeDisplay();
    notifyCurrentTurn();
    announceTurn();

    // Log turn change
    const current = getCurrentCombatant();
    if (current) {
      logTurnAction({
        action: 'turn',
        description: `${current.name}'s turn begins`
      });
    }

    debug.log(`⏭️ Next turn: ${getCurrentCombatant()?.name}`);
  }

  /**
   * Previous turn
   */
  function prevTurn() {
    if (initiativeTracker.combatants.length === 0) return;

    initiativeTracker.currentTurnIndex--;
    if (initiativeTracker.currentTurnIndex < 0) {
      initiativeTracker.currentTurnIndex = initiativeTracker.combatants.length - 1;
      initiativeTracker.round = Math.max(1, initiativeTracker.round - 1);
      document.getElementById('round-display').textContent = `Round ${initiativeTracker.round}`;
    }

    updateInitiativeDisplay();
    notifyCurrentTurn();
    announceTurn();
    debug.log(`⏮️ Prev turn: ${getCurrentCombatant()?.name}`);
  }

  /**
   * Get current combatant
   */
  function getCurrentCombatant() {
    return initiativeTracker.combatants[initiativeTracker.currentTurnIndex];
  }

  /**
   * Delay current turn
   */
  function delayTurn(combatantIndex) {
    const combatant = initiativeTracker.combatants[combatantIndex];
    if (!combatant) return;

    debug.log(`⏸️ Delaying turn for: ${combatant.name}`);

    // Add to delayed list
    initiativeTracker.delayedCombatants.push({
      name: combatant.name,
      initiative: combatant.initiative,
      originalIndex: combatantIndex
    });

    // Log the action
    logTurnAction({
      action: 'turn',
      description: `${combatant.name} delays their turn`
    });

    // Announce delay
    postChatMessage(`⏸️ ${combatant.name} delays their turn`);

    // Move to next turn
    nextTurn();

    updateInitiativeDisplay();
  }

  /**
   * Undelay a combatant (cancel their delay)
   */
  function undelayTurn(combatantName) {
    const delayedIndex = initiativeTracker.delayedCombatants.findIndex(d => d.name === combatantName);
    if (delayedIndex === -1) return;

    debug.log(`▶️ Undelaying: ${combatantName}`);

    // Remove from delayed list
    initiativeTracker.delayedCombatants.splice(delayedIndex, 1);

    // Log the action
    logTurnAction({
      action: 'turn',
      description: `${combatantName} resumes their turn`
    });

    // Announce
    postChatMessage(`▶️ ${combatantName} resumes their turn`);

    updateInitiativeDisplay();
  }

  /**
   * Insert a delayed combatant's turn now
   */
  function insertDelayedTurn(combatantName) {
    const delayedIndex = initiativeTracker.delayedCombatants.findIndex(d => d.name === combatantName);
    if (delayedIndex === -1) return;

    const delayed = initiativeTracker.delayedCombatants[delayedIndex];
    debug.log(`▶️ Inserting delayed turn for: ${delayed.name}`);

    // Remove from delayed list
    initiativeTracker.delayedCombatants.splice(delayedIndex, 1);

    // Log the action
    logTurnAction({
      action: 'turn',
      description: `${delayed.name} acts on delayed turn`
    });

    // Announce
    postChatMessage(`▶️ ${delayed.name} acts now (delayed turn)`);

    // Notify the character sheet
    notifyCurrentTurn();

    updateInitiativeDisplay();
  }

  /**
   * Update initiative display
   */
  function updateInitiativeDisplay() {
    const list = document.getElementById('initiative-list');
    if (!list) return;

    if (initiativeTracker.combatants.length === 0) {
      list.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 20px;">No combatants yet. Add manually or roll initiative in Roll20 chat!</div>';
      return;
    }

    list.innerHTML = initiativeTracker.combatants.map((combatant, index) => {
      const isActive = index === initiativeTracker.currentTurnIndex;
      const isDelayed = initiativeTracker.delayedCombatants.some(d => d.name === combatant.name);

      return `
        <div style="padding: 10px; background: ${isActive ? '#4ECDC4' : isDelayed ? '#9b59b6' : '#34495e'}; border: 2px solid ${isActive ? '#4ECDC4' : isDelayed ? '#8e44ad' : '#2c3e50'}; border-radius: 6px; ${isActive ? 'box-shadow: 0 0 15px rgba(78, 205, 196, 0.4);' : ''}">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: ${isActive ? '8px' : '0'};">
            <div style="font-weight: bold; font-size: 1.2em; min-width: 30px; text-align: center;">${combatant.initiative}</div>
            <div style="flex: 1; font-weight: bold;">
              ${combatant.name}
              ${isDelayed ? '<span style="font-size: 0.85em; color: #f39c12; margin-left: 8px;">⏸️ Delayed</span>' : ''}
            </div>
            <button class="rollcloud-remove-combatant" data-combatant-name="${combatant.name}" style="background: #e74c3c; color: #fff; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.85em;">✕</button>
          </div>
          ${isActive && !isDelayed ? `
            <button class="rollcloud-delay-turn" data-combatant-index="${index}" style="width: 100%; background: #f39c12; color: #fff; border: none; border-radius: 4px; padding: 6px; cursor: pointer; font-weight: bold; font-size: 0.85em;">⏸️ Delay Turn</button>
          ` : ''}
          ${isActive && isDelayed ? `
            <button class="rollcloud-undelay-turn" data-combatant-name="${combatant.name}" style="width: 100%; background: #27ae60; color: #fff; border: none; border-radius: 4px; padding: 6px; cursor: pointer; font-weight: bold; font-size: 0.85em;">▶️ Resume Turn</button>
          ` : ''}
        </div>
      `;
    }).join('');

    // Show delayed combatants section if any exist
    if (initiativeTracker.delayedCombatants.length > 0) {
      list.innerHTML += `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #34495e;">
          <div style="font-weight: bold; color: #f39c12; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <span>⏸️</span> Delayed Actions
          </div>
          ${initiativeTracker.delayedCombatants.map(delayed => `
            <div style="padding: 8px; background: #9b59b6; border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
              <div style="flex: 1;">
                <div style="font-weight: bold;">${delayed.name}</div>
                <div style="font-size: 0.75em; opacity: 0.8;">Initiative: ${delayed.initiative}</div>
              </div>
              <button class="rollcloud-insert-delayed" data-delayed-name="${delayed.name}" style="background: #27ae60; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-weight: bold; font-size: 0.85em;">▶️ Act Now</button>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Attach event listeners (CSP-compliant)
    const removeButtons = list.querySelectorAll('.rollcloud-remove-combatant');
    removeButtons.forEach(button => {
      button.addEventListener('click', () => {
        const name = button.getAttribute('data-combatant-name');
        removeCombatant(name);
      });
    });

    const delayButtons = list.querySelectorAll('.rollcloud-delay-turn');
    delayButtons.forEach(button => {
      button.addEventListener('click', () => {
        const index = parseInt(button.getAttribute('data-combatant-index'));
        delayTurn(index);
      });
    });

    const undelayButtons = list.querySelectorAll('.rollcloud-undelay-turn');
    undelayButtons.forEach(button => {
      button.addEventListener('click', () => {
        const name = button.getAttribute('data-combatant-name');
        undelayTurn(name);
      });
    });

    const insertDelayedButtons = list.querySelectorAll('.rollcloud-insert-delayed');
    insertDelayedButtons.forEach(button => {
      button.addEventListener('click', () => {
        const name = button.getAttribute('data-delayed-name');
        insertDelayedTurn(name);
      });
    });
  }

  /**
   * Notify current turn to character sheet
   */
  function notifyCurrentTurn() {
    const current = getCurrentCombatant();
    if (!current) return;

    debug.log(`🎯 Notifying turn for: "${current.name}"`);
    debug.log(`📋 Registered popups: ${Object.keys(characterPopups).map(n => `"${n}"`).join(', ')}`);

    // Helper function to normalize names for comparison
    // Removes emoji prefixes, "It's", "'s turn", and trims
    function normalizeName(name) {
      return name
        .replace(/^(?:🔵|🔴|⚪|⚫|🟢|🟡|🟠|🟣|🟤)\s*/, '') // Remove emoji prefixes
        .replace(/^It's\s+/i, '') // Remove "It's" prefix
        .replace(/'s\s+turn.*$/i, '') // Remove "'s turn" suffix
        .trim();
    }

    const normalizedCurrentName = normalizeName(current.name);
    debug.log(`🔍 Normalized current combatant: "${normalizedCurrentName}"`);

    // Send activateTurn/deactivateTurn to all popup windows
    Object.keys(characterPopups).forEach(characterName => {
      const popup = characterPopups[characterName];
      try {
        if (popup && !popup.closed) {
          const normalizedCharName = normalizeName(characterName);

          // Strict match: names must be exactly equal after normalization
          const isTheirTurn = normalizedCharName === normalizedCurrentName;

          debug.log(`🔍 Comparing: "${characterName}" (normalized: "${normalizedCharName}") vs "${current.name}" (normalized: "${normalizedCurrentName}") → ${isTheirTurn ? 'ACTIVATE' : 'DEACTIVATE'}`);
          debug.log(`🔍 Raw comparison: "${characterName}" === "${current.name}" → ${characterName === current.name}`);

          popup.postMessage({
            action: isTheirTurn ? 'activateTurn' : 'deactivateTurn',
            combatant: current.name
          }, '*');

          debug.log(`📤 Sent ${isTheirTurn ? 'activateTurn' : 'deactivateTurn'} to "${characterName}"`);
        } else {
          // Clean up closed popups
          delete characterPopups[characterName];
          debug.log(`🗑️ Removed closed popup for ${characterName}`);
        }
      } catch (error) {
        debug.warn(`⚠️ Error sending message to popup "${characterName}":`, error);
        delete characterPopups[characterName];
      }
    });
  }

  function announceTurn() {
    const current = getCurrentCombatant();
    if (!current) return;

    postChatMessage(`🎯 It's ${current.name}'s turn! (Initiative: ${current.initiative})`);
  }

  /**
   * Chat monitoring for initiative rolls
   */
  let chatObserver = null;

  function startChatMonitoring() {
    const chatLog = document.getElementById('textchat');
    if (!chatLog) {
      debug.warn('⚠️ Roll20 chat not found, cannot monitor for initiative');
      return;
    }

    // Watch for new messages
    chatObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList && node.classList.contains('message')) {
            checkForInitiativeRoll(node);
            checkForPlayerRoll(node); // Track any character roll for player overview
          }
        });
      });
    });

    chatObserver.observe(chatLog, {
      childList: true,
      subtree: true
    });

    debug.log('👀 Monitoring Roll20 chat for initiative rolls and player tracking');
  }

  function stopChatMonitoring() {
    if (chatObserver) {
      chatObserver.disconnect();
      chatObserver = null;
      debug.log('🛑 Stopped monitoring chat');
    }
  }

  /**
   * Check message for initiative roll
   */
  function checkForInitiativeRoll(messageNode) {
    const text = messageNode.textContent || '';
    const innerHTML = messageNode.innerHTML || '';

    // Debug: Log the message to see format
    debug.log('📨 Chat message (text):', text);
    debug.log('📨 Chat message (html):', innerHTML);

    // Skip our own announcements (turn changes, round starts, GM mode toggles)
    // These start with specific emojis and should not be parsed as initiative rolls
    const ownAnnouncementPrefixes = ['🎯', '⚔️', '👑'];
    const trimmedText = text.trim();
    for (const prefix of ownAnnouncementPrefixes) {
      if (trimmedText.includes(prefix)) {
        debug.log('⏭️ Skipping own announcement message');
        return;
      }
    }

    // Check for Roll20's inline roll format in HTML
    // Look for dice rolls with "inlinerollresult" class
    const inlineRolls = messageNode.querySelectorAll('.inlinerollresult');
    if (inlineRolls.length > 0) {
      // Check if message contains "initiative" keyword
      const lowerText = text.toLowerCase();
      if (lowerText.includes('initiative') || lowerText.includes('init')) {
        let characterName = null;

        // Try to extract from roll template caption first
        const rollTemplate = messageNode.querySelector('.sheet-rolltemplate-default, .sheet-rolltemplate-custom');
        if (rollTemplate) {
          const caption = rollTemplate.querySelector('caption, .sheet-template-name, .charname');
          if (caption) {
            const captionText = caption.textContent.trim();
            // Extract name from patterns like "🔵 Test 2 rolls Initiative" or "Name: Initiative"
            const nameMatch = captionText.match(/^(?:🔵|🔴|⚪|⚫|🟢|🟡|🟠|🟣|🟤)?\s*(.+?)\s+(?:rolls?\s+)?[Ii]nitiative/i);
            if (nameMatch) {
              characterName = nameMatch[1].trim();
            }
          }
        }

        // Fallback: Extract character name from .by element (regular chat messages)
        if (!characterName) {
          const byElement = messageNode.querySelector('.by');
          characterName = byElement ? byElement.textContent.trim().replace(/:/g, '') : null;
        }

        // Get the roll result from the last inline roll
        const lastRoll = inlineRolls[inlineRolls.length - 1];
        const rollResult = lastRoll.textContent.trim();
        const initiative = parseInt(rollResult);

        if (characterName && !isNaN(initiative) && initiative >= 0 && initiative <= 50) {
          debug.log(`🎲 Detected initiative roll (inline): ${characterName} = ${initiative}`);
          addCombatant(characterName, initiative, 'chat');
          return;
        }
      }
    }

    // Look for patterns like:
    // "Grey rolls Initiative Roll 21"
    // "Test 1 rolls Initiative Roll 22"
    // "CharacterName rolled a 15 for initiative"
    // "Initiative: 18"
    const initiativePatterns = [
      // Pattern 1: "Name rolls Initiative Roll 21" or "Name: rolls Initiative 21"
      /^(.+?)(?::)?\s+rolls?\s+[Ii]nitiative.*?(\d+)/,
      // Pattern 2: "Name rolled 15 for initiative"
      /^(.+?)\s+rolled?\s+(?:a\s+)?(\d+)\s+for\s+[Ii]nitiative/,
      // Pattern 3: Generic "Name ... initiative ... 15" (case insensitive)
      /^(.+?).*?[Ii]nitiative.*?(\d+)/,
      // Pattern 4: "Name ... Init ... 15"
      /^(.+?).*?[Ii]nit.*?(\d+)/
    ];

    for (const pattern of initiativePatterns) {
      const match = text.match(pattern);
      if (match) {
        let name = match[1].trim();
        // Remove trailing colons and "rolls" text
        name = name.replace(/\s*:?\s*rolls?$/i, '').trim();
        const initiative = parseInt(match[2]);

        if (name && !isNaN(initiative) && initiative >= 0 && initiative <= 50) {
          debug.log(`🎲 Detected initiative roll (text): ${name} = ${initiative}`);
          addCombatant(name, initiative, 'chat');
          return;
        }
      }
    }
  }

  /**
   * Check message for any character roll and track player
   */
  function checkForPlayerRoll(messageNode) {
    const text = messageNode.textContent || '';

    // Skip our own announcements
    const ownAnnouncementPrefixes = ['🎯', '⚔️', '👑', '🔓', '⏸️', '▶️', '📋'];
    const trimmedText = text.trim();
    for (const prefix of ownAnnouncementPrefixes) {
      if (trimmedText.includes(prefix)) {
        return;
      }
    }

    // Skip system messages
    if (text.includes('created the character') ||
        text.includes('Welcome to Roll20') ||
        text.includes('has joined the game')) {
      return;
    }

    // Check for inline rolls (indicates a character is rolling)
    const inlineRolls = messageNode.querySelectorAll('.inlinerollresult');
    if (inlineRolls.length === 0) {
      return; // No rolls, skip
    }

    let characterName = null;

    // Try to extract character name from roll template
    const rollTemplate = messageNode.querySelector('.sheet-rolltemplate-default, .sheet-rolltemplate-custom, [class*="rolltemplate"]');
    if (rollTemplate) {
      const caption = rollTemplate.querySelector('caption, .sheet-template-name, .charname, [class*="charname"]');
      if (caption) {
        const captionText = caption.textContent.trim();
        // Extract name from patterns like "🔵 Character Name rolls Attack" or "Character Name: Attack"
        const nameMatch = captionText.match(/^(?:🔵|🔴|⚪|⚫|🟢|🟡|🟠|🟣|🟤)?\s*(.+?)\s*(?:rolls?\s+|\s*:\s*|$)/i);
        if (nameMatch) {
          characterName = nameMatch[1].trim();
        }
      }
    }

    // Fallback: Try to extract from message structure
    if (!characterName) {
      const byElement = messageNode.querySelector('.by');
      if (byElement) {
        characterName = byElement.textContent.trim();
      }
    }

    // Fallback: Parse from message text
    if (!characterName) {
      // Pattern: "Character Name: roll result" or "Character Name rolls"
      const patterns = [
        /^(?:🔵|🔴|⚪|⚫|🟢|🟡|🟠|🟣|🟤)?\s*(.+?)\s*:/,
        /^(?:🔵|🔴|⚪|⚫|🟢|🟡|🟠|🟣|🟤)?\s*(.+?)\s+rolls?/i
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          characterName = match[1].trim();
          break;
        }
      }
    }

    // If we got a character name, track them
    if (characterName && characterName.length > 0) {
      // Skip obviously non-player names
      const skipNames = ['gm', 'dm', 'roll20', 'system', 'the', 'a ', 'an '];
      const lowerName = characterName.toLowerCase();
      if (skipNames.some(skip => lowerName === skip || lowerName.startsWith(skip + ' '))) {
        return;
      }

      // Add to player tracking if not already tracked
      if (!playerData[characterName]) {
        debug.log(`👥 New player detected from roll: ${characterName}`);

        playerData[characterName] = {
          hp: null, // Will be updated when popup sends data
          maxHp: null,
          ac: null,
          passivePerception: null,
          initiative: null,
          conditions: [],
          concentration: null,
          deathSaves: null
        };

        updatePlayerOverviewDisplay();

        // Log to turn history
        logTurnAction({
          action: 'turn',
          description: `${characterName} detected in combat`
        });
      }
    }
  }

  /**
   * Register a character popup window
   * Called by character-sheet-overlay when opening a popup
   */
  window.rollcloudRegisterPopup = function(characterName, popupWindow) {
    if (characterName && popupWindow) {
      characterPopups[characterName] = popupWindow;
      debug.log(`✅ Registered popup for: ${characterName}`);
    }
  };

  /**
   * Check recent chat messages to see if it's currently this character's turn
   */
  function checkRecentChatForCurrentTurn(characterName, popupWindow) {
    try {
      const chatLog = document.getElementById('textchat');
      if (!chatLog) {
        debug.warn('⚠️ Roll20 chat not found for turn check');
        return;
      }

      // Get recent messages (last 20 or so)
      const messages = chatLog.querySelectorAll('.message');
      const recentMessages = Array.from(messages).slice(-20);
      
      debug.log(`🔍 Checking recent ${recentMessages.length} messages for current turn of: ${characterName}`);

      // Helper function to normalize names
      function normalizeName(name) {
        return name
          .replace(/^(?:🔵|🔴|⚪|⚫|🟢|🟡|🟠|🟣|🟤)\s*/, '') // Remove emoji prefixes
          .replace(/^It's\s+/i, '') // Remove "It's" prefix
          .replace(/'s\s+turn.*$/i, '') // Remove "'s turn" suffix
          .trim();
      }

      const normalizedCharacterName = normalizeName(characterName);

      // Look for recent turn announcement
      for (let i = recentMessages.length - 1; i >= 0; i--) {
        const message = recentMessages[i];
        const text = message.textContent || '';
        
        // Check for turn announcement pattern
        const turnMatch = text.match(/🎯 It's (.+?)'s turn! \(Initiative: (\d+)\)/);
        if (turnMatch) {
          const announcedCharacter = normalizeName(turnMatch[1]);
          const initiative = parseInt(turnMatch[2]);
          
          debug.log(`🔍 Found turn announcement: "${turnMatch[1]}" (normalized: "${announcedCharacter}") vs "${characterName}" (normalized: "${normalizedCharacterName}")`);
          
          if (announcedCharacter === normalizedCharacterName) {
            debug.log(`✅ It's ${characterName}'s turn! Activating action economy...`);
            
            // Send activateTurn to this popup
            popupWindow.postMessage({
              action: 'activateTurn',
              combatant: characterName
            }, '*');
            
            return;
          } else {
            debug.log(`⏸️ It's ${turnMatch[1]}'s turn, not ${characterName}. Deactivating...`);
            
            // Send deactivateTurn to this popup
            popupWindow.postMessage({
              action: 'deactivateTurn',
              combatant: characterName
            }, '*');
            
            return;
          }
        }
      }
      
      debug.log(`🔍 No recent turn announcement found for ${characterName}`);
      
    } catch (error) {
      debug.warn('⚠️ Error checking recent chat for turn:', error);
    }
  }

  /**
   * Listen for messages to toggle GM mode and post chat messages
   */
  window.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'toggleGMMode') {
      toggleGMMode(event.data.enabled);
    } else if (event.data && event.data.action === 'postChatMessageFromPopup') {
      // Post message from character sheet popup to Roll20 chat
      postChatMessage(event.data.message);
      debug.log(`📨 Posted message from popup: ${event.data.message}`);
    } else if (event.data && event.data.action === 'registerPopup') {
      // Register popup from character sheet (CORS-safe fallback)
      // Find the popup window that sent this message
      if (event.source && event.data.characterName) {
        characterPopups[event.data.characterName] = event.source;
        debug.log(`✅ Registered popup via postMessage: ${event.data.characterName}`);
      }
    } else if (event.data && event.data.action === 'checkCurrentTurn') {
      // Check if it's currently this character's turn by examining recent chat
      if (event.data.characterName) {
        checkRecentChatForCurrentTurn(event.data.characterName, event.source);
      }
    } else if (event.data && event.data.action === 'updatePlayerData') {
      // Receive player data updates for GM overview
      if (event.data.characterName && event.data.data) {
        updatePlayerData(event.data.characterName, event.data.data);
      }
    }
  });

  browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleGMMode') {
      toggleGMMode(request.enabled);
      sendResponse({ success: true });
    }
  });

  debug.log('✅ Roll20 script ready - listening for roll announcements and GM mode');
})();