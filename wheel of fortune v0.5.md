# Wheel of Fortune RPG: Software Requirements Specification (v0.5, implementation-ready)

Supersedes v0.4. Everything here is decided unless marked [TUNE] (a placeholder number, to be set by simulation) or [DEFERRED].

## 0. Changes from v0.4
- Band is derived from effective strength, not raw strength (FR-X1). Fixes jackpot weapons never reaching weapon-friendly scenarios.
- One-sided fights allow `flee` for the harmed side (FR-S5). Fixes weak, fast characters having no escape.
- Section 17 is now a hard content boundary covering balance numbers and [TUNE] values.
- M1 is split: M1a (structural) and M1b (prose gate, after a human-reviewed content batch).
- Rarity percentile (FR-M4) excludes individual power picks.
- Carried tags with an `effect` (e.g. `wounded`) are exempt from the "consumed" check (FR-X5).
- `redoStage` API is deferred to M5; `redoMap` and per-stage seed keys stay in M0 (FR-A1, FR-A4).
- FR-X3 and the validator now check scenario availability per band across the effective-strength range.
- Added: effStr clamp (FR-S2), band fixed at chain start (FR-X1), harm-class outcome rates in the simulator (FR-M1), generated-file exception to the content boundary (section 17).

## 1. Purpose and scope
A browser game where the player spins a chain of wheels to generate a character, then spins through three tier-gated scenarios to see what the character does. The player makes no decisions. v1 has no combat system, multiplayer, economy or player choices.

## 2. Principles
- Wheels are intentionally unbalanced. Balance happens in scenarios.
- Content is additive: races, powers, weapons and scenarios are added through JSON only (NFR-5).
- Outcome first, animation second: the core computes the full result, and the UI only replays it.
- The value of a run is how interesting and shareable it is. Flavor text is a first-class deliverable, not filler.

## 3. Constraints and tooling
- C-1: Vanilla JavaScript ES modules, no build step, HTML/CSS, Canvas for the wheel.
- C-2: Types via JSDoc with `// @ts-check` in every source file. `tsc --noEmit` runs as a dev-only check.
- C-3: Tests with Vitest and fast-check. Dev tooling is limited to these, ESLint and TypeScript.
- C-4: `src/core/` SHALL NOT use `Math.random`, `Date`, `performance`, `document`, `window` or `fetch`. This is enforced by ESLint `no-restricted-globals` / `no-restricted-properties`, and CI fails on violation.
- C-5: Core receives a plain `data` object. Loading is outside core (`fetch` in browser, `fs` in `sim/`).
- C-6: The app requires a static server (not `file://`).
- C-7: localStorage holds run history only (optional gallery). No currency.

## 4. Core concepts
- **Level**: stats are continuous on `L = (10 - tier) + frac`, with `L` in [0, 11). `tier = 10 - floor(L)`. Higher L is stronger. Tier 0 is the strongest.
- **Tier table**: 10 weak human to superhuman, 9 city level, 8 city-nuke, 7 mountain, 6 island to continent, 5 moon to dwarf-star, 4 star to multi-solar, 3 galaxy to infinite universal, 2 multiversal, 1 hyperversal to dimensional, 0 transcendent.
- **Pick**: every random choice, including "win or lose", is a weighted pick. A pick consumes exactly one RNG draw, mapped through cumulative normalized weights.
- **Trace**: an ordered list of `{stageId, table:[{id, weight, prob}], pickedId, draw}`, one entry per pick.
- **Run**: `(masterSeed, redoMap)` where `redoMap` maps stageId to redo counter (default 0). A run is fully reproducible from these two values and `data`.

## 5. Architecture
- FR-A1: `core/run.js` is the orchestrator. It exposes `generateRun(data, seed, redoMap = {}) -> RunResult`. The `redoMap` parameter and per-stage seed keys exist from M0 so stage independence is testable. The `redoStage(run, stageId)` API is [DEFERRED] to M5.
- FR-A2: `RunResult` contains the character, the three scenario outcomes, the full trace, and the creation-path log-probability.
- FR-A3: The UI SHALL NOT recompute tables or odds. It replays the trace.
- FR-A4: When `redoStage` is built, redoing a stage increments its counter and re-resolves all downstream stages. "Keep downstream where still valid" is [DEFERRED] and not in v1. Per-stage seeding already gives partial stability.
- FR-A5: Module layout:

```
data/        config, races, archetypes, sizes, powers, tags, traits, weapons, pools, scenarios/*.json, percentiles.json
src/core/    rng, picker, mods, creation, stats, scenario, chain, validate, run
src/ui/      wheel, results, app
src/debug/   buttons and panels only (no logic)
sim/         run.js, diff.js
test/        tests and test/fixtures/ (broken and minimal data fixtures live here, never in data/)
```

## 6. RNG
- NFR-4: Each stream key is `master|stageId|redoCount`. Hash with xmur3, feed sfc32. Scenario stage IDs include the step (`scenario:2:pickOpponent`).
- FR-R1: Redoing stage X SHALL NOT alter the raw draw stream of any other stage.
- FR-R2: Cross-engine bit-exactness is not guaranteed because `Math.exp` and `Math.pow` can differ. Golden-file tests are Node-only.

## 7. Character creation
Stage order is fixed and stored as one array in `config.json`.

1. race
2. archetype (conditional on race)
3. size (flavor only, no mechanics in v1)
4. trait
5. powerCount
6. powers (pool = powers with any tag in `archetype.poolTags`, weighted by `power.weight` times `archetype.tagWeights`)
7. strength tier (wheel), then hidden fractional sub-roll
8. speed offset, durability offset
9. weapon (single stage: yes/no, then type, then enchantment)

- FR-C1: Each stage's table is resolved from earlier results through `core/mods.js` using the closed op list: `shiftTier{stat,by}`, `shiftOffset{stat,by}`, `shiftPowerCount{by}`, `scaleWeight{stage,entry|tag,by}`. No stage-specific rule code may exist outside `mods.js` and the stage definitions.
- FR-C2: Weights are relative and normalized at runtime. Every table SHALL show only valid entries.
- FR-C3: "All powers" is a hard cap: `config.maxPowers` (default 6). A hand-authored kit per archetype is [DEFERRED] and may be added later as an optional archetype field.
- FR-C4: Strength tier weights = `race.tierWeights` shifted by `config.powerCountShift[count]` tiers, plus `config.tierTailFloor` added to every tier so rare jackpots stay possible. [TUNE]
- FR-C5: Powers carry no `minTier` (gating is soft via `tierWeights`).
- FR-C6: Speed and durability are offset wheels relative to strength (for example -1, 0, +1, +2). Offset tables come from `race.offsets` (default `{"0":1}`) and archetype mods. Result is clamped to [0, 11).
- FR-C7: Weapon chance comes from `race.weaponChance`.

## 8. Stats, weapons, scenario resolution
- FR-S1: Three stats: strength, speed, durability. Each must be used by at least one scenario step type, otherwise validation fails.
- FR-S2: **Effective strength**: `effStr = clamp(max(str, weaponLevel - config.weaponPenalty), 0, 11)` (clamped just below 11), where `weaponLevel = type.level + enchantment.levelBonus`. Weapons never modify speed or durability.
- FR-S3: **Wounded**: while the `wounded` carried tag is active, all stats get `-1.0` level, applied before any other calculation. Wounded does not change the band (FR-X1).
- FR-S4: **Can harm**: A can harm B iff (a) A has a tag (innate, power, or weapon) with `bypassesDurability` whose `counters` do not intersect B's tags, or (b) `effStrA >= durB - config.harmMargin`.
- FR-S5: **Fight resolution**, in this order:
  1. Neither can harm the other: stalemate procedure (FR-S6).
  2. One-sided (A can harm B, B cannot harm A): if B's speed exceeds A's by more than `config.speedGapFlee`, the outcome is `flee` (B escapes). Otherwise it is a rout, resolved by one pick where the harming side wins with probability `1 - config.minOdds`. Every outcome is a pick, so the trace stays complete.
  3. Both can harm: `diff = ((effStrA - durB) - (effStrB - durA)) / 2 + config.speedWeight * (spdA - spdB)`. `pWin = clamp(logistic(config.checkSteepness * diff), minOdds, 1 - minOdds)`. Resolved by one pick. [TUNE]
  - Known limitation (accepted for v1): at the edge of `harmMargin`, win chance jumps from about 0.5 (both can harm) to `1 - minOdds` (rout). Immunity is treated as qualitatively different from "hard to hurt". FR-M1 reports outcome rates by harm class so the simulator shows whether this matters. If it does, revisit with data.
- FR-S6: **Stalemate procedure**: (a) bypass tags are checked first (S4a). (b) If the speed gap exceeds `config.speedGapFlee`, the faster side disengages (outcome `flee`). (c) Otherwise the step's authored `standoff` branch runs. It must exist for every `contest` step and may emit `rival`.
- FR-S7: **Non-fight check**: `p = clamp(logistic(logit(baseOdds) + steepness * (stat - difficulty)), minOdds, 1 - minOdds)`. `baseOdds` is the success chance when the stat equals the difficulty.
- FR-S8: Contest outcomes are exactly `win`, `lose`, `flee`, `standoff`. No unresolved state exists.

## 9. Scenarios and chain
- FR-X1: Bands: `10-9`, `8-7`, `6-4`, `3-2`, `1-0`. A character's band is determined once, at chain start, from effective strength (FR-S2): `bandTier = 10 - floor(effStr)`. All three chain scenarios use that band in v1. Weapon-less characters have `effStr = str`. Consequence: a tier-10 human with a tier-2 weapon lands in `3-2` and may draw "challenge a god" with their real durability, so they will usually die there. This is intended behavior.
- FR-X2: A run has exactly three scenarios chosen in sequence. Each is a weighted pick over scenarios whose `bands` include the band and whose `requires` pass.
- FR-X3: `do_nothing` exists in every band. Its weight is modified by traits through `scenarioMods`. Every character must have at least two options besides `do_nothing` in its band, otherwise the simulator reports it. This is checked per band across the whole effective-strength range, including characters whose durability or speed is far below their effStr (see section 11).
- FR-X4: Scenarios are graphs of steps with a closed grammar: `pick{pool,bind,next}`, `check{stat,difficulty,baseOdds,next:{success,fail}}`, `contest{mode:"fight",vs,next:{win,lose,flee,standoff}}`, `end{text,emits}`. Conditions are limited to `trait:x`, `tag:x`, `carried:x`, `race:x`.
- FR-X5: Carried tags in v1: `rival` (opponent who survived or fled, reused from existing pools) and `wounded`. Every carried tag must be emitted by at least one scenario. Tags with an `effect` field (such as `wounded`) are exempt from the "consumed" check, since the stat system consumes them (FR-S3). Tags without `effect` (such as `rival`) must also be consumed by at least one later-reachable scenario through a `carried:` condition.
- FR-X6: Scenario files are organized by theme, not by band, because a scenario may span bands.
- FR-X7: Every band with content has at least one scenario that does not test durability (assassination, heist, ambush), so a weapon-boosted character always has somewhere to pay off.

## 10. Data model
All ids are snake_case and unique per file. All weights are numbers > 0. R = required, O = optional.

```jsonc
// config.json
{ "stageOrder": ["race","archetype","size","trait","powerCount","powers","strength","speedOffset","durOffset","weapon"],
  "bands": { "10-9":[10,9], "8-7":[8,7], "6-4":[6, 5, 4], "3-2":[3,2], "1-0":[1,0] },
  "tierTailFloor": 0.02, "maxPowers": 6,
  "powerCount": { "1":40,"2":30,"3":15,"4":8,"5":5,"all":2 },
  "powerCountShift": { "1":0,"2":0,"3":1,"4":1,"5":2,"all":2 },
  "chainLength": 3, "weaponPenalty": 1.0, "harmMargin": 0.5,
  "checkSteepness": 2.0, "speedWeight": 0.25, "minOdds": 0.01, "speedGapFlee": 1.5 }

// races.json
"dragon": { "name": "Dragon", "weight": 2,                     // R
  "archetypes": { "elemental": 50, "magic": 35 },               // R
  "sizes": { "huge": 60, "colossal": 40 },                      // R
  "tierWeights": { "6": 40, "5": 30, "4": 10 },                 // R, sparse
  "offsets": { "spd": {"-1":30,"0":60,"1":10}, "dur": {"0":40,"1":40,"2":20} }, // O
  "traitWeights": { "ambitious": 1.5 },                         // O
  "weaponChance": 0.3, "tags": ["draconic"], "mods": [] }       // O

// archetypes.json
"elemental": { "name": "Elemental", "poolTags": ["fire","water","storm"],  // R
  "tagWeights": { "fire": 3 }, "mods": [ { "op":"shiftOffset","stat":"dur","by":-1 } ] }

// powers.json
"void": { "name": "Void Manipulation", "weight": 5, "tags": ["cosmic","destruction"] }  // all R

// tags.json
"soul_severing": { "name":"Soul-Severing", "bypassesDurability": true, "counters": ["physical_immunity"] }
"wounded": { "carried": true, "effect": { "allStats": -1.0 } }
"rival":   { "carried": true }

// weapons.json
{ "types": { "sword": { "name":"Sword", "weight":10, "level":4, "tags":["blade"] } },
  "enchantments": { "soul_edge": { "name":"Soul Edge", "weight":1, "levelBonus":3, "tags":["soul_severing"] } } }

// traits.json
"ambitious": { "name":"Ambitious", "weight":10, "scenarioMods":[ { "scenario":"do_nothing","mult":0.3 } ] }

// pools.json
{ "gods": [ { "id":"sun_titan","name":"Sun Titan","weight":3,"str":5.2,"spd":4.0,"dur":6.1,"tags":["fire"] } ] }

// scenarios/*.json
"fight_god": { "name":"Challenge a god", "bands":["3-2","1-0"], "weight":10,
  "requires": { "tags":[], "notTags":[], "carried":[] },
  "weightMods": [ { "if":"trait:ambitious", "mult":1.5 } ],
  "start":"pick",
  "steps": {
    "pick":  { "type":"pick", "pool":"gods", "bind":"opponent", "next":"fight" },
    "fight": { "type":"contest", "mode":"fight", "vs":"opponent",
               "next": { "win":"won","lose":"lost","flee":"fled","standoff":"stand" } },
    "stand": { "type":"end", "text":"...", "emits":["rival"] } } }
```

## 11. Validation (NFR-3)
`core/validate.js` is pure over `data` and runs in browser, CI and sim. It SHALL fail on:
- non-positive weights, unknown referenced ids, powers without tags, unknown tags
- any race x archetype path that yields an empty table at any stage (static enumeration)
- a band with fewer than the required scenarios (`do_nothing` plus at least two others)
- for each band and each trait, fewer than two non-`do_nothing` scenarios whose `requires` can pass given only tags reachable by characters that can land in that band (static check; the simulator covers the combined case empirically, FR-M1)
- a carried tag that is never emitted; a carried tag without `effect` that is never consumed (FR-X5)
- a scenario step graph with an unreachable step, a dead end, or a `contest` with a missing branch
- a stat that no scenario step uses
- a stale `percentiles.json` (data hash mismatch): warning, not failure

At runtime an empty table throws an error that includes the seed. The simulator counts these throws.

## 12. Non-functional
- NFR-1: 60 fps spin on a mid-range phone.
- NFR-2: Responsive layout; the wheel scales to the viewport.
- NFR-5: New content requires data changes only.

## 13. Simulator and rarity
- FR-M1: `sim/run.js` runs N thousand headless runs and prints distributions of races, tiers, stats, power counts, scenario selection per band, and outcome rates. Outcome rates are also broken out by harm class (neither / one-sided / both) and by fight outcome (win / lose / flee / standoff). It reports any character with fewer than two non-`do_nothing` options in its band, grouped by band and effStr bucket.
- FR-M2: `sim/run.js --prose N` prints N sample runs as readable prose (used for the M1b prose gate).
- FR-M3: `sim/diff.js` diffs distributions against the previous run after content changes.
- FR-M4: Rarity is the percentile of the creation-path log-probability, summed over: race, archetype, trait, powerCount, strength tier, and the weapon stage (including type and enchantment when present). Individual power picks are excluded because they are an ordered sequence, so the same set in a different order would score differently. The continuous sub-roll, speed, durability and scenarios are also excluded. `sim/run.js` writes about 1,000 quantile points to `percentiles.json` with a data hash.
  - Known limitation: a build with an absurdly rare power set scores no rarer than a common one. A set-based power score is [DEFERRED].
- FR-M5: The tier distribution from the simulator decides which bands get content first.

## 14. UI and results
- FR-U1: One wheel component animates to a predetermined result from the trace, landing correctly every time.
- FR-U2: The results screen shows the full build and the three scenario outcomes, and the percentile (for example "rarer than 99.8% of runs").
- FR-U3: A seed input and whole-run redo (a fresh seed) are available in v1. Single-wheel redo UI is [DEFERRED], though the core supports per-stage counters from day one. Whether to ship redo tools in release builds is [DEFERRED].

## 15. Milestones and acceptance tests
**M0: engine foundations** (rng, picker, mods, validate, run skeleton, sim skeleton). Done when all of these pass:
- Determinism: `generateRun` is deep-equal across two calls for 1,000 seeds.
- Stage independence: calling `generateRun` with a bumped `redoMap` counter for stage X leaves every other stage's raw draw stream unchanged.
- Picker over 100k picks: each entry is within `4*sqrt(N*p*(1-p))` of its expected count. fast-check: probabilities sum to 1, scaling all weights by c gives the same pick for the same draw, exactly one draw is consumed per pick.
- A hand-built trace's log-probability equals the hand-computed product.
- One broken fixture per validation rule (under `test/fixtures/`) fails with its specific error. The real data passes.
- 100k creation runs complete with zero throws. `percentiles.json` is byte-identical for the same seed and data.
- Lint confirms core is free of banned globals.

**M1a: scenario engine, structural.** Content: 3 races, a few powers, a few weapons, one scenario per band in use, placeholder text. Done when:
- Monotonicity: win probability never decreases as strength rises or as opponent durability falls, over a grid.
- Steepness (set these numbers before tuning): delta >= 2 tiers gives p >= 0.98; delta <= -2 gives p <= 0.02; |delta| < 0.5 gives 0.25 to 0.75.
- Weapon (FR-S2): a tier-10 human with a tier-2 weapon can harm a god, speed and durability are unchanged, and the god still harms them with probability near 1.
- Band: that same character's band is `3-2`, and a weapon-friendly scenario (FR-X7) is selectable for them.
- Bypass: a soul-severing weapon harms a physical-immune god, and the same weapon without the tag does not.
- Stalemate: over 100k random pairs, zero unresolved outcomes, and `standoff` occurs only when the speed gap is below `speedGapFlee`.
- One-sided flee: a fast human against a slower god that can harm them and that they cannot harm flees with probability `1` (the speed rule is deterministic; the outcome pick uses the `flee` branch only). Below the speed gap it is a rout with the god winning at `1 - minOdds`.
- Replay: the trace alone rebuilds the outcome.
- Per-band options (FR-X3): for each band, sampled characters across the effStr range, including low-durability and low-speed ones, always have at least two non-`do_nothing` scenarios.

**M1b: prose gate.** Runs after a separate, human-reviewed content batch lands real flavor text for the slice scenarios (section 17). Done when `--prose 50` reads well enough that the author would show one to a friend.

**M2: full creation chain** with the starting content set (about 8 races, 20 powers, 10 weapons).
**M3: three-scenario chain** with carried tags, then add bands one at a time, lowest-traffic last.
**M4: UI**, wheel animation, results screen, percentile display.
**M5: redo tools** (including the `redoStage` API and UI), content expansion, polish.

## 16. Out of scope for v1
Combat system, multiplayer, economy, player choices, extra stats, additional stages after weapon, carried tags beyond `rival`/`wounded`, hand-authored "all powers" kits, "keep downstream where still valid" redo, shipped single-wheel redo UI, `redoStage` API before M5, set-based power rarity.

## 17. Content boundary
Implementation tasks SHALL NOT create or edit any file under `data/` except the M1 placeholders. This includes balance numbers: `tierWeights`, `weaponChance`, every [TUNE] value in `config.json`, and the stat lines in `pools.json`. When validation or simulation fails, the tool reports the failure and stops. A human decides the data change.

Exceptions: (a) `data/percentiles.json` is a generated file written by `sim/run.js`, never hand-edited. (b) The M1 placeholder set includes a placeholder `config.json` using the values shown in section 10. Test fixtures live under `test/fixtures/`, not `data/`.

All other content (races, powers, weapons, traits, pools, scenarios, flavor text) is authored in separate, human-reviewed batches against the schemas in section 10. The author has final say on every content batch.

## 18. Risks
No agency (flavor text carries the game), authoring cost, uneven band usage, predictable outcomes from steep odds, the rout cliff at `harmMargin` (watch the harm-class report), stat sprawl, content weight typos (mitigated by the simulator diff).
