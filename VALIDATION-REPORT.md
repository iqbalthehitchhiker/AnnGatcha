# Read-Only Validation Report
**Date:** 2026-10-10  
**Scope:** JSON syntax, unique IDs, tag references, power pool availability

---

## ✅ Overall Status: PASSED

All JSON files are syntactically valid. All IDs are unique within their collections. All tag references are valid. All race-archetype paths have available powers.

---

## JSON File Validation

| File | Status | Entries |
|------|--------|---------|
| `data/config.json` | ✓ Valid | Configuration |
| `data/races.json` | ✓ Valid | 3 races |
| `data/archetypes.json` | ✓ Valid | 3 archetypes |
| `data/sizes.json` | ✓ Valid | 2 sizes |
| `data/traits.json` | ✓ Valid | 1 trait |
| `data/powers.json` | ✓ Valid | 20 powers |
| `data/tags.json` | ✓ Valid | 34 tags |
| `data/weapons.json` | ✓ Valid | 13 types, 8 enchantments |
| `data/pools.json` | ✓ Valid | 3 pools, 6 opponents |
| `data/scenarios/basic.json` | ✓ Valid | 12 scenarios |

---

## Unique ID Validation

All IDs are unique within their respective collections:

- **Races:** 3 unique IDs (human, elf, dragon)
- **Archetypes:** 3 unique IDs (warrior, mage, elemental)
- **Sizes:** 2 unique IDs (medium, huge)
- **Traits:** 1 unique ID (brave)
- **Powers:** 20 unique IDs
- **Tags:** 34 unique IDs
- **Weapon Types:** 13 unique IDs
- **Weapon Enchantments:** 8 unique IDs
- **Opponent Pools:** 3 unique pool IDs
- **Opponents:** 6 unique opponent IDs across all pools
- **Scenarios:** 12 unique IDs

**Result:** ✓ No duplicate IDs found

---

## Tag Reference Validation

### Tag Inventory (34 tags)

**Power/Ability Tags:**
- combat, cosmic, death, destruction, earth, fire, flight, healing, illusion, magic, nature, physical, shadow, storm, summoning, time, transformation

**Species/Faction Tags:**
- divine, draconic, fey, mortal

**Mechanical Tags:**
- physical_immunity, soul_immunity, soul_severing

**Carried Tags:**
- rival, wounded

**Weapon Tags:**
- blade, blunt, concealable, legendary, magic_weapon, polearm, ranged, shield

### Tag Reference Summary

- **Tags defined:** 34
- **Tags used by powers:** 18
- **Tags used by races:** 4 (mortal, fey, draconic, divine)
- **Tags used by weapons:** 15
- **Tags used by opponents:** 6
- **Tags referenced by archetypes (poolTags):** 7

### Unused Tags (3)

These tags are defined but not currently referenced by any content:
- `soul_immunity` — Ready for future opponents or powers
- `wounded` — Carried tag (emitted by scenario outcomes, consumed by stat system via `effect`)
- `rival` — Carried tag (emitted by standoff outcomes, consumed by `rematch_rival` scenario)

**Note:** `wounded` and `rival` are carried tags used by the scenario system, so they appear unused in static data but are dynamically generated during gameplay.

### Tag Reference Validation Results

✓ All power tags are defined  
✓ All race tags are defined  
✓ All archetype poolTags are defined  
✓ All weapon type tags are defined  
✓ All weapon enchantment tags are defined  
✓ All opponent tags are defined  
✓ All tag.blockedBy references are valid  

**Result:** ✓ All tag references valid

---

## Race-Archetype Reference Validation

All races correctly reference existing archetypes and sizes:

### Human → Archetypes
- ✓ warrior (exists)
- ✓ mage (exists)

### Elf → Archetypes
- ✓ mage (exists)
- ✓ warrior (exists)

### Dragon → Archetypes
- ✓ elemental (exists)
- ✓ warrior (exists)

### All Races → Sizes
- ✓ All size references valid (medium, huge)

**Result:** ✓ All race references valid

---

## Power Pool Availability

Every race-archetype combination has access to powers via the archetype's `poolTags`.

### Human → Warrior
**poolTags:** physical, combat  
**Available powers:** 6

**Via [physical]:**
- super_strength (weight: 10)
- regeneration (weight: 6)
- beast_transformation (weight: 5)
- earth_shaping (weight: 7)

**Via [physical, combat]:**
- iron_skin (weight: 7)
- force_blast (weight: 8)

---

### Human → Mage
**poolTags:** magic, cosmic  
**Available powers:** 13

**Via [magic]:**
- fireball (weight: 10)
- healing_magic (weight: 7)
- necromancy (weight: 5)
- spirit_summoning (weight: 5)
- illusion_magic (weight: 7)
- plant_manipulation (weight: 6)
- shadow_step (weight: 5)
- barrier_creation (weight: 6)

**Via [magic, cosmic]:**
- telekinesis (weight: 8)

**Via [cosmic]:**
- void_manipulation (weight: 5)
- time_dilation (weight: 3)
- flight (weight: 6)
- gravity_manipulation (weight: 4)

---

### Elf → Mage
**poolTags:** magic, cosmic  
**Available powers:** 13

*Same pool as Human → Mage (identical archetypes)*

---

### Elf → Warrior
**poolTags:** physical, combat  
**Available powers:** 6

*Same pool as Human → Warrior (identical archetypes)*

---

### Dragon → Elemental
**poolTags:** fire, storm, destruction  
**Available powers:** 4

**Via [fire]:**
- fireball (weight: 10)

**Via [storm, destruction]:**
- lightning_bolt (weight: 8)

**Via [destruction]:**
- void_manipulation (weight: 5)
- gravity_manipulation (weight: 4)

---

### Dragon → Warrior
**poolTags:** physical, combat  
**Available powers:** 6

*Same pool as Human → Warrior (identical archetypes)*

---

### Power Pool Summary

| Race | Archetype | Available Powers | Status |
|------|-----------|------------------|--------|
| human | warrior | 6 | ✓ |
| human | mage | 13 | ✓ |
| elf | mage | 13 | ✓ |
| elf | warrior | 6 | ✓ |
| dragon | elemental | 4 | ✓ |
| dragon | warrior | 6 | ✓ |

**Result:** ✓ All race-archetype paths have available powers

**Observation:** The `dragon → elemental` path has only 4 available powers, which provides less variety than other paths but still meets the minimum requirement.

---

## Scenario Reference Validation

### Scenario Pool References

All scenario `pick` steps reference valid opponent pools:

- `street_fight` → `basic_opponents` ✓
- `urban_brawl` → `basic_opponents` ✓
- `demon_duel` → `midtier_opponents` ✓
- `challenge_god` → `gods` ✓
- `cosmic_battle` → `gods` ✓
- `rematch_rival` → uses carried `rival` opponent (special case) ✓

### Scenario Band References

All scenarios reference valid bands from `config.bands`:
- Band `10-9`: 4 scenarios
- Band `8-7`: 3 scenarios
- Band `6-4`: 3 scenarios
- Band `3-2`: 3 scenarios
- Band `1-0`: 3 scenarios

**Result:** ✓ All scenario references valid

---

## Opponent Pool Validation

### basic_opponents (2 opponents)
- `thug` — str: 10.0, spd: 10.0, dur: 10.0, tags: [mortal]
- `soldier` — str: 9.5, spd: 9.5, dur: 9.5, tags: [mortal, combat]

### midtier_opponents (2 opponents)
- `demon` — str: 6.0, spd: 6.5, dur: 6.0, tags: [fire, destruction]
- `elemental` — str: 5.5, spd: 5.0, dur: 6.5, tags: [magic]

### gods (2 opponents)
- `sun_titan` — str: 2.5, spd: 2.0, dur: 9.5, tags: [divine, fire, physical_immunity]
- `storm_god` — str: 1.5, spd: 2.5, dur: 2.0, tags: [divine, storm]

**Result:** ✓ All opponent IDs unique within pools, all required fields present

---

## Powers by Tag Distribution

| Tag | Power Count | Powers |
|-----|-------------|--------|
| magic | 9 | fireball, telekinesis, healing_magic, necromancy, spirit_summoning, illusion_magic, plant_manipulation, shadow_step, barrier_creation |
| physical | 6 | super_strength, iron_skin, regeneration, beast_transformation, earth_shaping, force_blast |
| cosmic | 5 | telekinesis, void_manipulation, time_dilation, flight, gravity_manipulation |
| destruction | 3 | lightning_bolt, void_manipulation, gravity_manipulation |
| nature | 3 | beast_transformation, earth_shaping, plant_manipulation |
| combat | 2 | iron_skin, force_blast |
| healing | 2 | healing_magic, regeneration |
| death | 1 | necromancy |
| earth | 1 | earth_shaping |
| fire | 1 | fireball |
| flight | 1 | flight |
| illusion | 1 | illusion_magic |
| shadow | 1 | shadow_step |
| shield | 1 | barrier_creation |
| storm | 1 | lightning_bolt |
| summoning | 1 | spirit_summoning |
| time | 1 | time_dilation |
| transformation | 1 | beast_transformation |

**Total:** 20 powers across 18 tag categories

---

## Archetype Pool Coverage

### Warrior Archetype
**poolTags:** physical, combat  
**Powers available:** 6  
**Coverage:** Good variety of physical/combat powers

### Mage Archetype
**poolTags:** magic, cosmic  
**Powers available:** 13  
**Coverage:** Excellent variety of magic and cosmic powers

### Elemental Archetype
**poolTags:** fire, storm, destruction  
**Powers available:** 4  
**Coverage:** Limited but functional (only archetype with <5 powers)

---

## Content Expansion Since Original Audit

The project now contains **20 powers** (up from 6 in the initial read).

### New Powers Added (14):
1. healing_magic (magic, healing)
2. regeneration (physical, healing)
3. necromancy (magic, death)
4. spirit_summoning (magic, summoning)
5. beast_transformation (physical, transformation, nature)
6. illusion_magic (magic, illusion)
7. time_dilation (cosmic, time)
8. earth_shaping (physical, earth, nature)
9. plant_manipulation (magic, nature)
10. shadow_step (magic, shadow)
11. flight (cosmic, flight)
12. gravity_manipulation (cosmic, destruction)
13. force_blast (physical, combat)
14. barrier_creation (magic, shield)

### New Tags Added (9):
- death, earth, flight, healing, illusion, nature, shadow, summoning, time, transformation

These new tags support the expanded power roster and fill thematic gaps identified in the original audit.

---

## Validation Test Execution

### Test 1: JSON Syntax
**Command:** `node -e "JSON.parse(...)"`  
**Result:** ✓ All files valid

### Test 2: Unique IDs
**Command:** `node validate-audit.cjs`  
**Result:** ✓ All IDs unique

### Test 3: Tag References
**Command:** `node validate-audit.cjs`  
**Result:** ✓ All references valid

### Test 4: Power Pool Availability
**Command:** `node validate-audit.cjs`  
**Result:** ✓ All paths have powers

### Test 5: Detailed Power Distribution
**Command:** `node validate-detailed.cjs`  
**Result:** ✓ All archetypes have access to powers

---

## Known Limitations (By Design)

1. **Dragon → Elemental has only 4 powers:** This is the smallest power pool but still meets the minimum requirement. The limited variety reflects the specialized nature of elemental powers.

2. **Three unused tags:** `soul_immunity`, `wounded`, and `rival` appear unused because:
   - `soul_immunity` is available for future content
   - `wounded` and `rival` are carried tags used dynamically by the scenario system

3. **Trait system minimally populated:** Only 1 trait exists (`brave`), which was noted in the original audit as a gap for future expansion.

---

## Recommendations

Based on this validation:

1. **✓ Powers:** Now at M2 target (20 powers) — no action needed
2. **Races:** Still at 3 (target: 8) — expansion recommended per original audit
3. **Traits:** Still at 1 — expansion recommended to add meaningful scenario weight mods
4. **Dragon → Elemental pool:** Consider adding 1-2 more powers with fire/storm/destruction tags for variety

---

## Conclusion

**All validation checks passed.** The current data files are internally consistent with:
- Valid JSON syntax across all files
- Unique IDs within all collections
- All tag references properly defined
- All race-archetype paths with available power pools
- All scenario and opponent pool references valid

The content is ready for further expansion following the recommended batches in the original audit report.

---

**Validation scripts created:**
- `validate-audit.cjs` — Core validation checks
- `validate-detailed.cjs` — Detailed power distribution analysis

**No files modified during validation.**
