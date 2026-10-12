// @ts-check

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - Array of error messages
 * @property {string[]} warnings - Array of warning messages
 */

/**
 * Validate the complete game data
 * Per section 11: Pure function that runs in browser, CI, and sim
 * 
 * @param {any} data - Complete game data object
 * @returns {ValidationResult} Validation result
 */
export function validate(data) {
  const errors = [];
  const warnings = [];

  // Validate basic structure
  if (!data.config) errors.push('Missing config');
  if (!data.races) errors.push('Missing races');
  if (!data.archetypes) errors.push('Missing archetypes');
  if (!data.sizes) errors.push('Missing sizes');
  if (!data.traits) errors.push('Missing traits');
  if (!data.powers) errors.push('Missing powers');
  if (!data.tags) errors.push('Missing tags');
  if (!data.weapons) errors.push('Missing weapons');
  if (!data.pools) errors.push('Missing pools');
  if (!data.scenarios) errors.push('Missing scenarios');

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // Validate weights are positive
  validatePositiveWeights(data, errors);

  // Validate band coverage (all tiers 0-10 map to exactly one band)
  validateBandCoverage(data, errors);

  // Validate referenced IDs exist
  validateReferences(data, errors);

  // Validate powers have tags
  validatePowerTags(data, errors);

  // Validate power rank and tilt fields
  validateRankAndTilt(data, errors);

  // Validate unknown tags aren't referenced
  validateKnownTags(data, errors);

  // Validate scenario weightMods structure and references
  validateWeightMods(data, errors);

  // Validate race x archetype paths don't yield empty tables
  validateRaceArchetypePaths(data, errors);

  // Validate band scenario requirements (FR-X3)
  validateBandScenarios(data, errors);
  
  // Validate scenario availability per band across effStr range (FR-X3, M1a)
  validateScenarioAvailabilityAcrossEffStr(data, errors);
  
  // Validate durability-free scenarios per band (FR-X7)
  validateDurabilityFreeScenarios(data, errors);

  // Validate carried tags
  validateCarriedTags(data, errors);

  // Validate scenario graphs
  validateScenarioGraphs(data, errors);

  // Validate stats are used
  validateStatsUsed(data, errors);

  // Warn about unused tags
  validateTagUsage(data, warnings);

  // Validate percentiles.json if present
  validatePercentiles(data, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate all weights are positive
 */
function validatePositiveWeights(data, errors) {
  // Races
  for (const [id, race] of Object.entries(data.races)) {
    if (race.weight <= 0) errors.push(`Race ${id} has non-positive weight`);
    
    // Archetype weights
    for (const [aId, weight] of Object.entries(race.archetypes || {})) {
      if (weight <= 0) errors.push(`Race ${id} archetype ${aId} has non-positive weight`);
    }
    
    // Size weights
    for (const [sId, weight] of Object.entries(race.sizes || {})) {
      if (weight <= 0) errors.push(`Race ${id} size ${sId} has non-positive weight`);
    }
    
    // Tier weights
    for (const [tier, weight] of Object.entries(race.tierWeights || {})) {
      if (weight <= 0) errors.push(`Race ${id} tier ${tier} has non-positive weight`);
    }
  }

  // Traits
  for (const [id, trait] of Object.entries(data.traits)) {
    if (trait.weight <= 0) errors.push(`Trait ${id} has non-positive weight`);
  }

  // Powers
  for (const [id, power] of Object.entries(data.powers)) {
    if (power.weight <= 0) errors.push(`Power ${id} has non-positive weight`);
  }

  // Weapons
  for (const [id, type] of Object.entries(data.weapons.types || {})) {
    if (type.weight <= 0) errors.push(`Weapon type ${id} has non-positive weight`);
  }
  for (const [id, ench] of Object.entries(data.weapons.enchantments || {})) {
    if (ench.weight <= 0) errors.push(`Weapon enchantment ${id} has non-positive weight`);
  }

  // Scenarios
  for (const [id, scenario] of Object.entries(data.scenarios)) {
    if (scenario.weight <= 0) errors.push(`Scenario ${id} has non-positive weight`);
  }

  // Pools
  for (const [poolId, pool] of Object.entries(data.pools)) {
    for (const entry of pool) {
      if (entry.weight <= 0) errors.push(`Pool ${poolId} entry ${entry.id} has non-positive weight`);
    }
  }
}

/**
 * Validate band coverage: all tiers 0-10 map to exactly one band
 */
function validateBandCoverage(data, errors) {
  const tierToBand = {};
  
  // Map each tier to its band(s)
  for (const [bandId, tiers] of Object.entries(data.config.bands)) {
    for (const tier of tiers) {
      if (tierToBand[tier]) {
        errors.push(`Tier ${tier} is in multiple bands: ${tierToBand[tier]} and ${bandId}`);
      } else {
        tierToBand[tier] = bandId;
      }
    }
  }
  
  // Check all tiers 0-10 are covered
  for (let tier = 0; tier <= 10; tier++) {
    if (!tierToBand[tier]) {
      errors.push(`Tier ${tier} is not covered by any band`);
    }
  }
}

/**
 * Validate referenced IDs exist
 */
function validateReferences(data, errors) {
  // Race archetypes and sizes
  for (const [raceId, race] of Object.entries(data.races)) {
    for (const aId of Object.keys(race.archetypes || {})) {
      if (!data.archetypes[aId]) {
        errors.push(`Race ${raceId} references unknown archetype ${aId}`);
      }
    }
    for (const sId of Object.keys(race.sizes || {})) {
      if (!data.sizes[sId]) {
        errors.push(`Race ${raceId} references unknown size ${sId}`);
      }
    }
  }

  // Archetype pool tags
  for (const [aId, archetype] of Object.entries(data.archetypes)) {
    for (const tag of archetype.poolTags || []) {
      if (!data.tags[tag]) {
        errors.push(`Archetype ${aId} references unknown tag ${tag}`);
      }
    }
  }

  // Scenario pools
  for (const [sId, scenario] of Object.entries(data.scenarios)) {
    if (!scenario || !scenario.steps) continue;
    for (const step of Object.values(scenario.steps)) {
      if (step && step.type === 'pick' && step.pool && !data.pools[step.pool]) {
        errors.push(`Scenario ${sId} references unknown pool ${step.pool}`);
      }
    }
  }
}

/**
 * Validate powers have tags
 */
function validatePowerTags(data, errors) {
  for (const [id, power] of Object.entries(data.powers)) {
    if (!power.tags || power.tags.length === 0) {
      errors.push(`Power ${id} has no tags`);
    }
  }
}

/**
 * Validate rank is 1-5 if present; validate tilt fields
 */
function validateRankAndTilt(data, errors) {
  // Powers
  for (const [id, power] of Object.entries(data.powers)) {
    if (power && power.rank !== undefined && power.rank !== null) {
      if (typeof power.rank !== 'number' || !Number.isFinite(power.rank) || power.rank < 1 || power.rank > 5) {
        errors.push(`Power ${id} has invalid rank (must be a number 1-5)`);
      }
    }
  }

  // Weapon types/enchantments ranks if present
  for (const [id, type] of Object.entries(data.weapons.types || {})) {
    if (type && type.rank !== undefined && type.rank !== null) {
      if (typeof type.rank !== 'number' || !Number.isFinite(type.rank) || type.rank < 1 || type.rank > 5) {
        errors.push(`Weapon type ${id} has invalid rank (must be a number 1-5)`);
      }
    }
  }
  for (const [id, ench] of Object.entries(data.weapons.enchantments || {})) {
    if (ench && ench.rank !== undefined && ench.rank !== null) {
      if (typeof ench.rank !== 'number' || !Number.isFinite(ench.rank) || ench.rank < 1 || ench.rank > 5) {
        errors.push(`Weapon enchantment ${id} has invalid rank (must be a number 1-5)`);
      }
    }
  }

  // Tilt fields on races/archetypes/weapons/powers if present
  const checkTilt = (obj, context) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'weaponTilt' || k === 'powerTilt') {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          errors.push(`${context} has invalid tilt value (must be a finite number)`);
        } else if (Math.abs(v) > 2) {
          errors.push(`${context} has tilt value outside allowed range (must be |value| <= 2)`);
        }
      }
      if (k === 'mods' && Array.isArray(v)) {
        for (const mod of v) {
          if (mod && mod.op === 'tilt') {
            if (typeof mod.by !== 'number' || !Number.isFinite(mod.by)) {
              errors.push(`${context} has invalid tilt value (must be a finite number)`);
            }
            if (mod.field === 'rank' && context.toLowerCase().includes('weapon')) {
              errors.push(`${context} mod has unknown field 'rank' for weapon stages`);
            }
            // general unknown field cases from spec: "unknown field values fail with specific errors (one fixture each)"
            if (mod.field === 'rank' && mod.stage && mod.stage.startsWith('weapon')) {
              errors.push(`${context} has unknown field 'rank' for weapon stage`);
            }
          }
        }
      }
    }
  };

  for (const [id, r] of Object.entries(data.races)) {
    checkTilt(r, `Race ${id}`);
    if (r.mods) {
      for (const mod of r.mods) {
        if (mod && mod.op === 'tilt') {
          if (mod.field === 'rank' && mod.stage && mod.stage.startsWith('weapon')) {
            errors.push(`Race ${id} has unknown field 'rank' for weapon stage`);
          }
          // Check if field is plausible: powers can have rank, weapons have level/levelBonus
          if (mod.stage === 'powers' && mod.field !== 'rank' && mod.field !== 'weight') {
            // Check if any power has this field
            const hasPowerWithField = Object.values(data.powers).some(p => p && mod.field in p);
            if (!hasPowerWithField) {
              errors.push(`Race ${id} tilt mod references unknown field '${mod.field}' for stage '${mod.stage}'`);
            }
          }
          if (typeof mod.by !== 'number' || !Number.isFinite(mod.by)) {
            errors.push(`Race ${id} has invalid tilt value (must be a finite number)`);
          }
        }
      }
    }
  }
  for (const [id, a] of Object.entries(data.archetypes)) {
    checkTilt(a, `Archetype ${id}`);
  }
}

/**
 * Validate unknown tags aren't referenced
 */
function validateKnownTags(data, errors) {
  const knownTags = new Set(Object.keys(data.tags));

  // Powers
  for (const [id, power] of Object.entries(data.powers)) {
    for (const tag of power.tags || []) {
      if (!knownTags.has(tag)) {
        errors.push(`Power ${id} references unknown tag ${tag}`);
      }
    }
  }

  // Weapons
  for (const [id, type] of Object.entries(data.weapons.types || {})) {
    for (const tag of type.tags || []) {
      if (!knownTags.has(tag)) {
        errors.push(`Weapon type ${id} references unknown tag ${tag}`);
      }
    }
  }
  for (const [id, ench] of Object.entries(data.weapons.enchantments || {})) {
    for (const tag of ench.tags || []) {
      if (!knownTags.has(tag)) {
        errors.push(`Weapon enchantment ${id} references unknown tag ${tag}`);
      }
    }
  }

  // Pools
  for (const [poolId, pool] of Object.entries(data.pools)) {
    for (const entry of pool) {
      for (const tag of entry.tags || []) {
        if (!knownTags.has(tag)) {
          errors.push(`Pool ${poolId} entry ${entry.id} references unknown tag ${tag}`);
        }
      }
    }
  }

  // Tag blockedBy references
  for (const [tagId, tag] of Object.entries(data.tags)) {
    for (const blockedById of tag.blockedBy || []) {
      if (!knownTags.has(blockedById)) {
        errors.push(`Tag ${tagId} blockedBy references unknown tag ${blockedById}`);
      }
    }
  }
}

/**
 * Validate scenario weightMods structure and references
 * Runtime schema (scenario.js:384-408): { "if": "type:value", "mult": number }
 * Supported condition types: trait, tag, carried, race
 */
function validateWeightMods(data, errors) {
  const knownTags = new Set(Object.keys(data.tags));
  const knownTraits = new Set(Object.keys(data.traits));
  const knownRaces = new Set(Object.keys(data.races));

  for (const [scenarioId, scenario] of Object.entries(data.scenarios)) {
    if (!scenario.weightMods) continue;

    if (!Array.isArray(scenario.weightMods)) {
      errors.push(`Scenario ${scenarioId} weightMods must be an array`);
      continue;
    }

    for (let i = 0; i < scenario.weightMods.length; i++) {
      const mod = scenario.weightMods[i];
      const modPath = `Scenario ${scenarioId} weightMods[${i}]`;

      // Validate mod is an object
      if (typeof mod !== 'object' || mod === null || Array.isArray(mod)) {
        errors.push(`${modPath} must be an object`);
        continue;
      }

      // Validate 'if' field exists and is a string
      if (!mod.if) {
        errors.push(`${modPath} missing required field 'if'`);
      } else if (typeof mod.if !== 'string') {
        errors.push(`${modPath} field 'if' must be a string`);
      } else {
        // Validate condition format: "type:value"
        const parts = mod.if.split(':');
        if (parts.length !== 2) {
          errors.push(`${modPath} condition '${mod.if}' must be in format 'type:value'`);
        } else {
          const [condType, condValue] = parts;

          // Validate condition type is supported
          const validTypes = ['trait', 'tag', 'carried', 'race'];
          if (!validTypes.includes(condType)) {
            errors.push(`${modPath} unknown condition type '${condType}' (valid: ${validTypes.join(', ')})`);
          }

          // Validate condition value is non-empty
          if (!condValue || condValue.length === 0) {
            errors.push(`${modPath} condition value cannot be empty`);
          } else {
            // Validate referenced ID exists
            if (condType === 'trait' && !knownTraits.has(condValue)) {
              errors.push(`${modPath} references unknown trait '${condValue}'`);
            } else if (condType === 'tag' && !knownTags.has(condValue)) {
              errors.push(`${modPath} references unknown tag '${condValue}'`);
            } else if (condType === 'carried' && !knownTags.has(condValue)) {
              errors.push(`${modPath} references unknown carried tag '${condValue}'`);
            } else if (condType === 'race' && !knownRaces.has(condValue)) {
              errors.push(`${modPath} references unknown race '${condValue}'`);
            }
          }
        }
      }

      // Validate 'mult' field exists and is a valid number
      if (!('mult' in mod)) {
        errors.push(`${modPath} missing required field 'mult'`);
      } else if (typeof mod.mult !== 'number' || mod.mult === null) {
        errors.push(`${modPath} field 'mult' must be a number`);
      } else if (!isFinite(mod.mult)) {
        errors.push(`${modPath} field 'mult' must be finite`);
      } else if (mod.mult <= 0) {
        errors.push(`${modPath} field 'mult' must be positive (got ${mod.mult})`);
      }
    }
  }
}

/**
 * Validate race x archetype paths don't yield empty tables
 * Static enumeration as per section 11
 */
function validateRaceArchetypePaths(data, errors) {
  for (const [raceId, race] of Object.entries(data.races)) {
    for (const archetypeId of Object.keys(race.archetypes || {})) {
      const archetype = data.archetypes[archetypeId];
      if (!archetype) continue; // Caught by reference validation

      // Check if power pool would be empty
      const poolTags = new Set(archetype.poolTags || []);
      const availablePowers = Object.entries(data.powers).filter(([_, power]) =>
        power.tags && power.tags.some(tag => poolTags.has(tag))
      );

      if (availablePowers.length === 0) {
        errors.push(`Race ${raceId} + archetype ${archetypeId} yields empty power pool`);
      }
    }
  }
}

/**
 * Validate band scenario requirements (FR-X3)
 * Each band must have do_nothing plus at least 2 other scenarios
 */
function validateBandScenarios(data, errors) {
  const bands = Object.keys(data.config.bands || {});

  for (const band of bands) {
    const scenariosInBand = Object.entries(data.scenarios).filter(([_, s]) =>
      s.bands && s.bands.includes(band)
    );

    const hasDoNothing = scenariosInBand.some(([id, _]) => id === 'do_nothing');
    const nonDoNothingCount = scenariosInBand.filter(([id, _]) => id !== 'do_nothing').length;

    if (!hasDoNothing) {
      errors.push(`Band ${band} missing do_nothing scenario`);
    }
    if (nonDoNothingCount < 2) {
      errors.push(`Band ${band} has only ${nonDoNothingCount} non-do_nothing scenarios (need at least 2)`);
    }
  }
}

/**
 * Validate carried tags (FR-X5)
 * - Every carried tag must be emitted by at least one scenario
 * - Carried tags without 'effect' must be consumed by a later scenario
 */
function validateCarriedTags(data, errors) {
  const carriedTags = Object.entries(data.tags || {})
    .filter(([_, tag]) => tag && tag.carried)
    .map(([id, _]) => id);

  for (const tagId of carriedTags) {
    const tag = data.tags[tagId];
    if (!tag) continue;

    // Check if emitted
    let isEmitted = false;
    for (const scenario of Object.values(data.scenarios || {})) {
      if (!scenario || !scenario.steps) continue;
      for (const step of Object.values(scenario.steps)) {
        if (step && step.type === 'end' && step.emits && step.emits.includes(tagId)) {
          isEmitted = true;
          break;
        }
      }
      if (isEmitted) break;
    }

    if (!isEmitted) {
      errors.push(`Carried tag ${tagId} is never emitted by any scenario`);
    }

    // Check if consumed (only if no effect)
    if (!tag.effect) {
      let isConsumed = false;
      for (const scenario of Object.values(data.scenarios || {})) {
        if (!scenario || !scenario.requires) continue;
        if (scenario.requires.carried && 
            scenario.requires.carried.includes(tagId)) {
          isConsumed = true;
          break;
        }
        // Also check step conditions
        // (would need to be in step grammar)
        // For M0, we'll just check scenario-level requires
      }

      if (!isConsumed) {
        errors.push(`Carried tag ${tagId} (no effect) is never consumed by any scenario`);
      }
    }
  }
}

/**
 * Validate scenario graphs
 * Check for unreachable steps, dead ends, missing contest branches
 */
function validateScenarioGraphs(data, errors) {
  for (const [scenarioId, scenario] of Object.entries(data.scenarios || {})) {
    if (!scenario || !scenario.steps || !scenario.start) continue;
    
    const steps = scenario.steps;
    const reachable = new Set();
    const toVisit = [scenario.start];

    // BFS to find reachable steps
    while (toVisit.length > 0) {
      const stepId = toVisit.shift();
      if (!stepId || reachable.has(stepId)) continue;
      reachable.add(stepId);

      const step = steps[stepId];
      if (!step) {
        errors.push(`Scenario ${scenarioId} references undefined step ${stepId}`);
        continue;
      }

      // Collect next steps
      if (step.type === 'pick') {
        if (step.next) toVisit.push(step.next);
      } else if (step.type === 'check') {
        if (step.next && step.next.success) toVisit.push(step.next.success);
        if (step.next && step.next.fail) toVisit.push(step.next.fail);
      } else if (step.type === 'contest') {
        if (step.next) {
          if (step.next.win) toVisit.push(step.next.win);
          if (step.next.lose) toVisit.push(step.next.lose);
          if (step.next.flee) toVisit.push(step.next.flee);
          if (step.next.standoff) toVisit.push(step.next.standoff);

          // Validate all branches exist
          if (!step.next.win) errors.push(`Scenario ${scenarioId} contest step ${stepId} missing win branch`);
          if (!step.next.lose) errors.push(`Scenario ${scenarioId} contest step ${stepId} missing lose branch`);
          if (!step.next.flee) errors.push(`Scenario ${scenarioId} contest step ${stepId} missing flee branch`);
          if (!step.next.standoff) errors.push(`Scenario ${scenarioId} contest step ${stepId} missing standoff branch`);
        }
      } else if (step.type === 'end') {
        // Terminal step, no next
      }
    }

    // Check for unreachable steps
    for (const stepId of Object.keys(steps)) {
      if (!reachable.has(stepId)) {
        errors.push(`Scenario ${scenarioId} has unreachable step ${stepId}`);
      }
    }

    // Check for non-terminal steps without next (dead ends)
    for (const stepId of reachable) {
      const step = steps[stepId];
      if (!step) continue;
      if (step.type !== 'end') {
        let hasNext = false;
        if (step.type === 'pick' && step.next) hasNext = true;
        if (step.type === 'check' && step.next && (step.next.success || step.next.fail)) hasNext = true;
        if (step.type === 'contest' && step.next) hasNext = true;

        if (!hasNext) {
          errors.push(`Scenario ${scenarioId} step ${stepId} is a dead end (not 'end' type but no next)`);
        }
      }
    }
  }
}

/**
 * Validate that every stat is used by at least one scenario step
 */
function validateStatsUsed(data, errors) {
  const statsUsed = new Set();

  for (const scenario of Object.values(data.scenarios || {})) {
    if (!scenario || !scenario.steps) continue;
    for (const step of Object.values(scenario.steps)) {
      if (!step) continue;
      if (step.type === 'check' && step.stat) {
        statsUsed.add(step.stat);
      }
      // Contest steps implicitly use all three stats
      if (step.type === 'contest') {
        statsUsed.add('strength');
        statsUsed.add('speed');
        statsUsed.add('durability');
      }
    }
  }

  const requiredStats = ['strength', 'speed', 'durability'];
  for (const stat of requiredStats) {
    if (!statsUsed.has(stat)) {
      errors.push(`Stat ${stat} is not used by any scenario step`);
    }
  }
}

/**
 * Validate percentiles.json if present
 * Check for data hash mismatch (warning only)
 */
function validatePercentiles(data, warnings) {
  if (data.percentiles) {
    // For M0, just check if structure exists
    if (!data.percentiles.dataHash) {
      warnings.push('percentiles.json missing dataHash');
    }
    if (!data.percentiles.quantiles) {
      warnings.push('percentiles.json missing quantiles array');
    }
  }
}

/**
 * Validate scenario availability per band across effStr range (FR-X3, M1a)
 * For each band and each trait, check that at least 2 non-do_nothing scenarios
 * have requires that can pass given tags reachable in that band
 */
function validateScenarioAvailabilityAcrossEffStr(data, errors) {
  const bands = Object.keys(data.config.bands || {});
  
  for (const band of bands) {
    // Get all reachable character tag combinations for this band
    // This is a static approximation: we check tags from races/archetypes/powers/weapons
    const reachableTagSets = getReachableTagSetsForBand(data, band);
    
    if (reachableTagSets.length === 0) {
      // No characters can reach this band
      continue;
    }
    
    // For each trait, check scenario availability
    for (const traitId of Object.keys(data.traits)) {
      let hasMinimumScenarios = false;
      
      // Check if at least one tag set has 2+ non-do_nothing scenarios
      for (const tagSet of reachableTagSets) {
        let availableCount = 0;
        
        for (const [scenarioId, scenario] of Object.entries(data.scenarios)) {
          if (scenarioId === 'do_nothing') continue;
          
          if (!scenario.bands || !scenario.bands.includes(band)) continue;
          
          // Check if requires can be satisfied (carried tags are empty at chain start)
          const requires = scenario.requires || {};
          
          // Check required tags
          let canSatisfy = true;
          if (requires.tags) {
            for (const tag of requires.tags) {
              if (!tagSet.has(tag)) {
                canSatisfy = false;
                break;
              }
            }
          }
          
          // Check forbidden tags
          if (canSatisfy && requires.notTags) {
            for (const tag of requires.notTags) {
              if (tagSet.has(tag)) {
                canSatisfy = false;
                break;
              }
            }
          }
          
          // Carried tags must be empty at start (except for scenarios requiring them)
          if (canSatisfy && requires.carried && requires.carried.length > 0) {
            canSatisfy = false;
          }
          
          if (canSatisfy) {
            availableCount++;
          }
        }
        
        if (availableCount >= 2) {
          hasMinimumScenarios = true;
          break;
        }
      }
      
      if (!hasMinimumScenarios && reachableTagSets.length > 0) {
        errors.push(`Band ${band} with trait ${traitId} may have insufficient scenario options across effStr range`);
      }
    }
  }
}

/**
 * Get reachable tag sets for a band
 * Returns array of tag Sets representing different character builds
 */
function getReachableTagSetsForBand(data, band) {
  const tagSets = [];
  
  // Get band tiers
  const bandTiers = data.config.bands[band];
  if (!bandTiers) return tagSets;
  
  // For each race-archetype combination
  for (const race of Object.values(data.races ||{})) {
    if (!race || !race.archetypes) continue;
    
    for (const archetypeId of Object.keys(race.archetypes)) {
      const archetype = data.archetypes[archetypeId];
      if (!archetype) continue;
      
      // Check if this combination can reach this band
      // Band is determined by effStr, which is max(strength, weaponLevel - penalty)
      // We need to check if the race's tierWeights overlap with band tiers
      const raceTiers = race.tierWeights ? Object.keys(race.tierWeights).map(t => parseInt(t, 10)) : [];
      const canReachBand = raceTiers.some(tier => bandTiers.includes(tier));
      
      // Also check weapon-boosted cases
      let canReachBandWithWeapon = false;
      if (race.weaponChance && race.weaponChance > 0 && data.weapons) {
        // Check if weapons can boost into this band
        for (const weaponType of Object.values(data.weapons.types || {})) {
          if (!weaponType) continue;
          for (const ench of Object.values(data.weapons.enchantments || {})) {
            if (!ench) continue;
            const weaponLevel = (weaponType.level || 0) + (ench.levelBonus || 0);
            const weaponEffStr = weaponLevel - (data.config.weaponPenalty || 0);
            const weaponBandTier = 10 - Math.floor(weaponEffStr);
            if (bandTiers.includes(weaponBandTier)) {
              canReachBandWithWeapon = true;
              break;
            }
          }
          if (canReachBandWithWeapon) break;
        }
      }
      
      if (!canReachBand && !canReachBandWithWeapon) continue;
      
      // Collect tags
      const tags = new Set();
      
      // Race tags
      if (race.tags) {
        for (const tag of race.tags) {
          tags.add(tag);
        }
      }
      
      // Power tags (sample - get all possible power tags from pool)
      const poolTags = archetype.poolTags || [];
      for (const power of Object.values(data.powers || {})) {
        if (!power || !power.tags) continue;
        if (power.tags.some(t => poolTags.includes(t))) {
          for (const tag of power.tags) {
            tags.add(tag);
          }
        }
      }
      
      // Weapon tags (if race can have weapons)
      if (race.weaponChance && race.weaponChance > 0 && data.weapons) {
        for (const weaponType of Object.values(data.weapons.types || {})) {
          if (weaponType && weaponType.tags) {
            for (const tag of weaponType.tags) {
              tags.add(tag);
            }
          }
        }
        for (const ench of Object.values(data.weapons.enchantments || {})) {
          if (ench && ench.tags) {
            for (const tag of ench.tags) {
              tags.add(tag);
            }
          }
        }
      }
      
      tagSets.push(tags);
    }
  }
  
  return tagSets;
}

/**
 * Validate that each band has at least one scenario that doesn't test durability (FR-X7)
 * So weapon-boosted characters always have somewhere to pay off
 */
function validateDurabilityFreeScenarios(data, errors) {
  const bands = Object.keys(data.config.bands || {});
  
  for (const band of bands) {
    let hasDurabilityFree = false;
    
    for (const [scenarioId, scenario] of Object.entries(data.scenarios)) {
      if (!scenario.bands || !scenario.bands.includes(band)) continue;
      if (scenarioId === 'do_nothing') continue;
      
      // Check if scenario tests durability
      const testsDurability = scenarioTestsDurability(scenario);
      
      if (!testsDurability) {
        hasDurabilityFree = true;
        break;
      }
    }
    
    if (!hasDurabilityFree) {
      errors.push(`Band ${band} has no durability-free scenarios (FR-X7)`);
    }
  }
}

/**
 * Check if a scenario tests durability
 * A scenario tests durability if it has a contest step (fights test durability)
 */
function scenarioTestsDurability(scenario) {
  if (!scenario || !scenario.steps) return false;
  
  for (const step of Object.values(scenario.steps)) {
    if (step && step.type === 'contest') {
      return true;
    }
  }
  return false;
}

/**
 * Warn about tags never referenced (FR-X8)
 */
function validateTagUsage(data, warnings) {
  const knownTags = new Set(Object.keys(data.tags));
  const usedTags = new Set();

  // Collect tags from powers
  for (const power of Object.values(data.powers)) {
    for (const tag of power.tags || []) {
      usedTags.add(tag);
    }
  }

  // Collect tags from weapons
  for (const type of Object.values(data.weapons.types || {})) {
    for (const tag of type.tags || []) {
      usedTags.add(tag);
    }
  }
  for (const ench of Object.values(data.weapons.enchantments || {})) {
    for (const tag of ench.tags || []) {
      usedTags.add(tag);
    }
  }

  // Collect tags from pools
  for (const pool of Object.values(data.pools)) {
    for (const entry of pool) {
      for (const tag of entry.tags || []) {
        usedTags.add(tag);
      }
    }
  }

  // Collect tags from scenario requires
  for (const scenario of Object.values(data.scenarios)) {
    if (scenario.requires) {
      for (const tag of scenario.requires.carried || []) {
        usedTags.add(tag);
      }
      for (const tag of scenario.requires.tags || []) {
        usedTags.add(tag);
      }
      for (const tag of scenario.requires.notTags || []) {
        usedTags.add(tag);
      }
    }
  }

  // Collect tags from scenario weightMods
  for (const scenario of Object.values(data.scenarios)) {
    if (scenario.weightMods && Array.isArray(scenario.weightMods)) {
      for (const mod of scenario.weightMods) {
        if (mod && typeof mod.if === 'string') {
          const parts = mod.if.split(':');
          if (parts.length === 2) {
            const [condType, condValue] = parts;
            if ((condType === 'tag' || condType === 'carried') && condValue) {
              usedTags.add(condValue);
            }
          }
        }
      }
    }
  }

  // Collect tags from blockedBy
  for (const tag of Object.values(data.tags)) {
    for (const blockedById of tag.blockedBy || []) {
      usedTags.add(blockedById);
    }
  }

  // Warn about unused tags
  for (const tagId of knownTags) {
    if (!usedTags.has(tagId)) {
      warnings.push(`Tag ${tagId} is never referenced by requires, weightMods, conditions, or blockedBy`);
    }
  }
}
