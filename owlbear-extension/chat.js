/**
 * OwlCloud Chat Window Script
 *
 * Standalone chat interface for OwlCloud
 */

/* global OBR */

// ============== State ==============

let currentCharacter = null;
let isOwlbearReady = false;

// ============== DOM Elements ==============

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const characterNameEl = document.getElementById('character-name');

// ============== Owlbear SDK Initialization ==============

OBR.onReady(async () => {
  isOwlbearReady = true;
  console.log('🦉 Owlbear SDK ready in chat window');

  // Check for active character
  await checkForActiveCharacter();
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
 * Add a message to the chat
 * @param {string} text - Message text
 * @param {string} type - Message type: 'system', 'roll', 'action', 'spell', 'combat', 'user'
 * @param {string} author - Message author (optional)
 */
function addChatMessage(text, type = 'system', author = null) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${type}`;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (author) {
    messageDiv.innerHTML = `
      <div class="chat-message-header">
        <span class="chat-message-author">${author}</span>
        <span class="chat-message-time">${timeStr}</span>
      </div>
      <div class="chat-message-text">${text}</div>
    `;
  } else {
    messageDiv.innerHTML = `
      <div class="chat-message-text">${text}</div>
    `;
  }

  chatMessages.appendChild(messageDiv);
  scrollChatToBottom();

  // Limit chat history to last 100 messages
  const messages = chatMessages.querySelectorAll('.chat-message');
  if (messages.length > 100) {
    messages[0].remove();
  }
}

/**
 * Send a user message
 */
function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  // Add user message to chat
  const characterName = currentCharacter?.name || 'You';
  addChatMessage(text, 'user', characterName);

  // Send message to Owlbear via notification (placeholder - you can customize this)
  if (isOwlbearReady) {
    OBR.notification.show(`${characterName}: ${text}`, 'INFO');
  }

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
  addMessage: addChatMessage,
  announceRoll: (rollName, formula, result) => {
    const characterName = currentCharacter?.name || 'Character';
    const text = `🎲 ${rollName}: ${formula} = <strong>${result}</strong>`;
    addChatMessage(text, 'roll', characterName);
  },
  announceAction: (actionName, details = '') => {
    const characterName = currentCharacter?.name || 'Character';
    const text = details ? `⚔️ ${actionName} - ${details}` : `⚔️ ${actionName}`;
    addChatMessage(text, 'action', characterName);
  },
  announceSpell: (spellName, level, details = '') => {
    const characterName = currentCharacter?.name || 'Character';
    const levelText = level === 0 ? 'Cantrip' : `Level ${level}`;
    const text = details ? `✨ ${spellName} (${levelText}) - ${details}` : `✨ ${spellName} (${levelText})`;
    addChatMessage(text, 'spell', characterName);
  },
  announceCombat: (text) => {
    const characterName = currentCharacter?.name || 'Character';
    addChatMessage(text, 'combat', characterName);
  }
};

console.log('💬 Chat window initialized');
