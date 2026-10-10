# Final Read-Only Diagnostic Report

## 1. Fight Outcomes and Harm Class by Band

**Band 10-9:** Win 1.0%, Lose 99.0% | One-sided 100.0%
**Band 8-7:** Win 1.0%, Lose 99.0% | One-sided 100.0%
**Band 6-4:** Win 14.2%, Lose 79.4%, Flee 0.6%, Standoff 5.8% | Neither 4.3%, One-sided 80.4%, Both 15.3%
**Band 3-2:** Win 45.2%, Lose 4.5%, Flee 48.5%, Standoff 1.9% | Neither 49.4%, One-sided 46.9%, Both 3.7%
**Band 1-0:** Win 46.9%, Lose 14.8%, Flee 28.1%, Standoff 10.2% | Neither 34.7%, One-sided 56.4%, Both 9.0%

*Inference:* Lower bands (weaker characters) face overwhelming one-sided losses. Higher bands see more balanced fights and fleeing.

---

## 2. Tier vs Band Crosstab + Weapon Levels

```
Tier | 10-9  | 8-7   | 6-4   | 3-2   | 1-0   |
-----|-------|-------|-------|-------|-------|
 0   | 0.00% | 0.00% | 0.00% | 0.00% | 0.66%
 1   | 0.00% | 0.00% | 0.00% | 0.00% | 0.89%
 2   | 0.00% | 0.00% | 0.00% | 1.60% | 0.00%
 3   | 0.00% | 0.00% | 0.00% | 2.28% | 0.00%
 4   | 0.00% | 0.00% | 3.69% | 0.02% | 0.00%
 5   | 0.00% | 0.00% | 0.10% | 0.04% | 5.78%
 6   | 0.00% | 0.00% | 8.81% | 0.05% | 0.41%
 7   | 0.00% |11.70% | 1.49% | 0.07% | 0.72%
 8   | 0.00% |16.35% | 2.28% | 0.10% | 1.09%
 9   |13.45% | 5.54% | 2.78% | 0.15% | 1.43%
10   |10.30% | 4.53% | 2.32% | 0.15% | 1.21%
```

**Weapon levels in band 1-0:** 6,682 characters with weapons (54.7% of band), all showing `Level undefined`.

*Inference:* Weapon level is not being stored/displayed properly in the trace. The weapon boost is applied to strength but the level field itself is undefined.

---

## 3. Carried Tags Between Chain Steps

**Code that manages carried tags (src/core/chain.js:158-167):**
```javascript
function updateCarriedTags(currentCarried, emittedTags) {
  const carried = new Set(currentCarried);
  
  for (const tag of emittedTags) {
    carried.add(tag);
  }
  
  return Array.from(carried);
}
```

**Called in chain execution (src/core/chain.js:80):**
```javascript
// Update carried tags
carriedTags = updateCarriedTags(carriedTags, outcome.emittedTags);
```

**Initialization (src/core/chain.js:52):**
```javascript
let carriedTags = [];
```

**Can rematch_rival's requirement be satisfied?**

**YES.** 

Rematch_rival requires `carried: ["rival"]` (data/scenarios/basic.json).

**Satisfying sequence:**
1. Scenario 1: street_fight, urban_brawl, demon_duel, challenge_god, or cosmic_battle (emit "rival")
2. Scenario 2: any scenario (rival persists)
3. Scenario 3: rematch_rival (consumes "rival")

*Evidence:* In 100k runs, rematch_rival was selected 1,170 times (0.39% of slots = 3.9% of characters had a valid sequence).

---

## 4. Wounded -1.0 Stat Penalty

**Code (src/core/stats.js:99-103):**
```javascript
export function applyWoundedEffect(stat, carriedTags) {
  if (carriedTags.includes('wounded')) {
    return Math.max(0, stat - 1.0);
  }
  return stat;
}
```

**Applied in getEffectiveStats (src/core/stats.js:114-120):**
```javascript
export function getEffectiveStats(str, spd, dur, carriedTags) {
  return {
    str: applyWoundedEffect(str, carriedTags),
    spd: applyWoundedEffect(spd, carriedTags),
    dur: applyWoundedEffect(dur, carriedTags)
  };
}
```

**Used in scenario execution:**
- executeCheck (scenario.js:170): `getEffectiveStats(..., carriedTags)`
- executeContest (scenario.js:228): `getEffectiveStats(..., carriedTags)`

**Answer:** YES, the engine applies the wounded -1.0 penalty to all three stats (str, spd, dur) when the "wounded" tag is carried.

---

## 5. Scenario Selection Counting Method

**Counting code (sim/run.js:137-139):**
```javascript
// Collect scenario distribution (M1a)
for (const scenario of result.scenarios) {
  const scenarioId = scenario.scenarioId;
  stats.scenarios[scenarioId] = (stats.scenarios[scenarioId] || 0) + 1;
```

**Method:** PER SLOT (not per character).
- Each character has 3 scenarios (config.chainLength)
- 100,000 characters × 3 = 300,000 slots
- Each scenario.scenarioId is counted once per slot

**Full scenario list (from 100k run, per slot %):**
1. urban_brawl: 18.15%
2. do_nothing: 16.48%
3. heist: 14.03%
4. street_fight: 11.60%
5. demon_duel: 10.20%
6. assassination: 8.12%
7. ambush: 7.43%
8. cosmic_battle: 5.58%
9. reality_break: 4.28%
10. challenge_god: 2.06%
11. infiltrate_fortress: 1.68%
12. **rematch_rival: 0.39%** ← Requires "rival" carried tag

**Never selected:** None. All 12 scenarios were selected at least once.

---

## 6. Trait Effects on do_nothing

**Source:** Scenario weightMods (NOT traits.json scenarioMods).

**Code (data/scenarios/basic.json:12-15):**
```json
"weightMods": [
  { "if": "trait:ambitious", "mult": 0.3 },
  { "if": "trait:bloodthirsty", "mult": 0.2 }
]
```

**traits.json for all traits:**
```json
"scenarioMods": []
```

All traits have empty `scenarioMods` arrays in traits.json. Do_nothing's trait-based weight modifications come from the scenario's own `weightMods` array, checked against the character's trait.

---

## 7. Git Diff Status

**Command:** `git diff --stat data/ src/`

**Modified files:**
```
data/pools.json           |   2 +-
data/powers.json          |  73 ++++++++++-
data/races.json           | 313 ++++++++++++++++++++++++++++++++++++++--------
data/scenarios/basic.json |  84 +++++++++++--
data/tags.json            |  38 +++++-
data/traits.json          |  27 +++-
data/weapons.json         |   2 +-
src/core/validate.js      |  99 +++++++++++++--
8 files changed, 560 insertions(+), 78 deletions(-)
```

**Summary:**
- **data/**: 6 files modified (pools, powers, races, scenarios, tags, traits, weapons)
- **src/**: 1 file modified (validate.js - weightMods validation added)
- **Total:** 560 insertions, 78 deletions

All data/ modifications show in git diff, contradicting any claim of "pre-existing" state. These are working tree changes not yet committed.
