/**
 * Custom Character Sheet Overlay for Roll20
 * Displays Dice Cloud character data in a beautiful, interactive overlay
 */

(function() {
  'use strict';

  console.log('🎲 RollCloud: Custom sheet overlay loaded');

  let characterData = null;
  let overlayVisible = false;
  let overlayElement = null;

  // Roll statistics and history
  const rollStats = {
    history: [],
    settings: {
      enabled: true,
      showNotifications: true,
      showHistory: true,
      maxHistorySize: 20,
      advantageMode: 'normal' // 'normal', 'advantage', 'disadvantage'
    },
    stats: {
      totalRolls: 0,
      averageRoll: 0,
      highestRoll: 0,
      lowestRoll: Infinity,
      criticalSuccesses: 0,
      criticalFailures: 0
    }
  };

  /**
   * Creates the custom character sheet overlay
   */
  function createOverlay() {
    if (overlayElement) return;

    overlayElement = document.createElement('div');
    overlayElement.id = 'rollcloud-character-overlay';
    overlayElement.innerHTML = `
      <div class="rollcloud-sheet-container">
        <div class="rollcloud-header">
          <div class="sheet-title">
            <h2 id="character-name">Character Name</h2>
            <div class="character-subtitle">
              <span id="character-class">Class</span> 
              <span id="character-level">Level 1</span> • 
              <span id="character-race">Race</span>
            </div>
          </div>
          <div class="sheet-controls">
            <button class="control-btn" id="popout-btn">🔗 Pop Out</button>
            <button class="control-btn" id="sync-btn">🔄 Sync Data</button>
            <button class="control-btn" id="close-btn">✕ Close</button>
          </div>
        </div>

        <div class="rollcloud-content">
          <!-- Abilities -->
          <div class="section">
            <h3>⚡ Abilities</h3>
            <div class="abilities-grid">
              <div class="ability-card" data-roll="1d20+0" data-name="Strength Check">
                <div class="roll-indicator">🎲</div>
                <div class="ability-name">STR</div>
                <div class="ability-score">10</div>
                <div class="ability-mod">+0</div>
              </div>
              <div class="ability-card" data-roll="1d20+0" data-name="Dexterity Check">
                <div class="roll-indicator">🎲</div>
                <div class="ability-name">DEX</div>
                <div class="ability-score">10</div>
                <div class="ability-mod">+0</div>
              </div>
              <div class="ability-card" data-roll="1d20+0" data-name="Constitution Check">
                <div class="roll-indicator">🎲</div>
                <div class="ability-name">CON</div>
                <div class="ability-score">10</div>
                <div class="ability-mod">+0</div>
              </div>
              <div class="ability-card" data-roll="1d20+0" data-name="Intelligence Check">
                <div class="roll-indicator">🎲</div>
                <div class="ability-name">INT</div>
                <div class="ability-score">10</div>
                <div class="ability-mod">+0</div>
              </div>
              <div class="ability-card" data-roll="1d20+0" data-name="Wisdom Check">
                <div class="roll-indicator">🎲</div>
                <div class="ability-name">WIS</div>
                <div class="ability-score">10</div>
                <div class="ability-mod">+0</div>
              </div>
              <div class="ability-card" data-roll="1d20+0" data-name="Charisma Check">
                <div class="roll-indicator">🎲</div>
                <div class="ability-name">CHA</div>
                <div class="ability-score">10</div>
                <div class="ability-mod">+0</div>
              </div>
            </div>
          </div>

          <!-- Combat Stats -->
          <div class="section">
            <h3>⚔️ Combat</h3>
            <div class="combat-stats">
              <div class="combat-stat">
                <label>Armor Class</label>
                <div class="value" id="ac">10</div>
              </div>
              <div class="combat-stat">
                <label>Hit Points</label>
                <div class="hp-input-group">
                  <input type="number" id="hp-current" class="hp-input" value="10" min="0">
                  <span class="hp-separator">/</span>
                  <input type="number" id="hp-max" class="hp-input" value="10" min="0">
                </div>
              </div>
              <div class="combat-stat">
                <label>Speed</label>
                <div class="value" id="speed">30</div>
              </div>
              <div class="combat-stat">
                <label>Initiative</label>
                <button class="initiative-btn" id="initiative-btn">+0</button>
              </div>
              <div class="combat-stat">
                <label>Proficiency</label>
                <div class="value" id="proficiency">+2</div>
              </div>
            </div>
          </div>

          <!-- Saving Throws -->
          <div class="section">
            <h3>🛡️ Saving Throws</h3>
            <div class="saves-grid">
              <div class="save-card">
                <span class="save-name">STR</span>
                <span class="save-bonus" id="strength-save">+0</span>
              </div>
              <div class="save-card">
                <span class="save-name">DEX</span>
                <span class="save-bonus" id="dexterity-save">+0</span>
              </div>
              <div class="save-card">
                <span class="save-name">CON</span>
                <span class="save-bonus" id="constitution-save">+0</span>
              </div>
              <div class="save-card">
                <span class="save-name">INT</span>
                <span class="save-bonus" id="intelligence-save">+0</span>
              </div>
              <div class="save-card">
                <span class="save-name">WIS</span>
                <span class="save-bonus" id="wisdom-save">+0</span>
              </div>
              <div class="save-card">
                <span class="save-name">CHA</span>
                <span class="save-bonus" id="charisma-save">+0</span>
              </div>
            </div>
          </div>

          <!-- Skills -->
          <div class="section">
            <h3> Skills</h3>
            <div class="skills-grid">
              <div class="skill-card">
                <span class="skill-name">Acrobatics</span>
                <span class="skill-bonus" id="acrobatics">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Animal Handling</span>
                <span class="skill-bonus" id="animal-handling">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Arcana</span>
                <span class="skill-bonus" id="arcana">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Athletics</span>
                <span class="skill-bonus" id="athletics">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Deception</span>
                <span class="skill-bonus" id="deception">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">History</span>
                <span class="skill-bonus" id="history">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Insight</span>
                <span class="skill-bonus" id="insight">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Intimidation</span>
                <span class="skill-bonus" id="intimidation">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Investigation</span>
                <span class="skill-bonus" id="investigation">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Medicine</span>
                <span class="skill-bonus" id="medicine">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Nature</span>
                <span class="skill-bonus" id="nature">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Perception</span>
                <span class="skill-bonus" id="perception">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Performance</span>
                <span class="skill-bonus" id="performance">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Persuasion</span>
                <span class="skill-bonus" id="persuasion">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Religion</span>
                <span class="skill-bonus" id="religion">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Sleight of Hand</span>
                <span class="skill-bonus" id="sleight-of-hand">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Stealth</span>
                <span class="skill-bonus" id="stealth">+0</span>
              </div>
              <div class="skill-card">
                <span class="skill-name">Survival</span>
                <span class="skill-bonus" id="survival">+0</span>
              </div>
            </div>
          </div>

          <!-- Resources (Vexus Fields) -->
          <div class="section">
            <h3>🔮 Resources</h3>
            <div class="resources-grid">
              <div class="resource-card">
                <label>Level 1 Slots</label>
                <div class="value" id="level1-slots">0</div>
              </div>
              <div class="resource-card">
                <label>Level 2 Slots</label>
                <div class="value" id="level2-slots">0</div>
              </div>
              <div class="resource-card">
                <label>Level 3 Slots</label>
                <div class="value" id="level3-slots">0</div>
              </div>
              <div class="resource-card">
                <label>Ki Points</label>
                <div class="value" id="ki">0</div>
              </div>
              <div class="resource-card">
                <label>Sorcery Points</label>
                <div class="value" id="sorcery-points">0</div>
              </div>
              <div class="resource-card">
                <label>Rages</label>
                <div class="value" id="rages">0</div>
              </div>
            </div>
          </div>

          <!-- Additional Variables -->
          <div class="section" id="additional-variables">
            <h3>📊 Additional Variables</h3>
            <div id="variables-grid">
              <!-- Dynamic content will be added here -->
            </div>
          </div>

          <!-- Spells -->
          <div class="section spells-section">
            <h3>🔮 Spells</h3>
            <div class="spells-grid" id="spells-grid">
              <div class="empty-state">No spells available</div>
            </div>
          </div>

          <!-- Spell Slots -->
          <div class="section spell-slots-section">
            <h3>✨ Spell Slots</h3>
            <div class="spell-slots-grid" id="spell-slots-grid">
              <div class="empty-state">No spell slots available</div>
            </div>
          </div>

          <!-- Dice Cloud Panels -->
          <div class="dicecloud-panels">
            <!-- Roll History Panel -->
            <div class="panel-section" id="roll-history-panel">
              <div class="panel-header">
                <span class="panel-title">🎲 Roll History</span>
                <button class="panel-toggle" id="history-toggle">−</button>
              </div>
              <div class="panel-content">
                <div class="history-list" id="roll-history-list">
                  <div class="empty-state">No rolls yet. Make some rolls!</div>
                </div>
              </div>
            </div>

            <!-- Statistics Panel -->
            <div class="panel-section" id="stats-panel">
              <div class="panel-header">
                <span class="panel-title">📊 Statistics</span>
                <button class="panel-toggle" id="stats-toggle">−</button>
              </div>
              <div class="panel-content">
                <div class="stats-grid">
                  <div class="stat-item">
                    <span class="stat-label">Total Rolls</span>
                    <span class="stat-value" id="stat-total">0</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Average</span>
                    <span class="stat-value" id="stat-average">0.0</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Highest</span>
                    <span class="stat-value" id="stat-highest">0</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Lowest</span>
                    <span class="stat-value" id="stat-lowest">∞</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">⭐ Critical Hits</span>
                    <span class="stat-value" id="stat-crits">0</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">💀 Critical Fails</span>
                    <span class="stat-value" id="stat-fails">0</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Settings Panel -->
            <div class="panel-section" id="settings-panel">
              <div class="panel-header">
                <span class="panel-title">⚙️ Roll Settings</span>
                <button class="panel-toggle" id="settings-toggle">−</button>
              </div>
              <div class="panel-content">
                <div class="setting-group">
                  <label class="setting-label">Roll Mode</label>
                  <div class="toggle-buttons">
                    <button class="toggle-btn active" data-mode="normal">Normal</button>
                    <button class="toggle-btn" data-mode="advantage">Advantage</button>
                    <button class="toggle-btn" data-mode="disadvantage">Disadvantage</button>
                  </div>
                </div>
                <div class="setting-description">
                  Choose how d20 rolls are calculated when forwarded to Roll20
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #rollcloud-character-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(5px);
        z-index: 999999;
        display: none;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }

      .rollcloud-sheet-container {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 1200px;
        max-height: 90vh;
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        border: 2px solid #4ECDC4;
      }

      .rollcloud-header {
        background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);
        color: white;
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid #4ECDC4;
      }

      .sheet-title h2 {
        margin: 0 0 5px 0;
        font-size: 1.8em;
      }

      .character-subtitle {
        font-size: 1.1em;
        opacity: 0.9;
      }

      .sheet-controls {
        display: flex;
        gap: 10px;
      }

      .control-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        transition: background 0.2s;
      }

      .control-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .rollcloud-content {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
      }

      .section {
        margin-bottom: 25px;
      }

      .section h3 {
        margin: 0 0 15px 0;
        color: #2C3E50;
        border-bottom: 2px solid #4ECDC4;
        padding-bottom: 5px;
      }

      .abilities-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 15px;
      }

      .ability-card {
        background: linear-gradient(135deg, #f0fff4 0%, #e8f8f5 100%);
        padding: 15px;
        border-radius: 12px;
        text-align: center;
        border: 2px solid #4ECDC4;
        transition: transform 0.2s;
        position: relative;
        cursor: pointer;
      }

      .ability-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(78, 205, 196, 0.3);
      }

      .ability-card:active {
        transform: translateY(0);
      }

      .roll-indicator {
        position: absolute;
        top: 5px;
        right: 5px;
        background: #27AE60;
        color: white;
        border: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(39, 174, 96, 0.3);
        pointer-events: none;
      }

      .skill-roll-btn {
        background: #27AE60;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .skill-roll-btn:hover {
        background: #229954;
      }

      .ability-name {
        font-weight: bold;
        color: #2C3E50;
        font-size: 0.9em;
        margin-bottom: 5px;
      }

      .ability-score {
        font-size: 2em;
        font-weight: bold;
        color: #4ECDC4;
        line-height: 1;
      }

      .ability-mod {
        color: #27AE60;
        font-weight: bold;
      }

      .combat-stats, .resources-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 15px;
      }

      .combat-stat, .resource-card {
        background: #f0fff4;
        padding: 15px;
        border-radius: 8px;
        text-align: center;
        border: 1px solid #4ECDC4;
      }

      .combat-stat label, .resource-card label {
        display: block;
        font-weight: bold;
        color: #2C3E50;
        margin-bottom: 8px;
        font-size: 0.9em;
      }

      .combat-stat .value, .resource-card .value {
        font-size: 1.4em;
        font-weight: bold;
        color: #4ECDC4;
      }

      .hp-input-group {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .hp-input {
        width: 50px;
        text-align: center;
        font-size: 1.2em;
        font-weight: bold;
        color: #4ECDC4;
        background: white;
        border: 2px solid #4ECDC4;
        border-radius: 4px;
        padding: 4px;
      }

      .hp-separator {
        font-weight: bold;
        color: #4ECDC4;
        font-size: 1.2em;
      }

      .initiative-btn {
        background: #4ECDC4;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 1.2em;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
      }

      .initiative-btn:hover {
        background: #44A08D;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(78, 205, 196, 0.3);
      }

      .saves-grid, .skills-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 10px;
      }

      .save-card, .skill-card {
        background: #f0fff4;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid #4ECDC4;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .save-card:hover, .skill-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(78, 205, 196, 0.3);
      }

      .save-name, .skill-name {
        font-weight: bold;
        color: #2C3E50;
      }

      .save-bonus, .skill-bonus {
        font-weight: bold;
        color: #4ECDC4;
        background: white;
        padding: 2px 8px;
        border-radius: 12px;
        border: 1px solid #4ECDC4;
      }

      #variables-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px;
      }

      .variable-card {
        background: #f0fff4;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid #4ECDC4;
      }

      .variable-name {
        font-weight: bold;
        color: #2C3E50;
        font-size: 0.9em;
      }

      .variable-value {
        color: #4ECDC4;
        font-weight: bold;
      }

      /* Dice Cloud Panels */
      .dicecloud-panels {
        display: grid;
        grid-template-columns: 1fr;
        gap: 20px;
        margin-top: 20px;
      }

      .panel-section {
        background: #f0fff4;
        border-radius: 12px;
        border: 1px solid #4ECDC4;
        overflow: hidden;
      }

      .panel-header {
        background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);
        color: white;
        padding: 15px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
      }

      .panel-title {
        font-weight: bold;
        font-size: 1.1em;
      }

      .panel-toggle {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: background 0.2s;
      }

      .panel-toggle:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .panel-content {
        padding: 20px;
      }

      .history-list {
        max-height: 300px;
        overflow-y: auto;
      }

      .history-item {
        background: white;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 8px;
        border: 1px solid #4ECDC4;
        animation: slideIn 0.3s ease-out;
      }

      .history-item-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 5px;
      }

      .history-name {
        font-weight: bold;
        color: #2C3E50;
      }

      .history-time {
        color: #6c757d;
        font-size: 0.9em;
      }

      .history-formula {
        font-family: 'Courier New', monospace;
        color: #4ECDC4;
        font-weight: bold;
      }

      .history-badges {
        margin-top: 5px;
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
      }

      .history-badge {
        background: #e9ecef;
        color: #495057;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.8em;
        font-weight: bold;
      }

      .critical-success {
        background: #d4edda;
        color: #155724;
      }

      .critical-failure {
        background: #f8d7da;
        color: #721c24;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
      }

      .stat-item {
        background: white;
        padding: 15px;
        border-radius: 8px;
        text-align: center;
        border: 1px solid #dee2e6;
      }

      .stat-label {
        display: block;
        font-weight: bold;
        color: #6c757d;
        font-size: 0.9em;
        margin-bottom: 8px;
      }

      .stat-value {
        font-size: 1.5em;
        font-weight: bold;
        color: #667eea;
      }

      .setting-group {
        margin-bottom: 20px;
      }

      .setting-label {
        display: block;
        font-weight: bold;
        color: #495057;
        margin-bottom: 10px;
      }

      .toggle-buttons {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }

      .toggle-btn {
        background: #e9ecef;
        border: 2px solid #dee2e6;
        color: #495057;
        padding: 12px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s;
        text-align: center;
      }

      .toggle-btn:hover {
        background: #f8f9fa;
        border-color: #adb5bd;
        transform: translateY(-1px);
      }

      .toggle-btn.active {
        background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);
        border-color: #4ECDC4;
        color: white;
        box-shadow: 0 2px 8px rgba(78, 205, 196, 0.3);
      }

      .setting-description {
        background: rgba(78, 205, 196, 0.1);
        padding: 12px;
        border-radius: 8px;
        font-size: 0.9em;
        color: #2C3E50;
        text-align: center;
        margin-top: 10px;
        border: 1px solid #4ECDC4;
      }

      .empty-state {
        text-align: center;
        padding: 40px;
        color: #6c757d;
        font-style: italic;
      }

      /* Spells Section */
      .spells-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 12px;
      }

      .spell-card {
        background: linear-gradient(135deg, #f8f9ff 0%, #e8f0ff 100%);
        padding: 12px;
        border-radius: 8px;
        border: 1px solid #667eea;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .spell-card.spell-attack:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        border-color: #e74c3c;
      }

      .spell-card.spell-utility:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        border-color: #3498db;
      }

      .spell-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }

      .spell-name {
        font-weight: bold;
        color: #2C3E50;
      }

      .spell-action {
        font-size: 16px;
        opacity: 0.8;
      }

      .spell-details {
        display: flex;
        gap: 8px;
        margin-bottom: 4px;
      }

      .spell-level, .spell-school {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        background: #667eea;
        color: white;
      }

      .spell-casting-time {
        font-size: 11px;
        color: #7f8c8d;
        font-style: italic;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes slideOut {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(-10px);
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes fadeOut {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlayElement);

    // Add event listeners
    const closeBtn = document.getElementById('close-btn');
    const popoutBtn = document.getElementById('popout-btn');
    const syncBtn = document.getElementById('sync-btn');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🔴 Close button clicked');
        hideOverlay();
      });
    } else {
      console.error('❌ Close button not found');
    }
    
    if (popoutBtn) {
      popoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🔗 Pop out button clicked');
        popOutCharacterSheet();
      });
    } else {
      console.error('❌ Pop out button not found');
    }
    
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        console.log('🔄 Manual sync triggered from character sheet');
        
        // Show loading state
        const originalText = syncBtn.innerHTML;
        syncBtn.innerHTML = '🔄 Syncing...';
        syncBtn.disabled = true;
        
        // Reload character data from extension storage
        loadCharacterData();
        
        // Reset button after a delay
        setTimeout(() => {
          syncBtn.innerHTML = originalText;
          syncBtn.disabled = false;
        }, 2000);
      });
    } else {
      console.error('❌ Sync button not found');
    }

    // Add panel event listeners
    document.getElementById('history-toggle').addEventListener('click', () => togglePanel('history'));
    document.getElementById('stats-toggle').addEventListener('click', () => togglePanel('stats'));
    document.getElementById('settings-toggle').addEventListener('click', () => togglePanel('settings'));

    // Note: Dragging is not needed as overlay is shown in popup window
  }

  /**
   * Opens the character sheet in a popup window
   */
  function popOutCharacterSheet() {
    console.log('🔗 Opening character sheet in popup...');
    showOverlay();
  }

  /**
   * Loads character data from extension storage
   */
  function loadCharacterData() {
    console.log('🔄 Loading character data from storage...');
    browserAPI.runtime.sendMessage({ action: 'getCharacterData' }, (response) => {
      if (browserAPI.runtime.lastError) {
        console.error('❌ Extension context error:', browserAPI.runtime.lastError);
        showNotification('Failed to load character data', 'error');
        return;
      }

      if (response && response.data) {
        console.log('✅ Character data loaded:', response.data.name);
        characterData = response.data;

        showNotification('Character data synced! 🎲', 'success');
      } else {
        console.log('📋 No character data found');
        showNotification('No character data found. Please sync from Dice Cloud first.', 'error');
      }
    });
  }

  /**
   * Posts spell description to Roll20 chat
   */
  function postSpellDescriptionToChat(spellName, spellLevel, spellDescription) {
    console.log('🔮 Posting spell description to chat:', spellName);

    const message = `/em casts **${spellName}** (Level ${spellLevel})\n${spellDescription || 'No description available'}`;

    const success = postChatMessage(message);
    if (success) {
      showNotification(`${spellName} description posted to chat! ✨`, 'success');
    } else {
      showNotification('Failed to post to chat. Make sure you are on Roll20.', 'error');
    }
  }

  /**
   * Adds roll event listeners to all rollable elements
   */
  function addRollEventListeners() {
    // Add roll button listeners
    document.querySelectorAll('.ability-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const roll = card.getAttribute('data-roll');
        const name = card.getAttribute('data-name');
        console.log(`🎲 Clicked ability card: ${name} (${roll})`);
        rollSimultaneously(name, roll);
      });
    });

    // Add spell card listeners
    document.querySelectorAll('.spell-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('🔮 Spell card clicked, checking data attributes...');
        
        const spellName = card.getAttribute('data-spell');
        const spellLevel = card.getAttribute('data-spell-level');
        const spellDescription = card.getAttribute('data-spell-description');
        const clickAction = card.getAttribute('data-click-action');
        
        console.log(`🔮 Clicked spell: ${spellName} (Level ${spellLevel}) - Action: ${clickAction}`);
        console.log('🔮 Spell description:', spellDescription);
        
        // Always show the description first
        console.log('🔮 Posting spell description to chat');
        postSpellDescriptionToChat(spellName, spellLevel, spellDescription);
        
        // Then roll if it's an attack spell
        if (clickAction === 'rollAttack') {
          // Create a spell attack roll (d20 + spell level + proficiency)
          const spellAttackRoll = `1d20+${parseInt(spellLevel) || 0}+${characterData.proficiencyBonus || 2}`;
          console.log('🔮 Rolling spell attack:', spellAttackRoll);
          rollSimultaneously(`${spellName} Spell Attack`, spellAttackRoll);
        }
      });
    });

    // Add skill card listeners
    document.querySelectorAll('.skill-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const skillName = card.querySelector('.skill-name').textContent;
        const skillBonus = card.querySelector('.skill-bonus').textContent;
        console.log(`🎲 Clicked skill card: ${skillName} (${skillBonus})`);
        rollSimultaneously(skillName, `1d20${skillBonus}`);
      });
    });

    // Add save card listeners
    document.querySelectorAll('.save-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const saveName = card.querySelector('.save-name').textContent;
        const saveBonus = card.querySelector('.save-bonus').textContent;
        console.log(` Clicked save card: ${saveName} (${saveBonus})`);
        rollSimultaneously(`${saveName} Save`, `1d20${saveBonus}`);
      });
    });

    // Add settings toggle listeners (moved here to ensure buttons exist)
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.target.getAttribute('data-mode');
        setAdvantageMode(mode);
      });
    });

    // Add initiative button listener
    const initiativeBtn = document.getElementById('initiative-btn');
    if (initiativeBtn) {
      initiativeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const initiative = characterData.initiative || 0;
        console.log(`🎲 Initiative check: 1d20+${initiative}`);
        rollSimultaneously('Initiative Check', `1d20+${initiative}`);
      });
    }
  }

  /**
   * Toggles panel visibility
   */
  function togglePanel(panelName) {
    const panel = document.getElementById(`${panelName}-panel`);
    const content = panel.querySelector('.panel-content');
    const toggle = document.getElementById(`${panelName}-toggle`);
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      toggle.textContent = '−';
    } else {
      content.style.display = 'none';
      toggle.textContent = '+';
    }
  }

  /**
   * Sets the advantage mode
   */
  function setAdvantageMode(mode) {
    rollStats.settings.advantageMode = mode;
    
    // Update button states
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      const btnMode = btn.getAttribute('data-mode');
      if (btnMode === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    console.log(`🎲 Roll mode set to: ${mode}`);
  }

  /**
   * Updates roll statistics
   */
  function updateRollStatistics(rollData) {
    const result = parseInt(rollData.result);
    if (isNaN(result)) return;

    rollStats.stats.totalRolls++;
    rollStats.stats.highestRoll = Math.max(rollStats.stats.highestRoll, result);
    rollStats.stats.lowestRoll = Math.min(rollStats.stats.lowestRoll, result);

    // Update average (running average)
    rollStats.stats.averageRoll =
      (rollStats.stats.averageRoll * (rollStats.stats.totalRolls - 1) + result) /
      rollStats.stats.totalRolls;

    // Check for criticals
    const formula = rollData.formula.toLowerCase();
    if (formula.includes('d20') || formula.includes('1d20')) {
      if (result === 20) {
        rollStats.stats.criticalSuccesses++;
      } else if (result === 1) {
        rollStats.stats.criticalFailures++;
      }
    }

    updateStatsDisplay();
  }

  /**
   * Updates statistics display
   */
  function updateStatsDisplay() {
    // Check if elements exist (they won't exist if overlay is in popup window)
    const statTotal = document.getElementById('stat-total');
    if (!statTotal) return; // Overlay not on this page

    statTotal.textContent = rollStats.stats.totalRolls;
    document.getElementById('stat-average').textContent = rollStats.stats.averageRoll.toFixed(1);
    document.getElementById('stat-highest').textContent = rollStats.stats.highestRoll;
    document.getElementById('stat-lowest').textContent =
      rollStats.stats.lowestRoll === Infinity ? '∞' : rollStats.stats.lowestRoll;
    document.getElementById('stat-crits').textContent = rollStats.stats.criticalSuccesses;
    document.getElementById('stat-fails').textContent = rollStats.stats.criticalFailures;
  }

  /**
   * Adds roll to history
   */
  function addToRollHistory(rollData) {
    const advantageType = rollStats.settings.advantageMode;
    const criticalType = detectCritical(rollData);

    rollStats.history.unshift({
      ...rollData,
      advantageType,
      criticalType,
      timestamp: Date.now()
    });

    // Trim history
    if (rollStats.history.length > rollStats.settings.maxHistorySize) {
      rollStats.history = rollStats.history.slice(0, rollStats.settings.maxHistorySize);
    }

    updateRollHistoryDisplay();
    updateRollStatistics(rollData);
  }

  /**
   * Updates roll history display
   */
  function updateRollHistoryDisplay() {
    const historyList = document.getElementById('roll-history-list');
    if (!historyList) return;

    if (rollStats.history.length === 0) {
      historyList.innerHTML = '<div class="empty-state">No rolls yet. Make some rolls!</div>';
      return;
    }

    historyList.innerHTML = rollStats.history.map((roll, index) => {
      const timeAgo = getTimeAgo(roll.timestamp);
      const criticalClass = roll.criticalType || '';

      let badges = '';
      if (roll.criticalType) {
        badges += `<span class="history-badge ${roll.criticalType}">${roll.criticalType.replace('-', ' ')}</span>`;
      }
      if (roll.advantageType && roll.advantageType !== 'normal') {
        badges += `<span class="history-badge">${roll.advantageType}</span>`;
      }

      return `
        <div class="history-item ${criticalClass}" style="animation-delay: ${index * 0.05}s">
          <div class="history-item-header">
            <span class="history-name">${roll.name}</span>
            <span class="history-time">${timeAgo}</span>
          </div>
          <div class="history-formula">${roll.formula} = <strong>${roll.result}</strong></div>
          ${badges ? `<div class="history-badges">${badges}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Gets time ago string
   */
  function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  /**
   * Rolls in Dice Cloud and then forwards to Roll20
   */
  function rollSimultaneously(name, formula) {
    console.log(`🎲 Rolling ${name} with formula ${formula}...`);
    console.log('🔍 Debug: rollSimultaneously called');
    
    // Check advantage mode and modify formula for Roll20 syntax
    const advantageMode = rollStats.settings.advantageMode;
    let modifiedFormula = formula;
    
    if (advantageMode === 'advantage') {
      // Roll20 syntax for advantage: 2d20kh1 (keep highest)
      modifiedFormula = formula.replace(/^1d20/, '2d20kh1');
      console.log(`🎲 Advantage mode: ${formula} → ${modifiedFormula}`);
    } else if (advantageMode === 'disadvantage') {
      // Roll20 syntax for disadvantage: 2d20kl1 (keep lowest)
      modifiedFormula = formula.replace(/^1d20/, '2d20kl1');
      console.log(`🎲 Disadvantage mode: ${formula} → ${modifiedFormula}`);
    }
    
    // Check if we're in a popup window or in Roll20
    const isPopupWindow = window.opener !== null || window.location.hostname !== 'app.roll20.net';
    console.log(`🔍 Debug: isPopupWindow: ${isPopupWindow}, hostname: ${window.location.hostname}`);
    
    if (isPopupWindow) {
      // In popup window - use background script to coordinate with Dice Cloud
      console.log('📍 In popup window, using background script to roll in Dice Cloud');
      showNotification(`Rolling ${name} in Dice Cloud... 🎲`, 'info');
      
      // Send to background script to find Dice Cloud tab and roll there
      console.log('🔍 Debug: Sending message to background script');
      browserAPI.runtime.sendMessage({
        action: 'rollInDiceCloudAndForward',
        roll: {
          name: name,
          formula: modifiedFormula,
          originalFormula: formula,
          advantageMode: advantageMode,
          timestamp: Date.now()
        }
      }, (response) => {
        console.log('🔍 Debug: Background script response:', response);
        if (browserAPI.runtime.lastError) {
          console.error('❌ Background script error:', browserAPI.runtime.lastError);
          showNotification('Failed to roll in Dice Cloud. Is Dice Cloud open?', 'error');
        } else if (response && response.success) {
          console.log('✅ Roll initiated in Dice Cloud via background script');
          showNotification(`${name} roll initiated in Dice Cloud! 🎲`, 'success');
          
          // Also send message to Roll20 via opener window for immediate display
          if (window.opener && window.opener.postMessage) {
            window.opener.postMessage({
              action: 'postRollToChat',
              roll: {
                name: name,
                formula: modifiedFormula,
                originalFormula: formula,
                advantageMode: advantageMode,
                result: null, // Let Roll20 calculate the actual result
                timestamp: Date.now()
              }
            }, '*');
          }
        } else {
          console.error('❌ Failed to roll in Dice Cloud:', response?.error);
          showNotification('Failed to roll in Dice Cloud. Is Dice Cloud open?', 'error');
        }
      });
    } else {
      // In Roll20 - use background script to coordinate with Dice Cloud tab
      console.log('📍 In Roll20, using background script to roll in Dice Cloud');
      showNotification(`Rolling ${name} in Dice Cloud... 🎲`, 'info');
      
      // Send to background script to find Dice Cloud tab and roll there
      console.log('🔍 Debug: Sending message to background script from Roll20');
      browserAPI.runtime.sendMessage({
        action: 'rollInDiceCloudAndForward',
        roll: {
          name: name,
          formula: modifiedFormula,
          originalFormula: formula,
          advantageMode: advantageMode,
          timestamp: Date.now()
        }
      }, (response) => {
        console.log('🔍 Debug: Background script response from Roll20:', response);
        if (browserAPI.runtime.lastError) {
          console.error('❌ Background script error:', browserAPI.runtime.lastError);
          showNotification('Failed to roll in Dice Cloud. Is Dice Cloud open?', 'error');
        } else if (response && response.success) {
          console.log('✅ Roll initiated in Dice Cloud via background script');
          showNotification(`${name} roll initiated in Dice Cloud! 🎲`, 'success');
        } else {
          console.error('❌ Failed to roll in Dice Cloud:', response?.error);
          showNotification('Failed to roll in Dice Cloud. Is Dice Cloud open?', 'error');
        }
      });
    }
  }

  /**
   * Initiates a roll in Dice Cloud by finding and clicking the appropriate button
   */
  function rollInDiceCloud(name, formula) {
    return new Promise((resolve, reject) => {
      // Check if we're on Dice Cloud
      if (!window.location.hostname.includes('dicecloud.com')) {
        reject(new Error('Not on Dice Cloud'));
        return;
      }

      // Try to find the roll button in Dice Cloud
      // This is a simplified approach - you may need to adjust based on Dice Cloud's actual UI
      const rollButtons = document.querySelectorAll('[class*="roll"], [class*="dice"], button');
      let found = false;

      rollButtons.forEach(button => {
        const buttonText = button.textContent || button.innerText || '';
        if (buttonText.toLowerCase().includes(name.toLowerCase()) || 
            buttonText.toLowerCase().includes('roll')) {
          console.log('🎯 Found potential roll button:', buttonText);
          found = true;
          button.click();
          resolve();
        }
      });

      if (!found) {
        // Try to find by searching for the roll name in the page
        const allElements = document.querySelectorAll('*');
        for (let element of allElements) {
          const text = element.textContent || element.innerText || '';
          if (text.toLowerCase().includes(name.toLowerCase()) && 
              (element.tagName === 'BUTTON' || element.onclick)) {
            console.log('🎯 Found roll element by text:', text);
            element.click();
            resolve();
            return;
          }
        }
        
        reject(new Error('Could not find roll button in Dice Cloud'));
      }
    });
  }

  /**
   * Direct roll in Roll20 (fallback)
   */
  function rollInRoll20(name, formula) {
    const rollData = {
      name: name,
      formula: formula,
      result: Math.floor(Math.random() * 20) + 1, // Simple fallback
      timestamp: Date.now()
    };

    // Send to Roll20
    browserAPI.runtime.sendMessage({
      action: 'postRollToChat',
      roll: rollData
    }, (response) => {
      if (browserAPI.runtime.lastError) {
        console.error('❌ Error sending roll to Roll20:', browserAPI.runtime.lastError);
      } else {
        console.log('✅ Roll sent to Roll20 directly');
        showNotification(`${name} roll sent to Roll20! 🎲`, 'success');
      }
    });
  }

  /**
   * Posts a message to Roll20 chat (fallback for character sheet overlay)
   */
  function postChatMessage(message) {
    try {
      // Find the chat input textarea
      const chatInput = document.querySelector('#textchat-input textarea');
      if (chatInput) {
        chatInput.value = message;
        chatInput.focus();
        
        // Trigger the send button
        const sendButton = document.querySelector('#textchat-input .btn');
        if (sendButton) {
          sendButton.click();
          console.log('✅ Message posted to Roll20 chat:', message);
          return true;
        } else {
          console.error('❌ Could not find Roll20 chat send button');
          return false;
        }
      } else {
        console.error('❌ Could not find Roll20 chat input');
        return false;
      }
    } catch (error) {
      console.error('❌ Error posting to Roll20 chat:', error);
      return false;
    }
  }

  /**
   * Detects critical hits/misses
   */
  function detectCritical(rollData) {
    const result = parseInt(rollData.result);
    const formula = rollData.formula.toLowerCase();

    // Check for d20 rolls
    if (formula.includes('d20') || formula.includes('1d20')) {
      if (result === 20) return 'critical-success';
      if (result === 1) return 'critical-failure';
    }
    return null;
  }

  /**
   * Shows a notification message
   */
  function showNotification(message, type = 'info') {
    // Add animation styles if not already present
    if (!document.querySelector('#notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes slideOut {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(100%);
          }
        }
      `;
      document.head.appendChild(style);
    }

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#27AE60' : type === 'error' ? '#E74C3C' : '#4ECDC4'};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 100002;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Shows the overlay in a popup window instead of inline
   */
  function showOverlay() {
    // Load character data first
    browserAPI.runtime.sendMessage({ action: 'getCharacterData' }, (response) => {
      if (browserAPI.runtime.lastError) {
        console.error('❌ Extension context error:', browserAPI.runtime.lastError);
        showNotification('Extension context error. Please refresh the page.', 'error');
        return;
      }

      if (response && response.data) {
        console.log('✅ Character data loaded for popup:', response.data.name);

        // Get the popup HTML file URL
        const popupURL = browserAPI.runtime.getURL('src/popup-sheet.html');

        let messageSent = false;
        let popupWindow = null;

        // Set up message listener BEFORE opening the window to avoid race condition
        const messageHandler = (event) => {
          if (event.data && event.data.action === 'popupReady' && popupWindow && !messageSent) {
            console.log('✅ Popup is ready, sending character data...');
            messageSent = true;
            try {
              popupWindow.postMessage({
                action: 'initCharacterSheet',
                data: response.data
              }, '*');
              console.log('✅ Character data sent to popup via postMessage');
            } catch (error) {
              console.warn('⚠️ Could not send message to popup (Firefox security):', error.message);
              // The popup will use storage fallback if postMessage fails
            }
            // Clean up listener after a delay
            setTimeout(() => {
              window.removeEventListener('message', messageHandler);
            }, 1000);
          }
        };
        window.addEventListener('message', messageHandler);

        // Now open the popup window
        popupWindow = window.open(popupURL, 'rollcloud-character-sheet', 'width=900,height=700,scrollbars=yes,resizable=yes,menubar=no,toolbar=no,location=no,status=no');

        if (!popupWindow) {
          console.error('❌ Failed to open popup window. Please allow popups for this site.');
          showNotification('Failed to open popup window. Please allow popups for this site.', 'error');
          window.removeEventListener('message', messageHandler);
          return;
        }

        // Fallback: Send data after a delay if popup hasn't sent ready message
        // This handles cases where the popup loads faster than expected
        setTimeout(() => {
          if (!messageSent && popupWindow) {
            try {
              // Firefox can throw "dead object" error even when accessing .closed property
              if (!popupWindow.closed) {
                console.log('⏱️ Fallback: Sending character data after timeout...');
                messageSent = true;
                popupWindow.postMessage({
                  action: 'initCharacterSheet',
                  data: response.data
                }, '*');
                console.log('✅ Character data sent via fallback');
              }
            } catch (error) {
              console.warn('⚠️ Could not send fallback message to popup (Firefox security):', error.message);
              // The popup will load data from storage if postMessage fails
            }
          }
        }, 500);

        overlayVisible = true;
        showNotification('Character sheet opened! 🎲', 'success');
        console.log('✅ Popup window opened successfully');

      } else {
        console.log('📋 No character data found');
        showNotification('No character data found. Please sync from Dice Cloud first.', 'error');
      }
    });
  }

  /**
   * Hides the overlay
   */
  function hideOverlay() {
    if (overlayElement) {
      overlayElement.style.display = 'none';
    }
    overlayVisible = false;
  }

  /**
   * Announces a message to Roll20 chat
   */
  function announceToRoll20(message) {
    try {
      const chatInput = document.querySelector('#textchat-input textarea');
      if (chatInput) {
        chatInput.value = message;
        chatInput.focus();

        const sendButton = document.querySelector('#textchat-input .btn');
        if (sendButton) {
          sendButton.click();
          console.log('✅ Message posted to Roll20 chat:', message);
          showNotification('Spell announced to chat!', 'success');
          return true;
        } else {
          console.error('❌ Could not find Roll20 chat send button');
          return false;
        }
      } else {
        console.error('❌ Could not find Roll20 chat input');
        return false;
      }
    } catch (error) {
      console.error('❌ Error posting to Roll20 chat:', error);
      return false;
    }
  }

  // Listen for messages from popout window
  window.addEventListener('message', (event) => {
    if (event.data.action === 'rollFromPopout') {
      console.log('🎲 Received roll from popout:', event.data);

      // Handle the roll from popout
      rollSimultaneously(event.data.name, event.data.formula);
    } else if (event.data.action === 'updateCharacterData') {
      console.log('💾 Received character data update from popup:', event.data.data);

      // Save updated character data to storage
      browserAPI.runtime.sendMessage({
        action: 'storeCharacterData',
        data: event.data.data
      }, (response) => {
        if (response && response.success) {
          console.log('✅ Character data updated successfully');
        } else {
          console.error('❌ Failed to update character data');
        }
      });
    } else if (event.data.action === 'announceSpell') {
      console.log('✨ Announcing spell cast:', event.data);

      // Announce to Roll20 chat
      announceToRoll20(event.data.message);
    }
  });

  // Listen for messages from background script
  /**
   * Makes a button draggable and adds hide/show functionality
   */
  function makeButtonDraggable(button, storageKey) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    // Load saved position
    const savedPosition = localStorage.getItem(`${storageKey}_position`);
    if (savedPosition) {
      const { left, top } = JSON.parse(savedPosition);
      button.style.left = left;
      button.style.top = top;
      button.style.transform = 'none'; // Remove centering transform when positioned
    }

    // Load saved visibility
    const savedVisibility = localStorage.getItem(`${storageKey}_hidden`);
    if (savedVisibility === 'true') {
      button.style.display = 'none';
    }

    button.addEventListener('mousedown', (e) => {
      // Only start dragging on left click
      if (e.button === 0) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = button.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        button.style.cursor = 'grabbing';
        button.style.transform = 'none'; // Remove any transform during drag
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        const newLeft = initialLeft + deltaX;
        const newTop = initialTop + deltaY;

        button.style.left = `${newLeft}px`;
        button.style.top = `${newTop}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        button.style.cursor = 'pointer';

        // Save position
        localStorage.setItem(`${storageKey}_position`, JSON.stringify({
          left: button.style.left,
          top: button.style.top
        }));
      }
    });

    // Right-click context menu
    button.addEventListener('contextmenu', (e) => {
      e.preventDefault();

      // Create context menu
      const existingMenu = document.getElementById('rollcloud-context-menu');
      if (existingMenu) existingMenu.remove();

      const menu = document.createElement('div');
      menu.id = 'rollcloud-context-menu';
      menu.style.cssText = `
        position: fixed;
        left: ${e.clientX}px;
        top: ${e.clientY}px;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 1000000;
        padding: 5px 0;
      `;

      const hideOption = document.createElement('div');
      hideOption.textContent = '🙈 Hide Button';
      hideOption.style.cssText = `
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
      `;
      hideOption.addEventListener('mouseenter', () => {
        hideOption.style.background = '#f0f0f0';
      });
      hideOption.addEventListener('mouseleave', () => {
        hideOption.style.background = 'white';
      });
      hideOption.addEventListener('click', () => {
        button.style.display = 'none';
        localStorage.setItem(`${storageKey}_hidden`, 'true');
        menu.remove();
        showNotification('Button hidden. Use extension popup to show it again.', 'info');
      });

      const resetOption = document.createElement('div');
      resetOption.textContent = '🔄 Reset Position';
      resetOption.style.cssText = `
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
        border-top: 1px solid #eee;
      `;
      resetOption.addEventListener('mouseenter', () => {
        resetOption.style.background = '#f0f0f0';
      });
      resetOption.addEventListener('mouseleave', () => {
        resetOption.style.background = 'white';
      });
      resetOption.addEventListener('click', () => {
        localStorage.removeItem(`${storageKey}_position`);
        if (storageKey === 'rollcloud-sheet-toggle') {
          button.style.left = '50%';
          button.style.top = '20px';
          button.style.transform = 'translateX(-50%)';
        } else {
          button.style.left = '20px';
          button.style.top = 'auto';
          button.style.bottom = '20px';
        }
        menu.remove();
        showNotification('Button position reset', 'success');
      });

      menu.appendChild(hideOption);
      menu.appendChild(resetOption);
      document.body.appendChild(menu);

      // Close menu when clicking outside
      setTimeout(() => {
        document.addEventListener('click', () => {
          menu.remove();
        }, { once: true });
      }, 0);
    });
  }

  /**
   * Creates the toggle button for opening the character sheet
   */
  function createToggleButton() {
    // Check if button already exists
    if (document.getElementById('rollcloud-sheet-toggle')) {
      console.log('⚠️ Character sheet button already exists');
      return;
    }

    const button = document.createElement('button');
    button.id = 'rollcloud-sheet-toggle';
    button.innerHTML = '📋 Character Sheet';
    button.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 4px 15px rgba(78, 205, 196, 0.2);
      z-index: 999998;
      transition: transform 0.2s, box-shadow 0.2s;
      user-select: none;
    `;

    // Hover effects
    button.addEventListener('mouseenter', () => {
      if (!button.style.left || button.style.left === '50%') {
        button.style.transform = 'translateX(-50%) translateY(-2px)';
      }
      button.style.boxShadow = '0 6px 20px rgba(78, 205, 196, 0.3)';
    });

    button.addEventListener('mouseleave', () => {
      if (!button.style.left || button.style.left === '50%') {
        button.style.transform = 'translateX(-50%) translateY(0)';
      }
      button.style.boxShadow = '0 4px 15px rgba(78, 205, 196, 0.2)';
    });

    // Click to open popup
    button.addEventListener('click', () => {
      showOverlay();
    });

    document.body.appendChild(button);

    // Make it draggable and add hide/show functionality
    makeButtonDraggable(button, 'rollcloud-sheet-toggle');

    console.log('✅ Character sheet button created');
  }

  // Listen for messages from background script
  browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'postRollToChat') {
      // Handle roll from DiceCloud
      if (request.roll) {
        console.log('🎲 Received roll in overlay:', request.roll);

        // Only add to history if it's an actual roll (has a formula)
        // Announcements like spells/actions don't have formulas
        if (request.roll.formula) {
          addToRollHistory(request.roll);
        }

        // Show notification
        showNotification(`Roll received: ${request.roll.name || 'dice roll'}`, 'success');

        // Update overlay if visible
        if (overlayVisible) {
          updateRollHistoryDisplay();
          updateStatsDisplay();
        }
      }
      sendResponse({ success: true });
    } else if (request.action === 'showCharacterSheetButton') {
      // Show the character sheet button
      const button = document.getElementById('rollcloud-sheet-toggle');
      if (button) {
        button.style.display = '';
        localStorage.removeItem('rollcloud-sheet-toggle_hidden');
        showNotification('Character Sheet button shown', 'success');
      }
      sendResponse({ success: true });
    }
    return true;
  });

  // Initialize - wait for page to be fully loaded
  function initializeButton() {
    if (document.body) {
      createToggleButton();
      console.log('✅ RollCloud character sheet toggle button added');
    } else {
      console.log('⏳ Waiting for document.body...');
      setTimeout(initializeButton, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeButton, 1000);
    });
  } else {
    setTimeout(initializeButton, 1000);
  }

  console.log('✅ RollCloud character sheet overlay script loaded');

})();
   