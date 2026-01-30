/**
 * Companions Manager Module
 *
 * Handles companion/familiar display and interaction.
 * - Displays companion stats, abilities, and actions
 * - Provides attack and damage roll buttons for companion actions
 *
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 */

(function() {
  'use strict';

  /**
   * Build and display companions list
   * @param {Array} companions - Array of companion objects
   */
  function buildCompanionsDisplay(companions) {
    const container = document.getElementById('companions-container');
    const section = document.getElementById('companions-section');

    // Show the companions section
    section.style.display = 'block';

    container.innerHTML = '';

    companions.forEach(companion => {
      debug.log('🔍 DEBUG: Companion object in popup:', companion);
      debug.log('🔍 DEBUG: Companion abilities:', companion.abilities);
      debug.log('🔍 DEBUG: Companion abilities keys:', Object.keys(companion.abilities));

      const companionCard = document.createElement('div');
      companionCard.className = 'action-card';
      companionCard.style.background = 'var(--bg-card)';
      companionCard.style.borderColor = 'var(--border-card)';

      // Header with name and basic info
      const header = document.createElement('div');
      header.className = 'action-header';
      header.style.cursor = 'pointer';

      const nameDiv = document.createElement('div');
      nameDiv.innerHTML = `
        <div class="action-name">🐾 ${companion.name}</div>
        <div style="font-size: 0.85em; color: var(--text-secondary); font-style: italic;">
          ${companion.size} ${companion.type}${companion.alignment ? ', ' + companion.alignment : ''}
        </div>
      `;

      header.appendChild(nameDiv);
      companionCard.appendChild(header);

      // Stats block
      const statsDiv = document.createElement('div');
      statsDiv.className = 'action-description expanded';
      statsDiv.style.display = 'block';
      statsDiv.style.background = 'var(--bg-secondary)';
      statsDiv.style.padding = '12px';
      statsDiv.style.borderRadius = '4px';
      statsDiv.style.marginTop = '10px';

      let statsHTML = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px;">';

      // AC, HP, Speed
      if (companion.ac) statsHTML += `<div><strong>AC:</strong> ${companion.ac}</div>`;
      if (companion.hp) statsHTML += `<div><strong>HP:</strong> ${companion.hp}</div>`;
      if (companion.speed) statsHTML += `<div style="grid-column: span 3;"><strong>Speed:</strong> ${companion.speed}</div>`;

      statsHTML += '</div>';

      // Abilities
      if (Object.keys(companion.abilities).length > 0) {
        statsHTML += '<div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; text-align: center; margin: 10px 0; padding: 8px; background: var(--bg-tertiary); border-radius: 4px;">';
        ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
          if (companion.abilities[ability]) {
            const abil = companion.abilities[ability];
            statsHTML += `
              <div>
                <div style="font-weight: bold; font-size: 0.75em; color: var(--text-secondary);">${ability.toUpperCase()}</div>
                <div style="font-size: 1.1em; color: var(--text-primary);">${abil.score}</div>
                <div style="font-size: 0.9em; color: var(--accent-success);">(${abil.modifier >= 0 ? '+' : ''}${abil.modifier})</div>
              </div>
            `;
          }
        });
        statsHTML += '</div>';
      }

      // Senses, Languages, PB
      if (companion.senses) statsHTML += `<div style="margin: 5px 0; color: var(--text-primary);"><strong>Senses:</strong> ${companion.senses}</div>`;
      if (companion.languages) statsHTML += `<div style="margin: 5px 0; color: var(--text-primary);"><strong>Languages:</strong> ${companion.languages}</div>`;
      if (companion.proficiencyBonus) statsHTML += `<div style="margin: 5px 0; color: var(--text-primary);"><strong>Proficiency Bonus:</strong> +${companion.proficiencyBonus}</div>`;

      // Features
      if (companion.features && companion.features.length > 0) {
        statsHTML += '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">';
        companion.features.forEach(feature => {
          statsHTML += `<div style="margin: 8px 0; color: var(--text-primary);"><strong>${feature.name}.</strong> ${feature.description}</div>`;
        });
        statsHTML += '</div>';
      }

      // Actions with attack buttons
      if (companion.actions && companion.actions.length > 0) {
        statsHTML += '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color); color: var(--text-primary);"><strong>Actions</strong></div>';
        companion.actions.forEach(action => {
          statsHTML += `
            <div style="margin: 10px 0; padding: 8px; background: var(--bg-action); border: 1px solid var(--accent-danger); border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="color: var(--text-primary);">
                  <strong>${action.name}.</strong> Melee Weapon Attack: +${action.attackBonus} to hit, ${action.reach}. <em>Hit:</em> ${action.damage}
                </div>
                <div style="display: flex; gap: 8px;">
                  <button class="attack-btn companion-attack-btn" data-name="${companion.name} - ${action.name}" data-bonus="${action.attackBonus}">⚔️ Attack</button>
                  <button class="damage-btn companion-damage-btn" data-name="${companion.name} - ${action.name}" data-damage="${action.damage}">💥 Damage</button>
                </div>
              </div>
            </div>
          `;
        });
      }

      statsDiv.innerHTML = statsHTML;
      companionCard.appendChild(statsDiv);

      // Add event listeners for attack/damage buttons
      companionCard.querySelectorAll('.companion-attack-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const name = btn.dataset.name;
          const bonus = parseInt(btn.dataset.bonus);

          // Announce companion attack
          const announcement = `&{template:default} {{name=${getColoredBanner(characterData)}${characterData.name}'s ${name} attacks!}} {{Type=Companion Attack}}`;
          const messageData = {
            action: 'announceSpell',
            message: announcement,
            color: characterData.notificationColor
          };

          if (window.opener && !window.opener.closed) {
            try {
              window.opener.postMessage(messageData, '*');
            } catch (error) {
              debug.log('❌ Failed to send companion attack announcement:', error);
            }
          }

          roll(`${name} - Attack`, `1d20+${bonus}`);
        });
      });

      companionCard.querySelectorAll('.companion-damage-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const name = btn.dataset.name;
          const damage = btn.dataset.damage;

          // Announce companion damage
          const announcement = `&{template:default} {{name=${getColoredBanner(characterData)}${characterData.name}'s ${name} deals damage!}} {{Type=Companion Damage}}`;
          const messageData = {
            action: 'announceSpell',
            message: announcement,
            color: characterData.notificationColor
          };

          if (window.opener && !window.opener.closed) {
            try {
              window.opener.postMessage(messageData, '*');
            } catch (error) {
              debug.log('❌ Failed to send companion damage announcement:', error);
            }
          }

          roll(`${name} - Damage`, damage);
        });
      });

      container.appendChild(companionCard);
    });
  }

  // Export function to globalThis
  Object.assign(globalThis, {
    buildCompanionsDisplay
  });

  console.log('✅ Companions Manager module loaded');

})();
