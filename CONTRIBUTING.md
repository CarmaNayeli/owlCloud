# Contributing to RollCloud

Thank you for your interest in contributing to RollCloud! This guide will help you get started.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Project Structure](#project-structure)
5. [Making Changes](#making-changes)
6. [Testing](#testing)
7. [Submitting Changes](#submitting-changes)
8. [Coding Standards](#coding-standards)
9. [Commit Guidelines](#commit-guidelines)
10. [Getting Help](#getting-help)

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to make RollCloud better.

**Expected Behavior:**
- Be welcoming to newcomers
- Respect differing viewpoints
- Accept constructive criticism gracefully
- Focus on what's best for the community

**Unacceptable Behavior:**
- Harassment, discrimination, or personal attacks
- Trolling or insulting comments
- Publishing private information without permission
- Any conduct inappropriate in a professional setting

## Getting Started

### Prerequisites

- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **Git:** Latest version
- **Chrome/Firefox:** For testing extensions
- **OpenSSL:** For key generation (extension signing)

### Optional Tools
- **VS Code:** Recommended IDE
- **ESLint extension:** For code linting
- **Git Bash:** For Windows users

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/rollCloud.git
cd rollCloud

# Add upstream remote
git remote add upstream https://github.com/CarmaNayeli/rollCloud.git
```

### 2. Install Dependencies

```bash
# Root dependencies (build tools)
npm install

# Pip2 bot dependencies (if working on Discord bot)
cd Pip2
npm install
cd ..

# Dashboard dependencies (if working on web dashboard)
cd Pip2/dashboard
npm install
cd ../..
```

### 3. Set Up Environment

```bash
# Copy example environment files
cp Pip2/.env.example Pip2/.env
cp Pip2/dashboard/.env.example Pip2/dashboard/.env

# Edit .env files with your credentials
# See Pip2/SETUP.md for Supabase setup
```

### 4. Build the Extension

```bash
# Quick build (extensions only)
npm run build:quick

# Full build (extensions + installer)
npm run build

# The built extensions will be in /releases/
```

### 5. Load Extension in Browser

**Chrome:**
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `releases/chrome-extension/` folder

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `releases/firefox-extension/manifest.json`

## Project Structure

```
rollCloud/
├── src/                        # Browser extension source
│   ├── background.js          # Service worker (Chrome) / background script
│   ├── content/               # Content scripts
│   │   ├── dicecloud.js       # DiceCloud integration
│   │   └── roll20.js          # Roll20 integration
│   ├── popup/                 # Extension popup UI
│   │   ├── popup.html
│   │   └── popup.js
│   ├── lib/                   # Libraries
│   │   ├── supabase-client.js # Supabase authentication
│   │   └── meteor-ddp-client.js # DiceCloud DDP client
│   ├── modules/               # Feature modules
│   │   ├── action-executor.js # Action/spell execution
│   │   ├── card-creator.js    # Roll20 card generation
│   │   └── *-edge-cases.js    # Edge case handlers
│   └── common/                # Shared utilities
│       ├── debug.js           # Debug logging
│       ├── html-utils.js      # XSS prevention
│       └── theme-manager.js   # UI theming
├── Pip2/                      # Discord bot
│   ├── src/                   # Bot source code
│   │   ├── index.js           # Main entry point
│   │   ├── commands/          # Slash commands
│   │   └── events/            # Event handlers
│   └── dashboard/             # Next.js web dashboard
│       ├── app/               # Next.js 13+ app directory
│       ├── components/        # React components
│       └── lib/               # Utilities
├── scripts/                   # Build scripts
│   ├── build-all.js          # Main build script
│   ├── build-extension.js    # Extension builder
│   └── build-signed.js       # Sign extensions (CRX/XPI)
├── installer/                 # Electron installer
├── supabase/                  # Database migrations
├── tests/                     # Manual test files
└── manifest.json              # Chrome Manifest V3
```

## Making Changes

### 1. Create a Branch

```bash
# Update your fork
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-description
```

### 2. Make Your Changes

**Before editing:**
- Read relevant code to understand existing patterns
- Check for similar implementations
- Review related issues/PRs

**While editing:**
- Follow existing code style
- Add comments for complex logic
- Use descriptive variable names
- Keep functions focused and small

### 3. Test Your Changes

```bash
# Build the extension
npm run build:quick

# Load in browser and test:
# - Does it work as expected?
# - Does it break existing functionality?
# - Are there console errors?
# - Does it work in both Chrome and Firefox?
```

**Manual Testing Checklist:**
- [ ] Extension loads without errors
- [ ] Login/logout works
- [ ] Character data syncs correctly
- [ ] Dice rolls execute properly
- [ ] No console errors or warnings
- [ ] Works in both Chrome and Firefox
- [ ] Discord integration works (if applicable)

## Testing

### Manual Testing

Currently, RollCloud uses manual testing. Test files are in `/tests/`:

```bash
# Open test files in browser
firefox tests/test-extension.html
```

### Testing Best Practices

1. **Test in Both Browsers:** Chrome (Manifest V3) and Firefox (Manifest V2)
2. **Test Common Scenarios:**
   - Fresh install
   - Login/logout
   - Character switching
   - Dice rolling
   - Resource tracking (HP, spell slots)
3. **Check Console:** Look for errors, warnings, or unexpected logs
4. **Test Edge Cases:** Empty data, missing properties, network errors

### Future Testing (Help Wanted!)

We need to implement:
- [ ] Unit tests (Jest/Vitest)
- [ ] Integration tests
- [ ] E2E tests (Playwright)

**Want to help?** Adding test infrastructure would be a great contribution!

## Submitting Changes

### 1. Commit Your Changes

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "Add feature: describe what you added"

# See "Commit Guidelines" below for message format
```

### 2. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 3. Create Pull Request

1. Go to your fork on GitHub
2. Click "Pull Request" button
3. Select base: `main` ← compare: `your-branch`
4. Fill out PR template (see below)
5. Submit!

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
Describe how you tested your changes:
- [ ] Tested in Chrome
- [ ] Tested in Firefox
- [ ] Manual testing completed
- [ ] No console errors

## Screenshots (if applicable)
Add screenshots to show changes

## Checklist
- [ ] My code follows the project's code style
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] My changes generate no new warnings or errors
- [ ] I have tested my changes in both Chrome and Firefox
```

## Coding Standards

### JavaScript Style

**General Principles:**
- Use ES6+ features (const/let, arrow functions, async/await)
- Prefer functional patterns over imperative
- Keep functions small and focused
- Use descriptive names

**Examples:**

```javascript
// ✅ Good
async function fetchCharacterData(characterId) {
  try {
    const response = await fetch(`/api/characters/${characterId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    debug.error('Failed to fetch character:', error);
    throw error;
  }
}

// ❌ Bad
function getChar(id) {
  fetch('/api/characters/' + id).then(r => r.json()).then(d => { return d; }).catch(e => console.log(e));
}
```

### Naming Conventions

- **Variables:** camelCase (`characterData`, `userId`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_RETRIES`, `API_URL`)
- **Functions:** camelCase, verb-first (`fetchData`, `updateCharacter`)
- **Classes:** PascalCase (`SupabaseTokenManager`, `CardCreator`)
- **Files:** kebab-case (`supabase-client.js`, `action-executor.js`)

### Comments

```javascript
// ✅ Good: Explain WHY, not WHAT
// Retry on network errors because DiceCloud API is sometimes unstable
const maxRetries = 3;

// ✅ Good: Document complex logic
/**
 * Generate browser fingerprint for session persistence
 * Uses non-invasive data (no canvas fingerprinting)
 */
function generateUserId() { ... }

// ❌ Bad: Stating the obvious
// Set i to 0
let i = 0;
```

### Security

**Always:**
- Escape HTML with `escapeHTML()` from `/src/common/html-utils.js`
- Validate origins for `postMessage` communications
- Use `textContent` instead of `innerHTML` when possible
- Sanitize user input before display

**Never:**
- Use `eval()` or `Function()` constructor
- Trust user input without validation
- Hardcode secrets or tokens
- Use `innerHTML` with unsanitized data

### Error Handling

```javascript
// ✅ Good: Specific error handling
try {
  await riskyOperation();
} catch (error) {
  if (error.code === 'AUTH_EXPIRED') {
    await reauthenticate();
  } else {
    debug.error('Unexpected error:', error);
    throw error;
  }
}

// ❌ Bad: Silent failures
try {
  await riskyOperation();
} catch (e) {}
```

## Commit Guidelines

### Commit Message Format

```
<type>: <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring (no functional change)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (build, dependencies)

### Examples

```bash
# Good commit messages
git commit -m "feat: Add spell slot tracking to character overlay"
git commit -m "fix: Prevent double dice rolls on rapid clicks"
git commit -m "docs: Update installation guide for Firefox"
git commit -m "refactor: Extract dice rolling logic to separate module"

# Bad commit messages
git commit -m "fixed stuff"
git commit -m "updates"
git commit -m "asdfasdf"
```

### Commit Body (Optional)

For complex changes, add details:

```
feat: Add spell slot tracking to character overlay

- Track spell slots by level (1st-9th)
- Auto-decrement on spell cast
- Visual indicator for remaining slots
- Sync with DiceCloud in real-time

Closes #123
```

## Documentation

### When to Update Docs

Update documentation when you:
- Add new features
- Change user-facing behavior
- Modify installation steps
- Change configuration options
- Fix important bugs

### Documentation Files

- `README.md` - User guide, installation, features
- `PRIVACY.md` - Privacy policy (if changing data collection)
- `CONTRIBUTING.md` - This file
- Code comments - Complex logic, edge cases, workarounds

### Writing Good Documentation

```markdown
✅ Good:
## Installation

1. Download `rollcloud-chrome.zip` from [releases](releases/)
2. Extract to a folder
3. Open Chrome → Extensions → Enable Developer Mode
4. Click "Load Unpacked" and select the extracted folder

❌ Bad:
## Installation
Download and install it
```

## Common Tasks

### Adding a New Slash Command (Discord Bot)

1. Create file: `Pip2/src/commands/your-command.js`
2. Use existing commands as template
3. Export command data and execute function
4. Update `Pip2/src/deploy-commands.js` to register
5. Test with `node Pip2/src/deploy-commands.js`

### Adding a New Edge Case Handler

1. Identify which type: spell, class feature, racial feature, combat maneuver
2. Edit appropriate file in `src/modules/*-edge-cases.js`
3. Add case to `getEdgeCaseHandler()` function
4. Implement handler function
5. Test with character that has that feature

### Modifying Build Process

1. Edit appropriate script in `/scripts/`
2. Test build: `npm run build:quick`
3. Verify output in `/releases/`
4. Test extension loads properly
5. Document changes in script comments

## Getting Help

### Questions?

- **GitHub Discussions:** Best for general questions
- **GitHub Issues:** For bugs or feature requests (include `question` label)
- **Discord:** Join support server (link in README)
- **Code Comments:** Read existing code for examples

### Stuck on Something?

1. Check existing issues for similar problems
2. Review related code and documentation
3. Search GitHub for similar PRs
4. Ask in Discord or open a discussion

### Reporting Bugs

Use this template:

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- Browser: [e.g., Chrome 120, Firefox 121]
- OS: [e.g., Windows 11, macOS 14]
- Extension Version: [e.g., 1.2.4]

**Console Errors**
Paste any console errors (F12 → Console)
```

## Code Review Process

### What to Expect

1. **Initial Review:** Within 1-2 weeks
2. **Feedback:** Maintainers may request changes
3. **Iteration:** Make requested changes and push
4. **Approval:** Once approved, PR will be merged
5. **Release:** Included in next version

### Review Criteria

- Code quality and style
- Security considerations
- Browser compatibility
- Performance impact
- Documentation completeness
- Testing coverage

## Recognition

Contributors will be:
- Listed in release notes
- Credited in future CONTRIBUTORS.md
- Thanked in PR comments

Thank you for contributing to RollCloud! 🎲

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
