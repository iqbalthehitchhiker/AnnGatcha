# Trait and Scenario Modifier Implementation Report
**Date:** 2026-10-10  
**Scope:** Read-only inspection of trait and scenario weight modification system

---

## System Overview

The game implements a two-tier weight modification system for scenarios:

1. **Trait-level scenarioMods** (defined in `traits.json`) — Currently unused
2. **Scenario-level weightMods** (defined in scenario definitions) — Currently unused but fully implemented

Both systems are implemented in the codebase but have **zero active content** using them.

---

## Architecture

### 1. Trait Selection Stage

**Location:** `src/core/run.js` (lines 187-221)

**Process:**
1. Loads base trait weights from `data.traits[].weight`
2. Applies race-specific multipliers from `race.traitWeights` (optional)
3. Performs weighted pick to select character's trait
4. Trait is stored in `character.trait`

**Example from SRS:**
```javascript
// Race can modify trait weights
"traitWeights": { "ambitious": 1.5 }  // Dragons 1.5x more likely to be ambitious
```

**Current State:**
- ✓ Implementation complete and functional
- ✗ Only 1 trait exists (`brave`)
- ✗ No races use `traitWeights` (all have empty objects)

---

### 2. Scenario-Level Weight Modifications

**Location:** `src/core/scenario.js` (lines 384-412)

**Function:** `applyScenarioWeightMods(scenario, baseWeight, character, characterTags, carriedTags)`

**Supported Condition Types:**
```javascript
"weightMods": [
  { "if": "trait:ambitious", "mult": 1.5 },     // Character has specific trait
  { "if": "tag:fire", "mult": 2.0 },            // Character has tag (race/power/weapon)
  { "if": "carried:rival", "mult": 3.0 },       // Character has carried tag
  { "if": "race:dragon", "mult": 0.5 }          // Character is specific race
]
```

**Implementation:**
- Parses `"type:value"` condition format
- Checks if condition matches character state
- Multiplies scenario weight by `mult` if condition matches
- Multiple mods can stack multiplicatively

**Current State:**
- ✓ Implementation complete and functional
- ✗ All 12 scenarios have `"weightMods": []` (empty arrays)

---

### 3. Trait scenarioMods (Trait-Driven Scenario Weights)

**Location:** `data/traits.json` schema

**Expected Schema (per SRS section 10):**
```javascript
"ambitious": {
  "name": "Ambitious",
  "weight": 10,
  "scenarioMods": [
    { "scenario": "do_nothing", "mult": 0.3 }  // Ambitious chars avoid do_nothing
  ]
}
```

**Expected Behavior:**
- Traits can modify specific scenario weights by name
- Used to express personality/behavioral tendencies
- Example: ambitious characters are less likely to do nothing, more likely to seek challenges

**Current State:**
- ✗ Schema field exists but is **not implemented** in codebase
- ✗ No code in `chain.js` or `scenario.js` processes `trait.scenarioMods`
- ✗ Current trait (`brave`) has empty `scenarioMods: []`

**Status:** **DESIGN GAP** — The SRS describes this feature, but the implementation uses scenario-level `weightMods` with trait conditions instead.

---

## Implementation Status

| Feature | Schema | Code | Content | Status |
|---------|--------|------|---------|--------|
| Trait selection with race mods | ✓ | ✓ | ✗ | Implemented, no content |
| Scenario weightMods (trait condition) | ✓ | ✓ | ✗ | Implemented, no content |
| Scenario weightMods (tag condition) | ✓ | ✓ | ✗ | Implemented, no content |
| Scenario weightMods (carried condition) | ✓ | ✓ | ✗ | Implemented, no content |
| Scenario weightMods (race condition) | ✓ | ✓ | ✗ | Implemented, no content |
| Trait scenarioMods | ✓ | ✗ | ✗ | **Not implemented** |

---

## Functional vs. Proposed Design

### What's Implemented (Scenario-Level)

**Scenario definitions control their own weight mods:**

```javascript
// In scenarios/basic.json
"do_nothing": {
  "weight": 5,
  "weightMods": [
    { "if": "trait:ambitious", "mult": 0.3 }  // Scenario checks for trait
  ]
}
```

**Pros:**
- Scenario-centric: all behavior in one place
- Flexible: can use trait, tag, race, carried conditions
- Already implemented and working

**Cons:**
- Scattered: to change ambitious behavior, must edit multiple scenarios
- Verbose: every scenario that cares about ambitious must list it

---

### What SRS Describes (Trait-Level)

**Traits control which scenarios they affect:**

```javascript
// In traits.json
"ambitious": {
  "scenarioMods": [
    { "scenario": "do_nothing", "mult": 0.3 }  // Trait lists scenarios it affects
  ]
}
```

**Pros:**
- Trait-centric: all ambitious behavior in one place
- DRY: define once in trait, applies everywhere

**Cons:**
- Not implemented in current codebase
- Would require additional code in `chain.js` to merge trait mods into scenario weights

---

## Code Flow Analysis

### Current Scenario Selection Flow

**Location:** `src/core/chain.js` (lines 111-147)

```
1. Filter scenarios by band
2. Filter scenarios by requires (tags, notTags, carried, race conditions)
3. For each valid scenario:
   a. Start with scenario.weight
   b. Apply scenario.weightMods (checks trait, tag, carried, race)
   c. Add to valid scenario pool
4. Perform weighted pick
5. Execute selected scenario
```

**Trait is used:**
- ✓ In step 3b via `if: "trait:X"` conditions in scenario weightMods
- ✗ NOT via trait.scenarioMods (not implemented)

---

## Validation Coverage

### Validator Checks (src/core/validate.js)

**What's validated:**
- ✓ Trait weights are positive (line 109)
- ✓ Scenario weightMods reference valid tags (line 725-729)
- ✗ Trait scenarioMods are **not validated** (field ignored)

**Missing Validation:**
- Trait scenarioMods would need validation for:
  - Referenced scenario IDs exist
  - Multipliers are positive numbers
  - No circular dependencies

---

## Current Content State

### traits.json (1 entry)

```json
{
  "brave": {
    "name": "Brave",
    "weight": 1,
    "scenarioMods": []
  }
}
```

**Observations:**
- Empty scenarioMods array (matches implementation: trait mods aren't used)
- No mechanical effect whatsoever
- Trait selection happens, but trait value is unused in scenario selection

---

### scenarios/basic.json (12 entries)

**All scenarios have:**
```json
"weightMods": []
```

**No scenario uses trait-based weight modification.**

---

### races.json (3 entries)

**All races have:**
```json
"traitWeights": {}
```

**No race modifies trait selection weights.**

---

## Usage Examples (From SRS)

### SRS Section 10 Example

```javascript
// traits.json
"ambitious": { 
  "name": "Ambitious", 
  "weight": 10, 
  "scenarioMods": [
    { "scenario": "do_nothing", "mult": 0.3 }
  ]
}
```

**This format is NOT implemented.** The actual implementation would be:

```javascript
// scenarios/basic.json
"do_nothing": {
  "weightMods": [
    { "if": "trait:ambitious", "mult": 0.3 }
  ]
}
```

---

### SRS Section 17 Example (Dragon Race)

```javascript
"traitWeights": { "ambitious": 1.5 }
```

**This format IS implemented** but no race uses it.

---

## Test Coverage

### Test Fixtures

All 14 test fixtures under `test/fixtures/` have:
```json
"traits": { "brave": { "name": "B", "weight": 1, "scenarioMods": [] } }
```

**No test exercises:**
- ✗ Non-empty trait scenarioMods
- ✗ Race traitWeights
- ✗ Scenario weightMods with trait conditions
- ✗ Scenario weightMods with any conditions (tag, race, carried)

**Test Gap:** The weight modification system has zero test coverage for actual usage, only structural validation.

---

## Recommendations

### Option A: Keep Current Implementation (Scenario-Centric)

**Action:** Remove `scenarioMods` field from trait schema since it's not used.

**Rationale:**
- Current implementation is simpler and already working
- Scenario-level weightMods are more flexible
- No migration needed

**Content Creation:**
- Add weightMods to scenarios that care about traits
- Example: `do_nothing` checks for `trait:ambitious` and `trait:cautious`

---

### Option B: Implement Trait scenarioMods (Trait-Centric)

**Action:** Add code to merge `trait.scenarioMods` into scenario weights.

**Rationale:**
- Matches SRS description
- Better DRY for trait-based behavior
- Trait definition becomes single source of truth

**Implementation:**
1. In `chain.js`, after filtering scenarios, look up `data.traits[character.trait].scenarioMods`
2. For each mod targeting a scenario in the valid pool, multiply its weight
3. Then apply scenario-level weightMods (scenario weightMods could override trait mods)

**Migration:**
- Add validation for trait.scenarioMods
- Add tests for trait-based scenario weight modification
- Document precedence: does scenario weightMod or trait scenarioMod apply first?

---

### Option C: Hybrid (Both Systems)

**Action:** Implement trait scenarioMods AND keep scenario weightMods.

**Rationale:**
- Maximum flexibility
- Traits express personality
- Scenarios express specific requirements

**Precedence Order:**
1. Base scenario weight
2. Apply trait scenarioMods (trait-level personality)
3. Apply scenario weightMods (scenario-specific overrides)
4. Final weight used for pick

---

## Design Questions for Human Decision

### 1. Should trait.scenarioMods be implemented?

**Current:** Field exists in schema but is unused code  
**SRS:** Describes this feature as intended design  
**Decision needed:** Implement to match SRS, or remove from schema?

---

### 2. If implemented, what's the precedence?

**Option 1:** Trait mods first, then scenario mods (trait is personality, scenario is context)  
**Option 2:** Scenario mods first, then trait mods (scenario has priority)  
**Option 3:** Only one system active (remove the other)

---

### 3. Should content use traits for behavior?

**Example:** Ambitious character

**Via trait.scenarioMods (not implemented):**
```json
"ambitious": {
  "scenarioMods": [
    { "scenario": "do_nothing", "mult": 0.3 },
    { "scenario": "street_fight", "mult": 1.5 },
    { "scenario": "challenge_god", "mult": 2.0 }
  ]
}
```

**Via scenario.weightMods (implemented):**
```json
"do_nothing": { "weightMods": [{ "if": "trait:ambitious", "mult": 0.3 }] },
"street_fight": { "weightMods": [{ "if": "trait:ambitious", "mult": 1.5 }] },
"challenge_god": { "weightMods": [{ "if": "trait:ambitious", "mult": 2.0 }] }
```

Which approach is preferred for content authoring?

---

## Summary

**Implementation Status:**
- ✅ Trait selection with race modifiers (functional, no content)
- ✅ Scenario weightMods with 4 condition types (functional, no content)
- ❌ Trait scenarioMods (described in SRS, not implemented)

**Content Status:**
- 1 trait with no mechanical effect
- 0 race trait weight modifications
- 0 scenario weight modifications in use
- 100% of the weight modification system is unused

**Blocker:**
- Design decision needed: implement trait scenarioMods per SRS, or formalize scenario weightMods as the actual design

**Next Steps:**
1. Decide on trait scenarioMods implementation (yes/no)
2. If yes: implement, validate, test
3. If no: remove field from schema, update SRS
4. Create trait content batch with meaningful scenario mods (per chosen design)
5. Add scenario weightMods to existing scenarios

---

## Code References

| File | Lines | Purpose |
|------|-------|---------|
| `src/core/run.js` | 187-221 | Trait selection with race mods |
| `src/core/scenario.js` | 384-412 | Scenario weightMods application |
| `src/core/chain.js` | 111-147 | Scenario selection flow |
| `src/core/validate.js` | 109 | Trait weight validation |
| `src/core/validate.js` | 725-729 | Scenario weightMod tag validation |
| `data/traits.json` | All | Trait definitions |
| `data/scenarios/basic.json` | All | Scenario definitions |

---

**Report Complete: No files modified.**
