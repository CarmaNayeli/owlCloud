# DiceCloud Two-Way Sync Implementation Guide

## Overview

This guide explains how to implement two-way synchronization between RollCloud and DiceCloud using Meteor's DDP protocol.

## Architecture

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Popup UI    │────────▶│  Background  │────────▶│  DiceCloud   │
│ (popup.js)   │         │  (background)│         │   (Meteor)   │
└──────────────┘         └──────────────┘         └──────────────┘
       │                        │                         │
       │  User rolls action     │                         │
       ├────────────────────────▶                         │
       │                        │  WebSocket (DDP)        │
       │                        ├────────────────────────▶│
       │                        │  call('creatureProperties.update')
       │                        │                         │
       │                        │◀────────────────────────┤
       │                        │  { result: success }    │
       │◀───────────────────────┤                         │
       │  Show notification     │                         │
```

## Implementation Steps

### 1. Add DDP Client to Extension

**File:** `src/lib/meteor-ddp-client.js`

Copy the DDP client implementation from `experimental/two-way-sync/meteor-ddp-client.js`.

**Update manifest.json:**
```json
{
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://dicecloud.com/*"],
      "js": ["lib/meteor-ddp-client.js", "content/dicecloud.js"]
    }
  ]
}
```

### 2. Initialize DDP Connection in Background Script

**File:** `src/background.js`

```javascript
// Add at the top
import MeteorDDPClient from './lib/meteor-ddp-client.js';

// Global connection state
let ddpClient = null;
let ddpConnectionPromise = null;

/**
 * Ensure DDP connection is established
 */
async function ensureDDPConnection() {
  // Return existing connection if available
  if (ddpClient && ddpClient.isConnected()) {
    return ddpClient;
  }

  // Return existing connection promise if connecting
  if (ddpConnectionPromise) {
    return ddpConnectionPromise;
  }

  // Start new connection
  ddpConnectionPromise = (async () => {
    try {
      // Create client
      ddpClient = new MeteorDDPClient('wss://dicecloud.com/websocket');

      // Connect
      await ddpClient.connect();
      console.log('[DDP] Connected to DiceCloud');

      // Get token from storage
      const { diceCloudToken } = await browserAPI.storage.local.get(['diceCloudToken']);

      if (!diceCloudToken) {
        throw new Error('No DiceCloud token available');
      }

      // Login with token
      await ddpClient.loginWithToken(diceCloudToken);
      console.log('[DDP] Authenticated with DiceCloud');

      return ddpClient;
    } catch (error) {
      console.error('[DDP] Connection failed:', error);
      ddpClient = null;
      throw error;
    } finally {
      ddpConnectionPromise = null;
    }
  })();

  return ddpConnectionPromise;
}

// Add message handler for sync requests
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ... existing handlers ...

  if (request.action === 'syncPropertyUpdate') {
    (async () => {
      try {
        const client = await ensureDDPConnection();

        const result = await client.call('creatureProperties.update', {
          _id: request.propertyId,
          path: request.path,
          value: request.value
        });

        sendResponse({ success: true, result });
      } catch (error) {
        console.error('[DDP] Sync failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Async response
  }

  if (request.action === 'syncQuantityAdjust') {
    (async () => {
      try {
        const client = await ensureDDPConnection();

        const result = await client.call('creatureProperties.adjustQuantity', {
          _id: request.propertyId,
          operation: request.operation,
          value: request.value
        });

        sendResponse({ success: true, result });
      } catch (error) {
        console.error('[DDP] Sync failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Async response
  }
});

// Clean up on logout
async function logout() {
  // ... existing logout code ...

  // Disconnect DDP
  if (ddpClient) {
    ddpClient.disconnect();
    ddpClient = null;
  }
}
```

### 3. Update Character Data Extraction

**File:** `src/content/dicecloud.js`

When extracting character data, also extract property `_id` values:

```javascript
// In extractCharacterData function
properties.forEach(prop => {
  switch (prop.type) {
    case 'action':
      if (prop.name && !prop.inactive && !prop.disabled) {
        const action = {
          name: prop.name,
          _id: prop._id, // STORE THIS!
          actionType: prop.actionType || 'other',
          attackRoll: attackRoll,
          damage: damage,
          damageType: damageType,
          description: description,
          uses: prop.uses || null,
          usesUsed: prop.usesUsed || 0,
          resources: prop.resources || null
        };
        characterData.actions.push(action);
      }
      break;

    case 'attribute':
      if (prop.attributeType === 'resource') {
        characterData.resources.push({
          name: prop.name,
          _id: prop._id, // STORE THIS!
          variableName: prop.variableName,
          current: prop.value || 0,
          max: prop.total || prop.value || 0
        });
      }
      break;

    // ... other cases ...
  }
});
```

### 4. Add Sync Calls to Popup

**File:** `src/popup-sheet.js`

```javascript
// Add at top
let syncEnabled = true; // Can be toggled in settings

/**
 * Sync property update to DiceCloud
 */
async function syncPropertyToDiceCloud(propertyId, path, value) {
  if (!syncEnabled || !propertyId) {
    return; // Sync disabled or no property ID
  }

  try {
    const response = await browserAPI.runtime.sendMessage({
      action: 'syncPropertyUpdate',
      propertyId: propertyId,
      path: path,
      value: value
    });

    if (!response.success) {
      console.error('[Sync] Failed:', response.error);
      // Don't show error to user - sync is optional
    }
  } catch (error) {
    console.error('[Sync] Error:', error);
  }
}

/**
 * Modified decrementActionUses with sync
 */
function decrementActionUses(action) {
  if (!action.uses) {
    return true;
  }

  const usesUsed = action.usesUsed || 0;
  const usesTotal = action.uses.total || action.uses.value || action.uses;
  const usesRemaining = usesTotal - usesUsed;

  if (usesRemaining <= 0) {
    showNotification(`❌ No uses remaining for ${action.name}`, 'error');
    return false;
  }

  // Increment usesUsed
  action.usesUsed = usesUsed + 1;
  const newRemaining = usesTotal - action.usesUsed;

  // Update character data and save
  saveCharacterData();

  // Show notification
  showNotification(`✅ Used ${action.name} (${newRemaining}/${usesTotal} remaining)`);

  // Rebuild the actions display to show updated count
  const actionsContainer = document.getElementById('actions-container');
  buildActionsDisplay(actionsContainer, characterData.actions);

  // Sync to DiceCloud (async, don't wait)
  syncPropertyToDiceCloud(action._id, ['usesUsed'], action.usesUsed);

  return true;
}

// Similar updates for resource consumption:
function consumeResource(resource, amount) {
  resource.current -= amount;
  saveCharacterData();

  // Sync to DiceCloud
  syncPropertyToDiceCloud(resource._id, ['value'], resource.current);
}
```

### 5. Add Settings Toggle

**File:** `src/popup/popup.html`

```html
<div class="settings-section">
  <label class="setting-item">
    <input type="checkbox" id="enable-dicecloud-sync" checked>
    <span>Sync changes to DiceCloud</span>
    <small>Automatically update DiceCloud when using actions/resources</small>
  </label>
</div>
```

**File:** `src/popup/popup.js`

```javascript
// Load sync preference
browserAPI.storage.local.get(['dicecloudSyncEnabled']).then(result => {
  syncEnabled = result.dicecloudSyncEnabled !== false; // Default true
  document.getElementById('enable-dicecloud-sync').checked = syncEnabled;
});

// Save sync preference
document.getElementById('enable-dicecloud-sync').addEventListener('change', (e) => {
  syncEnabled = e.target.checked;
  browserAPI.storage.local.set({ dicecloudSyncEnabled: syncEnabled });
});
```

## Testing

### 1. Manual Testing

1. **Connect to DiceCloud:**
   - Use the extension to log in to DiceCloud
   - Open browser console (F12)
   - Look for `[DDP] Connected to DiceCloud` message

2. **Use an action with limited uses:**
   - Find an action like "Second Wind" or "Bardic Inspiration"
   - Roll the action through the extension
   - Check DiceCloud character sheet - `usesUsed` should increment

3. **Consume a resource:**
   - Use Ki Points or Sorcery Points
   - Check DiceCloud character sheet - value should decrease

4. **Use consumable item:**
   - Fire an arrow or use a potion
   - Check DiceCloud inventory - quantity should decrease

### 2. Error Handling Test

1. **Network failure:**
   - Disable internet connection
   - Try to roll an action
   - Should work locally but not sync
   - Re-enable internet
   - Next roll should sync successfully

2. **Invalid property ID:**
   - Manually create an action without `_id`
   - Roll it
   - Should work locally, sync silently fails

### 3. Performance Test

1. **Rapid actions:**
   - Roll multiple actions quickly
   - All should queue and sync in order
   - No blocking or UI freezing

## Rollback Plan

If sync causes issues:

1. **Disable in settings:**
   - Uncheck "Sync changes to DiceCloud"
   - Extension works normally without sync

2. **Remove sync code:**
   - Revert to commit before sync implementation
   - Remove DDP client files
   - Remove sync message handlers

## Troubleshooting

### Connection Issues

**Symptom:** `[DDP] Connection failed`

**Solutions:**
- Check DiceCloud is online (https://dicecloud.com/api/status)
- Verify WebSocket URL is correct
- Check browser console for CORS errors
- Try refreshing authentication token

### Authentication Issues

**Symptom:** `[DDP] Login failed`

**Solutions:**
- Re-login through extension
- Check token hasn't expired
- Verify token is valid via API

### Sync Failures

**Symptom:** Property updates don't appear on DiceCloud

**Solutions:**
- Verify property `_id` is correct
- Check property hasn't been deleted on DiceCloud
- Refresh character data from DiceCloud
- Check browser console for error messages

## Performance Considerations

1. **Connection pooling:** Single WebSocket connection shared across all tabs
2. **Async updates:** Sync operations don't block UI
3. **Graceful degradation:** Extension works without sync if connection fails
4. **Rate limiting:** DiceCloud enforces rate limits (handled by DDP client)
5. **Batching:** Consider batching multiple updates in rapid succession

## Security Considerations

1. **Token storage:** Authentication token stored in browser.storage.local (encrypted)
2. **WebSocket:** Uses WSS (encrypted WebSocket)
3. **Permissions:** DiceCloud verifies user has edit permission on character
4. **Rate limiting:** Prevents abuse of API

## Future Enhancements

1. **Real-time updates:** Subscribe to character changes from other clients
2. **Conflict resolution:** Handle simultaneous edits from multiple sources
3. **Offline queue:** Store sync operations when offline, replay when online
4. **Selective sync:** Choose which properties to sync
5. **Sync indicators:** Show visual feedback when syncing
