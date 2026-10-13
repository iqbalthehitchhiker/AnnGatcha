// @ts-check
import { describe, it, expect } from 'vitest';
import { getRevealedPicks } from '../src/ui/anti-spoiler.js';

describe('Progress label', () => {
  it('shows "Pick N of M" with N never exceeding M', () => {
    const trace = [
      { stageId: 'race', pickedId: 'human', table: [{ id: 'human', weight: 1 }] },
      { stageId: 'archetype', pickedId: 'warrior', table: [{ id: 'warrior', weight: 1 }] },
      { stageId: 'size', pickedId: 'medium', table: [] } // no spin
    ];
    
    expect(getRevealedPicks(0, trace)).toHaveLength(0); // N=0, M=2
    expect(getRevealedPicks(1, trace)).toHaveLength(1); // N=1, M=2
    expect(getRevealedPicks(2, trace)).toHaveLength(2); // N=2, M=2
    expect(getRevealedPicks(100, trace)).toHaveLength(2); // N capped at M=2
  });
});

describe('Anti-spoiler reveal logic', () => {
  it('does not reveal a stage result before its spin ends', () => {
    const trace = [
      { stageId: 'race', pickedId: 'elf', table: [{ id: 'elf', weight: 1 }] },
      { stageId: 'archetype', pickedId: 'mage', table: [{ id: 'mage', weight: 1 }] }
    ];
    
    const after0 = getRevealedPicks(0, trace);
    expect(after0).toEqual([]);
    
    const after1 = getRevealedPicks(1, trace);
    expect(after1).toEqual([{ stageId: 'race', pickedId: 'elf' }]);
    
    const after2 = getRevealedPicks(2, trace);
    expect(after2).toEqual([
      { stageId: 'race', pickedId: 'elf' },
      { stageId: 'archetype', pickedId: 'mage' }
    ]);
  });
  
  it('Skip All reveals all remaining picks', () => {
    const trace = [
      { stageId: 'race', pickedId: 'dwarf', table: [{ id: 'dwarf', weight: 1 }] },
      { stageId: 'size', pickedId: 'small', table: [{ id: 'small', weight: 1 }] },
      { stageId: 'trait', pickedId: 'brave', table: [{ id: 'brave', weight: 1 }] }
    ];
    
    // After 1 spin, skip all = jump to end (index 3)
    const afterSkip = getRevealedPicks(3, trace);
    expect(afterSkip).toHaveLength(3);
    expect(afterSkip.map(p => p.stageId)).toEqual(['race', 'size', 'trait']);
  });
});
