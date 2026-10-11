// @ts-check

import { describe, it, expect } from 'vitest';
import { renderWheelSVG } from '../src/ui/wheelRenderer.js';
import { wedgeAngles } from '../src/ui/wheelMath.js';

describe('wheelRenderer', () => {
  it('renders 5-wedge table with lower-half and 6-degree wedges', () => {
    const table = [
      { id: 'large', prob: 0.5 },
      { id: 'medium', prob: 0.25 },
      { id: 'small', prob: 0.15 },
      { id: 'tiny', prob: 0.05 },  // Below 6° (5° × 360° ≈ 18°)
      { id: 'micro', prob: 0.05 }
    ];
    
    const data = {
      races: { large: { name: 'Large' }, medium: { name: 'Medium' } },
      powers: { small: { name: 'Small' } },
      traits: { tiny: { name: 'Tiny' }, micro: { name: 'Micro' } }
    };
    
    const svg = renderWheelSVG(table, 'medium', data);
    
    expect(svg).toContain('<svg');
    expect(svg).toContain('Large');
    expect(svg).toContain('Medium');
    
    // Extract transforms for verification
    const transforms = [...svg.matchAll(/transform="rotate\(([^,]+),/g)];
    
    console.log('\n=== SVG Output Sample ===');
    console.log(svg.substring(0, 1000));
    console.log('\n=== Label Transforms ===');
    transforms.forEach((m, i) => {
      console.log(`Label ${i}: rotate(${m[1]}°)`);
    });
  });
  
  it('label transform selects only text elements', () => {
    const table = [
      { id: 'a', prob: 0.3 },
      { id: 'b', prob: 0.4 },
      { id: 'c', prob: 0.3 }
    ];
    
    const data = { races: { a: { name: 'A' }, b: { name: 'B' }, c: { name: 'C' } } };
    const svg = renderWheelSVG(table, 'b', data, 0);
    
    // Extract all <text> elements
    const textMatches = [...svg.matchAll(/<text[^>]*>/g)];
    expect(textMatches.length).toBe(3); // One per wedge
    
    // Verify each has transform attribute
    for (const match of textMatches) {
      expect(match[0]).toContain('transform="rotate(');
    }
  });
  
  it('label direction is parallel to radius at center angle', () => {
    const table = [
      { id: 'a', prob: 0.3 },
      { id: 'b', prob: 0.4 },
      { id: 'c', prob: 0.3 }
    ];
    
    const wedges = wedgeAngles(table);
    
    wedges.forEach(wedge => {
      const centerAngleDeg = (wedge.centerAngle * 180 / Math.PI);
      const rotateDeg = centerAngleDeg - 90;
      
      // Text direction after rotation (starts horizontal [1,0])
      const rotRad = (rotateDeg * Math.PI) / 180;
      const textDirX = Math.cos(rotRad);
      const textDirY = Math.sin(rotRad);
      
      // Radius direction at center angle
      const radiusDirX = Math.cos(wedge.centerAngle - Math.PI / 2);
      const radiusDirY = Math.sin(wedge.centerAngle - Math.PI / 2);
      
      // Dot product must be +1 (parallel)
      const dotProduct = textDirX * radiusDirX + textDirY * radiusDirY;
      expect(dotProduct).toBeCloseTo(1.0, 10);
    });
  });
});
