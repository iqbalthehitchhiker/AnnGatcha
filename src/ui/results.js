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
  const race = data.races[character.race] || {};
  const archetype = data.archetypes[character.archetype] || {};
  const size = data.sizes[character.size] || {};
  const trait = data.traits[character.trait] || {};
  
  const powers = (character.powers || [])
    .map(id => (data.powers[id] || {}).name || id)
    .join(', ') || 'None';
  
  let weapon = 'None';
  if (character.weapon) {
    const type = data.weapons.types[character.weapon.type] || {};
    const ench = data.weapons.enchantments[character.weapon.enchantment] || {};
    weapon = `${type.name || character.weapon.type} + ${ench.name || character.weapon.enchantment}`;
  }
  
  const tier = 10 - Math.floor(character.strength);
  
  return `
    <div class="info-row">
      <span class="info-label">Race:</span>
      <span class="info-value">${race.name || character.race}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Archetype:</span>
      <span class="info-value">${archetype.name || character.archetype}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Size:</span>
      <span class="info-value">${size.name || character.size}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Trait:</span>
      <span class="info-value">${trait.name || character.trait}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Powers:</span>
      <span class="info-value">${powers}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Weapon:</span>
      <span class="info-value">${weapon}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Strength Tier:</span>
      <span class="info-value">${tier}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Band:</span>
      <span class="info-value">${escapeHtml(renderBand(character))}</span>
    </div>
  `;
}

/**
 * Render band (derived from character stats per requirement)
 * @param {any} character
 * @returns {string}
 */
function renderBand(character) {
  // Band is in the result, but we can also compute it for display
  // Per FR-X1: Band from effective strength
  let effStr = character.strength;
  if (character.weapon) {
    // This is a simplified calculation - the actual one is in core
    effStr = character.strength; // The result should contain band already
  }
  const bandTier = 10 - Math.floor(effStr);
  
  // Map tier to band
  if (bandTier >= 10 || bandTier === 9) return '10-9';
  if (bandTier === 8 || bandTier === 7) return '8-7';
  if (bandTier >= 4 && bandTier <= 6) return '6-4';
  if (bandTier === 3 || bandTier === 2) return '3-2';
  if (bandTier <= 1) return '1-0';
  return 'unknown';
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
