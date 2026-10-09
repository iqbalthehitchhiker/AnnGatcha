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
 * Resolve a fight between character and opponent (FR-S5, FR-S8)
 * Per flee amendment: char/opp explicit, flee means character escaped
 * Returns outcome entries for picker.js to record as a pick
 * 
 * @param {number} effStrChar - Character's effective strength
 * @param {number} spdChar - Character's speed (after wounded)
 * @param {number} durChar - Character's durability (after wounded)
 * @param {string[]} tagsChar - Character's tags
 * @param {number} effStrOpp - Opponent's effective strength
 * @param {number} spdOpp - Opponent's speed (after wounded)
 * @param {number} durOpp - Opponent's durability (after wounded)
 * @param {string[]} tagsOpp - Opponent's tags
 * @param {any} data - Game data
 * @returns {{entries: Array<{id: string, weight: number}>, harmClass: string}} Outcome entries and harm class
 */
export function resolveFight(effStrChar, spdChar, durChar, tagsChar, effStrOpp, spdOpp, durOpp, tagsOpp, data) {
  const config = data.config;
  
  const charCanHarmOpp = canHarm(effStrChar, durOpp, tagsChar, tagsOpp, data);
  const oppCanHarmChar = canHarm(effStrOpp, durChar, tagsOpp, tagsChar, data);
  
  // Determine harm class for meta field
  let harmClass;
  if (!charCanHarmOpp && !oppCanHarmChar) {
    harmClass = 'neither';
  } else if (charCanHarmOpp && oppCanHarmChar) {
    harmClass = 'both';
  } else {
    harmClass = 'one-sided';
  }
  
  // Case 1: Neither can harm (stalemate procedure, FR-S6)
  if (!charCanHarmOpp && !oppCanHarmChar) {
    return resolveStalemate(spdChar, spdOpp, harmClass, data);
  }
  
  // Case 2: One-sided (FR-S5.2)
  if (charCanHarmOpp && !oppCanHarmChar) {
    // Character can harm opponent, opponent cannot harm character
    // Opponent is the harmed side (H), character is the harming side (S)
    const speedGap = spdOpp - spdChar; // H's speed - S's speed
    if (speedGap > config.speedGapFlee) {
      // H is the opponent and faster: standoff (opponent escapes)
      return {
        entries: [{ id: 'standoff', weight: 1 }],
        harmClass
      };
    } else {
      // Rout: character wins with probability (1 - minOdds)
      const pWin = 1 - config.minOdds;
      return {
        entries: [
          { id: 'win', weight: pWin },
          { id: 'lose', weight: config.minOdds }
        ],
        harmClass
      };
    }
  }
  
  if (oppCanHarmChar && !charCanHarmOpp) {
    // Opponent can harm character, character cannot harm opponent
    // Character is the harmed side (H), opponent is the harming side (S)
    const speedGap = spdChar - spdOpp; // H's speed - S's speed
    if (speedGap > config.speedGapFlee) {
      // H is the character and faster: flee (character escapes)
      return {
        entries: [{ id: 'flee', weight: 1 }],
        harmClass
      };
    } else {
      // Rout: opponent wins with probability (1 - minOdds)
      const pLose = 1 - config.minOdds;
      return {
        entries: [
          { id: 'lose', weight: pLose },
          { id: 'win', weight: config.minOdds }
        ],
        harmClass
      };
    }
  }
  
  // Case 3: Both can harm (FR-S5.3)
  const diff = ((effStrChar - durOpp) - (effStrOpp - durChar)) / 2 + 
               config.speedWeight * (spdChar - spdOpp);
  const pWin = logistic(config.checkSteepness * diff);
  const pWinClamped = Math.max(config.minOdds, Math.min(pWin, 1 - config.minOdds));
  
  return {
    entries: [
      { id: 'win', weight: pWinClamped },
      { id: 'lose', weight: 1 - pWinClamped }
    ],
    harmClass
  };
}

/**
 * Resolve stalemate (FR-S6)
 * (a) If speed gap exceeds speedGapFlee, faster side disengages:
 *     flee if character is faster, standoff if opponent is faster
 * (b) Otherwise standoff
 * 
 * @param {number} spdChar - Character's speed
 * @param {number} spdOpp - Opponent's speed
 * @param {string} harmClass - Harm class for meta field
 * @param {any} data - Game data
 * @returns {{entries: Array<{id: string, weight: number}>, harmClass: string}} Outcome entries for picker
 */
function resolveStalemate(spdChar, spdOpp, harmClass, data) {
  const speedGap = Math.abs(spdChar - spdOpp);
  
  if (speedGap > data.config.speedGapFlee) {
    // Faster side disengages
    if (spdChar > spdOpp) {
      // Character is faster: flee
      return {
        entries: [{ id: 'flee', weight: 1 }],
        harmClass
      };
    } else {
      // Opponent is faster: standoff
      return {
        entries: [{ id: 'standoff', weight: 1 }],
        harmClass
      };
    }
  } else {
    // Neither side is significantly faster: standoff
    return {
      entries: [{ id: 'standoff', weight: 1 }],
      harmClass
    };
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
