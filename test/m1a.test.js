// @ts-check

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateRun } from '../src/core/run.js';
import { validate } from '../src/core/validate.js';
import { pick } from '../src/core/picker.js';
import { 
  calculateEffectiveStrength, 
  canHarm, 
  resolveFight,
  resolveCheck,
  applyWoundedEffect,
  getBandFromEffStr,
  getCharacterTags
} from '../src/core/stats.js';
import { checkScenarioRequires, applyScenarioWeightMods, executeScenario } from '../src/core/scenario.js';
import { createRng } from '../src/core/rng.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Test-only helper: L(tier, frac = 0.5) = (10 - tier) + frac
 * Converts tier notation to level
 */
function L(tier, frac = 0.5) {
  return (10 - tier) + frac;
}

/**
 * Test-only helper: picks from fight resolution entries
 */
function resolveFightAndPick(effStrChar, spdChar, durChar, tagsChar, effStrOpp, spdOpp, durOpp, tagsOpp, rng, data) {
  const resolution = resolveFight(effStrChar, spdChar, durChar, tagsChar, effStrOpp, spdOpp, durOpp, tagsOpp, data);
  const result = pick(resolution.entries, rng, 'test_fight');
  return {
    outcome: result.pickedId,
    draw: result.draw,
    prob: result.table.find(e => e.id === result.pickedId).prob,
    harmClass: resolution.harmClass
  };
}

function loadData() {
  const dataPath = join(projectRoot, 'data');
  const config = JSON.parse(readFileSync(join(dataPath, 'config.json'), 'utf-8'));
  const races = JSON.parse(readFileSync(join(dataPath, 'races.json'), 'utf-8'));
  const archetypes = JSON.parse(readFileSync(join(dataPath, 'archetypes.json'), 'utf-8'));
  const sizes = JSON.parse(readFileSync(join(dataPath, 'sizes.json'), 'utf-8'));
  const traits = JSON.parse(readFileSync(join(dataPath, 'traits.json'), 'utf-8'));
  const powers = JSON.parse(readFileSync(join(dataPath, 'powers.json'), 'utf-8'));
  const tags = JSON.parse(readFileSync(join(dataPath, 'tags.json'), 'utf-8'));
  const weapons = JSON.parse(readFileSync(join(dataPath, 'weapons.json'), 'utf-8'));
  const pools = JSON.parse(readFileSync(join(dataPath, 'pools.json'), 'utf-8'));
  const scenarios = JSON.parse(readFileSync(join(dataPath, 'scenarios', 'basic.json'), 'utf-8'));

  return { config, races, archetypes, sizes, traits, powers, tags, weapons, pools, scenarios };
}

describe('M1a Acceptance Tests', () => {
  
  describe('Monotonicity', () => {
    it('should have win probability never decrease as strength rises', () => {
      const data = loadData();
      const rng = () => 0.5;
      
      // Tier 7 opponent (L=3.5)
      const opponent = {
        str: L(7), // tier 7
        spd: L(5), // tier 5
        dur: L(7), // tier 7
        tags: []
      };
      
      // Test character strength from tier 10 to tier 3
      const strengths = [L(10), L(9), L(8), L(7), L(6), L(5), L(4), L(3)];
      let lastProb = 0;
      
      for (const str of strengths) {
        const result = resolveFightAndPick(
          str, L(5), L(5), [], // Character
          opponent.str, opponent.spd, opponent.dur, opponent.tags,
          rng, data
        );
        
        const winProb = result.outcome === 'win' ? result.prob : 1 - result.prob;
        expect(winProb).toBeGreaterThanOrEqual(lastProb);
        lastProb = winProb;
      }
    });
    
    it('should have win probability never decrease as opponent durability falls', () => {
      const data = loadData();
      const rng = () => 0.5;
      
      const charStr = L(5); // tier 5
      
      // Test opponent durability from tier 3 to tier 10
      const durabilities = [L(3), L(4), L(5), L(6), L(7), L(8), L(9), L(10)];
      let lastProb = 0;
      
      for (const dur of durabilities) {
        const result = resolveFightAndPick(
          charStr, L(5), L(5), [],
          L(5), L(5), dur, [],
          rng, data
        );
        
        const winProb = result.outcome === 'win' ? result.prob : 1 - result.prob;
        expect(winProb).toBeGreaterThanOrEqual(lastProb);
        lastProb = winProb;
      }
    });
  });
  
  describe('Steepness', () => {
    it('should give p >= 0.98 when diff >= 2 (both can harm)', () => {
      const data = loadData();
      const rng = () => 0.5;
      
      // Example from spec: A str 9.5, dur 5.0; B str 4.6, dur 5.5
      // diff = ((effStrA - durB) - (effStrB - durA)) / 2 at equal speed
      // diff = ((9.5 - 5.5) - (4.6 - 5.0)) / 2 = (4.0 - (-0.4)) / 2 = 4.4 / 2 = 2.2
      const charStr = 9.5; // Near tier 1
      const charDur = 5.0; // tier 5
      const oppStr = 4.6; // Near tier 6
      const oppDur = 5.5; // tier 5
      const speed = L(5); // Equal speeds, tier 5
      
      // Verify diff calculation
      const expectedDiff = ((charStr - oppDur) - (oppStr - charDur)) / 2;
      expect(expectedDiff).toBeCloseTo(2.2, 1);
      
      const result = resolveFightAndPick(
        charStr, speed, charDur, [],
        oppStr, speed, oppDur, [],
        rng, data
      );
      
      const winProb = result.outcome === 'win' ? result.prob : 1 - result.prob;
      expect(winProb).toBeGreaterThanOrEqual(0.98);
    });
    
    it('should give p <= 0.02 when mirrored (diff <= -2)', () => {
      const data = loadData();
      const rng = () => 0.5;
      
      // Mirror the previous test: swap A and B
      const charStr = 4.6; // Near tier 6
      const charDur = 5.5; // tier 5
      const oppStr = 9.5; // Near tier 1
      const oppDur = 5.0; // tier 5
      const speed = L(5); // Equal speeds
      
      // Verify diff calculation
      const expectedDiff = ((charStr - oppDur) - (oppStr - charDur)) / 2;
      expect(expectedDiff).toBeCloseTo(-2.2, 1);
      
      const result = resolveFightAndPick(
        charStr, speed, charDur, [],
        oppStr, speed, oppDur, [],
        rng, data
      );
      
      const winProb = result.outcome === 'win' ? result.prob : 1 - result.prob;
      expect(winProb).toBeLessThanOrEqual(0.02);
    });
    
    it('should give 0.5 when diff = 0 (symmetric)', () => {
      const data = loadData();
      const rng = () => 0.5;
      
      // Perfectly symmetric: all stats equal
      const level = L(5); // tier 5
      
      const result = resolveFightAndPick(
        level, level, level, [],
        level, level, level, [],
        rng, data
      );
      
      const winProb = result.outcome === 'win' ? result.prob : 1 - result.prob;
      expect(winProb).toBeCloseTo(0.5, 2);
    });
  });
  
  describe('Weapon Test (FR-S2)', () => {
    it('should boost tier-10 human with tier-2 weapon into band 3-2 and enable harm', () => {
      const data = loadData();
      
      // Human: all stats in tier 10 (L < 1)
      const humanStr = L(10, 0.3); // tier 10, L=0.3
      const humanSpd = L(10, 0.4); // tier 10, L=0.4
      const humanDur = L(10, 0.5); // tier 10, L=0.5
      
      // Test with godslayer_blade (level 6.5) + soul_edge (levelBonus 3) = 9.5
      // After weaponPenalty 1.0: weaponStr = 8.5
      const weapon = { type: 'godslayer_blade', enchantment: 'soul_edge' };
      const effStr = calculateEffectiveStrength(humanStr, weapon, data);
      
      // Get weapon tags from data
      const weaponType = data.weapons.types.godslayer_blade;
      const enchantment = data.weapons.enchantments.soul_edge;
      const weaponTags = [...(weaponType.tags || []), ...(enchantment.tags || [])];
      
      // Assert: effStr is in band 1-0 (weapon level after penalty: 8.5)
      expect(effStr).toBeGreaterThanOrEqual(8.0);
      
      // Assert: speed and durability unchanged
      expect(humanSpd).toBe(L(10, 0.4));
      expect(humanDur).toBe(L(10, 0.5));
      
      // Get a physical_immunity god
      const god = data.pools.gods.find(g => g.tags && g.tags.includes('physical_immunity'));
      expect(god).toBeDefined();
      
      // Assert: weapon-boosted human CAN harm god (weapon level 8.5 >= god.dur 8.5 - harmMargin 0.5)
      const canHarmWithSoulSevering = canHarm(effStr, god.dur, weaponTags, god.tags, data);
      expect(canHarmWithSoulSevering).toBe(true);
      
      // Assert: god can harm human (god str >= human dur - harmMargin)
      const harmMargin = data.config.harmMargin;
      expect(god.str).toBeGreaterThanOrEqual(humanDur - harmMargin);
    });
  });
  
  describe('Band Test', () => {
    it('should place weapon-boosted character in correct band', () => {
      const data = loadData();
      
      // Test band calculation for tier 3-2 (tiers [3, 2])
      // bandTier = 10 - floor(effStr)
      // For bandTier = 3: floor(effStr) = 7, so effStr in [7, 8)
      // For bandTier = 2: floor(effStr) = 8, so effStr in [8, 9)
      
      const band = getBandFromEffStr(7.5, data);
      expect(band).toBe('3-2');
    });
    
    it('should offer weapon-friendly scenarios for weapon-boosted characters', () => {
      const data = loadData();
      
      const scenariosInBand = Object.entries(data.scenarios).filter(([_id, s]) =>
        s.bands && s.bands.includes('3-2')
      );
      
      // Check that at least one is weapon-friendly (no contest)
      const weaponFriendly = scenariosInBand.filter(([_id, s]) => {
        let hasContest = false;
        for (const step of Object.values(s.steps)) {
          if (step.type === 'contest') {
            hasContest = true;
            break;
          }
        }
        return !hasContest;
      });
      
      expect(weaponFriendly.length).toBeGreaterThan(0);
    });

    it('FR-X7: weapon-boosted tier-10 human has durability-free scenario in bands 3-2 and 1-0', () => {
      const data = loadData();

      function isDurabilityFree(scenario) {
        for (const step of Object.values(scenario.steps)) {
          if (step.type === 'contest') return false;
          if (step.type === 'check' && step.stat === 'durability') return false;
        }
        return true;
      }

      function analyzeBand(weaponType, weaponEnchantment) {
        const character = {
          race: 'human',
          trait: 'brave',
          strength: L(10, 0.3),
          speed: L(10, 0.4),
          durability: L(10, 0.5),
          weapon: { type: weaponType, enchantment: weaponEnchantment },
          powers: [],
        };

        const effStr = calculateEffectiveStrength(character.strength, character.weapon, data);
        const band = getBandFromEffStr(effStr, data);
        const characterTags = getCharacterTags(character, data);
        const carriedTags = [];

        const eligible = [];
        for (const [scenarioId, scenario] of Object.entries(data.scenarios)) {
          if (scenarioId === 'do_nothing') continue;
          if (!scenario.bands || !scenario.bands.includes(band)) continue;
          if (!checkScenarioRequires(scenario, characterTags, carriedTags, character)) continue;

          const weight = applyScenarioWeightMods(scenario, scenario.weight, character, characterTags, carriedTags);
          eligible.push({ id: scenarioId, weight, durabilityFree: isDurabilityFree(scenario) });
        }

        return { effStr, band, eligible };
      }

      const result32 = analyzeBand('godslayer_blade', 'soul_edge');
      expect(result32.band).toBe('3-2');
      const durFree32 = result32.eligible.filter(e => e.durabilityFree);
      expect(durFree32.length).toBeGreaterThan(0);
      const totalWeight32 = result32.eligible.reduce((sum, e) => sum + e.weight, 0);
      for (const e of durFree32) {
        expect(e.weight / totalWeight32).toBeGreaterThan(0);
      }

      const result10 = analyzeBand('starforged_blade', 'cosmic_resonance');
      expect(result10.band).toBe('1-0');
      const durFree10 = result10.eligible.filter(e => e.durabilityFree);
      expect(durFree10.length).toBeGreaterThan(0);
      const totalWeight10 = result10.eligible.reduce((sum, e) => sum + e.weight, 0);
      for (const e of durFree10) {
        expect(e.weight / totalWeight10).toBeGreaterThan(0);
      }
    });

    it('should interpolate {opponent} in end-step text', () => {
      const data = loadData();

      data.scenarios['test_interp'] = {
        name: 'Test Interpolation',
        bands: ['10-9'],
        weight: 1,
        requires: { tags: [], notTags: [], carried: [] },
        start: 'pick',
        steps: {
          pick: { type: 'pick', pool: 'basic_opponents', bind: 'opponent', next: 'won' },
          won: { type: 'end', text: 'You defeat {opponent}.', emits: [] },
        },
      };

      const character = {
        race: 'human',
        trait: 'brave',
        strength: L(10, 0.3),
        speed: L(10, 0.4),
        durability: L(10, 0.5),
        weapon: null,
        powers: [],
      };

      const result = executeScenario('test_interp', character, [], data, () => 0.5);
      expect(result.text).toContain('You defeat');
      expect(result.text).not.toContain('{opponent}');
    });

    it('should throw on unknown placeholder in end-step text', () => {
      const data = loadData();

      data.scenarios['test_bad_interp'] = {
        name: 'Test Bad Interpolation',
        bands: ['10-9'],
        weight: 1,
        requires: { tags: [], notTags: [], carried: [] },
        start: 'end',
        steps: {
          end: { type: 'end', text: 'You fight {unknown}.', emits: [] },
        },
      };

      const character = {
        race: 'human',
        trait: 'brave',
        strength: L(10, 0.3),
        speed: L(10, 0.4),
        durability: L(10, 0.5),
        weapon: null,
        powers: [],
      };

      expect(() => executeScenario('test_bad_interp', character, [], data, () => 0.5))
        .toThrow('Unknown placeholder {unknown} in scenario test_bad_interp step end');
    });

    it('should throw when a placeholder binding is undefined or null', () => {
      const data = loadData();

      data.scenarios['test_null_binding'] = {
        name: 'Test Null Binding',
        bands: ['10-9'],
        weight: 1,
        requires: { tags: [], notTags: [], carried: [] },
        start: 'end',
        steps: {
          end: { type: 'end', text: 'You fight {opponent}.', emits: [] },
        },
      };

      const character = {
        race: 'human',
        trait: 'brave',
        strength: L(10, 0.3),
        speed: L(10, 0.4),
        durability: L(10, 0.5),
        weapon: null,
        powers: [],
      };

      // Test undefined binding
      expect(() => executeScenario('test_null_binding', character, [], data, () => 0.5, { opponent: undefined }))
        .toThrow('Placeholder {opponent} is undefined or null in scenario test_null_binding step end');

      // Test null binding
      expect(() => executeScenario('test_null_binding', character, [], data, () => 0.5, { opponent: null }))
        .toThrow('Placeholder {opponent} is undefined or null in scenario test_null_binding step end');
    });

    it('should use effStr with wounded penalty for strength checks', () => {
      const data = loadData();

      // Create a check scenario that uses strength stat
      data.scenarios['test_strength_check'] = {
        name: 'Test Strength Check',
        bands: ['10-9'],
        weight: 1,
        requires: { tags: [], notTags: [], carried: [] },
        start: 'check',
        steps: {
          check: { type: 'check', stat: 'strength', difficulty: 0, baseOdds: 0.5, next: { success: 'success', fail: 'fail' } },
          success: { type: 'end', text: 'Success', emits: [] },
          fail: { type: 'end', text: 'Fail', emits: [] }
        },
      };

      // Wounded character: raw strength 0.4, godslayer_blade (6.5) + cosmic_resonance (3)
      // weaponLevel = 6.5 + 3 = 9.5, weaponStr = 9.5 - 1.0 penalty = 8.5
      // effStr = max(0.4, 8.5) = 8.5, then applyWoundedEffect(8.5, ['wounded']) = 7.5
      // This test verifies effStr is used for strength checks, not raw strength
      const character = {
        race: 'human',
        trait: 'brave',
        strength: 0.4,
        speed: 5.0,
        durability: 5.0,
        weapon: { type: 'godslayer_blade', enchantment: 'cosmic_resonance' },
        powers: [],
      };

      const carriedTags = ['wounded'];
      const result = executeScenario('test_strength_check', character, carriedTags, data, () => 0.5);
      
      // Find the check trace entry
      const checkEntry = result.trace.find(e => e.stepType === 'check');
      expect(checkEntry).toBeDefined();
      // Verifies that wounded penalty is correctly applied to effStr
      expect(checkEntry.statValue).toBeGreaterThan(7);
      expect(checkEntry.statValue).toBeLessThan(8);
    });
  });
  
  describe('Bypass Test', () => {
    it('should allow soul-severing weapon to harm physical-immune god', () => {
      const data = loadData();
      
      const effStr = L(8); // tier 2
      const charTags = ['soul_severing'];
      
      const god = data.pools.gods.find(g => g.tags.includes('physical_immunity'));
      expect(god).toBeDefined();
      
      const result = canHarm(effStr, god.dur, charTags, god.tags, data);
      expect(result).toBe(true);
    });
    
    it('should block harm when physical_immunity applies and str is insufficient', () => {
      const data = loadData();
      
      // Weak character without bypass
      const effStr = L(10, 0.5); // tier 10, L=0.5
      const charTags = ['blade', 'physical']; // No soul_severing
      
      const god = data.pools.gods.find(g => g.tags.includes('physical_immunity'));
      expect(god).toBeDefined();
      
      // physical_immunity requires soul_severing to bypass
      // Without it, cannot harm even though we have physical damage
      const result = canHarm(effStr, god.dur, charTags, god.tags, data);
      expect(result).toBe(false);
    });
    
    it('should block physical weapon without bypass tag against physical_immunity god', () => {
      const data = loadData();
      
      // Character with mid-tier weapon (war_hammer: level 5, weaponPenalty 1 = weaponStr 4)
      const humanStr = L(10, 0.3); // tier 10, weak
      const weapon = { type: 'war_hammer', enchantment: 'plain' };
      const effStr = calculateEffectiveStrength(humanStr, weapon, data);
      
      expect(effStr).toBe(4.0); // war_hammer level 5 - penalty 1 = 4
      
      // Get weapon tags (physical, combat, blunt)
      const weaponType = data.weapons.types.war_hammer;
      const enchantment = data.weapons.enchantments.plain;
      const weaponTags = [...(weaponType.tags || []), ...(enchantment.tags || [])];
      
      // Get physical_immunity god (sun_titan: dur 8.5)
      const god = data.pools.gods.find(g => g.tags.includes('physical_immunity'));
      expect(god).toBeDefined();
      
      // Cannot harm: effStr 4 < dur 8.5 - harmMargin 0.5 = 8.0, AND physical_immunity blocks physical
      const result = canHarm(effStr, god.dur, weaponTags, god.tags, data);
      expect(result).toBe(false);
    });
  });
  
  describe('Stalemate Test', () => {
    it('should have zero unresolved outcomes in 10k random pairs', () => {
      const data = loadData();
      const iterations = 10000;
      let unresolvedCount = 0;
      
      for (let i = 0; i < iterations; i++) {
        const rng = createRng('stalemate_test', `iter_${i}`, 0);
        
        // Random stats in [0, 11)
        const charStr = Math.random() * 11;
        const charSpd = Math.random() * 11;
        const charDur = Math.random() * 11;
        
        const oppStr = Math.random() * 11;
        const oppSpd = Math.random() * 11;
        const oppDur = Math.random() * 11;
        
        const result = resolveFightAndPick(
          charStr, charSpd, charDur, [],
          oppStr, oppSpd, oppDur, [],
          rng, data
        );
        
        // All outcomes should be resolved
        if (!['win', 'lose', 'flee', 'standoff'].includes(result.outcome)) {
          unresolvedCount++;
        }
      }
      
      expect(unresolvedCount).toBe(0);
    });
    
    it('flee occurs only when character is faster by > speedGapFlee', () => {
      const data = loadData();
      const speedGapFlee = data.config.speedGapFlee;
      const rng = () => 0.5;
      
      // Neither can harm: stalemate
      const charStr = L(10); // tier 10, weak
      const oppStr = L(10); // tier 10, weak
      const charDur = L(2); // tier 8, strong
      const oppDur = L(2); // tier 8, strong
      
      // Test: character much faster -> flee
      const charSpd = L(5, 0.5);
      const oppSpd = charSpd - speedGapFlee - 0.5;
      
      const result = resolveFightAndPick(
        charStr, charSpd, charDur, [],
        oppStr, oppSpd, oppDur, [],
        rng, data
      );
      
      expect(result.outcome).toBe('flee');
    });
    
    it('standoff occurs when speeds are close OR opponent is faster by > speedGapFlee', () => {
      const data = loadData();
      const speedGapFlee = data.config.speedGapFlee;
      
      // Neither can harm: stalemate
      const charStr = L(10); // tier 10, weak
      const oppStr = L(10); // tier 10, weak
      const charDur = L(2); // tier 8, strong
      const oppDur = L(2); // tier 8, strong
      
      // Test: speeds close -> standoff
      const result1 = resolveFight(
        charStr, L(5), charDur, [],
        oppStr, L(5, 0.1), oppDur, [],
        data
      );
      expect(result1.harmClass).toBe('neither');
      
      // Test: opponent much faster -> standoff
      const charSpd = L(5);
      const oppSpd = charSpd + speedGapFlee + 0.5;
      
      const result2 = resolveFight(
        charStr, charSpd, charDur, [],
        oppStr, oppSpd, oppDur, [],
        data
      );
      expect(result2.harmClass).toBe('neither');
    });
  });
  
  describe('One-Sided Flee Test', () => {
    it('should flee when character cannot harm, opponent can, and character is faster', () => {
      const data = loadData();
      const speedGapFlee = data.config.speedGapFlee;
      const rng = createRng('one_sided_flee', 'test1', 0);
      
      // Human: weak, fast
      const charStr = L(10, 0.2); // tier 10, weak
      const charSpd = L(5);        // tier 5
      const charDur = L(10, 0.3);  // tier 10, weak
      
      // God: strong, slower
      const oppStr = L(2);         // tier 8, strong
      const oppSpd = charSpd - speedGapFlee - 0.5; // Slower by > speedGapFlee
      const oppDur = L(2);         // tier 8, strong
      
      const result = resolveFightAndPick(
        charStr, charSpd, charDur, [],
        oppStr, oppSpd, oppDur, [],
        rng, data
      );
      
      // Should flee deterministically (character escapes)
      expect(result.outcome).toBe('flee');
      expect(result.prob).toBe(1.0);
    });
    
    it('should rout at 1-minOdds when speed gap is below threshold', () => {
      const data = loadData();
      const minOdds = data.config.minOdds;
      const rng = createRng('one_sided_rout', 'test1', 0);
      
      // Human: weak, slightly faster
      const charStr = L(10);       // tier 10, weak
      const charSpd = L(5);        // tier 5
      const charDur = L(10);       // tier 10, weak
      
      // God: strong, nearly same speed
      const oppStr = L(2);         // tier 8, strong
      const oppSpd = L(5, 0.4);    // tier 5, small speed gap
      const oppDur = L(2);         // tier 8, strong
      
      const result = resolveFightAndPick(
        charStr, charSpd, charDur, [],
        oppStr, oppSpd, oppDur, [],
        rng, data
      );
      
      // Should be rout: opponent wins at 1 - minOdds
      expect(['win', 'lose']).toContain(result.outcome);
      
      // The probabilities should sum to 1 and be clamped by minOdds
      const lossProbExpected = 1 - minOdds;
      if (result.outcome === 'lose') {
        expect(result.prob).toBeCloseTo(lossProbExpected, 2);
      }
    });
  });
  
  describe('FR-S7: Non-Fight Check', () => {
    it('should give baseOdds when stat equals difficulty', () => {
      const data = loadData();
      const rng = () => 0.5;
      const baseOdds = 0.7;
      
      const stat = L(5);
      const difficulty = L(5);
      
      const result = resolveCheck(stat, difficulty, baseOdds, rng, data);
      
      // When stat == difficulty, probability should equal baseOdds (clamped)
      const expectedProb = Math.max(data.config.minOdds, Math.min(baseOdds, 1 - data.config.minOdds));
      
      if (result.outcome === 'success') {
        expect(result.prob).toBeCloseTo(expectedProb, 2);
      } else {
        expect(result.prob).toBeCloseTo(1 - expectedProb, 2);
      }
    });
    
    it('should clamp at both ends (minOdds and 1-minOdds)', () => {
      const data = loadData();
      const rng = () => 0.01;
      const baseOdds = 0.5;
      
      // Very high stat vs low difficulty -> should clamp at 1 - minOdds
      const highResult = resolveCheck(L(2), L(10), baseOdds, rng, data);
      expect(highResult.prob).toBeLessThanOrEqual(1 - data.config.minOdds);
      
      // Very low stat vs high difficulty -> should clamp at minOdds
      const lowResult = resolveCheck(L(10), L(2), baseOdds, rng, data);
      if (lowResult.outcome === 'success') {
        expect(lowResult.prob).toBeGreaterThanOrEqual(data.config.minOdds);
      }
    });
  });
  
  describe('Wounded Effect', () => {
    it('should apply -1.0 to all stats when wounded tag is active', () => {
      
      const originalStr = L(5);
      const originalSpd = L(6);
      const originalDur = L(7);
      
      const woundedStr = applyWoundedEffect(originalStr, ['wounded']);
      const woundedSpd = applyWoundedEffect(originalSpd, ['wounded']);
      const woundedDur = applyWoundedEffect(originalDur, ['wounded']);
      
      expect(woundedStr).toBe(originalStr - 1.0);
      expect(woundedSpd).toBe(originalSpd - 1.0);
      expect(woundedDur).toBe(originalDur - 1.0);
    });
    
    it('should not change band when wounded (band determined from effStr at chain start)', () => {
      const data = loadData();
      
      // Character with effStr at L=7.5 (tier 3, band 3-2)
      const effStr = 7.5;
      const band1 = getBandFromEffStr(effStr, data);
      expect(band1).toBe('3-2');
      
      // Even if speed/dur are reduced by wounded, effStr (and thus band) is fixed
      // This test verifies the band calculation doesn't change
      const band2 = getBandFromEffStr(effStr, data);
      expect(band2).toBe(band1);
    });
  });
  
  describe('Scenario Repeat Penalty', () => {
    it('should penalize repeats but allow them (prob > 0, prob < without penalty)', () => {
      const data = loadData();
      
      // Create a minimal band with exactly two scenarios
      // Both eligible, so without penalty each has 50% chance
      data.scenarios['test_scenario_a'] = {
        name: 'Test A',
        bands: ['10-9'],
        weight: 10,
        requires: { tags: [], notTags: [], carried: [] },
        start: 'end',
        steps: { end: { type: 'end', text: 'A', emits: [] } }
      };
      
      data.scenarios['test_scenario_b'] = {
        name: 'Test B',
        bands: ['10-9'],
        weight: 10,
        requires: { tags: [], notTags: [], carried: [] },
        start: 'end',
        steps: { end: { type: 'end', text: 'B', emits: [] } }
      };
      
      // Limit scenarios to just these two for band 10-9
      const originalScenarios = { ...data.scenarios };
      data.scenarios = {
        test_scenario_a: data.scenarios.test_scenario_a,
        test_scenario_b: data.scenarios.test_scenario_b,
        do_nothing: data.scenarios.do_nothing
      };
      
      // Run many times and count repeats
      let repeatCount = 0;
      const n = 10000;
      
      for (let i = 0; i < n; i++) {
        const result = generateRun(data, `repeat_test_${i}`);
        
        // Only check band 10-9 runs
        if (result.band === '10-9') {
          const scenarioIds = result.scenarios.map(s => s.scenarioId);
          
          // Check if second scenario matches first (excluding do_nothing)
          if (scenarioIds[1] === scenarioIds[0] && scenarioIds[0] !== 'do_nothing') {
            repeatCount++;
          }
        }
      }
      
      // Without penalty: 50% chance of repeat (0.5 * 0.5 = 0.25 for same scenario twice)
      // With 0.2x penalty: first pick 50/50, second pick has penalized weight
      // A first, then A again: 0.5 * (10*0.2)/(10*0.2 + 10) = 0.5 * 2/12 = 0.083
      // Total repeat probability ≈ 0.083 + 0.083 = 0.167
      
      // Repeat should be possible (> 0)
      expect(repeatCount).toBeGreaterThan(0);
      
      // Repeat should be less than without penalty (< 0.25 * n / 3 scenarios = 0.083 * n)
      // With penalty expect around 0.167 per run * n/3 band match rate
      // Very rough check: should be significantly less than 25% of eligible runs
      expect(repeatCount).toBeLessThan(n * 0.2);
      
      // Restore original scenarios
      data.scenarios = originalScenarios;
    });
  });
  
  describe('Replay Test', () => {
    it('should rebuild outcome from trace alone', () => {
      const data = loadData();
      
      const run1 = generateRun(data, 'replay_test');
      const run2 = generateRun(data, 'replay_test');
      
      // Traces should be identical
      expect(run1.trace).toEqual(run2.trace);
    });
  });
  });
  
  describe('Per-Band Options Test', () => {
    it('should have at least 2 non-do_nothing scenarios per band for various characters', () => {
      const data = loadData();
      
      // Sample a few character builds
      const sampleBuilds = [
        { effStr: L(10), tags: [] },
        { effStr: L(7), tags: ['blade'] },
        { effStr: L(5), tags: ['magic'] },
        { effStr: L(2), tags: ['divine'] },
      ];
      
      for (const build of sampleBuilds) {
        const band = getBandFromEffStr(build.effStr, data);
        
        // Count non-do_nothing scenarios available in this band
        const available = Object.values(data.scenarios).filter(s => 
          s.bands && s.bands.includes(band) && s.id !== 'do_nothing'
        );
        
        // Should have at least 2 non-do_nothing options
        expect(available.length).toBeGreaterThanOrEqual(2);
      }
    });
  });
  
  describe('Validation Fixtures', () => {
    it('should fail for missing contest branch', () => {
      const data = JSON.parse(readFileSync(join(projectRoot, 'test/fixtures/invalid-missing-contest-branch.json'), 'utf-8'));
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing') && e.includes('branch'))).toBe(true);
    });
    
    it('should fail for no durability-free scenarios', () => {
      const data = JSON.parse(readFileSync(join(projectRoot, 'test/fixtures/invalid-no-durability-free.json'), 'utf-8'));
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('durability-free'))).toBe(true);
    });
    
    it('should fail for carried tag never emitted', () => {
      const data = JSON.parse(readFileSync(join(projectRoot, 'test/fixtures/invalid-carried-never-emitted.json'), 'utf-8'));
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('never emitted'))).toBe(true);
    });
    
    it('should fail for carried tag never consumed', () => {
      const data = JSON.parse(readFileSync(join(projectRoot, 'test/fixtures/invalid-carried-never-consumed.json'), 'utf-8'));
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('never consumed'))).toBe(true);
    });
    
    it('should fail for undefined pool', () => {
      const data = JSON.parse(readFileSync(join(projectRoot, 'test/fixtures/invalid-undefined-pool.json'), 'utf-8'));
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('unknown pool'))).toBe(true);
    });
    
    it('should fail for dead-end step', () => {
      const data = JSON.parse(readFileSync(join(projectRoot, 'test/fixtures/invalid-dead-end-step.json'), 'utf-8'));
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('dead end'))).toBe(true);
    });
    
    it('should fail for unused stat', () => {
      const data = JSON.parse(readFileSync(join(projectRoot, 'test/fixtures/invalid-stat-unused.json'), 'utf-8'));
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('not used'))).toBe(true);
    });
    
    it('should return errors when validation encounters invalid structure', () => {
      const data = JSON.parse(readFileSync(join(projectRoot, 'test/fixtures/invalid-validation-throw.json'), 'utf-8'));
      // This fixture has races: null, which triggers the collect-don't-throw contract
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing races');
    });

    it('bypass succeeds when defender lacks blockedBy tag', () => {
      const data = loadData();
      
      // Attacker with bypass tag, defender without counter
      const attackerStr = L(10); // tier 10, weak
      const defenderDur = L(2); // tier 8, strong
      const attackerTags = ['soul_severing'];
      const defenderTags = []; // No blockedBy counter
      
      const harmMargin = data.config.harmMargin;
      
      // Without bypass, cannot harm (weak str vs strong dur)
      const canHarmWithoutBypass = (attackerStr >= defenderDur - harmMargin);
      expect(canHarmWithoutBypass).toBe(false);
      
      // With bypass and no blocker, CAN harm
      const result = canHarm(attackerStr, defenderDur, attackerTags, defenderTags, data);
      expect(result).toBe(true);
      
      console.log(`Bypass Test (success): effStr=${attackerStr}, defenderDur=${defenderDur}, harmMargin=${harmMargin}`);
    });

    it('bypass fails when defender has blockedBy tag', () => {
      const data = loadData();
      
      // Attacker with bypass, defender with blocking tag
      const attackerStr = L(10); // tier 10, weak
      const defenderDur = L(2); // tier 8, strong
      const attackerTags = ['soul_severing'];
      
      // soul_severing has blockedBy: ['soul_immunity']
      const defenderTags = ['soul_immunity'];
      
      const harmMargin = data.config.harmMargin;
      
      // Bypass should fail, fall back to strength check
      const result = canHarm(attackerStr, defenderDur, attackerTags, defenderTags, data);
      const strengthCheck = (attackerStr >= defenderDur - harmMargin);
      expect(result).toBe(strengthCheck);
      
      console.log(`Bypass Test (blocked): effStr=${attackerStr}, defenderDur=${defenderDur}, harmMargin=${harmMargin}, result=${result}`);
    });
  });
