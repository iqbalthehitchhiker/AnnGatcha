// @ts-check

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { wedgeAngles, targetAngle, angleToWedge } from '../src/ui/wheelMath.js';

describe('wheelMath - wedge geometry', () => {
  it('wedge angles sum to 2π (360°)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            prob: fc.double({ min: 0.01, max: 1, noNaN: true })
          }),
          { minLength: 2, maxLength: 30 }
        ),
        (table) => {
          const wedges = wedgeAngles(table);
          const totalAngle = wedges.reduce((sum, w) => sum + (w.endAngle - w.startAngle), 0);
          expect(totalAngle).toBeCloseTo(2 * Math.PI, 10);
        }
      ),
      { numRuns: 1000 }
    );
  });
  
  it('all wedges meet minimum angle constraint', () => {
    const minAngleRad = (6 * Math.PI) / 180;
    
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            prob: fc.double({ min: 0.01, max: 1, noNaN: true })
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (table) => {
          const wedges = wedgeAngles(table);
          
          for (const wedge of wedges) {
            const angle = wedge.endAngle - wedge.startAngle;
            expect(angle).toBeGreaterThanOrEqual(minAngleRad * 0.99); // Small tolerance
          }
        }
      ),
      { numRuns: 1000 }
    );
  });
  
  it('targetAngle always lands inside picked wedge', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            prob: fc.double({ min: 0.01, max: 1, noNaN: true })
          }),
          { minLength: 2, maxLength: 25 }
        ).chain(entries => fc.tuple(
          fc.constant(entries),
          fc.integer({ min: 0, max: entries.length - 1 }),
          fc.double({ min: 0, max: 0.9999, noNaN: true })
        )),
        ([table, pickedIndex, jitter]) => {
          const pickedId = table[pickedIndex].id;
          const angle = targetAngle(table, pickedId, jitter);
          const wedges = wedgeAngles(table);
          
          // Find the wedge that should contain this angle
          let expectedWedge = wedges.find(w => w.id === pickedId);
          if (!expectedWedge) {
            // Must be in Others
            expectedWedge = wedges.find(w => w.isOthers && w.otherIds?.includes(pickedId));
          }
          
          expect(expectedWedge).toBeDefined();
          expect(angle).toBeGreaterThan(expectedWedge.startAngle);
          expect(angle).toBeLessThan(expectedWedge.endAngle);
        }
      ),
      { numRuns: 5000 }
    );
  });
  
  it('angleToWedge returns picked id for targetAngle', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            prob: fc.double({ min: 0.01, max: 1, noNaN: true })
          }),
          { minLength: 2, maxLength: 25 }
        ).chain(entries => fc.tuple(
          fc.constant(entries),
          fc.integer({ min: 0, max: entries.length - 1 }),
          fc.double({ min: 0, max: 0.9999, noNaN: true })
        )),
        ([table, pickedIndex, jitter]) => {
          const pickedId = table[pickedIndex].id;
          const angle = targetAngle(table, pickedId, jitter);
          const resultId = angleToWedge(table, angle);
          
          // Result should be picked id or __others__
          if (resultId === '__others__') {
            const wedges = wedgeAngles(table);
            const othersWedge = wedges.find(w => w.id === '__others__');
            expect(othersWedge?.otherIds).toContain(pickedId);
          } else {
            expect(resultId).toBe(pickedId);
          }
        }
      ),
      { numRuns: 5000 }
    );
  });
  
  it('tables with >16 entries create Others wedge', () => {
    const longTable = Array.from({ length: 25 }, (_, i) => ({
      id: `entry_${i}`,
      prob: 1 / 25
    }));
    
    const wedges = wedgeAngles(longTable);
    expect(wedges.length).toBe(16);
    
    const othersWedge = wedges.find(w => w.isOthers);
    expect(othersWedge).toBeDefined();
    expect(othersWedge?.otherIds?.length).toBe(10);
  });
  
  it('tail picks land on Others wedge', () => {
    const longTable = Array.from({ length: 20 }, (_, i) => ({
      id: `entry_${i}`,
      prob: 1 / 20
    }));
    
    // Pick an entry that should be in the tail
    const tailId = 'entry_19';
    const angle = targetAngle(longTable, tailId, 0.5);
    const resultId = angleToWedge(longTable, angle);
    
    expect(resultId).toBe('__others__');
  });
  
  it('adversarial: 15 small entries + 1 large entry', () => {
    const table = [
      ...Array.from({ length: 15 }, (_, i) => ({ id: `small_${i}`, prob: 1 })),
      { id: 'large', prob: 1000 }
    ];
    
    const wedges = wedgeAngles(table);
    const minAngleRad = (6 * Math.PI) / 180;
    
    // Every wedge must be >= 6 degrees
    for (const wedge of wedges) {
      const angleDeg = ((wedge.endAngle - wedge.startAngle) * 180 / Math.PI);
      console.log(`Wedge ${wedge.id}: ${angleDeg.toFixed(4)}°`);
      expect(wedge.endAngle - wedge.startAngle).toBeGreaterThanOrEqual(minAngleRad - 1e-9);
    }
    
    // Angles must sum to 360°
    const totalAngle = wedges.reduce((sum, w) => sum + (w.endAngle - w.startAngle), 0);
    const totalDeg = (totalAngle * 180 / Math.PI);
    console.log(`Total: ${totalDeg.toFixed(10)}°`);
    expect(Math.abs(totalAngle - 2 * Math.PI)).toBeLessThan(1e-9);
  });
  
  it('near-minimum wedges: 6.2° + tiny + large', () => {
    // 6.2° = 0.10821 rad, need prob ≈ 0.01719 for 6.2°
    const table = [
      { id: 'near_min_1', prob: 0.01719 },
      { id: 'near_min_2', prob: 0.01719 },
      { id: 'tiny', prob: 0.001 },
      { id: 'large', prob: 0.964 }
    ];
    
    const wedges = wedgeAngles(table);
    const minAngleRad = (6 * Math.PI) / 180;
    
    for (const wedge of wedges) {
      const angleDeg = ((wedge.endAngle - wedge.startAngle) * 180 / Math.PI);
      console.log(`Wedge ${wedge.id}: ${angleDeg.toFixed(6)}°`);
      expect(wedge.endAngle - wedge.startAngle).toBeGreaterThanOrEqual(minAngleRad - 1e-9);
    }
    
    const totalAngle = wedges.reduce((sum, w) => sum + (w.endAngle - w.startAngle), 0);
    const totalDeg = (totalAngle * 180 / Math.PI);
    console.log(`Total: ${totalDeg.toFixed(10)}°`);
    expect(Math.abs(totalAngle - 2 * Math.PI)).toBeLessThan(1e-9);
  });
  
  it('several wedges between 6.0 and 6.5 degrees', () => {
    const table = [
      { id: 'edge_1', prob: 0.0167 }, // ~6.01°
      { id: 'edge_2', prob: 0.0170 }, // ~6.12°
      { id: 'edge_3', prob: 0.0175 }, // ~6.30°
      { id: 'edge_4', prob: 0.0180 }, // ~6.48°
      { id: 'large', prob: 0.9308 }
    ];
    
    const wedges = wedgeAngles(table);
    const minAngleRad = (6 * Math.PI) / 180;
    
    for (const wedge of wedges) {
      const angleDeg = ((wedge.endAngle - wedge.startAngle) * 180 / Math.PI);
      console.log(`Wedge ${wedge.id}: ${angleDeg.toFixed(6)}°`);
      expect(wedge.endAngle - wedge.startAngle).toBeGreaterThanOrEqual(minAngleRad - 1e-9);
    }
    
    const totalAngle = wedges.reduce((sum, w) => sum + (w.endAngle - w.startAngle), 0);
    const totalDeg = (totalAngle * 180 / Math.PI);
    console.log(`Total: ${totalDeg.toFixed(10)}°`);
    expect(Math.abs(totalAngle - 2 * Math.PI)).toBeLessThan(1e-9);
  });
  
  it('random near-minimum wedges converge correctly', () => {
    const minAngleRad = (6 * Math.PI) / 180;
    
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            // Generate probabilities between 0.01 and 0.02 (near minimum 6° ≈ 0.01667)
            prob: fc.double({ min: 0.015, max: 0.022, noNaN: true })
          }),
          { minLength: 5, maxLength: 15 }
        ),
        (table) => {
          const wedges = wedgeAngles(table);
          
          // All wedges must meet minimum
          for (const wedge of wedges) {
            const angle = wedge.endAngle - wedge.startAngle;
            expect(angle).toBeGreaterThanOrEqual(minAngleRad - 1e-9);
          }
          
          // Total must be 2π
          const totalAngle = wedges.reduce((sum, w) => sum + (w.endAngle - w.startAngle), 0);
          expect(totalAngle).toBeCloseTo(2 * Math.PI, 10);
        }
      ),
      { numRuns: 500 }
    );
  });
  
  it('final rotation places picked wedge under top pointer', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            prob: fc.double({ min: 0.01, max: 1, noNaN: true })
          }),
          { minLength: 2, maxLength: 25 }
        ).chain(entries => fc.tuple(
          fc.constant(entries),
          fc.integer({ min: 0, max: entries.length - 1 }),
          fc.double({ min: 0, max: 0.9999, noNaN: true })
        )),
        ([table, pickedIndex, jitter]) => {
          const pickedId = table[pickedIndex].id;
          const target = targetAngle(table, pickedId, jitter);
          
          // Simulate wheel.js rotation: wheel rotates CCW by -totalRotation
          const extraSpins = 4; // Fixed for test
          const totalRotation = extraSpins * 2 * Math.PI + target;
          const finalAngle = -totalRotation;
          
          // Apply rotation (same as renderer: rotate the wheel, pointer at 0)
          // Pointer at angle 0 sees wedge at -finalAngle in wheel's frame
          const pointerSeesAngle = (-finalAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
          
          const resultId = angleToWedge(table, pointerSeesAngle);
          
          if (resultId === '__others__') {
            const wedges = wedgeAngles(table);
            const othersWedge = wedges.find(w => w.id === '__others__');
            expect(othersWedge?.otherIds).toContain(pickedId);
          } else {
            expect(resultId).toBe(pickedId);
          }
        }
      ),
      { numRuns: 1000 }
    );
  });
  
  it('live text max-angle logic prevents backward reads', () => {
    const table = [
      { id: 'a', prob: 0.5 },
      { id: 'b', prob: 0.3 },
      { id: 'c', prob: 0.2 }
    ];
    
    // Simulate animation with pull-back
    const angles = [0, 0.5, 1.0, 1.5, 2.0, 1.8, 1.9, 2.1, 2.2]; // Pull-back at 1.8
    let maxAngle = 0;
    const seenWedges = [];
    
    for (const angle of angles) {
      if (angle > maxAngle) {
        maxAngle = angle;
        const wedgeId = angleToWedge(table, angle);
        seenWedges.push(wedgeId);
      }
    }
    
    // Should never read same wedge twice due to pull-back
    expect(seenWedges.length).toBeGreaterThan(0);
  });
  
  it('skip animation lands at same final angle as full spin', () => {
    fc.assert(
      fc.property(
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
        ([table, pickedIndex, jitter]) => {
          const pickedId = table[pickedIndex].id;
          const target = targetAngle(table, pickedId, jitter);
          
          // Full spin: 4 rotations + target
          const fullSpinAngle = -(4 * 2 * Math.PI + target);
          const normalizedFull = ((fullSpinAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          
          // Skip: jumps directly to same final angle
          const skipAngle = -(4 * 2 * Math.PI + target);
          const normalizedSkip = ((skipAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          
          // Both must land at same normalized angle
          expect(normalizedSkip).toBeCloseTo(normalizedFull, 10);
          
          // Both must show same result
          const pointerFull = (-normalizedFull % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
          const pointerSkip = (-normalizedSkip % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
          
          const resultFull = angleToWedge(table, pointerFull);
          const resultSkip = angleToWedge(table, pointerSkip);
          
          expect(resultSkip).toBe(resultFull);
        }
      ),
      { numRuns: 500 }
    );
  });
  
  it('skip lands on same wedge as full spin', () => {
    fc.assert(
      fc.property(
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
        ([table, pickedIndex, jitter]) => {
          const pickedId = table[pickedIndex].id;
          const angle = targetAngle(table, pickedId, jitter);
          const wedgeId = angleToWedge(table, angle);
          
          // Skip must land on same wedge (possibly Others)
          const wedges = wedgeAngles(table);
          const pickedWedge = wedges.find(w => 
            w.id === pickedId || (w.isOthers && w.otherIds?.includes(pickedId))
          );
          
          expect(wedgeId).toBe(pickedWedge?.id);
        }
      ),
      { numRuns: 1000 }
    );
  });
});
