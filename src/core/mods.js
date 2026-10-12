// @ts-check

/**
 * @typedef {Object} ShiftTierMod
 * @property {'shiftTier'} op
 * @property {string} stat - 'strength' | 'speed' | 'durability'
 * @property {number} by - Tier shift amount
 */

/**
 * @typedef {Object} ShiftOffsetMod
 * @property {'shiftOffset'} op
 * @property {string} stat - 'spd' | 'dur'
 * @property {number} by - Offset shift amount
 */

/**
 * @typedef {Object} ShiftPowerCountMod
 * @property {'shiftPowerCount'} op
 * @property {number} by - Power count shift amount
 */

/**
 * @typedef {Object} ScaleWeightMod
 * @property {'scaleWeight'} op
 * @property {string} stage - Stage name
 * @property {string} [entry] - Specific entry ID to scale
 * @property {string} [tag] - Tag to match for scaling
 * @property {number} by - Multiplier for weight
 */

/**
 * @typedef {Object} TiltMod
 * @property {'tilt'} op
 * @property {string} stage
 * @property {string} field
 * @property {number} by
 */

/**
 * @typedef {ShiftTierMod | ShiftOffsetMod | ShiftPowerCountMod | ScaleWeightMod | TiltMod} Mod
 */

/**
 * Apply a tier shift to a tier weight map
 * Per FR-C1: closed op list for table resolution
 * 
 * @param {Object<string, number>} tierWeights - Map of tier to weight
 * @param {number} shift - Amount to shift (positive = stronger)
 * @returns {Object<string, number>} Shifted tier weights
 */
export function applyTierShift(tierWeights, shift) {
  if (shift === 0) return { ...tierWeights };
  
  /** @type {Object<string, number>} */
  const result = {};
  for (const [tierStr, weight] of Object.entries(tierWeights)) {
    const tier = parseInt(tierStr, 10);
    const newTier = tier - shift; // Lower tier number = stronger
    if (newTier >= 0 && newTier <= 10) {
      result[newTier.toString()] = weight;
    }
  }
  return result;
}

/**
 * Apply an offset shift to an offset weight map
 * 
 * @param {Object<string, number>} offsets - Map of offset to weight
 * @param {number} shift - Amount to shift
 * @returns {Object<string, number>} Shifted offsets
 */
export function applyOffsetShift(offsets, shift) {
  if (shift === 0) return { ...offsets };
  
  /** @type {Object<string, number>} */
  const result = {};
  for (const [offsetStr, weight] of Object.entries(offsets)) {
    const offset = parseFloat(offsetStr);
    const newOffset = offset + shift;
    result[newOffset.toString()] = weight;
  }
  return result;
}

/**
 * Scale weights in a table by multiplier
 * Can target specific entry or entries with a tag
 * 
 * @param {Object<string, any>} table - Table of entries (each with weight property)
 * @param {number} multiplier - Scale factor
 * @param {string=} entryId - Specific entry to scale
 * @param {string=} tag - Tag to match (entries must have tags array)
 * @returns {Object<string, any>} Table with scaled weights
 */
export function scaleWeights(table, multiplier, entryId, tag) {
  const result = {};
  
  for (const [id, entry] of Object.entries(table)) {
    const newEntry = { ...entry };
    
    // Check if this entry should be scaled
    let shouldScale = false;
    if (entryId && id === entryId) {
      shouldScale = true;
    } else if (tag && entry.tags && entry.tags.includes(tag)) {
      shouldScale = true;
    } else if (!entryId && !tag) {
      shouldScale = true; // Scale all if no filter
    }
    
    if (shouldScale) {
      newEntry.weight = entry.weight * multiplier;
    }
    
    result[id] = newEntry;
  }
  
  return result;
}

/**
 * Apply a list of mods to build data for a specific character state
 * Per FR-C1: All stage-specific rules go through this closed op list
 * 
 * @param {any} baseData - The base data object
 * @param {Mod[]} mods - Array of mods to apply
 * @param {any} _characterState - Current character state (unused in M0)
 * @returns {any} Modified data
 */
export function applyMods(baseData, mods, _characterState) {
  let data = baseData;
  
  for (const mod of mods) {
    switch (mod.op) {
      case 'shiftTier':
        // Applied to tier weights during strength stage
        // This is handled by the stage resolution logic
        break;
        
      case 'shiftOffset':
        // Applied to offset tables during speed/dur stages
        // This is handled by the stage resolution logic
        break;
        
      case 'shiftPowerCount':
        // Applied to power count during powerCount stage
        // This is handled by the stage resolution logic
        break;
        
      case 'scaleWeight':
        // Applied to entry weights in various stages
        // This is handled by the stage resolution logic
        break;
        
      default:
        throw new Error(`Unknown mod op: ${/** @type {any} */ (mod).op}`);
    }
  }
  
  return data;
}

/**
 * Collect all mods from race and archetype
 * 
 * @param {any} race - Race data
 * @param {any} archetype - Archetype data
 * @returns {Mod[]} Combined mods array
 */
export function collectMods(race, archetype) {
  const mods = [];
  
  if (race) {
    if (race.mods) {
      mods.push(...race.mods);
    }
    const weaponTilt = race.weaponTilt;
    if (weaponTilt !== undefined && weaponTilt !== null && weaponTilt !== 0) {
      mods.push({ op: 'tilt', stage: 'weapon:type', field: 'level', by: weaponTilt });
      mods.push({ op: 'tilt', stage: 'weapon:enchantment', field: 'levelBonus', by: weaponTilt });
    }
    const powerTilt = race.powerTilt;
    if (powerTilt !== undefined && powerTilt !== null && powerTilt !== 0) {
      mods.push({ op: 'tilt', stage: 'powers', field: 'rank', by: powerTilt });
    }
  }
  
  if (archetype && archetype.mods) {
    mods.push(...archetype.mods);
  }
  
  return mods;
}

/**
 * Apply tilt to a table of entries
 * multiplies each entry's weight by exp(by * (entry[field] - 1))
 * Missing field defaults to 1 (identity)
 * @param {Array<{id: string, weight: number, [key: string]: any}>} entries - Array of entries
 * @param {string} field - Field name to tilt by
 * @param {number} by - Tilt factor
 * @returns {Array<{id: string, weight: number, [key: string]: any}>} New array of entries with modified weights
 */
export function applyTilt(entries, field, by) {
  if (by === 0) {
    return entries.map(e => ({ ...e }));
  }
  const result = [];
  for (const e of entries) {
    const val = e[field];
    const target = (typeof val === 'number' && isFinite(val)) ? val : 1;
    const newWeight = e.weight * Math.exp(by * (target - 1));
    result.push({ ...e, weight: newWeight });
  }
  return result;
}

/**
 * Apply mods to a stage table (object form)
 * This is the main entry point for stage resolution
 * 
 * @param {string} stage - Stage name
 * @param {Object<string, any>} table - Base table
 * @param {Mod[]} mods - Mods to apply
 * @param {any} _characterState - Current character state (unused in M0)
 * @returns {Object<string, any>} Modified table
 */
export function applyModsToTable(stage, table, mods, _characterState) {
  let result = { ...table };
  
  for (const mod of mods) {
    if (mod.op === 'scaleWeight' && mod.stage === stage) {
      result = scaleWeights(result, mod.by, mod.entry, mod.tag);
    } else if (mod.op === 'tilt' && mod.stage === stage) {
      const entries = Object.entries(result).map(([id, entry]) => ({ id, ...(entry || {}) }));
      const tilted = applyTilt(entries, mod.field, mod.by);
      result = {};
      for (const e of tilted) {
        const { id, ...rest } = e;
        result[id] = rest;
      }
    }
  }
  
  return result;
}

/**
 * Apply tier shift mods to tier weights
 * 
 * @param {Object<string, number>} tierWeights - Base tier weights
 * @param {Mod[]} mods - Mods to apply
 * @param {string} stat - Which stat ('strength', 'speed', 'durability')
 * @returns {Object<string, number>} Modified tier weights
 */
export function applyTierMods(tierWeights, mods, stat) {
  let result = { ...tierWeights };
  
  for (const mod of mods) {
    if (mod.op === 'shiftTier' && mod.stat === stat) {
      result = applyTierShift(result, mod.by);
    }
  }
  
  return result;
}

/**
 * Apply tilt mods to an array of entries for a given stage
 * @param {Array<{id: string, weight: number, [key: string]: any}>} entries
 * @param {string} stage
 * @param {Mod[]} mods
 * @returns {Array<{id: string, weight: number, [key: string]: any}>}
 */
export function applyTiltMods(entries, stage, mods) {
  let result = entries.map(e => ({ ...e }));
  for (const mod of mods) {
    if (mod.op === 'tilt' && mod.stage === stage) {
      result = applyTilt(result, mod.field, mod.by);
    }
  }
  return result;
}

/**
 * Apply offset shift mods to offset table
 * 
 * @param {Object<string, number>} offsets - Base offsets
 * @param {Mod[]} mods - Mods to apply
 * @param {string} stat - Which stat ('spd', 'dur')
 * @returns {Object<string, number>} Modified offsets
 */
export function applyOffsetMods(offsets, mods, stat) {
  let result = { ...offsets };
  
  for (const mod of mods) {
    if (mod.op === 'shiftOffset' && mod.stat === stat) {
      result = applyOffsetShift(result, mod.by);
    }
  }
  
  return result;
}
