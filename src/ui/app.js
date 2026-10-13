// @ts-check

/**
 * Main application entry point
 * Per SRS M4: Run generateRun exactly once per run, replay trace, show results
 * Per FR-A3: UI never recomputes odds
 */

import { loadData, loadPercentiles } from './loader.js';
import { validate } from '../core/validate.js';
import { generateRun } from '../core/run.js';
import { Wheel, getStageLabel } from './wheel.js';
import { renderCharacter, renderScenarios, renderRarity } from './results.js';
import { computePercentile } from './rarity.js';
import { getRevealedPicks } from './anti-spoiler.js';

/** @type {any} */
let gameData = null;

/** @type {any} */
let percentilesData = null;

/** @type {Wheel|null} */
let wheel = null;

/** @type {any|null} */
let currentRun = null;

/** @type {number} */
let currentTraceIndex = 0;

/** @type {any[]} */
let currentTrace = [];

/** @type {boolean} */
let waitingForSpin = false;



/** @type {any[]} */
let runHistory = [];

/** @type {boolean} */
let debugMode = false;

/**
 * Initialize the application
 */
async function init() {
  try {
    showElement('loading', true);
    showElement('error', false);
    showElement('main', false);
    
    // Load data
    gameData = await loadData();
    percentilesData = await loadPercentiles();
    
    // Validate
    const validationResult = validate(gameData);
    if (!validationResult.valid) {
      throw new Error(`Validation failed:\n${validationResult.errors.join('\n')}`);
    }
    
    if (validationResult.warnings.length > 0) {
      console.warn('Validation warnings:', validationResult.warnings);
    }
    
    // Initialize wheel
    const wheelContainer = /** @type {HTMLElement} */ (document.getElementById('wheel'));
    wheel = new Wheel(wheelContainer);
    
    // Set up event listeners
    setupEventListeners();
    
    // Hide loading, show main
    showElement('loading', false);
    showElement('main', true);
    
    // Start first run
    startNewRun();
    
  } catch (error) {
    console.error('Initialization error:', error);
    showError(error.message);
    showElement('loading', false);
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  const spinButton = document.getElementById('spin-button');
  const skipButton = document.getElementById('skip-button');
  const skipAllButton = document.getElementById('skip-all-button');
  const seedInput = /** @type {HTMLInputElement} */ (document.getElementById('seed-input'));
  const debugToggle = /** @type {HTMLInputElement} */ (document.getElementById('debug-toggle'));
  
  if (spinButton) {
    spinButton.addEventListener('click', handleSpinClick);
  }
  
  if (skipButton) {
    skipButton.addEventListener('click', handleSkipToResult);
  }
  
  if (skipAllButton) {
    skipAllButton.addEventListener('click', handleSkipAll);
  }
  
  if (seedInput) {
    seedInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !wheel?.isAnimating) {
        startNewRun();
      }
    });
  }
  
  if (debugToggle) {
    debugToggle.addEventListener('change', () => {
      debugMode = debugToggle.checked;
      updateDebugPanel();
    });
  }
}

/**
 * Start a new run
 */
function startNewRun() {
  if (wheel) {
    wheel.cancel();
  }
  
  currentRun = null;
  currentTraceIndex = 0;
  currentTrace = [];
  waitingForSpin = false;
  
  showElement('results', false);
  showElement('skip-button', false);
  showElement('skip-all-button', false);
  
  const seedInput = /** @type {HTMLInputElement} */ (document.getElementById('seed-input'));
  let seed = seedInput ? seedInput.value.trim() : '';
  if (!seed) {
    seed = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  const seedDisplay = document.getElementById('seed-display');
  if (seedDisplay) {
    seedDisplay.textContent = `Seed: ${seed}`;
  }
  
  try {
    currentRun = generateRun(gameData, seed);
    currentTrace = currentRun.trace.filter((/** @type {any} */ e) => e.table && e.table.length > 0);
    currentTraceIndex = 0;
    
    if (currentTrace.length > 0) {
      showNextStage();
    } else {
      finishRun();
    }
  } catch (error) {
    console.error('Run generation error:', error);
    showError(`Failed to generate run: ${error.message}`);
  }
}

/**
 * Show next stage and wait for spin
 */
function showNextStage() {
  if (currentTraceIndex >= currentTrace.length) {
    finishRun();
    return;
  }
  
  const entry = currentTrace[currentTraceIndex];
  const stageLabel = document.getElementById('stage-label');
  const wheelStatus = document.getElementById('wheel-status');
  
  if (stageLabel) {
    stageLabel.textContent = getStageLabel(entry.stageId);
  }
  
  if (wheelStatus) {
    wheelStatus.textContent = 'Ready to spin';
  }
  
  // Show wheel in idle state
  if (wheel) {
    wheel.render(entry, gameData);
  }
  
  // Update progress
  updateProgress();
  
  // Enable spin button
  waitingForSpin = true;
  updateButtons();
}

/**
 * Handle spin button click
 */
function handleSpinClick() {
  if (!waitingForSpin || !wheel || wheel.isAnimating) return;
  
  waitingForSpin = false;
  updateButtons();
  
  const entry = currentTrace[currentTraceIndex];
  const wheelStatus = document.getElementById('wheel-status');
  
  const reducedMotionCheckbox = /** @type {HTMLInputElement|null} */ (document.getElementById('reduced-motion'));
  const reduceMotion = reducedMotionCheckbox?.checked || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  if (wheelStatus) {
    wheelStatus.textContent = reduceMotion ? 'Revealing...' : 'Spinning...';
  }
  
  showElement('skip-button', !reduceMotion);
  showElement('skip-all-button', !reduceMotion);
  
  wheel.animate(entry, gameData, (liveId) => {
    if (wheelStatus) {
      wheelStatus.textContent = liveId;
    }
  }, reduceMotion).then(() => {
    // Highlight picked wedge
    if (wheel) {
      wheel.render(entry, gameData);
    }
    
    if (wheelStatus) {
      wheelStatus.textContent = entry.pickedId;
    }
    
    currentTraceIndex++;
    showElement('skip-button', false);
    showElement('skip-all-button', false);
    
    // Update panels
    updateLastSpinPanel();
    updateRunHistoryPanel();
    updateDebugPanel();
    
    // Wait 500ms then next stage
    setTimeout(() => {
      if (currentTraceIndex < currentTrace.length) {
        showNextStage();
      } else {
        finishRun();
      }
    }, 500);
  });
}

/**
 * Handle skip to result
 */
function handleSkipToResult() {
  if (!wheel || !wheel.isAnimating) return;
  
  wheel.cancel();
  
  const entry = currentTrace[currentTraceIndex];
  const wheelStatus = document.getElementById('wheel-status');
  
  wheel.animate(entry, gameData, (liveId) => {
    if (wheelStatus) {
      wheelStatus.textContent = liveId;
    }
  }, true).then(() => {
    if (wheel) {
      wheel.render(entry, gameData);
    }
    
    if (wheelStatus) {
      wheelStatus.textContent = entry.pickedId;
    }
    
    currentTraceIndex++;
    showElement('skip-button', false);
    showElement('skip-all-button', false);
    
    setTimeout(() => {
      if (currentTraceIndex < currentTrace.length) {
        showNextStage();
      } else {
        finishRun();
      }
    }, 500);
  });
}

/**
 * Handle skip all
 */
function handleSkipAll() {
  if (wheel) {
    wheel.cancel();
  }
  
  showElement('skip-button', false);
  showElement('skip-all-button', false);
  
  // Jump to end
  currentTraceIndex = currentTrace.length;
  finishRun();
}

/**
 * Finish the run and show results
 */
function finishRun() {
  if (!currentRun) return;
  
  const stageLabel = document.getElementById('stage-label');
  const wheelStatus = document.getElementById('wheel-status');
  if (stageLabel) stageLabel.textContent = '';
  if (wheelStatus) wheelStatus.textContent = 'Complete!';
  
  if (wheel) {
    wheel.clear();
  }
  
  displayResults();
  showElement('results', true);
  waitingForSpin = false;
  updateButtons();
  
  // Add to run history
  runHistory.unshift({
    seed: document.getElementById('seed-display')?.textContent || 'unknown',
    character: currentRun.character,
    logProbability: currentRun.logProbability,
    timestamp: Date.now()
  });
  if (runHistory.length > 10) runHistory = runHistory.slice(0, 10);
  updateRunHistoryPanel();
}

/**
 * Display results
 * Per FR-U2: Full build and three scenarios with rarity
 */
function displayResults() {
  if (!currentRun) return;
  
  const characterInfo = document.getElementById('character-info');
  const scenariosInfo = document.getElementById('scenarios-info');
  const rarityInfo = document.getElementById('rarity-info');
  
  if (characterInfo) {
    characterInfo.innerHTML = renderCharacter(currentRun.character, gameData);
  }
  
  if (scenariosInfo) {
    scenariosInfo.innerHTML = renderScenarios(currentRun.scenarios, gameData);
  }
  
  if (rarityInfo) {
    const percentile = computePercentile(currentRun.logProbability, percentilesData);
    rarityInfo.textContent = renderRarity(percentile);
  }
}

/**
 * Update button states
 */
function updateButtons() {
  const spinButton = /** @type {HTMLButtonElement|null} */ (document.getElementById('spin-button'));
  
  if (spinButton) {
    if (waitingForSpin && !wheel?.isAnimating) {
      spinButton.disabled = false;
      spinButton.textContent = currentTraceIndex === 0 ? 'Start Run' : 'Spin the Wheel';
    } else {
      spinButton.disabled = true;
      spinButton.textContent = wheel?.isAnimating ? 'Spinning...' : 'Start Run';
    }
  }
}

/**
 * Update progress display
 */
function updateProgress() {
  if (!currentRun) {
    showElement('progress', false);
    return;
  }
  
  showElement('progress', true);
  
  const progressCurrent = document.getElementById('progress-current');
  const progressTotal = document.getElementById('progress-total');
  const progressFill = document.getElementById('progress-fill');
  
  // M = total picks in trace (stages + scenarios)
  const totalPicks = currentRun.trace.filter((/** @type {any} */ e) => e.pickedId).length;
  
  // N = completed spins (currentTraceIndex is next to show, so completed = currentTraceIndex)
  const completedSpins = currentTraceIndex;
  
  if (progressCurrent) {
    progressCurrent.textContent = String(completedSpins);
  }
  
  if (progressTotal) {
    progressTotal.textContent = String(totalPicks);
  }
  
  if (progressFill) {
    const percent = totalPicks > 0 ? (completedSpins / totalPicks) * 100 : 0;
    progressFill.style.width = `${percent}%`;
  }
}

/**
 * Format stage result with label
 * @param {string} stageId
 * @param {string} pickedId
 * @returns {string}
 */
function formatStageResult(stageId, pickedId) {
  if (stageId === 'race') return gameData.races[pickedId]?.name || pickedId;
  if (stageId === 'archetype') return gameData.archetypes[pickedId]?.name || pickedId;
  if (stageId === 'size') return gameData.sizes[pickedId]?.name || pickedId;
  if (stageId === 'trait') return gameData.traits[pickedId]?.name || pickedId;
  if (stageId === 'powerCount') return pickedId === 'all' ? 'All powers' : `${pickedId} powers`;
  if (stageId.startsWith('powers:')) {
    return gameData.powers[pickedId]?.name || pickedId;
  }
  if (stageId === 'strength') return `Tier ${pickedId}`;
  if (stageId === 'speedOffset') return pickedId === '0' ? 'Speed +0' : `Speed ${pickedId}`;
  if (stageId === 'durOffset') return pickedId === '0' ? 'Durability +0' : `Durability ${pickedId}`;
  if (stageId === 'weapon') return pickedId === 'yes' ? 'Has weapon' : 'No weapon';
  if (stageId === 'weapon:type') return gameData.weapons[pickedId]?.name || pickedId;
  if (stageId === 'weapon:enchantment') return gameData.weapons[pickedId]?.name || pickedId;
  return pickedId;
}

/**
 * Show or hide an element
 * @param {string} id
 * @param {boolean} show
 */
function showElement(id, show) {
  const element = document.getElementById(id);
  if (element) {
    if (show) {
      element.classList.remove('hidden');
    } else {
      element.classList.add('hidden');
    }
  }
}

/**
 * Show error message
 * @param {string} message
 */
function showError(message) {
  const errorElement = document.getElementById('error');
  if (errorElement) {
    errorElement.textContent = message;
    showElement('error', true);
  }
}

/**
 * Update last spin panel (anti-spoiler: only show completed spin)
 */
function updateLastSpinPanel() {
  const panel = document.getElementById('last-spin-panel');
  const content = document.getElementById('last-spin-content');
  if (!panel || !content || !currentRun) return;
  
  const revealed = getRevealedPicks(currentTraceIndex, currentRun.trace);
  if (revealed.length === 0) {
    showElement('last-spin-panel', false);
    return;
  }
  
  const lastPick = revealed[revealed.length - 1];
  showElement('last-spin-panel', false);
  content.textContent = `Stage: ${lastPick.stageId}\nPicked: ${lastPick.pickedId}`;
  showElement('last-spin-panel', true);
}

/**
 * Update run history panel
 */
function updateRunHistoryPanel() {
  const panel = document.getElementById('run-history-panel');
  const content = document.getElementById('run-history-content');
  if (!panel || !content || !currentRun) return;
  
  const lines = [];
  
  // Current run revealed picks (anti-spoiler: only show spins that have completed)
  const shouldReveal = getRevealedPicks(currentTraceIndex, currentRun.trace);
  if (shouldReveal.length > 0) {
    lines.push('Current Run:');
    shouldReveal.forEach(pick => {
      const stageName = getStageLabelLocal(pick.stageId);
      const result = formatStageResult(pick.stageId, pick.pickedId);
      lines.push(`  ${stageName}: ${result}`);
    });
  }
  
  // Past runs
  if (runHistory.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('Past Runs:');
    runHistory.forEach((run, i) => {
      const race = run.character.race ? gameData.races[run.character.race]?.name || run.character.race : '?';
      const arch = run.character.archetype ? gameData.archetypes[run.character.archetype]?.name || run.character.archetype : '?';
      lines.push(`  ${i + 1}. ${race} ${arch} (logP=${run.logProbability.toFixed(2)})`);
    });
  }
  
  if (lines.length === 0) {
    showElement('run-history-panel', false);
    return;
  }
  
  content.textContent = lines.join('\n');
  showElement('run-history-panel', true);
}

/**
 * Get stage label for display (local implementation)
 * @param {string} stageId
 * @returns {string}
 */
function getStageLabelLocal(stageId) {
  const labels = {
    'race': 'Race',
    'archetype': 'Archetype',
    'size': 'Size',
    'trait': 'Trait',
    'powerCount': 'Power Count',
    'strength': 'Strength Tier',
    'speedOffset': 'Speed',
    'durOffset': 'Durability',
    'weapon': 'Weapon',
    'weapon:type': 'Weapon Type',
    'weapon:enchantment': 'Weapon Enchantment'
  };
  
  if (stageId.startsWith('powers:')) {
    return `Power ${parseInt(stageId.split(':')[1]) + 1}`;
  }
  
  return labels[stageId] || stageId;
}

/**
 * Update debug panel
 */
function updateDebugPanel() {
  const panel = document.getElementById('debug-panel');
  const content = document.getElementById('debug-content');
  if (!panel || !content) return;
  
  showElement('debug-panel', true);
  
  if (!debugMode) {
    content.textContent = '';
    return;
  }
  
  const lines = [
    `Current trace index: ${currentTraceIndex} / ${currentTrace.length}`
  ];
  
  if (currentRun) {
    const revealed = getRevealedPicks(currentTraceIndex, currentRun.trace);
    lines.push(`Revealed picks: ${revealed.length}`);
    lines.push(`Picks: ${revealed.map(p => `${p.stageId}=${p.pickedId}`).join(', ')}`);
    lines.push(`Log probability: ${currentRun.logProbability.toFixed(4)}`);
    lines.push(`Effective strength: ${currentRun.effStr.toFixed(2)}`);
  }
  
  content.textContent = lines.join('\n');
}

// Start the app
init();
