/**
 * Formula Resolver Module
 *
 * Handles variable substitution and formula resolution for DiceCloud formulas.
 * This is the core formula parsing engine that resolves variables like:
 * - Bare variables (e.g., "breathWeaponDamage")
 * - DiceCloud references (e.g., "#spellList.abilityMod")
 * - Attribute modifiers (e.g., "strength.modifier")
 * - Math expressions (e.g., "ceil(level/2)")
 * - Inline calculations (e.g., "{varName + 2}")
 *
 * Loaded as a plain script (no ES6 modules) to export to globalThis.
 *
 * Functions exported to globalThis:
 * - resolveVariablesInFormula(formula)
 */

(function() {
  'use strict';

  /**
   * Resolves variables in a formula string
   * @param {string} formula - Formula with variable references
   * @returns {string} Formula with variables resolved to their values
   */
  function resolveVariablesInFormula(formula) {
    if (!formula || typeof formula !== 'string') {
      return formula;
    }

    debug.log(`🔧 resolveVariablesInFormula called with: "${formula}"`);

    // Check if characterData has otherVariables
    if (!characterData.otherVariables || typeof characterData.otherVariables !== 'object') {
      debug.log('⚠️ No otherVariables available for formula resolution');
      return formula;
    }

    // Don't resolve slotLevel - it should be replaced with actual slot level when casting
    // This allows upcast damage to work correctly
    if (/\bslotLevel\b/i.test(formula)) {
      debug.log('⏭️ Formula contains slotLevel - skipping resolution to preserve for upcast');
      return formula;
    }

    let resolvedFormula = formula;
    let variablesResolved = [];

    // Pattern 0: Check if the entire formula is just a bare variable name (e.g., "breathWeaponDamage")
    // This must be checked BEFORE other patterns to handle cases like action.damage = "breathWeaponDamage"
    const bareVariablePattern = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
    if (bareVariablePattern.test(formula.trim())) {
      const varName = formula.trim();
      if (characterData.otherVariables.hasOwnProperty(varName)) {
        const variableValue = characterData.otherVariables[varName];

        // Extract the value
        let value = null;
        if (typeof variableValue === 'number') {
          value = variableValue;
        } else if (typeof variableValue === 'string') {
          value = variableValue;
        } else if (typeof variableValue === 'object' && variableValue.value !== undefined) {
          value = variableValue.value;
        }

        if (value !== null && value !== undefined) {
          debug.log(`✅ Resolved bare variable: ${varName} = ${value}`);
          return String(value);
        }
      }
      debug.log(`⚠️ Bare variable not found in otherVariables: ${varName}`);
    }

    // Helper function to get variable value (handles dot notation like "bard.level")
    const getVariableValue = (varPath) => {
      // Strip # prefix if present (DiceCloud reference notation)
      const cleanPath = varPath.startsWith('#') ? varPath.substring(1) : varPath;

      // Handle attribute modifiers like "strength.modifier", "wisdom.modifier"
      if (cleanPath.includes('.modifier')) {
        const attrName = cleanPath.replace('.modifier', '');
        if (characterData.attributeMods && characterData.attributeMods[attrName] !== undefined) {
          const modifier = characterData.attributeMods[attrName];
          debug.log(`✅ Resolved attribute modifier: ${cleanPath} = ${modifier}`);
          return modifier;
        }
      }

      // Handle attribute scores like "strength", "wisdom"
      if (characterData.attributes && characterData.attributes[cleanPath] !== undefined) {
        const score = characterData.attributes[cleanPath];
        debug.log(`✅ Resolved attribute score: ${cleanPath} = ${score}`);
        return score;
      }

      // Handle proficiency bonus
      if (cleanPath === 'proficiencyBonus' && characterData.proficiencyBonus !== undefined) {
        const profBonus = characterData.proficiencyBonus;
        debug.log(`✅ Resolved proficiency bonus: ${cleanPath} = ${profBonus}`);
        return profBonus;
      }

      // Handle special DiceCloud spell references (e.g., "spellList.abilityMod")
      // These reference the spellcasting ability modifier for the character's class
      if (cleanPath === 'spellList.abilityMod' || cleanPath === 'spellList.ability') {
        // Determine spellcasting ability based on character class
        const charClass = (characterData.class || '').toLowerCase();
        let spellcastingAbility = null;

        // Map classes to their spellcasting abilities
        if (charClass.includes('cleric') || charClass.includes('druid') || charClass.includes('ranger')) {
          spellcastingAbility = 'wisdom';
        } else if (charClass.includes('wizard') || charClass.includes('artificer')) {
          spellcastingAbility = 'intelligence';
        } else if (charClass.includes('bard') || charClass.includes('paladin') || charClass.includes('sorcerer') || charClass.includes('warlock')) {
          spellcastingAbility = 'charisma';
        }

        // Return the modifier for the spellcasting ability
        if (spellcastingAbility && characterData.attributeMods && characterData.attributeMods[spellcastingAbility] !== undefined) {
          const modifier = characterData.attributeMods[spellcastingAbility];
          debug.log(`✅ Resolved ${cleanPath} to ${spellcastingAbility} modifier: ${modifier}`);
          return modifier;
        }
      }

      // Handle spellList.dc (spell save DC)
      if (cleanPath === 'spellList.dc') {
        // Spell Save DC = 8 + proficiency bonus + spellcasting ability modifier
        const profBonus = characterData.proficiencyBonus || 0;
        const spellMod = getVariableValue('#spellList.abilityMod');
        if (spellMod !== null) {
          const spellDC = 8 + profBonus + spellMod;
          debug.log(`✅ Calculated spell DC: 8 + ${profBonus} + ${spellMod} = ${spellDC}`);
          return spellDC;
        }
      }

      // Handle spellList.attackBonus (spell attack bonus)
      if (cleanPath === 'spellList.attackBonus') {
        // Spell Attack Bonus = proficiency bonus + spellcasting ability modifier
        const profBonus = characterData.proficiencyBonus || 0;
        const spellMod = getVariableValue('#spellList.abilityMod');
        if (spellMod !== null) {
          const attackBonus = profBonus + spellMod;
          debug.log(`✅ Calculated spell attack bonus: ${profBonus} + ${spellMod} = ${attackBonus}`);
          return attackBonus;
        }
      }

      // Try direct lookup first
      if (characterData.otherVariables.hasOwnProperty(cleanPath)) {
        const val = characterData.otherVariables[cleanPath];
        if (typeof val === 'number') return val;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'object' && val.value !== undefined) return val.value;
        if (typeof val === 'string') return val;
      }

      // Try converting dot notation (e.g., "bard.level" -> "bardLevel")
      const camelCase = cleanPath.replace(/\.([a-z])/g, (_, letter) => letter.toUpperCase());
      if (characterData.otherVariables.hasOwnProperty(camelCase)) {
        const val = characterData.otherVariables[camelCase];
        if (typeof val === 'number') return val;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'object' && val.value !== undefined) return val.value;
      }

      // Try other common patterns
      const alternatives = [
        cleanPath.replace(/\./g, ''), // Remove dots
        cleanPath.split('.').pop(), // Just the last part
        cleanPath.replace(/\./g, '_') // Underscores instead
      ];

      for (const alt of alternatives) {
        if (characterData.otherVariables.hasOwnProperty(alt)) {
          const val = characterData.otherVariables[alt];
          if (typeof val === 'number') return val;
          if (typeof val === 'boolean') return val;
          if (typeof val === 'object' && val.value !== undefined) return val.value;
        }
      }

      return null;
    };

    // Pattern 1a: Find DiceCloud references in parentheses like (#spellList.abilityMod)
    const diceCloudRefPattern = /\((#[a-zA-Z_][a-zA-Z0-9_.]*)\)/g;
    let match;

    while ((match = diceCloudRefPattern.exec(formula)) !== null) {
      const varRef = match[1]; // e.g., "#spellList.abilityMod"
      const fullMatch = match[0]; // e.g., "(#spellList.abilityMod)"

      // Use getVariableValue which handles # prefix and dot notation
      const value = getVariableValue(varRef);

      if (value !== null && typeof value === 'number') {
        resolvedFormula = resolvedFormula.replace(fullMatch, value);
        variablesResolved.push(`${varRef}=${value}`);
        debug.log(`✅ Resolved DiceCloud reference: ${varRef} = ${value}`);
      } else {
        debug.log(`⚠️ Could not resolve DiceCloud reference: ${varRef}, value: ${value}`);
      }
    }

    // Pattern 1b: Find simple variables in parentheses like (variableName)
    const parenthesesPattern = /\(([a-zA-Z_][a-zA-Z0-9_]*)\)/g;

    while ((match = parenthesesPattern.exec(formula)) !== null) {
      const variableName = match[1];
      const fullMatch = match[0]; // e.g., "(sneakAttackDieAmount)"

      // Look up the variable value
      if (characterData.otherVariables.hasOwnProperty(variableName)) {
        const variableValue = characterData.otherVariables[variableName];

        // Extract numeric value
        let numericValue = null;
        if (typeof variableValue === 'number') {
          numericValue = variableValue;
        } else if (typeof variableValue === 'object' && variableValue.value !== undefined) {
          numericValue = variableValue.value;
        }

        if (numericValue !== null) {
          resolvedFormula = resolvedFormula.replace(fullMatch, numericValue);
          variablesResolved.push(`${variableName}=${numericValue}`);
          debug.log(`✅ Resolved variable: ${variableName} = ${numericValue}`);
        } else {
          debug.log(`⚠️ Variable ${variableName} has non-numeric value:`, variableValue);
        }
      }
    }

    // Pattern 2: DiceCloud expressions in square brackets like [ceil(level/2)]
    // These support math functions like ceil, floor, round, abs
    const bracketExprPattern = /\[([^\]]+)\]/g;

    while ((match = bracketExprPattern.exec(formula)) !== null) {
      const expression = match[1]; // e.g., "ceil(level/2)"
      const fullMatch = match[0]; // e.g., "[ceil(level/2)]"

      // Remove whitespace for easier parsing
      const cleanExpr = expression.replace(/\s+/g, '');

      try {
        // Check if it's a math function (ceil, floor, round, abs)
        const mathFuncPattern = /^(ceil|floor|round|abs)\((.+)\)$/;
        const funcMatch = mathFuncPattern.exec(cleanExpr);

        if (funcMatch) {
          const funcName = funcMatch[1];
          const funcExpression = funcMatch[2];

          // Replace variables in the expression
          let evalExpression = funcExpression;

          // Find all variable names and replace with values
          const varPattern = /[a-zA-Z_][a-zA-Z0-9_.]*/g;
          let varMatch;
          const replacements = [];

          while ((varMatch = varPattern.exec(funcExpression)) !== null) {
            const varName = varMatch[0];
            const value = getVariableValue(varName);
            if (value !== null && typeof value === 'number') {
              replacements.push({ name: varName, value: value });
            }
          }

          // Sort by length (longest first) to avoid partial replacements
          replacements.sort((a, b) => b.name.length - a.name.length);

          for (const {name, value} of replacements) {
            evalExpression = evalExpression.replace(new RegExp(name.replace(/\./g, '\\.'), 'g'), value);
          }

          // Evaluate the expression using safeMathEval
          if (/^[\d\s+\-*/().]+$/.test(evalExpression)) {
            const evalResult = safeMathEval(evalExpression);
            let result;

            switch (funcName) {
              case 'ceil':
                result = Math.ceil(evalResult);
                break;
              case 'floor':
                result = Math.floor(evalResult);
                break;
              case 'round':
                result = Math.round(evalResult);
                break;
              case 'abs':
                result = Math.abs(evalResult);
                break;
              default:
                result = evalResult;
            }

            resolvedFormula = resolvedFormula.replace(fullMatch, result);
            variablesResolved.push(`${funcName}(${expression})=${result}`);
            debug.log(`✅ Resolved math function: ${funcName}(${expression}) = ${result}`);
            continue;
          }
        }
      } catch (e) {
        debug.log(`⚠️ Failed to resolve ${cleanExpr}`, e);
      }

      // Try to evaluate as math expression
      let evalExpression = cleanExpr;

      // Replace all variable names with their values (sorted by length to avoid partial matches)
      const varPattern = /[a-zA-Z_][a-zA-Z0-9_.]*/g;
      let varMatch;
      const replacements = [];

      while ((varMatch = varPattern.exec(cleanExpr)) !== null) {
        const varName = varMatch[0];
        const value = getVariableValue(varName);
        if (value !== null && typeof value === 'number') {
          replacements.push({ name: varName, value: value });
        }
      }

      // Sort by length (longest first) to avoid partial replacements
      replacements.sort((a, b) => b.name.length - a.name.length);

      for (const {name, value} of replacements) {
        evalExpression = evalExpression.replace(new RegExp(name.replace(/\./g, '\\.'), 'g'), value);
      }

      // Try to evaluate the expression using safeMathEval
      try {
        if (/^[\d\s+\-*/().]+$/.test(evalExpression)) {
          const result = safeMathEval(evalExpression);
          resolvedFormula = resolvedFormula.replace(fullMatch, Math.floor(result));
          variablesResolved.push(`${cleanExpr}=${Math.floor(result)}`);
          debug.log(`✅ Resolved expression: ${cleanExpr} = ${Math.floor(result)}`);
        } else {
          debug.log(`⚠️ Could not resolve expression: ${cleanExpr} (eval: ${evalExpression})`);
        }
      } catch (e) {
        debug.log(`⚠️ Failed to evaluate expression: ${cleanExpr}`, e);
      }
    }

    if (variablesResolved.length > 0) {
      debug.log(`🔧 Formula resolution: "${formula}" -> "${resolvedFormula}" (${variablesResolved.join(', ')})`);
    }

    // Strip remaining markdown formatting
    resolvedFormula = resolvedFormula.replace(/\*\*/g, ''); // Remove bold markers

    // Parse inline calculations in curly braces {expression}
    // DiceCloud uses {varName} or {varName + 2} syntax in text
    const inlineCalcPattern = /\{([^}]+)\}/g;
    resolvedFormula = resolvedFormula.replace(inlineCalcPattern, (fullMatch, expression) => {
      try {
        // First try to resolve variables in the expression
        let resolvedExpr = expression;

        // Replace variable names with their values
        const varPattern = /[a-zA-Z_][a-zA-Z0-9_.]*/g;
        resolvedExpr = resolvedExpr.replace(varPattern, (varName) => {
          const value = getVariableValue(varName);
          return value !== null ? value : varName;
        });

        // Try to evaluate as math expression using safeMathEval
        // Only if it contains operators or is a number
        if (/[\d+\-*\/()]/.test(resolvedExpr)) {
          try {
            // Use safeMathEval for CSP-compliant evaluation
            const result = safeMathEval(resolvedExpr);
            debug.log(`✅ Evaluated inline calculation: {${expression}} = ${result}`);
            return result;
          } catch (e) {
            debug.log(`⚠️ Failed to evaluate inline calculation: {${expression}}`, e);
          }
        }

        // If it's just a variable lookup that was resolved, return it
        if (resolvedExpr !== expression && !/[a-zA-Z_]/.test(resolvedExpr)) {
          return resolvedExpr;
        }
      } catch (e) {
        debug.log(`⚠️ Error processing inline calculation: {${expression}}`, e);
      }

      // Return original if we couldn't resolve
      return fullMatch;
    });

    return resolvedFormula;
  }

  // ===== EXPORTS =====

  // Export function to globalThis
  globalThis.resolveVariablesInFormula = resolveVariablesInFormula;

  debug.log('✅ Formula Resolver module loaded');

})();
