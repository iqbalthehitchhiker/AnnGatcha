// @ts-check

/**
 * Compute the final rotation angle for landing on a picked wedge
 * @param {number} targetAngle - The angle to land on (from targetAngle())
 * @param {number} draw - The trace draw value in [0,1)
 * @param {number} currentAngle - The wheel's current rotation angle
 * @returns {number} Final rotation angle R in radians
 */
export function computeFinalRotation(targetAngle, draw, currentAngle = 0) {
  // R_new = -t + 2π*k where k is the smallest integer such that R_new >= R_old + 3*2π
  // This ensures at least 3 full forward rotations from the current position
  const minRotation = currentAngle + 3 * 2 * Math.PI;
  const baseAngle = -targetAngle;
  
  // Find k such that baseAngle + k*2π >= minRotation
  const k = Math.ceil((minRotation - baseAngle) / (2 * Math.PI));
  
  return baseAngle + k * 2 * Math.PI;
}
