/**
 * Minimal Background Script for Testing
 */

console.log('🚀 Minimal background script starting');

// Test basic Chrome APIs
console.log('Chrome available:', typeof chrome !== 'undefined');
console.log('Chrome runtime available:', !!(typeof chrome !== 'undefined' && chrome.runtime));

// Basic service worker setup
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onInstalled.addListener((details) => {
    console.log('📦 Extension installed:', details.reason);
  });
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Message received:', request);
    sendResponse({ success: true, message: 'Background working!' });
  });
}

// Keep alive
setInterval(() => {
  console.log('💓 Minimal heartbeat');
}, 20000);

console.log('✅ Minimal background script loaded');
