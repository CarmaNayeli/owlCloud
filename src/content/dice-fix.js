/**
 * Dice Cloud Dice Fix
 * Fixes green blob dice by adding proper dice rendering
 */

(function() {
  'use strict';

  console.log('🎲 Dice Cloud Dice Fix loaded');

  // Add dice fix styles
  const diceFixStyle = document.createElement('style');
  diceFixStyle.textContent = `
    /* Dice Cloud Dice Fix */
    .dice-container,
    .dice-icon,
    .dice-face,
    [class*="dice"],
    [class*="die"] {
      font-family: 'Font Awesome 6 Free', 'Font Awesome 5 Free', 'FontAwesome', 'Arial Unicode MS', sans-serif !important;
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
    }

    /* Specific dice face fixes */
    .dice-face-1::before { content: "⚀" !important; }
    .dice-face-2::before { content: "⚁" !important; }
    .dice-face-3::before { content: "⚂" !important; }
    .dice-face-4::before { content: "⚃" !important; }
    .dice-face-5::before { content: "⚄" !important; }
    .dice-face-6::before { content: "⚅" !important; }

    /* Alternative dice symbols */
    .dice-1::before { content: "⚀" !important; }
    .dice-2::before { content: "⚁" !important; }
    .dice-3::before { content: "⚂" !important; }
    .dice-4::before { content: "⚃" !important; }
    .dice-5::before { content: "⚄" !important; }
    .dice-6::before { content: "⚅" !important; }

    /* Font Awesome dice icons */
    .fa-dice-one::before { content: "⚀" !important; }
    .fa-dice-two::before { content: "⚁" !important; }
    .fa-dice-three::before { content: "⚂" !important; }
    .fa-dice-four::before { content: "⚃" !important; }
    .fa-dice-five::before { content: "⚄" !important; }
    .fa-dice-six::before { content: "⚅" !important; }

    /* Generic dice elements */
    .die, .dice {
      display: inline-block !important;
      font-size: 24px !important;
      line-height: 1 !important;
      text-align: center !important;
      min-width: 30px !important;
      height: 30px !important;
      background: white !important;
      border: 2px solid #333 !important;
      border-radius: 6px !important;
      margin: 2px !important;
      position: relative !important;
    }

    /* Remove green blob backgrounds */
    .dice-container *,
    .dice-icon *,
    [class*="dice"] *,
    [class*="die"] * {
      background: none !important;
      background-color: transparent !important;
      background-image: none !important;
    }

    /* Ensure dice are visible */
    .dice-container,
    .dice-icon,
    [class*="dice"],
    [class*="die"] {
      color: #333 !important;
      opacity: 1 !important;
      visibility: visible !important;
      display: inline-block !important;
    }

    /* Fix any hidden dice */
    .dice-container.hidden,
    .dice-icon.hidden,
    [class*="dice"].hidden,
    [class*="die"].hidden {
      display: inline-block !important;
      opacity: 1 !important;
      visibility: visible !important;
    }

    /* Override any green backgrounds */
    [style*="background: green"],
    [style*="background-color: green"],
    [style*="background: #00ff00"],
    [style*="background-color: #00ff00"] {
      background: white !important;
      background-color: white !important;
    }

    /* Custom dice rendering for any element with dice content */
    .dice-content {
      font-family: 'Arial Unicode MS', 'Segoe UI Symbol', sans-serif !important;
      font-size: 20px !important;
      color: #333 !important;
    }

    /* Roll20 specific dice fixes */
    .roll20-dice,
    .r20-dice {
      font-family: 'Arial Unicode MS', 'Segoe UI Symbol', sans-serif !important;
    }

    /* Debug: Make all dice visible with red border */
    .dice-container,
    .dice-icon,
    [class*="dice"],
    [class*="die"] {
      border: 2px solid red !important;
      background: yellow !important;
    }
  `;

  document.head.appendChild(diceFixStyle);

  // Add Font Awesome fallback
  const fontAwesomeLink = document.createElement('link');
  fontAwesomeLink.rel = 'stylesheet';
  fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
  document.head.appendChild(fontAwesomeLink);

  // Debounce variable to prevent recursive calls
  let isFixing = false;
  let lastFixTime = 0;
  let observer = null; // Will be initialized later

  // Function to fix dice elements
  function fixDiceElements() {
    // Prevent recursive calls
    if (isFixing) return;

    // Throttle to prevent excessive calls
    const now = Date.now();
    if (now - lastFixTime < 500) return;
    lastFixTime = now;

    isFixing = true;
    console.log('🔧 Fixing dice elements...');

    try {
      // Disconnect observer to prevent triggering mutations while we make changes
      if (observer) {
        observer.disconnect();
      }

      // Find all potential dice elements
      const diceElements = document.querySelectorAll([
        '.dice-container',
        '.dice-icon',
        '[class*="dice"]',
        '[class*="die"]',
        '.fa-dice',
        '.roll-result',
        '.dice-result'
      ].join(', '));

      console.log(`Found ${diceElements.length} potential dice elements`);

      diceElements.forEach((element, index) => {
        // Skip if already fixed
        if (element.dataset.diceFixed === 'true') {
          return;
        }

        // Add debug border to see what we're targeting
        element.style.border = '2px solid blue';
        element.style.background = 'lightblue';

        // Try to extract the dice value
        const text = element.textContent || element.innerText || '';
        const value = parseInt(text);

        if (!isNaN(value) && value >= 1 && value <= 6) {
          console.log(`Fixing dice ${index}: value = ${value}`);

          // Replace with proper dice symbol
          const diceSymbols = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
          element.textContent = diceSymbols[value - 1];
          element.style.fontSize = '24px';
          element.style.fontFamily = 'Arial Unicode MS, Segoe UI Symbol';
          element.style.color = '#333';
          element.style.background = 'white';
          element.style.border = '2px solid #333';
          element.style.borderRadius = '6px';
          element.style.padding = '5px';
          element.style.display = 'inline-block';
          element.style.textAlign = 'center';
          element.style.minWidth = '30px';
          element.style.height = '30px';
          element.style.lineHeight = '30px';

          // Mark as fixed to prevent re-processing
          element.dataset.diceFixed = 'true';
        }
      });

      // Reconnect observer after changes are done
      if (observer) {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    } finally {
      isFixing = false;
    }
  }

  // Run fix immediately
  fixDiceElements();

  // Run fix periodically for dynamic content (but less frequently)
  setInterval(() => {
    if (!isFixing) {
      fixDiceElements();
    }
  }, 5000); // Increased from 2000ms to 5000ms

  // Run fix when DOM changes (with debouncing)
  let observerTimeout;
  observer = new MutationObserver((mutations) => {
    clearTimeout(observerTimeout);
    observerTimeout = setTimeout(() => {
      if (!isFixing) {
        fixDiceElements();
      }
    }, 1000); // Increased debounce time from 100ms to 1000ms
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('✅ Dice Cloud Dice Fix initialized');

})();
