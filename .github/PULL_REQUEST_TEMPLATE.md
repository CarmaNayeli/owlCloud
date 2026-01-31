# Pull Request

## Description

<!-- Provide a clear and concise description of what this PR does -->

## Type of Change

<!-- Mark the relevant option with an 'x' -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🎨 Code refactoring (no functional changes)
- [ ] 🔧 Configuration change
- [ ] 🧪 Test additions or updates

## Related Issues

<!-- Link to related issues using #issue_number -->
<!-- Example: Closes #123, Fixes #456 -->

Closes #

## Changes Made

<!-- List the specific changes you made -->

-
-
-

## Testing

### Manual Testing Checklist

<!-- Mark completed items with an 'x' -->

- [ ] Tested in Chrome (latest version)
- [ ] Tested in Firefox (latest version)
- [ ] Extension loads without errors
- [ ] Login/logout functionality works
- [ ] No console errors or warnings
- [ ] Tested with multiple characters
- [ ] Dice rolling works correctly
- [ ] Resource tracking (HP, spell slots) works
- [ ] Discord integration tested (if applicable)

### Test Scenarios

<!-- Describe how you tested your changes -->

**Scenario 1:**
1. Step 1
2. Step 2
3. Expected result:

**Scenario 2:**
1. Step 1
2. Step 2
3. Expected result:

## Screenshots

<!-- If applicable, add screenshots to help explain your changes -->
<!-- You can drag and drop images here -->

### Before
<!-- Screenshot of the UI/behavior before changes -->

### After
<!-- Screenshot of the UI/behavior after changes -->

## Performance Impact

<!-- Describe any performance implications of your changes -->

- [ ] No significant performance impact
- [ ] Performance improved
- [ ] Potential performance concerns (explain below)

<!-- If there are performance concerns, describe them here -->

## Security Considerations

<!-- Check all that apply -->

- [ ] No security implications
- [ ] Changes involve authentication/authorization
- [ ] Changes handle user input (XSS prevention verified)
- [ ] Changes involve external API calls
- [ ] Changes involve data storage
- [ ] Security review recommended

<!-- If security review is needed, explain why -->

## Breaking Changes

<!-- If this PR includes breaking changes, describe them here -->
<!-- Include migration instructions for users -->

**Breaking changes:**
-

**Migration guide:**
1.
2.

## Checklist

<!-- Mark completed items with an 'x' -->

### Code Quality
- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] My changes generate no new warnings or errors
- [ ] No `console.log` statements left in code (use `debug.js` instead)
- [ ] No `eval()` or other security risks introduced

### Documentation
- [ ] I have updated relevant documentation (README, comments, etc.)
- [ ] I have updated PRIVACY.md (if data collection changed)
- [ ] I have added/updated JSDoc comments for new functions

### Testing
- [ ] I have tested my changes in both Chrome and Firefox
- [ ] I have tested edge cases and error scenarios
- [ ] I have verified no regression in existing functionality
- [ ] I have added test files/scenarios if applicable

### Build
- [ ] Extension builds successfully (`npm run build:quick`)
- [ ] No new build warnings or errors
- [ ] Extension size is reasonable (check releases folder)

### Manifest
- [ ] Chrome manifest (manifest.json) updated if needed
- [ ] Firefox manifest (manifest_firefox.json) updated if needed
- [ ] Safari manifest (manifest_safari.json) updated if needed
- [ ] Version numbers are consistent

### Dependencies
- [ ] No new dependencies added, or
- [ ] New dependencies are justified and documented below
- [ ] `npm audit` shows no new vulnerabilities

<!-- If you added dependencies, explain why here -->

## Additional Notes

<!-- Any additional information that reviewers should know -->

## For Reviewers

<!-- Optional: Highlight specific areas where you'd like feedback -->

**Please pay special attention to:**
-
-

**Questions for reviewers:**
-
-

## Post-Merge Checklist

<!-- For maintainers - items to complete after merging -->

- [ ] Update release notes
- [ ] Tag new version if applicable
- [ ] Deploy to production (dashboard)
- [ ] Publish extension updates (Chrome/Firefox)
- [ ] Update documentation website
- [ ] Notify users in Discord

---

**Thank you for contributing to OwlCloud! 🎲**
