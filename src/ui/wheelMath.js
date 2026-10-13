// @ts-check

/**
 * Pure wheel geometry functions
 * Per spec §3: Wedge angles with minimum visible threshold and "Others" consolidation
 */

const MIN_WEDGE_ANGLE_DEG = 6;
const MAX_WEDGES = 16;

/**
 * @typedef {Object} WedgeAngle
 * @property {string} id
 * @property {number} startAngle - Radians
 * @property {number} endAngle - Radians
 * @property {number} centerAngle - Radians
 * @property {boolean} isOthers - True if this is the consolidated "Others" wedge
 * @property {string[]} [otherIds] - IDs consolidated into "Others" wedge
 */

/**
 * Compute wedge angles from a probability table
 * Per spec §3: Minimum 6° per wedge, max 16 wedges, consolidate tail into "Others"
 * 
 * @param {{id: string, prob: number}[]} table
 * @returns {WedgeAngle[]}
 */
export function wedgeAngles(table) {
  if (table.length === 0) return [];
  
  const minAngleRad = (MIN_WEDGE_ANGLE_DEG * Math.PI) / 180;
  
  // If table fits within max, process normally (preserving order)
  if (table.length <= MAX_WEDGES) {
    return applyMinimumAngle(table, minAngleRad);
  }
  
  // Take top 15 by probability, preserve their relative order in the original table
  const sorted = [...table].sort((a, b) => b.prob - a.prob);
  const top15Ids = new Set(sorted.slice(0, MAX_WEDGES - 1).map(e => e.id));
  const top15 = table.filter(e => top15Ids.has(e.id));
  const tail = table.filter(e => !top15Ids.has(e.id));
  
  // Create "Others" wedge with combined probability
  const othersProb = tail.reduce((sum, entry) => sum + entry.prob, 0);
  const withOthers = [
    ...top15,
    { id: '__others__', prob: othersProb }
  ];
  
  const wedges = applyMinimumAngle(withOthers, minAngleRad);
  
  // Mark the Others wedge and store consolidated IDs
  const othersWedge = wedges.find(w => w.id === '__others__');
  if (othersWedge) {
    othersWedge.isOthers = true;
    othersWedge.otherIds = tail.map(e => e.id);
  }
  
  return wedges;
}

/**
 * Apply minimum angle constraint and normalize (iterates until stable)
 * @param {{id: string, prob: number}[]} table
 * @param {number} minAngleRad
 * @returns {WedgeAngle[]}
 */
function applyMinimumAngle(table, minAngleRad) {
  const totalProb = table.reduce((sum, e) => sum + e.prob, 0);
  
  // Calculate initial angles
  let angles = table.map(entry => ({
    id: entry.id,
    angle: (entry.prob / totalProb) * 2 * Math.PI,
    originalProb: entry.prob
  }));
  
  // Iterate until all wedges meet minimum (max 100 iterations)
  const maxIterations = 100;
  let converged = false;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    const belowMin = angles.filter(a => a.angle < minAngleRad);
    const aboveMin = angles.filter(a => a.angle >= minAngleRad);
    
    if (belowMin.length === 0) {
      converged = true;
      break; // Stable
    }
    
    if (aboveMin.length === 0) {
      // All below minimum - set all to minimum
      angles = angles.map(a => ({ ...a, angle: minAngleRad }));
      converged = true;
      break;
    }
    
    // Total angle needed for below-min entries
    const neededAngle = belowMin.length * minAngleRad;
    const currentBelowAngle = belowMin.reduce((sum, a) => sum + a.angle, 0);
    const surplus = neededAngle - currentBelowAngle;
    
    // Scale down above-min entries proportionally
    const aboveTotal = aboveMin.reduce((sum, a) => sum + a.angle, 0);
    
    if (aboveTotal > surplus) {
      const scaleFactor = Math.max(0, (aboveTotal - surplus) / aboveTotal);
      
      // Preserve original order by updating in place
      angles = angles.map(a => {
        if (a.angle < minAngleRad) {
          return { ...a, angle: minAngleRad };
        } else {
          return { ...a, angle: Math.max(minAngleRad, a.angle * scaleFactor) };
        }
      });
    } else {
      // Not enough space - set all to minimum
      angles = angles.map(a => ({ ...a, angle: minAngleRad }));
      converged = true;
      break;
    }
  }
  
  if (!converged) {
    throw new Error(`wedgeAngles failed to converge after ${maxIterations} iterations`);
  }
  
  // Normalize to exactly 2π
  const totalAngle = angles.reduce((sum, a) => sum + a.angle, 0);
  if (totalAngle > 0 && Math.abs(totalAngle - 2 * Math.PI) > 1e-10) {
    const normFactor = (2 * Math.PI) / totalAngle;
    angles = angles.map(a => ({ ...a, angle: a.angle * normFactor }));
  }
  
  // Build wedges with cumulative angles
  let currentAngle = 0;
  return angles.map(a => {
    const startAngle = currentAngle;
    const endAngle = currentAngle + a.angle;
    const centerAngle = (startAngle + endAngle) / 2;
    currentAngle = endAngle;
    
    return {
      id: a.id,
      startAngle,
      endAngle,
      centerAngle,
      isOthers: false
    };
  });
}

/**
 * Compute target angle for animation to land on picked wedge
 * Per spec §3: Must be strictly inside the wedge, away from edges
 * 
 * @param {{id: string, prob: number}[]} table
 * @param {string} pickedId
 * @param {number} jitter - Value in [0, 1) to place pointer within wedge
 * @returns {number} Target angle in radians
 */
export function targetAngle(table, pickedId, jitter) {
  const wedges = wedgeAngles(table);
  
  // Find the wedge (could be Others)
  let wedge = wedges.find(w => w.id === pickedId);
  
  // If picked ID is in tail, use Others wedge
  if (!wedge) {
    wedge = wedges.find(w => w.isOthers && w.otherIds?.includes(pickedId));
  }
  
  if (!wedge) {
    throw new Error(`Picked ID ${pickedId} not found in wedges`);
  }
  
  // Place strictly inside wedge, with 20-80% of span (20% margin each edge)
  const margin = (wedge.endAngle - wedge.startAngle) * 0.2;
  const safeStart = wedge.startAngle + margin;
  const safeEnd = wedge.endAngle - margin;
  const safeRange = safeEnd - safeStart;
  
  return safeStart + jitter * safeRange;
}

/**
 * Find which wedge contains a given angle
 * Per spec §5: Used for live result text during animation
 * 
 * @param {{id: string, prob: number}[]} table
 * @param {number} angle - Angle in radians (pointer angle in wedge coordinate system)
 * @returns {string} Wedge ID at this angle
 */
export function angleToWedge(table, angle) {
  const wedges = wedgeAngles(table);
  
  // Normalize angle to [0, 2π)
  const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  
  for (const wedge of wedges) {
    if (normalized >= wedge.startAngle && normalized < wedge.endAngle) {
      return wedge.id;
    }
  }
  
  // Edge case: very close to 2π, return last wedge
  if (Math.abs(normalized - 2 * Math.PI) < 1e-10) {
    return wedges[0].id;
  }
  return wedges[wedges.length - 1].id;
}
