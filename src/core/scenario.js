// @ts-check

import { pick } from './picker.js';
import { 
  getCharacterTags, 
  getOpponentTags,
  calculateEffectiveStrength,
  getEffectiveStats,
  resolveFight,
  resolveCheck
} from './stats.js';

/**
 * @typedef {Object} ScenarioContext
 * @property {any} character - The character
 * @property {any} data - Game data
 * @property {string[]} carriedTags - Currently carried tags
 * @property {Object<string, any>} bindings - Bound entities (opponents from picks)
 * @property {() => number} rng - RNG function
 * @property {any[]} trace - Trace array to append to
 */

/**
 * @typedef {Object} ScenarioOutcome
 * @property {string} scenarioId - Scenario ID
 * @property {string} finalStep - Final step ID reached
 * @property {string} text - Final text
 * @property {string[]} emittedTags - Tags emitted by this scenario
 * @property {any[]} trace - Trace entries for this scenario
 * @property {any} [rivalBinding] - Rival opponent if one was created
 */

/**
 * Execute a scenario (FR-X4)
 * Scenarios are graphs with closed grammar: pick, check, contest, end
 * 
 * @param {string} scenarioId - Scenario ID to execute
 * @param {any} character - Character object
 * @param {string[]} carriedTags - Currently carried tags
 * @param {any} data - Game data
 * @param {() => number} rng - RNG function
 * @param {Object<string, any>} [initialBindings={}] - Initial bindings (e.g., rival from previous scenario)
 * @returns {ScenarioOutcome} Scenario outcome
 */
export function executeScenario(scenarioId, character, carriedTags, data, rng, initialBindings = {}) {
  const scenario = data.scenarios[scenarioId];
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }
  
  const context = {
    character,
    data,
    carriedTags: [...carriedTags], // Copy to avoid mutation
    bindings: { ...initialBindings }, // Start with initial bindings
    rng,
    trace: []
  };
  
  // Execute from start step
  let currentStep = scenario.start;
  let finalText = '';
  let emittedTags = [];
  
  while (true) {
    const step = scenario.steps[currentStep];
    if (!step) {
      throw new Error(`Scenario ${scenarioId} references undefined step: ${currentStep}`);
    }
    
    if (step.type === 'end') {
      finalText = step.text;
      emittedTags = step.emits || [];
      break;
    }
    
    // Execute step and get next step ID
    currentStep = executeStep(scenarioId, currentStep, step, context);
  }
  
  return {
    scenarioId,
    finalStep: currentStep,
    text: finalText,
    emittedTags,
    trace: context.trace,
    rivalBinding: context.bindings['rival'] // Return rival if set
  };
}

/**
 * Execute a single step and return the next step ID
 * 
 * @param {string} scenarioId - Scenario ID
 * @param {string} stepId - Current step ID
 * @param {any} step - Step object
 * @param {ScenarioContext} context - Scenario context
 * @returns {string} Next step ID
 */
function executeStep(scenarioId, stepId, step, context) {
  switch (step.type) {
    case 'pick':
      return executePick(scenarioId, stepId, step, context);
    case 'check':
      return executeCheck(scenarioId, stepId, step, context);
    case 'contest':
      return executeContest(scenarioId, stepId, step, context);
    default:
      throw new Error(`Unknown step type: ${step.type} in scenario ${scenarioId} step ${stepId}`);
  }
}

/**
 * Execute a pick step (FR-X4)
 * Pick an entity from a pool, bind it, proceed to next
 * 
 * @param {string} scenarioId - Scenario ID
 * @param {string} stepId - Step ID
 * @param {any} step - Step object
 * @param {ScenarioContext} context - Context
 * @returns {string} Next step ID
 */
function executePick(scenarioId, stepId, step, context) {
  const pool = context.data.pools[step.pool];
  if (!pool) {
    throw new Error(`Scenario ${scenarioId} step ${stepId} references unknown pool: ${step.pool}`);
  }
  
  // Create pick entries from pool
  const entries = pool.map(entity => ({
    id: entity.id,
    weight: entity.weight
  }));
  
  const stageId = `scenario:${scenarioId}:${stepId}`;
  const result = pick(entries, context.rng, stageId);
  
  // Find the picked entity
  const pickedEntity = pool.find(e => e.id === result.pickedId);
  
  // Bind it
  context.bindings[step.bind] = pickedEntity;
  
  // Add to trace
  context.trace.push({
    stageId,
    stepType: 'pick',
    pool: step.pool,
    bind: step.bind,
    table: result.table,
    pickedId: result.pickedId,
    draw: result.draw
  });
  
  return step.next;
}

/**
 * Execute a check step (FR-X4, FR-S7)
 * Check a stat against difficulty, proceed to success or fail
 * 
 * @param {string} scenarioId - Scenario ID
 * @param {string} stepId - Step ID
 * @param {any} step - Step object
 * @param {ScenarioContext} context - Context
 * @returns {string} Next step ID (success or fail)
 */
function executeCheck(scenarioId, stepId, step, context) {
  const { character, carriedTags, data } = context;
  
  // Get effective stats (with wounded applied)
  const effectiveStats = getEffectiveStats(
    character.strength,
    character.speed,
    character.durability,
    carriedTags
  );
  
  // Map stat name to value
  const statMap = {
    'strength': effectiveStats.str,
    'speed': effectiveStats.spd,
    'durability': effectiveStats.dur
  };
  
  const statValue = statMap[step.stat];
  if (statValue === undefined) {
    throw new Error(`Unknown stat: ${step.stat} in scenario ${scenarioId} step ${stepId}`);
  }
  
  const result = resolveCheck(
    statValue,
    step.difficulty,
    step.baseOdds,
    context.rng,
    data
  );
  
  // Add to trace
  const stageId = `scenario:${scenarioId}:${stepId}`;
  context.trace.push({
    stageId,
    stepType: 'check',
    stat: step.stat,
    statValue,
    difficulty: step.difficulty,
    baseOdds: step.baseOdds,
    outcome: result.outcome,
    draw: result.draw,
    prob: result.prob
  });
  
  return step.next[result.outcome];
}

  /**
 * Execute a contest step (FR-X4, FR-S5)
 * Fight against a bound opponent or carried rival
 * 
 * @param {string} scenarioId - Scenario ID
 * @param {string} stepId - Step ID
 * @param {any} step - Step object
 * @param {ScenarioContext} context - Context
 * @returns {string} Next step ID (win/lose/flee/standoff)
 */
function executeContest(scenarioId, stepId, step, context) {
  const { character, carriedTags, data, bindings } = context;
  
  if (step.mode !== 'fight') {
    throw new Error(`Unknown contest mode: ${step.mode} in scenario ${scenarioId} step ${stepId}`);
  }
  
  // Get opponent
  let opponent;
  if (step.vs === 'rival') {
    // Use the rival from bindings (set by previous scenario standoff)
    opponent = bindings['rival'];
    if (!opponent) {
      // If no rival bound, this scenario shouldn't have been selected
      // This is a validation issue, but handle gracefully
      throw new Error(`Contest step ${stepId} references rival but none is bound`);
    }
  } else {
    opponent = bindings[step.vs];
  }
  
  if (!opponent) {
    throw new Error(`Contest step ${stepId} references unknown binding: ${step.vs}`);
  }
  
  // Get character effective strength and stats with wounded
  const effStrChar = calculateEffectiveStrength(character.strength, character.weapon, data);
  const effectiveStatsChar = getEffectiveStats(
    character.strength,
    character.speed,
    character.durability,
    carriedTags
  );
  
  // Character tags
  const tagsChar = getCharacterTags(character, data);
  
  // Opponent stats (no weapon for pool opponents in v1)
  // Opponent does NOT get wounded effect (only player carries tags)
  const effStrOpp = opponent.str;
  const spdOpp = opponent.spd;
  const durOpp = opponent.dur;
  const tagsOpp = getOpponentTags(opponent);
  
  // Resolve fight
  const result = resolveFight(
    effStrChar,
    effectiveStatsChar.spd,
    effectiveStatsChar.dur,
    tagsChar,
    effStrOpp,
    spdOpp,
    durOpp,
    tagsOpp,
    context.rng,
    data
  );
  
  // Add to trace
  const stageId = `scenario:${scenarioId}:${stepId}`;
  context.trace.push({
    stageId,
    stepType: 'contest',
    mode: step.mode,
    opponent: opponent.id,
    charEffStr: effStrChar,
    charSpd: effectiveStatsChar.spd,
    charDur: effectiveStatsChar.dur,
    oppEffStr: effStrOpp,
    oppSpd: spdOpp,
    oppDur: durOpp,
    outcome: result.outcome,
    draw: result.draw,
    prob: result.prob
  });
  
  // If outcome is standoff and this opponent isn't already a rival, bind it
  if (result.outcome === 'standoff') {
    bindings['rival'] = opponent;
  }
  
  return step.next[result.outcome];
}

/**
 * Check if a scenario's requires clause is satisfied (FR-X4)
 * 
 * @param {any} scenario - Scenario object
 * @param {string[]} characterTags - Character's tags (innate + powers + weapon)
 * @param {string[]} carriedTags - Currently carried tags
 * @param {any} character - Character object (for race check)
 * @returns {boolean} True if requirements are satisfied
 */
export function checkScenarioRequires(scenario, characterTags, carriedTags, character) {
  const requires = scenario.requires || {};
  
  // Check required tags
  if (requires.tags) {
    for (const tag of requires.tags) {
      if (!characterTags.includes(tag)) {
        return false;
      }
    }
  }
  
  // Check forbidden tags
  if (requires.notTags) {
    for (const tag of requires.notTags) {
      if (characterTags.includes(tag)) {
        return false;
      }
    }
  }
  
  // Check carried tags
  if (requires.carried) {
    for (const tag of requires.carried) {
      if (!carriedTags.includes(tag)) {
        return false;
      }
    }
  }
  
  // Check race (if specified)
  if (requires.race) {
    if (character.race !== requires.race) {
      return false;
    }
  }
  
  // Check trait (if specified)
  if (requires.trait) {
    if (character.trait !== requires.trait) {
      return false;
    }
  }
  
  return true;
}

/**
 * Apply weight mods to scenario weight based on character
 * 
 * @param {any} scenario - Scenario object
 * @param {number} baseWeight - Base weight
 * @param {any} character - Character object
 * @param {string[]} characterTags - Character's tags
 * @param {string[]} carriedTags - Currently carried tags
 * @returns {number} Modified weight
 */
export function applyScenarioWeightMods(scenario, baseWeight, character, characterTags, carriedTags) {
  let weight = baseWeight;
  
  const weightMods = scenario.weightMods || [];
  for (const mod of weightMods) {
    if (mod.if) {
      // Parse condition (e.g., "trait:ambitious", "tag:fire", "carried:rival")
      const [condType, condValue] = mod.if.split(':');
      
      let matches = false;
      if (condType === 'trait' && character.trait === condValue) {
        matches = true;
      } else if (condType === 'tag' && characterTags.includes(condValue)) {
        matches = true;
      } else if (condType === 'carried' && carriedTags.includes(condValue)) {
        matches = true;
      } else if (condType === 'race' && character.race === condValue) {
        matches = true;
      }
      
      if (matches) {
        weight *= mod.mult;
      }
    }
  }
  
  return weight;
}
