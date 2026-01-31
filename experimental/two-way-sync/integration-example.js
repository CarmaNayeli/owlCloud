/**
 * Integration Example for DiceCloud Two-Way Sync
 *
 * This file demonstrates how to integrate the DDP client and DiceCloud sync
 * into the OwlCloud extension.
 *
 * USAGE:
 * 1. Include meteor-ddp-client.js and dicecloud-sync.js in your manifest
 * 2. Initialize the connection when user logs in
 * 3. Call sync methods when rolling actions/using resources
 */

// Example 1: Initialize Connection
async function initializeDiceCloudSync() {
  // Create DDP client
  const ddpClient = new MeteorDDPClient('wss://dicecloud.com/websocket');

  // Connect to DiceCloud
  try {
    await ddpClient.connect();
    console.log('Connected to DiceCloud Meteor server');

    // Get auth token from storage (from API login)
    const { diceCloudToken } = await browser.storage.local.get(['diceCloudToken']);

    if (diceCloudToken) {
      // Login with token
      await ddpClient.loginWithToken(diceCloudToken);
      console.log('Authenticated with DiceCloud');

      // Create sync manager
      const sync = new DiceCloudSync(ddpClient);

      // Initialize for current character
      const { characterId } = await browser.storage.local.get(['activeCharacterId']);
      await sync.initialize(characterId);

      return { ddpClient, sync };
    } else {
      throw new Error('No DiceCloud token found');
    }
  } catch (error) {
    console.error('Failed to initialize DiceCloud sync:', error);
    throw error;
  }
}

// Example 2: Sync Action Uses After Rolling
async function rollActionAndSync(action, sync) {
  // This would be in popup-sheet.js in the decrementActionUses function

  // Roll the action (existing code)
  if (action.uses && !decrementActionUses(action)) {
    return; // No uses remaining
  }

  // ... roll the action ...

  // NEW: Sync to DiceCloud if property has _id
  if (action._id && sync && sync.isEnabled()) {
    try {
      // Get current uses from local data
      const usesUsed = action.usesUsed || 0;

      // Update DiceCloud
      await sync.setActionUses(action._id, usesUsed);
      console.log(`Synced action uses to DiceCloud: ${action.name} (${usesUsed} used)`);
    } catch (error) {
      console.error('Failed to sync action uses:', error);
      // Don't fail the roll if sync fails - show warning instead
      showNotification('⚠️ Failed to sync to DiceCloud', 'warning');
    }
  }
}

// Example 3: Sync Resource Consumption
async function consumeResourceAndSync(resourceName, amount, propertyId, sync) {
  // This would be called from popup-sheet.js when using Ki Points, Sorcery Points, etc.

  // Update local data (existing code)
  const resource = characterData.resources.find(r => r.name === resourceName);
  if (!resource) return;

  resource.current -= amount;
  saveCharacterData();

  // NEW: Sync to DiceCloud
  if (propertyId && sync && sync.isEnabled()) {
    try {
      await sync.updateAttributeValue(propertyId, resource.current);
      console.log(`Synced ${resourceName} to DiceCloud: ${resource.current}/${resource.max}`);
    } catch (error) {
      console.error(`Failed to sync ${resourceName}:`, error);
      showNotification(`⚠️ Failed to sync ${resourceName}`, 'warning');
    }
  }
}

// Example 4: Sync HP Damage/Healing
async function updateHPAndSync(newHP, hpPropertyId, sync) {
  // This would be called when applying damage/healing

  // Update local data
  characterData.hp = newHP;
  saveCharacterData();

  // Sync to DiceCloud
  if (hpPropertyId && sync && sync.isEnabled()) {
    try {
      await sync.updateAttributeValue(hpPropertyId, newHP);
      console.log(`Synced HP to DiceCloud: ${newHP}/${characterData.maxHp}`);
    } catch (error) {
      console.error('Failed to sync HP:', error);
      showNotification('⚠️ Failed to sync HP', 'warning');
    }
  }
}

// Example 5: Sync Consumable Item Quantity
async function useConsumableAndSync(itemName, amount, itemPropertyId, sync) {
  // This would be called when using consumable items (potions, arrows, etc.)

  // Update local data
  const item = characterData.inventory.find(i => i.name === itemName);
  if (!item) return;

  item.quantity -= amount;
  saveCharacterData();

  // Sync to DiceCloud
  if (itemPropertyId && sync && sync.isEnabled()) {
    try {
      await sync.adjustQuantity(itemPropertyId, -amount);
      console.log(`Synced ${itemName} quantity to DiceCloud: ${item.quantity}`);
    } catch (error) {
      console.error(`Failed to sync ${itemName} quantity:`, error);
      showNotification(`⚠️ Failed to sync ${itemName}`, 'warning');
    }
  }
}

/**
 * Modified decrementActionUses function with sync
 */
function decrementActionUses(action, sync) {
  if (!action.uses) {
    return true; // No uses to track, allow action
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

  // NEW: Sync to DiceCloud
  if (action._id && sync && sync.isEnabled()) {
    sync.setActionUses(action._id, action.usesUsed)
      .then(() => {
        console.log(`Synced ${action.name} uses to DiceCloud`);
      })
      .catch(error => {
        console.error('Failed to sync action uses:', error);
        showNotification('⚠️ Sync failed - local changes saved', 'warning');
      });
  }

  return true;
}

/**
 * Background script integration
 * Add this to background.js to manage the DDP connection
 */
let ddpClient = null;
let dicecloudSync = null;

async function ensureDiceCloudConnection() {
  if (!ddpClient || !ddpClient.isConnected()) {
    const result = await initializeDiceCloudSync();
    ddpClient = result.ddpClient;
    dicecloudSync = result.sync;
  }
  return dicecloudSync;
}

// Listen for messages from popup requesting sync
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'syncTodicecoud') {
    ensureDiceCloudConnection()
      .then(sync => {
        // Handle the sync operation based on request.operation
        switch (request.operation) {
          case 'setActionUses':
            return sync.setActionUses(request.propertyId, request.value);
          case 'adjustQuantity':
            return sync.adjustQuantity(request.propertyId, request.amount);
          case 'updateAttribute':
            return sync.updateAttributeValue(request.propertyId, request.value);
          default:
            throw new Error('Unknown sync operation');
        }
      })
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  }
});

/**
 * Storage Scheme Update
 * We need to store DiceCloud property IDs with our character data
 */
const characterDataWithPropertyIds = {
  name: "Gandalf",
  _id: "characterId123",
  actions: [
    {
      name: "Fireball",
      _id: "propertyId456", // DiceCloud property _id
      uses: 3,
      usesUsed: 1,
      // ... other action data
    }
  ],
  resources: [
    {
      name: "Ki Points",
      _id: "propertyId789", // DiceCloud property _id
      current: 12,
      max: 15,
      // ... other resource data
    }
  ],
  // ... other character data
};
