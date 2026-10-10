# SCENARIO SELECTION & CARRIED-TAG DIAGNOSTIC

Generated: 2026-10-10T12:55:03.528Z

---

## Part 1: Carried Tag Flow

Tracks which scenarios emit and consume carried tags.


### Band: 10-9

**assassination**
  - No carried tag interaction

**do_nothing**
  - No carried tag interaction

**rematch_rival**
  - Emits: rival, wounded
  - Consumes: rival

**street_fight**
  - Emits: rival, wounded


### Band: 8-7

**do_nothing**
  - No carried tag interaction

**heist**
  - No carried tag interaction

**rematch_rival**
  - Emits: rival, wounded
  - Consumes: rival

**urban_brawl**
  - Emits: rival, wounded


### Band: 6-4

**ambush**
  - No carried tag interaction

**demon_duel**
  - Emits: rival, wounded

**do_nothing**
  - No carried tag interaction

**rematch_rival**
  - Emits: rival, wounded
  - Consumes: rival


### Band: 3-2

**challenge_god**
  - Emits: rival, wounded

**do_nothing**
  - No carried tag interaction

**infiltrate_fortress**
  - No carried tag interaction

**rematch_rival**
  - Emits: rival, wounded
  - Consumes: rival


### Band: 1-0

**cosmic_battle**
  - Emits: rival, wounded

**do_nothing**
  - No carried tag interaction

**reality_break**
  - No carried tag interaction

**rematch_rival**
  - Emits: rival, wounded
  - Consumes: rival


---

## Part 2: Tag Persistence Chains

Identifies which scenarios can maintain carried tags across the 3-scenario chain.


### Tag: rival

- Emitted by (6): street_fight, urban_brawl, demon_duel, challenge_god, cosmic_battle, rematch_rival
- Consumed by (1): rematch_rival
- **Can persist**: A chain containing an emitter followed by a consumer is possible

### Tag: wounded

- Emitted by (6): street_fight, urban_brawl, demon_duel, challenge_god, cosmic_battle, rematch_rival
- Consumed by (0): none
- **Dead-end tag**: Emitted but never consumed

---

## Part 3: WeightMods Impact Analysis

Shows how weightMods affect scenario selection probabilities.


### Condition Type: trait

**ambitious**
  - do_nothing (10-9, 8-7, 6-4, 3-2, 1-0): decreases weight by 0.3x
  - street_fight (10-9): increases weight by 1.5x
  - urban_brawl (8-7): increases weight by 1.5x
  - heist (8-7): increases weight by 1.2x
  - demon_duel (6-4): increases weight by 1.6x
  - challenge_god (3-2): increases weight by 2x
  - infiltrate_fortress (3-2): increases weight by 1.3x
  - cosmic_battle (1-0): increases weight by 2x
  - reality_break (1-0): increases weight by 1.5x
  - rematch_rival (10-9, 8-7, 6-4, 3-2, 1-0): increases weight by 1.4x

**bloodthirsty**
  - do_nothing (10-9, 8-7, 6-4, 3-2, 1-0): decreases weight by 0.2x
  - street_fight (10-9): increases weight by 2x
  - assassination (10-9): increases weight by 1.1x
  - urban_brawl (8-7): increases weight by 2x
  - heist (8-7): decreases weight by 0.7x
  - demon_duel (6-4): increases weight by 2x
  - ambush (6-4): increases weight by 1.2x
  - challenge_god (3-2): increases weight by 2x
  - infiltrate_fortress (3-2): decreases weight by 0.7x
  - cosmic_battle (1-0): increases weight by 2x
  - rematch_rival (10-9, 8-7, 6-4, 3-2, 1-0): increases weight by 1.6x

**cautious**
  - street_fight (10-9): decreases weight by 0.6x
  - assassination (10-9): increases weight by 1.2x
  - urban_brawl (8-7): decreases weight by 0.6x
  - heist (8-7): increases weight by 1.3x
  - demon_duel (6-4): decreases weight by 0.5x
  - ambush (6-4): increases weight by 1.2x
  - challenge_god (3-2): decreases weight by 0.4x
  - infiltrate_fortress (3-2): increases weight by 1.4x
  - cosmic_battle (1-0): decreases weight by 0.3x
  - reality_break (1-0): decreases weight by 0.8x

**cunning**
  - street_fight (10-9): decreases weight by 0.7x
  - assassination (10-9): increases weight by 1.4x
  - urban_brawl (8-7): decreases weight by 0.7x
  - heist (8-7): increases weight by 1.5x
  - demon_duel (6-4): decreases weight by 0.7x
  - ambush (6-4): increases weight by 1.5x
  - challenge_god (3-2): decreases weight by 0.6x
  - infiltrate_fortress (3-2): increases weight by 1.6x
  - cosmic_battle (1-0): decreases weight by 0.6x

**honorable**
  - street_fight (10-9): increases weight by 1.3x
  - assassination (10-9): decreases weight by 0.3x
  - urban_brawl (8-7): increases weight by 1.3x
  - demon_duel (6-4): increases weight by 1.4x
  - ambush (6-4): decreases weight by 0.3x
  - challenge_god (3-2): increases weight by 1.5x
  - cosmic_battle (1-0): increases weight by 1.5x
  - rematch_rival (10-9, 8-7, 6-4, 3-2, 1-0): increases weight by 1.3x


---

## Part 4: Sample Character Probabilities

Selection probabilities for representative characters in each band.


### Band: 10-9

**Human Ambitious (baseline)**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | street_fight | 10 | 15.00 | 61.22% | trait:ambitious:1.5x |
  | assassination | 8 | 8.00 | 32.65% | none |
  | do_nothing | 5 | 1.50 | 6.12% | trait:ambitious:0.3x |

**Human Ambitious with rival**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | rematch_rival | 15 | 21.00 | 46.15% | trait:ambitious:1.4x |
  | street_fight | 10 | 15.00 | 32.97% | trait:ambitious:1.5x |
  | assassination | 8 | 8.00 | 17.58% | none |
  | do_nothing | 5 | 1.50 | 3.30% | trait:ambitious:0.3x |

**Human Cowardly (baseline)**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | street_fight | 10 | 10.00 | 43.48% | none |
  | assassination | 8 | 8.00 | 34.78% | none |
  | do_nothing | 5 | 5.00 | 21.74% | none |

**Elf Ambitious (fey tag)**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | street_fight | 10 | 15.00 | 61.22% | trait:ambitious:1.5x |
  | assassination | 8 | 8.00 | 32.65% | none |
  | do_nothing | 5 | 1.50 | 6.12% | trait:ambitious:0.3x |


### Band: 8-7

**Human Ambitious (baseline)**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | urban_brawl | 10 | 15.00 | 57.47% | trait:ambitious:1.5x |
  | heist | 8 | 9.60 | 36.78% | trait:ambitious:1.2x |
  | do_nothing | 5 | 1.50 | 5.75% | trait:ambitious:0.3x |

**Human Ambitious with rival**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | rematch_rival | 15 | 21.00 | 44.59% | trait:ambitious:1.4x |
  | urban_brawl | 10 | 15.00 | 31.85% | trait:ambitious:1.5x |
  | heist | 8 | 9.60 | 20.38% | trait:ambitious:1.2x |
  | do_nothing | 5 | 1.50 | 3.18% | trait:ambitious:0.3x |

**Human Cowardly (baseline)**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | urban_brawl | 10 | 10.00 | 43.48% | none |
  | heist | 8 | 8.00 | 34.78% | none |
  | do_nothing | 5 | 5.00 | 21.74% | none |

**Elf Ambitious (fey tag)**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | urban_brawl | 10 | 15.00 | 57.47% | trait:ambitious:1.5x |
  | heist | 8 | 9.60 | 36.78% | trait:ambitious:1.2x |
  | do_nothing | 5 | 1.50 | 5.75% | trait:ambitious:0.3x |


### Band: 6-4

**Human Ambitious (baseline)**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | demon_duel | 10 | 16.00 | 62.75% | trait:ambitious:1.6x |
  | ambush | 8 | 8.00 | 31.37% | none |
  | do_nothing | 5 | 1.50 | 5.88% | trait:ambitious:0.3x |

**Human Ambitious with rival**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | rematch_rival | 15 | 21.00 | 45.16% | trait:ambitious:1.4x |
  | demon_duel | 10 | 16.00 | 34.41% | trait:ambitious:1.6x |
  | ambush | 8 | 8.00 | 17.20% | none |
  | do_nothing | 5 | 1.50 | 3.23% | trait:ambitious:0.3x |

**Human Cowardly (baseline)**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | demon_duel | 10 | 10.00 | 43.48% | none |
  | ambush | 8 | 8.00 | 34.78% | none |
  | do_nothing | 5 | 5.00 | 21.74% | none |

**Elf Ambitious (fey tag)**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | demon_duel | 10 | 16.00 | 62.75% | trait:ambitious:1.6x |
  | ambush | 8 | 8.00 | 31.37% | none |
  | do_nothing | 5 | 1.50 | 5.88% | trait:ambitious:0.3x |


### Band: 3-2

**Human Ambitious (baseline)**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | challenge_god | 10 | 20.00 | 62.70% | trait:ambitious:2x |
  | infiltrate_fortress | 8 | 10.40 | 32.60% | trait:ambitious:1.3x |
  | do_nothing | 5 | 1.50 | 4.70% | trait:ambitious:0.3x |

**Human Ambitious with rival**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | rematch_rival | 15 | 21.00 | 39.70% | trait:ambitious:1.4x |
  | challenge_god | 10 | 20.00 | 37.81% | trait:ambitious:2x |
  | infiltrate_fortress | 8 | 10.40 | 19.66% | trait:ambitious:1.3x |
  | do_nothing | 5 | 1.50 | 2.84% | trait:ambitious:0.3x |

**Human Cowardly (baseline)**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | challenge_god | 10 | 10.00 | 43.48% | none |
  | infiltrate_fortress | 8 | 8.00 | 34.78% | none |
  | do_nothing | 5 | 5.00 | 21.74% | none |

**Elf Ambitious (fey tag)**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | challenge_god | 10 | 20.00 | 62.70% | trait:ambitious:2x |
  | infiltrate_fortress | 8 | 10.40 | 32.60% | trait:ambitious:1.3x |
  | do_nothing | 5 | 1.50 | 4.70% | trait:ambitious:0.3x |


### Band: 1-0

**Human Ambitious (baseline)**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | cosmic_battle | 10 | 20.00 | 59.70% | trait:ambitious:2x |
  | reality_break | 8 | 12.00 | 35.82% | trait:ambitious:1.5x |
  | do_nothing | 5 | 1.50 | 4.48% | trait:ambitious:0.3x |

**Human Ambitious with rival**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | rematch_rival | 15 | 21.00 | 38.53% | trait:ambitious:1.4x |
  | cosmic_battle | 10 | 20.00 | 36.70% | trait:ambitious:2x |
  | reality_break | 8 | 12.00 | 22.02% | trait:ambitious:1.5x |
  | do_nothing | 5 | 1.50 | 2.75% | trait:ambitious:0.3x |

**Human Cowardly (baseline)**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | cosmic_battle | 10 | 10.00 | 43.48% | none |
  | reality_break | 8 | 8.00 | 34.78% | none |
  | do_nothing | 5 | 5.00 | 21.74% | none |

**Elf Ambitious (fey tag)**

  | Scenario | Base Weight | Final Weight | Probability | Modifiers |
  |----------|-------------|--------------|-------------|-----------|
  | cosmic_battle | 10 | 20.00 | 59.70% | trait:ambitious:2x |
  | reality_break | 8 | 12.00 | 35.82% | trait:ambitious:1.5x |
  | do_nothing | 5 | 1.50 | 4.48% | trait:ambitious:0.3x |


---

## Summary

- Total scenarios: 12
- Scenarios with weightMods: 12
- Carried tags in use: 2
- Bands analyzed: 10-9, 8-7, 6-4, 3-2, 1-0