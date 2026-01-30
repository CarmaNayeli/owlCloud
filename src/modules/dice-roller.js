/**
 * Dice Roller Module
 *
 * Core dice rolling system with math evaluation, effect modifiers, and Roll20 integration.
 * Handles all dice roll execution, advantage/disadvantage, and optional effects.
 *
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 *
 * Functions exported to globalThis:
 * - safeMathEval(expr)
 * - evaluateMathInFormula(formula)
 * - applyEffectModifiers(rollName, formula)
 * - checkOptionalEffects(rollName, formula, onApply)
 * - showOptionalEffectPopup(effects, rollName, formula, onApply)
 * - roll(name, formula, prerolledResult)
 * - applyAdvantageToFormula(formula, effectNotes)
 * - executeRoll(name, formula, effectNotes, prerolledResult)
 */

(function() {
  'use strict';

  // ===== CORE FUNCTIONS =====

/**
 * Safe math expression evaluator that doesn't use eval() or Function()
 * CSP-compliant parser for basic arithmetic and Math functions
 */
function safeMathEval(expr) {
  // Tokenize the expression
  const tokens = [];
  let i = 0;
  expr = expr.replace(/\s+/g, ''); // Remove whitespace

  while (i < expr.length) {
    // Check for Math functions and max/min
    if (expr.substr(i, 10) === 'Math.floor') {
      tokens.push({ type: 'function', value: 'floor' });
      i += 10;
    } else if (expr.substr(i, 9) === 'Math.ceil') {
      tokens.push({ type: 'function', value: 'ceil' });
      i += 9;
    } else if (expr.substr(i, 10) === 'Math.round') {
      tokens.push({ type: 'function', value: 'round' });
      i += 10;
    } else if (expr.substr(i, 3) === 'max') {
      tokens.push({ type: 'function', value: 'max' });
      i += 3;
    } else if (expr.substr(i, 3) === 'min') {
      tokens.push({ type: 'function', value: 'min' });
      i += 3;
    } else if (expr[i] >= '0' && expr[i] <= '9' || expr[i] === '.') {
      // Parse number
      let num = '';
      while (i < expr.length && (expr[i] >= '0' && expr[i] <= '9' || expr[i] === '.')) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
    } else if ('+-*/(),'.includes(expr[i])) {
      tokens.push({ type: 'operator', value: expr[i] });
      i++;
    } else {
      throw new Error(`Unexpected character: ${expr[i]}`);
    }
  }

  // Parse and evaluate using recursive descent
  let pos = 0;

  function parseExpression() {
    let left = parseTerm();

    while (pos < tokens.length && tokens[pos].type === 'operator' && (tokens[pos].value === '+' || tokens[pos].value === '-')) {
      const op = tokens[pos].value;
      pos++;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }

    return left;
  }

  function parseTerm() {
    let left = parseFactor();

    while (pos < tokens.length && tokens[pos].type === 'operator' && (tokens[pos].value === '*' || tokens[pos].value === '/')) {
      const op = tokens[pos].value;
      pos++;
      const right = parseFactor();
      left = op === '*' ? left * right : left / right;
    }

    return left;
  }

  function parseFactor() {
    const token = tokens[pos];

    // Handle numbers
    if (token.type === 'number') {
      pos++;
      return token.value;
    }

    // Handle Math functions
    if (token.type === 'function') {
      const funcName = token.value;
      pos++;
      if (pos >= tokens.length || tokens[pos].value !== '(') {
        throw new Error('Expected ( after function name');
      }
      pos++; // Skip (
      
      // Handle multiple arguments for max/min functions
      const args = [];
      if (funcName === 'max' || funcName === 'min') {
        // Parse comma-separated arguments
        args.push(parseExpression());
        while (pos < tokens.length && tokens[pos].value === ',') {
          pos++; // Skip comma
          args.push(parseExpression());
        }
      } else {
        // Single argument for other functions
        args.push(parseExpression());
      }
      
      if (pos >= tokens.length || tokens[pos].value !== ')') {
        throw new Error('Expected ) after function argument');
      }
      pos++; // Skip )

      if (funcName === 'floor') return Math.floor(args[0]);
      if (funcName === 'ceil') return Math.ceil(args[0]);
      if (funcName === 'round') return Math.round(args[0]);
      if (funcName === 'max') return Math.max(...args);
      if (funcName === 'min') return Math.min(...args);
      throw new Error(`Unknown function: ${funcName}`);
    }

    // Handle parentheses
    if (token.type === 'operator' && token.value === '(') {
      pos++;
      const result = parseExpression();
      if (pos >= tokens.length || tokens[pos].value !== ')') {
        throw new Error('Mismatched parentheses');
      }
      pos++;
      return result;
    }

    // Handle unary minus
    if (token.type === 'operator' && token.value === '-') {
      pos++;
      return -parseFactor();
    }

    throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
  }

  return parseExpression();
}

/**
 * Evaluate simple mathematical expressions in formulas
 * Converts things like "5*5" to "25" before sending to Roll20
 * CSP-compliant - does not use eval() or Function() constructor
 */
function evaluateMathInFormula(formula) {
  if (!formula || typeof formula !== 'string') {
    return formula;
  }

  let currentFormula = formula;
  let previousFormula = null;
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops

  // Keep simplifying until formula doesn't change or max iterations reached
  while (currentFormula !== previousFormula && iterations < maxIterations) {
    previousFormula = currentFormula;
    iterations++;

    // Replace floor() with Math.floor() for parsing
    let processedFormula = currentFormula.replace(/floor\(/g, 'Math.floor(');
    processedFormula = processedFormula.replace(/ceil\(/g, 'Math.ceil(');
    processedFormula = processedFormula.replace(/round\(/g, 'Math.round(');

    // Check if the formula is just a simple math expression (no dice)
    // Pattern: numbers and operators only (e.g., "5*5", "10+5", "20/4")
    const simpleMathPattern = /^[\d\s+\-*/().]+$/;

    if (simpleMathPattern.test(processedFormula)) {
      try {
        const result = safeMathEval(processedFormula);
        if (typeof result === 'number' && !isNaN(result)) {
          debug.log(`✅ Evaluated simple math: ${currentFormula} = ${result} (iteration ${iterations})`);
          currentFormula = String(result);
          continue;
        }
      } catch (e) {
        debug.log(`⚠️ Could not evaluate math expression: ${currentFormula}`, e);
      }
    }

    // Handle formulas with dice notation like "(floor((9 + 1) / 6) + 1)d8" or "(3 * 1)d6"
    // Extract math before the dice, evaluate it, then reconstruct
    const dicePattern = /^(.+?)(d\d+.*)$/i;
    const match = processedFormula.match(dicePattern);

    if (match) {
      const mathPart = match[1]; // e.g., "(Math.floor((9 + 1) / 6) + 1)" or "(3 * 1)"
      const dicePart = match[2]; // e.g., "d8" or "d6"

      // Check if the math part is evaluable (allows numbers, operators, parens, and Math functions)
      const mathOnlyPattern = /^[\d\s+\-*/().\w]+$/;
      if (mathOnlyPattern.test(mathPart)) {
        try {
          const result = safeMathEval(mathPart);
          if (typeof result === 'number' && !isNaN(result)) {
            debug.log(`✅ Evaluated dice formula math: ${mathPart} = ${result} (iteration ${iterations})`);
            currentFormula = String(result) + dicePart;
            continue;
          }
        } catch (e) {
          debug.log(`⚠️ Could not evaluate dice formula math: ${mathPart}`, e);
        }
      }
    }
  }

  if (iterations > 1) {
    debug.log(`🔄 Formula simplified in ${iterations} iterations: "${formula}" -> "${currentFormula}"`);
  }

  return currentFormula;
}

/**
 * Apply active effect modifiers to a roll
 * @param {string} rollName - Name of the roll (e.g., "Attack", "Perception", "Strength Save")
 * @param {string} formula - Original formula
 * @returns {object} - { modifiedFormula, effectNotes }
 */
function applyEffectModifiers(rollName, formula) {
  const rollLower = rollName.toLowerCase();
  let modifiedFormula = formula;
  const effectNotes = [];

  // Combine all active effects
  const allEffects = [
    ...activeBuffs.map(name => ({ ...POSITIVE_EFFECTS.find(e => e.name === name), type: 'buff' })),
    ...activeConditions.map(name => ({ ...NEGATIVE_EFFECTS.find(e => e.name === name), type: 'debuff' }))
  ].filter(e => e && e.autoApply);

  debug.log(`🎲 Checking effects for roll: ${rollName}`, allEffects);

  for (const effect of allEffects) {
    if (!effect.modifier) continue;

    let applied = false;

    // Check for attack roll modifiers
    if (rollLower.includes('attack') && effect.modifier.attack) {
      const mod = effect.modifier.attack;
      if (mod === 'advantage') {
        effectNotes.push(`[${effect.icon} ${effect.name}: Advantage]`);
        applied = true;
      } else if (mod === 'disadvantage') {
        effectNotes.push(`[${effect.icon} ${effect.name}: Disadvantage]`);
        applied = true;
      } else {
        modifiedFormula += ` + ${mod}`;
        effectNotes.push(`[${effect.icon} ${effect.name}: ${mod}]`);
        applied = true;
      }
    }

    // Check for saving throw modifiers
    if (rollLower.includes('save') && (effect.modifier.save || effect.modifier.strSave || effect.modifier.dexSave)) {
      const mod = effect.modifier.save ||
                 (rollLower.includes('strength') && effect.modifier.strSave) ||
                 (rollLower.includes('dexterity') && effect.modifier.dexSave);

      if (mod === 'advantage') {
        effectNotes.push(`[${effect.icon} ${effect.name}: Advantage]`);
        applied = true;
      } else if (mod === 'disadvantage') {
        effectNotes.push(`[${effect.icon} ${effect.name}: Disadvantage]`);
        applied = true;
      } else if (mod === 'fail') {
        effectNotes.push(`[${effect.icon} ${effect.name}: Auto-fail]`);
        applied = true;
      } else if (mod) {
        modifiedFormula += ` + ${mod}`;
        effectNotes.push(`[${effect.icon} ${effect.name}: ${mod}]`);
        applied = true;
      }
    }

    // Check for skill check modifiers
    if ((rollLower.includes('check') || rollLower.includes('perception') ||
         rollLower.includes('stealth') || rollLower.includes('investigation') ||
         rollLower.includes('insight') || rollLower.includes('persuasion') ||
         rollLower.includes('deception') || rollLower.includes('intimidation') ||
         rollLower.includes('athletics') || rollLower.includes('acrobatics')) &&
        effect.modifier.skill) {
      const mod = effect.modifier.skill;
      if (mod === 'advantage') {
        effectNotes.push(`[${effect.icon} ${effect.name}: Advantage]`);
        applied = true;
      } else if (mod === 'disadvantage') {
        effectNotes.push(`[${effect.icon} ${effect.name}: Disadvantage]`);
        applied = true;
      } else {
        modifiedFormula += ` + ${mod}`;
        effectNotes.push(`[${effect.icon} ${effect.name}: ${mod}]`);
        applied = true;
      }
    }

    // Check for damage modifiers
    if (rollLower.includes('damage') && effect.modifier.damage) {
      modifiedFormula += ` + ${effect.modifier.damage}`;
      effectNotes.push(`[${effect.icon} ${effect.name}: +${effect.modifier.damage}]`);
      applied = true;
    }

    if (applied) {
      debug.log(`✅ Applied ${effect.name} (${effect.type}) to ${rollName}`);
    }
  }

  return { modifiedFormula, effectNotes };
}

/**
 * Check for optional effects that could apply to a roll and show popup if found
 * @param {string} rollName - Name of the roll
 * @param {string} formula - Original formula
 * @param {function} onApply - Callback function to apply the effect
 */
function checkOptionalEffects(rollName, formula, onApply) {
  const rollLower = rollName.toLowerCase();

  // Combine all active effects that are NOT autoApply
  const optionalEffects = [
    ...activeBuffs.map(name => ({ ...POSITIVE_EFFECTS.find(e => e.name === name), type: 'buff' })),
    ...activeConditions.map(name => ({ ...NEGATIVE_EFFECTS.find(e => e.name === name), type: 'debuff' }))
  ].filter(e => e && !e.autoApply && e.modifier);

  if (optionalEffects.length === 0) return;

  debug.log(`🎲 Checking optional effects for roll: ${rollName}`, optionalEffects);

  const applicableEffects = [];

  for (const effect of optionalEffects) {
    let applicable = false;

    // Check for skill check modifiers (for Guidance) - ALL skills
    const isSkillCheck = rollLower.includes('check') || 
                        rollLower.includes('acrobatics') || rollLower.includes('animal') ||
                        rollLower.includes('arcana') || rollLower.includes('athletics') ||
                        rollLower.includes('deception') || rollLower.includes('history') ||
                        rollLower.includes('insight') || rollLower.includes('intimidation') ||
                        rollLower.includes('investigation') || rollLower.includes('medicine') ||
                        rollLower.includes('nature') || rollLower.includes('perception') ||
                        rollLower.includes('performance') || rollLower.includes('persuasion') ||
                        rollLower.includes('religion') || rollLower.includes('sleight') ||
                        rollLower.includes('stealth') || rollLower.includes('survival');
    
    if (isSkillCheck && effect.modifier.skill) {
      applicable = true;
    }

    // Check for attack roll modifiers
    if (rollLower.includes('attack') && effect.modifier.attack) {
      applicable = true;
    }

    // Check for saving throw modifiers
    if (rollLower.includes('save') && effect.modifier.save) {
      applicable = true;
    }

    // Special handling for Bardic Inspiration - applies to checks, attacks, and saves
    if (effect.name.startsWith('Bardic Inspiration')) {
      if (rollLower.includes('check') || rollLower.includes('perception') ||
          rollLower.includes('stealth') || rollLower.includes('investigation') ||
          rollLower.includes('insight') || rollLower.includes('persuasion') ||
          rollLower.includes('deception') || rollLower.includes('intimidation') ||
          rollLower.includes('athletics') || rollLower.includes('acrobatics') ||
          rollLower.includes('attack') || rollLower.includes('save')) {
        applicable = true;
      }
    }

    if (applicable) {
      applicableEffects.push(effect);
    }
  }

  if (applicableEffects.length > 0) {
    showOptionalEffectPopup(applicableEffects, rollName, formula, onApply);
  }
}

/**
 * Show popup for optional effects
 */
function showOptionalEffectPopup(effects, rollName, formula, onApply) {
  debug.log('🎯 Showing optional effect popup for:', effects);

  if (!document.body) {
    debug.error('❌ document.body not available for optional effect popup');
    return;
  }

  // Get theme-aware colors
  const colors = getPopupThemeColors();

  // Create modal overlay
  const popupOverlay = document.createElement('div');
  popupOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  // Create popup content
  const popupContent = document.createElement('div');
  popupContent.style.cssText = `
    background: ${colors.background};
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    text-align: center;
    border: 2px solid var(--accent-primary);
  `;

  // Build effects list
  const effectsList = effects.map(effect => `
    <div style="margin: 12px 0; padding: 12px; background: ${effect.color}20; border: 2px solid ${effect.color}; border-radius: 8px; cursor: pointer; transition: all 0.2s;" 
         onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'"
         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'"
         data-effect="${effect.name}" data-type="${effect.type}">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 1.2em;">${effect.icon}</span>
        <div style="flex: 1; text-align: left;">
          <div style="font-weight: bold; color: var(--text-primary);">${effect.name}</div>
          <div style="font-size: 0.85em; color: var(--text-secondary); margin-top: 2px;">${effect.description}</div>
        </div>
      </div>
    </div>
  `).join('');

  popupContent.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 16px;">🎯</div>
    <h2 style="margin: 0 0 8px 0; color: ${colors.heading};">Optional Effect Available!</h2>
    <p style="margin: 0 0 16px 0; color: ${colors.text};">
      You can apply an optional effect to your <strong>${rollName}</strong> roll:
    </p>
    ${effectsList}
    <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
      <button id="skip-effect" style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">
        Skip
      </button>
    </div>
  `;

  popupOverlay.appendChild(popupContent);
  document.body.appendChild(popupOverlay);

  // Add click handlers for effect options
  popupContent.querySelectorAll('[data-effect]').forEach(effectDiv => {
    effectDiv.addEventListener('click', () => {
      const effectName = effectDiv.dataset.effect;
      const effectType = effectDiv.dataset.type;
      const effect = effects.find(e => e.name === effectName);
      
      if (effect && onApply) {
        onApply(effect);
      }
      
      document.body.removeChild(popupOverlay);
    });
  });

  // Skip button
  document.getElementById('skip-effect').addEventListener('click', () => {
    document.body.removeChild(popupOverlay);
  });

  // Close on overlay click
  popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) {
      document.body.removeChild(popupOverlay);
    }
  });

  debug.log('🎯 Optional effect popup displayed');
}

function roll(name, formula, prerolledResult = null) {
  debug.log('🎲 Rolling:', name, formula, prerolledResult ? `(prerolled: ${prerolledResult})` : '');

  // Resolve any variables in the formula
  let resolvedFormula = resolveVariablesInFormula(formula);

  // Check if there are any optional effects that could apply to this roll
  const rollLower = name.toLowerCase();
  const optionalEffects = [
    ...activeBuffs.map(name => ({ ...POSITIVE_EFFECTS.find(e => e.name === name), type: 'buff' })),
    ...activeConditions.map(name => ({ ...NEGATIVE_EFFECTS.find(e => e.name === name), type: 'debuff' }))
  ].filter(e => e && !e.autoApply && e.modifier);

  const hasApplicableOptionalEffects = optionalEffects.some(effect => {
    // Check if this is a skill check (any skill name or the word "check")
    const isSkillCheck = rollLower.includes('check') || 
                        rollLower.includes('acrobatics') || rollLower.includes('animal') ||
                        rollLower.includes('arcana') || rollLower.includes('athletics') ||
                        rollLower.includes('deception') || rollLower.includes('history') ||
                        rollLower.includes('insight') || rollLower.includes('intimidation') ||
                        rollLower.includes('investigation') || rollLower.includes('medicine') ||
                        rollLower.includes('nature') || rollLower.includes('perception') ||
                        rollLower.includes('performance') || rollLower.includes('persuasion') ||
                        rollLower.includes('religion') || rollLower.includes('sleight') ||
                        rollLower.includes('stealth') || rollLower.includes('survival');
    
    return (isSkillCheck && effect.modifier.skill) ||
           (rollLower.includes('attack') && effect.modifier.attack);
  });

  // If there are applicable optional effects, show popup and wait for user choice
  if (hasApplicableOptionalEffects) {
    debug.log('🎯 Found applicable optional effects, showing popup...');
    checkOptionalEffects(name, resolvedFormula, (chosenEffect) => {
      // Apply the chosen effect and then roll
      const { modifiedFormula, effectNotes } = applyEffectModifiers(name, resolvedFormula);
      let finalFormula = modifiedFormula;

      // Check if this is a skill/ability check (same logic as popup detection)
      const isSkillOrAbilityCheck = rollLower.includes('check') ||
                        rollLower.includes('acrobatics') || rollLower.includes('animal') ||
                        rollLower.includes('arcana') || rollLower.includes('athletics') ||
                        rollLower.includes('deception') || rollLower.includes('history') ||
                        rollLower.includes('insight') || rollLower.includes('intimidation') ||
                        rollLower.includes('investigation') || rollLower.includes('medicine') ||
                        rollLower.includes('nature') || rollLower.includes('perception') ||
                        rollLower.includes('performance') || rollLower.includes('persuasion') ||
                        rollLower.includes('religion') || rollLower.includes('sleight') ||
                        rollLower.includes('stealth') || rollLower.includes('survival') ||
                        rollLower.includes('strength') || rollLower.includes('dexterity') ||
                        rollLower.includes('constitution') || rollLower.includes('intelligence') ||
                        rollLower.includes('wisdom') || rollLower.includes('charisma');

      debug.log(`🎯 Applying chosen effect: ${chosenEffect.name}`, {
        modifier: chosenEffect.modifier,
        rollLower: rollLower,
        hasSkillMod: !!chosenEffect.modifier?.skill,
        isSkillOrAbilityCheck: isSkillOrAbilityCheck,
        formulaBefore: finalFormula
      });

      // Add the chosen effect's modifier
      if (chosenEffect.modifier?.skill && isSkillOrAbilityCheck) {
        finalFormula += ` + ${chosenEffect.modifier.skill}`;
        effectNotes.push(`[${chosenEffect.icon} ${chosenEffect.name}: ${chosenEffect.modifier.skill}]`);
        debug.log(`✅ Added skill modifier: ${chosenEffect.modifier.skill}, formula now: ${finalFormula}`);
      } else if (chosenEffect.modifier?.attack && rollLower.includes('attack')) {
        finalFormula += ` + ${chosenEffect.modifier.attack}`;
        effectNotes.push(`[${chosenEffect.icon} ${chosenEffect.name}: ${chosenEffect.modifier.attack}]`);
        debug.log(`✅ Added attack modifier: ${chosenEffect.modifier.attack}, formula now: ${finalFormula}`);
      } else {
        debug.log(`⚠️ No modifier applied - skill: ${chosenEffect.modifier?.skill}, check: ${rollLower.includes('check')}, attack: ${chosenEffect.modifier?.attack}`);
      }
      
      // Remove the chosen effect from active effects since it's been used
      if (chosenEffect.type === 'buff') {
        activeBuffs = activeBuffs.filter(e => e !== chosenEffect.name);
        debug.log(`🗑️ Removed buff: ${chosenEffect.name}`);
      } else if (chosenEffect.type === 'debuff') {
        activeConditions = activeConditions.filter(e => e !== chosenEffect.name);
        debug.log(`🗑️ Removed debuff: ${chosenEffect.name}`);
      }
      updateEffectsDisplay();

      // Apply advantage/disadvantage state
      const formulaWithAdvantage = applyAdvantageToFormula(finalFormula, effectNotes);

      // Proceed with the roll
      executeRoll(name, formulaWithAdvantage, effectNotes, prerolledResult);
    });
    // Return early - don't execute the roll yet, wait for popup response
    return;
  }

  // No optional effects, proceed with normal roll
  const { modifiedFormula, effectNotes } = applyEffectModifiers(name, resolvedFormula);

  // Apply advantage/disadvantage state
  const formulaWithAdvantage = applyAdvantageToFormula(modifiedFormula, effectNotes);

  executeRoll(name, formulaWithAdvantage, effectNotes, prerolledResult);
}

/**
 * Apply advantage/disadvantage state to dice formula
 */
function applyAdvantageToFormula(formula, effectNotes) {
  if (advantageState === 'normal') {
    return formula;
  }

  // Check if this is a d20 roll
  if (!formula.includes('1d20') && !formula.includes('d20')) {
    return formula; // Not a d20 roll, don't modify
  }

  let modifiedFormula = formula;

  if (advantageState === 'advantage') {
    // Replace 1d20 with 2d20kh1 (keep highest)
    modifiedFormula = modifiedFormula.replace(/1d20/g, '2d20kh1');
    modifiedFormula = modifiedFormula.replace(/(?<!\d)d20/g, '2d20kh1');
    effectNotes.push('[⚡ Advantage]');
    debug.log('⚡ Applied advantage to roll');
  } else if (advantageState === 'disadvantage') {
    // Replace 1d20 with 2d20kl1 (keep lowest)
    modifiedFormula = modifiedFormula.replace(/1d20/g, '2d20kl1');
    modifiedFormula = modifiedFormula.replace(/(?<!\d)d20/g, '2d20kl1');
    effectNotes.push('[⚠️ Disadvantage]');
    debug.log('⚠️ Applied disadvantage to roll');
  }

  // Reset advantage state after use
  setTimeout(() => setAdvantageState('normal'), 100);

  return modifiedFormula;
}

/**
 * Execute the roll after optional effects have been handled
 */
function executeRoll(name, formula, effectNotes, prerolledResult = null) {
  const colorBanner = getColoredBanner(characterData);
  // Format: "🔵 CharacterName rolls Initiative"
  let rollName = `${colorBanner}${characterData.name} rolls ${name}`;

  // Add effect notes to roll name if any
  if (effectNotes.length > 0) {
    rollName += ` ${effectNotes.join(' ')}`;
  }

  // Save this as the character's last roll (for heroic inspiration reroll)
  if (characterData) {
    characterData.lastRoll = {
      name: name,
      formula: formula,
      effectNotes: effectNotes
    };
    saveCharacterData();
  }

  // If we have a prerolled result (e.g., from death saves), include it
  const messageData = {
    action: 'rollFromPopout',
    name: rollName,
    formula: formula,
    color: characterData.notificationColor,
    characterName: characterData.name
  };

  if (prerolledResult !== null) {
    messageData.prerolledResult = prerolledResult;
  }

  // Try window.opener first (Chrome)
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(messageData, '*');
      showNotification(`🎲 Rolling ${name}...`);
      debug.log('✅ Roll sent via window.opener');
      return;
    } catch (error) {
      debug.warn('⚠️ Could not send via window.opener:', error.message);
    }
  }

  // Fallback: Use background script to relay to Roll20 (Firefox)
  debug.log('📡 Using background script to relay roll to Roll20...');
  browserAPI.runtime.sendMessage({
    action: 'relayRollToRoll20',
    roll: messageData
  }, (response) => {
    if (browserAPI.runtime.lastError) {
      debug.error('❌ Error relaying roll:', browserAPI.runtime.lastError);
      showNotification('Failed to send roll. Please try from Roll20 page.', 'error');
    } else if (response && response.success) {
      debug.log('✅ Roll relayed to Roll20 via background script');
      showNotification(`🎲 Rolling ${name}...`);
    } else {
      debug.error('❌ Failed to relay roll:', response?.error);
      showNotification('Failed to send roll. Make sure Roll20 tab is open.', 'error');
    }
  });
}

  // ===== EXPORTS =====

  // Export functions to globalThis
  globalThis.safeMathEval = safeMathEval;
  globalThis.evaluateMathInFormula = evaluateMathInFormula;
  globalThis.applyEffectModifiers = applyEffectModifiers;
  globalThis.checkOptionalEffects = checkOptionalEffects;
  globalThis.showOptionalEffectPopup = showOptionalEffectPopup;
  globalThis.roll = roll;
  globalThis.applyAdvantageToFormula = applyAdvantageToFormula;
  globalThis.executeRoll = executeRoll;

  debug.log('✅ Dice Roller module loaded');

})();
