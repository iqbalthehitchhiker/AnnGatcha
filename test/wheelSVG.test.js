// @ts-check

import { describe, it } from 'vitest';
import { renderWheelSVG } from '../src/ui/wheelRenderer.js';

describe('wheelSVG output', () => {
  it('renders exact SVG for 5-wedge table (50,25,15,7,3)', () => {
    const table = [
      { id: 'a', prob: 50 },
      { id: 'b', prob: 25 },
      { id: 'c', prob: 15 },
      { id: 'd', prob: 7 },
      { id: 'e', prob: 3 }
    ];
    
    const data = {};
    const svg = renderWheelSVG(table, 'none', data, 600);
    
    console.log('\n=== FULL SVG MARKUP ===');
    console.log(svg);
    console.log('\n=== LABEL TRANSFORMS ===');
    
    const transforms = [...svg.matchAll(/transform="rotate\(([^,]+), ([^,]+), ([^)]+)\)">([^<]+)</g)];
    transforms.forEach((m, i) => {
      const angle = parseFloat(m[1]);
      const isLowerHalf = angle > 90 && angle < 270;
      console.log(`Label ${i} (${m[4]}): rotate(${m[1]}°, ${m[2]}, ${m[3]}) ${isLowerHalf ? '[LOWER HALF]' : ''}`);
    });
  });
});
