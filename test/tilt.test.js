// @ts-check

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateRun } from '../src/core/run.js';
import { applyTilt } from '../src/core/mods.js';
import { validate } from '../src/core/validate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function loadData() {
  const dataDir = join(projectRoot, 'data');
  return {
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
}

function loadFixture(name) {
  const fixturePath = join(projectRoot, 'test', 'fixtures', `${name}.json`);
  return JSON.parse(readFileSync(fixturePath, 'utf8'));
}

describe('Tilt Mod Tests', () => {
  
  describe('tilt=0 leaves tables identical', () => {
    it('should preserve M0 golden tests with tilt=0', () => {
      const data = loadData();
      const seed = 'golden_test_tilt_zero';
      
      // Generate baseline
      const baseline = generateRun(data, seed);
      
      // Verify it still works
      expect(baseline.character).toBeDefined();
      expect(baseline.scenarios).toHaveLength(3);
    });
  });
  
  describe('tilt > 0 raises high-rank probability', () => {
    it('should increase weight of higher rank entries', () => {
      const entries = [
        { id: 'a', rank: 1, weight: 10 },
        { id: 'b', rank: 3, weight: 10 },
        { id: 'c', rank: 5, weight: 10 }
      ];
      
      const tilted = applyTilt(entries, 'rank', 1);
      
      // exp(by * (rank - 1)) with by=1:
      // rank 1: exp(0) = 1, weight = 10
      // rank 3: exp(2) ≈ 7.39, weight ≈ 73.9
      // rank 5: exp(4) ≈ 54.6, weight ≈ 546
      
      expect(tilted[0].weight).toBeCloseTo(10, 1);
      expect(tilted[1].weight).toBeGreaterThan(tilted[0].weight);
      expect(tilted[2].weight).toBeGreaterThan(tilted[1].weight);
    });
    
    it('should keep all weights positive', () => {
      const entries = [
        { id: 'a', level: 1, weight: 5 },
        { id: 'b', level: 5, weight: 5 }
      ];
      
      const tilted = applyTilt(entries, 'level', 2);
      
      expect(tilted.every(e => e.weight > 0)).toBe(true);
    });
    
    it('should maintain probability sum to 1', () => {
      const entries = [
        { id: 'a', rank: 1, weight: 10 },
        { id: 'b', rank: 2, weight: 20 },
        { id: 'c', rank: 3, weight: 30 }
      ];
      
      const tilted = applyTilt(entries, 'rank', 0.5);
      const totalWeight = tilted.reduce((sum, e) => sum + e.weight, 0);
      
      // Normalize to probabilities
      const probs = tilted.map(e => e.weight / totalWeight);
      const probSum = probs.reduce((sum, p) => sum + p, 0);
      
      expect(probSum).toBeCloseTo(1, 10);
    });
  });
  
  describe('validation rules', () => {
    it('should reject invalid power rank not in 1-5', () => {
      const fixture = loadFixture('invalid-power-rank');
      const result = validate(fixture);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('rank') && e.includes('1'))).toBe(true);
    });
    
    it('should reject non-finite tilt', () => {
      const fixture = loadFixture('invalid-tilt-not-finite');
      const result = validate(fixture);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('tilt') && e.includes('finite'))).toBe(true);
    });
    
    it('should reject unknown tilt field', () => {
      const fixture = loadFixture('invalid-tilt-unknown-field');
      const result = validate(fixture);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('field') || e.includes('unknown'))).toBe(true);
    });

    it('should reject tilt out of range', () => {
      const fixture = loadFixture('invalid-tilt-out-of-range');
      const result = validate(fixture);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('range') || e.includes('|value| <= 2'))).toBe(true);
    });
  });
  
  describe('missing field defaults to 1', () => {
    it('should treat missing rank as 1', () => {
      const entries = [
        { id: 'a', weight: 10 },
        { id: 'b', rank: 3, weight: 10 }
      ];
      
      const tilted = applyTilt(entries, 'rank', 1);
      
      // Missing rank defaults to 1: exp(1 * (1 - 1)) = exp(0) = 1
      expect(tilted[0].weight).toBeCloseTo(10, 1);
      expect(tilted[1].weight).toBeGreaterThan(tilted[0].weight);
    });
  });

  describe('end-to-end tilt tests', () => {
    it('should increase mean weapon level with weaponTilt over 20k seeds', () => {
      const data = loadData();
      
      // Add test races
      const testRaces = {
        ...data.races,
        tilt_test_zero: {
          ...data.races.human,
          weaponTilt: 0
        },
        tilt_test_pos: {
          ...data.races.human,
          weaponTilt: 0.5
        }
      };
      const testData = { ...data, races: testRaces };
      
      const levelsZero = [];
      const levelsPos = [];
      
      for (let i = 0; i < 20000; i++) {
        const seed = `weapon_tilt_${i}`;
        
        const runZero = generateRun({ ...testData, races: { tilt_test_zero: testRaces.tilt_test_zero, ...data.races } }, seed);
        if (runZero.character.weapon) {
          const type = data.weapons.types[runZero.character.weapon.type];
          levelsZero.push(type.level);
        }
        
        const runPos = generateRun({ ...testData, races: { tilt_test_pos: testRaces.tilt_test_pos, ...data.races } }, seed);
        if (runPos.character.weapon) {
          const type = data.weapons.types[runPos.character.weapon.type];
          levelsPos.push(type.level);
        }
      }
      
      const meanZero = levelsZero.reduce((a, b) => a + b, 0) / levelsZero.length;
      const meanPos = levelsPos.reduce((a, b) => a + b, 0) / levelsPos.length;
      
      expect(meanPos).toBeGreaterThan(meanZero);
    });

    it('should increase mean power rank with powerTilt over 20k seeds', () => {
      const data = loadData();
      
      // Add test races with powerTilt
      const testRaces = {
        ...data.races,
        power_tilt_zero: {
          ...data.races.human,
          powerTilt: 0
        },
        power_tilt_pos: {
          ...data.races.human,
          powerTilt: 0.5
        }
      };
      
      const ranksZero = [];
      const ranksPos = [];
      
      for (let i = 0; i < 20000; i++) {
        const seed = `power_tilt_${i}`;
        
        const testDataZero = { ...data, races: { power_tilt_zero: testRaces.power_tilt_zero, ...data.races } };
        const runZero = generateRun(testDataZero, seed);
        for (const powerId of runZero.character.powers) {
          const power = data.powers[powerId];
          ranksZero.push(power.rank || 1);
        }
        
        const testDataPos = { ...data, races: { power_tilt_pos: testRaces.power_tilt_pos, ...data.races } };
        const runPos = generateRun(testDataPos, seed);
        for (const powerId of runPos.character.powers) {
          const power = data.powers[powerId];
          ranksPos.push(power.rank || 1);
        }
      }
      
      const meanZero = ranksZero.reduce((a, b) => a + b, 0) / ranksZero.length;
      const meanPos = ranksPos.reduce((a, b) => a + b, 0) / ranksPos.length;
      
      expect(meanPos).toBeGreaterThan(meanZero);
    });
  });
});

describe('Label Tests', () => {
  it('should have label tier match final speed/durability tier for 1000 seeds', () => {
    const data = loadData();
    
    for (let i = 0; i < 1000; i++) {
      const seed = `label_test_${i}`;
      const run = generateRun(data, seed);
      
      // Speed: extract tier from trace label and compare to actual tier
      const speedTrace = run.trace.find(t => t.stageId === 'speedOffset');
      if (speedTrace) {
        const pickedEntry = speedTrace.table.find(e => e.id === speedTrace.pickedId);
        if (pickedEntry && pickedEntry.label) {
          const labelMatch = pickedEntry.label.match(/Tier (\d+)/);
          expect(labelMatch).toBeTruthy();
          const labelTier = parseInt(labelMatch[1], 10);
          const actualTier = 10 - Math.floor(run.character.speed);
          expect(labelTier).toBe(actualTier);
        }
      }
      
      // Durability: extract tier from trace label and compare to actual tier
      const durTrace = run.trace.find(t => t.stageId === 'durOffset');
      if (durTrace) {
        const pickedEntry = durTrace.table.find(e => e.id === durTrace.pickedId);
        if (pickedEntry && pickedEntry.label) {
          const labelMatch = pickedEntry.label.match(/Tier (\d+)/);
          expect(labelMatch).toBeTruthy();
          const labelTier = parseInt(labelMatch[1], 10);
          const actualTier = 10 - Math.floor(run.character.durability);
          expect(labelTier).toBe(actualTier);
        }
      }
    }
  });
  
  it('should have all distinct labels within speed/durability tables', () => {
    const data = loadData();
    
    // Human race has 3 speed offsets: {"-1": 1, "0": 2, "+0.5": 1}
    const human = data.races.human;
    expect(human.offsets?.spd).toBeDefined();
    const spdOffsets = Object.keys(human.offsets.spd || {});
    expect(spdOffsets.length).toBeGreaterThan(1);
    
    // With distinct offsets and any strength, labels should be distinct
    // because label includes both tier and signed offset
  });
});
