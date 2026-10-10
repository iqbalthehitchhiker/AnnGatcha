// @ts-check

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateRun } from '../src/core/run.js';
import { validate } from '../src/core/validate.js';
import { pick, computeTraceLogProb } from '../src/core/picker.js';
import { createRng } from '../src/core/rng.js';
import * as fc from 'fast-check';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Load game data
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
    scenarios: JSON.parse(readFileSync(join(dataDir, 'scenarios', 'basic.json'), 'utf8'))
  };
  
  return data;
}

/**
 * Load fixture data
 */
function loadFixture(name) {
  const fixturePath = join(projectRoot, 'test', 'fixtures', `${name}.json`);
  return JSON.parse(readFileSync(fixturePath, 'utf8'));
}

/**
 * Deep equality check for objects
 */
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

describe('M0 Acceptance Tests', () => {
  
  describe('Determinism', () => {
    it('should produce identical results for 1000 seeds', () => {
      const data = loadData();
      
      for (let i = 0; i < 1000; i++) {
        const seed = `test_${i}`;
        const result1 = generateRun(data, seed);
        const result2 = generateRun(data, seed);
        
        expect(deepEqual(result1, result2)).toBe(true);
      }
    });
  });
  
  describe('Stage Independence', () => {
    it('should preserve draw streams when redoing a stage', () => {
      const data = loadData();
      const masterSeed = 'stage_independence_test';
      
      // Run with no redo
      const baseline = generateRun(data, masterSeed);
      
      // Run with race stage redone
      const withRedo = generateRun(data, masterSeed, { race: 1 });
      
      // Check that non-race stages have identical draws
      const baselineNonRace = baseline.trace.filter(e => !e.stageId.startsWith('race'));
      const withRedoNonRace = withRedo.trace.filter(e => !e.stageId.startsWith('race'));
      
      // Build maps by stageId to handle optional stages (weapon sub-stages)
      const baselineMap = new Map(baselineNonRace.map(e => [e.stageId, e.draw]));
      const redoMap = new Map(withRedoNonRace.map(e => [e.stageId, e.draw]));
      
      // Compare draws for stages present in both traces
      for (const [stageId, baselineDraw] of baselineMap) {
        if (redoMap.has(stageId)) {
          expect(redoMap.get(stageId)).toBe(baselineDraw);
        }
      }
    });
    
    it('should change only the redone stage', () => {
      const data = loadData();
      const masterSeed = 'stage_change_test';
      
      const baseline = generateRun(data, masterSeed);
      const withRedo = generateRun(data, masterSeed, { trait: 1 });
      
      // Trait stage should be different
      const baselineTrait = baseline.trace.find(e => e.stageId === 'trait');
      const withRedoTrait = withRedo.trace.find(e => e.stageId === 'trait');
      
      // Draw will be different due to different seed
      expect(withRedoTrait.draw).not.toBe(baselineTrait.draw);
    });
  });
  
  describe('Picker Distribution', () => {
    it('should match expected distribution within 4*sqrt(N*p*(1-p)) for 100k picks', () => {
      const n = 100000;
      const entries = [
        { id: 'a', weight: 1 },
        { id: 'b', weight: 2 },
        { id: 'c', weight: 3 }
      ];
      
      const expectedProbs = {
        a: 1 / 6,
        b: 2 / 6,
        c: 3 / 6
      };
      
      const counts = { a: 0, b: 0, c: 0 };
      const rng = createRng('distribution_test', 'test_stage', 0);
      
      for (let i = 0; i < n; i++) {
        const result = pick(entries, rng, 'test');
        counts[result.pickedId]++;
      }
      
      // Check each entry is within bounds
      for (const [id, expectedProb] of Object.entries(expectedProbs)) {
        const actualCount = counts[id];
        const expectedCount = n * expectedProb;
        const bound = 4 * Math.sqrt(n * expectedProb * (1 - expectedProb));
        
        expect(Math.abs(actualCount - expectedCount)).toBeLessThanOrEqual(bound);
      }
    });
  });
  
  describe('Picker Properties (fast-check)', () => {
    it('should have probabilities sum to 1', () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(fc.string({ minLength: 1 }), fc.float({ min: Math.fround(0.01), max: Math.fround(100) })), { minLength: 1, maxLength: 10 }),
          (weightPairs) => {
            // Filter out NaN and non-positive weights
            const validPairs = weightPairs.filter(([_, weight]) => 
              !Number.isNaN(weight) && weight > 0 && Number.isFinite(weight)
            );
            
            if (validPairs.length === 0) return true; // Skip invalid test case
            
            const entries = validPairs.map(([id, weight], i) => ({
              id: `${id}_${i}`,
              weight
            }));
            
            const rng = createRng('property_test', 'test', 0);
            const result = pick(entries, rng, 'test');
            
            const totalProb = result.table.reduce((sum, e) => sum + e.prob, 0);
            return Math.abs(totalProb - 1.0) < 0.0001;
          }
        )
      );
    });
    
    it('should produce same pick for same draw when scaling weights', () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(fc.string({ minLength: 1 }), fc.float({ min: Math.fround(0.01), max: Math.fround(100) })), { minLength: 2, maxLength: 10 }),
          fc.float({ min: Math.fround(0.1), max: Math.fround(10) }),
          fc.float({ min: Math.fround(0), max: Math.fround(1) }),
          (weightPairs, scale, draw) => {
            // Filter out NaN and non-positive weights
            const validPairs = weightPairs.filter(([_, weight]) => 
              !Number.isNaN(weight) && weight > 0 && Number.isFinite(weight)
            );
            
            if (validPairs.length < 2) return true; // Skip invalid test case
            if (Number.isNaN(scale) || !Number.isFinite(scale) || scale <= 0) return true;
            if (Number.isNaN(draw) || !Number.isFinite(draw)) return true;
            
            const entries = validPairs.map(([id, weight], i) => ({
              id: `${id}_${i}`,
              weight
            }));
            
            const scaledEntries = entries.map(e => ({
              ...e,
              weight: e.weight * scale
            }));
            
            // Create RNGs that will produce the same draw
            let usedDraw = false;
            const mockRng = () => {
              if (!usedDraw) {
                usedDraw = true;
                return draw;
              }
              return 0.5; // Shouldn't be called again
            };
            
            const result1 = pick(entries, mockRng, 'test1');
            
            usedDraw = false;
            const result2 = pick(scaledEntries, mockRng, 'test2');
            
            return result1.pickedId === result2.pickedId;
          }
        )
      );
    });
    
    it('should consume exactly one draw per pick', () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(fc.string({ minLength: 1 }), fc.float({ min: Math.fround(0.01), max: Math.fround(100) })), { minLength: 1, maxLength: 10 }),
          (weightPairs) => {
            // Filter out NaN and non-positive weights
            const validPairs = weightPairs.filter(([_, weight]) => 
              !Number.isNaN(weight) && weight > 0 && Number.isFinite(weight)
            );
            
            if (validPairs.length === 0) return true; // Skip invalid test case
            
            const entries = validPairs.map(([id, weight], i) => ({
              id: `${id}_${i}`,
              weight
            }));
            
            let drawCount = 0;
            const countingRng = () => {
              drawCount++;
              return Math.random();
            };
            
            pick(entries, countingRng, 'test');
            return drawCount === 1;
          }
        )
      );
    });
  });
  
  describe('Trace Log-Probability', () => {
    it('should match hand-computed value', () => {
      // Hand-built trace
      const trace = [
        {
          stageId: 'race',
          table: [
            { id: 'human', weight: 10, prob: 0.5 },
            { id: 'elf', weight: 10, prob: 0.5 }
          ],
          pickedId: 'human',
          draw: 0.3
        },
        {
          stageId: 'archetype',
          table: [
            { id: 'warrior', weight: 1, prob: 0.25 },
            { id: 'mage', weight: 3, prob: 0.75 }
          ],
          pickedId: 'mage',
          draw: 0.6
        }
      ];
      
      const logProb = computeTraceLogProb(trace);
      
      // Hand computation: ln(0.5) + ln(0.75)
      const expected = Math.log(0.5) + Math.log(0.75);
      
      expect(Math.abs(logProb - expected)).toBeLessThan(0.0001);
    });
  });
  
  describe('Validation', () => {
    it('should pass for real data', () => {
      const data = loadData();
      const result = validate(data);
      
      if (!result.valid) {
        console.error('Validation errors:', result.errors);
      }
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should fail for negative weight', () => {
      const data = loadFixture('invalid-negative-weight');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('non-positive weight'))).toBe(true);
    });
    
    it('should fail for unknown reference', () => {
      const data = loadFixture('invalid-unknown-reference');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('unknown archetype'))).toBe(true);
    });
    
    it('should fail for power with no tags', () => {
      const data = loadFixture('invalid-power-no-tags');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('has no tags'))).toBe(true);
    });
    
    it('should fail for empty power pool', () => {
      const data = loadFixture('invalid-empty-power-pool');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('empty power pool'))).toBe(true);
    });
    
    it('should fail for missing do_nothing', () => {
      const data = loadFixture('invalid-missing-do-nothing');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing do_nothing'))).toBe(true);
    });
    
    it('should fail for unreachable step', () => {
      const data = loadFixture('invalid-unreachable-step');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('unreachable step'))).toBe(true);
    });

    // weightMods validation tests
    it('should pass for valid weightMods with trait condition', () => {
      const data = loadData();
      // Add a scenario with valid weightMods
      data.scenarios.test_scenario = {
        bands: ['solo'],
        weight: 1,
        start: 'start',
        steps: {
          start: { type: 'end' }
        },
        weightMods: [
          { if: 'trait:ambitious', mult: 2.0 }
        ]
      };
      
      const result = validate(data);
      expect(result.valid).toBe(true);
    });

    it('should pass for valid weightMods with tag condition', () => {
      const data = loadData();
      data.scenarios.test_scenario = {
        bands: ['solo'],
        weight: 1,
        start: 'start',
        steps: {
          start: { type: 'end' }
        },
        weightMods: [
          { if: 'tag:fire', mult: 1.5 }
        ]
      };
      
      const result = validate(data);
      expect(result.valid).toBe(true);
    });

    it('should pass for valid weightMods with carried condition', () => {
      const data = loadData();
      data.scenarios.test_scenario = {
        bands: ['solo'],
        weight: 1,
        start: 'start',
        steps: {
          start: { type: 'end' }
        },
        weightMods: [
          { if: 'carried:rival', mult: 0.5 }
        ]
      };
      
      const result = validate(data);
      expect(result.valid).toBe(true);
    });

    it('should pass for valid weightMods with race condition', () => {
      const data = loadData();
      data.scenarios.test_scenario = {
        bands: ['solo'],
        weight: 1,
        start: 'start',
        steps: {
          start: { type: 'end' }
        },
        weightMods: [
          { if: 'race:human', mult: 1.2 }
        ]
      };
      
      const result = validate(data);
      expect(result.valid).toBe(true);
    });

    it('should fail for weightMods with missing if field', () => {
      const data = loadFixture('invalid-weightmod-missing-if');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing required field') && e.includes('if'))).toBe(true);
    });

    it('should fail for weightMods with missing mult field', () => {
      const data = loadFixture('invalid-weightmod-missing-mult');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing required field') && e.includes('mult'))).toBe(true);
    });

    it('should fail for weightMods with non-string if field', () => {
      const data = loadFixture('invalid-weightmod-if-not-string');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("field 'if' must be a string"))).toBe(true);
    });

    it('should fail for weightMods with malformed condition', () => {
      const data = loadFixture('invalid-weightmod-malformed-condition');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be in format') && e.includes('type:value'))).toBe(true);
    });

    it('should fail for weightMods with unknown condition type', () => {
      const data = loadFixture('invalid-weightmod-unknown-type');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('unknown condition type'))).toBe(true);
    });

    it('should fail for weightMods with empty condition value', () => {
      const data = loadFixture('invalid-weightmod-empty-value');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('condition value cannot be empty'))).toBe(true);
    });

    it('should fail for weightMods with unknown trait', () => {
      const data = loadFixture('invalid-weightmod-unknown-trait');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('unknown trait'))).toBe(true);
    });

    it('should fail for weightMods with unknown tag', () => {
      const data = loadFixture('invalid-weightmod-unknown-tag');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('unknown tag'))).toBe(true);
    });

    it('should fail for weightMods with unknown carried tag', () => {
      const data = loadFixture('invalid-weightmod-unknown-carried');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('unknown carried tag'))).toBe(true);
    });

    it('should fail for weightMods with unknown race', () => {
      const data = loadFixture('invalid-weightmod-unknown-race');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('unknown race'))).toBe(true);
    });

    it('should fail for weightMods with non-number mult', () => {
      const data = loadFixture('invalid-weightmod-mult-not-number');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("field 'mult' must be a number"))).toBe(true);
    });

    it('should fail for weightMods with null mult', () => {
      const data = loadFixture('invalid-weightmod-mult-not-finite');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("field 'mult' must be a number"))).toBe(true);
    });

    it('should fail for weightMods with zero mult', () => {
      const data = loadFixture('invalid-weightmod-mult-zero');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be positive') && e.includes('0'))).toBe(true);
    });

    it('should fail for weightMods with negative mult', () => {
      const data = loadFixture('invalid-weightmod-mult-negative');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be positive'))).toBe(true);
    });

    it('should fail for weightMods that is not an object', () => {
      const data = loadFixture('invalid-weightmod-not-object');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be an object'))).toBe(true);
    });

    it('should fail for weightMods that is not an array', () => {
      const data = loadFixture('invalid-weightmod-not-array');
      const result = validate(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be an array'))).toBe(true);
    });
  });
  
  describe('Creation Runs', () => {
    it('should complete 100k runs with zero throws', () => {
      const data = loadData();
      let errorCount = 0;
      
      for (let i = 0; i < 100000; i++) {
        try {
          generateRun(data, `creation_test_${i}`);
        } catch (err) {
          errorCount++;
          if (errorCount <= 10) {
            console.error(`Error in run ${i}:`, err);
          }
        }
      }
      
      expect(errorCount).toBe(0);
    });
  });
  
  describe('Percentiles Byte-Identical', () => {
    it('should produce identical percentiles.json for same seed and data', () => {
      const data = loadData();
      const n = 1000;
      
      // Generate log probabilities twice
      const logProbs1 = [];
      const logProbs2 = [];
      
      for (let i = 0; i < n; i++) {
        const seed = `percentile_test_${i}`;
        const result1 = generateRun(data, seed);
        const result2 = generateRun(data, seed);
        
        logProbs1.push(result1.logProbability);
        logProbs2.push(result2.logProbability);
      }
      
      // Check arrays are identical
      expect(deepEqual(logProbs1, logProbs2)).toBe(true);
    });
  });
  
});
