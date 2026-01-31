# Privacy Policy for OwlCloud

**Last Updated:** January 27, 2026
**Effective Date:** January 27, 2026

## Introduction

OwlCloud is a browser extension that integrates DiceCloud V2 character sheets with Roll20 and Discord. This privacy policy explains what data we collect, how we use it, and your rights regarding your data.

## Data We Collect

### 1. Authentication Data

**DiceCloud Tokens:**
- When you log in to DiceCloud through OwlCloud, we store your authentication token
- Stored locally in your browser's storage
- Used to authenticate API requests to DiceCloud on your behalf
- Token expiry dates are stored to validate session validity

**Browser Fingerprint:**
- Generated from: user agent, language, screen resolution, timezone offset
- Used to create a consistent user identifier across browser sessions
- Hashed to create a unique user ID (not reversible to original data)
- Used only for token persistence, not for tracking

### 2. Character Sheet Data

**Local Storage:**
- Character names, stats, abilities, spells, items
- HP, spell slots, and other resource tracking
- Cached locally in browser storage for offline access

**Supabase Database (Optional):**
- Character data synced to Supabase only if you use Discord integration
- Includes: character name, level, class, HP, spell slots, ability scores
- Associated with your Discord user ID when paired
- Protected by Row-Level Security (you can only access your own data)

### 3. Discord Integration Data (Optional)

**When Using Pip2 Discord Bot:**
- Discord user ID (to link your characters)
- Discord channel ID (for pairing and notifications)
- Pairing codes (temporary, 6-character codes for linking)
- Character-to-channel mappings

**Discord Commands:**
- Command history (which commands you used)
- Command timestamps
- Associated character data

### 4. Technical Data

**Extension Usage:**
- No usage analytics or telemetry collected
- Debug logs stay local (only visible in your browser console)
- No crash reports sent automatically

## How We Use Your Data

### 1. Core Functionality
- Authenticate with DiceCloud API
- Sync character data between DiceCloud and Roll20
- Display character information in browser extension
- Execute dice rolls and update character resources

### 2. Discord Integration
- Link characters to Discord channels
- Send dice roll results to Discord
- Provide real-time combat notifications
- Enable character management via Discord commands

### 3. Data Persistence
- Store authentication tokens to keep you logged in
- Cache character data for faster loading
- Sync data across devices (if using Discord pairing)

## Data Storage Locations

### 1. Browser Local Storage
- **Location:** Your local device
- **Access:** Only OwlCloud extension
- **Data:** Auth tokens, character cache, settings
- **Encrypted:** By browser (browser-level encryption)

### 2. Supabase Database
- **Location:** Supabase cloud infrastructure (AWS)
- **Access:** Protected by Row-Level Security policies
- **Data:** Character data (only if using Discord integration)
- **Security:** Anon key used (public key, RLS enforced)

### 3. Discord Servers
- **Location:** Discord's infrastructure
- **Access:** Per Discord's privacy policy
- **Data:** Only chat messages containing dice rolls
- **Control:** Managed by Discord server admins

## Data Sharing

**We do NOT share your data with third parties except:**

1. **DiceCloud:** Your auth token is used to communicate with DiceCloud API
2. **Roll20:** Character data is read from Roll20's DOM (not sent to our servers)
3. **Discord:** Dice roll messages sent to Discord channels (if you use Discord integration)
4. **Supabase:** Character data stored if using Discord pairing (infrastructure provider)

**We do NOT:**
- Sell your data
- Use your data for advertising
- Share with data brokers
- Track you across websites

## Your Rights

### 1. Access Your Data
- View all stored data in browser DevTools → Application → Storage
- Query your Supabase data via dashboard (if using Discord integration)

### 2. Delete Your Data

**Browser Storage:**
1. Right-click extension icon → Remove from Chrome/Firefox
2. Browser will automatically delete all local storage

**Supabase Database:**
1. Use `/disconnect` command in Discord to unlink character
2. Contact support to request full account deletion

**Discord Data:**
1. Delete messages manually in Discord
2. Discord retains data per their privacy policy

### 3. Export Your Data
- Character data stored locally can be exported via browser DevTools
- Contact support for Supabase data export (JSON format)

### 4. Opt-Out of Discord Integration
- Simply don't use the `/owlcloud pair` command
- Your data stays local if you don't pair with Discord

## Data Retention

### Local Storage
- Retained until you uninstall extension or clear browser data
- Auth tokens cleared on logout

### Supabase Database
- Retained while your character pairing is active
- 90 days after last activity (subject to change)
- Delete anytime via `/disconnect` command

### Discord Messages
- Retained per Discord's data retention policy
- You can delete individual messages

## Security Measures

### Extension Security
- ✅ Content Security Policy enforced
- ✅ XSS prevention (HTML escaping)
- ✅ Origin validation for cross-window communication
- ✅ Minimal permissions requested
- ✅ No remote code execution

### Database Security
- ✅ Row-Level Security (RLS) enabled
- ✅ Users can only access their own data
- ✅ Anon key used (service key never exposed to client)
- ✅ HTTPS encryption in transit

### Authentication
- ✅ Tokens stored in browser-encrypted storage
- ✅ Token expiry validation
- ✅ Logout clears all auth state
- ✅ No password storage (only API tokens)

## Third-Party Services

### DiceCloud
- API: https://dicecloud.com
- Privacy: https://dicecloud.com (see their privacy policy)
- Purpose: Character sheet management

### Roll20
- Website: https://roll20.net
- Privacy: https://roll20.net/privacy (see their privacy policy)
- Purpose: Virtual tabletop integration

### Discord
- Website: https://discord.com
- Privacy: https://discord.com/privacy (see their privacy policy)
- Purpose: Dice rolling and notifications

### Supabase
- Website: https://supabase.com
- Privacy: https://supabase.com/privacy
- Purpose: Database infrastructure (AWS-hosted)

## Children's Privacy

OwlCloud is not directed at children under 13. We do not knowingly collect data from children under 13. If you believe a child has provided data, contact us to delete it.

## Changes to This Policy

We may update this privacy policy. Changes will be posted at:
- GitHub repository: https://github.com/CarmaNayeli/rollCloud
- Extension update notes

**Notification Method:**
- Major changes: Extension update notification
- Minor changes: GitHub commit log

## Contact & Data Requests

**For privacy questions or data requests:**

1. **GitHub Issues:** https://github.com/CarmaNayeli/rollCloud/issues
   - Label: `privacy` or `data-request`

2. **Discord:** Join support server (link in README)

3. **Email:** See package.json author field

**Response Time:** 30 days for data requests

## GDPR Compliance (EU Users)

If you are in the European Union, you have additional rights under GDPR:

### Legal Basis for Processing
- **Contractual Necessity:** To provide extension functionality
- **Legitimate Interest:** To improve and secure the extension
- **Consent:** For Discord integration features

### Your GDPR Rights
- Right to access your personal data
- Right to rectification of inaccurate data
- Right to erasure ("right to be forgotten")
- Right to restrict processing
- Right to data portability
- Right to object to processing
- Right to withdraw consent

### Data Protection Officer
For GDPR-related inquiries, contact via GitHub issues with `GDPR` label.

### Supervisory Authority
You have the right to lodge a complaint with your local data protection authority.

## California Privacy Rights (CCPA)

If you are a California resident, you have rights under CCPA:

### Information We Collect
- See "Data We Collect" section above

### How We Use Data
- See "How We Use Your Data" section above

### Your CCPA Rights
- Right to know what data we collect
- Right to delete your data
- Right to opt-out of sale (we don't sell data)
- Right to non-discrimination

### Exercising Rights
Contact us via GitHub issues with `CCPA` label.

## Open Source Transparency

OwlCloud is open source (MIT License). You can:
- Review all code: https://github.com/CarmaNayeli/rollCloud
- Audit data collection practices
- Contribute improvements
- Fork and self-host

## Consent

By using OwlCloud, you consent to this privacy policy.

**To withdraw consent:**
1. Uninstall the extension
2. Request data deletion via GitHub issues

---

**Questions?** Open an issue: https://github.com/CarmaNayeli/rollCloud/issues
