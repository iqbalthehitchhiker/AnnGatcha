// @ts-check

/**
 * Data loader for browser environment
 * Per C-5: Core is pure; loading happens outside core
 * Per SRS M4: fetch data/*.json and build the same data object as sim/run.js
 */

/**
 * Load all game data from JSON files via fetch
 * @returns {Promise<any>} Complete game data object
 */
export async function loadData() {
  try {
    const [config, races, archetypes, sizes, traits, powers, tags, weapons, pools, basicScenarios] = await Promise.all([
      fetch('data/config.json').then(r => r.json()),
      fetch('data/races.json').then(r => r.json()),
      fetch('data/archetypes.json').then(r => r.json()),
      fetch('data/sizes.json').then(r => r.json()),
      fetch('data/traits.json').then(r => r.json()),
      fetch('data/powers.json').then(r => r.json()),
      fetch('data/tags.json').then(r => r.json()),
      fetch('data/weapons.json').then(r => r.json()),
      fetch('data/pools.json').then(r => r.json()),
      fetch('data/scenarios/basic.json').then(r => r.json())
    ]);
    
    // Flatten scenarios from all files (currently just basic.json)
    const scenarios = { ...basicScenarios };
    
    return {
      config,
      races,
      archetypes,
      sizes,
      traits,
      powers,
      tags,
      weapons,
      pools,
      scenarios
    };
  } catch (error) {
    throw new Error(`Failed to load game data: ${error.message}`);
  }
}

/**
 * Load percentiles data for rarity calculation
 * @returns {Promise<any|null>} Percentiles object or null if unavailable
 */
export async function loadPercentiles() {
  try {
    const response = await fetch('data/percentiles.json');
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
