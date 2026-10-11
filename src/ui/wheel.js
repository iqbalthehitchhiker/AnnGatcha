// @ts-check

/**
 * Wheel component for visualizing trace entries
 * Per FR-U1: ONE component that replays any trace entry
 * SVG-based wheel with predetermined landing
 */

import { targetAngle, angleToWedge } from './wheelMath.js';
import { renderWheelSVG } from './wheelRenderer.js';
import { defaultEasing } from './easing.js';

/**
 * @typedef {Object} TraceEntry
 * @property {string} stageId
 * @property {Array<{id: string, weight: number, prob: number}>} table
 * @property {string} pickedId
 * @property {number} draw - Random draw in [0, 1)
 */

/**
 * Wheel renderer and animator
 */
export class Wheel {
  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this.container = container;
    this.currentAngle = 0;
    this.animationId = null;
    this.isAnimating = false;
    this.spinToken = 0;
    this.maxAngleReached = 0;
  }
  
  /**
   * Render a static wheel for a trace entry
   * @param {TraceEntry} entry
   * @param {any} data - Game data for name lookups
   */
  render(entry, data) {
    if (!entry || !entry.table || entry.table.length === 0) {
      this.clear();
      return;
    }
    
    const { table, pickedId } = entry;
    const svg = renderWheelSVG(table, pickedId, data, this.currentAngle);
    this.container.innerHTML = svg;
  }
  
  /**
   * Animate wheel spin to predetermined result
   * @param {TraceEntry} entry
   * @param {any} data
   * @param {(id: string) => void} onLiveUpdate - Callback for live text updates
   * @param {boolean} [skipAnimation] - Jump to result
   * @returns {Promise<void>}
   */
  animate(entry, data, onLiveUpdate, skipAnimation = false) {
    return new Promise((resolve) => {
      if (!entry || !entry.table || entry.table.length === 0) {
        resolve();
        return;
      }
      
      const { table, pickedId, draw } = entry;
      const myToken = ++this.spinToken;
      
      // Compute target angle (deterministic from trace)
      const targetAngleRad = targetAngle(table, pickedId, draw);
      
      // Determine duration: short for single/deterministic, 4-6s otherwise
      const isDeterministic = table.length === 1 || table.every(e => e.prob === 1 || e.prob === 0);
      const duration = isDeterministic ? 1.2 : 4 + Math.random() * 2;
      
      // Spin: 3-5 full rotations + target
      const extraSpins = 3 + Math.random() * 2;
      const totalRotation = extraSpins * 2 * Math.PI + targetAngleRad;
      const finalAngle = -totalRotation;
      
      // Skip animation or reduced motion: immediate reveal or fade
      if (skipAnimation) {
        this.currentAngle = finalAngle;
        this.normalizeAngle();
        this.maxAngleReached = Math.abs(this.currentAngle);
        
        // Fade effect for reduced motion
        if (isDeterministic) {
          this.render(entry, data);
          const pointerAngle = (-this.currentAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
          const resultId = angleToWedge(table, pointerAngle);
          onLiveUpdate(resultId === '__others__' ? pickedId : resultId);
          resolve();
        } else {
          // Short fade animation
          setTimeout(() => {
            this.render(entry, data);
            const pointerAngle = (-this.currentAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
            const resultId = angleToWedge(table, pointerAngle);
            onLiveUpdate(resultId === '__others__' ? pickedId : resultId);
            resolve();
          }, 300);
        }
        return;
      }
      
      const startTime = performance.now();
      const startAngle = this.currentAngle;
      this.maxAngleReached = Math.abs(startAngle);
      
      this.isAnimating = true;
      
      const frame = (/** @type {number} */ currentTime) => {
        // Stale callback guard
        if (myToken !== this.spinToken) {
          return;
        }
        
        const elapsed = (currentTime - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        
        // Apply easing
        const eased = defaultEasing(progress);
        
        this.currentAngle = startAngle + (finalAngle - startAngle) * eased;
        
        // Track max angle for live text (handle pull-back)
        const absAngle = Math.abs(this.currentAngle);
        if (absAngle > this.maxAngleReached) {
          this.maxAngleReached = absAngle;
          
          // Update live text from max angle reached
          const pointerAngle = (-this.currentAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
          const liveId = angleToWedge(table, pointerAngle);
          onLiveUpdate(liveId === '__others__' ? 'Others' : liveId);
        }
        
        this.render(entry, data);
        
        if (progress < 1) {
          this.animationId = requestAnimationFrame(frame);
        } else {
          this.isAnimating = false;
          this.normalizeAngle();
          
          // Final reveal
          const pointerAngle = (-this.currentAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
          const resultId = angleToWedge(table, pointerAngle);
          onLiveUpdate(resultId === '__others__' ? pickedId : resultId);
          
          resolve();
        }
      };
      
      this.animationId = requestAnimationFrame(frame);
    });
  }
  
  /**
   * Normalize angle to [0, 2π)
   */
  normalizeAngle() {
    this.currentAngle = ((this.currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  }
  
  /**
   * Cancel any running animation
   */
  cancel() {
    this.spinToken++; // Invalidate callbacks
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.isAnimating = false;
  }
  
  /**
   * Clear the wheel
   */
  clear() {
    this.container.innerHTML = '';
  }
}

/**
 * Get stage label for display
 * @param {string} stageId
 * @returns {string}
 */
export function getStageLabel(stageId) {
  const labels = {
    'race': 'Race',
    'archetype': 'Archetype',
    'size': 'Size',
    'trait': 'Trait',
    'powerCount': 'Power Count',
    'strength': 'Strength Tier',
    'speedOffset': 'Speed',
    'durOffset': 'Durability',
    'weapon': 'Weapon',
    'weapon:type': 'Weapon Type',
    'weapon:enchantment': 'Weapon Enchantment'
  };
  
  if (stageId.startsWith('powers:')) {
    return `Power ${parseInt(stageId.split(':')[1]) + 1}`;
  }
  
  return labels[stageId] || stageId;
}
