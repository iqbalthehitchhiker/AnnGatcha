// @ts-check

/**
 * Cubic Bezier easing solver
 * Per Checkpoint B: cubic-bezier(0.44, -0.205, 0, 1.13)
 */

/**
 * Solve cubic Bezier for a given t in [0, 1]
 * @param {number} t - Time parameter
 * @param {number} p1x - First control point x
 * @param {number} p1y - First control point y
 * @param {number} p2x - Second control point x
 * @param {number} p2y - Second control point y
 * @returns {number} - y value at t
 */
export function cubicBezier(t, p1x, p1y, p2x, p2y) {
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  
  const tSquared = t * t;
  const tCubed = tSquared * t;
  
  return ay * tCubed + by * tSquared + cy * t;
}

/**
 * Solve for t given x using Newton-Raphson
 * @param {number} x - Input x value in [0, 1]
 * @param {number} p1x
 * @param {number} p2x
 * @returns {number} - t parameter
 */
function solveCubicBezierX(x, p1x, p2x) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  
  // Newton-Raphson
  let t = x;
  for (let i = 0; i < 8; i++) {
    const tSquared = t * t;
    const tCubed = tSquared * t;
    const xt = ax * tCubed + bx * tSquared + cx * t;
    const slope = 3 * ax * tSquared + 2 * bx * t + cx;
    
    if (Math.abs(slope) < 1e-6) break;
    
    const diff = xt - x;
    if (Math.abs(diff) < 1e-6) break;
    
    t -= diff / slope;
  }
  
  return t;
}

/**
 * Create an easing function from cubic-bezier parameters
 * @param {number} p1x
 * @param {number} p1y
 * @param {number} p2x
 * @param {number} p2y
 * @returns {(x: number) => number}
 */
export function createCubicBezierEasing(p1x, p1y, p2x, p2y) {
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const t = solveCubicBezierX(x, p1x, p2x);
    return cubicBezier(t, p1x, p1y, p2x, p2y);
  };
}

/**
 * Default easing: cubic-bezier(0.17, 0.67, 0.12, 0.99)
 * Monotonic, no backward motion or overshoot
 */
export const defaultEasing = createCubicBezierEasing(0.17, 0.67, 0.12, 0.99);
