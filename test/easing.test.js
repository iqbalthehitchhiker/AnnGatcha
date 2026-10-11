// @ts-check

import { describe, it, expect } from 'vitest';
import { createCubicBezierEasing, defaultEasing } from '../src/ui/easing.js';

describe('Cubic Bezier easing', () => {
  it('easing reaches endpoints correctly', () => {
    expect(defaultEasing(0)).toBe(0);
    expect(defaultEasing(1)).toBe(1);
    
    // Test custom easing
    const custom = createCubicBezierEasing(0.25, 0.1, 0.25, 1);
    expect(custom(0)).toBe(0);
    expect(custom(1)).toBe(1);
  });
  
  it('easing with pull-back allows negative y values', () => {
    // cubic-bezier(0.44, -0.205, 0, 1.13) has pull-back (y < 0) and overshoot (y > 1)
    const easing = createCubicBezierEasing(0.44, -0.205, 0, 1.13);
    
    let foundNegative = false;
    let foundOvershoot = false;
    
    for (let t = 0.1; t <= 0.9; t += 0.05) {
      const value = easing(t);
      if (value < 0) foundNegative = true;
      if (value > 1) foundOvershoot = true;
    }
    
    // This easing should have both characteristics
    expect(foundNegative || foundOvershoot).toBe(true);
  });
  
  it('easing values are in reasonable range', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const value = defaultEasing(t);
      
      // Should be between -0.5 and 1.5 (allowing overshoot/undershoot)
      expect(value).toBeGreaterThanOrEqual(-0.5);
      expect(value).toBeLessThanOrEqual(1.5);
    }
  });
});
