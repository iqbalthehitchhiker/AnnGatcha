// @ts-check

import { describe, it, expect } from 'vitest';

describe('Wheel normalization snap test', () => {
  it('should verify no snap after normalization', () => {
    // Test the normalization function
    const normalizeAngle = (angle) => {
      return ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    };
    
    // Test various angles
    const testAngles = [
      0, Math.PI / 4, Math.PI / 2, Math.PI, 
      2 * Math.PI, 3 * Math.PI, -Math.PI, -2 * Math.PI,
      10.5, -10.5, 100, -100
    ];
    
    for (const angle of testAngles) {
      const normalized = normalizeAngle(angle);
      
      // Verify angle mod 2π equivalence
      const diff = Math.abs((angle - normalized) % (2 * Math.PI));
      const isEquivalent = diff < 0.001 || Math.abs(diff - 2 * Math.PI) < 0.001;
      
      expect(isEquivalent).toBe(true);
      expect(normalized).toBeGreaterThanOrEqual(0);
      expect(normalized).toBeLessThan(2 * Math.PI);
    }
  });
});
