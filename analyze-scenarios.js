// @ts-check
/**
 * Read-only diagnostic: scenario selection probabilities and carried-tag persistence
 * Analyzes eligibility, weightMods application, and tag flow through scenario chains
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { checkScenarioRequires, applyScenarioWeightMods } from './src/core/scenario.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load game data
 */
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

/**
 * Create sample characters for analysis
 */
function createSampleCharacters(data) {
  const samples = [];
  
  // For each race
  for (const [raceId, race] of Object.entries(data.races)) {
    // For each trait
    for (const traitId of Object.keys(data.traits)) {
      // Sample character with no carried tags
      samples.push({
        race: raceId,
        trait: traitId,
        tags: race.tags || [],
        carried: [],
        description: `${raceId} ${traitId} (no carried)`
      });
      
      // Sample with common carried tags
      const commonCarried = ['rival', 'wounded'];
      for (const carriedTag of commonCarried) {
        if (data.tags[carriedTag]) {
          samples.push({
            race: raceId,
            trait: traitId,
            tags: race.tags || [],
            carried: [carriedTag],
            description: `${raceId} ${traitId} (carrying ${carriedTag})`
          });
        }
      }
    }
  }
  
  return samples;
}

/**
 * Analyze scenario eligibility and weights for a character
 */
function analyzeScenarioSelection(data, character, band) {
  const results = [];
  
  for (const [scenarioId, scenario] of Object.entries(data.scenarios)) {
    // Skip if not in band
    if (!scenario.bands || !scenario.bands.includes(band)) {
      continue;
    }
    
    // Check requirements
    const eligible = checkScenarioRequires(scenario, character.tags, character.carried);
    
    if (!eligible) {
      results.push({
        id: scenarioId,
        eligible: false,
        baseWeight: scenario.weight,
        finalWeight: 0,
        modifiers: []
      });
      continue;
    }
    
    // Apply weight mods
    const weightMods = scenario.weightMods || [];
    const modifiers = [];
    let finalWeight = scenario.weight;
    
    for (const mod of weightMods) {
      if (mod.if) {
        const [condType, condValue] = mod.if.split(':');
        
        let matches = false;
        let reason = '';
        
        if (condType === 'trait' && character.trait === condValue) {
          matches = true;
          reason = `trait=${condValue}`;
        } else if (condType === 'tag' && character.tags.includes(condValue)) {
          matches = true;
          reason = `tag=${condValue}`;
        } else if (condType === 'carried' && character.carried.includes(condValue)) {
          matches = true;
          reason = `carried=${condValue}`;
        } else if (condType === 'race' && character.race === condValue) {
          matches = true;
          reason = `race=${condValue}`;
        }
        
        if (matches) {
          modifiers.push({ condition: mod.if, mult: mod.mult, reason });
          finalWeight *= mod.mult;
        }
      }
    }
    
    results.push({
      id: scenarioId,
      eligible: true,
      baseWeight: scenario.weight,
      finalWeight,
      modifiers
    });
  }
  
  // Calculate probabilities
  const totalWeight = results
    .filter(r => r.eligible)
    .reduce((sum, r) => sum + r.finalWeight, 0);
  
  for (const result of results) {
    if (result.eligible && totalWeight > 0) {
      result.probability = result.finalWeight / totalWeight;
    } else {
      result.probability = 0;
    }
  }
  
  return results;
}

/**
 * Analyze carried tag flow through scenarios
 */
function analyzeCarriedTagFlow(data) {
  const tagFlow = {};
  
  // For each scenario, track what tags it emits and consumes
  for (const [scenarioId, scenario] of Object.entries(data.scenarios)) {
    const emitted = new Set();
    const consumed = new Set();
    
    // Check requirements (tags that must be carried to be eligible)
    if (scenario.requires && scenario.requires.carried) {
      for (const tag of scenario.requires.carried) {
        consumed.add(tag);
      }
    }
    
    // Check weightMods for carried conditions
    if (scenario.weightMods) {
      for (const mod of scenario.weightMods) {
        if (mod.if && mod.if.startsWith('carried:')) {
          const tagId = mod.if.split(':')[1];
          consumed.add(tagId);
        }
      }
    }
    
    // Walk the scenario graph to find emitted tags
    if (scenario.steps) {
      const visited = new Set();
      const queue = [scenario.start];
      
      while (queue.length > 0) {
        const stepId = queue.shift();
        if (visited.has(stepId)) continue;
        visited.add(stepId);
        
        const step = scenario.steps[stepId];
        if (!step) continue;
        
        // Collect emitted tags
        if (step.emits) {
          for (const tag of step.emits) {
            emitted.add(tag);
          }
        }
        
        // Add next steps to queue
        if (step.next) {
          if (typeof step.next === 'string') {
            queue.push(step.next);
          } else {
            for (const nextStep of Object.values(step.next)) {
              if (typeof nextStep === 'string') {
                queue.push(nextStep);
              }
            }
          }
        }
      }
    }
    
    tagFlow[scenarioId] = {
      emits: Array.from(emitted).sort(),
      consumes: Array.from(consumed).sort(),
      bands: scenario.bands || []
    };
  }
  
  return tagFlow;
}

/**
 * Main analysis
 */
function main() {
  const data = loadData();
  const bands = Object.keys(data.config.bands);
  
  const lines = [];
  lines.push('# SCENARIO SELECTION & CARRIED-TAG DIAGNOSTIC\n');
  lines.push('Generated: ' + new Date().toISOString());
  lines.push('\n---\n');
  
  // Part 1: Carried Tag Flow Analysis
  lines.push('## Part 1: Carried Tag Flow\n');
  lines.push('Tracks which scenarios emit and consume carried tags.\n');
  
  const tagFlow = analyzeCarriedTagFlow(data);
  
  // Group by band
  for (const band of bands) {
    lines.push(`\n### Band: ${band}\n`);
    
    const scenariosInBand = Object.entries(tagFlow)
      .filter(([_, flow]) => flow.bands.includes(band))
      .sort(([a], [b]) => a.localeCompare(b));
    
    for (const [scenarioId, flow] of scenariosInBand) {
      lines.push(`**${scenarioId}**`);
      if (flow.emits.length > 0) {
        lines.push(`  - Emits: ${flow.emits.join(', ')}`);
      }
      if (flow.consumes.length > 0) {
        lines.push(`  - Consumes: ${flow.consumes.join(', ')}`);
      }
      if (flow.emits.length === 0 && flow.consumes.length === 0) {
        lines.push(`  - No carried tag interaction`);
      }
      lines.push('');
    }
  }
  
  // Part 2: Tag Persistence Analysis
  lines.push('\n---\n');
  lines.push('## Part 2: Tag Persistence Chains\n');
  lines.push('Identifies which scenarios can maintain carried tags across the 3-scenario chain.\n');
  
  // Find tags that can persist
  const allCarriedTags = new Set();
  for (const flow of Object.values(tagFlow)) {
    flow.emits.forEach(tag => allCarriedTags.add(tag));
    flow.consumes.forEach(tag => allCarriedTags.add(tag));
  }
  
  for (const tag of Array.from(allCarriedTags).sort()) {
    const emitters = Object.entries(tagFlow)
      .filter(([_, flow]) => flow.emits.includes(tag))
      .map(([id]) => id);
    
    const consumers = Object.entries(tagFlow)
      .filter(([_, flow]) => flow.consumes.includes(tag))
      .map(([id]) => id);
    
    lines.push(`\n### Tag: ${tag}\n`);
    lines.push(`- Emitted by (${emitters.length}): ${emitters.join(', ') || 'none'}`);
    lines.push(`- Consumed by (${consumers.length}): ${consumers.join(', ') || 'none'}`);
    
    if (emitters.length > 0 && consumers.length > 0) {
      lines.push(`- **Can persist**: A chain containing an emitter followed by a consumer is possible`);
    } else if (emitters.length > 0 && consumers.length === 0) {
      lines.push(`- **Dead-end tag**: Emitted but never consumed`);
    } else if (emitters.length === 0 && consumers.length > 0) {
      lines.push(`- **Invalid**: Consumed but never emitted (validation should catch this)`);
    }
  }
  
  // Part 3: WeightMods Impact Analysis
  lines.push('\n---\n');
  lines.push('## Part 3: WeightMods Impact Analysis\n');
  lines.push('Shows how weightMods affect scenario selection probabilities.\n');
  
  // Collect all weightMods
  const weightModsByType = {
    trait: new Map(),
    tag: new Map(),
    carried: new Map(),
    race: new Map()
  };
  
  for (const [scenarioId, scenario] of Object.entries(data.scenarios)) {
    if (!scenario.weightMods) continue;
    
    for (const mod of scenario.weightMods) {
      if (!mod.if) continue;
      
      const [condType, condValue] = mod.if.split(':');
      if (!weightModsByType[condType]) continue;
      
      if (!weightModsByType[condType].has(condValue)) {
        weightModsByType[condType].set(condValue, []);
      }
      
      weightModsByType[condType].get(condValue).push({
        scenario: scenarioId,
        mult: mod.mult,
        bands: scenario.bands || []
      });
    }
  }
  
  for (const [condType, modMap] of Object.entries(weightModsByType)) {
    if (modMap.size === 0) continue;
    
    lines.push(`\n### Condition Type: ${condType}\n`);
    
    for (const [condValue, mods] of Array.from(modMap.entries()).sort()) {
      lines.push(`**${condValue}**`);
      for (const mod of mods) {
        const bandsStr = mod.bands.join(', ');
        const effect = mod.mult > 1 ? 'increases' : mod.mult < 1 ? 'decreases' : 'maintains';
        lines.push(`  - ${mod.scenario} (${bandsStr}): ${effect} weight by ${mod.mult}x`);
      }
      lines.push('');
    }
  }
  
  // Part 4: Sample Character Analysis
  lines.push('\n---\n');
  lines.push('## Part 4: Sample Character Probabilities\n');
  lines.push('Selection probabilities for representative characters in each band.\n');
  
  // Pick a few representative samples
  const representatives = [
    { race: 'human', trait: 'ambitious', tags: [], carried: [], description: 'Human Ambitious (baseline)' },
    { race: 'human', trait: 'ambitious', tags: [], carried: ['rival'], description: 'Human Ambitious with rival' },
    { race: 'human', trait: 'cowardly', tags: [], carried: [], description: 'Human Cowardly (baseline)' },
    { race: 'elf', trait: 'ambitious', tags: ['fey'], carried: [], description: 'Elf Ambitious (fey tag)' }
  ];
  
  for (const band of bands) {
    lines.push(`\n### Band: ${band}\n`);
    
    for (const char of representatives) {
      lines.push(`**${char.description}**\n`);
      
      const results = analyzeScenarioSelection(data, char, band);
      const eligible = results.filter(r => r.eligible);
      
      if (eligible.length === 0) {
        lines.push('  - No eligible scenarios\n');
        continue;
      }
      
      // Sort by probability descending
      eligible.sort((a, b) => b.probability - a.probability);
      
      lines.push('  | Scenario | Base Weight | Final Weight | Probability | Modifiers |');
      lines.push('  |----------|-------------|--------------|-------------|-----------|');
      
      for (const result of eligible) {
        const probPct = (result.probability * 100).toFixed(2);
        const modStr = result.modifiers.length > 0
          ? result.modifiers.map(m => `${m.condition}:${m.mult}x`).join(', ')
          : 'none';
        
        lines.push(`  | ${result.id} | ${result.baseWeight} | ${result.finalWeight.toFixed(2)} | ${probPct}% | ${modStr} |`);
      }
      lines.push('');
    }
  }
  
  lines.push('\n---\n');
  lines.push('## Summary\n');
  lines.push(`- Total scenarios: ${Object.keys(data.scenarios).length}`);
  lines.push(`- Scenarios with weightMods: ${Object.values(data.scenarios).filter(s => s.weightMods && s.weightMods.length > 0).length}`);
  lines.push(`- Carried tags in use: ${allCarriedTags.size}`);
  lines.push(`- Bands analyzed: ${bands.join(', ')}`);
  
  return lines.join('\n');
}

// Write output to file
import { writeFileSync } from 'fs';
const output = main();
writeFileSync('SCENARIO-SELECTION-DIAGNOSTIC.md', output, 'utf8');
console.log('Report generated: SCENARIO-SELECTION-DIAGNOSTIC.md');
