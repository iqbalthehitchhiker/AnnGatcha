// @ts-check
/**
 * Final read-only diagnostic
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateRun } from './src/core/run.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadData() {
  const dataDir = join(__dirname, 'data');
  
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
    scenarios: JSON.parse(readFileSync(join(dataDir, 'scenarios', 'basic.json'), 'utf8'))
  };
  
  return data;
}

const data = loadData();
const n = 100000;

console.log('Running diagnostic on 100,000 characters...\n');

const stats = {
  byBand: {},
  tierVsBand: {},
  weaponLevelsInBand1_0: [],
  scenarioCounts: {},
  scenarioSlots: 0
};

// Initialize bands
const bands = Object.keys(data.config.bands);
for (const band of bands) {
  stats.byBand[band] = {
    harmClasses: { neither: 0, one_sided: 0, both: 0 },
    fightOutcomes: { win: 0, lose: 0, flee: 0, standoff: 0 },
    characters: 0
  };
}

for (let i = 0; i < n; i++) {
  const result = generateRun(data, `diag_${i}`);
  const band = result.band;
  const tier = 10 - Math.floor(result.character.strength);
  
  // Band stats
  if (stats.byBand[band]) {
    stats.byBand[band].characters++;
    
    // Analyze contests in this character's scenarios
    for (const scenario of result.scenarios) {
      for (const traceEntry of scenario.trace) {
        if (traceEntry.stepType === 'contest' && traceEntry.mode === 'fight') {
          const outcome = traceEntry.pickedId;
          const harmClass = traceEntry.meta?.harmClass;
          
          if (outcome && stats.byBand[band].fightOutcomes.hasOwnProperty(outcome)) {
            stats.byBand[band].fightOutcomes[outcome]++;
          }
          
          if (harmClass) {
            const key = harmClass.replace('-', '_');
            if (stats.byBand[band].harmClasses.hasOwnProperty(key)) {
              stats.byBand[band].harmClasses[key]++;
            }
          }
        }
      }
    }
  }
  
  // Tier vs Band crosstab
  const key = `tier${tier}_band${band}`;
  stats.tierVsBand[key] = (stats.tierVsBand[key] || 0) + 1;
  
  // Weapon levels in band 1-0
  if (band === '1-0' && result.character.weapon) {
    stats.weaponLevelsInBand1_0.push(result.character.weapon.level);
  }
  
  // Scenario selection (count per slot, not per character)
  for (const scenario of result.scenarios) {
    const scenarioId = scenario.scenarioId;
    stats.scenarioCounts[scenarioId] = (stats.scenarioCounts[scenarioId] || 0) + 1;
    stats.scenarioSlots++;
  }
}

// Report 1: Outcomes by band
console.log('=== 1. FIGHT OUTCOMES AND HARM CLASS BY BAND ===\n');
for (const band of bands) {
  const b = stats.byBand[band];
  console.log(`Band ${band} (${b.characters} characters):`);
  
  const totalFights = b.fightOutcomes.win + b.fightOutcomes.lose + b.fightOutcomes.flee + b.fightOutcomes.standoff;
  if (totalFights > 0) {
    console.log(`  Outcomes: Win ${b.fightOutcomes.win} (${(b.fightOutcomes.win/totalFights*100).toFixed(1)}%), ` +
                `Lose ${b.fightOutcomes.lose} (${(b.fightOutcomes.lose/totalFights*100).toFixed(1)}%), ` +
                `Flee ${b.fightOutcomes.flee} (${(b.fightOutcomes.flee/totalFights*100).toFixed(1)}%), ` +
                `Standoff ${b.fightOutcomes.standoff} (${(b.fightOutcomes.standoff/totalFights*100).toFixed(1)}%)`);
  }
  
  const totalHarm = b.harmClasses.neither + b.harmClasses.one_sided + b.harmClasses.both;
  if (totalHarm > 0) {
    console.log(`  Harm: Neither ${b.harmClasses.neither} (${(b.harmClasses.neither/totalHarm*100).toFixed(1)}%), ` +
                `One-sided ${b.harmClasses.one_sided} (${(b.harmClasses.one_sided/totalHarm*100).toFixed(1)}%), ` +
                `Both ${b.harmClasses.both} (${(b.harmClasses.both/totalHarm*100).toFixed(1)}%)`);
  }
  console.log('');
}

// Report 2: Tier vs Band crosstab
console.log('=== 2. TIER VS BAND CROSSTAB ===\n');
console.log('Tier | 10-9  | 8-7   | 6-4   | 3-2   | 1-0   |');
console.log('-----|-------|-------|-------|-------|-------|');
for (let tier = 0; tier <= 10; tier++) {
  const row = [tier.toString().padStart(2)];
  for (const band of bands) {
    const key = `tier${tier}_band${band}`;
    const count = stats.tierVsBand[key] || 0;
    const pct = ((count / n) * 100).toFixed(2);
    row.push(pct.padStart(5) + '%');
  }
  console.log(row.join(' | '));
}

console.log('\n=== WEAPON LEVELS IN BAND 1-0 ===');
if (stats.weaponLevelsInBand1_0.length > 0) {
  const levelCounts = {};
  for (const level of stats.weaponLevelsInBand1_0) {
    levelCounts[level] = (levelCounts[level] || 0) + 1;
  }
  console.log(`Total with weapons: ${stats.weaponLevelsInBand1_0.length}`);
  for (const [level, count] of Object.entries(levelCounts).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))) {
    console.log(`  Level ${level}: ${count} (${(count/stats.weaponLevelsInBand1_0.length*100).toFixed(1)}%)`);
  }
} else {
  console.log('No characters with weapons in band 1-0');
}

// Report 5: Scenario selection
console.log('\n=== 5. SCENARIO SELECTION (per slot) ===');
console.log(`Total slots: ${stats.scenarioSlots}`);
console.log(`Counting method: per slot (3 slots per character = ${n} chars × 3 = ${n*3} expected)\n`);

const sortedScenarios = Object.entries(stats.scenarioCounts).sort((a, b) => b[1] - a[1]);
console.log('Full scenario list:');
for (const [scenarioId, count] of sortedScenarios) {
  const pct = ((count / stats.scenarioSlots) * 100).toFixed(2);
  console.log(`  ${scenarioId}: ${count} (${pct}%)`);
}

// Check for never-selected scenarios
const allScenarios = Object.keys(data.scenarios);
const neverSelected = allScenarios.filter(id => !stats.scenarioCounts[id]);
if (neverSelected.length > 0) {
  console.log('\n**NEVER SELECTED:**');
  for (const id of neverSelected) {
    console.log(`  - ${id}`);
  }
}
