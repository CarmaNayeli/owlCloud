/**
 * Spell Modals Module
 *
 * Handles modal dialogs for spell casting interactions.
 * - Main spell casting modal with options
 * - Upcast selection modal
 * - Resource choice modal
 * - Option click handlers
 *
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 */

(function() {
  'use strict';

  /**
   * Show spell casting modal with options
   * @param {object} spell - Spell object
   * @param {number} spellIndex - Spell index
   * @param {Array} options - Array of spell options
   * @param {boolean} descriptionAnnounced - Whether spell description was already announced
   */
  function showSpellModal(spell, spellIndex, options, descriptionAnnounced = false) {
    // Get theme-aware colors
    const colors = getPopupThemeColors();

    // Check for custom macros
    const customMacros = getCustomMacros(spell.name);
    const hasCustomMacros = customMacros && customMacros.buttons && customMacros.buttons.length > 0;

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'spell-modal-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'spell-modal';
    modal.style.cssText = `background: ${colors.background}; padding: 24px; border-radius: 8px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);`;

    // Modal header
    const header = document.createElement('div');
    header.style.cssText = `margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid ${colors.border};`;

    // Format spell level text
    let levelText = '';
    if (spell.level === 0) {
      levelText = `<div style="color: ${colors.infoText}; font-size: 14px;">Cantrip</div>`;
    } else if (spell.level) {
      levelText = `<div style="color: ${colors.infoText}; font-size: 14px;">Level ${spell.level} Spell</div>`;
    }

    header.innerHTML = `
      <h2 style="margin: 0 0 8px 0; color: ${colors.heading};">Cast ${spell.name}</h2>
      ${levelText}
    `;

    modal.appendChild(header);

    // Slot selection (for leveled spells)
    let slotSelect = null;
    if (spell.level && spell.level > 0) {
      const slotSection = document.createElement('div');
      slotSection.style.cssText = `margin-bottom: 16px; padding: 12px; background: ${colors.infoBox}; border-radius: 6px;`;

      const slotLabel = document.createElement('label');
      slotLabel.style.cssText = `display: block; margin-bottom: 8px; font-weight: bold; color: ${colors.text};`;
      slotLabel.textContent = 'Cast at level:';

      slotSelect = document.createElement('select');
      slotSelect.style.cssText = `width: 100%; padding: 8px; border: 2px solid ${colors.border}; border-radius: 4px; font-size: 14px; background: ${colors.background}; color: ${colors.text};`;

      // Check for Pact Magic slots (Warlock) - these are SEPARATE from regular spell slots
      // Check both spellSlots and otherVariables since data may come from either source
      // DiceCloud uses various variable names: pactSlot, pactMagicSlots, pactSlotLevelVisible, etc.
      const pactMagicSlotLevel = characterData.spellSlots?.pactMagicSlotLevel ||
                                 characterData.otherVariables?.pactMagicSlotLevel ||
                                 characterData.otherVariables?.pactSlotLevelVisible ||
                                 characterData.otherVariables?.pactSlotLevel ||
                                 characterData.otherVariables?.slotLevel;
      const pactMagicSlots = characterData.spellSlots?.pactMagicSlots ??
                             characterData.otherVariables?.pactMagicSlots ??
                             characterData.otherVariables?.pactSlot ?? 0;
      const pactMagicSlotsMax = characterData.spellSlots?.pactMagicSlotsMax ??
                                characterData.otherVariables?.pactMagicSlotsMax ??
                                characterData.otherVariables?.pactSlotMax ?? 0;
      const hasPactMagic = pactMagicSlotsMax > 0;
      // Default slot level to 1 if we have slots but couldn't detect level
      const effectivePactLevel = pactMagicSlotLevel || (hasPactMagic ? 5 : 0); // Default to max (5) if level unknown

      debug.log(`🔮 Pact Magic check: level=${pactMagicSlotLevel} (effective=${effectivePactLevel}), slots=${pactMagicSlots}/${pactMagicSlotsMax}, hasPact=${hasPactMagic}`);

      // Add options for available spell slots (spell level and higher)
      let hasAnySlots = false;
      let hasRegularSlots = false;
      let firstValidOption = null;

      // First, add Pact Magic slots if available and spell level is compatible
      // Pact Magic slots can cast any spell from level 1 up to the pact slot level
      if (hasPactMagic && spell.level <= effectivePactLevel) {
        hasAnySlots = true;
        const option = document.createElement('option');
        option.value = `pact:${effectivePactLevel}`; // Special format to identify pact slots
        option.textContent = `Level ${effectivePactLevel} - Pact Magic (${pactMagicSlots}/${pactMagicSlotsMax})`;
        option.disabled = pactMagicSlots === 0;
        slotSelect.appendChild(option);
        if (!option.disabled && !firstValidOption) {
          firstValidOption = option;
        }
        debug.log(`🔮 Added Pact Magic slot option: Level ${effectivePactLevel} (${pactMagicSlots}/${pactMagicSlotsMax})`);
      }

      // Then add regular spell slots (excluding the pact magic level to avoid duplicates)
      for (let level = spell.level; level <= 9; level++) {
        const slotsProp = `level${level}SpellSlots`;
        const maxSlotsProp = `level${level}SpellSlotsMax`;
        let available = characterData.spellSlots?.[slotsProp] || characterData[slotsProp] || 0;
        let max = characterData.spellSlots?.[maxSlotsProp] || characterData[maxSlotsProp] || 0;

        // If this level has Pact Magic, subtract pact slots from the total (they're counted separately)
        if (hasPactMagic && level === effectivePactLevel) {
          available = Math.max(0, available - pactMagicSlots);
          max = Math.max(0, max - pactMagicSlotsMax);
        }

        if (max > 0) {
          hasAnySlots = true;
          hasRegularSlots = true;
          const option = document.createElement('option');
          option.value = level; // Regular level number for normal slots
          option.textContent = `Level ${level} (${available}/${max} slots)`;
          option.disabled = available === 0;
          slotSelect.appendChild(option);
          if (!option.disabled && !firstValidOption) {
            firstValidOption = option;
          }
        }
      }

      // Select the first valid (non-disabled) option
      if (firstValidOption) {
        firstValidOption.selected = true;
      }

      // If no slots available at all, show a message
      if (!hasAnySlots) {
        const noSlotsOption = document.createElement('option');
        noSlotsOption.value = spell.level;
        noSlotsOption.textContent = 'No spell slots available';
        noSlotsOption.disabled = true;
        noSlotsOption.selected = true;
        slotSelect.appendChild(noSlotsOption);
      }

      // If ONLY Pact Magic slots exist (no regular spell slots), don't show the dropdown
      // Instead, automatically use the Pact Magic slot level
      if (hasPactMagic && !hasRegularSlots && spell.level <= effectivePactLevel) {
        // Store the auto-selected Pact Magic level on the modal for button handlers to use
        modal.dataset.autoSlotLevel = `pact:${effectivePactLevel}`;
        debug.log(`🔮 Auto-selecting Pact Magic level ${effectivePactLevel} (no regular slots available)`);
        // Don't append the slot selection UI - it's not needed
      } else {
        // Show the dropdown since there are multiple slot options
        slotSection.appendChild(slotLabel);
        slotSection.appendChild(slotSelect);
        modal.appendChild(slotSection);

        // Store reference to update button labels later
        // (will be set after buttons are created)
        slotSelect.updateButtonLabels = null;
      }
    }

    // Concentration spell recast option OR special spells that allow reuse without slots
    // (if already concentrating on this spell, or for spells like Spiritual Weapon, Meld into Stone)
    // NOTE: Cantrips (level 0) never use slots, so don't show this checkbox for them
    let skipSlotCheckbox = null;
    const isCantrip = spell.level === 0;
    const isConcentrationRecast = spell.concentration && concentratingSpell === spell.name;

    // Spells that allow repeated use without consuming slots (non-concentration)
    // Exclude cantrips since they never use slots anyway
    const isReuseableSpellType = !isCantrip && isReuseableSpell(spell.name, characterData);

    // Check if this spell was already cast (stored in localStorage or session)
    const castSpellsKey = `castSpells_${characterData.name}`;
    const castSpells = JSON.parse(localStorage.getItem(castSpellsKey) || '[]');
    const wasAlreadyCast = castSpells.includes(spell.name);

    // Show checkbox for concentration recasts OR for all reuseable spells (even on first cast)
    // But NOT for cantrips since they never consume slots
    if (!isCantrip && (isConcentrationRecast || isReuseableSpellType)) {
      const recastSection = document.createElement('div');
      recastSection.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #fff3cd; border-radius: 6px; border: 2px solid #f39c12;';

      const checkboxContainer = document.createElement('label');
      checkboxContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer;';

      skipSlotCheckbox = document.createElement('input');
      skipSlotCheckbox.type = 'checkbox';
      // Default checked if concentration recast OR if reuseable spell was already cast
      skipSlotCheckbox.checked = isConcentrationRecast || wasAlreadyCast;
      skipSlotCheckbox.style.cssText = 'width: 20px; height: 20px;';

      const checkboxLabel = document.createElement('span');
      checkboxLabel.style.cssText = 'font-weight: bold; color: #856404;';
      if (isConcentrationRecast) {
        checkboxLabel.textContent = '🧠 Already concentrating - don\'t consume spell slot';
      } else if (wasAlreadyCast) {
        checkboxLabel.textContent = '⚔️ Spell already active - don\'t consume spell slot';
      } else {
        checkboxLabel.textContent = '⚔️ Reuse spell effect without consuming slot (first cast required)';
      }

      checkboxContainer.appendChild(skipSlotCheckbox);
      checkboxContainer.appendChild(checkboxLabel);
      recastSection.appendChild(checkboxContainer);

      const helpText = document.createElement('div');
      helpText.style.cssText = 'font-size: 0.85em; color: #856404; margin-top: 6px; margin-left: 28px;';
      if (isConcentrationRecast) {
        helpText.textContent = 'You can use this spell\'s effect again while concentrating on it without recasting.';
      } else {
        helpText.textContent = 'You can use this spell\'s effect again while it\'s active without recasting.';
      }
      recastSection.appendChild(helpText);

      modal.appendChild(recastSection);

      // If skip slot is checked, disable slot selection
      skipSlotCheckbox.addEventListener('change', () => {
        if (slotSelect) {
          slotSelect.disabled = skipSlotCheckbox.checked;
          slotSelect.style.opacity = skipSlotCheckbox.checked ? '0.5' : '1';
        }
      });

      // Initialize disabled state
      if (slotSelect && skipSlotCheckbox.checked) {
        slotSelect.disabled = true;
        slotSelect.style.opacity = '0.5';
      }
    }

    // Metamagic options (if character has metamagic features)
    // Only the 8 official Sorcerer metamagic options from PHB
    const metamagicCheckboxes = [];
    const validMetamagicNames = [
      'Careful Spell',
      'Distant Spell',
      'Empowered Spell',
      'Extended Spell',
      'Heightened Spell',
      'Quickened Spell',
      'Subtle Spell',
      'Twinned Spell'
    ];
    const metamagicFeatures = characterData.features ? characterData.features.filter(f =>
      f.name && validMetamagicNames.includes(f.name)
    ) : [];

    if (metamagicFeatures.length > 0) {
      const metamagicSection = document.createElement('div');
      metamagicSection.style.cssText = `margin-bottom: 16px; padding: 12px; background: ${colors.infoBox}; border-radius: 6px; border: 1px solid ${colors.border};`;

      const metamagicTitle = document.createElement('div');
      metamagicTitle.style.cssText = `font-weight: bold; margin-bottom: 8px; color: ${colors.text};`;
      metamagicTitle.textContent = 'Metamagic:';
      metamagicSection.appendChild(metamagicTitle);

      metamagicFeatures.forEach(feature => {
        const checkboxContainer = document.createElement('label');
        checkboxContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 4px; cursor: pointer;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = feature.name;
        checkbox.style.cssText = 'width: 18px; height: 18px;';

        const label = document.createElement('span');
        label.textContent = feature.name;
        label.style.cssText = `font-size: 14px; color: ${colors.infoText};`;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        metamagicSection.appendChild(checkboxContainer);

        metamagicCheckboxes.push(checkbox);
      });

      modal.appendChild(metamagicSection);
    }

    // Track whether spell has been cast (for attack spells)
    let spellCast = false;
    let usedSlot = null;

    // Check if spell has both attack and damage options
    const hasAttack = options.some(opt => opt.type === 'attack');
    const hasDamage = options.some(opt => opt.type === 'damage' || opt.type === 'healing');

    // Options container (spell action buttons)
    const optionsContainer = document.createElement('div');
    optionsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    // Helper function to get resolved label for an option based on slot level
    function getResolvedLabel(option, selectedSlotLevel) {
      if (option.type === 'attack') {
        return option.label; // Attack doesn't change with slot level
      }

      // Get the formula for this option
      let formula = option.type === 'lifesteal' ? option.damageFormula : option.formula;
      debug.log(`🏷️ getResolvedLabel called with formula: "${formula}", slotLevel: ${selectedSlotLevel}`);

      // Replace slotLevel with actual slot level (check for null/undefined, but allow 0)
      // Use case-insensitive regex to handle slotLevel, slotlevel, SlotLevel, etc.
      if (selectedSlotLevel != null && formula && /slotlevel/i.test(formula)) {
        const originalFormula = formula;
        formula = formula.replace(/slotlevel/gi, String(selectedSlotLevel));
        debug.log(`  ✅ Replaced slotLevel: "${originalFormula}" -> "${formula}"`);
      }

      // Replace ~target.level with character level
      if (formula && formula.includes('~target.level') && characterData.level) {
        formula = formula.replace(/~target\.level/g, characterData.level);
      }

      // Resolve variables and evaluate math
      formula = resolveVariablesInFormula(formula);
      formula = evaluateMathInFormula(formula);
      debug.log(`  📊 Final resolved formula: "${formula}"`);

      // Build label based on option type
      if (option.type === 'lifesteal') {
        let damageTypeLabel = '';
        if (option.damageType && option.damageType !== 'untyped') {
          damageTypeLabel = option.damageType.charAt(0).toUpperCase() + option.damageType.slice(1);
        }
        return `${formula} ${damageTypeLabel} + Heal (${option.healingRatio})`;
      } else if (option.type === 'damage' || option.type === 'healing' || option.type === 'temphp') {
        let damageTypeLabel = '';
        if (option.damageType && option.damageType !== 'untyped') {
          damageTypeLabel = option.damageType.charAt(0).toUpperCase() + option.damageType.slice(1);
        }
        return damageTypeLabel ? `${formula} ${damageTypeLabel}` : formula;
      }

      return option.label;
    }

    // Add buttons for each option
    const optionButtons = []; // Store buttons so we can update them when slot changes

    // Add custom macro buttons if configured
    if (hasCustomMacros) {
      customMacros.buttons.forEach((customBtn, index) => {
        const btn = document.createElement('button');
        btn.className = 'spell-custom-macro-btn';
        btn.style.cssText = `
          padding: 12px 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          font-size: 16px;
          text-align: left;
          transition: opacity 0.2s, transform 0.2s;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        `;
        btn.innerHTML = customBtn.label;

        btn.addEventListener('mouseenter', () => {
          btn.style.opacity = '0.9';
          btn.style.transform = 'translateY(-2px)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.opacity = '1';
          btn.style.transform = 'translateY(0)';
        });

        btn.addEventListener('click', () => {
          // Send custom macro to chat
          const colorBanner = getColoredBanner(characterData);
          const message = customBtn.macro;

          const messageData = {
            action: 'announceSpell',
            message: message,
            color: characterData.notificationColor
          };

          if (window.opener && !window.opener.closed) {
            try {
              window.opener.postMessage(messageData, '*');
              debug.log('✅ Custom macro sent via window.opener');
            } catch (error) {
              debug.warn('⚠️ Could not send via window.opener:', error.message);
            }
          } else {
            browserAPI.runtime.sendMessage({
              action: 'relayRollToRoll20',
              roll: messageData
            });
          }

          showNotification(`✨ ${spell.name} - Custom Macro Sent!`, 'success');
          document.body.removeChild(overlay);
        });

        optionsContainer.appendChild(btn);
      });

      // If skipNormalButtons is true, don't add normal spell option buttons
      if (customMacros.skipNormalButtons) {
        debug.log(`⚙️ Skipping normal spell buttons for "${spell.name}" (custom macros only)`);
        // Skip the normal options.forEach below
        options = [];
      }
    }

    options.forEach(option => {
      const btn = document.createElement('button');
      btn.className = `spell-option-btn-${option.type}`;

      // Special styling for lifesteal buttons to make them more visually distinct
      const isLifesteal = option.type === 'lifesteal';
      const boxShadow = isLifesteal ? 'box-shadow: 0 4px 8px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.2);' : '';
      const border = isLifesteal ? 'border: 2px solid rgba(255,255,255,0.3);' : 'border: none;';

      btn.style.cssText = `
        padding: 12px 16px;
        background: ${option.color};
        color: white;
        ${border}
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        font-size: 16px;
        text-align: left;
        transition: opacity 0.2s, transform 0.2s;
        ${boxShadow}
      `;

      // Set initial label (with default slot level)
      const initialSlotLevel = spell.level || null;
      const resolvedLabel = getResolvedLabel(option, initialSlotLevel);
      const edgeCaseNote = option.edgeCaseNote ? `<div style="font-size: 0.8em; color: #666; margin-top: 2px;">${option.edgeCaseNote}</div>` : '';
      btn.innerHTML = `${option.icon} ${resolvedLabel}${edgeCaseNote}`;
      btn.dataset.optionIndex = optionButtons.length; // Store index for later updates

      btn.addEventListener('mouseenter', () => {
        btn.style.opacity = '0.9';
        if (isLifesteal) btn.style.transform = 'translateY(-2px)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.opacity = '1';
        if (isLifesteal) btn.style.transform = 'translateY(0)';
      });

      optionButtons.push({ button: btn, option: option });

      btn.addEventListener('click', () => {
        // Get selected slot level - keep in "pact:X" format for castSpell to detect Pact Magic
        let selectedSlotLevel = spell.level || null;

        // Check if slot level was auto-selected (Pact Magic only, no dropdown shown)
        if (modal.dataset.autoSlotLevel) {
          selectedSlotLevel = modal.dataset.autoSlotLevel; // Keep as "pact:X" string
        } else if (slotSelect) {
          selectedSlotLevel = slotSelect.value; // Keep as "pact:X" string or regular level number
        }

        // Get selected metamagic options
        const selectedMetamagic = metamagicCheckboxes
          .filter(cb => cb.checked)
          .map(cb => cb.value);

        // Check if we should skip slot consumption (concentration recast)
        const skipSlot = skipSlotCheckbox ? skipSlotCheckbox.checked : false;

        if (option.type === 'cast') {
          // Cast spell only (for spells with conditional damage like Meld into Stone)
          // Announce description only if not already announced AND not using concentration recast
          if (!descriptionAnnounced && !skipSlot) {
            announceSpellDescription(spell, selectedSlotLevel);
          }

          const afterCast = (spell, slot) => {
            usedSlot = slot;
            showNotification(`✨ ${spell.name} cast successfully!`, 'success');
          };
          // Description announced (if needed), don't announce again in castSpell
          castSpell(spell, spellIndex, afterCast, selectedSlotLevel, selectedMetamagic, skipSlot, true);
          spellCast = true;

          // Disable cast button after casting
          btn.disabled = true;
          btn.style.opacity = '0.5';
          btn.style.cursor = 'not-allowed';

          // Don't close modal - allow rolling damage if needed

        } else if (option.type === 'attack') {
          // Cast spell + roll attack, but keep modal open
          // Announce description only if not already announced AND not using concentration recast
          if (!descriptionAnnounced && !skipSlot) {
            announceSpellDescription(spell, selectedSlotLevel);
          }

          const afterCast = (spell, slot) => {
            usedSlot = slot;
            const attackBonus = getSpellAttackBonus();
            const attackFormula = attackBonus >= 0 ? `1d20+${attackBonus}` : `1d20${attackBonus}`;
            roll(`${spell.name} - Spell Attack`, attackFormula);
          };
          // Description announced (if needed), don't announce again in castSpell
          castSpell(spell, spellIndex, afterCast, selectedSlotLevel, selectedMetamagic, skipSlot, true);
          spellCast = true;

          // Disable slot selection and metamagic after casting
          if (slotSelect) slotSelect.disabled = true;
          metamagicCheckboxes.forEach(cb => cb.disabled = true);

          // Disable attack button after casting
          btn.disabled = true;
          btn.style.opacity = '0.5';
          btn.style.cursor = 'not-allowed';

        } else if (option.type === 'damage' || option.type === 'healing' || option.type === 'temphp') {
          // If spell not cast yet (no attack roll), cast it first
          if (!spellCast) {
            // Announce description only if not already announced AND not using concentration recast
            if (!descriptionAnnounced && !skipSlot) {
              announceSpellDescription(spell, selectedSlotLevel);
            }

            const afterCast = (spell, slot) => {
              usedSlot = slot;
              let formula = option.formula;
              let actualSlotLevel = selectedSlotLevel != null ? selectedSlotLevel : (slot && slot.level);
              // Extract numeric level from "pact:X" format if needed
              if (typeof actualSlotLevel === 'string' && actualSlotLevel.startsWith('pact:')) {
                actualSlotLevel = parseInt(actualSlotLevel.split(':')[1]);
              }
              if (actualSlotLevel != null) {
                formula = formula.replace(/slotlevel/gi, actualSlotLevel);
              }
              // Replace ~target.level with character level (for cantrips)
              if (formula.includes('~target.level') && characterData.level) {
                formula = formula.replace(/~target\.level/g, characterData.level);
              }
              formula = resolveVariablesInFormula(formula);
              formula = evaluateMathInFormula(formula);

              const label = option.type === 'healing' ?
                `${spell.name} - Healing` :
                (option.type === 'temphp' ?
                  `${spell.name} - Temp HP` :
                  `${spell.name} - Damage (${option.damageType || ''})`);
              roll(label, formula);
            };
            // Description announced (if needed), don't announce again in castSpell
            castSpell(spell, spellIndex, afterCast, selectedSlotLevel, selectedMetamagic, skipSlot, true);
          } else {
            // Spell already cast (via attack), just roll damage
            let formula = option.formula;
            let actualSlotLevel = selectedSlotLevel != null ? selectedSlotLevel : (usedSlot && usedSlot.level);
            // Extract numeric level from "pact:X" format if needed
            if (typeof actualSlotLevel === 'string' && actualSlotLevel.startsWith('pact:')) {
              actualSlotLevel = parseInt(actualSlotLevel.split(':')[1]);
            }
            if (actualSlotLevel != null) {
              formula = formula.replace(/slotlevel/gi, actualSlotLevel);
            }
            // Replace ~target.level with character level (for cantrips)
            if (formula.includes('~target.level') && characterData.level) {
              formula = formula.replace(/~target\.level/g, characterData.level);
            }
            formula = resolveVariablesInFormula(formula);
            formula = evaluateMathInFormula(formula);

            const label = option.type === 'healing' ?
              `${spell.name} - Healing` :
              (option.type === 'temphp' ?
                `${spell.name} - Temp HP` :
                `${spell.name} - Damage (${option.damageType || ''})`);
            roll(label, formula);
          }

          // Close modal after rolling damage
          document.body.removeChild(overlay);

        } else if (option.type === 'lifesteal') {
          // Lifesteal: Cast spell, roll damage, calculate and apply healing
          // Announce description only if not already announced AND not using concentration recast
          if (!descriptionAnnounced && !skipSlot) {
            announceSpellDescription(spell, selectedSlotLevel);
          }

          const afterCast = (spell, slot) => {
            let damageFormula = option.damageFormula;
            const actualSlotLevel = selectedSlotLevel != null ? selectedSlotLevel : (slot && slot.level);
            if (actualSlotLevel != null) {
              damageFormula = damageFormula.replace(/slotlevel/gi, actualSlotLevel);
            }
            if (damageFormula.includes('~target.level') && characterData.level) {
              damageFormula = damageFormula.replace(/~target\.level/g, characterData.level);
            }
            damageFormula = resolveVariablesInFormula(damageFormula);
            damageFormula = evaluateMathInFormula(damageFormula);

            // Roll damage
            roll(`${spell.name} - Lifesteal Damage (${option.damageType})`, damageFormula);

            // After a short delay, prompt for damage dealt to calculate healing
            setTimeout(() => {
              const healingText = option.healingRatio === 'half' ? 'half' : 'the full amount';
              const damageDealt = prompt(`💉 Lifesteal: Enter the damage dealt\n\nYou regain HP equal to ${healingText} of the damage.`);

              if (damageDealt && !isNaN(damageDealt)) {
                const damage = parseInt(damageDealt);
                const healing = option.healingRatio === 'half' ? Math.floor(damage / 2) : damage;

                // Apply healing
                const oldHP = characterData.hitPoints.current;
                const maxHP = characterData.hitPoints.max;
                characterData.hitPoints.current = Math.min(oldHP + healing, maxHP);
                const actualHealing = characterData.hitPoints.current - oldHP;

                // Reset death saves if healing from 0 HP
                if (oldHP === 0 && actualHealing > 0) {
                  characterData.deathSaves = { successes: 0, failures: 0 };
                  debug.log('♻️ Death saves reset due to healing');
                }

                saveCharacterData();
                buildSheet(characterData);

                // Announce healing
                const colorBanner = getColoredBanner(characterData);
                const message = `&{template:default} {{name=${colorBanner}${characterData.name} - Lifesteal}} {{💉 Damage Dealt=${damage}}} {{💚 HP Regained=${actualHealing}}} {{Current HP=${characterData.hitPoints.current}/${maxHP}}}`;

                const messageData = {
                  action: 'announceSpell',
                  message: message,
                  color: characterData.notificationColor
                };

                if (window.opener && !window.opener.closed) {
                  try {
                    window.opener.postMessage(messageData, '*');
                  } catch (error) {
                    debug.warn('⚠️ Could not send via window.opener:', error.message);
                  }
                } else {
                  browserAPI.runtime.sendMessage({
                    action: 'relayRollToRoll20',
                    roll: messageData
                  });
                }

                showNotification(`💉 Lifesteal! Dealt ${damage} damage, regained ${actualHealing} HP`, 'success');
              }
            }, 500);
          };
          // Description announced (if needed), don't announce again in castSpell
          castSpell(spell, spellIndex, afterCast, selectedSlotLevel, selectedMetamagic, skipSlot, true);

          // Close modal after rolling
          document.body.removeChild(overlay);
        }
      });

      optionsContainer.appendChild(btn);
    });

    // Set up slot selection change handler to update button labels
    if (slotSelect) {
      const updateButtonLabels = () => {
        // Handle pact magic slot format "pact:X" - extract the level number
        const slotValue = slotSelect.value;
        const selectedSlotLevel = slotValue.startsWith('pact:')
          ? parseInt(slotValue.split(':')[1])
          : parseInt(slotValue);
        optionButtons.forEach(({ button, option }) => {
          const resolvedLabel = getResolvedLabel(option, selectedSlotLevel);
          const edgeCaseNote = option.edgeCaseNote ? `<div style="font-size: 0.8em; color: #666; margin-top: 2px;">${option.edgeCaseNote}</div>` : '';
          button.innerHTML = `${option.icon} ${resolvedLabel}${edgeCaseNote}`;
        });
      };

      // Add change event listener
      slotSelect.addEventListener('change', updateButtonLabels);

      // Call initially to set correct labels for default selection
      updateButtonLabels();
    }

    // Add "Done" button if spell has attack (to close modal after attacking without rolling damage)
    if (hasAttack && hasDamage) {
      const doneBtn = document.createElement('button');
      doneBtn.style.cssText = 'padding: 10px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;';
      doneBtn.textContent = 'Done';
      doneBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
      });
      optionsContainer.appendChild(doneBtn);
    }

    modal.appendChild(optionsContainer);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'margin-top: 16px; padding: 10px; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%;';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    modal.appendChild(cancelBtn);
    overlay.appendChild(modal);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    // Add to DOM
    document.body.appendChild(overlay);
  }

  /**
   * Handle spell option click (simplified handler)
   * @param {object} spell - Spell object
   * @param {number} spellIndex - Spell index
   * @param {object} option - Spell option object
   */
  function handleSpellOption(spell, spellIndex, option) {
    if (option.type === 'attack') {
      // Cast spell + roll attack
      const afterCast = (spell, slot) => {
        const attackBonus = getSpellAttackBonus();
        const attackFormula = attackBonus >= 0 ? `1d20+${attackBonus}` : `1d20${attackBonus}`;
        roll(`${spell.name} - Spell Attack`, attackFormula);
      };
      castSpell(spell, spellIndex, afterCast);
    } else if (option.type === 'damage' || option.type === 'healing') {
      // Handle OR choices if present
      let damageType = option.damageType;
      if (option.orChoices && option.orChoices.length > 1) {
        const choiceText = option.orChoices.map((c, i) => `${i + 1}. ${c.damageType}`).join('\n');
        const choice = prompt(`Choose damage type for ${spell.name}:\n${choiceText}\n\nEnter number (1-${option.orChoices.length}):`);

        if (choice === null) return; // User cancelled

        const choiceIndex = parseInt(choice) - 1;
        if (choiceIndex >= 0 && choiceIndex < option.orChoices.length) {
          damageType = option.orChoices[choiceIndex].damageType;
        } else {
          alert(`Invalid choice. Please try again.`);
          return;
        }
      }

      // Cast spell + roll damage/healing
      const afterCast = (spell, slot) => {
        let formula = option.formula;
        // Replace slotLevel with actual slot level (case-insensitive)
        if (slot && slot.level) {
          formula = formula.replace(/slotlevel/gi, slot.level);
        }
        // Resolve other DiceCloud variables
        formula = resolveVariablesInFormula(formula);
        // Evaluate simple math expressions
        formula = evaluateMathInFormula(formula);

        const label = option.type === 'healing' ?
          `${spell.name} - Healing` :
          (damageType ? `${spell.name} - Damage (${damageType})` : `${spell.name} - Damage`);
        roll(label, formula);
      };
      castSpell(spell, spellIndex, afterCast);
    }
  }

  /**
   * Show resource choice modal (spell slot vs class resource)
   * @param {object} spell - Spell object
   * @param {number} spellLevel - Spell level
   * @param {number} spellSlots - Current spell slots
   * @param {number} maxSlots - Maximum spell slots
   * @param {Array} classResources - Array of class resources
   */
  function showResourceChoice(spell, spellLevel, spellSlots, maxSlots, classResources) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background: var(--bg-secondary); color: var(--text-primary); padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px; width: 90%;';

    let buttonsHTML = `
      <h3 style="margin: 0 0 20px 0; color: var(--text-primary); text-align: center;">Cast ${spell.name}</h3>
      <p style="text-align: center; color: var(--text-secondary); margin-bottom: 25px;">Choose a resource:</p>
      <div style="display: flex; flex-direction: column; gap: 12px;">
    `;

    // Add spell slot option if available
    if (spellSlots > 0) {
      buttonsHTML += `
        <button class="resource-choice-btn" data-type="spell-slot" data-level="${spellLevel}" style="padding: 15px; font-size: 1em; font-weight: bold; background: #9b59b6; color: white; border: 2px solid #9b59b6; border-radius: 8px; cursor: pointer; transition: all 0.2s; text-align: left;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>Level ${spellLevel} Spell Slot</span>
            <span style="background: rgba(255,255,255,0.3); padding: 4px 8px; border-radius: 4px; font-size: 0.9em;">${spellSlots}/${maxSlots}</span>
          </div>
        </button>
      `;
    }

    // Add class resource options
    classResources.forEach((resource, idx) => {
      const colors = {
        'Ki': { bg: '#f39c12', border: '#f39c12' },
        'Sorcery Points': { bg: '#e74c3c', border: '#e74c3c' },
        'Pact Magic': { bg: '#16a085', border: '#16a085' },
        'Channel Divinity': { bg: '#3498db', border: '#3498db' }
      };
      const color = colors[resource.name] || { bg: '#95a5a6', border: '#95a5a6' };

      buttonsHTML += `
        <button class="resource-choice-btn" data-type="class-resource" data-index="${idx}" style="padding: 15px; font-size: 1em; font-weight: bold; background: ${color.bg}; color: white; border: 2px solid ${color.border}; border-radius: 8px; cursor: pointer; transition: all 0.2s; text-align: left;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${resource.name}</span>
            <span style="background: rgba(255,255,255,0.3); padding: 4px 8px; border-radius: 4px; font-size: 0.9em;">${resource.current}/${resource.max}</span>
          </div>
        </button>
      `;
    });

    buttonsHTML += `
      </div>
      <button id="resource-cancel" style="width: 100%; margin-top: 20px; padding: 12px; font-size: 1em; background: #95a5a6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
        Cancel
      </button>
    `;

    modalContent.innerHTML = buttonsHTML;
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Add hover effects
    const resourceBtns = modalContent.querySelectorAll('.resource-choice-btn');
    resourceBtns.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = 'none';
      });

      btn.addEventListener('click', () => {
        const type = btn.dataset.type;

        if (type === 'spell-slot') {
          const level = parseInt(btn.dataset.level);
          modal.remove();
          // Check if they want to upcast
          showUpcastChoice(spell, level);
        } else if (type === 'class-resource') {
          const resourceIdx = parseInt(btn.dataset.index);
          const resource = classResources[resourceIdx];
          modal.remove();
          if (useClassResource(resource, spell)) {
            announceSpellCast(spell, resource.name);
          }
        }
      });
    });

    // Cancel button
    document.getElementById('resource-cancel').addEventListener('click', () => {
      modal.remove();
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Show upcast selection modal
   * @param {object} spell - Spell object
   * @param {number} originalLevel - Original spell level
   * @param {Function} afterCast - Callback after spell is cast
   */
  function showUpcastChoice(spell, originalLevel, afterCast = null) {
    // Get all available spell slots at this level or higher
    const availableSlots = [];

    // Helper to extract numeric value from DiceCloud objects
    const extractNum = (val) => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      if (typeof val === 'object') {
        return val.value ?? val.total ?? val.currentValue ?? 0;
      }
      return parseInt(val) || 0;
    };

    // Check for Pact Magic slots (Warlock) - these are SEPARATE from regular spell slots
    const rawPactLevel = characterData.spellSlots?.pactMagicSlotLevel ||
                         characterData.otherVariables?.pactMagicSlotLevel ||
                         characterData.otherVariables?.pactSlotLevelVisible ||
                         characterData.otherVariables?.pactSlotLevel;
    const rawPactSlots = characterData.spellSlots?.pactMagicSlots ??
                         characterData.otherVariables?.pactMagicSlots ??
                         characterData.otherVariables?.pactSlot;
    const rawPactSlotsMax = characterData.spellSlots?.pactMagicSlotsMax ??
                            characterData.otherVariables?.pactMagicSlotsMax;

    // Extract numeric values (DiceCloud stores these as objects like {value: 2})
    const pactMagicSlots = extractNum(rawPactSlots);
    const pactMagicSlotsMax = extractNum(rawPactSlotsMax);
    const effectivePactLevel = extractNum(rawPactLevel) || (pactMagicSlotsMax > 0 ? 5 : 0);

    debug.log('🔮 Pact Magic detection:', { rawPactLevel, rawPactSlots, rawPactSlotsMax, pactMagicSlots, pactMagicSlotsMax, effectivePactLevel });

    // Add Pact Magic slots first if available and spell level is compatible
    // Show even if depleted (current = 0) - user can still cast with GM permission
    if (pactMagicSlotsMax > 0 && originalLevel <= effectivePactLevel) {
      availableSlots.push({
        level: effectivePactLevel,
        current: pactMagicSlots,
        max: pactMagicSlotsMax,
        slotVar: 'pactMagicSlots',
        slotMaxVar: 'pactMagicSlotsMax',
        isPactMagic: true,
        label: `Level ${effectivePactLevel} - Pact Magic`
      });
      debug.log(`🔮 Added Pact Magic to upcast options: Level ${effectivePactLevel} (${pactMagicSlots}/${pactMagicSlotsMax})`);
    }

    // Then check regular spell slots - show all levels with max > 0 (even if depleted)
    for (let level = originalLevel; level <= 9; level++) {
      const slotVar = `level${level}SpellSlots`;
      const slotMaxVar = `level${level}SpellSlotsMax`;
      let current = characterData.spellSlots?.[slotVar] || 0;
      let max = characterData.spellSlots?.[slotMaxVar] || 0;

      // Skip if this level's slots are actually Pact Magic slots (avoid duplicates)
      if (pactMagicSlotsMax > 0 && level === effectivePactLevel) {
        // Pact Magic is already added separately above
        continue;
      }

      // Show slot level if character has access to it (max > 0), even if depleted
      if (max > 0) {
        availableSlots.push({ level, current, max, slotVar, slotMaxVar });
      }
    }

    // Check for metamagic options
    const metamagicOptions = getAvailableMetamagic();
    const sorceryPoints = getSorceryPointsResource();
    debug.log('🔮 Metamagic detection:', {
      metamagicOptions,
      sorceryPoints,
      hasMetamagic: metamagicOptions.length > 0 && sorceryPoints && sorceryPoints.current > 0
    });
    const hasMetamagic = metamagicOptions.length > 0 && sorceryPoints && sorceryPoints.current > 0;

    debug.log('🔮 Available slots for casting:', availableSlots);

    // Handle case where no spell slots are available - allow casting anyway with warning
    if (availableSlots.length === 0) {
      const noSlotsModal = document.createElement('div');
      noSlotsModal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

      const noSlotsContent = document.createElement('div');
      noSlotsContent.style.cssText = 'background: var(--bg-secondary); color: var(--text-primary); padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px; width: 90%; text-align: center;';
      noSlotsContent.innerHTML = `
        <h3 style="margin: 0 0 20px 0; color: #e67e22;">No Spell Slots Available</h3>
        <p style="color: var(--text-secondary); margin-bottom: 20px;">You don't have any spell slots of level ${originalLevel} or higher to cast ${spell.name}.</p>
        <p style="color: #95a5a6; font-size: 0.9em; margin-bottom: 20px;">You can still cast if your GM allows it - no slot will be decremented.</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="no-slots-cancel" style="padding: 12px 25px; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1em;">Cancel</button>
          <button id="no-slots-cast" style="padding: 12px 25px; background: #e67e22; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1em;">Cast Anyway</button>
        </div>
      `;

      noSlotsModal.appendChild(noSlotsContent);
      document.body.appendChild(noSlotsModal);

      document.getElementById('no-slots-cancel').onclick = () => noSlotsModal.remove();
      document.getElementById('no-slots-cast').onclick = () => {
        noSlotsModal.remove();
        // Cast without decrementing a slot - pass a fake slot with noSlotUsed flag
        castWithSlot(spell, {
          level: originalLevel,
          current: 0,
          max: 0,
          slotVar: null,
          noSlotUsed: true
        }, [], afterCast);
      };
      noSlotsModal.onclick = (e) => { if (e.target === noSlotsModal) noSlotsModal.remove(); };
      return;
    }

    // Show upcast modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background: var(--bg-secondary); color: var(--text-primary); padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px; width: 90%;';

    let dropdownHTML = `
      <h3 style="margin: 0 0 20px 0; color: var(--text-primary); text-align: center;">Cast ${spell.name}</h3>
      <p style="text-align: center; color: var(--text-secondary); margin-bottom: 20px;">Level ${originalLevel} spell</p>

      <div style="margin-bottom: 25px;">
        <label style="display: block; margin-bottom: 10px; font-weight: bold; color: var(--text-primary);">Spell Slot Level:</label>
        <select id="upcast-slot-select" style="width: 100%; padding: 12px; font-size: 1.1em; border: 2px solid var(--border-color); border-radius: 6px; box-sizing: border-box; background: var(--bg-tertiary); color: var(--text-primary);">
    `;

    availableSlots.forEach((slot, index) => {
      let label;
      const depleted = slot.current <= 0;
      const depletedMarker = depleted ? ' [EMPTY]' : '';

      if (slot.isPactMagic) {
        label = `${slot.label} - ${slot.current}/${slot.max} remaining${depletedMarker}`;
      } else if (slot.level === originalLevel) {
        label = `Level ${slot.level} (Normal) - ${slot.current}/${slot.max} remaining${depletedMarker}`;
      } else {
        label = `Level ${slot.level} (Upcast) - ${slot.current}/${slot.max} remaining${depletedMarker}`;
      }
      // Store index so we can identify Pact Magic vs regular slots
      dropdownHTML += `<option value="${index}" data-level="${slot.level}" data-pact="${slot.isPactMagic || false}" data-current="${slot.current}">${label}</option>`;
    });

    dropdownHTML += `
        </select>
      </div>
    `;

    // Add metamagic options if available
    if (hasMetamagic) {
      dropdownHTML += `
        <div style="margin-bottom: 20px; padding: 12px; background: #f8f9fa; border-radius: 8px; border: 2px solid #9b59b6;">
          <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; margin-bottom: 8px;" onclick="document.getElementById('metamagic-container').style.display = document.getElementById('metamagic-container').style.display === 'none' ? 'flex' : 'none'; this.querySelector('.toggle-arrow').textContent = document.getElementById('metamagic-container').style.display === 'none' ? '▶' : '▼';">
            <label style="font-weight: bold; color: #9b59b6; cursor: pointer;">✨ Metamagic (Sorcery Points: ${sorceryPoints.current}/${sorceryPoints.max})</label>
            <span class="toggle-arrow" style="color: #9b59b6; font-size: 0.8em;">▼</span>
          </div>
          <div id="metamagic-container" style="display: flex; flex-direction: column; gap: 6px;">
      `;

      metamagicOptions.forEach((meta, index) => {
        const cost = meta.cost === 'variable' ? calculateMetamagicCost(meta.name, originalLevel) : meta.cost;
        const canAfford = sorceryPoints.current >= cost;
        const disabledStyle = !canAfford ? 'opacity: 0.5; cursor: not-allowed;' : '';

        dropdownHTML += `
            <label style="display: flex; align-items: center; padding: 8px; background: white; border-radius: 4px; cursor: pointer; ${disabledStyle}" title="${meta.description || ''}">
              <input type="checkbox" class="metamagic-option" data-name="${meta.name}" data-cost="${cost}" ${!canAfford ? 'disabled' : ''} style="margin-right: 8px; width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;">
              <span style="flex: 1; color: var(--text-primary); font-size: 0.95em;">${meta.name}</span>
              <span style="color: #9b59b6; font-weight: bold; font-size: 0.9em;">${cost} SP</span>
            </label>
        `;
      });

      dropdownHTML += `
          </div>
          <div id="metamagic-cost" style="margin-top: 8px; text-align: right; font-weight: bold; color: var(--text-primary); font-size: 0.9em;">Total Cost: 0 SP</div>
        </div>
      `;
    }

    dropdownHTML += `
      <div style="display: flex; gap: 10px;">
        <button id="upcast-cancel" style="flex: 1; padding: 12px; font-size: 1em; background: #95a5a6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
          Cancel
        </button>
        <button id="upcast-confirm" style="flex: 1; padding: 12px; font-size: 1em; background: #9b59b6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
          Cast Spell
        </button>
      </div>
    `;

    modalContent.innerHTML = dropdownHTML;
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    const selectElement = document.getElementById('upcast-slot-select');
    const confirmBtn = document.getElementById('upcast-confirm');
    const cancelBtn = document.getElementById('upcast-cancel');

    // Track metamagic selections
    let selectedMetamagic = [];

    if (hasMetamagic) {
      const metamagicCheckboxes = document.querySelectorAll('.metamagic-option');
      const costDisplay = document.getElementById('metamagic-cost');

      // Update selected spell level when it changes (affects Twinned Spell cost)
      selectElement.addEventListener('change', () => {
        const selectedIndex = parseInt(selectElement.value);
        const selectedLevel = availableSlots[selectedIndex]?.level || originalLevel;

        // Recalculate costs for variable-cost metamagic
        metamagicCheckboxes.forEach(checkbox => {
          const metaName = checkbox.dataset.name;
          const metaOption = metamagicOptions.find(m => m.name === metaName);
          if (metaOption && metaOption.cost === 'variable') {
            const newCost = calculateMetamagicCost(metaName, selectedLevel);
            checkbox.dataset.cost = newCost;

            // Update display
            const label = checkbox.closest('label');
            const costSpan = label.querySelector('span:last-child');
            costSpan.textContent = `${newCost} SP`;

            // Check if still affordable
            if (sorceryPoints.current < newCost && checkbox.checked) {
              checkbox.checked = false;
            }
          }
        });

        // Update total cost
        updateMetamagicCost();
      });

      function updateMetamagicCost() {
        let totalCost = 0;
        selectedMetamagic = [];

        metamagicCheckboxes.forEach(checkbox => {
          if (checkbox.checked) {
            const cost = parseInt(checkbox.dataset.cost);
            totalCost += cost;
            selectedMetamagic.push({
              name: checkbox.dataset.name,
              cost: cost
            });
          }
        });

        costDisplay.textContent = `Total Cost: ${totalCost} SP`;

        // Disable confirm if not enough sorcery points
        if (totalCost > sorceryPoints.current) {
          confirmBtn.disabled = true;
          confirmBtn.style.opacity = '0.5';
          confirmBtn.style.cursor = 'not-allowed';
        } else {
          confirmBtn.disabled = false;
          confirmBtn.style.opacity = '1';
          confirmBtn.style.cursor = 'pointer';
        }
      }

      metamagicCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateMetamagicCost);
      });
    }

    confirmBtn.addEventListener('click', () => {
      const selectedIndex = parseInt(selectElement.value);
      const selectedSlot = availableSlots[selectedIndex];
      debug.log(`🔮 Selected slot from upcast modal:`, selectedSlot);

      // Check if slot is depleted
      if (selectedSlot.current <= 0) {
        // Show warning modal
        modal.remove();

        const warnModal = document.createElement('div');
        warnModal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10001;';

        const warnContent = document.createElement('div');
        warnContent.style.cssText = 'background: var(--bg-secondary); color: var(--text-primary); padding: 30px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-width: 400px; width: 90%; text-align: center;';
        warnContent.innerHTML = `
          <h3 style="margin: 0 0 20px 0; color: #e67e22;">No Slots Remaining</h3>
          <p style="color: var(--text-secondary); margin-bottom: 20px;">You have no ${selectedSlot.isPactMagic ? 'Pact Magic' : `Level ${selectedSlot.level}`} spell slots remaining.</p>
          <p style="color: #95a5a6; font-size: 0.9em; margin-bottom: 20px;">You can still cast if your GM allows it - no slot will be decremented.</p>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="warn-cancel" style="padding: 12px 25px; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1em;">Cancel</button>
            <button id="warn-cast" style="padding: 12px 25px; background: #e67e22; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1em;">Cast Anyway</button>
          </div>
        `;

        warnModal.appendChild(warnContent);
        document.body.appendChild(warnModal);

        document.getElementById('warn-cancel').onclick = () => warnModal.remove();
        document.getElementById('warn-cast').onclick = () => {
          warnModal.remove();
          // Cast with noSlotUsed flag
          castWithSlot(spell, { ...selectedSlot, noSlotUsed: true }, selectedMetamagic, afterCast);
        };
        warnModal.onclick = (e) => { if (e.target === warnModal) warnModal.remove(); };
        return;
      }

      modal.remove();
      castWithSlot(spell, selectedSlot, selectedMetamagic, afterCast);
    });

    cancelBtn.addEventListener('click', () => {
      modal.remove();
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  // Export functions to globalThis
  Object.assign(globalThis, {
    showSpellModal,
    handleSpellOption,
    showResourceChoice,
    showUpcastChoice
  });

  console.log('✅ Spell Modals module loaded');

})();
