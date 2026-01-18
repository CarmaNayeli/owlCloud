/**
 * Dice Cloud Content Script
 * Extracts character data from Dice Cloud character sheets
 */

(function() {
  'use strict';

  console.log('Dice Cloud to Roll20 Importer: Content script loaded');

  /**
   * Extracts character data from the current Dice Cloud page
   */
  function extractCharacterData() {
    const characterData = {
      name: '',
      race: '',
      class: '',
      level: 0,
      attributes: {},
      skills: {},
      features: [],
      spells: [],
      inventory: [],
      proficiencies: [],
      hitPoints: { current: 0, max: 0 },
      armorClass: 0,
      speed: 0,
      initiativeBonus: 0,
      proficiencyBonus: 0
    };

    try {
      // Extract basic character info
      const nameElement = document.querySelector('[data-id="name"]') ||
                         document.querySelector('.character-name') ||
                         document.querySelector('h1');
      if (nameElement) {
        characterData.name = nameElement.textContent.trim();
      }

      // Extract attributes (STR, DEX, CON, INT, WIS, CHA)
      const attributeElements = document.querySelectorAll('[data-id*="ability"]');
      attributeElements.forEach(element => {
        const attrName = element.getAttribute('data-id');
        const value = element.textContent.trim();
        if (attrName && value) {
          characterData.attributes[attrName] = parseInt(value) || 0;
        }
      });

      // Extract HP
      const hpElement = document.querySelector('[data-id="hitPoints"]');
      if (hpElement) {
        const hpText = hpElement.textContent.trim();
        const hpMatch = hpText.match(/(\d+)\s*\/\s*(\d+)/);
        if (hpMatch) {
          characterData.hitPoints.current = parseInt(hpMatch[1]) || 0;
          characterData.hitPoints.max = parseInt(hpMatch[2]) || 0;
        }
      }

      // Extract AC
      const acElement = document.querySelector('[data-id="armorClass"]');
      if (acElement) {
        characterData.armorClass = parseInt(acElement.textContent.trim()) || 10;
      }

      console.log('Extracted character data:', characterData);
      return characterData;
    } catch (error) {
      console.error('Error extracting character data:', error);
      return null;
    }
  }

  /**
   * Sends character data to the background script
   */
  function sendCharacterData() {
    const characterData = extractCharacterData();
    if (characterData && characterData.name) {
      chrome.runtime.sendMessage({
        action: 'storeCharacterData',
        data: characterData
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending character data:', chrome.runtime.lastError);
        } else {
          console.log('Character data stored successfully');
          showNotification('Character data extracted! Navigate to Roll20 to import.');
        }
      });
    } else {
      console.warn('No valid character data found on this page');
    }
  }

  /**
   * Shows a notification to the user
   */
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 16px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }

  /**
   * Adds an export button to the Dice Cloud UI
   */
  function addExportButton() {
    // Wait for page to fully load
    if (document.readyState !== 'complete') {
      window.addEventListener('load', addExportButton);
      return;
    }

    // Avoid adding duplicate buttons
    if (document.getElementById('dc-roll20-export-btn')) {
      return;
    }

    const button = document.createElement('button');
    button.id = 'dc-roll20-export-btn';
    button.textContent = 'Export to Roll20';
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
      z-index: 10000;
      transition: background 0.3s;
    `;
    button.addEventListener('mouseenter', () => {
      button.style.background = '#c0392b';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#e74c3c';
    });
    button.addEventListener('click', sendCharacterData);

    document.body.appendChild(button);
  }

  // Listen for messages from the popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractCharacter') {
      const data = extractCharacterData();
      sendResponse({ success: true, data });
    }
    return true;
  });

  // Initialize the export button when the page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addExportButton);
  } else {
    addExportButton();
  }
})();
