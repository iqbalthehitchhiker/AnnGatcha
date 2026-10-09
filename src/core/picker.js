// @ts-check

/**
 * @typedef {Object} PickEntry
 * @property {string} id - Entry identifier
 * @property {number} weight - Relative weight (must be > 0)
 */

/**
 * @typedef {Object} PickTableEntry
 * @property {string} id - Entry identifier
 * @property {number} weight - Original weight
 * @property {number} prob - Normalized probability
 */

/**
 * @typedef {Object} PickResult
 * @property {string} pickedId - The selected entry ID
 * @property {number} draw - The raw draw value from RNG [0, 1)
 * @property {PickTableEntry[]} table - The normalized table with probabilities
 */

/**
 * @typedef {Object} TraceEntry
 * @property {string} stageId - Stage identifier
 * @property {PickTableEntry[]} table - Normalized table with probabilities
 * @property {string} pickedId - Selected entry ID
 * @property {number} draw - Raw draw value [0, 1)
 */

/**
 * Perform a weighted pick from a table
 * Per FR-C2: Weights are relative and normalized at runtime
 * Each pick consumes exactly one RNG draw (section 4)
 * 
 * @param {PickEntry[]} entries - Array of entries with id and weight
 * @param {() => number} rng - RNG function returning [0, 1)
 * @param {string} stageId - Stage identifier for trace
 * @returns {PickResult} The pick result with trace information
 * @throws {Error} If table is empty or has non-positive weights
 */
export function pick(entries, rng, stageId) {
  if (!entries || entries.length === 0) {
    throw new Error(`Empty table at stage ${stageId}`);
  }

  // Validate and compute total weight
  let totalWeight = 0;
  for (const entry of entries) {
    if (entry.weight <= 0) {
      throw new Error(`Non-positive weight ${entry.weight} for ${entry.id} at stage ${stageId}`);
    }
    totalWeight += entry.weight;
  }

  // Normalize weights to probabilities
  const table = entries.map(entry => ({
    id: entry.id,
    weight: entry.weight,
    prob: entry.weight / totalWeight
  }));

  // Consume exactly one draw
  const draw = rng();

  // Map draw through cumulative probabilities
  let cumulative = 0;
  for (const entry of table) {
    cumulative += entry.prob;
    if (draw < cumulative) {
      return {
        pickedId: entry.id,
        draw,
        table
      };
    }
  }

  // Handle floating point edge case: draw is at or above 1.0 due to rounding
  // Pick the last entry
  return {
    pickedId: table[table.length - 1].id,
    draw,
    table
  };
}

/**
 * Compute the log-probability of a trace
 * Used for rarity calculation (FR-M4)
 * 
 * @param {TraceEntry[]} trace - Array of trace entries
 * @returns {number} Sum of log probabilities
 */
export function computeTraceLogProb(trace) {
  let logProb = 0;
  for (const entry of trace) {
    // Find the picked entry in the table
    const pickedEntry = entry.table.find(e => e.id === entry.pickedId);
    if (!pickedEntry) {
      throw new Error(`Trace inconsistency: ${entry.pickedId} not in table at ${entry.stageId}`);
    }
    logProb += Math.log(pickedEntry.prob);
  }
  return logProb;
}

/**
 * Create a weighted table from an object map
 * Helper for common case where entries are {id: weight, ...}
 * 
 * @param {Object<string, number>} weightMap - Map of id to weight
 * @returns {PickEntry[]} Array of pick entries
 */
export function createTable(weightMap) {
  return Object.entries(weightMap).map(([id, weight]) => ({
    id,
    weight
  }));
}
