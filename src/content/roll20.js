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

    // Post to chat
    const success = postChatMessage(formattedMessage);

    if (success) {
      debug.log('✅ Roll successfully posted to Roll20');
    } else {
      debug.error('❌ Failed to post roll to Roll20');
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
    if (request.action === 'postRollToChat') {
      handleDiceCloudRoll(request.roll);
      sendResponse({ success: true });
    } else if (request.action === 'rollFromPopout') {
      // Skip immediate posting - wait for the actual result from Dice Cloud
      // This prevents duplicate rolls (one from request, one from result)
      debug.log('🔄 Roll request received, waiting for Dice Cloud result...');
      sendResponse({ success: true });
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
      // Skip immediate posting - wait for the actual result from Dice Cloud
      // This prevents duplicate rolls (one from request, one from result)
      debug.log('🔄 Roll request received from popup, waiting for Dice Cloud result...');
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
      <button id="prev-turn-btn" style="padding: 8px 12px; background: #3498db; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85em;">← Prev</button>
      <button id="next-turn-btn" style="padding: 8px 12px; background: #27ae60; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85em;">Next →</button>
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
    const nextBtn = document.getElementById('next-turn-btn');
    const prevBtn = document.getElementById('prev-turn-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');

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

    // Visual feedback - change border color when active
    if (gmModeEnabled) {
      gmPanel.style.borderColor = '#27ae60'; // Green border when active
      gmPanel.style.boxShadow = '0 8px 32px rgba(39, 174, 96, 0.3)'; // Green glow
    } else {
      gmPanel.style.borderColor = '#4ECDC4'; // Default cyan border
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
      updateInitiativeDisplay();
      debug.log('🗑️ All combatants cleared');
    }
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
        <div style="padding: 10px; background: ${isActive ? '#4ECDC4' : '#34495e'}; border: 2px solid ${isActive ? '#27ae60' : '#2c3e50'}; border-radius: 6px; display: flex; align-items: center; gap: 10px; ${isActive ? 'box-shadow: 0 0 15px rgba(78, 205, 196, 0.4);' : ''}">
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

    // Try to find character sheet popup window and send message
    // This will activate their action economy
    try {
      const popupWindows = window.opener ? [window.opener] : [];
      popupWindows.forEach(win => {
        if (win && !win.closed) {
          win.postMessage({
            action: 'activateTurn',
            combatant: current.name
          }, '*');
        }
      });
    } catch (error) {
      debug.warn('Could not notify character sheet:', error);
    }
  }

  /**
   * Announce current turn in Roll20 chat
   */
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
      if (trimmedText.startsWith(prefix)) {
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
   * Listen for messages to toggle GM mode and post chat messages
   */
  window.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'toggleGMMode') {
      toggleGMMode(event.data.enabled);
    } else if (event.data && event.data.action === 'postChatMessageFromPopup') {
      // Post message from character sheet popup to Roll20 chat
      postChatMessage(event.data.message);
      debug.log(`📨 Posted message from popup: ${event.data.message}`);
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