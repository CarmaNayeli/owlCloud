# OwlCloud

**Seamlessly integrate your DiceCloud V2 characters into Owlbear Rodeo with full Discord support.**

OwlCloud bridges DiceCloud character sheets with Owlbear Rodeo's virtual tabletop, allowing you to view character data, roll dice, and track resources directly in your game sessions.

---

## 🚀 Quick Start

### Download Browser Extension

Choose your browser:

- **Chrome/Edge**: [Download Latest Release](https://github.com/CarmaNayeli/OwlCloud/releases/latest/download/owlcloud-extension.zip)
- **Firefox**: [Download Latest Release](https://github.com/CarmaNayeli/OwlCloud/releases/latest/download/owlcloud-extension-firefox.zip)

### Installation

OwlCloud requires **two components** to work:

#### 1. Browser Extension (Required)
Communicates with the DiceCloud API to fetch and sync your character data.

**Chrome / Edge:**
1. Download and unzip the extension
2. Open `chrome://extensions/` (Chrome) or `edge://extensions/` (Edge)
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the unzipped folder

**Firefox:**
1. Download the Firefox extension
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select the zip file (no need to unzip)

#### 2. Owlbear Extension (Required)
Displays your character sheet UI and handles dice rolling inside Owlbear Rodeo.

1. Open [Owlbear Rodeo](https://www.owlbear.rodeo) and join or create a room
2. Click the Extensions menu (puzzle piece icon)
3. Click "Add Extension"
4. Paste this URL: `https://owlcloud.vercel.app/extension/manifest.json`
5. Your DiceCloud characters will appear in the OwlCloud popover!

---

## ✨ Features

### 📋 Character Sheet Integration
- View full character sheets inside Owlbear Rodeo
- Access stats, abilities, skills, actions, spells, and features
- Character portrait display with automatic sizing
- Real-time character data from DiceCloud V2

### 🎲 Dice Rolling
- Roll ability checks and saving throws
- Attack rolls with damage calculations
- Spell casting with slot tracking
- Advantage/disadvantage toggle for d20 rolls
- Automatic modifiers from character stats
- Roll results shared in room chat

### 📊 Resource Management
- Track HP, spell slots, and class resources
- Manual adjustment controls for all resources
- Use buttons for features that consume resources
- Automatic spell slot decrementation on cast

### 💬 Chat Integration
- Expandable/collapsible roll messages
- Damage and healing color-coded messages
- Detailed spell and action information
- Initiative and death save rolling
- Shared rolls visible to all players

### 🦉 Owlbear Integration
- Native extension using the Owlbear Rodeo SDK
- Seamless popover UI within the VTT
- Character selection and switching
- Persistent room metadata for chat history

---

## 🛠️ Development

### Prerequisites
- Node.js 14+
- npm or yarn

### Building from Source

```bash
# Install dependencies
npm install

# Build browser extensions
npm run build-extension

# Prepare release packages
npm run release
```

### Project Structure
```
owlCloud/
├── src/                    # Browser extension source
├── owlbear-extension/      # Owlbear Rodeo extension
│   ├── manifest.json       # Extension manifest
│   ├── popover.html        # Main UI
│   ├── popover.js          # Extension logic
│   ├── chat.html           # Chat window
│   └── chat.js             # Chat logic
├── build-scripts/          # Build automation
├── supabase/               # Supabase Edge Functions
└── dist/                   # Build output

```

### Available Scripts

- `npm run build` - Build TypeScript SDK
- `npm run build-extension` - Build browser extensions
- `npm run release` - Create production release packages
- `npm run release-dev` - Create development release packages
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

---

## 🌐 Deployment

The Owlbear extension is deployed on Vercel at: https://owlcloud.vercel.app

The browser extension is distributed via GitHub Releases with unversioned filenames for automatic updates.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly with both components
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## 📝 License

MIT License

Copyright (C) 2025 OwlCloud Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 🔗 Links

- **Documentation**: [Owlbear Rodeo Docs](https://docs.owlbear.rodeo)
- **DiceCloud**: [dicecloud.com](https://dicecloud.com)
- **Owlbear Rodeo**: [owlbear.rodeo](https://www.owlbear.rodeo)
- **Report Issues**: [GitHub Issues](https://github.com/CarmaNayeli/owlCloud/issues)

---

Built with ❤️ for the Owlbear Rodeo community
