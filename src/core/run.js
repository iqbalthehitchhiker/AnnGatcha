// @ts-check

import { createRngFromRedoMap } from './rng.js';
import { pick, computeTraceLogProb, createTable } from './picker.js';
import { collectMods, applyTierMods, applyOffsetMods } from './mods.js';
import { executeChain } from './chain.js';

/**
 * @typedef {Object} Character
 * @property {string} race
 * @property {string} archetype
 * @property {string} size
 * @property {string} trait
 * @property {number} powerCount
 * @property {string[]} powers
 * @property {number} strength - Level in [0, 11)
 * @property {number} speed - Level in [0, 11)
 * @property {number} durability - Level in [0, 11)
 * @property {Object} [weapon] - Optional weapon
 * @property {string} weapon.type
 * @property {string} weapon.enchantment
 */

/**
 * @typedef {Object} RunResult
 * @property {Character} character
 * @property {string} band - Character's band
 * @property {number} effStr - Effective strength at chain start
 * @property {any[]} scenarios - Array of scenario outcomes
 * @property {any[]} trace - Full trace of all picks
 * @property {number} logProbability - Creation path log-probability
 */

/**
 * Generate a complete run
 * Per FR-A1: Main orchestrator, accepts redoMap for stage independence
 * Per FR-A2: Returns character, scenarios, trace, and log-probability
 * 
 * @param {any} data - Complete game data
 * @param {string} masterSeed - Master seed for the run
 * @param {Object<string, number>} [redoMap={}] - Map of stageId to redo counter
 * @returns {RunResult} Complete run result
 */
export function generateRun(data, masterSeed, redoMap = {}) {
  /** @type {any[]} */
  const trace = [];
  /** @type {any} */
  const character = {};
  const stageOrder = data.config.stageOrder;

  // Execute each stage in order
  for (const stage of stageOrder) {
    const rng = createRngFromRedoMap(masterSeed, stage, redoMap);
    executeStage(stage, data, character, rng, trace);
  }

  // Compute log-probability for rarity (FR-M4)
  // Exclude: continuous sub-roll, speed, durability, scenarios
  // Include: race, archetype, trait, powerCount, strength tier, weapon
  const rarityTrace = trace.filter(entry => {
    return entry.stageId === 'race' ||
           entry.stageId === 'archetype' ||
           entry.stageId === 'trait' ||
           entry.stageId === 'powerCount' ||
           entry.stageId === 'strength' ||
           entry.stageId === 'weapon' ||
           entry.stageId === 'weapon:type' ||
           entry.stageId === 'weapon:enchantment';
  });
  const logProbability = computeTraceLogProb(rarityTrace);

  // Execute the three-scenario chain (M1a)
  const chainResult = executeChain(character, data, masterSeed, redoMap);

  return {
    character: /** @type {Character} */ (character),
    band: chainResult.band,
    effStr: chainResult.effStr,
    scenarios: chainResult.scenarios,
    trace,
    logProbability
  };
}

/**
 * Execute a single stage
 */
function executeStage(stage, data, character, rng, trace) {
  switch (stage) {
    case 'race':
      executeRaceStage(data, character, rng, trace);
      break;
    case 'archetype':
      executeArchetypeStage(data, character, rng, trace);
      break;
    case 'size':
      executeSizeStage(data, character, rng, trace);
      break;
    case 'trait':
      executeTraitStage(data, character, rng, trace);
      break;
    case 'powerCount':
      executePowerCountStage(data, character, rng, trace);
      break;
    case 'powers':
      executePowersStage(data, character, rng, trace);
      break;
    case 'strength':
      executeStrengthStage(data, character, rng, trace);
      break;
    case 'speedOffset':
      executeSpeedOffsetStage(data, character, rng, trace);
      break;
    case 'durOffset':
      executeDurOffsetStage(data, character, rng, trace);
      break;
    case 'weapon':
      executeWeaponStage(data, character, rng, trace);
      break;
    default:
      throw new Error(`Unknown stage: ${stage}`);
  }
}

/**
 * Race stage
 */
function executeRaceStage(data, character, rng, trace) {
  const entries = Object.entries(data.races).map(([id, race]) => ({
    id,
    weight: race.weight
  }));
  
  const result = pick(entries, rng, 'race');
  character.race = result.pickedId;
  trace.push({
    stageId: 'race',
    table: result.table,
    pickedId: result.pickedId,
    draw: result.draw
  });
}

/**
 * Archetype stage
 */
function executeArchetypeStage(data, character, rng, trace) {
  const race = data.races[character.race];
  const entries = Object.entries(race.archetypes).map(([id, weight]) => ({
    id,
    weight
  }));
  
  const result = pick(entries, rng, 'archetype');
  character.archetype = result.pickedId;
  trace.push({
    stageId: 'archetype',
    table: result.table,
    pickedId: result.pickedId,
    draw: result.draw
  });
}

/**
 * Size stage
 */
function executeSizeStage(data, character, rng, trace) {
  const race = data.races[character.race];
  const entries = Object.entries(race.sizes).map(([id, weight]) => ({
    id,
    weight
  }));
  
  const result = pick(entries, rng, 'size');
  character.size = result.pickedId;
  trace.push({
    stageId: 'size',
    table: result.table,
    pickedId: result.pickedId,
    draw: result.draw
  });
}

/**
 * Trait stage
 */
function executeTraitStage(data, character, rng, trace) {
  const race = data.races[character.race];
  
  // Start with base trait weights
  let traitWeights = {};
  for (const [id, trait] of Object.entries(data.traits)) {
    traitWeights[id] = trait.weight;
  }
  
  // Apply race trait weight mods
  if (race.traitWeights) {
    for (const [id, mult] of Object.entries(race.traitWeights)) {
      if (traitWeights[id]) {
        traitWeights[id] *= mult;
      }
    }
  }
  
  const entries = Object.entries(traitWeights).map(([id, weight]) => ({
    id,
    weight
  }));
  
  const result = pick(entries, rng, 'trait');
  character.trait = result.pickedId;
  trace.push({
    stageId: 'trait',
    table: result.table,
    pickedId: result.pickedId,
    draw: result.draw
  });
}

/**
 * Power count stage
 */
function executePowerCountStage(data, character, rng, trace) {
  const entries = createTable(data.config.powerCount);
  const result = pick(entries, rng, 'powerCount');
  
  if (result.pickedId === 'all') {
    character.powerCount = data.config.maxPowers;
  } else {
    character.powerCount = parseInt(result.pickedId, 10);
  }
  
  trace.push({
    stageId: 'powerCount',
    table: result.table,
    pickedId: result.pickedId,
    draw: result.draw
  });
}

/**
 * Powers stage
 */
function executePowersStage(data, character, rng, trace) {
  const archetype = data.archetypes[character.archetype];
  const poolTags = new Set(archetype.poolTags || []);
  
  // Filter powers by pool tags
  let powerWeights = {};
  for (const [id, power] of Object.entries(data.powers)) {
    if (power.tags && power.tags.some(tag => poolTags.has(tag))) {
      let weight = power.weight;
      
      // Apply archetype tag weights
      if (archetype.tagWeights) {
        for (const tag of power.tags) {
          if (archetype.tagWeights[tag]) {
            weight *= archetype.tagWeights[tag];
          }
        }
      }
      
      powerWeights[id] = weight;
    }
  }
  
  // Pick powers without replacement
  character.powers = [];
  for (let i = 0; i < character.powerCount; i++) {
    const entries = Object.entries(powerWeights).map(([id, weight]) => ({
      id,
      weight
    }));
    
    // Stop if pool is exhausted
    if (entries.length === 0) {
      break;
    }
    
    const result = pick(entries, rng, `powers:${i}`);
    character.powers.push(result.pickedId);
    
    // Remove picked power from pool for next iteration
    delete powerWeights[result.pickedId];
    
    // Note: Per FR-M4, individual power picks are excluded from rarity
    // So we don't add them to trace, or we mark them differently
    trace.push({
      stageId: `powers:${i}`,
      table: result.table,
      pickedId: result.pickedId,
      draw: result.draw
    });
  }
}

/**
 * Strength stage
 * Per FR-C4: Tier weights with power count shift and tail floor
 */
function executeStrengthStage(data, character, rng, trace) {
  const race = data.races[character.race];
  const archetype = data.archetypes[character.archetype];
  const mods = collectMods(race, archetype);
  
  // Get base tier weights
  let tierWeights = { ...race.tierWeights };
  
  // Apply power count shift (FR-C4)
  const powerCountKey = character.powerCount === data.config.maxPowers ? 'all' : 
                        character.powerCount.toString();
  const shift = data.config.powerCountShift[powerCountKey] || 0;
  
  // Shift tiers (lower tier = stronger)
  /** @type {Object<string, number>} */
  const shiftedWeights = {};
  for (const [tierStr, weight] of Object.entries(tierWeights)) {
    const tier = parseInt(tierStr, 10);
    const newTier = tier - shift;
    if (newTier >= 0 && newTier <= 10) {
      shiftedWeights[newTier.toString()] = weight;
    }
  }
  
  // Add tail floor to all tiers
  for (let tier = 0; tier <= 10; tier++) {
    const tierStr = tier.toString();
    if (!shiftedWeights[tierStr]) {
      shiftedWeights[tierStr] = 0;
    }
    shiftedWeights[tierStr] += data.config.tierTailFloor;
  }
  
  // Apply mods
  const finalWeights = applyTierMods(shiftedWeights, mods, 'strength');
  
  // Pick tier
  const entries = createTable(finalWeights);
  const result = pick(entries, rng, 'strength');
  const tier = parseInt(result.pickedId, 10);
  
  trace.push({
    stageId: 'strength',
    table: result.table,
    pickedId: result.pickedId,
    draw: result.draw
  });
  
  // Hidden fractional sub-roll (FR-C7)
  const frac = rng();
  character.strength = (10 - tier) + frac; // L = (10 - tier) + frac
}

/**
 * Speed offset stage
 */
function executeSpeedOffsetStage(data, character, rng, trace) {
  const race = data.races[character.race];
  const archetype = data.archetypes[character.archetype];
  const mods = collectMods(race, archetype);
  
  // Get offsets (default to {"0": 1})
  let offsets = race.offsets?.spd || { "0": 1 };
  
  // Apply mods
  offsets = applyOffsetMods(offsets, mods, 'spd');
  
  const entries = createTable(offsets);
  const result = pick(entries, rng, 'speedOffset');
  const offset = parseFloat(result.pickedId);
  
  // Speed = strength + offset, clamped to [0, 11)
  character.speed = Math.max(0, Math.min(character.strength + offset, 10.999));
  
  trace.push({
    stageId: 'speedOffset',
    table: result.table,
    pickedId: result.pickedId,
    draw: result.draw
  });
}

/**
 * Durability offset stage
 */
function executeDurOffsetStage(data, character, rng, trace) {
  const race = data.races[character.race];
  const archetype = data.archetypes[character.archetype];
  const mods = collectMods(race, archetype);
  
  // Get offsets (default to {"0": 1})
  let offsets = race.offsets?.dur || { "0": 1 };
  
  // Apply mods
  offsets = applyOffsetMods(offsets, mods, 'dur');
  
  const entries = createTable(offsets);
  const result = pick(entries, rng, 'durOffset');
  const offset = parseFloat(result.pickedId);
  
  // Durability = strength + offset, clamped to [0, 11)
  character.durability = Math.max(0, Math.min(character.strength + offset, 10.999));
  
  trace.push({
    stageId: 'durOffset',
    table: result.table,
    pickedId: result.pickedId,
    draw: result.draw
  });
}

/**
 * Weapon stage
 * Three-stage: yes/no, then type, then enchantment
 */
function executeWeaponStage(data, character, rng, trace) {
  const race = data.races[character.race];
  const weaponChance = race.weaponChance || 0;
  
  // Stage 1: Yes/no
  const hasWeaponEntries = [
    { id: 'yes', weight: weaponChance },
    { id: 'no', weight: 1 - weaponChance }
  ];
  const hasWeaponResult = pick(hasWeaponEntries, rng, 'weapon');
  
  trace.push({
    stageId: 'weapon',
    table: hasWeaponResult.table,
    pickedId: hasWeaponResult.pickedId,
    draw: hasWeaponResult.draw
  });
  
  if (hasWeaponResult.pickedId === 'no') {
    character.weapon = null;
    return;
  }
  
  // Stage 2: Type
  const typeEntries = Object.entries(data.weapons.types).map(([id, type]) => ({
    id,
    weight: type.weight
  }));
  const typeResult = pick(typeEntries, rng, 'weapon:type');
  
  trace.push({
    stageId: 'weapon:type',
    table: typeResult.table,
    pickedId: typeResult.pickedId,
    draw: typeResult.draw
  });
  
  // Stage 3: Enchantment
  const enchEntries = Object.entries(data.weapons.enchantments).map(([id, ench]) => ({
    id,
    weight: ench.weight
  }));
  const enchResult = pick(enchEntries, rng, 'weapon:enchantment');
  
  trace.push({
    stageId: 'weapon:enchantment',
    table: enchResult.table,
    pickedId: enchResult.pickedId,
    draw: enchResult.draw
  });
  
  character.weapon = {
    type: typeResult.pickedId,
    enchantment: enchResult.pickedId
  };
}
