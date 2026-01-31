# Security Audit Report
**Date:** 2026-01-20
**Auditor:** Claude
**Scope:** Full codebase security analysis

## Executive Summary

The OwlCloud extension has **4 medium-to-high severity security vulnerabilities** that should be addressed before production deployment. While the extension operates within a trusted context (Roll20 ↔ Dice Cloud), proper security measures prevent potential attacks and protect users.

### Risk Level: 🟡 MEDIUM
- No critical vulnerabilities found
- Several medium-severity issues identified
- All issues are fixable with minimal code changes
- Extension operates in controlled environment (specific websites only)

---

## Findings

### 🔴 MEDIUM SEVERITY

#### 1. Unvalidated postMessage Origin

**Location:** Multiple files
- `src/popup-sheet.js:39` - Message listener without origin check
- `src/content/roll20.js:125` - Message listener without origin check
- `src/content/character-sheet-overlay.js:1738` - Message listener without origin check

**Issue:**
```javascript
window.addEventListener('message', (event) => {
  // No validation of event.origin!
  if (event.data.action === 'initCharacterSheet') {
    characterData = event.data.data;  // Accepts any origin
    buildSheet(characterData);
  }
});
```

**Risk:**
- Malicious websites could send forged messages
- Could inject fake character data
- Potential for data manipulation attacks

**Recommended Fix:**
```javascript
window.addEventListener('message', (event) => {
  // Validate origin
  const allowedOrigins = [
    'https://app.roll20.net',
    'https://dicecloud.com',
    'https://*.dicecloud.com'
  ];

  const isAllowed = allowedOrigins.some(origin => {
    if (origin.includes('*')) {
      const regex = new RegExp('^' + origin.replace('*', '[^/]+') + '$');
      return regex.test(event.origin);
    }
    return event.origin === origin;
  });

  if (!isAllowed) {
    debug.warn('❌ Rejected message from untrusted origin:', event.origin);
    return;
  }

  // Process message
  if (event.data.action === 'initCharacterSheet') {
    characterData = event.data.data;
    buildSheet(characterData);
  }
});
```

**Impact if exploited:** Medium
- Requires victim to visit malicious site while extension is active
- Limited to character data manipulation
- No credential theft possible

---

#### 2. Multiple eval() Calls with Formula Data

**Location:** `src/popup-sheet.js`
- Line 2964, 3106, 3243, 3331, 3341, 3485, 3541 (7 instances)

**Issue:**
```javascript
// Formula resolution uses eval()
if (/^[\d\s+\-*/().]+$/.test(evalExpression)) {
  const evalResult = eval(evalExpression);  // ⚠️ eval() usage
}
```

**Mitigation Already In Place:** ✅
- Input is validated with regex: `/^[\d\s+\-*/().]+$/`
- Only allows numbers and basic math operators
- No variables or function calls allowed
- Significantly reduces risk

**Risk:** Low-Medium
- Formula data comes from Dice Cloud character sheets (trusted)
- Regex validation prevents code injection
- But eval() should still be avoided when possible

**Recommended Fix:**
Use a safe math expression evaluator instead:

```javascript
// Option 1: Use Function() constructor (slightly safer)
function safeEval(expression) {
  if (!/^[\d\s+\-*/().]+$/.test(expression)) {
    throw new Error('Invalid expression');
  }
  return new Function('return ' + expression)();
}

// Option 2: Use a math expression parser library
// Consider: math.js, expr-eval, or mathjs
import { evaluate } from 'mathjs';
const result = evaluate(evalExpression);

// Option 3: Manual parser (most secure but more work)
function parseMathExpression(expr) {
  // Implement RPN or recursive descent parser
  // No eval() needed
}
```

**Impact if exploited:** Low
- Requires compromised Dice Cloud character data
- Regex validation prevents most attacks
- Limited to math operations

---

#### 3. innerHTML with User-Controlled Data

**Location:** Multiple files (56 instances)
- `src/popup-sheet.js` - Character names, descriptions, spell info

**Issue:**
```javascript
charNameEl.innerHTML = `
  <span>${data.name || 'Character'}</span>  // ⚠️ Unescaped
`;
```

**Risk:**
- If character name contains `<script>` tags, XSS is possible
- Dice Cloud data could contain malicious HTML
- Affects: names, descriptions, spell text, feature text

**Recommended Fix:**
Create an HTML escaping function:

```javascript
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Usage:
charNameEl.innerHTML = `
  <span>${escapeHTML(data.name) || 'Character'}</span>
`;

// Or better: Use textContent when possible
const nameSpan = document.createElement('span');
nameSpan.textContent = data.name || 'Character';
charNameEl.appendChild(nameSpan);
```

**Impact if exploited:** Medium
- Requires malicious character data in Dice Cloud
- Could execute JavaScript in extension context
- Limited to display areas

---

#### 4. Wildcard Target Origin in postMessage

**Location:** Multiple files
- `src/popup-sheet.js` - Multiple postMessage calls with `'*'`

**Issue:**
```javascript
window.opener.postMessage({ action: 'popupReady' }, '*');  // ⚠️ Wildcard
```

**Risk:**
- Any window can receive the message
- Information leakage to unexpected origins
- Not as severe as unvalidated reception, but still poor practice

**Recommended Fix:**
```javascript
// Specify explicit origin
const ROLL20_ORIGIN = 'https://app.roll20.net';
window.opener.postMessage({ action: 'popupReady' }, ROLL20_ORIGIN);

// Or for dynamic origins:
function getExpectedOrigin() {
  if (window.opener && window.opener.location) {
    return window.opener.location.origin;
  }
  return 'https://app.roll20.net'; // Default
}

window.opener.postMessage(messageData, getExpectedOrigin());
```

**Impact if exploited:** Low
- Information disclosure only
- No sensitive data in most messages
- Limited attack surface

---

### 🟢 LOW SEVERITY / INFORMATIONAL

#### 5. Credentials Stored in Browser Storage

**Location:** `src/background.js`
- Line 132: `diceCloudToken` stored in `browser.storage.local`

**Current Implementation:**
```javascript
await browserAPI.storage.local.set({
  diceCloudToken: data.token,
  username: username,
  tokenExpires: data.tokenExpires,
  userId: data.userId
});
```

**Assessment:** ✅ ACCEPTABLE
- `browser.storage.local` is encrypted by the browser
- Tokens are session tokens (expire)
- No plain-text passwords stored
- Standard practice for browser extensions

**Recommendation:** No change needed
This is the correct way to store API tokens in browser extensions.

---

#### 6. No Content Security Policy (CSP)

**Location:** `manifest.json`, `popup-sheet.html`

**Issue:**
No CSP headers defined in manifests or HTML files.

**Recommendation:**
Add CSP to manifest.json:

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

**Impact:** Low
- Defense-in-depth measure
- Helps prevent injection attacks
- Best practice for extensions

---

### ✅ GOOD PRACTICES FOUND

1. **No Passwords in Code** ✅
   - Passwords sent via API, not stored
   - Only tokens stored locally

2. **Limited Permissions** ✅
   - Only `storage` and `activeTab`
   - Specific host permissions only
   - No `<all_urls>` wildcard

3. **Credential Logging Avoided** ✅
   - Debug logs don't expose tokens or passwords
   - Proper redaction in logs

4. **HTTPS Only** ✅
   - All manifest permissions use HTTPS
   - No HTTP endpoints

5. **No Remote Code Execution** ✅
   - No externally loaded scripts
   - All code bundled with extension

---

## Priority Fixes

### MUST FIX (Before Production)

1. **Add origin validation to all message handlers**
   - Impact: Prevents message forgery
   - Effort: Low (1-2 hours)
   - Files: popup-sheet.js, roll20.js, character-sheet-overlay.js

2. **Escape HTML in innerHTML assignments**
   - Impact: Prevents XSS
   - Effort: Medium (2-4 hours)
   - Files: Mainly popup-sheet.js

### SHOULD FIX (Soon)

3. **Replace eval() with safe math parser**
   - Impact: Defense in depth
   - Effort: Medium (3-5 hours)
   - Files: popup-sheet.js (formula resolver)

4. **Specify explicit origins in postMessage**
   - Impact: Prevents info disclosure
   - Effort: Low (1 hour)
   - Files: popup-sheet.js

### NICE TO HAVE

5. **Add Content Security Policy**
   - Impact: Defense in depth
   - Effort: Low (30 minutes)
   - Files: manifest.json

---

## Testing Recommendations

After implementing fixes:

1. **XSS Testing**
   - Create character with name: `<script>alert('XSS')</script>`
   - Verify it doesn't execute
   - Test with various HTML tags

2. **Message Validation Testing**
   - Send forged messages from console
   - Verify they're rejected
   - Test legitimate messages still work

3. **Formula Injection Testing**
   - Test formula: `function(){alert(1)}()`
   - Verify regex blocks it
   - Test legitimate formulas still work

4. **Integration Testing**
   - Verify Roll20 ↔ Dice Cloud flow works
   - Test spell casting, rolls, announcements
   - Confirm no regressions

---

## Compliance Notes

### Extension Store Requirements

**Chrome Web Store:**
- ✅ Minimal permissions
- ✅ No remote code
- ⚠️ Should add CSP
- ⚠️ Should fix XSS issues

**Firefox Add-ons:**
- ✅ Proper manifest format
- ✅ No eval() in content scripts (only in popup)
- ⚠️ Should validate message origins

**Risk Assessment:**
- Current: Medium risk
- After fixes: Low risk
- Suitable for: Personal use, beta testing
- Not ready for: Public store distribution

---

## Conclusion

The OwlCloud extension has **no critical vulnerabilities** but has **4 medium-severity issues** that should be addressed before public release:

1. ✅ Add message origin validation (MUST FIX)
2. ✅ Escape HTML in user data (MUST FIX)
3. ⚠️ Replace eval() with safe parser (SHOULD FIX)
4. ⚠️ Use explicit postMessage origins (SHOULD FIX)

**Estimated fix time:** 4-8 hours total

**Current Status:** ✅ Safe for personal use
**Production Ready:** ⚠️ After fixes applied

The extension operates in a trusted context (Roll20 + Dice Cloud), which significantly reduces risk. However, implementing these fixes follows security best practices and protects users from potential future threats.

---

**Audited by:** Claude (2026-01-20)
**Branch:** claude/fix-chrome-rolls-qKHzO
