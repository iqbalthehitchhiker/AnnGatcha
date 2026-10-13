// @ts-check

import { describe, it, expect } from 'vitest';
import { renderCharacter, renderScenarios, renderRarity } from '../src/ui/results.js';

/**
 * Test: Results renderer
 * Per requirement 8: Test results renderer with a fixture RunResult
 */

/**
 * Create a minimal test data set
 * @returns {any}
 */
function createTestData() {
  return {
    races: {
      human: { name: 'Human' }
    },
    archetypes: {
      warrior: { name: 'Warrior' }
    },
    sizes: {
      medium: { name: 'Medium' }
    },
    traits: {
      brave: { name: 'Brave' }
    },
    powers: {
      super_strength: { name: 'Super Strength' },
      flight: { name: 'Flight' }
    },
    weapons: {
      sword: { name: 'Sword' },
      fire: { name: 'Fire' }
    },
    scenarios: {
      fight_monster: { name: 'Fight a Monster' }
    },
    pools: {
      monsters: [
        { id: 'dragon', name: 'Dragon' }
      ]
    }
  };
}

/**
 * Create a fixture RunResult
 * @returns {any}
 */
function createFixtureRun() {
  return {
    character: {
      race: 'human',
      archetype: 'warrior',
      size: 'medium',
      trait: 'brave',
      powers: ['super_strength', 'flight'],
      weapon: {
        type: 'sword',
        enchantment: 'fire'
      },
      strength: { tier: 6, level: 5.5 },
      speed: { tier: 6, offset: 0 },
      durability: { tier: 5, offset: 1 },
      powerCount: 2
    },
    band: '6-4',
    scenarios: [
      {
        scenarioId: 'fight_monster',
        finalStep: 'won',
        text: 'You defeated the dragon in an epic battle.',
        emittedTags: ['rival'],
        trace: [
          {
            stepType: 'pick',
            pool: 'monsters',
            pickedId: 'dragon'
          }
        ]
      }
    ],
    logProbability: -15.5
  };
}

describe('Results rendering', () => {
  it('renders character information without errors', () => {
    const data = createTestData();
    const run = createFixtureRun();
    
    const html = renderCharacter(run.character, data);
    
    expect(html).toContain('Human');
    expect(html).toContain('Warrior');
    expect(html).toContain('Brave');
    expect(html).toContain('Super Strength');
    expect(html).toContain('Flight');
    expect(html).toContain('Fire');
    expect(html).toContain('Sword');
    expect(html).toContain('Tier 6');
  });
  
  it('renders scenarios with opponent names', () => {
    const data = createTestData();
    const run = createFixtureRun();
    
    const html = renderScenarios(run.scenarios, data);
    
    expect(html).toContain('Fight a Monster');
    expect(html).toContain('Dragon');
    expect(html).toContain('Win');
    expect(html).toContain('You defeated the dragon in an epic battle.');
    expect(html).toContain('rival');
  });
  
  it('renders rarity information', () => {
    const html1 = renderRarity(95.5);
    expect(html1).toContain('95.5%');
    
    const html2 = renderRarity(null);
    expect(html2).toContain('not available');
  });
  
  it('escapes HTML in text content', () => {
    const data = createTestData();
    const dangerousRun = {
      ...createFixtureRun(),
      scenarios: [{
        scenarioId: 'fight_monster',
        finalStep: 'won',
        text: '<script>alert("xss")</script>',
        emittedTags: [],
        trace: []
      }]
    };
    
    const html = renderScenarios(dangerousRun.scenarios, data);
    
    // Should escape the script tag
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
