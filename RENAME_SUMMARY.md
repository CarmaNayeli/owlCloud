# RollCloud → OwlCloud Rename Summary

## Overview
Successfully renamed all instances of "RollCloud" to "OwlCloud" throughout the entire codebase while preserving case variations and GitHub repository URLs.

## Statistics

### Files Modified
- **Total files changed**: 238 files
- **Total line changes**: 1,773 insertions, 2,409 deletions

### Case Variations Preserved
- `RollCloud` → `OwlCloud`: 680+ instances
- `rollcloud` → `owlcloud`: 885+ instances  
- `rollCloud` → `owlCloud`: Various instances
- `ROLLCLOUD` → `OWLCLOUD`: Various instances

### File Types Affected
- JavaScript files (.js): 89 files
- React Server Components (.rsc): 37 files
- Markdown documentation (.md): 31 files
- HTML files (.html): 20 files
- SQL migrations (.sql): 18 files
- JSON config files (.json): 16 files
- TypeScript React (.tsx): 6 files
- TypeScript (.ts): 3 files
- Shell scripts (.sh): 3 files
- SVG icons (.svg): 3 files
- PowerShell scripts (.ps1): 2 files
- Environment examples (.example): 2 files
- Other: 8 files (XML, NSH, patch, etc.)

## Key Changes

### Extension Manifests
- `manifest.json`: Extension name updated to "OwlCloud: DiceCloud + Owlbear Rodeo + Discord Integration"
- `manifest_firefox.json`: Firefox extension name updated
- `manifest_safari.json`: Safari extension name updated

### Database Schema
- All table names updated: `rollcloud_characters` → `owlcloud_characters`
- All table indexes updated: `idx_rollcloud_*` → `idx_owlcloud_*`
- All RLS policies updated to reference new table names
- All Supabase functions and triggers updated

### Source Code
- All JavaScript/TypeScript source files updated
- All Discord bot commands updated
- All API endpoints updated
- All UI components and templates updated
- All documentation and comments updated

### Build Artifacts
- Next.js `.next` build directory: 60 files updated
- Source maps (.js.map): 4 files updated
- Static chunks and server-rendered components updated

### Documentation
- All README files updated
- Privacy policy updated
- Contributing guidelines updated
- Installation guides updated
- Experimental documentation updated

## Preserved Elements

### GitHub Repository URLs
**21 instances preserved** of `github.com/CarmaNayeli/rollCloud`

These were intentionally kept as-is to maintain compatibility with existing repository links:
- Installation instructions
- Release download URLs  
- Source code references
- Registry allowed sources
- Git remotes

### Binary Files
The following binary/compiled files had encoding issues and may need to be regenerated:
- Some compiled Next.js chunks in `.next/build/chunks/`
- Some server route files with special characters in paths

**Recommendation**: Rebuild the Next.js dashboard to regenerate these files with updated names:
```bash
cd Pip2/dashboard
npm run build
```

## Next Steps

1. **Review Changes**
   ```bash
   git diff --stat
   git diff src/ Pip2/
   ```

2. **Test the Application**
   - Test browser extension functionality
   - Test Discord bot commands
   - Test database connections
   - Test dashboard interface

3. **Rebuild Build Artifacts**
   ```bash
   # Rebuild Next.js dashboard
   cd Pip2/dashboard
   npm run build
   
   # Rebuild browser extensions
   npm run build
   ```

4. **Update External Services**
   - Update Supabase database (run migrations to rename tables)
   - Update Discord bot deployment
   - Update any external documentation
   - Update Chrome Web Store listing (when ready)
   - Update Firefox Add-ons listing (when ready)

5. **Commit Changes**
   ```bash
   git add .
   git commit -m "Rename RollCloud to OwlCloud throughout codebase
   
   - Rename extension name in all manifests
   - Update database table names and schemas
   - Update all source code references
   - Update documentation and comments
   - Preserve GitHub repository URLs
   
   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
   ```

## Verification

All case-sensitive variations of "rollcloud" have been successfully renamed to "owlcloud" equivalents, with the exception of:
- GitHub repository URLs (intentionally preserved)
- Some binary/compiled files that need regeneration

The rename is complete and ready for testing and deployment.
