// @ts-check

/**
 * Stats and fight resolution module
 * Per FR-S1 to FR-S8: effective strength, wounded effect, canHarm, fight resolution
 */

/**
 * Get all tags for a character (innate, power, weapon)
 * @param {any} character - Character object
 * @param {any} data - Game data
 * @returns {string[]} Array of all tags
 */
export function getCharacterTags(character, data) {
  const tags = new Set();
  
  // Race tags
  const race = data.races[character.race];
  if (race.tags) {
    for (const tag of race.tags) {
      tags.add(tag);
    }
  }
  
  // Power tags
  for (const powerId of character.powers || []) {
    const power = data.powers[powerId];
    if (power && power.tags) {
      for (const tag of power.tags) {
        tags.add(tag);
      }
    }
  }
  
  // Weapon tags
  if (character.weapon) {
    const weaponType = data.weapons.types[character.weapon.type];
    if (weaponType && weaponType.tags) {
      for (const tag of weaponType.tags) {
        tags.add(tag);
      }
    }
    
    const enchantment = data.weapons.enchantments[character.weapon.enchantment];
    if (enchantment && enchantment.tags) {
      for (const tag of enchantment.tags) {
        tags.add(tag);
      }
    }
  }
  
  return Array.from(tags);
}

/**
 * Get all tags for a pool opponent
 * @param {any} opponent - Opponent from pool
 * @returns {string[]} Array of all tags
 */
export function getOpponentTags(opponent) {
  return opponent.tags || [];
}

/**
 * Calculate effective strength (FR-S2)
 * effStr = clamp(max(str, weaponLevel - weaponPenalty), 0, 11)
 * Clamped just below 11
 * 
 * @param {number} strength - Base strength level
 * @param {any} weapon - Weapon object or null
 * @param {any} data - Game data
 * @returns {number} Effective strength
 */
export function calculateEffectiveStrength(strength, weapon, data) {
  if (!weapon) {
    return strength;
  }
  
  const weaponType = data.weapons.types[weapon.type];
  const enchantment = data.weapons.enchantments[weapon.enchantment];
  
  const weaponLevel = weaponType.level + enchantment.levelBonus;
  const weaponStr = weaponLevel - data.config.weaponPenalty;
  
  const effStr = Math.max(strength, weaponStr);
  
  // Clamp to [0, 11), just below 11
  return Math.max(0, Math.min(effStr, 10.999));
}

/**
 * Apply wounded effect (FR-S3)
 * While wounded tag is active, all stats get -1.0 level
 * 
 * @param {number} stat - Stat level
 * @param {string[]} carriedTags - Currently carried tags
 * @returns {number} Modified stat
 */
export function applyWoundedEffect(stat, carriedTags) {
  if (carriedTags.includes('wounded')) {
    return Math.max(0, stat - 1.0);
  }
  return stat;
}

/**
 * Get effective stats with wounded applied
 * @param {number} str - Strength
 * @param {number} spd - Speed
 * @param {number} dur - Durability
 * @param {string[]} carriedTags - Currently carried tags
 * @returns {{str: number, spd: number, dur: number}} Effective stats
 */
export function getEffectiveStats(str, spd, dur, carriedTags) {
  return {
    str: applyWoundedEffect(str, carriedTags),
    spd: applyWoundedEffect(spd, carriedTags),
    dur: applyWoundedEffect(dur, carriedTags)
  };
}

/**
 * Check if A can harm B (FR-S4)
 * A can harm B iff:
 * (a) A has a bypass tag whose counters don't intersect B's tags, OR
 * (b) effStrA >= durB - harmMargin
 * 
 * @param {number} effStrA - A's effective strength
 * @param {number} durB - B's durability
 * @param {string[]} tagsA - A's tags
 * @param {string[]} tagsB - B's tags
 * @param {any} data - Game data
 * @returns {boolean} True if A can harm B
 */
export function canHarm(effStrA, durB, tagsA, tagsB, data) {
  // Check bypass tags (a)
  for (const tagId of tagsA) {
    const tag = data.tags[tagId];
    if (tag && tag.bypassesDurability) {
      // Check if counters intersect with B's tags
      const counters = tag.counters || [];
      const hasCounter = counters.some(c => tagsB.includes(c));
      if (!hasCounter) {
        return true; // Bypass works
      }
    }
  }
  
  // Check strength (b)
  const harmMargin = data.config.harmMargin;
  return effStrA >= durB - harmMargin;
}

/**
 * Logistic function
 */
function logistic(x) {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Inverse logistic (logit)
 */
function logit(p) {
  return Math.log(p / (1 - p));
}

/**
 * Resolve a fight between two entities (FR-S5)
 * Returns outcome and the pick result for trace
 * 
 * @param {number} effStrA - A's effective strength
 * @param {number} spdA - A's speed (after wounded)
 * @param {number} durA - A's durability (after wounded)
 * @param {string[]} tagsA - A's tags
 * @param {number} effStrB - B's effective strength
 * @param {number} spdB - B's speed (after wounded)
 * @param {number} durB - B's durability (after wounded)
 * @param {string[]} tagsB - B's tags
 * @param {() => number} rng - RNG function
 * @param {any} data - Game data
 * @returns {{outcome: string, draw: number, prob: number}} Fight result
 */
export function resolveFight(effStrA, spdA, durA, tagsA, effStrB, spdB, durB, tagsB, rng, data) {
  const config = data.config;
  
  const aCanHarmB = canHarm(effStrA, durB, tagsA, tagsB, data);
  const bCanHarmA = canHarm(effStrB, durA, tagsB, tagsA, data);
  
  // Case 1: Neither can harm (stalemate procedure, FR-S6)
  if (!aCanHarmB && !bCanHarmA) {
    return resolveStalemate(spdA, spdB, data, rng);
  }
  
  // Case 2: One-sided
  if (aCanHarmB && !bCanHarmA) {
    // A can harm B, B cannot harm A
    // B tries to flee
    const speedGap = spdB - spdA;
    if (speedGap > config.speedGapFlee) {
      // Deterministic flee
      return { outcome: 'flee', draw: 0, prob: 1.0 };
    } else {
      // Rout: A wins with probability (1 - minOdds)
      const draw = rng();
      const pWin = 1 - config.minOdds;
      const outcome = draw < pWin ? 'win' : 'lose';
      return { outcome, draw, prob: outcome === 'win' ? pWin : config.minOdds };
    }
  }
  
  if (bCanHarmA && !aCanHarmB) {
    // B can harm A, A cannot harm B
    // A tries to flee
    const speedGap = spdA - spdB;
    if (speedGap > config.speedGapFlee) {
      // Deterministic flee
      return { outcome: 'flee', draw: 0, prob: 1.0 };
    } else {
      // Rout: B wins with probability (1 - minOdds)
      const draw = rng();
      const pLose = 1 - config.minOdds;
      const outcome = draw < pLose ? 'lose' : 'win';
      return { outcome, draw, prob: outcome === 'lose' ? pLose : config.minOdds };
    }
  }
  
  // Case 3: Both can harm
  const diff = ((effStrA - durB) - (effStrB - durA)) / 2 + 
               config.speedWeight * (spdA - spdB);
  const pWin = logistic(config.checkSteepness * diff);
  const pWinClamped = Math.max(config.minOdds, Math.min(pWin, 1 - config.minOdds));
  
  const draw = rng();
  const outcome = draw < pWinClamped ? 'win' : 'lose';
  
  return { outcome, draw, prob: outcome === 'win' ? pWinClamped : 1 - pWinClamped };
}

/**
 * Resolve stalemate (FR-S6)
 * (a) If speed gap exceeds speedGapFlee, faster side flees
 * (b) Otherwise standoff
 * 
 * @param {number} spdA - A's speed
 * @param {number} spdB - B's speed
 * @param {any} data - Game data
 * @param {() => number} rng - RNG function (unused but kept for consistency)
 * @returns {{outcome: string, draw: number, prob: number}} Stalemate result
 */
function resolveStalemate(spdA, spdB, data, rng) {
  const speedGap = Math.abs(spdA - spdB);
  
  if (speedGap > data.config.speedGapFlee) {
    // Faster side disengages
    return { outcome: 'flee', draw: 0, prob: 1.0 };
  } else {
    // Standoff
    return { outcome: 'standoff', draw: 0, prob: 1.0 };
  }
}

/**
 * Resolve a non-fight check (FR-S7)
 * p = clamp(logistic(logit(baseOdds) + steepness * (stat - difficulty)), minOdds, 1 - minOdds)
 * 
 * @param {number} stat - Character's stat level
 * @param {number} difficulty - Difficulty level
 * @param {number} baseOdds - Success probability when stat equals difficulty
 * @param {() => number} rng - RNG function
 * @param {any} data - Game data
 * @returns {{outcome: string, draw: number, prob: number}} Check result
 */
export function resolveCheck(stat, difficulty, baseOdds, rng, data) {
  const config = data.config;
  const steepness = config.checkSteepness;
  
  const p = logistic(logit(baseOdds) + steepness * (stat - difficulty));
  const pClamped = Math.max(config.minOdds, Math.min(p, 1 - config.minOdds));
  
  const draw = rng();
  const outcome = draw < pClamped ? 'success' : 'fail';
  
  return { outcome, draw, prob: outcome === 'success' ? pClamped : 1 - pClamped };
}

/**
 * Get the band for a character based on effective strength (FR-X1)
 * Band is determined once at chain start from effStr
 * bandTier = 10 - floor(effStr)
 * 
 * @param {number} effStr - Effective strength
 * @param {any} data - Game data
 * @returns {string} Band ID (e.g., "10-9", "3-2")
 */
export function getBandFromEffStr(effStr, data) {
  const bandTier = 10 - Math.floor(effStr);
  
  // Find matching band
  for (const [bandId, tiers] of Object.entries(data.config.bands)) {
    if (tiers.includes(bandTier)) {
      return bandId;
    }
  }
  
  // Should not happen with proper data, but default to lowest band
  return '1-0';
}
