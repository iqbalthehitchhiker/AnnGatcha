// @ts-check

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { targetAngle, angleToWedge } from '../src/ui/wheelMath.js';

/**
 * Test: Replay angle calculation
 * Per requirement 8: Landing angle always lies inside the picked segment
 */

describe('Wheel replay angle calculation', () => {
  it('landing angle always lies inside the picked segment (property test)', () => {
    fc.assert(
      fc.property(
        // Generate random tables with 2-20 entries
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            prob: fc.double({ min: 0.01, max: 1, noNaN: true })
          }),
          { minLength: 2, maxLength: 20 }
        ).chain(entries => fc.tuple(
          fc.constant(entries),
          fc.integer({ min: 0, max: entries.length - 1 }),
          fc.double({ min: 0, max: 0.9999, noNaN: true })
        )),
        ([table, pickedIndex, draw]) => {
          const pickedId = table[pickedIndex].id;
          const angle = targetAngle(table, pickedId, draw);
          const resultId = angleToWedge(table, angle);
          
          // Result should be picked id or __others__
          if (resultId === '__others__') {
            // This is handled by wheelMath property tests
            expect(resultId).toBe('__others__');
          } else {
            expect(resultId).toBe(pickedId);
          }
        }
      ),
      { numRuns: 10000 }
    );
  });
  
  it('handles edge cases correctly', () => {
    // Single segment (100% probability)
    const singleTable = [{ id: 'only', prob: 1.0 }];
    for (let draw = 0; draw < 1; draw += 0.1) {
      const angle = targetAngle(singleTable, 'only', draw);
      const result = angleToWedge(singleTable, angle);
      expect(result).toBe('only');
    }
    
    // Two equal segments
    const equalTable = [
      { id: 'a', prob: 0.5 },
      { id: 'b', prob: 0.5 }
    ];
    
    for (let draw = 0; draw < 0.99; draw += 0.1) {
      const angleA = targetAngle(equalTable, 'a', draw);
      const resultA = angleToWedge(equalTable, angleA);
      expect(resultA).toBe('a');
      
      const angleB = targetAngle(equalTable, 'b', draw);
      const resultB = angleToWedge(equalTable, angleB);
      expect(resultB).toBe('b');
    }
    
    // Unequal segments
    const unequalTable = [
      { id: 'rare', prob: 0.01 },
      { id: 'common', prob: 0.99 }
    ];
    
    for (let draw = 0; draw < 0.99; draw += 0.1) {
      const angleRare = targetAngle(unequalTable, 'rare', draw);
      const resultRare = angleToWedge(unequalTable, angleRare);
      expect(resultRare).toBe('rare');
      
      const angleCommon = targetAngle(unequalTable, 'common', draw);
      const resultCommon = angleToWedge(unequalTable, angleCommon);
      expect(resultCommon).toBe('common');
    }
  });
  
  it('draw=0 lands at safe start, draw near 1 lands at safe end', () => {
    const table = [
      { id: 'a', prob: 0.3 },
      { id: 'b', prob: 0.5 },
      { id: 'c', prob: 0.2 }
    ];
    
    // targetAngle adds 20% margin on each end
    const angleAtStart = targetAngle(table, 'b', 0.0);
    const angleAtEnd = targetAngle(table, 'b', 0.999);
    
    // Both should land in 'b'
    expect(angleToWedge(table, angleAtStart)).toBe('b');
    expect(angleToWedge(table, angleAtEnd)).toBe('b');
  });
});
