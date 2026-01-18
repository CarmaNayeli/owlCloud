# DiceCloud Roll Detection Debugging Guide

This guide explains how to inspect DiceCloud's roll log HTML structure and update the selectors for proper roll detection.

## Quick Start

1. **Load the extension** in Chrome (Developer Mode)
2. **Navigate to a DiceCloud character sheet** (e.g., `https://dicecloud.com/character/YOUR_CHARACTER_ID`)
3. **Open the browser console** (Press `F12` or `Ctrl+Shift+J` / `Cmd+Option+J`)

## Method 1: Using the Debug Button (Easiest)

### Step 1: Click the Debug Button
Look for the blue **"🔍 Debug Rolls"** button in the bottom-right corner of the DiceCloud page and click it.

This will log detailed information about:
- All potential roll log containers found
- Elements containing dice notation (1d20, 2d6, etc.)
- Element classes, IDs, and structure

### Step 2: Make a Test Roll
1. Roll any ability check, attack, or dice in DiceCloud
2. Click the **"🔍 Debug Rolls"** button again
3. Compare the before/after output to see what new elements appeared

### Step 3: Inspect the Console Output
Look for sections like:
```
Found X element(s) matching "[class*="roll"]":
  [0] Classes: roll-item active
  [0] ID: roll-12345
  [0] Tag: DIV
  [0] Text preview: Strength Check 1d20+5 = 18
```

## Method 2: Using Browser DevTools (More Detailed)

### Step 1: Open DevTools
1. Press `F12` to open Chrome DevTools
2. Go to the **Elements** tab

### Step 2: Make a Test Roll
1. Roll something in DiceCloud (ability check, attack, etc.)
2. You should see the roll result appear somewhere on the page

### Step 3: Inspect the Roll Element
1. **Right-click** on the roll result in the page
2. Select **"Inspect"** or **"Inspect Element"**
3. DevTools will highlight the exact HTML element

### Step 4: Identify Patterns
Look for:
- **Container classes**: Is the roll inside a `.roll-log`, `.dice-stream`, or `.sidebar`?
- **Roll element classes**: Does each roll have `.roll-item`, `.dice-roll`, or similar?
- **Structure**: What's the parent/child relationship?

Example HTML you might find:
```html
<div class="dice-stream">
  <div class="roll-item" data-roll-id="12345">
    <span class="roll-name">Strength Check</span>
    <span class="roll-formula">1d20+5</span>
    <span class="roll-result">18</span>
  </div>
</div>
```

## Method 3: Using the Console Function

You can also run the debug function directly in the console:

```javascript
// Run the debug analysis
window.debugDiceCloudRolls()

// Or access it via the extension namespace
debugDiceCloudRolls()
```

## What to Look For

### 1. Roll Log Container
The parent element that contains all rolls. Common patterns:
- Class names containing: `roll`, `dice`, `log`, `stream`, `sidebar`, `right`
- Semantic HTML: `<aside>`, `<section role="complementary">`

### 2. Individual Roll Elements
Each roll should be a separate element. Look for:
- A wrapper div for each roll
- Distinct class names like `.roll-item`, `.dice-roll`, `.roll-entry`
- Data attributes like `data-roll-id` or `data-timestamp`

### 3. Roll Data Structure
Within each roll element, identify:
- **Roll name/label**: "Strength Check", "Longsword Attack", etc.
- **Dice formula**: "1d20+5", "2d6+3", etc.
- **Result value**: The numeric result
- **Additional info**: Critical hits, advantage/disadvantage, etc.

## Updating the Code

Once you've identified the correct selectors, update these sections in `src/content/dicecloud.js`:

### Update Roll Log Selectors
In the `observeRollLog()` function, update the `selectors` array:

```javascript
const selectors = [
  '.your-roll-log-class',    // Replace with actual class
  '#roll-sidebar',           // Add ID if it has one
  '[role="log"]',           // Add any other patterns
];
```

### Update Roll Parsing Logic
In the `parseRollFromElement()` function, update the parsing logic:

```javascript
function parseRollFromElement(element) {
  // Example: If rolls look like this:
  // <div class="roll-item">
  //   <span class="roll-label">Attack</span>
  //   <span class="roll-dice">1d20+5</span>
  //   <span class="roll-total">18</span>
  // </div>

  const nameElement = element.querySelector('.roll-label');
  const formulaElement = element.querySelector('.roll-dice');
  const resultElement = element.querySelector('.roll-total');

  if (nameElement && formulaElement) {
    return {
      name: nameElement.textContent.trim(),
      formula: formulaElement.textContent.trim(),
      result: resultElement?.textContent.trim() || '',
      timestamp: Date.now()
    };
  }

  return null;
}
```

## Testing Your Changes

1. Make your code changes
2. Reload the extension in Chrome:
   - Go to `chrome://extensions`
   - Click the reload icon on your extension
3. Refresh the DiceCloud page
4. Check the console for log messages:
   - "✓ Observing DiceCloud roll log for new rolls" = Success!
   - "Roll log not found, will retry..." = Need to update selectors
5. Make a test roll
6. Check if it appears in the console:
   - "✓ Detected roll: {...}" = Success!
   - "✗ Could not parse roll from element" = Need to update parsing logic

## Console Monitoring

Keep the console open while testing. You'll see real-time feedback:

```
Roll log detection: Found potential roll log using selector: .dice-stream
✓ Observing DiceCloud roll log for new rolls
Roll log element classes: dice-stream sidebar-right
TIP: Make a test roll to see if it gets detected
New element added to roll log: <div class="roll-item">...</div>
Element classes: roll-item
Element text: Strength Check 1d20+5 = 18
✓ Detected roll: {name: "Strength", formula: "1d20+5", result: "18"}
```

## Common Issues

### "Roll log not found"
- The selectors don't match DiceCloud's actual HTML
- Run `window.debugDiceCloudRolls()` to find the correct selectors
- Check if the roll log loads dynamically (may need to wait longer)

### "Could not parse roll from element"
- The parsing regex doesn't match DiceCloud's format
- Inspect the actual text content of roll elements
- Update the regex pattern in `parseRollFromElement()`

### Rolls not detected at all
- The MutationObserver might be watching the wrong element
- Check if rolls are added as children or siblings
- Verify the observer configuration (childList, subtree)

## Need Help?

If you're stuck, gather this information:
1. Screenshot of the DiceCloud roll log
2. HTML structure from browser inspector
3. Console output from `window.debugDiceCloudRolls()`
4. Example of a roll's HTML (right-click → Copy → Copy element)

Then update the parsing logic based on what you find!
