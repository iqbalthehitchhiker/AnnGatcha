// @ts-check
import { describe, it, expect } from 'vitest';
import { renderWheelSVG } from '../src/ui/wheelRenderer.js';
import { targetAngle, wedgeAngles } from '../src/ui/wheelMath.js';
import { computeFinalRotation } from '../src/ui/wheelSpin.js';
import { validate } from '../src/core/validate.js';
import { generateRun } from '../src/core/run.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

function findWedgeAtTop(svg, table) {
  const rotMatch = svg.match(/transform="rotate\(([-\d.]+)/);
  const rotationDeg = rotMatch ? parseFloat(rotMatch[1]) : 0;
  const R = (rotationDeg * Math.PI) / 180;
  const pointerAngle = ((-R % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const wedges = wedgeAngles(table);
  for (const wedge of wedges) {
    if (pointerAngle >= wedge.startAngle && pointerAngle < wedge.endAngle) {
      return wedge.id;
    }
  }
  if (Math.abs(pointerAngle - 2 * Math.PI) < 1e-10) return wedges[0].id;
  return wedges[wedges.length - 1].id;
}

describe('Wheel landing accuracy', () => {
  it('lands on correct wedge from SVG geometry (1000 random tables)', () => {
    const data = loadData();
    const validation = validate(data);
    expect(validation.valid).toBe(true);
    let failures = 0;
    for (let i = 0; i < 1000; i++) {
      const seed = `wheel-test-${i}`;
      const run = generateRun(data, seed);
      const wheelEntries = run.trace.filter(e => e.table && e.table.length > 0);
      for (const entry of wheelEntries) {
        const { table, pickedId, draw } = entry;
        const targetAngleRad = targetAngle(table, pickedId, draw);
        const R = computeFinalRotation(targetAngleRad, draw, 0);
        const svg = renderWheelSVG(table, pickedId, data, R);
        const wedgeAtTop = findWedgeAtTop(svg, table);
        const wedges = wedgeAngles(table);
        const othersWedge = wedges.find(w => w.isOthers);
        const isInOthers = othersWedge && othersWedge.otherIds?.includes(pickedId);
        const expectedWedge = isInOthers ? '__others__' : pickedId;
        if (wedgeAtTop !== expectedWedge) failures++;
      }
    }
    expect(failures).toBe(0);
  });

  it('multi-spin: each spin travels 3+ full turns and lands correctly', () => {
    const data = loadData();
    const validation = validate(data);
    expect(validation.valid).toBe(true);
    
    // Create 5 consecutive spins with a persistent wheel angle
    let currentR = 0;
    for (let spinNum = 0; spinNum < 5; spinNum++) {
      const table = [
        { id: 'a', weight: 1, prob: 0.33 },
        { id: 'b', weight: 1, prob: 0.33 },
        { id: 'c', weight: 1, prob: 0.34 }
      ];
      const pickedId = ['a', 'b', 'c', 'a', 'b'][spinNum];
      const draw = 0.5;
      
      const targetAngleRad = targetAngle(table, pickedId, draw);
      const R_new = computeFinalRotation(targetAngleRad, draw, currentR);
      
      // Assert: traveled at least 3 full turns forward
      const travel = R_new - currentR;
      expect(travel).toBeGreaterThanOrEqual(3 * 2 * Math.PI - 0.001);
      
      // Assert: lands on correct wedge
      const svg = renderWheelSVG(table, pickedId, data, R_new);
      const wedgeAtTop = findWedgeAtTop(svg, table);
      expect(wedgeAtTop).toBe(pickedId);
      
      currentR = R_new;
    }
  });
});
