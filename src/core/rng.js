// @ts-check

/**
 * xmur3 hash function for seed generation
 * @param {string} str - Input string to hash
 * @returns {() => number} Function that returns sequential hash values
 */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = (h ^ str.charCodeAt(i)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h = (h ^= h >>> 16) >>> 0;
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/**
 * sfc32 pseudo-random number generator
 * @param {number} a - Seed component 1
 * @param {number} b - Seed component 2
 * @param {number} c - Seed component 3
 * @param {number} d - Seed component 4
 * @returns {() => number} Function that returns random numbers in [0, 1)
 */
function sfc32(a, b, c, d) {
  return function() {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/**
 * Create a seeded RNG for a specific stage
 * Per NFR-4: stream key is "master|stageId|redoCount"
 * @param {string} masterSeed - The master seed for the run
 * @param {string} stageId - The stage identifier
 * @param {number} redoCount - The redo counter for this stage (default 0)
 * @returns {() => number} RNG function that returns numbers in [0, 1)
 */
export function createRng(masterSeed, stageId, redoCount = 0) {
  const streamKey = `${masterSeed}|${stageId}|${redoCount}`;
  const hash = xmur3(streamKey);
  return sfc32(hash(), hash(), hash(), hash());
}

/**
 * Create an RNG from a redoMap
 * @param {string} masterSeed - The master seed for the run
 * @param {string} stageId - The stage identifier
 * @param {Object<string, number>} redoMap - Map of stageId to redo counter
 * @returns {() => number} RNG function that returns numbers in [0, 1)
 */
export function createRngFromRedoMap(masterSeed, stageId, redoMap = {}) {
  const redoCount = redoMap[stageId] || 0;
  return createRng(masterSeed, stageId, redoCount);
}
