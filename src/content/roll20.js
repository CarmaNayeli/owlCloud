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

      // Format and post to Roll20 chat
      const formattedMessage = formatRollForRoll20(rollData);
      const success = postChatMessage(formattedMessage);

      if (success) {
        debug.log('✅ Roll posted directly to Roll20 (no DiceCloud!)');
        // Observe Roll20's result for natural 1s/20s
        observeNextRollResult(rollData);
      }

      sendResponse({ success: success });
    } else if (request.action === 'announceSpell') {
      // Handle spell/action announcements relayed from background script (Firefox)
      if (request.message) {
        postChatMessage(request.message);
      } else {
        handleDiceCloudRoll(request);
      }
      sendResponse({ success: true });
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
      
      // Send to all registered popup windows
      Object.keys(characterPopups).forEach(characterName => {
        const popup = characterPopups[characterName];
        try {
          if (popup && !popup.closed) {
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

      // Format and post to Roll20 chat
      const formattedMessage = formatRollForRoll20(rollData);
      const success = postChatMessage(formattedMessage);

      if (success) {
        debug.log('✅ Roll posted directly to Roll20 (no DiceCloud!)');
        // Observe Roll20's result for natural 1s/20s
        observeNextRollResult(rollData);
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
  let gmPanel = null;
  const characterPopups = {}; // Track popup windows by character name
  let combatStarted = false; // Track if combat has been initiated
  let initiativeTracker = {
    combatants: [],
    currentTurnIndex: 0,
    round: 1
  };

  /**
   * Create GM Initiative Tracker Panel
   */
  function createGMPanel() {
    if (gmPanel) return gmPanel;

    // Create panel
    gmPanel = document.createElement('div');
    gmPanel.id = 'rollcloud-gm-panel';
    gmPanel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      width: 350px;
      background: #2a2a2a;
      border: 3px solid #4ECDC4;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      z-index: 100000;
      display: none;
      font-family: Arial, sans-serif;
      color: #fff;
    `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      background: #4ECDC4;
      color: #fff;
      padding: 12px;
      border-radius: 9px 9px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
      user-select: none;
    `;
    header.innerHTML = `
      <div style="font-weight: bold; font-size: 1.1em; display: flex; align-items: center; gap: 6px;">
        <span>👑</span> GM Initiative Tracker
      </div>
      <button id="gm-panel-close" style="background: transparent; border: none; color: #fff; font-size: 1.3em; cursor: pointer; padding: 0 8px;">✕</button>
    `;

    // Create content area
    const content = document.createElement('div');
    content.style.cssText = `
      padding: 15px;
      max-height: 500px;
      overflow-y: auto;
    `;

    // Create controls
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

    // Create round display
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

    // Create initiative list
    const initiativeList = document.createElement('div');
    initiativeList.id = 'initiative-list';
    initiativeList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 15px;
    `;

    // Create add combatant form with collapsible header
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

    // Assemble panel
    content.appendChild(controls);
    content.appendChild(roundDisplay);
    content.appendChild(initiativeList);
    content.appendChild(addFormSection);
    gmPanel.appendChild(header);
    gmPanel.appendChild(content);
    document.body.appendChild(gmPanel);

    // Make draggable
    makeDraggable(gmPanel, header);

    // Attach event listeners
    attachGMPanelListeners();

    debug.log('✅ GM Panel created');
    return gmPanel;
  }

  /**
   * Make element draggable
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
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
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

    debug.log('✅ GM Panel listeners attached');
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
        ? '👑 GM Initiative Tracker is now active - monitoring chat for initiative rolls'
        : '👑 GM Initiative Tracker deactivated';

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
      return `
        <div style="padding: 10px; background: ${isActive ? '#4ECDC4' : '#34495e'}; border: 2px solid ${isActive ? '#4ECDC4' : '#2c3e50'}; border-radius: 6px; display: flex; align-items: center; gap: 10px; ${isActive ? 'box-shadow: 0 0 15px rgba(78, 205, 196, 0.4);' : ''}">
          <div style="font-weight: bold; font-size: 1.2em; min-width: 30px; text-align: center;">${combatant.initiative}</div>
          <div style="flex: 1; font-weight: bold;">${combatant.name}</div>
          <button class="rollcloud-remove-combatant" data-combatant-name="${combatant.name}" style="background: #e74c3c; color: #fff; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.85em;">✕</button>
        </div>
      `;
    }).join('');

    // Attach event listeners to remove buttons (CSP-compliant)
    const removeButtons = list.querySelectorAll('.rollcloud-remove-combatant');
    removeButtons.forEach(button => {
      button.addEventListener('click', () => {
        const name = button.getAttribute('data-combatant-name');
        removeCombatant(name);
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
          }
        });
      });
    });

    chatObserver.observe(chatLog, {
      childList: true,
      subtree: true
    });

    debug.log('👀 Monitoring Roll20 chat for initiative rolls');
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