// @ts-check

/**
 * Results rendering
 * Per FR-U2: Full build display and three scenarios with rarity
 */

/**
 * Render character build information
 * @param {any} character
 * @param {any} data
 * @returns {string} HTML string
 */
export function renderCharacter(character, data) {
  const parts = [];
  
  // Race
  if (character.race) {
    const race = data.races[character.race];
    parts.push(`<p><strong>Race:</strong> ${race?.name || character.race}</p>`);
  }
  
  // Archetype
  if (character.archetype) {
    const archetype = data.archetypes[character.archetype];
    parts.push(`<p><strong>Archetype:</strong> ${archetype?.name || character.archetype}</p>`);
  }
  
  // Size
  if (character.size) {
    const size = data.sizes[character.size];
    parts.push(`<p><strong>Size:</strong> ${size?.name || character.size}</p>`);
  }
  
  // Trait
  if (character.trait) {
    const trait = data.traits[character.trait];
    parts.push(`<p><strong>Trait:</strong> ${trait?.name || character.trait}</p>`);
  }
  
  // Power count
  if (character.powerCount !== undefined) {
    parts.push(`<p><strong>Power Count:</strong> ${character.powerCount === 'all' ? 'All powers' : character.powerCount}</p>`);
  }
  
  // Powers
  if (character.powers && character.powers.length > 0) {
    const powerNames = character.powers.map(id => data.powers[id]?.name || id);
    parts.push(`<p><strong>Powers:</strong> ${powerNames.join(', ')}</p>`);
  }
  
  // Strength tier and level
  if (character.strength !== undefined) {
    const tier = character.strength.tier;
    const level = character.strength.level;
    parts.push(`<p><strong>Strength:</strong> Tier ${tier} (Level ${level.toFixed(2)})</p>`);
  }
  
  // Speed tier with offset
  if (character.speed !== undefined) {
    const tier = character.speed.tier;
    const offset = character.speed.offset || 0;
    const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`;
    parts.push(`<p><strong>Speed:</strong> Tier ${tier} (${offsetStr})</p>`);
  }
  
  // Durability tier with offset
  if (character.durability !== undefined) {
    const tier = character.durability.tier;
    const offset = character.durability.offset || 0;
    const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`;
    parts.push(`<p><strong>Durability:</strong> Tier ${tier} (${offsetStr})</p>`);
  }
  
  // Weapon
  if (character.weapon) {
    const weaponType = data.weapons[character.weapon.type];
    const enchantment = character.weapon.enchantment ? data.weapons[character.weapon.enchantment] : null;
    const weaponStr = enchantment 
      ? `${enchantment.name} ${weaponType?.name || character.weapon.type}`
      : weaponType?.name || character.weapon.type;
    parts.push(`<p><strong>Weapon:</strong> ${weaponStr}</p>`);
  } else {
    parts.push(`<p><strong>Weapon:</strong> None</p>`);
  }
  
  // Band
  if (character.band) {
    parts.push(`<p><strong>Band:</strong> ${character.band}</p>`);
  }
  
  return parts.join('');
}

/**
 * Find opponent name from scenario trace
 * @param {any} scenario
 * @param {any} data
 * @returns {string|null}
 */
function findOpponentName(scenario, data) {
  const trace = scenario.trace || [];
  for (let i = trace.length - 1; i >= 0; i--) {
    const entry = trace[i];
    if (entry.stepType === 'pick' && entry.pickedId) {
      const pool = data.pools[entry.pool];
      const entity = pool && pool.find((/** @type {any} */ e) => e.id === entry.pickedId);
      if (entity) return entity.name;
    }
    if (entry.stepType === 'contest' && entry.opponent) {
      for (const pool of Object.values(data.pools)) {
        const entity = /** @type {any[]} */ (pool).find(e => e.id === entry.opponent);
        if (entity) return entity.name;
      }
    }
  }
  return null;
}

/**
 * Map outcome step ID to readable label
 * @param {string} stepId
 * @returns {string}
 */
function outcomeLabel(stepId) {
  const labels = {
    'won': 'Win',
    'lost': 'Lose',
    'fled': 'Fled',
    'stand': 'Standoff',
    'win': 'Win',
    'lose': 'Lose',
    'flee': 'Flee',
    'standoff': 'Standoff'
  };
  return labels[stepId] || stepId;
}

/**
 * Get CSS class for outcome
 * @param {string} stepId
 * @returns {string}
 */
function outcomeClass(stepId) {
  if (stepId === 'won' || stepId === 'win') return 'win';
  if (stepId === 'lost' || stepId === 'lose') return 'lose';
  if (stepId === 'fled' || stepId === 'flee') return 'fled';
  return 'standoff';
}

/**
 * Render scenarios
 * @param {any[]} scenarios
 * @param {any} data
 * @returns {string} HTML string
 */
export function renderScenarios(scenarios, data) {
  return scenarios.map((sc, i) => {
    const scenario = data.scenarios[sc.scenarioId] || {};
    const opponentName = findOpponentName(sc, data);
    const outcome = outcomeLabel(sc.finalStep);
    const outcomeCSS = outcomeClass(sc.finalStep);
    
    const carriedTags = (sc.emittedTags && sc.emittedTags.length > 0)
      ? `<div class="scenario-tags">Carried: ${sc.emittedTags.map(escapeHtml).join(', ')}</div>`
      : '';
    
    return `
      <div class="scenario">
        <div class="scenario-title">${i + 1}. ${escapeHtml(scenario.name || sc.scenarioId)}</div>
        ${opponentName ? `<div class="scenario-opponent">vs ${escapeHtml(opponentName)}</div>` : ''}
        <div class="scenario-outcome ${outcomeCSS}">${outcome}</div>
        <div class="scenario-text">"${escapeHtml(sc.text)}"</div>
        ${carriedTags}
      </div>
    `;
  }).join('');
}

/**
 * Render rarity information
 * @param {number|null} percentile
 * @returns {string} HTML string
 */
export function renderRarity(percentile) {
  if (percentile === null) {
    return 'Rarity data not available';
  }
  return `Rarer than ${percentile.toFixed(1)}% of runs`;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
