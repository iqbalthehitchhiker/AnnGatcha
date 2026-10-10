// @ts-check

import { createRngFromRedoMap } from './rng.js';
import { pick } from './picker.js';
import { 
  calculateEffectiveStrength, 
  getBandFromEffStr,
  getCharacterTags 
} from './stats.js';
import { 
  executeScenario, 
  checkScenarioRequires, 
  applyScenarioWeightMods 
} from './scenario.js';

/**
 * @typedef {Object} ChainResult
 * @property {string} band - Character's band
 * @property {number} effStr - Effective strength at chain start
 * @property {any[]} scenarios - Array of scenario outcomes
 * @property {string[]} finalCarriedTags - Carried tags after all scenarios
 */

/**
 * Execute the three-scenario chain (FR-X2, FR-X1 to FR-X7)
 * Band is determined once at chain start from effective strength
 * 
 * @param {any} character - Character object
 * @param {any} data - Game data
 * @param {string} masterSeed - Master seed
 * @param {Object<string, number>} redoMap - Redo map
 * @returns {ChainResult} Chain result
 */
export function executeChain(character, data, masterSeed, redoMap = {}) {
  // Calculate effective strength at chain start (FR-X1)
  const effStr = calculateEffectiveStrength(
    character.strength,
    character.weapon,
    data
  );
  
  // Determine band from effective strength (FR-X1)
  // Band is fixed for all three scenarios
  const band = getBandFromEffStr(effStr, data);
  
  // Get character tags (innate + powers + weapon)
  const characterTags = getCharacterTags(character, data);
  
  // Execute three scenarios in sequence
  const chainLength = data.config.chainLength;
  const scenarios = [];
  let carriedTags = [];
  let persistentBindings = {}; // Carry rival across scenarios
  const selectedScenarioIds = []; // Track selected scenarios for repeat penalty
  
  for (let i = 0; i < chainLength; i++) {
    const stageId = `chain:${i}`;
    const rng = createRngFromRedoMap(masterSeed, stageId, redoMap);
    
    // Select scenario
    const scenarioId = selectScenario(
      band,
      character,
      characterTags,
      carriedTags,
      selectedScenarioIds,
      data,
      rng
    );
    
    // Track selected scenario
    selectedScenarioIds.push(scenarioId);
    
    // Execute scenario with persistent bindings
    const outcome = executeScenario(
      scenarioId,
      character,
      carriedTags,
      data,
      rng,
      persistentBindings
    );
    
    // Update carried tags
    carriedTags = updateCarriedTags(carriedTags, outcome.emittedTags);
    
    // Update persistent bindings if rival was set
    if (outcome.rivalBinding) {
      persistentBindings['rival'] = outcome.rivalBinding;
    }
    
    scenarios.push(outcome);
  }
  
  return {
    band,
    effStr,
    scenarios,
    finalCarriedTags: carriedTags
  };
}

/**
 * Select a scenario for the current chain position (FR-X2, FR-X3)
 * Weighted pick over scenarios whose bands include the band and whose requires pass
 * Repeats (scenarios already selected in this chain) get a 0.2x weight penalty,
 * except for rematch_rival which is exempt.
 * 
 * @param {string} band - Character's band
 * @param {any} character - Character object
 * @param {string[]} characterTags - Character's tags
 * @param {string[]} carriedTags - Currently carried tags
 * @param {string[]} selectedScenarioIds - Scenarios already selected in this chain
 * @param {any} data - Game data
 * @param {() => number} rng - RNG function
 * @returns {string} Selected scenario ID
 */
function selectScenario(band, character, characterTags, carriedTags, selectedScenarioIds, data, rng) {
  // Filter scenarios by band and requires
  const validScenarios = [];
  
  for (const [scenarioId, scenario] of Object.entries(data.scenarios)) {
    // Check if scenario is available in this band
    if (!scenario.bands || !scenario.bands.includes(band)) {
      continue;
    }
    
    // Check requires
    if (!checkScenarioRequires(scenario, characterTags, carriedTags, character)) {
      continue;
    }
    
    // Apply weight mods
    let weight = applyScenarioWeightMods(
      scenario,
      scenario.weight,
      character,
      characterTags,
      carriedTags
    );
    
    // Apply repeat penalty (0.2x) for scenarios already selected in this chain
    // Exempt rematch_rival only
    if (selectedScenarioIds.includes(scenarioId) && scenarioId !== 'rematch_rival') {
      weight *= 0.2;
    }
    
    validScenarios.push({
      id: scenarioId,
      weight
    });
  }
  
  if (validScenarios.length === 0) {
    throw new Error(`No valid scenarios for band ${band} with current character state`);
  }
  
  // Pick scenario
  const result = pick(validScenarios, rng, 'scenario_selection');
  
  return result.pickedId;
}

/**
 * Update carried tags based on emitted tags (FR-X5)
 * Carried tags persist across scenarios in the chain
 * 
 * @param {string[]} currentCarried - Currently carried tags
 * @param {string[]} emittedTags - Tags emitted by the last scenario
 * @returns {string[]} Updated carried tags
 */
function updateCarriedTags(currentCarried, emittedTags) {
  const carried = new Set(currentCarried);
  
  for (const tag of emittedTags) {
    carried.add(tag);
  }
  
  return Array.from(carried);
}

/**
 * Check if a character has sufficient scenario options in their band (FR-X3)
 * Used by the simulator to report characters with < 2 non-do_nothing options
 * 
 * @param {any} character - Character object
 * @param {any} data - Game data
 * @returns {{band: string, effStr: number, optionCount: number, hasEnoughOptions: boolean}} Options check result
 */
export function checkScenarioOptions(character, data) {
  const effStr = calculateEffectiveStrength(
    character.strength,
    character.weapon,
    data
  );
  
  const band = getBandFromEffStr(effStr, data);
  const characterTags = getCharacterTags(character, data);
  const carriedTags = []; // Check at start of chain
  
  let optionCount = 0;
  
  for (const [scenarioId, scenario] of Object.entries(data.scenarios)) {
    // Skip do_nothing
    if (scenarioId === 'do_nothing') {
      continue;
    }
    
    // Check if available
    if (!scenario.bands || !scenario.bands.includes(band)) {
      continue;
    }
    
    if (!checkScenarioRequires(scenario, characterTags, carriedTags, character)) {
      continue;
    }
    
    optionCount++;
  }
  
  return {
    band,
    effStr,
    optionCount,
    hasEnoughOptions: optionCount >= 2
  };
}
