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
  if (currentTrace.length === 0) {
    showElement('progress', false);
    return;
  }
  
  showElement('progress', true);
  
  const progressCurrent = document.getElementById('progress-current');
  const progressTotal = document.getElementById('progress-total');
  const progressFill = document.getElementById('progress-fill');
  const progressSummary = document.getElementById('progress-summary');
  
  if (progressCurrent) {
    progressCurrent.textContent = String(currentTraceIndex);
  }
  
  if (progressTotal) {
    progressTotal.textContent = String(currentTrace.length);
  }
  
  if (progressFill) {
    const percent = currentTrace.length > 0 ? (currentTraceIndex / currentTrace.length) * 100 : 0;
    progressFill.style.width = `${percent}%`;
  }
  
  if (progressSummary && currentRun && currentTraceIndex > 0) {
    const parts = [];
    if (currentRun.character.race) parts.push(gameData.races[currentRun.character.race]?.name || currentRun.character.race);
    if (currentRun.character.archetype) parts.push(gameData.archetypes[currentRun.character.archetype]?.name || currentRun.character.archetype);
    progressSummary.textContent = parts.length > 0 ? parts.join(' • ') : '';
  } else if (progressSummary) {
    progressSummary.textContent = '';
  }
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

// Start the app
init();
