/**
 * Dice Cloud Content Script
 * Extracts character data from Dice Cloud using the REST API
 */

(function() {
  'use strict';

  console.log('🎲 RollCloud: DiceCloud content script loaded');
  console.log('📍 Current URL:', window.location.href);

  // DiceCloud API endpoint
  const API_BASE = 'https://dicecloud.com/api';

  // Standardized DiceCloud variable names
  const STANDARD_VARS = {
    abilities: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
    abilityMods: ['strengthMod', 'dexterityMod', 'constitutionMod', 'intelligenceMod', 'wisdomMod', 'charismaMod'],
    saves: ['strengthSave', 'dexteritySave', 'constitutionSave', 'intelligenceSave', 'wisdomSave', 'charismaSave'],
    skills: [
      'acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history',
      'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception',
      'performance', 'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival'
    ],
    spellSlots: [
      'level1SpellSlots', 'level2SpellSlots', 'level3SpellSlots', 'level4SpellSlots', 'level5SpellSlots',
      'level6SpellSlots', 'level7SpellSlots', 'level8SpellSlots', 'level9SpellSlots',
      'level1SpellSlotsMax', 'level2SpellSlotsMax', 'level3SpellSlotsMax', 'level4SpellSlotsMax', 'level5SpellSlotsMax',
      'level6SpellSlotsMax', 'level7SpellSlotsMax', 'level8SpellSlotsMax', 'level9SpellSlotsMax'
    ],
    combat: ['armorClass', 'hitPoints', 'speed', 'initiative', 'proficiencyBonus']
  };

  /**
/**
   * Extracts character ID from the current URL
   */
  function getCharacterIdFromUrl() {
    const url = window.location.pathname;
    console.log('🔍 Parsing URL:', url);
    
    // Try different patterns
    const patterns = [
      /\/character\/([^/]+)/,           // /character/ABC123
      /\/character\/([^/]+)\/[^/]+/,    // /character/ABC123/CharName
      /character=([^&]+)/,              // ?character=ABC123
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        console.log('✅ Found character ID:', match[1]);
        return match[1];
      }
    }

    console.error('❌ Could not extract character ID from URL');
    return null;
  }
/**
   * Fetches character data from DiceCloud API
   */
  async function fetchCharacterDataFromAPI() {
    console.log('📡 Starting API fetch...');
    
    const characterId = getCharacterIdFromUrl();

    if (!characterId) {
      const error = 'Not on a character page. Navigate to a character sheet first.';
      console.error('❌', error);
      throw new Error(error);
    }

    console.log('🔐 Requesting API token from background...');
    
    // Get stored API token from background script
    let tokenResponse;
    try {
      tokenResponse = await browserAPI.runtime.sendMessage({ action: 'getApiToken' });
    } catch (error) {
      console.error('Extension context error:', error);
      throw new Error('Extension reloaded. Please refresh the page.');
    }
    console.log('🔑 Token response:', tokenResponse);

    if (!tokenResponse.success || !tokenResponse.token) {
      const error = 'Not logged in to DiceCloud. Please login via the extension popup.';
      console.error('❌', error);
      throw new Error(error);
    }

    console.log('✅ API token obtained');
    console.log('📡 Fetching character data for ID:', characterId);

    const apiUrl = `${API_BASE}/creature/${characterId}`;
    console.log('🌐 API URL:', apiUrl);

    // Fetch character data from API
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenResponse.token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📨 API Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('API token expired. Please login again via the extension popup.');
        }
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Received API data:', data);
      console.log('📊 Data structure:', {
        hasCreatures: !!data.creatures,
        creaturesCount: (data.creatures && data.creatures.length) || 0,
        hasVariables: !!data.creatureVariables,
        variablesCount: (data.creatureVariables && data.creatureVariables.length) || 0,
        hasProperties: !!data.creatureProperties,
        propertiesCount: (data.creatureProperties && data.creatureProperties.length) || 0
      });
      
      return parseCharacterData(data);
    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      throw fetchError;
    }
  }

/**
   * Parses API response into structured character data
   */
  function parseCharacterData(apiData) {
    console.log('🔧 Parsing character data...');
    
    if (!apiData.creatures || apiData.creatures.length === 0) {
      console.error('❌ No creatures found in API response');
      throw new Error('No character data found in API response');
    }

    const creature = apiData.creatures[0];
    const variables = (apiData.creatureVariables && apiData.creatureVariables[0]) || {};
    const properties = apiData.creatureProperties || [];

    console.log('📝 Creature:', creature);
    console.log('📊 Variables count:', Object.keys(variables).length);
    console.log('📋 Properties count:', properties.length);

    const characterData = {
      name: creature.name || '',
      race: '',
      class: '',
      level: 0,
      background: '',
      alignment: creature.alignment || '',
      attributes: {},
      attributeMods: {},
      saves: {},
      savingThrows: {},
      skills: {},
      features: [],
      spells: [],
      actions: [],
      spellSlots: {},
      inventory: [],
      proficiencies: [],
      hitPoints: {
        current: (variables.hitPoints && variables.hitPoints.value) || 0,
        max: (variables.hitPoints && variables.hitPoints.total) || 0
      },
      armorClass: (variables.armorClass && variables.armorClass.value) || 10,
      speed: (variables.speed && variables.speed.value) || 30,
      initiative: (variables.initiative && variables.initiative.value) || 0,
      proficiencyBonus: (variables.proficiencyBonus && variables.proficiencyBonus.value) || 0,
      deathSaves: {
        successes: (creature.deathSave && creature.deathSave.success) || 0,
        failures: (creature.deathSave && creature.deathSave.fail) || 0
      },
      kingdom: {},
      army: {},
      otherVariables: {}
    };

    // Extract ability scores
    STANDARD_VARS.abilities.forEach(ability => {
      if (variables[ability]) {
        characterData.attributes[ability] = variables[ability].value || 10;
      }
    });

    // Calculate modifiers from ability scores (standard D&D 5e formula)
    Object.keys(characterData.attributes).forEach(attr => {
      const score = characterData.attributes[attr] || 10;
      characterData.attributeMods[attr] = Math.floor((score - 10) / 2);
    });

    // Extract ability modifiers from Dice Cloud (but use calculated ones as backup)
    STANDARD_VARS.abilityMods.forEach(mod => {
      if (variables[mod]) {
        const abilityName = mod.replace('Mod', '');
        const diceCloudMod = variables[mod].value || 0;
        const calculatedMod = characterData.attributeMods[abilityName] || 0;
        
        // Use Dice Cloud modifier if it exists and is different, otherwise use calculated
        if (diceCloudMod !== 0 && diceCloudMod !== calculatedMod) {
          characterData.attributeMods[abilityName] = diceCloudMod;
          console.log(`📊 Using Dice Cloud modifier for ${abilityName}: ${diceCloudMod} (calculated: ${calculatedMod})`);
        } else {
          console.log(`📊 Using calculated modifier for ${abilityName}: ${calculatedMod}`);
        }
      }
    });

    // Extract saves
    STANDARD_VARS.saves.forEach(save => {
      if (variables[save]) {
        const abilityName = save.replace('Save', '');
        characterData.saves[abilityName] = variables[save].value || 0;
        // Also store in savingThrows for compatibility
        characterData.savingThrows[abilityName] = variables[save].value || 0;
      }
    });

    // Extract skills
    STANDARD_VARS.skills.forEach(skill => {
      if (variables[skill]) {
        characterData.skills[skill] = variables[skill].value || 0;
      }
    });

    // Extract spell slots
    // Dice Cloud uses: slotLevel1, slotLevel2, etc. (current and max combined in one variable)
    console.log('🔍 Extracting spell slots...');
    characterData.spellSlots = {};

    for (let level = 1; level <= 9; level++) {
      const diceCloudVarName = `slotLevel${level}`;
      const currentKey = `level${level}SpellSlots`;
      const maxKey = `level${level}SpellSlotsMax`;

      if (variables[diceCloudVarName]) {
        // Dice Cloud stores total slots in .total and current in .value
        const currentSlots = variables[diceCloudVarName].value || 0;
        const maxSlots = variables[diceCloudVarName].total || variables[diceCloudVarName].value || 0;

        characterData.spellSlots[currentKey] = currentSlots;
        characterData.spellSlots[maxKey] = maxSlots;

        console.log(`  ✅ Level ${level}: ${currentSlots}/${maxSlots} (from ${diceCloudVarName})`);
      } else {
        console.log(`  ⚠️ Level ${level}: ${diceCloudVarName} not found in variables`);
      }
    }

    console.log('📊 Final spell slots object:', characterData.spellSlots);

    // Extract ALL kingdom attributes (Pathfinder Kingmaker / Kingdom Builder)
    const kingdomSkills = [
      'agriculture', 'arts', 'boating', 'defense', 'engineering', 'exploration',
      'folklore', 'industry', 'intrigue', 'magic', 'politics', 'scholarship',
      'statecraft', 'trade', 'warfare', 'wilderness'
    ];

    kingdomSkills.forEach(skill => {
      // Base skill value (e.g., kingdomAgriculture)
      const skillVar = `kingdom${skill.charAt(0).toUpperCase() + skill.slice(1)}`;
      if (variables[skillVar]) {
        characterData.kingdom[skill] = variables[skillVar].value || 0;
      }

      // Proficiency total (e.g., kingdomAgricultureProficiencyTotal)
      const profVar = `${skillVar}ProficiencyTotal`;
      if (variables[profVar]) {
        characterData.kingdom[`${skill}_proficiency_total`] = variables[profVar].value || 0;
      }
    });

    // Extract economy/culture/loyalty/stability (kingdom core stats)
    const kingdomCoreStats = ['culture', 'economy', 'loyalty', 'stability'];
    kingdomCoreStats.forEach(stat => {
      const statVar = `kingdom${stat.charAt(0).toUpperCase() + stat.slice(1)}`;
      if (variables[statVar]) {
        characterData.kingdom[stat] = variables[statVar].value || 0;
      }
    });

    // Extract army attributes
    const armySkills = ['scouting', 'maneuver', 'morale', 'ranged'];
    armySkills.forEach(skill => {
      const skillVar = `army${skill.charAt(0).toUpperCase() + skill.slice(1)}`;
      if (variables[skillVar]) {
        characterData.army[skill] = variables[skillVar].value || 0;
      }
    });

    // Extract other useful variables
    if (variables.heroPoints) {
      characterData.otherVariables.hero_points = variables.heroPoints.value || 0;
    }

    // Extract ALL remaining variables (catch-all for anything we haven't specifically extracted)
    const knownVars = new Set([
      ...STANDARD_VARS.abilities,
      ...STANDARD_VARS.abilityMods,
      ...STANDARD_VARS.saves,
      ...STANDARD_VARS.skills,
      'armorClass', 'hitPoints', 'speed', 'initiative', 'proficiencyBonus', 'heroPoints',
      '_id', '_creatureId' // Skip internal MongoDB fields
    ]);

    // Also skip kingdom/army vars we already extracted
    kingdomSkills.forEach(skill => {
      knownVars.add(`kingdom${skill.charAt(0).toUpperCase() + skill.slice(1)}`);
      knownVars.add(`kingdom${skill.charAt(0).toUpperCase() + skill.slice(1)}ProficiencyTotal`);
    });
    kingdomCoreStats.forEach(stat => {
      knownVars.add(`kingdom${stat.charAt(0).toUpperCase() + stat.slice(1)}`);
    });
    armySkills.forEach(skill => {
      knownVars.add(`army${skill.charAt(0).toUpperCase() + skill.slice(1)}`);
    });

    // Extract everything else
    Object.keys(variables).forEach(varName => {
      if (!knownVars.has(varName) && !varName.startsWith('_')) {
        const value = variables[varName] && variables[varName].value;
        if (value !== undefined && value !== null) {
          characterData.otherVariables[varName] = value;
        }
      }
    });

    console.log(`Extracted ${Object.keys(characterData.otherVariables).length} additional variables`);
    
    // Debug: Check for race in other variables as fallback
    console.log('🔍 Checking for race in otherVariables:', Object.keys(characterData.otherVariables).filter(key => key.toLowerCase().includes('race')).map(key => `${key}: ${characterData.otherVariables[key]}`));

    // Build a map of property IDs to names for spell source resolution
    const propertyIdToName = new Map();
    properties.forEach(prop => {
      if (prop._id && prop.name) {
        propertyIdToName.set(prop._id, prop.name);
      }
    });
    console.log(`📋 Built property ID map with ${propertyIdToName.size} entries`);

    // Debug: Show sample entries from the map
    const sampleEntries = Array.from(propertyIdToName.entries()).slice(0, 10);
    console.log('📋 Sample property ID map entries:', sampleEntries);

    // Debug: Show all class-type entries in the map
    const classEntries = properties.filter(p => p.type === 'class' && p._id && p.name);
    console.log('📋 Class entries in map:', classEntries.map(p => ({ id: p._id, name: p.name, type: p.type })));

    // Parse properties for classes, race, features, spells, etc.
    // Track unique classes to avoid duplicates
    const uniqueClasses = new Set();

    // Debug: Log all property types to see what's available
    const propertyTypes = new Set();
    let raceFound = false;
    let racePropertyId = null;
    let raceName = null;

    // First pass: find the race property and process all properties
    apiData.creatureProperties.forEach(prop => {
      propertyTypes.add(prop.type);

      // Check for race as a folder (DiceCloud stores races as folders)
      // Look for folders with common race names at the top level
      const commonRaces = ['human', 'elf', 'dwarf', 'halfling', 'gnome', 'half-elf', 'half-orc', 'dragonborn', 'tiefling', 'orc', 'goblin', 'kobold'];
      if (prop.type === 'folder' && prop.name) {
        const nameMatchesRace = commonRaces.some(race => prop.name.toLowerCase().includes(race));
        if (nameMatchesRace) {
          const parentDepth = prop.ancestors ? prop.ancestors.length : 0;
          console.log(`🔍 DEBUG: Found folder "${prop.name}" with parentDepth ${parentDepth}, ancestors:`, prop.ancestors);

          if (parentDepth <= 2) { // Top-level or near top-level folder
            console.log('🔍 Found potential race folder:', {
              name: prop.name,
              type: prop.type,
              _id: prop._id,
              parentDepth: parentDepth
            });
            if (!raceFound) {
              raceName = prop.name;
              racePropertyId = prop._id;
              characterData.race = prop.name;
              console.log('🔍 Set race to:', prop.name, '(ID:', prop._id, ')');
              raceFound = true;
            }
          } else {
            console.log(`🔍 DEBUG: Skipping "${prop.name}" - parentDepth ${parentDepth} > 2`);
          }
        }
      }

      if (prop.type === 'race') {
        console.log('🔍 Found race property:', prop);
        if (prop.name) {
          raceName = prop.name;
          racePropertyId = prop._id;
          characterData.race = prop.name;
          console.log('🔍 Set race to:', prop.name, '(ID:', prop._id, ')');
          raceFound = true;
        }
      } else if (prop.type === 'species') {
        console.log('🔍 Found species property:', prop);
        if (prop.name) {
          raceName = prop.name;
          racePropertyId = prop._id;
          characterData.race = prop.name;
          console.log('🔍 Set race to (from species):', prop.name, '(ID:', prop._id, ')');
          raceFound = true;
        }
      } else if (prop.type === 'characterRace') {
        console.log('🔍 Found characterRace property:', prop);
        if (prop.name) {
          raceName = prop.name;
          racePropertyId = prop._id;
          characterData.race = prop.name;
          console.log('🔍 Set race to (from characterRace):', prop.name, '(ID:', prop._id, ')');
          raceFound = true;
        }
      }

      switch (prop.type) {
        case 'class':
          // Only add class name once, even if there are multiple classLevel entries
          if (prop.name) {
            // Remove [Multiclass] suffix before normalizing
            const cleanName = prop.name.replace(/\s*\[Multiclass\]/i, '').trim();
            const normalizedClassName = cleanName.toLowerCase().trim();
            console.log(`📚 Found class property: "${prop.name}" (cleaned: "${cleanName}", normalized: "${normalizedClassName}")`);
            if (!uniqueClasses.has(normalizedClassName)) {
              console.log(`  ✅ Adding class (not in set yet)`);
              uniqueClasses.add(normalizedClassName);
              if (characterData.class) {
                characterData.class += ` / ${cleanName}`;
              } else {
                characterData.class = cleanName;
              }
            } else {
              console.log(`  ⏭️  Skipping class (already in set:`, Array.from(uniqueClasses), ')');
            }
          }
          break;

        case 'classLevel':
          // Count each classLevel entry as 1 level
          characterData.level += 1;
          // Also add the class name if not already added
          if (prop.name) {
            // Remove [Multiclass] suffix before normalizing
            const cleanName = prop.name.replace(/\s*\[Multiclass\]/i, '').trim();
            const normalizedClassName = cleanName.toLowerCase().trim();
            console.log(`📊 Found classLevel property: "${prop.name}" (cleaned: "${cleanName}", normalized: "${normalizedClassName}")`);
            if (!uniqueClasses.has(normalizedClassName)) {
              console.log(`  ✅ Adding class from classLevel (not in set yet)`);
              uniqueClasses.add(normalizedClassName);
              if (characterData.class) {
                characterData.class += ` / ${cleanName}`;
              } else {
                characterData.class = cleanName;
              }
            } else {
              console.log(`  ⏭️  Skipping classLevel (already in set:`, Array.from(uniqueClasses), ')');
            }
          }
          break;

        case 'race':
          if (prop.name) {
            characterData.race = prop.name;
            console.log('🔍 Found race property:', prop.name);
          }
          break;
          
        case 'species':
          if (prop.name) {
            characterData.race = prop.name;
            console.log('🔍 Found species property (using as race):', prop.name);
          }
          break;
          
        case 'characterRace':
          if (prop.name) {
            characterData.race = prop.name;
            console.log('🔍 Found characterRace property:', prop.name);
          }
          break;

        case 'background':
          if (prop.name) {
            characterData.background = prop.name;
          }
          break;

        case 'feature':
          // Extract features, especially those with rolls (like Sneak Attack)
          const feature = {
            name: prop.name || 'Unnamed Feature',
            description: prop.description || '',
            uses: prop.uses,
            roll: prop.roll || '',
            damage: prop.damage || ''
          };

          characterData.features.push(feature);

          // If feature has a roll/damage, also add it to actions for easy access
          if (feature.roll || feature.damage) {
            characterData.actions.push({
              name: feature.name,
              actionType: 'feature',
              attackRoll: '',
              damage: feature.damage || feature.roll,
              damageType: '',
              description: feature.description
            });
            console.log(`⚔️ Added feature with roll to actions: ${feature.name}`);
          }
          break;

        case 'toggle':
          // Extract features from ALL toggles (enabled or disabled on DiceCloud)
          // Our sheet will have its own independent toggle to control when to use them
          console.log(`🔘 Found toggle: ${prop.name} (enabled on DiceCloud: ${prop.enabled})`);

            // Find child properties of this toggle
            const toggleChildren = apiData.creatureProperties.filter(child => {
              return child.parent && child.parent.id === prop._id;
            });

            console.log(`🔘 Toggle "${prop.name}" has ${toggleChildren.length} children:`, toggleChildren.map(c => c.name));

            // Debug: Log child types
            toggleChildren.forEach(child => {
              console.log(`🔘   Child "${child.name}" has type: ${child.type}`);
            });

            // Process each child (features, damage, effects, etc.)
            toggleChildren.forEach(child => {
              if (child.type === 'feature' || child.type === 'damage' || child.type === 'effect') {
                // Extract description from summary or description field
                let childDescription = '';
                if (child.summary) {
                  if (typeof child.summary === 'object' && child.summary.text) {
                    childDescription = child.summary.text;
                  } else if (typeof child.summary === 'string') {
                    childDescription = child.summary;
                  }
                } else if (child.description) {
                  if (typeof child.description === 'object' && child.description.text) {
                    childDescription = child.description.text;
                  } else if (typeof child.description === 'string') {
                    childDescription = child.description;
                  }
                }

                // Fallback to parent description if child has none
                if (!childDescription && prop.summary) {
                  if (typeof prop.summary === 'object' && prop.summary.text) {
                    childDescription = prop.summary.text;
                  } else if (typeof prop.summary === 'string') {
                    childDescription = prop.summary;
                  }
                }
                if (!childDescription && prop.description) {
                  if (typeof prop.description === 'object' && prop.description.text) {
                    childDescription = prop.description.text;
                  } else if (typeof prop.description === 'string') {
                    childDescription = prop.description;
                  }
                }

                const toggleFeature = {
                  name: child.name || prop.name || 'Unnamed Feature',
                  description: childDescription,
                  uses: child.uses || prop.uses,
                  roll: child.roll || child.amount || '',
                  damage: child.damage || child.amount || ''
                };

                // For effects, check if there's an operation that modifies damage
                if (child.type === 'effect' && child.operation === 'add' && child.amount) {
                  if (typeof child.amount === 'string') {
                    toggleFeature.damage = child.amount;
                  } else if (typeof child.amount === 'object' && child.amount.calculation) {
                    toggleFeature.damage = child.amount.calculation;
                  }
                }

                characterData.features.push(toggleFeature);

                // Add to actions if it has roll/damage OR if it has actionType
                // BUT: Never add effects to actions - they're passive modifiers (Guidance, Resistance, etc.)
                // Features and damage types can be actions
                const validActionTypes = ['action', 'bonus', 'reaction', 'free', 'legendary', 'lair', 'other'];
                const hasValidActionType = child.actionType && validActionTypes.includes(child.actionType.toLowerCase());

                // Check if it has a valid rollable/damage value (must be a non-empty string)
                const hasValidRoll = typeof toggleFeature.roll === 'string' && toggleFeature.roll.trim().length > 0;
                const hasValidDamage = typeof toggleFeature.damage === 'string' && toggleFeature.damage.trim().length > 0;

                // Only add to actions if:
                // 1. It's NOT an effect (effects are passive modifiers like Guidance, Resistance)
                // 2. AND it has rollable values OR a valid actionType
                const shouldAddToActions = child.type !== 'effect' && (hasValidRoll || hasValidDamage || hasValidActionType);

                if (shouldAddToActions) {
                  characterData.actions.push({
                    name: toggleFeature.name,
                    actionType: child.actionType || 'feature',
                    attackRoll: '',
                    damage: toggleFeature.damage || toggleFeature.roll,
                    damageType: child.damageType || '',
                    description: toggleFeature.description
                  });

                  if (toggleFeature.damage || toggleFeature.roll) {
                    console.log(`⚔️ Added toggle feature to actions: ${toggleFeature.name}`);
                  } else {
                    console.log(`✨ Added toggle non-attack feature to actions: ${toggleFeature.name} (${child.actionType || 'feature'})`);
                  }
                }
              }
            });
          break;

        case 'spell':
          // Extract description from object or string
          let description = '';
          if (prop.description) {
            if (typeof prop.description === 'object' && prop.description.text) {
              description = prop.description.text;
            } else if (typeof prop.description === 'object' && prop.description.value) {
              description = prop.description.value;
            } else if (typeof prop.description === 'string') {
              description = prop.description;
            }
          }

          // Also check for summary field
          if (!description && prop.summary) {
            if (typeof prop.summary === 'object' && prop.summary.text) {
              description = prop.summary.text;
            } else if (typeof prop.summary === 'object' && prop.summary.value) {
              description = prop.summary.value;
            } else if (typeof prop.summary === 'string') {
              description = prop.summary;
            }
          }

          // Determine source (from parent, tags, or ancestors)
          let source = 'Unknown Source';

          // Extract parent ID (handle both string and object formats)
          const parentId = typeof prop.parent === 'object' ? prop.parent?.id : prop.parent;

          // Debug: Log parent and ancestors info for ALL spells to diagnose the issue
          console.log(`🔍 Spell "${prop.name}" debug:`, {
            parent: prop.parent,
            parentId: parentId,
            parentInMap: parentId ? propertyIdToName.has(parentId) : false,
            parentName: parentId ? propertyIdToName.get(parentId) : null,
            ancestors: prop.ancestors,
            ancestorsInMap: prop.ancestors ? prop.ancestors.map(ancestor => {
              const ancestorId = typeof ancestor === 'object' ? ancestor.id : ancestor;
              return {
                ancestor,
                ancestorId,
                inMap: propertyIdToName.has(ancestorId),
                name: propertyIdToName.get(ancestorId)
              };
            }) : [],
            tags: prop.tags,
            libraryTags: prop.libraryTags
          });

          // Try to get parent name from the map
          if (parentId && propertyIdToName.has(parentId)) {
            source = propertyIdToName.get(parentId);
            console.log(`✅ Found source from parent for "${prop.name}": ${source}`);
          }
          // Fallback to ancestors if parent lookup failed
          else if (prop.ancestors && prop.ancestors.length > 0) {
            // Try ALL ancestors from closest to farthest until we find one with a name
            let found = false;
            for (let i = prop.ancestors.length - 1; i >= 0 && !found; i--) {
              const ancestor = prop.ancestors[i];
              // Extract ID from ancestor (handle both string and object formats)
              const ancestorId = typeof ancestor === 'object' ? ancestor.id : ancestor;

              if (ancestorId && propertyIdToName.has(ancestorId)) {
                source = propertyIdToName.get(ancestorId);
                console.log(`✅ Found source from ancestor[${i}] for "${prop.name}": ${source}`);
                found = true;
              }
            }
            if (!found) {
              console.log(`❌ No source found in ${prop.ancestors.length} ancestors for "${prop.name}"`);
            }
          }
          // Fallback to libraryTags - parse class names from tags like "clericSpell"
          if (source === 'Unknown Source' && prop.libraryTags && prop.libraryTags.length > 0) {
            // Look for tags ending in "Spell" (like "clericSpell", "wizardSpell")
            const classSpellTags = prop.libraryTags.filter(tag =>
              tag.toLowerCase().endsWith('spell') &&
              tag.toLowerCase() !== 'spell'
            );

            if (classSpellTags.length > 0) {
              // Extract class names and capitalize them
              const classNames = classSpellTags.map(tag => {
                // Remove "Spell" suffix and capitalize
                const className = tag.replace(/Spell$/i, '');
                return className.charAt(0).toUpperCase() + className.slice(1);
              });

              source = classNames.join(' / ');
              console.log(`✅ Found source from libraryTags for "${prop.name}": ${source}`);
            }
          }
          // Fallback to regular tags
          else if (source === 'Unknown Source' && prop.tags && prop.tags.length > 0) {
            source = prop.tags.join(', ');
            console.log(`✅ Found source from tags for "${prop.name}": ${source}`);
          }

          if (source === 'Unknown Source') {
            console.log(`❌ No source found for "${prop.name}"`);
          }

          // Check if spell is from a locked feature (e.g., "11th Level Ranger" when character is level 3)
          const levelRequirement = source.match(/(\d+)(?:st|nd|rd|th)?\s+Level/i);
          const requiredLevel = levelRequirement ? parseInt(levelRequirement[1]) : 0;
          const characterLevel = characterData.level || 1;

          // Skip spells from features not yet unlocked
          if (requiredLevel > characterLevel) {
            console.log(`⏭️ Skipping "${prop.name}" from "${source}" (requires level ${requiredLevel}, character is level ${characterLevel})`);
            break;
          }

          characterData.spells.push({
            name: prop.name || 'Unnamed Spell',
            level: prop.level || 0,
            school: prop.school || '',
            castingTime: prop.castingTime || '',
            range: prop.range || '',
            components: prop.components || '',
            duration: prop.duration || '',
            description: description,
            prepared: prop.prepared || false,
            source: source,
            concentration: prop.concentration || false,
            ritual: prop.ritual || false
          });
          break;

        case 'item':
        case 'equipment':
          characterData.inventory.push({
            name: prop.name || 'Unnamed Item',
            quantity: prop.quantity || 1,
            weight: prop.weight || 0,
            description: prop.description || '',
            equipped: prop.equipped || false
          });
          break;

        case 'proficiency':
          characterData.proficiencies.push({
            name: prop.name || '',
            type: prop.proficiencyType || 'other'
          });
          break;

        case 'action':
          // Extract all actions (attacks, bonus actions, reactions, etc.)
          if (prop.name && !prop.inactive && !prop.disabled) {
            // Handle description - it might be in 'summary' or 'description' field
            let description = '';
            if (prop.summary) {
              if (typeof prop.summary === 'string') {
                description = prop.summary;
              } else if (typeof prop.summary === 'object') {
                description = prop.summary.text || prop.summary.value || '';
              }
            } else if (prop.description) {
              if (typeof prop.description === 'string') {
                description = prop.description;
              } else if (typeof prop.description === 'object') {
                description = prop.description.text || prop.description.value || '';
              }
            }

            // Build attack roll formula from the calculated value
            let attackRoll = '';
            if (prop.attackRoll) {
              if (typeof prop.attackRoll === 'string') {
                attackRoll = prop.attackRoll;
              } else if (typeof prop.attackRoll === 'object' && prop.attackRoll.value !== undefined) {
                // Build the full d20 formula from the calculated bonus
                const bonus = prop.attackRoll.value;
                attackRoll = bonus >= 0 ? `1d20+${bonus}` : `1d20${bonus}`;
              } else if (typeof prop.attackRoll === 'number') {
                // If it's just a number, construct the formula
                const bonus = prop.attackRoll;
                attackRoll = bonus >= 0 ? `1d20+${bonus}` : `1d20${bonus}`;
              }
            }

            // Find damage properties that are descendants of this action
            // Damage can be nested under onHit or other child properties
            const damageProperties = properties.filter(p => {
              if (p.type !== 'damage') return false;

              // Check if this action is in the damage property's ancestors
              if (p.ancestors && Array.isArray(p.ancestors)) {
                return p.ancestors.some(ancestor => ancestor.id === prop._id);
              }

              // Fallback: check direct parent
              return p.parent && p.parent.id === prop._id;
            });

            let damage = '';
            let damageType = '';

            if (damageProperties.length > 0) {
              // Use the first damage property (weapons typically have one main damage)
              const damageProp = damageProperties[0];

              // Extract damage formula with modifiers
              if (damageProp.amount) {
                if (typeof damageProp.amount === 'string') {
                  damage = damageProp.amount;
                } else if (typeof damageProp.amount === 'object') {
                  // Get base calculation (e.g., "1d8")
                  damage = damageProp.amount.calculation || damageProp.amount.value || damageProp.amount.text || '';

                  // Add effects (modifiers) to build complete formula
                  if (damageProp.amount.effects && Array.isArray(damageProp.amount.effects)) {
                    for (const effect of damageProp.amount.effects) {
                      if (effect.operation === 'add' && effect.amount) {
                        // Skip dice formula calculations (like "3d6" from Sneak Attack toggle)
                        // These are handled by separate action buttons
                        if (effect.amount.calculation) {
                          console.log(`⏭️ Skipping dice formula effect in weapon damage: ${effect.amount.calculation} (handled by separate action)`);
                          continue;
                        }
                        // Only add numeric modifiers (like +4 from Dex)
                        if (effect.amount.value !== undefined) {
                          const modifier = effect.amount.value;
                          if (modifier !== 0) {
                            damage += modifier >= 0 ? `+${modifier}` : `${modifier}`;
                          }
                        }
                      }
                    }
                  }
                }
              }

              if (damageProp.damageType) {
                damageType = damageProp.damageType;
              }
            }

            // Add action if it has attack roll OR if it's a non-attack action (bonus action, reaction, etc.)
            const validActionTypes = ['action', 'bonus', 'reaction', 'free', 'legendary', 'lair', 'other'];
            const hasValidActionType = prop.actionType && validActionTypes.includes(prop.actionType.toLowerCase());

            if (attackRoll || hasValidActionType || description) {
              const action = {
                name: prop.name,
                actionType: prop.actionType || 'other',
                attackRoll: attackRoll,
                damage: damage,
                damageType: damageType,
                description: description,
                uses: prop.uses || null,
                usesUsed: prop.usesUsed || 0
              };

              characterData.actions.push(action);

              if (attackRoll) {
                console.log(`⚔️ Added attack action: ${action.name} (attack: ${attackRoll}, damage: ${damage} ${damageType})`);
              } else {
                console.log(`✨ Added non-attack action: ${action.name} (${prop.actionType || 'other'})`);
              }
            }
          } else if (prop.inactive || prop.disabled) {
            console.log(`⏭️ Skipped action: ${prop.name} (inactive: ${!!prop.inactive}, disabled: ${!!prop.disabled})`);
          }
          break;
      }
    });

    // Debug: Log all property types found
    console.log('🔍 All property types found in character:', Array.from(propertyTypes).sort());

    // Second pass: look for subrace as a child of the race property
    if (racePropertyId && raceName) {
      console.log('🔍 Looking for subrace children of race property ID:', racePropertyId);
      const subraceProps = apiData.creatureProperties.filter(prop => {
        const isChild = prop.parent && prop.parent.id === racePropertyId;
        const hasSubraceTag = prop.tags && Array.isArray(prop.tags) && prop.tags.some(tag =>
          tag.toLowerCase().includes('subrace')
        );
        const isFolder = prop.type === 'folder';
        if (isChild) {
          console.log('🔍 Found child of race:', {
            name: prop.name,
            type: prop.type,
            tags: prop.tags,
            hasSubraceTag: hasSubraceTag,
            isFolder: isFolder
          });
        }
        // Look for folders that are children of the race and have subrace tags
        return isChild && hasSubraceTag && isFolder;
      });

      if (subraceProps.length > 0) {
        const subraceProp = subraceProps[0];
        console.log('🔍 Found subrace child property:', subraceProp.name, 'with tags:', subraceProp.tags);
        characterData.race = `${raceName} - ${subraceProp.name}`;
        console.log('🔍 Combined race with subrace:', characterData.race);
      } else {
        console.log('🔍 No subrace children found for race');
      }
    }

    // Fallback: Check for race in otherVariables if not found in properties
    if (!raceFound && !characterData.race) {
      console.log('🔍 Race not found in properties, checking otherVariables...');
      const raceVars = Object.keys(characterData.otherVariables).filter(key =>
        key.toLowerCase().includes('race') || key.toLowerCase().includes('species')
      );

      if (raceVars.length > 0) {
        // Helper function to format camelCase race names
        // e.g., "highElf" -> "High Elf", "elf" -> "Elf"
        const formatRaceName = (name) => {
          if (!name) return null;
          // Convert camelCase to space-separated (highElf -> high Elf)
          let formatted = name.replace(/([a-z])([A-Z])/g, '$1 $2');
          // Capitalize first letter of each word
          formatted = formatted.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ');
          return formatted;
        };

        // Helper function to extract race name from variable name
        // e.g., "elfRace" -> "Elf", "humanRace" -> "Human"
        const extractRaceFromVarName = (varName) => {
          const raceName = varName.replace(/race$/i, '').replace(/^race$/i, '');
          if (raceName && raceName !== varName.toLowerCase()) {
            // Capitalize first letter
            return raceName.charAt(0).toUpperCase() + raceName.slice(1);
          }
          return null;
        };

        // Try to find the best race information
        // Priority: 1) subRace with name, 2) race with name, 3) specific race variable (e.g., elfRace)
        let raceName = null;
        let suberaceName = null;

        // Check for subRace first
        const subRaceVar = raceVars.find(key => key.toLowerCase() === 'subrace');
        if (subRaceVar) {
          const subRaceValue = characterData.otherVariables[subRaceVar];
          console.log(`🔍 DEBUG: subRace value:`, subRaceValue, `type:`, typeof subRaceValue);
          if (typeof subRaceValue === 'object' && subRaceValue !== null) {
            console.log(`🔍 DEBUG: subRace object keys:`, Object.keys(subRaceValue));
            if (subRaceValue.name) {
              suberaceName = formatRaceName(subRaceValue.name);
              console.log(`🔍 Found subrace name: ${suberaceName}`);
            } else if (subRaceValue.text) {
              suberaceName = formatRaceName(subRaceValue.text);
              console.log(`🔍 Found subrace text: ${suberaceName}`);
            } else if (subRaceValue.value) {
              // Try value property
              suberaceName = formatRaceName(subRaceValue.value);
              console.log(`🔍 Found subrace value: ${suberaceName}`);
            }
          } else if (typeof subRaceValue === 'string') {
            suberaceName = formatRaceName(subRaceValue);
            console.log(`🔍 Found subrace string: ${suberaceName}`);
          }
        }

        // Check for race variable
        const raceVar = raceVars.find(key => key.toLowerCase() === 'race');
        if (raceVar) {
          const raceValue = characterData.otherVariables[raceVar];
          console.log(`🔍 DEBUG: race value:`, raceValue, `type:`, typeof raceValue);
          if (typeof raceValue === 'object' && raceValue !== null) {
            console.log(`🔍 DEBUG: race object keys:`, Object.keys(raceValue));
            if (raceValue.name) {
              raceName = formatRaceName(raceValue.name);
              console.log(`🔍 Found race name: ${raceName}`);
            } else if (raceValue.text) {
              raceName = formatRaceName(raceValue.text);
              console.log(`🔍 Found race text: ${raceName}`);
            } else if (raceValue.value) {
              raceName = formatRaceName(raceValue.value);
              console.log(`🔍 Found race value: ${raceName}`);
            }
          } else if (typeof raceValue === 'string') {
            raceName = formatRaceName(raceValue);
            console.log(`🔍 Found race string: ${raceName}`);
          }
        }

        // If we didn't find race/subrace with names, look for specific race variables (e.g., elfRace, humanRace)
        if (!raceName) {
          for (const varName of raceVars) {
            const varValue = characterData.otherVariables[varName];
            // Check if this is a specific race variable (e.g., elfRace = true)
            if (typeof varValue === 'object' && varValue !== null && varValue.value === true) {
              const extracted = extractRaceFromVarName(varName);
              if (extracted) {
                raceName = extracted;
                console.log(`🔍 Extracted race from variable name: ${varName} -> ${raceName}`);
                break;
              }
            }
          }
        }

        // Combine race and subrace if we have both
        if (raceName && suberaceName) {
          characterData.race = `${raceName} - ${suberaceName}`;
          console.log(`🔍 Combined race and subrace: ${characterData.race}`);
        } else if (suberaceName) {
          characterData.race = suberaceName;
          console.log(`🔍 Using subrace as race: ${characterData.race}`);
        } else if (raceName) {
          characterData.race = raceName;
          console.log(`🔍 Using race: ${characterData.race}`);
        } else {
          console.log('🔍 Could not determine race from variables:', raceVars);
        }
      } else {
        console.log('🔍 No race found in otherVariables either');
      }
    }

    console.log('Parsed character data:', characterData);
    return characterData;
  }

  /**
   * Extracts character data from the current page
   */
  async function extractCharacterData() {
    try {
      console.log('🚀 Starting character extraction...');
      
      // Try API first (this returns parsed data directly)
      const characterData = await fetchCharacterDataFromAPI();
      if (characterData) {
        console.log('✅ Character data extracted via API:', characterData.name);
        return characterData;
      }
      
      // Fallback to DOM extraction
      console.log('🔄 API failed, trying DOM extraction...');
      const domData = extractCharacterDataFromDOM();
      if (domData) {
        console.log('✅ Character data extracted via DOM:', domData.name);
        return domData;
      }
      
      console.error('❌ Both API and DOM extraction failed');
      return null;
    } catch (error) {
      console.error('❌ Error extracting character data:', error);
      throw error;
    }
  }

  /**
   * Handles roll requests from Roll20 character sheet
   */
  function handleRollRequest(name, formula) {
    return new Promise((resolve, reject) => {
      console.log(`🎲 Handling roll request: ${name} with formula ${formula}`);
      
      // Create a mock roll entry to simulate the roll
      const rollResult = Math.floor(Math.random() * 20) + 1;
      const totalResult = rollResult + (formula.includes('+') ? parseInt(formula.split('+')[1]) : 0);
      
      const rollData = {
        name: name,
        formula: formula,
        result: totalResult.toString(),
        timestamp: Date.now()
      };
      
      console.log('🎲 Simulated roll:', rollData);
      
      // Send the roll to Roll20 (this will trigger the existing roll forwarding)
      sendRollToRoll20(rollData);
      
      // Show a notification in Dice Cloud
      showNotification(`Rolled ${name}: ${formula} = ${totalResult} 🎲`, 'success');
      
      resolve();
    });
  }

  /**
   * Extracts spell descriptions from Dice Cloud DOM
   */
  function extractSpellsFromDOM(characterData) {
    try {
      console.log('🔍 Extracting spells from DOM...');
      console.log('🔍 Current hostname:', window.location.hostname);
      console.log('🔍 Current URL:', window.location.href);
      
      // Look for spell sections in Dice Cloud
      const spellSelectors = [
        '[class*="spell"]',
        '[class*="magic"]',
        '.spell-item',
        '.spell-card',
        '[data-spell]',
        'div:contains("spell")',
        'li:contains("spell")',
        // Dice Cloud specific selectors
        '.v-card', // Vue.js cards
        '.v-sheet', // Vue.js sheets
        '[data-v-]', // Vue.js components
        '.ma-2', // Margin classes
        '.pa-2', // Padding classes
        '.text-h6', // Header text
        '.subtitle-1', // Subtitle text
        '.caption' // Caption text
      ];
      
      const spellElements = [];
      spellSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => spellElements.push(el));
        } catch (e) {
          // Some selectors might not be supported
        }
      });
      
      console.log(`🔍 Found ${spellElements.length} potential spell elements`);
      
      // If we're not in Dice Cloud, try a broader search
      if (window.location.hostname !== 'dicecloud.com' && !window.location.hostname.includes('dicecloud')) {
        console.log('🔍 Not in Dice Cloud, trying broader search...');
        
        // Look for any text that might contain spell information
        const allElements = document.querySelectorAll('*');
        let spellTextElements = [];
        
        allElements.forEach(element => {
          const text = element.textContent || element.innerText || '';
          if (text.toLowerCase().includes('spell') || 
              text.toLowerCase().includes('level') && 
              text.toLowerCase().includes('cantrip') ||
              text.toLowerCase().includes('casting') ||
              text.toLowerCase().includes('range') ||
              text.toLowerCase().includes('duration')) {
            spellTextElements.push(element);
          }
        });
        
        console.log(`🔍 Found ${spellTextElements.length} elements with spell-related text`);
        spellElements.push(...spellTextElements);
      }
      
      // Extract spell data from each element
      spellElements.forEach((element, index) => {
        try {
          const text = element.textContent || element.innerText || '';
          const lowerText = text.toLowerCase();
          
          // Skip if this doesn't look like a spell
          if (!lowerText.includes('spell') && !lowerText.includes('level') && !lowerText.includes('cantrip')) {
            return;
          }
          
          // Skip spell slot elements
          if (lowerText.includes('spell slots') || lowerText.includes('slot') || lowerText.includes('slots')) {
            console.log(`🔍 Skipping spell slot element: ${text.substring(0, 50)}`);
            return;
          }
          
          // Skip navigation/menu elements
          if (lowerText.includes('stats') || lowerText.includes('actions') || lowerText.includes('inventory') || 
              lowerText.includes('features') || lowerText.includes('journal') || lowerText.includes('build') ||
              lowerText.includes('hit points') || lowerText.includes('armor class') || lowerText.includes('speed')) {
            console.log(`🔍 Skipping navigation element: ${text.substring(0, 50)}`);
            return;
          }
          
          // Skip elements that are too short or don't have meaningful content
          if (text.length < 20) {
            return;
          }
          
          // Skip if it looks like a character name or general navigation
          if (text.includes(characterData.name) || lowerText.includes('grey')) {
            console.log(`🔍 Skipping character name element: ${text.substring(0, 50)}`);
            return;
          }
          
          console.log(`🔍 Processing element ${index}:`, text.substring(0, 100));
          
          // Try to extract spell name (first line or bold text)
          let spellName = '';
          const boldText = element.querySelector('strong, b, [class*="name"], [class*="title"], .text-h6, .subtitle-1');
          if (boldText) {
            spellName = boldText.textContent.trim();
          } else {
            const lines = text.split('\n').filter(line => line.trim());
            spellName = lines[0]?.trim() || '';
          }
          
          // Skip if no spell name found or if it's just generic text
          if (!spellName || spellName.length < 2 || spellName.toLowerCase().includes('level') || spellName.toLowerCase().includes('spell')) {
            return;
          }
          
          // Skip if it's a known D&D spell name that should have more content
          const knownSpells = ['detect magic', 'disguise self', 'summon fey', 'fireball', 'magic missile', 'cure wounds'];
          if (knownSpells.includes(spellName.toLowerCase()) && text.length < 100) {
            console.log(`🔍 Skipping incomplete spell entry for "${spellName}"`);
            return;
          }
          
          // Extract level information
          let spellLevel = 0;
          const levelMatch = text.match(/level\s*(\d+)|cantrip|(\d+)(?:st|nd|rd|th)\s*level/i);
          if (levelMatch) {
            spellLevel = levelMatch[1] ? parseInt(levelMatch[1]) : (levelMatch[2] ? parseInt(levelMatch[2]) : 0);
          }
          
          // Extract description (everything after the first few lines)
          let description = '';
          const lines = text.split('\n').filter(line => line.trim());
          if (lines.length > 2) {
            // Skip first 1-2 lines (usually name/level info)
            description = lines.slice(2).join('\n').trim();
          }
          
          // Clean up description - remove any [object Object] text
          description = description.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '').replace(/\[object Object\]/g, '').trim();
          
          // Only add if we have meaningful content
          if (description && description.length > 10) {
            // Check if we already have this spell
            const existingSpell = characterData.spells.find(s => 
              s.name.toLowerCase() === spellName.toLowerCase()
            );
            
            if (existingSpell) {
              // Update existing spell with description
              existingSpell.description = description;
              console.log(`✅ Updated description for "${spellName}": "${description.substring(0, 50)}..."`);
            } else {
              // Add new spell
              characterData.spells.push({
                name: spellName,
                level: spellLevel,
                description: description,
                school: '',
                castingTime: '',
                range: '',
                components: '',
                duration: '',
                prepared: false
              });
              console.log(`✅ Added new spell "${spellName}" (Level ${spellLevel}): "${description.substring(0, 50)}..."`);
            }
          } else {
            console.log(`🔍 No meaningful description found for "${spellName}"`);
          }
        } catch (error) {
          console.error(`❌ Error processing spell element ${index}:`, error);
        }
      });
      
      console.log(`✅ Spell extraction complete. Found ${characterData.spells.length} spells with descriptions.`);
    } catch (error) {
      console.error('❌ Error extracting spells from DOM:', error);
    }
  }

  /**
   * Extracts character data from DOM elements (fallback method)
   */
  function extractCharacterDataFromDOM() {
    try {
      console.log('🔍 Extracting character data from DOM...');
      
      const characterData = {
        name: '',
        level: 1,
        class: '',
        race: '',
        attributes: {},
        attributeMods: {},
        skills: {},
        savingThrows: {},
        hitPoints: 0,
        armorClass: 10,
        speed: 30,
        proficiencyBonus: 2,
        initiative: 0,
        otherVariables: {},
        features: [],
        spells: []
      };

      // Try to find character name
      const nameElement = document.querySelector('[class*="name"], [class*="character"], h1, h2');
      if (nameElement) {
        characterData.name = nameElement.textContent.trim() || 'Unknown Character';
      }

      // Try to find basic stats from common selectors
      const statElements = document.querySelectorAll('[class*="stat"], [class*="attribute"], [class*="ability"]');
      statElements.forEach(element => {
        const text = element.textContent.trim();
        if (text.includes('STR') || text.includes('Strength')) {
          const match = text.match(/(\d+)/);
          if (match) characterData.attributes.strength = parseInt(match[1]);
        }
        if (text.includes('DEX') || text.includes('Dexterity')) {
          const match = text.match(/(\d+)/);
          if (match) characterData.attributes.dexterity = parseInt(match[1]);
        }
        if (text.includes('CON') || text.includes('Constitution')) {
          const match = text.match(/(\d+)/);
          if (match) characterData.attributes.constitution = parseInt(match[1]);
        }
        if (text.includes('INT') || text.includes('Intelligence')) {
          const match = text.match(/(\d+)/);
          if (match) characterData.attributes.intelligence = parseInt(match[1]);
        }
        if (text.includes('WIS') || text.includes('Wisdom')) {
          const match = text.match(/(\d+)/);
          if (match) characterData.attributes.wisdom = parseInt(match[1]);
        }
        if (text.includes('CHA') || text.includes('Charisma')) {
          const match = text.match(/(\d+)/);
          if (match) characterData.attributes.charisma = parseInt(match[1]);
        }
      });

      // Calculate modifiers (standard D&D 5e formula)
      Object.keys(characterData.attributes).forEach(attr => {
        const score = characterData.attributes[attr] || 10;
        characterData.attributeMods[attr] = Math.floor((score - 10) / 2);
      });

      // Extract spells from the page
      extractSpellsFromDOM(characterData);

      console.log('✅ DOM extraction completed:', characterData);
      return characterData;
    } catch (error) {
      console.error('❌ Error extracting from DOM:', error);
      return null;
    }
  }

  /**
   * Extracts character data from the current page
   */
  async function extractAndStoreCharacterData() {
    try {
      console.log('🚀 Starting character extraction...');
      showNotification('Extracting character data...', 'info');

      const characterData = await fetchCharacterDataFromAPI();

      if (characterData && characterData.name) {
        // Send to background script for storage
        try {
          browserAPI.runtime.sendMessage({
            action: 'storeCharacterData',
            data: characterData
          }, (response) => {
            if (browserAPI.runtime.lastError) {
              console.error('❌ Extension context error:', browserAPI.runtime.lastError);
              showNotification('Extension reloaded. Please refresh the page.', 'error');
              return;
            }
            
            if (response && response.success) {
              console.log('✅ Character data stored successfully');
              showNotification(`${characterData.name} extracted! Navigate to Roll20 to import.`, 'success');
            } else {
              console.error('❌ Failed to store character data:', response && response.error);
              showNotification('Failed to store character data', 'error');
            }
          });
        } catch (error) {
          console.error('❌ Extension context invalidated:', error);
          showNotification('Extension reloaded. Please refresh the page.', 'error');
        }
      } else {
        console.error('❌ No character name found');
        showNotification('Failed to extract character data', 'error');
      }
    } catch (error) {
      console.error('❌ Error extracting character:', error);
      console.error('Stack trace:', error.stack);
      showNotification(error.message, 'error');
    }
  }

  /**
   * Shows a notification to the user
   */
  function showNotification(message, type = 'info') {
    const colors = {
      success: '#4CAF50',
      error: '#f44336',
      info: '#2196F3'
    };

    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 16px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 300px;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }

  /**
   * Adds an export button to the Dice Cloud UI
   */
  function addExportButton() {
    // Export button removed - only sync button needed
    console.log('📋 Export button disabled - using sync button instead');
    return;
    
    // Wait for page to fully load
    if (document.readyState !== 'complete') {
      window.addEventListener('load', addExportButton);
      return;
    }

    // Avoid adding duplicate buttons
    if (document.getElementById('dc-roll20-export-btn')) {
      return;
    }

    const button = document.createElement('button');
    button.id = 'dc-roll20-export-btn';
    button.textContent = 'Export to Roll20';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #e74c3c;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: move;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 10000;
      transition: background 0.3s;
      user-select: none;
    `;
    button.addEventListener('mouseenter', () => {
      button.style.background = '#c0392b';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#e74c3c';
    });
    button.addEventListener('click', (e) => {
      // Shift+Click for debug mode
      if (e.shiftKey) {
        debugPageStructure();
        showNotification('Debug info logged to console (F12)', 'info');
      } else {
        extractAndStoreCharacterData();
      }
    });

    document.body.appendChild(button);
    makeDraggable(button);

    // Debug button removed - only sync button needed
    console.log('🔍 Debug button disabled');
  }

  /**
   * Listens for messages from popup and other parts of the extension
   */
  browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('DiceCloud received message:', request);

    switch (request.action) {
      case 'syncCharacter':
        syncCharacterData()
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((error) => {
            console.error('Error syncing character:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Keep channel open for async response

      case 'rollInDiceCloud':
        // Handle roll request from Roll20 character sheet
        handleRollRequest(request.roll.name, request.roll.formula)
          .then(() => {
            console.log('✅ Roll handled in Dice Cloud');
            sendResponse({ success: true });
          })
          .catch((error) => {
            console.error('❌ Failed to handle roll in Dice Cloud:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true;

      case 'extractCharacter':
        extractCharacterData()
          .then((data) => {
            sendResponse({ success: true, data });
          })
          .catch((error) => {
            console.error('Error extracting character:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true;

      default:
        console.warn('Unknown action:', request.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
  });

  /**
   * Debug: Analyzes the page structure to find roll-related elements
   */
  function debugPageStructure() {
    console.log('=== DICECLOUD ROLL LOG DEBUG ===');

    // Find all elements that might be the roll log
    const potentialSelectors = [
      '.dice-stream',
      '[class*="dice"]',
      '[class*="roll"]',
      '[class*="log"]',
      '[class*="sidebar"]',
      '[class*="right"]',
      'aside',
      '[role="complementary"]'
    ];

    console.log('Searching for roll log container...');
    potentialSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`Found ${elements.length} element(s) matching "${selector}":`);
        elements.forEach((el, i) => {
          console.log(`  [${i}] Classes:`, el.className);
          console.log(`  [${i}] ID:`, el.id);
          console.log(`  [${i}] Tag:`, el.tagName);
          console.log(`  [${i}] Text preview:`, el.textContent && el.textContent.substring(0, 100));
        });
      }
    });

    // Look for elements containing dice notation patterns
    console.log('\nSearching for elements with dice notation (e.g., "1d20 [ 6 ]", "2d6+3")...');
    const allElements = document.querySelectorAll('*');
    const dicePattern = /\d+d\d+\s*\[/i; // DiceCloud format: 1d20 [ 6 ]
    const elementsWithDice = [];

    allElements.forEach(el => {
      const text = el.textContent || '';
      if (text.match(dicePattern)) {
        elementsWithDice.push({
          tag: el.tagName,
          classes: el.className,
          id: el.id,
          text: text.substring(0, 100),
          parent: el.parentElement && el.parentElement.className,
          childCount: el.children.length,
          element: el // Store reference for inspection
        });
      }
    });

    if (elementsWithDice.length > 0) {
      console.log(`Found ${elementsWithDice.length} elements with dice notation:`);
      console.table(elementsWithDice.slice(0, 20));
      console.log('\n📋 Full element details (expand to inspect):');
      elementsWithDice.slice(0, 5).forEach((item, i) => {
        console.log(`\n[${i}] Element:`, item.element);
        console.log(`[${i}] Full text (first 200 chars):\n`, item.element.textContent.substring(0, 200));
        console.log(`[${i}] Parent chain:`, getParentChain(item.element));
      });
    } else {
      console.log('❌ No elements with dice notation found!');
      console.log('This might mean:');
      console.log('1. No rolls have been made yet - try making a roll');
      console.log('2. Rolls appear in a different format');
      console.log('3. Rolls are in a shadow DOM or iframe');
    }

    // Helper to show parent chain
    function getParentChain(el) {
      const chain = [];
      let current = el;
      for (let i = 0; i < 5 && current; i++) {
        chain.push({
          tag: current.tagName,
          class: current.className,
          id: current.id
        });
        current = current.parentElement;
      }
      return chain;
    }

    console.log('\n=== END DEBUG ===');
    console.log('Instructions:');
    console.log('1. Make a test roll in DiceCloud');
    console.log('2. Run debugPageStructure() again to see the new elements');
    console.log('3. Right-click on the roll in the page and select "Inspect" to see its HTML structure');
  }

  /**
   * Observes the DiceCloud roll log and sends rolls to Roll20
   */
  function observeRollLog() {
    // Find the roll log container - DiceCloud uses .card-raised-background
    const findRollLog = () => {
      // DiceCloud v2+ roll log structure
      const selectors = [
        '.card-raised-background', // Primary roll log container
        '.character-log',          // Alternative log container
        '[class*="log"]'           // Fallback
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          console.log('✓ Roll log detection: Found roll log using selector:', selector);
          console.log('Roll log element:', element);
          return element;
        }
      }
      return null;
    };

    const rollLog = findRollLog();
    if (!rollLog) {
      console.log('⏳ Roll log not found, will retry in 2 seconds...');
      console.log('💡 Run window.debugDiceCloudRolls() in console for detailed debug info');
      setTimeout(observeRollLog, 2000);
      return;
    }

    console.log('✅ Observing DiceCloud roll log for new rolls');
    console.log('📋 Roll log classes:', rollLog.className);
    console.log('🎲 Ready to detect rolls!');

    // Track when we start observing to ignore existing nodes
    const observerStartTime = Date.now();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this is a log-entry (individual roll)
            if (node.className && node.className.includes('log-entry')) {
              // Only process rolls that were added after we started observing
              // This prevents processing existing rolls on page load/reload
              const nodeTimestamp = node.getAttribute('data-timestamp') || 
                                 node.querySelector('[data-timestamp]')?.getAttribute('data-timestamp');
              
              // Only process if we can find a valid timestamp
              if (nodeTimestamp && parseInt(nodeTimestamp) > observerStartTime) {
                console.log('🎲 New roll detected:', node);

                // Try to parse the roll from the added node
                const rollData = parseRollFromElement(node);
                if (rollData) {
                  console.log('✅ Successfully parsed roll:', rollData);
                  sendRollToRoll20(rollData);
                } else {
                  console.log('⚠️  Could not parse roll data from element');
                }
              } else if (!nodeTimestamp) {
                console.log('🔄 Ignoring node without timestamp (likely existing content)');
              } else {
                console.log('🔄 Ignoring existing roll entry (added before observer started)');
              }
            }
          }
        });
      });
    });

    observer.observe(rollLog, {
      childList: true,
      subtree: true
    });

    console.log('💡 TIP: Make a test roll to see if it gets detected');
  }

  // Expose debug function globally for console access
  window.debugDiceCloudRolls = debugPageStructure;

  /**
   * Parses roll data from a DOM element
   * DiceCloud v2 format:
   * <div class="log-entry">
   *   <h4 class="content-name">Strength check</h4>
   *   <div class="content-value"><p>1d20 [ 6 ] + 0 = <strong>6</strong></p></div>
   * </div>
   */
  function parseRollFromElement(element) {
    try {
      // Extract roll name from the text content
      const fullText = element.textContent || element.innerText || '';
      console.log('🔍 Full roll text:', fullText);
      
      // Extract the roll name (first line before the formula)
      const lines = fullText.split('\n').filter(line => line.trim());
      const name = lines[0]?.trim() || 'Unknown Roll';
      
      // Find the formula line (contains dice notation)
      const formulaLine = lines.find(line => line.includes('d20') || line.includes('d6') || line.includes('d8') || line.includes('d10') || line.includes('d12') || line.includes('d4'));
      
      if (!formulaLine) {
        console.log('⚠️  No dice formula found in roll text');
        return null;
      }

      console.log('📊 Formula line:', formulaLine);

      // Parse DiceCloud format: "Strength check\n1d20 [ 17 ] + 0 = 17"
      // Extract the formula and result
      const formulaMatch = formulaLine.match(/^(.+?)\s*=\s*(.+)$/);

      if (!formulaMatch) {
        console.log('⚠️  Could not parse formula from:', formulaLine);
        return null;
      }

      // Clean up the formula - remove the [ actual roll ] part for Roll20
      // "1d20 [ 17 ] + 0" -> "1d20+0"
      let formula = formulaMatch[1].replace(/\s*\[\s*\d+\s*\]\s*/g, '').trim();

      // Remove extra spaces
      formula = formula.replace(/\s+/g, '');

      const result = formulaMatch[2].trim();

      console.log(`📊 Parsed: name="${name}", formula="${formula}", result="${result}"`);

      return {
        name: name,
        formula: formula,
        result: result,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Error parsing roll element:', error);
      return null;
    }
  }

  /**
   * Draggable Element System
   */
  const dragState = {
    positions: {},
    isDragging: false,
    currentElement: null,
    startX: 0,
    startY: 0,
    elementX: 0,
    elementY: 0
  };

  // Load saved positions from storage
  chrome.storage.local.get(['panelPositions'], (result) => {
    if (result.panelPositions) {
      dragState.positions = result.panelPositions;
    }
  });

  function savePositions() {
    chrome.storage.local.set({ panelPositions: dragState.positions });
  }

  function makeDraggable(element, handleSelector) {
    const elementId = element.id;
    let hasMoved = false;
    let clickTimeout = null;

    // Restore saved position
    if (dragState.positions[elementId]) {
      const pos = dragState.positions[elementId];
      element.style.left = pos.x + 'px';
      element.style.top = pos.y + 'px';
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    }

    const handle = handleSelector ? element.querySelector(handleSelector) : element;
    if (!handle) return;

    handle.addEventListener('mousedown', (e) => {
      // Don't drag if clicking toggle button
      if (e.target.classList.contains('history-toggle') ||
          e.target.classList.contains('stats-toggle') ||
          e.target.classList.contains('settings-toggle')) {
        return;
      }

      hasMoved = false;
      dragState.isDragging = false;
      dragState.currentElement = element;
      dragState.startX = e.clientX;
      dragState.startY = e.clientY;

      // Get current position
      const rect = element.getBoundingClientRect();
      dragState.elementX = rect.left;
      dragState.elementY = rect.top;

      // Wait a bit before starting drag (prevents accidental drags on click)
      clickTimeout = setTimeout(() => {
        if (dragState.currentElement === element) {
          dragState.isDragging = true;
          element.style.transition = 'none';
          element.style.opacity = '0.8';
          handle.style.cursor = 'grabbing';
        }
      }, 100);

      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (dragState.currentElement !== element) return;

      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;

      // Check if we've moved enough to count as dragging
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasMoved = true;

        if (dragState.isDragging) {
          const newX = dragState.elementX + dx;
          const newY = dragState.elementY + dy;

          // Keep element on screen
          const maxX = window.innerWidth - element.offsetWidth;
          const maxY = window.innerHeight - element.offsetHeight;

          const clampedX = Math.max(0, Math.min(newX, maxX));
          const clampedY = Math.max(0, Math.min(newY, maxY));

          element.style.left = clampedX + 'px';
          element.style.top = clampedY + 'px';
          element.style.right = 'auto';
          element.style.bottom = 'auto';
        }
      }

      e.preventDefault();
    });

    document.addEventListener('mouseup', (e) => {
      if (dragState.currentElement !== element) return;

      clearTimeout(clickTimeout);

      const wasDragging = dragState.isDragging && hasMoved;

      dragState.isDragging = false;
      dragState.currentElement = null;

      element.style.transition = '';
      element.style.opacity = '1';
      handle.style.cursor = 'move';

      // Save position if we actually dragged
      if (wasDragging) {
        const rect = element.getBoundingClientRect();
        dragState.positions[elementId] = {
          x: rect.left,
          y: rect.top
        };
        savePositions();
      }
    });
  }

  /**
   * Roll Statistics and History Tracking
   */
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

  // Load settings from storage
  chrome.storage.local.get(['rollSettings'], (result) => {
    if (result.rollSettings) {
      Object.assign(rollStats.settings, result.rollSettings);
    }
    // Update settings panel if it exists
    updateSettingsPanel();
  });

  function saveSettings() {
    chrome.storage.local.set({ rollSettings: rollStats.settings });
  }

  function detectAdvantageDisadvantage(rollData) {
    const name = rollData.name.toLowerCase();
    if (name.includes('advantage') || name.includes('adv')) {
      return 'advantage';
    } else if (name.includes('disadvantage') || name.includes('dis')) {
      return 'disadvantage';
    }
    return 'normal';
  }

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

    const critical = detectCritical(rollData);
    if (critical === 'critical-success') rollStats.stats.criticalSuccesses++;
    if (critical === 'critical-failure') rollStats.stats.criticalFailures++;
  }

  function addToRollHistory(rollData) {
    const advantageType = detectAdvantageDisadvantage(rollData);
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

    updateRollStatistics(rollData);
    updateRollHistoryPanel();
    updateStatsPanel();
  }

  /**
   * Animated Roll Notification
   */
  function showRollNotification(rollData) {
    if (!rollStats.settings.showNotifications) return;

    const critical = detectCritical(rollData);
    const advantage = detectAdvantageDisadvantage(rollData);

    let bgGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    let icon = '🎲';

    if (critical === 'critical-success') {
      bgGradient = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
      icon = '⭐';
    } else if (critical === 'critical-failure') {
      bgGradient = 'linear-gradient(135deg, #4e54c8 0%, #8f94fb 100%)';
      icon = '💀';
    }

    const notification = document.createElement('div');
    notification.className = 'dc-roll-notification';
    notification.innerHTML = `
      <div class="notification-icon">${icon}</div>
      <div class="notification-content">
        <div class="notification-title">${rollData.name}</div>
        <div class="notification-formula">${rollData.formula} = <strong>${rollData.result}</strong></div>
        <div class="notification-status">
          ${critical ? `<span class="critical-badge">${critical.toUpperCase().replace('-', ' ')}</span>` : ''}
          ${advantage !== 'normal' ? `<span class="advantage-badge">${advantage.toUpperCase()}</span>` : ''}
          <span>Sent to Roll20! 🚀</span>
        </div>
      </div>
    `;

    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: -450px;
      background: ${bgGradient};
      color: white;
      padding: 20px;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.4);
      z-index: 100001;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      min-width: 350px;
      display: flex;
      align-items: center;
      gap: 16px;
      transition: right 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      animation: pulse-glow 2s infinite;
    `;

    addNotificationStyles();
    document.body.appendChild(notification);

    // Slide in
    setTimeout(() => {
      notification.style.right = '20px';
    }, 10);

    // Slide out
    setTimeout(() => {
      notification.style.right = '-450px';
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 500);
    }, 4000);
  }

  function addNotificationStyles() {
    if (document.querySelector('.dc-roll-notification-styles')) return;

    const style = document.createElement('style');
    style.className = 'dc-roll-notification-styles';
    style.textContent = `
      .dc-roll-notification .notification-icon {
        font-size: 40px;
        animation: roll-bounce 0.8s ease-in-out infinite alternate;
      }

      .dc-roll-notification .notification-title {
        font-weight: bold;
        font-size: 15px;
        margin-bottom: 6px;
        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }

      .dc-roll-notification .notification-formula {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
        font-family: 'Courier New', monospace;
      }

      .dc-roll-notification .notification-status {
        font-size: 12px;
        opacity: 0.95;
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }

      .dc-roll-notification .critical-badge,
      .dc-roll-notification .advantage-badge {
        background: rgba(255,255,255,0.3);
        padding: 3px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: bold;
        letter-spacing: 0.5px;
      }

      @keyframes roll-bounce {
        0% { transform: rotate(-5deg) scale(1); }
        100% { transform: rotate(5deg) scale(1.15); }
      }

      @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 12px 32px rgba(0,0,0,0.4); }
        50% { box-shadow: 0 12px 48px rgba(255,255,255,0.3), 0 0 32px rgba(255,255,255,0.2); }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Roll History Panel
   */
  function createRollHistoryPanel() {
    if (document.getElementById('dc-roll-history')) return;

    const panel = document.createElement('div');
    panel.id = 'dc-roll-history';
    panel.innerHTML = `
      <div class="history-header">
        <span class="history-title">🎲 Roll History</span>
        <button class="history-toggle">−</button>
      </div>
      <div class="history-content">
        <div class="history-list"></div>
      </div>
    `;

    panel.style.cssText = `
      position: fixed;
      bottom: 180px;
      right: 20px;
      background: rgba(20, 20, 30, 0.98);
      backdrop-filter: blur(12px);
      color: white;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.5);
      z-index: 10000;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      width: 380px;
      max-height: 500px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: ${rollStats.settings.showHistory ? 'block' : 'none'};
    `;

    addHistoryStyles();
    document.body.appendChild(panel);

    // Make draggable
    makeDraggable(panel, '.history-header');

    // Toggle functionality
    let isCollapsed = false;
    panel.querySelector('.history-header').addEventListener('click', (e) => {
      // Only toggle if not dragging
      if (e.target === panel.querySelector('.history-toggle')) {
        const content = panel.querySelector('.history-content');
        const toggle = panel.querySelector('.history-toggle');

        if (isCollapsed) {
          content.style.display = 'block';
          toggle.textContent = '−';
        } else {
          content.style.display = 'none';
          toggle.textContent = '+';
        }

        isCollapsed = !isCollapsed;
      }
    });
  }

  function addHistoryStyles() {
    if (document.querySelector('.dc-roll-history-styles')) return;

    const style = document.createElement('style');
    style.className = 'dc-roll-history-styles';
    style.textContent = `
      #dc-roll-history .history-header {
        padding: 16px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        border-radius: 16px 16px 0 0;
      }

      #dc-roll-history .history-title {
        font-weight: bold;
        font-size: 16px;
      }

      #dc-roll-history .history-toggle {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: background 0.2s;
      }

      #dc-roll-history .history-toggle:hover {
        background: rgba(255,255,255,0.3);
      }

      #dc-roll-history .history-content {
        max-height: 440px;
        overflow-y: auto;
        padding: 12px;
      }

      #dc-roll-history .history-content::-webkit-scrollbar {
        width: 8px;
      }

      #dc-roll-history .history-content::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
      }

      #dc-roll-history .history-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }

      #dc-roll-history .history-item {
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
        padding: 12px 14px;
        border-radius: 12px;
        margin-bottom: 8px;
        animation: slide-in-history 0.4s ease-out;
        border-left: 4px solid #667eea;
        transition: all 0.2s;
      }

      #dc-roll-history .history-item:hover {
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
        transform: translateX(-4px);
      }

      #dc-roll-history .history-item.critical-success {
        border-left-color: #f5576c;
        background: linear-gradient(135deg, rgba(245, 87, 108, 0.2) 0%, rgba(240, 147, 251, 0.1) 100%);
      }

      #dc-roll-history .history-item.critical-failure {
        border-left-color: #4e54c8;
        background: linear-gradient(135deg, rgba(78, 84, 200, 0.2) 0%, rgba(143, 148, 251, 0.1) 100%);
      }

      #dc-roll-history .history-item-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
        align-items: center;
      }

      #dc-roll-history .history-name {
        font-weight: 600;
        font-size: 14px;
      }

      #dc-roll-history .history-time {
        font-size: 11px;
        opacity: 0.6;
      }

      #dc-roll-history .history-formula {
        font-size: 13px;
        opacity: 0.95;
        font-family: 'Courier New', monospace;
        margin-bottom: 4px;
      }

      #dc-roll-history .history-badges {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      #dc-roll-history .history-badge {
        background: rgba(255,255,255,0.15);
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      @keyframes slide-in-history {
        from {
          opacity: 0;
          transform: translateX(30px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `;

    document.head.appendChild(style);
  }

  function updateRollHistoryPanel() {
    const panel = document.getElementById('dc-roll-history');
    if (!panel) return;

    const list = panel.querySelector('.history-list');
    if (!list) return;

    list.innerHTML = rollStats.history.map((roll, index) => {
      const timeAgo = getTimeAgo(roll.timestamp);
      const criticalClass = roll.criticalType ? roll.criticalType : '';

      let badges = '';
      if (roll.criticalType) {
        badges += `<span class="history-badge">${roll.criticalType.replace('-', ' ')}</span>`;
      }
      if (roll.advantageType && roll.advantageType !== 'normal') {
        badges += `<span class="history-badge">${roll.advantageType}</span>`;
      }

      return `
        <div class="history-item ${criticalClass}" style="animation-delay: ${index * 0.03}s">
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

  function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  /**
   * Roll Statistics Panel
   */
  function createStatsPanel() {
    if (document.getElementById('dc-roll-stats')) return;

    const panel = document.createElement('div');
    panel.id = 'dc-roll-stats';
    panel.innerHTML = `
      <div class="stats-header">
        <span class="stats-title">📊 Statistics</span>
        <button class="stats-toggle">−</button>
      </div>
      <div class="stats-content">
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
    `;

    panel.style.cssText = `
      position: fixed;
      bottom: 690px;
      right: 20px;
      background: rgba(20, 20, 30, 0.98);
      backdrop-filter: blur(12px);
      color: white;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.5);
      z-index: 10000;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      width: 380px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: ${rollStats.settings.showHistory ? 'block' : 'none'};
    `;

    addStatsStyles();
    document.body.appendChild(panel);

    // Make draggable
    makeDraggable(panel, '.stats-header');

    // Toggle functionality
    let isCollapsed = false;
    panel.querySelector('.stats-header').addEventListener('click', (e) => {
      // Only toggle if clicking the toggle button
      if (e.target === panel.querySelector('.stats-toggle')) {
        const content = panel.querySelector('.stats-content');
        const toggle = panel.querySelector('.stats-toggle');

        if (isCollapsed) {
          content.style.display = 'grid';
          toggle.textContent = '−';
        } else {
          content.style.display = 'none';
          toggle.textContent = '+';
        }

        isCollapsed = !isCollapsed;
      }
    });
  }

  function addStatsStyles() {
    if (document.querySelector('.dc-roll-stats-styles')) return;

    const style = document.createElement('style');
    style.className = 'dc-roll-stats-styles';
    style.textContent = `
      #dc-roll-stats .stats-header {
        padding: 16px 20px;
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        border-radius: 16px 16px 0 0;
      }

      #dc-roll-stats .stats-title {
        font-weight: bold;
        font-size: 16px;
      }

      #dc-roll-stats .stats-toggle {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: background 0.2s;
      }

      #dc-roll-stats .stats-toggle:hover {
        background: rgba(255,255,255,0.3);
      }

      #dc-roll-stats .stats-content {
        padding: 16px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      #dc-roll-stats .stat-item {
        background: rgba(255,255,255,0.05);
        padding: 12px;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      #dc-roll-stats .stat-label {
        font-size: 12px;
        opacity: 0.7;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      #dc-roll-stats .stat-value {
        font-size: 24px;
        font-weight: bold;
        color: #667eea;
      }
    `;

    document.head.appendChild(style);
  }

  function updateStatsPanel() {
    // Check if stats panel exists before trying to update it
    const statsPanel = document.getElementById('dc-roll-stats');
    if (!statsPanel) return;

    const statTotal = document.getElementById('stat-total');
    const statAverage = document.getElementById('stat-average');
    const statHighest = document.getElementById('stat-highest');
    const statLowest = document.getElementById('stat-lowest');
    const statCrits = document.getElementById('stat-crits');
    const statFails = document.getElementById('stat-fails');

    if (statTotal) {
      statTotal.setAttribute('data-value', rollStats.stats.totalRolls);
      statTotal.textContent = rollStats.stats.totalRolls.toString();
    }
    if (statAverage) statAverage.textContent = rollStats.stats.averageRoll.toFixed(1);
    if (statHighest) statHighest.textContent = rollStats.stats.highestRoll.toString();
    if (statLowest) {
      statLowest.textContent = rollStats.stats.lowestRoll === Infinity ? '∞' : rollStats.stats.lowestRoll.toString();
    }
    if (statCrits) statCrits.textContent = rollStats.stats.criticalSuccesses.toString();
    if (statFails) statFails.textContent = rollStats.stats.criticalFailures.toString();
  }

  /**
   * Roll Settings Panel
   */
  function createSettingsPanel() {
    if (document.getElementById('dc-roll-settings')) return;

    const panel = document.createElement('div');
    panel.id = 'dc-roll-settings';
    panel.innerHTML = `
      <div class="settings-header">
        <span class="settings-title">⚙️ Roll Settings</span>
        <button class="settings-toggle">−</button>
      </div>
      <div class="settings-content">
        <div class="setting-group">
          <label class="setting-label">Roll Mode</label>
          <div class="toggle-buttons">
            <button class="toggle-btn ${rollStats.settings.advantageMode === 'normal' ? 'active' : ''}" data-mode="normal">
              Normal
            </button>
            <button class="toggle-btn ${rollStats.settings.advantageMode === 'advantage' ? 'active' : ''}" data-mode="advantage">
              Advantage
            </button>
            <button class="toggle-btn ${rollStats.settings.advantageMode === 'disadvantage' ? 'active' : ''}" data-mode="disadvantage">
              Disadvantage
            </button>
          </div>
          <div class="setting-description">
            <span id="mode-description">
              ${rollStats.settings.advantageMode === 'advantage' ? '🎲 Rolling with advantage (2d20kh1)' :
                rollStats.settings.advantageMode === 'disadvantage' ? '🎲 Rolling with disadvantage (2d20kl1)' :
                '🎲 Rolling normally (1d20)'}
            </span>
          </div>
        </div>
      </div>
    `;

    panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(20, 20, 30, 0.98);
      backdrop-filter: blur(12px);
      color: white;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.5);
      z-index: 10001;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      width: 380px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;

    addSettingsStyles();
    document.body.appendChild(panel);

    // Make draggable
    makeDraggable(panel, '.settings-header');

    // Toggle functionality
    let isCollapsed = false;
    panel.querySelector('.settings-header').addEventListener('click', (e) => {
      if (e.target === panel.querySelector('.settings-toggle')) {
        const content = panel.querySelector('.settings-content');
        const toggle = panel.querySelector('.settings-toggle');

        if (isCollapsed) {
          content.style.display = 'block';
          toggle.textContent = '−';
        } else {
          content.style.display = 'none';
          toggle.textContent = '+';
        }

        isCollapsed = !isCollapsed;
      }
    });

    // Advantage/Disadvantage toggle buttons
    panel.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        rollStats.settings.advantageMode = mode;

        // Update active state
        panel.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update description
        const description = panel.querySelector('#mode-description');
        if (mode === 'advantage') {
          description.textContent = '🎲 Rolling with advantage (2d20kh1)';
        } else if (mode === 'disadvantage') {
          description.textContent = '🎲 Rolling with disadvantage (2d20kl1)';
        } else {
          description.textContent = '🎲 Rolling normally (1d20)';
        }

        // Save to storage
        chrome.storage.local.set({ rollSettings: rollStats.settings });
        console.log('Roll mode changed to:', mode);
        showNotification(`Roll mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`, 'info');
      });
    });
  }

  function addSettingsStyles() {
    if (document.querySelector('.dc-roll-settings-styles')) return;

    const style = document.createElement('style');
    style.className = 'dc-roll-settings-styles';
    style.textContent = `
      #dc-roll-settings .settings-header {
        padding: 16px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        border-radius: 16px 16px 0 0;
      }

      #dc-roll-settings .settings-title {
        font-weight: bold;
        font-size: 16px;
      }

      #dc-roll-settings .settings-toggle {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: background 0.2s;
      }

      #dc-roll-settings .settings-toggle:hover {
        background: rgba(255,255,255,0.3);
      }

      #dc-roll-settings .settings-content {
        padding: 20px;
      }

      #dc-roll-settings .setting-group {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      #dc-roll-settings .setting-label {
        font-size: 14px;
        font-weight: 600;
        opacity: 0.9;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      #dc-roll-settings .toggle-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 8px;
      }

      #dc-roll-settings .toggle-btn {
        background: rgba(255,255,255,0.08);
        border: 2px solid rgba(255,255,255,0.15);
        color: white;
        padding: 12px 16px;
        border-radius: 10px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s;
        text-align: center;
      }

      #dc-roll-settings .toggle-btn:hover {
        background: rgba(255,255,255,0.15);
        border-color: rgba(255,255,255,0.3);
        transform: translateY(-2px);
      }

      #dc-roll-settings .toggle-btn.active {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-color: #667eea;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      #dc-roll-settings .setting-description {
        background: rgba(255,255,255,0.05);
        padding: 12px;
        border-radius: 8px;
        font-size: 12px;
        opacity: 0.8;
        text-align: center;
      }
    `;

    document.head.appendChild(style);
  }

  function updateSettingsPanel() {
    const panel = document.getElementById('dc-roll-settings');
    if (!panel) return;

    // Update active state on toggle buttons
    panel.querySelectorAll('.toggle-btn').forEach(btn => {
      const mode = btn.getAttribute('data-mode');
      if (mode === rollStats.settings.advantageMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update description
    const description = panel.querySelector('#mode-description');
    if (description) {
      if (rollStats.settings.advantageMode === 'advantage') {
        description.textContent = '🎲 Rolling with advantage (2d20kh1)';
      } else if (rollStats.settings.advantageMode === 'disadvantage') {
        description.textContent = '🎲 Rolling with disadvantage (2d20kl1)';
      } else {
        description.textContent = '🎲 Rolling normally (1d20)';
      }
    }
  }

  /**
   * Transforms a roll formula based on advantage mode
   */
  function applyAdvantageMode(formula, mode) {
    if (mode === 'normal') return formula;

    // Transform d20 rolls to advantage/disadvantage
    // 1d20 -> 2d20kh1 (advantage) or 2d20kl1 (disadvantage)
    const d20Regex = /(\d*)d20\b/gi;

    return formula.replace(d20Regex, (match, count) => {
      const diceCount = count ? parseInt(count) : 1;

      if (mode === 'advantage') {
        // Roll twice as many dice, keep highest
        return `${diceCount * 2}d20kh${diceCount}`;
      } else if (mode === 'disadvantage') {
        // Roll twice as many dice, keep lowest
        return `${diceCount * 2}d20kl${diceCount}`;
      }

      return match;
    });
  }

  /**
   * Sends roll data to all Roll20 tabs with visual feedback
   */
  function sendRollToRoll20(rollData) {
    console.log('🚀 sendRollToRoll20 called with:', rollData);
    
    if (!rollStats.settings.enabled) {
      console.log('⚠️ Roll forwarding disabled in settings');
      return;
    }

    // Apply advantage/disadvantage to the formula
    const modifiedRoll = {
      ...rollData,
      formula: applyAdvantageMode(rollData.formula, rollStats.settings.advantageMode)
    };

    // Log if formula was modified
    if (modifiedRoll.formula !== rollData.formula) {
      console.log(`Formula modified: ${rollData.formula} -> ${modifiedRoll.formula} (${rollStats.settings.advantageMode})`);
    }

    // Add visual feedback and tracking
    showRollNotification(modifiedRoll);
    addToRollHistory(modifiedRoll);

    // Send to Roll20
    console.log('📡 Sending roll to Roll20...');
    try {
      browserAPI.runtime.sendMessage({
        action: 'sendRollToRoll20',
        roll: modifiedRoll
      }, (response) => {
        if (browserAPI.runtime.lastError) {
          console.error('❌ Chrome runtime error:', browserAPI.runtime.lastError);
          showNotification('Roll20 not available. Is Roll20 open?', 'warning');
          return;
        }
        
        if (response && response.success) {
          console.log('✅ Roll sent to Roll20:', response);
          showNotification(`${modifiedRoll.name} roll sent to Roll20! 🎲`, 'success');
        } else {
          console.error('❌ Failed to send roll to Roll20:', response?.error);
          showNotification('Roll20 not available. Is Roll20 open?', 'warning');
        }
      });
    } catch (error) {
      console.error('Extension context invalidated:', error);
      showNotification('Extension reloaded. Please refresh the page.', 'error');
    }
  }

  /**
   * Creates the sync button for character data
   */
  function addSyncButton() {
    // Check if button already exists
    if (document.getElementById('dc-sync-btn')) return;

    const button = document.createElement('button');
    button.id = 'dc-sync-btn';
    button.innerHTML = '🔄 Sync to RollCloud';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 4px 15px rgba(78, 205, 196, 0.2);
      transition: transform 0.2s, box-shadow 0.2s;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 20px rgba(78, 205, 196, 0.3)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 15px rgba(78, 205, 196, 0.2)';
    });

    button.addEventListener('click', () => {
      syncCharacterData();
    });

    document.body.appendChild(button);
    console.log('✅ Sync button added to Dice Cloud');
  }

  /**
   * Syncs character data to extension storage
   */
  function syncCharacterData() {
    console.log('🔄 Starting character data sync...');
    
    const button = document.getElementById('dc-sync-btn');
    if (button) {
      button.innerHTML = '⏳ Syncing...';
      button.disabled = true;
    }

    // Start character extraction
    extractCharacterData()
      .then(characterData => {
        if (characterData) {
          // Store in extension storage
          browserAPI.runtime.sendMessage({
            action: 'storeCharacterData',
            data: characterData
          }, (response) => {
            if (browserAPI.runtime.lastError) {
              console.error('❌ Extension context error:', browserAPI.runtime.lastError);
              showNotification('Extension context error. Please refresh the page.', 'error');
              if (button) {
                button.innerHTML = '🔄 Sync to RollCloud';
                button.disabled = false;
              }
            } else {
              console.log('✅ Character data synced to extension:', characterData.name);
              showNotification(`✅ ${characterData.name} synced to RollCloud! 🎲`, 'success');
              if (button) {
                button.innerHTML = '✅ Synced!';
                button.disabled = false;
                setTimeout(() => {
                  button.innerHTML = '🔄 Sync to RollCloud';
                }, 2000);
              }
            }
          });
        } else {
          console.error('❌ No character data found to sync');
          showNotification('No character data found. Make sure you have a character open.', 'error');
          if (button) {
            button.innerHTML = '🔄 Sync to RollCloud';
            button.disabled = false;
          }
        }
      })
      .catch(error => {
        console.error('❌ Error during character extraction:', error);
        showNotification('Failed to extract character data. Please try again.', 'error');
        if (button) {
          button.innerHTML = '🔄 Sync to RollCloud';
          button.disabled = false;
        }
      });
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('📄 DOM loaded, adding buttons...');
      addSyncButton();
      observeRollLog();
    });
  } else {
    console.log('📄 Page already loaded, adding buttons...');
    addSyncButton();
    observeRollLog();
  }

  console.log('✅ DiceCloud script initialization complete');
})();
