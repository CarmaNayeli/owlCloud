/**
 * OwlCloud Chat Window Script
 *
 * Standalone chat interface for OwlCloud
 */

/* global OBR */

// ============== State ==============

let currentCharacter = null;
let isOwlbearReady = false;
let currentPlayerId = null;
let lastLoadedMessageId = null;

// ============== DOM Elements ==============

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const characterNameEl = document.getElementById('character-name');

// ============== Owlbear SDK Initialization ==============

OBR.onReady(async () => {
  isOwlbearReady = true;
  console.log('🦉 Owlbear SDK ready in chat window');

  // Get player ID
  currentPlayerId = await OBR.player.getId();

  // Check for active character
  await checkForActiveCharacter();

  // Load chat history from metadata
  await loadChatHistory();

  // Listen for messages from character sheet
  OBR.room.onMetadataChange((metadata) => {
    const message = metadata['com.owlcloud.chat/latest-message'];
    if (message && message.timestamp) {
      handleCharacterSheetMessage(message);
    }

    // Listen for new chat messages
    const messages = metadata['com.owlcloud.chat/messages'];
    if (messages && Array.isArray(messages)) {
      loadNewMessages(messages);
    }
  });
});

// ============== Character Management ==============

/**
 * Check for active character
 */
async function checkForActiveCharacter() {
  try {
    const playerId = await OBR.player.getId();

    const response = await fetch(
      `https://gkfpxwvmumaylahtxqrk.supabase.co/functions/v1/get-active-character?owlbear_player_id=${encodeURIComponent(playerId)}`
    );

    if (!response.ok) {
      console.error('Failed to get character:', response.statusText);
      return;
    }

    const data = await response.json();

    if (data.success && data.character) {
      currentCharacter = data.character;
      characterNameEl.textContent = currentCharacter.name || 'Unknown Character';
    }
  } catch (error) {
    console.error('Error checking for active character:', error);
  }
}

// ============== Message Handling ==============

let lastProcessedTimestamp = 0;

/**
 * Handle messages from character sheet
 */
function handleCharacterSheetMessage(message) {
  // Prevent duplicate processing
  if (message.timestamp <= lastProcessedTimestamp) {
    return;
  }
  lastProcessedTimestamp = message.timestamp;

  const characterName = message.character?.name || 'Character';

  switch (message.type) {
    case 'roll':
      if (message.data) {
        const { name, rolls, modifier, total } = message.data;
        const rollsText = rolls.join(' + ');
        const modText = modifier !== 0 ? ` ${modifier >= 0 ? '+' : ''}${modifier}` : '';
        const text = `🎲 ${name}: ${rollsText}${modText} = <strong>${total}</strong>`;
        addChatMessageToMetadata(text, 'roll', characterName);
      }
      break;

    case 'action':
      if (message.data) {
        const { actionName, details } = message.data;
        addChatMessageToMetadata(`⚔️ ${actionName} - ${details}`, 'action', characterName);
      }
      break;

    case 'spell':
      if (message.data) {
        const { spellName, level } = message.data;
        const levelText = level === 0 ? 'Cantrip' : `Level ${level}`;
        addChatMessageToMetadata(`✨ ${spellName} (${levelText})`, 'spell', characterName);
      }
      break;

    case 'combat':
      if (message.data && message.data.text) {
        addChatMessageToMetadata(message.data.text, 'combat', characterName);
      }
      break;

    default:
      console.warn('Unknown message type:', message.type);
  }
}

/**
 * Load chat history from room metadata
 */
async function loadChatHistory() {
  try {
    const metadata = await OBR.room.getMetadata();
    const messages = metadata['com.owlcloud.chat/messages'];

    if (messages && Array.isArray(messages)) {
      messages.forEach(msg => {
        displayChatMessage(msg.text, msg.type, msg.author, msg.timestamp, msg.details);
        lastLoadedMessageId = msg.id;
      });
      scrollChatToBottom();
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
  }
}

/**
 * Load new messages from metadata
 */
function loadNewMessages(messages) {
  if (!Array.isArray(messages)) return;

  const newMessages = messages.filter(msg =>
    !lastLoadedMessageId || msg.id > lastLoadedMessageId
  );

  newMessages.forEach(msg => {
    displayChatMessage(msg.text, msg.type, msg.author, msg.timestamp, msg.details);
    lastLoadedMessageId = msg.id;
  });

  if (newMessages.length > 0) {
    scrollChatToBottom();
  }
}

// ============== Chat Functions ==============

/**
 * Scroll chat to bottom
 */
function scrollChatToBottom() {
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 100);
}

/**
 * Display a message in the chat UI (local only, doesn't save to metadata)
 * @param {string} text - Message text
 * @param {string} type - Message type: 'system', 'roll', 'action', 'spell', 'combat', 'user'
 * @param {string} author - Message author (optional)
 * @param {number} timestamp - Message timestamp (optional)
 */
function displayChatMessage(text, type = 'system', author = null, timestamp = null, details = null) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${type}`;

  const now = timestamp ? new Date(timestamp) : new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Build message HTML
  let messageHTML = '';

  if (author) {
    messageHTML = `
      <div class="chat-message-header">
        <span class="chat-message-author">${author}</span>
        <span class="chat-message-time">${timeStr}</span>
      </div>
      <div class="chat-message-text">${text}</div>
    `;
  } else {
    messageHTML = `<div class="chat-message-text">${text}</div>`;
  }

  // Add expandable details if present
  if (details) {
    const detailsHTML = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
    messageHTML += `
      <div class="chat-message-details" style="display: none; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(138, 92, 246, 0.2); font-size: 12px; color: #aaa;">
        ${detailsHTML}
      </div>
    `;

    // Make message clickable to toggle details
    messageDiv.style.cursor = 'pointer';
    messageDiv.title = 'Click to expand details';
    messageDiv.onclick = function() {
      const detailsEl = this.querySelector('.chat-message-details');
      if (detailsEl) {
        const isHidden = detailsEl.style.display === 'none';
        detailsEl.style.display = isHidden ? 'block' : 'none';
        this.title = isHidden ? 'Click to collapse' : 'Click to expand details';
      }
    };
  }

  messageDiv.innerHTML = messageHTML;
  chatMessages.appendChild(messageDiv);

  // Limit chat history to last 100 messages
  const messages = chatMessages.querySelectorAll('.chat-message');
  if (messages.length > 100) {
    messages[0].remove();
  }
}

/**
 * Add a message to chat and save to room metadata (shared with all players)
 * @param {string} text - Message text
 * @param {string} type - Message type: 'system', 'roll', 'action', 'spell', 'combat', 'user'
 * @param {string} author - Message author (optional)
 */
async function addChatMessageToMetadata(text, type = 'system', author = null) {
  if (!isOwlbearReady) return;

  try {
    const metadata = await OBR.room.getMetadata();
    const messages = metadata['com.owlcloud.chat/messages'] || [];

    const newMessage = {
      id: Date.now() + Math.random(), // Unique ID
      text: text,
      type: type,
      author: author,
      playerId: currentPlayerId,
      timestamp: Date.now()
    };

    // Add to metadata (limit to last 100 messages)
    const updatedMessages = [...messages, newMessage].slice(-100);

    await OBR.room.setMetadata({
      'com.owlcloud.chat/messages': updatedMessages
    });
  } catch (error) {
    console.error('Error adding message to metadata:', error);
  }
}

/**
 * Send a user message
 */
async function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  // Add user message to shared chat
  const characterName = currentCharacter?.name || 'You';
  await addChatMessageToMetadata(text, 'user', characterName);

  // Clear input
  chatInput.value = '';
}

// ============== Event Listeners ==============

chatSendBtn.addEventListener('click', sendChatMessage);

chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendChatMessage();
  }
});

// ============== Expose Chat Functions ==============

// Expose chat functions for other windows to call
window.owlcloudChat = {
  addMessage: addChatMessageToMetadata,
  announceRoll: async (rollName, formula, result) => {
    const characterName = currentCharacter?.name || 'Character';
    const text = `🎲 ${rollName}: ${formula} = <strong>${result}</strong>`;
    await addChatMessageToMetadata(text, 'roll', characterName);
  },
  announceAction: async (actionName, details = '') => {
    const characterName = currentCharacter?.name || 'Character';
    const text = details ? `⚔️ ${actionName} - ${details}` : `⚔️ ${actionName}`;
    await addChatMessageToMetadata(text, 'action', characterName);
  },
  announceSpell: async (spellName, level, details = '') => {
    const characterName = currentCharacter?.name || 'Character';
    const levelText = level === 0 ? 'Cantrip' : `Level ${level}`;
    const text = details ? `✨ ${spellName} (${levelText}) - ${details}` : `✨ ${spellName} (${levelText})`;
    await addChatMessageToMetadata(text, 'spell', characterName);
  },
  announceCombat: async (text) => {
    const characterName = currentCharacter?.name || 'Character';
    await addChatMessageToMetadata(text, 'combat', characterName);
  }
};

console.log('💬 Chat window initialized');
