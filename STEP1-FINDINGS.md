# Step 1: Combat Trace Investigation - Findings

## Exact Field Names Used to Mark Step Type

From actual trace entry (contest/fight):
```json
{
  "stageId": "scenario:street_fight:fight",
  "stepType": "contest",
  "mode": "fight",
  "opponent": "soldier",
  "charEffStr": 1.7203810275532305,
  "charSpd": 2.7203810275532305,
  "charDur": 2.7203810275532305,
  "oppEffStr": 9.5,
  "oppSpd": 9.5,
  "oppDur": 9.5,
  "table": [...],
  "pickedId": "lose",
  "draw": 0.7044756761752069,
  "meta": {
    "harmClass": "one-sided"
  }
}
```

**Field names that mark step type:**
- `stepType: "contest"` - marks this as a contest step
- `mode: "fight"` - indicates this is specifically a fight contest
- `meta.harmClass` - contains the harm classification ("one-sided", "both", "neither")

## Whether Any Entry Represents Contest/Fight

**YES**. The engine DOES emit contest entries with:
- `stepType === "contest"`
- `mode` field indicating the contest type ("fight", "check", etc.)
- `meta.harmClass` field with the harm class value

## What analyzeContestOutcome Expects vs. What Trace Contains

### What the analyzer expects (sim/run.js:185-228):

```javascript
function analyzeContestOutcome(traceEntry, stats) {
  const outcome = traceEntry.outcome;  // ← EXPECTS 'outcome' field
  
  // Track fight outcome
  if (outcome === 'win' || outcome === 'lose' || outcome === 'flee' || outcome === 'standoff') {
    stats.fightOutcomes[outcome]++;
  }
  
  const prob = traceEntry.prob || 0.5;  // ← EXPECTS 'prob' field
  
  // Then tries to infer harmClass from outcome + prob
  if (outcome === 'standoff') {
    stats.harmClasses.neither++;
  } else if (outcome === 'flee') {
    // ... inference logic
  }
}
```

### What the trace actually contains:

```json
{
  "pickedId": "lose",        // ← outcome is in 'pickedId', NOT 'outcome'
  "draw": 0.7044756761752069, // ← NOT 'prob'
  "meta": {
    "harmClass": "one-sided"  // ← harmClass is ALREADY HERE, no inference needed!
  },
  "table": [
    {
      "id": "lose",
      "weight": 0.99,
      "prob": 0.99           // ← 'prob' is inside table entries, not at top level
    },
    {
      "id": "win",
      "weight": 0.01,
      "prob": 0.01
    }
  ]
}
```

## Classification

**Finding: (a) field-name mismatch**

The engine DOES emit contests with full information including the authoritative `meta.harmClass` field. However, the analyzer:

1. Reads `traceEntry.outcome` but the field is actually `traceEntry.pickedId`
2. Reads `traceEntry.prob` but there is no top-level prob field (only in table entries)
3. Attempts to infer `harmClass` from outcome+prob when `traceEntry.meta.harmClass` already contains the authoritative value

The engine correctly emits all needed data. The analyzer reads the wrong field names and unnecessarily tries to infer what's already explicitly provided.
