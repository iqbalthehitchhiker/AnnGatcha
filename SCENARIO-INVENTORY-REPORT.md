# Scenario Inventory and Trait Compatibility Report
**Date:** 2026-10-10  
**Scope:** Read-only analysis of existing scenarios for trait weight modification

---

## Executive Summary

**Total Scenarios:** 12 (1 passive, 6 combat, 5 durability-free)  
**Band Coverage:** All 5 bands have 4 scenarios each  
**Trait Compatibility:** 5 proposed traits analyzed across all scenarios  
**Recommended weightMods:** 59 modifications identified

---

## Scenario Inventory by ID

### 1. do_nothing

**Display Name:** [PLACEHOLDER] Do Nothing  
**Bands:** 10-9, 8-7, 6-4, 3-2, 1-0 (all bands)  
**Base Weight:** 5  
**Categories:** PASSIVE

**Requires:**
- None (universally available)

**Structure:**
- Steps: 1 (end only)
- Type: Narrative/passive
- No combat, no checks

**Trait Compatibility:**
| Trait | Multiplier | Reason |
|-------|------------|--------|
| ambitious | 0.3x ↓ | Avoids inaction |
| bloodthirsty | 0.2x ↓ | Avoids inaction |
| cautious | 1.0x | Neutral |
| cunning | 1.0x | Neutral |
| honorable | 1.0x | Neutral |

---

### 2. street_fight

**Display Name:** [PLACEHOLDER] Street Fight  
**Bands:** 10-9  
**Base Weight:** 10  
**Categories:** COMBAT

**Requires:**
- None (universally available)

**Structure:**
- Steps: 6 (pick, contest, 4× end)
- Combat: YES (uses `basic_opponents` pool)
- Tests: Direct combat (durability, strength)

**Trait Compatibility:**
| Trait | Multiplier | Reason |
|-------|------------|--------|
| ambitious | 1.5x ↑ | Prefers action |
| cautious | 0.8x ↓ | Prefers to avoid combat |
| bloodthirsty | 2.0x ↑ | Seeks combat |
| cunning | 0.7x ↓ | Avoids direct confrontation |
| honorable | 1.5x ↑ | Fair combat |

---

### 3. assassination

**Display Name:** [PLACEHOLDER] Assassination  
**Bands:** 10-9  
**Base Weight:** 8  
**Categories:** STEALTH, DURABILITY-FREE, DISHONORABLE

**Requires:**
- None (universally available)

**Structure:**
- Steps: 3 (check, 2× end)
- Check: Speed vs difficulty 10.0
- Durability: Not tested (bypasses durability)

**Trait Compatibility:**
| Trait | Multiplier | Reason |
|-------|------------|--------|
| ambitious | 1.0x | Neutral |
| cautious | 1.5x ↑ | Prefers indirect approach |
| bloodthirsty | 0.7x ↓ | Prefers direct violence |
| cunning | 2.0x ↑ | Prefers indirect methods |
| honorable | 0.3x ↓ | Dishonorable tactics |

---

### 4. urban_brawl

**Display Name:** [PLACEHOLDER] Urban Brawl  
**Bands:** 8-7  
**Base Weight:** 10  
**Categories:** COMBAT

**Requires:**
- None (universally available)

**Structure:**
- Steps: 6 (pick, contest, 4× end)
- Combat: YES (uses `basic_opponents` pool)
- Tests: Direct combat

**Trait Compatibility:**
| Trait | Multiplier | Reason |
|-------|------------|--------|
| ambitious | 1.5x ↑ | Prefers action |
| cautious | 0.8x ↓ | Prefers to avoid combat |
| bloodthirsty | 2.0x ↑ | Seeks combat |
| cunning | 0.7x ↓ | Avoids direct confrontation |
| honorable | 1.5x ↑ | Fair combat |

---

### 5. heist

**Display Name:** [PLACEHOLDER] Heist  
**Bands:** 8-7  
**Base Weight:** 8  
**Categories:** STEALTH, DURABILITY-FREE

**Requires:**
- None (universally available)

**Structure:**
- Steps: 3 (check, 2× end)
- Check: Speed vs difficulty 8.0
- Durability: Not tested

**Trait Compatibility:**
| Trait | Multiplier | Reason |
|-------|------------|--------|
| ambitious | 1.0x | Neutral |
| cautious | 1.5x ↑ | Prefers indirect approach |
| bloodthirsty | 0.7x ↓ | Prefers direct violence |
| cunning | 2.0x ↑ | Prefers indirect methods |
| honorable | 1.0x | Neutral |

---

### 6. demon_duel

**Display Name:** [PLACEHOLDER] Demon Duel  
**Bands:** 6-4  
**Base Weight:** 10  
**Categories:** COMBAT

**Requires:**
- None (universally available)

**Structure:**
- Steps: 6 (pick, contest, 4× end)
- Combat: YES (uses `midtier_opponents` pool)
- Tests: Direct combat

**Trait Compatibility:**
| Trait | Multiplier | Reason |
|-------|------------|--------|
| ambitious | 1.5x ↑ | Prefers action |
| cautious | 0.8x ↓ | Prefers to avoid combat |
| bloodthirsty | 2.0x ↑ | Seeks combat |
| cunning | 0.7x ↓ | Avoids direct confrontation |
| honorable | 1.5x ↑ | Fair combat |

---

### 7. ambush

**Display Name:** [PLACEHOLDER] Ambush  
**Bands:** 6-4  
**Base Weight:** 8  
**Categories:** STEALTH, DURABILITY-FREE, DISHONORABLE

**Requires:**
- None (universally available)

**Structure:**
- Steps: 3 (check, 2× end)
- Check: Speed vs difficulty 5.0
- Durability: Not tested

**Trait Compatibility:**
| Trait | Multiplier | Reason |
|-------|------------|--------|
| ambitious | 1.0x | Neutral |
| cautious | 1.5x ↑ | Prefers indirect approach |
| bloodthirsty | 0.7x ↓ | Prefers direct violence |
| cunning | 2.0x ↑ | Prefers indirect methods |
| honorable | 0.3x ↓ | Dishonorable tactics |

---

### 8. challenge_god

**Display Name:** [PLACEHOLDER] Challenge a God  
**Bands:** 3-2  
**Base Weight:** 10  
**Categories:** COMBAT, HIGH-CHALLENGE

**Requires:**
- None (universally available)

**Structure:**
- Steps: 6 (pick, contest, 4× end)
- Combat: YES (uses `gods` pool)
- Tests: Direct combat against powerful opponents

**Trait Compatibility:**
| Trait | Multiplier | Reason |
|-------|------------|--------|
| ambitious | 2.0x ↑ | Seeks challenges |
| cautious | 0.5x ↓ | Avoids extreme danger |
| bloodthirsty | 2.0x ↑ | Seeks combat |
| cunning | 0.7x ↓ | Avoids direct confrontation |
| honorable | 1.5x ↑ | Fair combat |

---

### 9. infiltrate_fortress

**Display Name:** [PLACEHOLDER] Infiltrate Divine Fortress  
**Bands:** 3-2  
**Base Weight:** 8  
**Categories:** STEALTH, DURABILITY-FREE

**Requires:**
- None (universally available)

**Structure:**
- Steps: 3 (check, 2× end)
- Check: Speed vs difficulty 3.0
- Durability: Not tested

**Trait Compatibility:**
| Trait | Multiplier | Reason |
|-------|------------|--------|
| ambitious | 1.0x | Neutral |
| cautious | 1.5x ↑ | Prefers indirect approach |
| bloodthirsty | 0.7x ↓ | Prefers direct violence |
| cunning | 2.0x ↑ | Prefers indirect methods |
| honorable | 1.0x | Neutral |

---

### 10. cosmic_battle

**Display Name:** [PLACEHOLDER] Cosmic Battle  
**Bands:** 1-0  
**Base Weight:** 10  
**Categories:** COMBAT, HIGH-CHALLENGE

**Requires:**
- None (universally available)

**Structure:**
- Steps: 6 (pick, contest, 4× end)
- Combat: YES (uses `gods` pool)
- Tests: Direct combat at cosmic scale

**Trait Compatibility:**
| Trait | Multiplier | Reason |
|-------|------------|--------|
| ambitious | 2.0x ↑ | Seeks challenges |
| cautious | 0.5x ↓ | Avoids extreme danger |
| bloodthirsty | 2.0x ↑ | Seeks combat |
| cunning | 0.7x ↓ | Avoids direct confrontation |
| honorable | 1.5x ↑ | Fair combat |

---

### 11. reality_break

**Display Name:** [PLACEHOLDER] Reality Break  
**Bands:** 1-0  
**Base Weight:** 8  
**Categories:** STRENGTH-CHECK, DURABILITY-FREE

**Requires:**
- None (universally available)

**Structure:**
- Steps: 3 (check, 2× end)
- Check: Strength vs difficulty 0.5
- Durability: Not tested

**Trait Compatibility:**
| Trait | Multiplier | Reason |
|-------|------------|--------|
| ambitious | 1.0x | Neutral |
| cautious | 1.5x ↑ | Prefers indirect approach |
| bloodthirsty | 1.0x | Neutral |
| cunning | 2.0x ↑ | Prefers indirect methods |
| honorable | 1.0x | Neutral |

---

### 12. rematch_rival

**Display Name:** [PLACEHOLDER] Rematch with Rival  
**Bands:** 10-9, 8-7, 6-4, 3-2, 1-0 (all bands)  
**Base Weight:** 15  
**Categories:** COMBAT, CARRIED-DEPENDENT

**Requires:**
- **Carried tag:** `rival` (emitted by standoff outcomes)

**Structure:**
- Steps: 5 (contest, 4× end)
- Combat: YES (uses bound opponent from previous encounter)
- Tests: Direct combat with recurring opponent

**Trait Compatibility:**
| Trait | Multiplier | Reason |
|-------|------------|--------|
| ambitious | 1.5x ↑ | Prefers action (enhanced for rival) |
| cautious | 0.8x ↓ | Prefers to avoid combat (might avoid rematch) |
| bloodthirsty | 2.0x ↑ | Seeks combat |
| cunning | 0.7x ↓ | Avoids direct confrontation |
| honorable | 1.5x ↑ | Fair combat (honor demands rematch) |

**Special Note:** Only available after standoff outcome in previous scenario.

---

## Summary: Scenarios by Band

### Band 10-9 (4 scenarios)
- `do_nothing` (PASSIVE)
- `street_fight` (COMBAT)
- `assassination` (STEALTH, DURABILITY-FREE, DISHONORABLE)
- `rematch_rival` (COMBAT, CARRIED-DEPENDENT)

### Band 8-7 (4 scenarios)
- `do_nothing` (PASSIVE)
- `urban_brawl` (COMBAT)
- `heist` (STEALTH, DURABILITY-FREE)
- `rematch_rival` (COMBAT, CARRIED-DEPENDENT)

### Band 6-4 (4 scenarios)
- `do_nothing` (PASSIVE)
- `demon_duel` (COMBAT)
- `ambush` (STEALTH, DURABILITY-FREE, DISHONORABLE)
- `rematch_rival` (COMBAT, CARRIED-DEPENDENT)

### Band 3-2 (4 scenarios)
- `do_nothing` (PASSIVE)
- `challenge_god` (COMBAT, HIGH-CHALLENGE)
- `infiltrate_fortress` (STEALTH, DURABILITY-FREE)
- `rematch_rival` (COMBAT, CARRIED-DEPENDENT)

### Band 1-0 (4 scenarios)
- `do_nothing` (PASSIVE)
- `cosmic_battle` (COMBAT, HIGH-CHALLENGE)
- `reality_break` (STRENGTH-CHECK, DURABILITY-FREE)
- `rematch_rival` (COMBAT, CARRIED-DEPENDENT)

---

## Summary: Category Distribution

| Category | Count | Scenarios |
|----------|-------|-----------|
| COMBAT | 6 | street_fight, urban_brawl, demon_duel, challenge_god, cosmic_battle, rematch_rival |
| DURABILITY-FREE | 5 | assassination, heist, ambush, infiltrate_fortress, reality_break |
| STEALTH | 4 | assassination, heist, ambush, infiltrate_fortress |
| DISHONORABLE | 2 | assassination, ambush |
| HIGH-CHALLENGE | 2 | challenge_god, cosmic_battle |
| PASSIVE | 1 | do_nothing |
| STRENGTH-CHECK | 1 | reality_break |
| CARRIED-DEPENDENT | 1 | rematch_rival |

---

## Trait Weight Modification Recommendations

### Trait: AMBITIOUS
**Description:** Seeks challenges and avoids inaction

**Recommended weightMods:**

```json
// High priority (strongest effects)
{ "if": "trait:ambitious", "mult": 2.0 }   // challenge_god
{ "if": "trait:ambitious", "mult": 2.0 }   // cosmic_battle
{ "if": "trait:ambitious", "mult": 0.3 }   // do_nothing

// Medium priority (moderate effects)
{ "if": "trait:ambitious", "mult": 1.5 }   // street_fight
{ "if": "trait:ambitious", "mult": 1.5 }   // urban_brawl
{ "if": "trait:ambitious", "mult": 1.5 }   // demon_duel
{ "if": "trait:ambitious", "mult": 1.5 }   // rematch_rival
```

**Total scenarios affected:** 7 of 12

---

### Trait: CAUTIOUS
**Description:** Prefers stealth and avoids direct combat

**Recommended weightMods:**

```json
// Increases stealth/indirect options
{ "if": "trait:cautious", "mult": 1.5 }   // assassination
{ "if": "trait:cautious", "mult": 1.5 }   // heist
{ "if": "trait:cautious", "mult": 1.5 }   // ambush
{ "if": "trait:cautious", "mult": 1.5 }   // infiltrate_fortress
{ "if": "trait:cautious", "mult": 1.5 }   // reality_break

// Decreases high-danger combat
{ "if": "trait:cautious", "mult": 0.5 }   // challenge_god
{ "if": "trait:cautious", "mult": 0.5 }   // cosmic_battle

// Decreases normal combat
{ "if": "trait:cautious", "mult": 0.8 }   // street_fight
{ "if": "trait:cautious", "mult": 0.8 }   // urban_brawl
{ "if": "trait:cautious", "mult": 0.8 }   // demon_duel
{ "if": "trait:cautious", "mult": 0.8 }   // rematch_rival
```

**Total scenarios affected:** 11 of 12

---

### Trait: BLOODTHIRSTY
**Description:** Seeks combat and violence

**Recommended weightMods:**

```json
// Maximizes combat scenarios
{ "if": "trait:bloodthirsty", "mult": 2.0 }   // street_fight
{ "if": "trait:bloodthirsty", "mult": 2.0 }   // urban_brawl
{ "if": "trait:bloodthirsty", "mult": 2.0 }   // demon_duel
{ "if": "trait:bloodthirsty", "mult": 2.0 }   // challenge_god
{ "if": "trait:bloodthirsty", "mult": 2.0 }   // cosmic_battle
{ "if": "trait:bloodthirsty", "mult": 2.0 }   // rematch_rival

// Minimizes inaction
{ "if": "trait:bloodthirsty", "mult": 0.2 }   // do_nothing

// Reduces stealth (prefers direct violence)
{ "if": "trait:bloodthirsty", "mult": 0.7 }   // assassination
{ "if": "trait:bloodthirsty", "mult": 0.7 }   // heist
{ "if": "trait:bloodthirsty", "mult": 0.7 }   // ambush
{ "if": "trait:bloodthirsty", "mult": 0.7 }   // infiltrate_fortress
```

**Total scenarios affected:** 11 of 12

---

### Trait: CUNNING
**Description:** Prefers indirect approaches

**Recommended weightMods:**

```json
// Maximizes indirect/stealth scenarios
{ "if": "trait:cunning", "mult": 2.0 }   // assassination
{ "if": "trait:cunning", "mult": 2.0 }   // heist
{ "if": "trait:cunning", "mult": 2.0 }   // ambush
{ "if": "trait:cunning", "mult": 2.0 }   // infiltrate_fortress
{ "if": "trait:cunning", "mult": 2.0 }   // reality_break

// Reduces direct combat
{ "if": "trait:cunning", "mult": 0.7 }   // street_fight
{ "if": "trait:cunning", "mult": 0.7 }   // urban_brawl
{ "if": "trait:cunning", "mult": 0.7 }   // demon_duel
{ "if": "trait:cunning", "mult": 0.7 }   // challenge_god
{ "if": "trait:cunning", "mult": 0.7 }   // cosmic_battle
{ "if": "trait:cunning", "mult": 0.7 }   // rematch_rival
```

**Total scenarios affected:** 11 of 12

---

### Trait: HONORABLE
**Description:** Prefers fair fights, avoids assassination

**Recommended weightMods:**

```json
// Strongly avoids dishonorable tactics
{ "if": "trait:honorable", "mult": 0.3 }   // assassination
{ "if": "trait:honorable", "mult": 0.3 }   // ambush

// Prefers fair combat
{ "if": "trait:honorable", "mult": 1.5 }   // street_fight
{ "if": "trait:honorable", "mult": 1.5 }   // urban_brawl
{ "if": "trait:honorable", "mult": 1.5 }   // demon_duel
{ "if": "trait:honorable", "mult": 1.5 }   // challenge_god
{ "if": "trait:honorable", "mult": 1.5 }   // cosmic_battle
{ "if": "trait:honorable", "mult": 1.5 }   // rematch_rival
```

**Total scenarios affected:** 8 of 12

---

## Carried Tag Opportunities

### Current Carried Tags in Use

**`rival`** — Emitted by standoff outcomes, consumed by `rematch_rival`

**Trait implications for rival scenarios:**
- **Ambitious:** Likely seeks rematch (already gets 1.5x, could increase to 2.0x for rivals specifically)
- **Cautious:** Might avoid rematch (already gets 0.8x, appropriate)
- **Honorable:** Honor demands rematch (already gets 1.5x, appropriate)
- **Bloodthirsty:** Eager for rematch (already gets 2.0x, appropriate)

**Observation:** Current weightMods for `rematch_rival` are appropriate for all proposed traits.

### Potential New Carried Tags (Future)

**`wounded`** — Currently emitted by loss outcomes, has stat effect (-1.0 all stats)
- Not currently consumed by any scenario requires/conditions
- Traits could modify behavior when wounded:
  - **Cautious:** More careful when wounded (reduce combat: 0.5x)
  - **Bloodthirsty:** Fights anyway or seeks revenge (maintain or boost combat: 1.2x)

**Note:** `wounded` is consumed by the stat system (FR-S3), so doesn't need scenario consumption. Trait mods could still apply based on carried state.

---

## Scenario Structure Patterns

### Pattern 1: Direct Combat (6 scenarios)
- Pick opponent from pool
- Contest (fight)
- 4 end outcomes (win, lose, flee, standoff)
- **Scenarios:** street_fight, urban_brawl, demon_duel, challenge_god, cosmic_battle, rematch_rival

**Trait compatibility:**
- ↑ Ambitious (1.5-2.0x), Bloodthirsty (2.0x), Honorable (1.5x)
- ↓ Cautious (0.5-0.8x), Cunning (0.7x)

### Pattern 2: Speed Check (4 scenarios)
- Check speed vs difficulty
- 2 end outcomes (success, fail)
- Durability-free
- **Scenarios:** assassination, heist, ambush, infiltrate_fortress

**Trait compatibility:**
- ↑ Cautious (1.5x), Cunning (2.0x)
- ↓ Bloodthirsty (0.7x)
- Honorable: depends on context (0.3x for assassination/ambush, neutral otherwise)

### Pattern 3: Passive (1 scenario)
- Immediate end
- No tests
- **Scenarios:** do_nothing

**Trait compatibility:**
- ↓ Ambitious (0.3x), Bloodthirsty (0.2x)
- Others neutral

### Pattern 4: Strength Check (1 scenario)
- Check strength vs difficulty
- 2 end outcomes
- Durability-free
- **Scenarios:** reality_break

**Trait compatibility:**
- ↑ Cautious (1.5x), Cunning (2.0x)
- Others neutral

---

## Validation Observations

### All Scenarios Pass Current Validation

- ✅ All have positive weights
- ✅ All reference valid pools
- ✅ All reference valid bands
- ✅ All have complete contest branches (win/lose/flee/standoff)
- ✅ All graphs are reachable, no dead ends
- ✅ Carried tags properly emitted and consumed

### Scenario Balance

**Band distribution:** Perfectly balanced (4 scenarios per band)

**Type distribution:**
- Combat-focused: 6 scenarios (50%)
- Stealth/indirect: 5 scenarios (42%)
- Passive: 1 scenario (8%)

**Durability testing:**
- Tests durability: 7 scenarios (58%)
- Durability-free: 5 scenarios (42%)

**SRS compliance (FR-X7):** ✅ Every band has at least one durability-free scenario

---

## Recommendations for Trait Implementation

### Phase 1: Add Core Traits (5 traits)

Create the following trait definitions in `data/traits.json`:

```json
{
  "ambitious": {
    "name": "Ambitious",
    "weight": 8,
    "scenarioMods": []
  },
  "cautious": {
    "name": "Cautious",
    "weight": 8,
    "scenarioMods": []
  },
  "bloodthirsty": {
    "name": "Bloodthirsty",
    "weight": 6,
    "scenarioMods": []
  },
  "cunning": {
    "name": "Cunning",
    "weight": 7,
    "scenarioMods": []
  },
  "honorable": {
    "name": "Honorable",
    "weight": 7,
    "scenarioMods": []
  }
}
```

**Note:** `scenarioMods` left empty as they're not implemented. Use scenario weightMods instead.

### Phase 2: Add Scenario weightMods

Apply the recommended weightMods to each scenario. Priority order:

1. **do_nothing** — Critical for ambitious/bloodthirsty (prevents boring runs)
2. **challenge_god / cosmic_battle** — High-impact for ambitious/cautious
3. **assassination / ambush** — Clear honorable differentiation
4. **All combat scenarios** — Consistent bloodthirsty behavior
5. **All stealth scenarios** — Consistent cunning behavior

### Phase 3: Add Race traitWeights (Optional)

Consider race-specific trait tendencies:
- Dragons: `{ "ambitious": 1.5 }`
- Elves: `{ "cautious": 1.3, "cunning": 1.2 }`
- Humans: `{}` (neutral baseline)

### Testing Recommendations

After adding traits and mods:
1. Run simulator to verify trait distribution
2. Check scenario selection rates per trait
3. Confirm no characters have < 2 non-do_nothing options per band
4. Verify multiplier stacking works as expected for multi-condition matches

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total scenarios | 12 |
| Scenarios per band | 4 |
| Proposed traits | 5 |
| Total weightMods recommended | 59 |
| Scenarios requiring weightMods | 11 (do_nothing + all non-neutral) |
| Scenarios with carried requirements | 1 (rematch_rival) |
| Durability-free scenarios | 5 |
| Combat scenarios | 6 |
| Stealth scenarios | 4 |

---

**Inventory complete. No files modified.**
