/**
 * Action Announcements Module
 *
 * Handles announcing actions to chat.
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 *
 * Functions exported to globalThis:
 * - announceAction(action)
 * - postActionToChat(actionLabel, state)
 */

(function() {
  'use strict';

  /**
   * Announce the use of an action to chat
   * @param {Object} action - Action object with name, actionType, description, etc.
   */
  function announceAction(action) {
    // TODO: Add Owlbear Rodeo integration for action announcements
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

    // Get color emoji and character name for notification
    const colorEmoji = typeof getColorEmoji === 'function' ? getColorEmoji(characterData.notificationColor) : '';
    const notificationText = colorEmoji ? `${colorEmoji} ${characterData.name} used ${action.name}!` : `✨ ${characterData.name} used ${action.name}!`;

    showNotification(notificationText);
    debug.log('✅ Action announcement displayed');

    // TODO: Add Owlbear Rodeo integration here to send action announcements to VTT
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
