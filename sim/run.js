// @ts-check

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateRun } from '../src/core/run.js';
import { validate } from '../src/core/validate.js';
import { checkScenarioOptions } from '../src/core/chain.js';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Load all game data from JSON files
 * @returns {any} Complete game data object
 */
function loadData() {
  const dataDir = join(projectRoot, 'data');
  
  const data = {
    config: JSON.parse(readFileSync(join(dataDir, 'config.json'), 'utf8')),
    races: JSON.parse(readFileSync(join(dataDir, 'races.json'), 'utf8')),
    archetypes: JSON.parse(readFileSync(join(dataDir, 'archetypes.json'), 'utf8')),
    sizes: JSON.parse(readFileSync(join(dataDir, 'sizes.json'), 'utf8')),
    traits: JSON.parse(readFileSync(join(dataDir, 'traits.json'), 'utf8')),
    powers: JSON.parse(readFileSync(join(dataDir, 'powers.json'), 'utf8')),
    tags: JSON.parse(readFileSync(join(dataDir, 'tags.json'), 'utf8')),
    weapons: JSON.parse(readFileSync(join(dataDir, 'weapons.json'), 'utf8')),
    pools: JSON.parse(readFileSync(join(dataDir, 'pools.json'), 'utf8')),
    scenarios: {}
  };
  
  // Load all scenario files
  const scenariosDir = join(dataDir, 'scenarios');
  try {
    const scenarioFiles = ['basic.json']; // For M0, we know the files
    for (const file of scenarioFiles) {
      const scenarios = JSON.parse(readFileSync(join(scenariosDir, file), 'utf8'));
      Object.assign(data.scenarios, scenarios);
    }
  } catch (err) {
    console.error('Error loading scenarios:', err);
  }
  
  return data;
}

/**
 * Compute a hash of the data for percentiles validation
 * @param {any} data - Game data
 * @returns {string} Hash string
 */
function computeDataHash(data) {
  // Hash the relevant data files (not percentiles)
  const hashData = {
    config: data.config,
    races: data.races,
    archetypes: data.archetypes,
    sizes: data.sizes,
    traits: data.traits,
    powers: data.powers,
    tags: data.tags,
    weapons: data.weapons,
    pools: data.pools,
    scenarios: data.scenarios
  };
  
  const jsonStr = JSON.stringify(hashData, Object.keys(hashData).sort());
  return crypto.createHash('sha256').update(jsonStr).digest('hex').substring(0, 16);
}

/**
 * Run N simulations and collect statistics
 * Per FR-M1: Distributions of races, tiers, stats, power counts, scenarios
 * Per FR-M1: Outcome rates by harm class and fight outcome
 * Per FR-M1: Characters with insufficient scenario options per band
 * Per FR-M4: Compute percentiles for rarity
 * 
 * @param {number} n - Number of runs
 * @param {any} data - Game data
 * @returns {any} Statistics object
 */
function runSimulation(n, data) {
  const stats = {
    total: n,
    errors: 0,
    races: {},
    tiers: {},
    bands: {},
    powerCounts: {},
    scenarios: {},
    logProbabilities: [],
    // M1a additions
    harmClasses: {
      neither: 0,
      one_sided: 0,
      both: 0
    },
    fightOutcomes: {
      win: 0,
      lose: 0,
      flee: 0,
      standoff: 0
    },
    insufficientOptions: []
  };
  
  console.log(`Running ${n} simulations...`);
  
  for (let i = 0; i < n; i++) {
    if (i % 10000 === 0 && i > 0) {
      console.log(`  ${i}/${n} complete (${stats.errors} errors)`);
    }
    
    try {
      const seed = `sim_${i}`;
      const result = generateRun(data, seed);
      
      // Collect race distribution
      const race = result.character.race;
      stats.races[race] = (stats.races[race] || 0) + 1;
      
      // Collect tier distribution
      const tier = 10 - Math.floor(result.character.strength);
      stats.tiers[tier] = (stats.tiers[tier] || 0) + 1;
      
      // Collect band distribution (M1a)
      const band = result.band;
      stats.bands[band] = (stats.bands[band] || 0) + 1;
      
      // Collect power count distribution
      const pc = result.character.powerCount;
      stats.powerCounts[pc] = (stats.powerCounts[pc] || 0) + 1;
      
      // Collect scenario distribution (M1a)
      for (const scenario of result.scenarios) {
        const scenarioId = scenario.scenarioId;
        stats.scenarios[scenarioId] = (stats.scenarios[scenarioId] || 0) + 1;
        
        // Analyze scenario trace for harm class and outcomes
        for (const traceEntry of scenario.trace) {
          if (traceEntry.stepType === 'contest') {
            // Determine harm class from trace
            // We need to infer this from the fight resolution
            // For now, we'll categorize based on outcome patterns
            // This is a simplification - real implementation would track canHarm
            analyzeContestOutcome(traceEntry, stats);
          }
        }
      }
      
      // Check scenario options (M1a, FR-X3)
      const optionsCheck = checkScenarioOptions(result.character, data);
      if (!optionsCheck.hasEnoughOptions) {
        stats.insufficientOptions.push({
          band: optionsCheck.band,
          effStr: optionsCheck.effStr,
          optionCount: optionsCheck.optionCount,
          race: result.character.race,
          trait: result.character.trait
        });
      }
      
      // Collect log probabilities for percentiles
      stats.logProbabilities.push(result.logProbability);
      
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 10) {
        console.error(`Error in run ${i}:`, err.message);
      }
    }
  }
  
  console.log(`Simulation complete: ${n} runs, ${stats.errors} errors`);
  
  return stats;
}

/**
 * Analyze a contest outcome to categorize harm class and outcome
 * Per FR-M1: Track harm class (neither/one-sided/both) and outcomes
 * 
 * @param {any} traceEntry - Contest trace entry
 * @param {any} stats - Stats object to update
 */
function analyzeContestOutcome(traceEntry, stats) {
  const outcome = traceEntry.outcome;
  
  // Track fight outcome
  if (outcome === 'win' || outcome === 'lose' || outcome === 'flee' || outcome === 'standoff') {
    stats.fightOutcomes[outcome]++;
  }
  
  // Infer harm class from outcome and probability
  // This is approximate - ideal would be to track canHarm flags
  // Standoff with flee outcome suggests neither can harm
  // Flee outcome suggests one-sided
  // Win/lose with high prob suggests one-sided or large advantage
  // Win/lose with balanced prob suggests both can harm
  
  const prob = traceEntry.prob || 0.5;
  
  if (outcome === 'standoff') {
    stats.harmClasses.neither++;
  } else if (outcome === 'flee') {
    // Flee can be neither (stalemate) or one-sided
    // If prob is 1.0, it's deterministic flee (one-sided or stalemate)
    if (prob >= 0.99) {
      stats.harmClasses.one_sided++;
    } else {
      stats.harmClasses.neither++;
    }
  } else if (outcome === 'win' || outcome === 'lose') {
    // High probability suggests one-sided (rout)
    if (prob >= 0.99 || prob <= 0.01) {
      stats.harmClasses.one_sided++;
    } else {
      stats.harmClasses.both++;
    }
  }
}

/**
 * Compute percentiles from log probabilities
 * Per FR-M4: About 1,000 quantile points
 * 
 * @param {number[]} logProbs - Array of log probabilities
 * @returns {any} Percentiles object
 */
function computePercentiles(logProbs, dataHash) {
  // Sort log probabilities (lower = rarer)
  const sorted = [...logProbs].sort((a, b) => a - b);
  
  // Compute about 1000 quantile points
  const quantiles = [];
  const n = sorted.length;
  const step = Math.max(1, Math.floor(n / 1000));
  
  for (let i = 0; i < n; i += step) {
    quantiles.push({
      percentile: (i / n) * 100,
      logProb: sorted[i]
    });
  }
  
  // Always include the extremes
  if (quantiles[0].percentile > 0) {
    quantiles.unshift({ percentile: 0, logProb: sorted[0] });
  }
  if (quantiles[quantiles.length - 1].percentile < 100) {
    quantiles.push({ percentile: 100, logProb: sorted[n - 1] });
  }
  
  return {
    dataHash,
    quantiles,
    count: n
  };
}

/**
 * Write percentiles to file
 * Per section 17: percentiles.json is a generated file
 * 
 * @param {any} percentiles - Percentiles object
 */
function writePercentiles(percentiles) {
  const percentilesPath = join(projectRoot, 'data', 'percentiles.json');
  writeFileSync(percentilesPath, JSON.stringify(percentiles, null, 2), 'utf8');
  console.log(`Wrote percentiles to ${percentilesPath}`);
}

/**
 * Print statistics report
 */
function printStats(stats) {
  console.log('\n=== SIMULATION STATISTICS ===\n');
  
  console.log('Race Distribution:');
  for (const [race, count] of Object.entries(stats.races)) {
    const pct = ((count / stats.total) * 100).toFixed(2);
    console.log(`  ${race}: ${count} (${pct}%)`);
  }
  
  console.log('\nTier Distribution:');
  for (let tier = 0; tier <= 10; tier++) {
    const count = stats.tiers[tier] || 0;
    const pct = ((count / stats.total) * 100).toFixed(2);
    console.log(`  Tier ${tier}: ${count} (${pct}%)`);
  }
  
  console.log('\nBand Distribution:');
  for (const [band, count] of Object.entries(stats.bands)) {
    const pct = ((count / stats.total) * 100).toFixed(2);
    console.log(`  ${band}: ${count} (${pct}%)`);
  }
  
  console.log('\nPower Count Distribution:');
  for (const [pc, count] of Object.entries(stats.powerCounts).sort((a, b) => 
    parseInt(a[0]) - parseInt(b[0])
  )) {
    const pct = ((count / stats.total) * 100).toFixed(2);
    console.log(`  ${pc} powers: ${count} (${pct}%)`);
  }
  
  console.log('\nScenario Selection (top 10):');
  const sortedScenarios = Object.entries(stats.scenarios)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [scenarioId, count] of sortedScenarios) {
    const pct = ((count / stats.total) * 100).toFixed(2);
    console.log(`  ${scenarioId}: ${count} (${pct}%)`);
  }
  
  // M1a: Harm class breakdown (FR-M1)
  console.log('\nHarm Class Distribution (FR-M1):');
  const totalContests = stats.harmClasses.neither + stats.harmClasses.one_sided + stats.harmClasses.both;
  if (totalContests > 0) {
    const neitherPct = ((stats.harmClasses.neither / totalContests) * 100).toFixed(2);
    const oneSidedPct = ((stats.harmClasses.one_sided / totalContests) * 100).toFixed(2);
    const bothPct = ((stats.harmClasses.both / totalContests) * 100).toFixed(2);
    console.log(`  Neither can harm: ${stats.harmClasses.neither} (${neitherPct}%)`);
    console.log(`  One-sided: ${stats.harmClasses.one_sided} (${oneSidedPct}%)`);
    console.log(`  Both can harm: ${stats.harmClasses.both} (${bothPct}%)`);
  }
  
  // M1a: Fight outcome breakdown (FR-M1)
  console.log('\nFight Outcome Distribution (FR-M1):');
  const totalOutcomes = stats.fightOutcomes.win + stats.fightOutcomes.lose + 
                        stats.fightOutcomes.flee + stats.fightOutcomes.standoff;
  if (totalOutcomes > 0) {
    const winPct = ((stats.fightOutcomes.win / totalOutcomes) * 100).toFixed(2);
    const losePct = ((stats.fightOutcomes.lose / totalOutcomes) * 100).toFixed(2);
    const fleePct = ((stats.fightOutcomes.flee / totalOutcomes) * 100).toFixed(2);
    const standoffPct = ((stats.fightOutcomes.standoff / totalOutcomes) * 100).toFixed(2);
    console.log(`  Win: ${stats.fightOutcomes.win} (${winPct}%)`);
    console.log(`  Lose: ${stats.fightOutcomes.lose} (${losePct}%)`);
    console.log(`  Flee: ${stats.fightOutcomes.flee} (${fleePct}%)`);
    console.log(`  Standoff: ${stats.fightOutcomes.standoff} (${standoffPct}%)`);
  }
  
  // M1a: Per-band options report (FR-M1, FR-X3)
  console.log('\nInsufficient Scenario Options (FR-X3):');
  if (stats.insufficientOptions.length === 0) {
    console.log('  None - all characters have at least 2 non-do_nothing options');
  } else {
    // Group by band
    const byBand = {};
    for (const char of stats.insufficientOptions) {
      if (!byBand[char.band]) {
        byBand[char.band] = [];
      }
      byBand[char.band].push(char);
    }
    
    for (const [band, chars] of Object.entries(byBand)) {
      console.log(`  Band ${band}: ${chars.length} characters`);
      // Show a few examples
      for (let i = 0; i < Math.min(5, chars.length); i++) {
        const c = chars[i];
        console.log(`    - effStr ${c.effStr.toFixed(2)}, ${c.race}/${c.trait}, ${c.optionCount} options`);
      }
      if (chars.length > 5) {
        console.log(`    ... and ${chars.length - 5} more`);
      }
    }
  }
  
  console.log('');
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);
  const n = args[0] ? parseInt(args[0], 10) : 100000;
  
  console.log('Loading data...');
  const data = loadData();
  
  console.log('Validating data...');
  const validationResult = validate(data);
  if (!validationResult.valid) {
    console.error('Validation failed:');
    for (const error of validationResult.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }
  if (validationResult.warnings.length > 0) {
    console.warn('Validation warnings:');
    for (const warning of validationResult.warnings) {
      console.warn(`  - ${warning}`);
    }
  }
  console.log('Validation passed.');
  
  // Run simulation
  const stats = runSimulation(n, data);
  
  // Print statistics
  printStats(stats);
  
  // Compute and write percentiles
  if (stats.logProbabilities.length > 0) {
    const dataHash = computeDataHash(data);
    const percentiles = computePercentiles(stats.logProbabilities, dataHash);
    writePercentiles(percentiles);
  }
  
  // Exit with error if any runs failed
  if (stats.errors > 0) {
    console.error(`\n${stats.errors} runs failed`);
    process.exit(1);
  }
}

main();
