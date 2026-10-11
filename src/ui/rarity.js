// @ts-check

/**
 * Rarity calculation utilities
 * Per FR-M4: Compute percentile rank from log-probability
 * Placed outside core per requirement 6 (one shared function outside core)
 */

/**
 * Compute percentile rank of a log-probability from percentiles data
 * Lower logProb = rarer = lower percentile
 * 
 * @param {number} logProb - Run log-probability
 * @param {any} percentiles - Percentiles object
 * @returns {number|null} Percentile (0-100) or null if data unavailable
 */
export function computePercentile(logProb, percentiles) {
  if (!percentiles || !percentiles.quantiles || percentiles.quantiles.length === 0) {
    return null;
  }
  
  let count = 0;
  for (const q of percentiles.quantiles) {
    if (q.logProb >= logProb) {
      count++;
    }
  }
  
  return (count / percentiles.quantiles.length) * 100;
}
