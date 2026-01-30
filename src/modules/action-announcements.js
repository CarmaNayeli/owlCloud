/**
 * Action Announcements Module
 *
 * Handles announcing actions to Roll20 chat.
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 *
 * Functions exported to globalThis:
 * - announceAction(action)
 * - postActionToChat(actionLabel, state)
 */

(function() {
  'use strict';

  /**
   * Announce the use of an action to Roll20 chat
   * @param {Object} action - Action object with name, actionType, description, etc.
   */
  function announceAction(action) {
    // Announce the use of an action (bonus action, reaction, etc.) to Roll20 chat
    const colorBanner = getColoredBanner(characterData);

    // Determine action type emoji
    const actionTypeEmoji = {
      'bonus': '⚡',
      'reaction': '🛡️',
      'action': '⚔️',
      'free': '💨',
      'legendary': '👑',
      'lair': '🏰',
      'other': '✨'
    };

    const emoji = actionTypeEmoji[action.actionType?.toLowerCase()] || '✨';
    const actionTypeText = action.actionType ? ` (${action.actionType})` : '';

    let message = `&{template:default} {{name=${colorBanner}${characterData.name}}} {{${emoji} Action=${action.name}}} {{Type=${action.actionType || 'action'}}}`;

    // Add summary if available
    if (action.summary) {
      const resolvedSummary = resolveVariablesInFormula(action.summary);
      message += ` {{Summary=${resolvedSummary}}}`;
    }

    // Add description (resolve variables first)
    if (action.description) {
      const resolvedDescription = resolveVariablesInFormula(action.description);
      message += ` {{Description=${resolvedDescription}}}`;
    }

    // Add uses if available
    if (action.uses) {
      const usesUsed = action.usesUsed || 0;
      const usesTotal = action.uses.total || action.uses.value || action.uses;
      // Prefer usesLeft from DiceCloud if available, otherwise calculate from usesUsed
      const usesRemaining = action.usesLeft !== undefined ? action.usesLeft : (usesTotal - usesUsed);
      const usesText = `${usesRemaining} / ${usesTotal}`;
      message += ` {{Uses=${usesText}}}`;
    }

    // Send to Roll20 chat
    const messageData = {
      action: 'announceSpell',
      message: message,
      color: characterData.notificationColor
    };

    // Get color emoji and character name for notification
    const colorEmoji = typeof getColorEmoji === 'function' ? getColorEmoji(characterData.notificationColor) : '';
    const notificationText = colorEmoji ? `${colorEmoji} ${characterData.name} used ${action.name}!` : `✨ ${characterData.name} used ${action.name}!`;

    // Try window.opener first (Chrome)
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(messageData, '*');
        showNotification(notificationText);
        debug.log('✅ Action announcement sent via window.opener');
        return;
      } catch (error) {
        debug.warn('⚠️ Could not send via window.opener:', error.message);
      }
    }

    // Fallback: Use background script to relay to Roll20 (Firefox)
    debug.log('📡 Using background script to relay action announcement to Roll20...');
    browserAPI.runtime.sendMessage({
      action: 'relayRollToRoll20',
      roll: messageData
    }, (response) => {
      if (browserAPI.runtime.lastError) {
        debug.error('❌ Error relaying action announcement:', browserAPI.runtime.lastError);
        showNotification('❌ Failed to announce action');
      } else if (response && response.success) {
        debug.log('✅ Action announcement relayed to Roll20');
        showNotification(notificationText);
      }
    });
  }

  /**
   * Post action economy update to chat
   * @param {string} actionLabel - Label for the action (e.g., "Action", "Bonus Action")
   * @param {string} state - State: "used" or "restored"
   */
  function postActionToChat(actionLabel, state) {
    const emoji = state === 'used' ? '❌' : '✅';
    const message = `${emoji} ${characterData.name} ${state === 'used' ? 'uses' : 'restores'} ${actionLabel}`;
    postToChatIfOpener(message);

    // Also post to Discord
    postActionEconomyToDiscord();
  }

  // ===== EXPORTS =====

  globalThis.announceAction = announceAction;
  globalThis.postActionToChat = postActionToChat;

  console.log('✅ Action Announcements module loaded');

})();
