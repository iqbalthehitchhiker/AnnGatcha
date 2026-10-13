// @ts-check

/**
 * Anti-spoiler reveal logic: compute which picks should be revealed after N spins
 * @param {number} completedSpins
 * @param {any[]} allTraceEntries - full trace from currentRun
 * @returns {Array<{stageId: string, pickedId: string}>}
 */
export function getRevealedPicks(completedSpins, allTraceEntries) {
  const picksWithSpins = allTraceEntries
    .map((e, idx) => ({ entry: e, spinIndex: e.table && e.table.length > 0 ? idx : -1 }))
    .filter(p => p.spinIndex >= 0);
  
  return picksWithSpins
    .filter(p => p.spinIndex < completedSpins)
    .map(p => ({ stageId: p.entry.stageId, pickedId: p.entry.pickedId }));
}
