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
    harmClassesByBand: {},
    fightOutcomes: {
      win: 0,
      lose: 0,
      flee: 0,
      standoff: 0
    },
    fightOutcomesByBand: {},
    insufficientOptions: [],
    // Check success rates
    checksByScenario: {},
    checksByBand: {},
    // Repeat statistics
    tripleRepeats: 0,
    anyRepeats: 0
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
      const scenarioIds = [];
      for (const scenario of result.scenarios) {
        const scenarioId = scenario.scenarioId;
        scenarioIds.push(scenarioId);
        stats.scenarios[scenarioId] = (stats.scenarios[scenarioId] || 0) + 1;
        
        // Analyze scenario trace for harm class, outcomes, and checks
        for (const traceEntry of scenario.trace) {
          if (traceEntry.stepType === 'contest' && traceEntry.mode === 'fight') {
            // Track fight outcomes and harm classes from contest metadata
            analyzeContestOutcome(traceEntry, stats, band, data);
          }
          
          if (traceEntry.stepType === 'check') {
            // Track check success rates
            if (!stats.checksByScenario[scenarioId]) {
              stats.checksByScenario[scenarioId] = { total: 0, success: 0 };
            }
            stats.checksByScenario[scenarioId].total++;
            if (traceEntry.outcome === 'success') {
              stats.checksByScenario[scenarioId].success++;
            }
            
            if (!stats.checksByBand[band]) {
              stats.checksByBand[band] = { total: 0, success: 0 };
            }
            stats.checksByBand[band].total++;
            if (traceEntry.outcome === 'success') {
              stats.checksByBand[band].success++;
            }
          }
        }
      }
      
      // Check for repeats
      const uniqueScenarios = new Set(scenarioIds);
      if (uniqueScenarios.size === 1) {
        stats.tripleRepeats++;
      }
      if (uniqueScenarios.size < scenarioIds.length) {
        stats.anyRepeats++;
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
 * Reads authoritative harmClass from meta.harmClass and outcome from pickedId
 * 
 * @param {any} traceEntry - Contest trace entry
 * @param {any} stats - Stats object to update
 * @param {string} band - Character band
 * @param {any} data - Game data (for config)
 */
function analyzeContestOutcome(traceEntry, stats, band, data) {
  const outcome = traceEntry.pickedId;
  
  // Track fight outcome
  if (outcome && Object.hasOwn(stats.fightOutcomes, outcome)) {
    stats.fightOutcomes[outcome] = (stats.fightOutcomes[outcome] || 0) + 1;
    
    // Track by band
    if (!stats.fightOutcomesByBand[band]) {
      stats.fightOutcomesByBand[band] = { win: 0, lose: 0, flee: 0, standoff: 0 };
    }
    stats.fightOutcomesByBand[band][outcome]++;
  }
  
  // Read harm class directly from metadata
  const harmClass = traceEntry.meta?.harmClass;
  if (harmClass && Object.hasOwn(stats.harmClasses, harmClass.replace('-', '_'))) {
    stats.harmClasses[harmClass.replace('-', '_')]++;
    
    // Track by band
    if (!stats.harmClassesByBand[band]) {
      stats.harmClassesByBand[band] = { neither: 0, one_sided: 0, both: 0 };
    }
    stats.harmClassesByBand[band][harmClass.replace('-', '_')]++;
    
    // Track one-sided-against-char with speedGap > 1.5
    // Need to infer direction from strength vs durability with harmMargin
    if (harmClass === 'one-sided') {
      const charEffStr = traceEntry.charEffStr;
      const oppEffStr = traceEntry.oppEffStr;
      const charDur = traceEntry.charDur;
      const oppDur = traceEntry.oppDur;
      const charSpd = traceEntry.charSpd;
      const oppSpd = traceEntry.oppSpd;
      const harmMargin = data.config.harmMargin;
      
      // Approximate canHarm without tags (conservative estimate)
      const charCanHarmOpp = charEffStr >= oppDur - harmMargin;
      const oppCanHarmChar = oppEffStr >= charDur - harmMargin;
      
      // Character is harmed side if opp can harm but char cannot
      if (oppCanHarmChar && !charCanHarmOpp && charSpd !== undefined && oppSpd !== undefined) {
        const speedGap = charSpd - oppSpd;
        if (!stats.oneSidedAgainstCharSpeedGap) {
          stats.oneSidedAgainstCharSpeedGap = {};
        }
        if (!stats.oneSidedAgainstCharSpeedGap[band]) {
          stats.oneSidedAgainstCharSpeedGap[band] = { total: 0, speedGapOver1_5: 0, outcomes: {} };
        }
        stats.oneSidedAgainstCharSpeedGap[band].total++;
        if (speedGap > 1.5) {
          stats.oneSidedAgainstCharSpeedGap[band].speedGapOver1_5++;
          if (!stats.oneSidedAgainstCharSpeedGap[band].outcomes[outcome]) {
            stats.oneSidedAgainstCharSpeedGap[band].outcomes[outcome] = 0;
          }
          stats.oneSidedAgainstCharSpeedGap[band].outcomes[outcome]++;
        }
      }
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
  
  // Repeat statistics
  console.log('\nRepeat Statistics:');
  const tripleRepeatPct = ((stats.tripleRepeats / stats.total) * 100).toFixed(2);
  const anyRepeatPct = ((stats.anyRepeats / stats.total) * 100).toFixed(2);
  console.log(`  Triple repeats (all 3 identical): ${stats.tripleRepeats} (${tripleRepeatPct}%)`);
  console.log(`  Any repeat (at least 2 identical): ${stats.anyRepeats} (${anyRepeatPct}%)`);
  console.log(`  All unique: ${stats.total - stats.anyRepeats} (${((stats.total - stats.anyRepeats) / stats.total * 100).toFixed(2)}%)`);
  
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
    
    console.log('\n  By Band:');
    for (const [band, hc] of Object.entries(stats.harmClassesByBand).sort()) {
      const bandTotal = hc.neither + hc.one_sided + hc.both;
      const nPct = ((hc.neither / bandTotal) * 100).toFixed(1);
      const oPct = ((hc.one_sided / bandTotal) * 100).toFixed(1);
      const bPct = ((hc.both / bandTotal) * 100).toFixed(1);
      console.log(`    ${band}: Neither ${nPct}%, One-sided ${oPct}%, Both ${bPct}% (n=${bandTotal})`);
    }
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
    
    console.log('\n  By Band:');
    for (const [band, fo] of Object.entries(stats.fightOutcomesByBand).sort()) {
      const bandTotal = fo.win + fo.lose + fo.flee + fo.standoff;
      const wPct = ((fo.win / bandTotal) * 100).toFixed(1);
      const lPct = ((fo.lose / bandTotal) * 100).toFixed(1);
      const fPct = ((fo.flee / bandTotal) * 100).toFixed(1);
      const sPct = ((fo.standoff / bandTotal) * 100).toFixed(1);
      console.log(`    ${band}: Win ${wPct}%, Lose ${lPct}%, Flee ${fPct}%, Standoff ${sPct}% (n=${bandTotal})`);
    }
  }
  
  // One-sided against character speed gap analysis
  if (stats.oneSidedAgainstCharSpeedGap) {
    console.log('\nOne-Sided Against Character (speedGap > 1.5):');
    for (const [band, data] of Object.entries(stats.oneSidedAgainstCharSpeedGap).sort()) {
      console.log(`  ${band}: ${data.speedGapOver1_5} / ${data.total} fights (${((data.speedGapOver1_5 / data.total) * 100).toFixed(2)}%)`);
      if (data.speedGapOver1_5 > 0) {
        const outcomeStr = Object.entries(data.outcomes)
          .map(([outcome, count]) => `${outcome}=${count}`)
          .join(', ');
        console.log(`    Outcomes: ${outcomeStr}`);
      }
    }
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
  
  // Check success rates
  console.log('\nCheck Success Rates:');
  console.log('  By Scenario:');
  const scenarioEntries = Object.entries(stats.checksByScenario).sort((a, b) => b[1].total - a[1].total);
  for (const [scenarioId, checkStats] of scenarioEntries) {
    const successRate = (checkStats.success / checkStats.total) * 100;
    console.log(`    ${scenarioId}: ${checkStats.total} checks, ${successRate.toFixed(1)}% success`);
  }
  
  console.log('  By Band:');
  const bandOrder = ['10-9', '8-7', '6-4', '3-2', '1-0'];
  for (const band of bandOrder) {
    const checkStats = stats.checksByBand[band];
    if (checkStats) {
      const successRate = (checkStats.success / checkStats.total) * 100;
      console.log(`    ${band}: ${checkStats.total} checks, ${successRate.toFixed(1)}% success`);
    }
  }
  
  console.log('');
}

/**
 * Run N prose runs with deterministic seeds and print formatted output
 * Spec section 13: --prose N prints N human-readable runs
 *
 * @param {number} n - Number of runs to print
 */
function runProseMode(n) {
  console.log('Loading data...');
  const data = loadData();
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

  const percentiles = loadPercentiles();

  console.log(`Running ${n} prose simulations...\n`);
  for (let i = 0; i < n; i++) {
    const seed = `prose_${i}`;
    const result = generateRun(data, seed);
    printProseRun(result, data, percentiles, seed);
  }
}

/**
 * Load percentiles.json if present
 *
 * @returns {any|null} Percentiles object or null
 */
function loadPercentiles() {
  try {
    return JSON.parse(readFileSync(join(projectRoot, 'data', 'percentiles.json'), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Compute percentile rank of a log-probability from percentiles data
 * Lower logProb = rarer = lower percentile
 *
 * @param {number} logProb - Run log-probability
 * @param {any} percentiles - Percentiles object
 * @returns {number|null} Percentile (0-100) or null
 */
function computePercentile(logProb, percentiles) {
  if (!percentiles || !percentiles.quantiles || percentiles.quantiles.length === 0) {
    return null;
  }
  let count = 0;
  for (const q of percentiles.quantiles) {
    if (q.logProb >= logProb) count++;
  }
  return (count / percentiles.quantiles.length) * 100;
}

/**
 * Find opponent name for a scenario outcome from its trace
 *
 * @param {any} scenarioOutcome - Scenario outcome from chain
 * @param {any} data - Game data
 * @returns {string|null} Opponent name or null
 */
function findOpponentName(scenarioOutcome, data) {
  const trace = scenarioOutcome.trace || [];
  for (let i = trace.length - 1; i >= 0; i--) {
    const entry = trace[i];
    if (entry.stepType === 'pick' && entry.pickedId) {
      const pool = data.pools[entry.pool];
      const entity = pool && pool.find(e => e.id === entry.pickedId);
      if (entity) return entity.name;
    }
    if (entry.stepType === 'contest' && entry.opponent) {
      for (const pool of Object.values(data.pools)) {
        const entity = pool.find(e => e.id === entry.opponent);
        if (entity) return entity.name;
      }
    }
  }
  return null;
}

/**
 * Map final step ID to readable outcome name
 *
 * @param {string} stepId - Final step ID
 * @returns {string} Readable outcome
 */
function outcomeLabel(stepId) {
  const labels = { won: 'win', lost: 'lose', fled: 'flee', stand: 'standoff' };
  return labels[stepId] || stepId;
}

/**
 * Print a single prose run
 *
 * @param {any} result - Run result from generateRun
 * @param {any} data - Game data
 * @param {any} percentiles - Percentiles object or null
 * @param {string} seed - Master seed for this run
 */
function printProseRun(result, data, percentiles, seed) {
  const char = result.character;
  const race = data.races[char.race] || {};
  const archetype = data.archetypes[char.archetype] || {};
  const trait = data.traits[char.trait] || {};
  const powers = (char.powers || []).map(id => (data.powers[id] || {}).name || id).join(', ');
  const weapon = char.weapon
    ? `${(data.weapons.types[char.weapon.type] || {}).name || char.weapon.type} + ${(data.weapons.enchantments[char.weapon.enchantment] || {}).name || char.weapon.enchantment}`
    : 'none';
  const tier = 10 - Math.floor(char.strength);
  const percentile = computePercentile(result.logProbability, percentiles);

  console.log(`=== Run (seed: ${seed}, band: ${result.band}) ===`);
  console.log(`Race: ${race.name || char.race} | Archetype: ${archetype.name || char.archetype} | Trait: ${trait.name || char.trait}`);
  console.log(`Powers: ${powers || 'none'}`);
  console.log(`Weapon: ${weapon}`);
  console.log(`Strength tier: ${tier} | Rarity: ${percentile === null ? 'N/A' : `Rarer than ${percentile.toFixed(1)}% of runs`}`);
  console.log('');

  for (let i = 0; i < result.scenarios.length; i++) {
    const sc = result.scenarios[i];
    const scenario = data.scenarios[sc.scenarioId] || {};
    const opponentName = findOpponentName(sc, data);

    console.log(`  ${i + 1}. ${scenario.name || sc.scenarioId}${opponentName ? ` vs ${opponentName}` : ''}`);
    console.log(`     Outcome: ${outcomeLabel(sc.finalStep)}`);
    console.log(`     "${sc.text}"`);
    if (sc.emittedTags && sc.emittedTags.length > 0) {
      console.log(`     Carried: ${sc.emittedTags.join(', ')}`);
    }
  }
  console.log('');
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--prose') {
    const n = args[1] ? parseInt(args[1], 10) : 3;
    runProseMode(n);
    return;
  }
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
