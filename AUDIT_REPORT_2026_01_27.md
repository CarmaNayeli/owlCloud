# RollCloud Application Audit Report
**Date:** January 27, 2026
**Auditor:** Claude (Sonnet 4.5)
**Version Audited:** 1.2.4
**Branch:** claude/audit-app-state-Wh1s4

---

## Executive Summary

RollCloud is a comprehensive browser extension that integrates DiceCloud V2 with Roll20 and Discord. The application consists of multiple components including Chrome/Firefox extensions, a Discord bot (Pip2), a Next.js dashboard, and an Electron-based installer. This audit reviews the overall application state, architecture, security posture, and code quality.

**Overall Assessment:** ✅ **HEALTHY**
- No critical security vulnerabilities detected
- Well-structured codebase with proper separation of concerns
- Good security practices (XSS prevention, origin validation, RLS on database)
- No npm dependency vulnerabilities
- Comprehensive build system with multi-platform support

---

## 1. Project Structure & Architecture

### 1.1 Core Components

**Browser Extension** (~20,883 lines of JavaScript)
- **Manifest V3** (Chrome) - `/manifest.json`
- **Manifest V2** (Firefox) - `/manifest_firefox.json`
- **Source Code** - `/src/` directory
  - Background service worker
  - Content scripts (DiceCloud, Roll20)
  - Popup UI
  - Character sheet overlay
  - Authentication modules

**Pip2 Discord Bot** - `/Pip2/`
- Node.js Discord bot (Discord.js v14)
- Supabase integration for character data
- Command-based architecture
- Real-time combat notifications

**Dashboard** - `/Pip2/dashboard/`
- Next.js 16 with React 19
- TypeScript
- Supabase client integration
- NextAuth for authentication
- Tailwind CSS styling

**Installer** - `/installer/`
- Electron-based Windows/Mac/Linux installer
- Includes signed extensions
- Admin privilege elevation for policy installation
- Version 1.2.4

### 1.2 Directory Structure

```
rollCloud/
├── src/                        # Browser extension source
│   ├── background.js          # Service worker
│   ├── content/               # Content scripts
│   ├── popup/                 # Extension popup
│   ├── lib/                   # Libraries (Supabase, Meteor DDP)
│   ├── modules/               # Feature modules (edge cases)
│   └── common/                # Shared utilities
├── Pip2/                      # Discord bot & dashboard
│   ├── src/                   # Bot source code
│   └── dashboard/             # Next.js web dashboard
├── scripts/                   # Build automation
├── installer/                 # Electron installer
├── supabase/                  # Database migrations & schema
├── experimental/              # Two-way sync (experimental)
├── tests/                     # Test HTML files
├── releases/                  # Build artifacts
└── diceCloudReferences/       # Reference implementations
```

---

## 2. Dependencies & Build System

### 2.1 Root Dependencies

**Production Dependencies:**
- `crx3`: ^2.0.0 (Chrome extension signing)
- `extract-zip`: ^2.0.1 (Archive extraction)

**Development Dependencies:**
- `archiver`: ^7.0.1 (ZIP creation)

**NPM Audit:** ✅ **0 vulnerabilities** (102 total dependencies)

### 2.2 Pip2 Bot Dependencies

**Production:**
- `discord.js`: ^14.14.1
- `dotenv`: ^16.3.1

**Dev:**
- `eslint`: ^8.56.0

**Node Version:** >= 18.0.0

### 2.3 Dashboard Dependencies

**Framework:**
- `next`: ^16.1.4
- `react`: ^19.2.3 (latest)
- `react-dom`: ^19.2.3

**Services:**
- `@supabase/supabase-js`: ^2.91.1
- `next-auth`: ^4.24.13

**Dev Tools:**
- TypeScript 5.3.0
- Tailwind CSS 3.4.0

### 2.4 Build System

**Main Build Commands:**
- `npm run build` - Full build (extensions + installer)
- `npm run build:quick` - Extensions only (skip installer)
- `npm run build:extension` - Clean extension build
- `npm run build:signed` - Create signed CRX/XPI
- `npm run build:installer` - Build Electron installer
- `npm run build:enterprise` - Enterprise deployment package

**Build Pipeline:**
1. Clean extension build (Chrome/Firefox/Safari)
2. Package extensions as ZIP files
3. Sign extensions (CRX3 for Chrome, XPI for Firefox)
4. Build Electron installer (Windows/Mac/Linux)
5. Copy artifacts to `/releases/`

**Output Artifacts:**
- `rollcloud-chrome.zip` - Unpacked Chrome extension
- `rollcloud-firefox.zip` - Unpacked Firefox extension
- `rollcloud-chrome-signed.crx` - Signed Chrome extension
- `rollcloud-firefox-signed.xpi` - Signed Firefox extension
- `RollCloud-Setup.exe` - Windows installer
- `RollCloud-Setup.dmg` - macOS installer
- `RollCloud-Setup.AppImage` - Linux installer

---

## 3. Security Audit

### 3.1 Authentication & Authorization

**DiceCloud Authentication:**
- ✅ Token-based authentication via DiceCloud REST API
- ✅ Tokens stored in browser local storage (encrypted by browser)
- ✅ Token expiry validation on startup
- ✅ Logout clears all authentication state
- ✅ No password storage (only API tokens)

**Supabase Integration:**
- ✅ Row-Level Security (RLS) enabled on `rollcloud_characters` table
- ✅ Anon key used (public key, not service key)
- ✅ Users can only access their own characters
- ⚠️ **FINDING:** Supabase anon key is hardcoded in `/src/lib/supabase-client.js:8`
  - **Impact:** Low - This is the public anon key, intended for client-side use
  - **Recommendation:** Consider environment-based configuration for easier key rotation

**Browser Fingerprinting:**
- User ID generation based on browser fingerprint (user agent, language, screen, timezone)
- Session ID includes additional entropy for uniqueness
- Simple hash function used (collision risk exists but low impact)

### 3.2 Cross-Site Scripting (XSS) Prevention

**HTML Utilities** (`/src/common/html-utils.js`):
- ✅ `escapeHTML()` function properly escapes special characters
- ✅ Uses `textContent` to prevent XSS before returning `innerHTML`
- ✅ Origin validation for postMessage communications
- ✅ Whitelist of allowed origins (Roll20, DiceCloud)
- ✅ Safe wrapper for postMessage with explicit origin

**Content Security Policy:**
- Chrome Manifest V3: Implicit CSP restrictions
- Firefox Manifest V2: Default CSP applied

**innerHTML Usage:**
- ✅ Reviewed all 7 files using `innerHTML`
- ✅ All usages appear safe (mostly reading DOM, not writing unsanitized data)
- ✅ Card creator and overlay use safe HTML generation

### 3.3 Permissions & Host Access

**Chrome Manifest (V3):**
```json
"permissions": ["storage", "activeTab", "nativeMessaging"]
"host_permissions": [
  "https://dicecloud.com/*",
  "https://*.dicecloud.com/*",
  "https://app.roll20.net/*",
  "https://roll20.net/*",
  "https://gkfpxwvmumaylahtxqrk.supabase.co/*"
]
```

**Firefox Manifest (V2):**
- Same permissions as Chrome
- Persistent background script set to `false` (event-driven)
- Includes `supabase-client.js` in background scripts

**Assessment:**
- ✅ Minimal permissions requested
- ✅ Host permissions limited to necessary domains
- ✅ No broad permissions like `<all_urls>` in main permissions
- ⚠️ Supabase URL is hardcoded in host permissions (expected for this architecture)

### 3.4 Secrets Management

**Environment Variables:**
- ✅ No `.env` files committed to repo (only `.env.example` files)
- ✅ No hardcoded Discord tokens or service keys in source
- ✅ Proper `.env.example` templates provided

**API Keys:**
- ⚠️ **FINDING:** Supabase anon key visible in source code
  - **Location:** `/src/lib/supabase-client.js:8`
  - **Status:** Expected for public client-side use
  - **Security:** Protected by RLS policies
  - **Recommendation:** Document this is intentional

### 3.5 Extension Key Management

**Chrome Extension Key:**
- ✅ Public key stored in manifest for consistent extension ID
- ✅ Private key stored in `/keys/private.pem` (gitignored)
- ✅ Build script auto-generates keys if missing
- ✅ OpenSSL used for key generation

---

## 4. Code Quality Assessment

### 4.1 Code Organization

**Strengths:**
- ✅ Clear separation of concerns (background, content, popup, lib, modules)
- ✅ Modular architecture with reusable components
- ✅ Consistent naming conventions
- ✅ Edge case handlers organized by type (spells, class features, racial features)
- ✅ Browser polyfill for cross-browser compatibility

**Areas for Improvement:**
- ⚠️ Large JavaScript files (some content scripts > 1000 lines)
- ⚠️ Limited TypeScript usage (only in dashboard)
- ⚠️ No formal testing framework (only test HTML files)

### 4.2 Debug & Logging

**Debug Utility** (`/src/common/debug.js`):
- Centralized debug logging
- Color-coded console messages
- Can be toggled on/off
- Used consistently throughout codebase

### 4.3 Service Worker Lifecycle

**Chrome Service Worker:**
- ✅ Keep-alive mechanism for critical operations
- ✅ Suspend/resume event listeners
- ✅ Storage state validation on startup
- ✅ Token expiry check on service worker restart
- ✅ Explicit logout flag to prevent auto-relogin

### 4.4 Error Handling

**General Pattern:**
- Try-catch blocks in async operations
- Debug logging for errors
- User-facing error messages in UI
- Fallback behavior where appropriate

**Areas for Improvement:**
- ⚠️ Some error states not fully handled
- ⚠️ Limited error reporting/telemetry

---

## 5. Database Schema Review

### 5.1 Supabase Tables

**`auth_tokens` Table:**
- Stores DiceCloud auth tokens for persistence
- User fingerprint-based identification
- Session tracking
- Token expiry management
- Row-level security enabled

**`rollcloud_characters` Table:**
- Comprehensive D&D character data storage
- JSONB fields for flexible data (hit points, spell slots, resources)
- Discord integration via user ID linking
- Pairing system for bot commands
- Indexes on key lookup fields

**`rollcloud_pairings` Table:**
- Links extension sessions to Discord channels
- Connection code system
- Timestamp tracking

**`rollcloud_commands` Table:**
- Discord command queue
- Real-time subscriptions
- Command status tracking

### 5.2 Security Features

- ✅ Row-Level Security (RLS) enabled
- ✅ Users can only view/modify own data
- ✅ Proper indexing for performance
- ✅ Timestamps for auditing
- ✅ Foreign key constraints

---

## 6. Experimental Features

### 6.1 Two-Way Sync

**Location:** `/experimental/two-way-sync/`

**Status:** ⚠️ **EXPERIMENTAL - NOT PRODUCTION READY**

**Implementation:**
- Meteor DDP client for DiceCloud communication
- WebSocket-based real-time sync
- Property cache system for HP tracking
- Build support (`npm run build:exp`)

**Limitations:**
- Not integrated into main extension code
- Manual testing required
- Limited to HP sync
- No UI controls to enable/disable
- Requires manual file copying

**Recommendation:**
- Keep experimental status clearly documented
- Consider feature flag system for gradual rollout
- Add comprehensive testing before production release

---

## 7. Installer & Distribution

### 7.1 Electron Installer

**Features:**
- Multi-platform support (Windows, Mac, Linux)
- Admin privilege elevation
- Bundles signed extensions
- Firefox Developer Edition installer included
- NSIS installer for Windows

**Security:**
- ✅ Requires administrator for policy installation
- ✅ Signed extensions bundled
- ✅ No telemetry or auto-update mechanism
- ⚠️ Bundles third-party installer (Firefox Dev Edition)

### 7.2 Distribution Channels

**GitHub Releases:**
- Extension ZIP files for manual installation
- Signed CRX/XPI for policy deployment
- Installers for all platforms
- Clear installation instructions

**Web Dashboard:**
- Hosted on Vercel: `rollcloud.vercel.app`
- Discord integration management
- Real-time status monitoring

---

## 8. Discord Integration (Pip2)

### 8.1 Bot Architecture

**Command System:**
- Slash commands (`/rollcloud`, `/character`, `/roll20`, etc.)
- Event-driven architecture
- Supabase integration for data persistence
- Real-time combat notifications

**Security:**
- ✅ Discord token stored in environment variables
- ✅ Server-side validation
- ✅ Supabase service key (not exposed to client)
- ✅ Permission checks

### 8.2 Pairing System

**Flow:**
1. Extension generates 6-character code
2. User enters code in Discord
3. Bot validates and links session to channel
4. Real-time updates enabled

**Security:**
- ✅ Time-limited codes
- ✅ One-time use
- ✅ Server-side validation

---

## 9. Known Issues & Technical Debt

### 9.1 Architecture

1. **No Build Output in Repo**
   - `/dist/` directory doesn't exist
   - `/releases/` directory is empty (only `.gitkeep`)
   - **Impact:** Need to build before testing
   - **Recommendation:** Document build-first workflow

2. **Hardcoded Supabase URL**
   - URL in manifest host_permissions
   - URL in supabase-client.js
   - **Impact:** Difficult to change backend
   - **Recommendation:** Environment-based configuration

3. **Large JavaScript Files**
   - Some files exceed 1000 lines
   - **Impact:** Maintainability
   - **Recommendation:** Refactor into smaller modules

### 9.2 Testing

1. **No Automated Tests**
   - Only manual test HTML files
   - No unit tests, integration tests, or E2E tests
   - **Impact:** Regression risk
   - **Recommendation:** Implement Jest/Vitest + Playwright

2. **No CI/CD Pipeline**
   - Manual build process
   - No automated checks
   - **Recommendation:** GitHub Actions workflow

### 9.3 Documentation

1. **Good User Documentation**
   - Comprehensive README
   - Installation guides
   - Troubleshooting sections

2. **Limited Developer Documentation**
   - No API documentation
   - Limited inline comments
   - No contribution guidelines
   - **Recommendation:** Add CONTRIBUTING.md, API docs

---

## 10. Compliance & Best Practices

### 10.1 Browser Extension Guidelines

**Chrome Web Store:**
- ✅ Manifest V3 compliance
- ✅ Minimal permissions
- ✅ Clear privacy policy needed (not found in repo)
- ⚠️ **ACTION REQUIRED:** Add PRIVACY.md

**Firefox Add-ons:**
- ✅ Manifest V2 compliance (V3 migration optional)
- ✅ No eval() or remote code execution
- ✅ Content Security Policy compliant

### 10.2 License & Attribution

- ✅ MIT License specified in package.json
- ⚠️ No LICENSE file in root directory
- **Recommendation:** Add LICENSE file

### 10.3 Data Privacy

**User Data Collected:**
- DiceCloud authentication tokens
- Character sheet data
- Discord user IDs (when linked)
- Browser fingerprint for session management

**Storage Locations:**
- Browser local storage (tokens, character data)
- Supabase database (character data, pairings)

**GDPR Considerations:**
- ⚠️ No data deletion mechanism documented
- ⚠️ No privacy policy
- **Recommendation:** Add data export/deletion features

---

## 11. Performance Considerations

### 11.1 Extension Performance

**Service Worker:**
- ✅ Keep-alive mechanism prevents premature termination
- ✅ Event-driven architecture (non-persistent in Firefox)
- ✅ Minimal background processing

**Content Scripts:**
- ✅ Load on `document_idle` (non-blocking)
- ⚠️ Large scripts injected into Roll20 page
- **Recommendation:** Code splitting or lazy loading

### 11.2 Database Performance

**Indexes:**
- ✅ Indexes on user_id, character_id, discord_user_id
- ✅ UUID primary keys
- ✅ JSONB for flexible data storage

**Optimization Opportunities:**
- Consider materialized views for complex queries
- Monitor query performance in production

---

## 12. Recommendations

### 12.1 Critical (Security/Privacy)

1. ✅ **Add PRIVACY.md** - Document data collection and usage
2. ✅ **Add LICENSE file** - Make MIT license explicit
3. ⚠️ **Implement data deletion** - GDPR compliance
4. ⚠️ **Add rate limiting** - Prevent API abuse on Discord bot

### 12.2 High Priority (Quality/Stability)

1. ⚠️ **Add automated testing** - Unit + integration tests
2. ⚠️ **Set up CI/CD** - GitHub Actions for build/test
3. ⚠️ **TypeScript migration** - Gradual migration from JS
4. ⚠️ **Error telemetry** - Track production errors (privacy-friendly)

### 12.3 Medium Priority (Developer Experience)

1. ⚠️ **API documentation** - JSDoc or TypeDoc
2. ⚠️ **Contributing guide** - CONTRIBUTING.md
3. ⚠️ **Code splitting** - Reduce content script size
4. ⚠️ **Environment config** - .env support for local development

### 12.4 Low Priority (Enhancements)

1. ⚠️ **Experimental feature integration** - Two-way sync completion
2. ⚠️ **Safari extension** - Complete Safari support
3. ⚠️ **Internationalization** - Multi-language support
4. ⚠️ **Telemetry opt-in** - Usage analytics (with consent)

---

## 13. Conclusion

RollCloud is a well-architected browser extension with solid security practices and good code organization. The project demonstrates:

**Strengths:**
- Clean separation of concerns
- Proper XSS prevention
- Row-level security on database
- No dependency vulnerabilities
- Comprehensive build system
- Multi-platform support

**Areas for Improvement:**
- Add automated testing
- Implement CI/CD pipeline
- Add privacy policy and license file
- Consider TypeScript migration
- Improve documentation for contributors

**Security Posture:** ✅ **GOOD**
- No critical vulnerabilities found
- Proper authentication handling
- Safe HTML practices
- Origin validation for cross-window communication

**Code Quality:** ✅ **GOOD**
- Well-organized codebase
- Consistent patterns
- Good debug logging
- Could benefit from automated testing

**Overall Rating:** ✅ **4/5** - Production-ready with recommended improvements

---

## Appendix A: File Counts

- **JavaScript Files:** ~23 files in `/src/`
- **Total Lines of Code:** ~20,883 lines
- **Dependencies:** 102 total (0 vulnerabilities)
- **Build Scripts:** 14 build-related scripts
- **Database Migrations:** 19 SQL files

## Appendix B: Key Files Reviewed

- `/manifest.json` - Chrome Manifest V3
- `/manifest_firefox.json` - Firefox Manifest V2
- `/package.json` - Root dependencies
- `/src/background.js` - Service worker
- `/src/lib/supabase-client.js` - Authentication
- `/src/common/html-utils.js` - XSS prevention
- `/scripts/build-all.js` - Build system
- `/supabase/rollcloud_characters_schema.sql` - Database schema
- `/Pip2/src/index.js` - Discord bot
- `/Pip2/dashboard/package.json` - Web dashboard

---

**Audit Completed:** January 27, 2026
**Next Review Recommended:** Before major release (v2.0.0)
