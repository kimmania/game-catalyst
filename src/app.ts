import {
  getTopColor,
  doPour,
  applyCatalyst,
  undo,
  isWin,
  hasValidMoves,
  createGameState,
} from './engine/game-logic';
import { REACTION_PAIRS, COLOR_NAME } from './engine/constants';
import type { GameState, SaveData, LevelData } from './engine/types';
import { loadSave, saveSave, getDefaultSave, completeLevel, clearSave } from './engine/storage';
import { getLevelById, fetchPuzzleBank, deriveTier } from './engine/puzzles';
import { renderHelpVisuals } from './engine/renderHelpVisuals';
import { playPour, playInvalid, playCatalyst, playWin } from './engine/audio';

const SAVE_DEBOUNCE = 500;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

let state: GameState | null = null;
let saveData: SaveData = getDefaultSave();
let currentLevelId: string | null = null;
let keyboardIndex = 0;

let lastAction: { type: 'solidify' | 'catalyst'; beakerIndex: number } | null = null;

const TIER_ORDER = ['tutorial', 'easy', 'medium', 'hard', 'expert', 'master'];

// Cached DOM elements
const els = {
  introScreen: () => document.getElementById('intro-screen')!,
  gameScreen: () => document.getElementById('game-screen')!,
  startAdventure: () => document.getElementById('start-adventure')!,
  beakerContainer: () => document.getElementById('beaker-container')!,
  catalystBtn: () => document.getElementById('catalyst-btn') as HTMLButtonElement,
  catalystCount: () => document.getElementById('catalyst-count')!,
  reactionTable: () => document.getElementById('reaction-table')!,
  reactionTableWrap: () => document.getElementById('reaction-table-wrap')!,
  undoBtn: () => document.getElementById('undo-btn') as HTMLButtonElement,
  resetBtn: () => document.getElementById('reset-btn') as HTMLButtonElement,
  settingsBtn: () => document.getElementById('settings-btn') as HTMLButtonElement,
  helpBtn: () => document.getElementById('help-btn') as HTMLButtonElement,
  levelLabel: () => document.getElementById('level-label')!,
  levelNumber: () => document.getElementById('level-number')!,
  moveCount: () => document.getElementById('move-count')!,
  helpOverlay: () => document.getElementById('help-overlay')!,
  helpClose: () => document.getElementById('help-close')!,
  helpDismiss: () => document.getElementById('help-dismiss') as HTMLButtonElement,
  settingsOverlay: () => document.getElementById('settings-overlay')!,
  settingsClose: () => document.getElementById('settings-close')!,
  soundToggle: () => document.getElementById('sound-toggle') as HTMLButtonElement,
  motionToggle: () => document.getElementById('motion-toggle') as HTMLButtonElement,
  contrastToggle: () => document.getElementById('contrast-toggle') as HTMLButtonElement,
  resetProgressBtn: () => document.getElementById('reset-progress-btn') as HTMLButtonElement,
  resetConfirmBtn: () => document.getElementById('reset-confirm-btn') as HTMLButtonElement,
  levelCompleteOverlay: () => document.getElementById('level-complete-overlay')!,
  lcTitle: () => document.getElementById('lc-title')!,
  lcStars: () => document.getElementById('lc-stars')!,
  lcStarsVal: () => document.getElementById('lc-stars-val') as HTMLElement | null,
  lcMoves: () => document.getElementById('lc-moves')!.querySelector('.value') as HTMLElement,
  lcTarget: () => document.getElementById('lc-target')!.querySelector('.value') as HTMLElement,
  lcSolidify: () => document.getElementById('lc-solidify')!.querySelector('.value') as HTMLElement,
  lcBest: () => document.getElementById('lc-best')!.querySelector('.value') as HTMLElement,
  lcMessage: () => document.getElementById('lc-message')!,
  lcRetry: () => document.getElementById('lc-retry') as HTMLButtonElement,
  lcNext: () => document.getElementById('lc-next') as HTMLButtonElement,
  resetOverlay: () => document.getElementById('reset-overlay')!,
  resetCancel: () => document.getElementById('reset-cancel') as HTMLButtonElement,
  resetConfirm: () => document.getElementById('reset-confirm') as HTMLButtonElement,
  stuckOverlay: () => document.getElementById('stuck-overlay')!,
  stuckCancel: () => document.getElementById('stuck-cancel') as HTMLButtonElement,
  stuckRestart: () => document.getElementById('stuck-restart') as HTMLButtonElement,
  announcer: () => document.getElementById('aria-announcer')!,
};

function getLevelLabel(levelId: string): string {
  const tier = deriveTier(levelId);
  switch (tier) {
    case 'tutorial': return 'Apprentice Bench';
    case 'easy': return 'Apprentice Bench';
    case 'medium': return 'Master\u2019s Altar';
    case 'hard': return 'Master\u2019s Altar';
    case 'expert': return 'Forbidden Vault';
    case 'master': return 'Forbidden Vault';
    default: return 'Apprentice Bench';
  }
}

function showScreen(id: string) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

export function bootstrap() {
  saveData = loadSave();
  applyBodyClasses();
  bindEvents();
  bindKeyboard();

  const introSeen = saveData.hasSeenIntro;
  if (introSeen) {
    startLevel(saveData.currentLevel ?? 't1');
  } else {
    showScreen('intro-screen');
  }
}

function applyBodyClasses() {
  document.body.classList.toggle('high-contrast', !!saveData.settings.highContrast);
  document.body.classList.toggle('reduced-motion', !!saveData.settings.reducedMotion);
}

function bindEvents() {
  els.startAdventure().addEventListener('click', () => {
    saveData.hasSeenIntro = true;
    persistSave();
    startLevel(saveData.currentLevel ?? 't1');
  });

  els.undoBtn().addEventListener('click', handleUndo);
  els.resetBtn().addEventListener('click', () => {
    showOverlay('reset-overlay');
  });
  els.settingsBtn().addEventListener('click', () => {
    syncSettingsUI();
    showOverlay('settings-overlay');
  });
  els.helpBtn().addEventListener('click', () => {
    showOverlay('help-overlay');
  });

  els.helpClose().addEventListener('click', () => hideOverlay('help-overlay'));
  els.helpDismiss().addEventListener('click', () => {
    hideOverlay('help-overlay');
    saveData.hasSeenHelp = true;
    persistSave();
  });

  els.settingsClose().addEventListener('click', () => hideOverlay('settings-overlay'));

  bindToggle(els.soundToggle(), 'sound');
  bindToggle(els.motionToggle(), 'reducedMotion');
  bindToggle(els.contrastToggle(), 'highContrast');

  els.resetProgressBtn().addEventListener('click', () => {
    els.resetProgressBtn().classList.add('hidden');
    els.resetConfirmBtn().classList.remove('hidden');
  });
  els.resetConfirmBtn().addEventListener('click', () => {
    clearSave();
    saveData = getDefaultSave();
    persistSave();
    hideOverlay('settings-overlay');
    location.reload();
  });

  els.resetCancel().addEventListener('click', () => hideOverlay('reset-overlay'));
  els.resetConfirm().addEventListener('click', () => {
    hideOverlay('reset-overlay');
    startLevel(currentLevelId ?? 't1');
  });

  els.stuckCancel().addEventListener('click', () => hideOverlay('stuck-overlay'));
  els.stuckRestart().addEventListener('click', () => {
    hideOverlay('stuck-overlay');
    startLevel(currentLevelId ?? 't1');
  });

  els.lcRetry().addEventListener('click', () => {
    hideOverlay('level-complete-overlay');
    startLevel(currentLevelId ?? 't1');
  });
  els.lcNext().addEventListener('click', async () => {
    const next = await resolveNextLevelId(currentLevelId ?? 't1');
    hideOverlay('level-complete-overlay');
    await startLevel(next);
  });

  els.catalystBtn().addEventListener('click', handleCatalyst);

  // Backdrop click to close overlays
  for (const overlayId of ['help-overlay', 'settings-overlay', 'reset-overlay', 'stuck-overlay']) {
    const overlay = document.getElementById(overlayId);
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) hideOverlay(overlayId);
    });
  }
}

function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
      return;
    }

    if (isOverlayOpen()) return;

    if (e.key === 'Tab') {
      // Let default tab behavior move focus; we track selected beaker separately.
      return;
    }

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveKeyboardSelection(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveKeyboardSelection(-1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleBeakerTap(keyboardIndex);
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      handleCatalyst();
    } else if (e.key === 'u' || e.key === 'U' || (e.ctrlKey && e.key === 'z')) {
      e.preventDefault();
      handleUndo();
    } else if (e.key === '?' || e.key === '/') {
      e.preventDefault();
      showOverlay('help-overlay');
    }
  });
}

function isOverlayOpen(): boolean {
  return document.querySelectorAll('.overlay.active').length > 0;
}

function moveKeyboardSelection(delta: number) {
  if (!state) return;
  const n = state.beakers.length;
  if (n === 0) return;
  keyboardIndex = (keyboardIndex + delta + n) % n;
  state.selectedBeaker = keyboardIndex;
  renderBoard();
  syncCatalystUI();
  const beaker = els.beakerContainer().children[keyboardIndex] as HTMLElement | undefined;
  beaker?.focus({ preventScroll: true });
}

async function resolveNextLevelId(current: string): Promise<string> {
  const currentTier = deriveTier(current);
  const tierIndex = TIER_ORDER.indexOf(currentTier);
  const bank = await fetchPuzzleBank(currentTier);
  const currentNumMatch = current.match(/^(?:[a-z]*)(\d+)$/i);
  const currentNum = currentNumMatch ? parseInt(currentNumMatch[1], 10) : 1;

  // Try next number in same tier
  const sameTierNext = bank.find((l) => {
    const m = l.id.match(/^(?:[a-z]*)(\d+)$/i);
    return m && parseInt(m[1], 10) === currentNum + 1;
  });
  if (sameTierNext) return sameTierNext.id;

  // Roll over to first level of next tier
  const nextTier = TIER_ORDER[tierIndex + 1];
  if (nextTier) {
    const nextBank = await fetchPuzzleBank(nextTier);
    if (nextBank.length) return nextBank[0].id;
  }

  // Loop back to tutorial start
  const tutorialBank = await fetchPuzzleBank('tutorial');
  if (tutorialBank.length) return tutorialBank[0].id;
  return 't1';
}

function bindToggle(btn: HTMLButtonElement, key: keyof SaveData['settings']) {
  btn.addEventListener('click', () => {
    saveData.settings[key] = !saveData.settings[key];
    persistSave();
    syncToggleUI(btn, saveData.settings[key]);
    if (key === 'highContrast') {
      document.body.classList.toggle('high-contrast', !!saveData.settings.highContrast);
    }
    if (key === 'reducedMotion') {
      document.body.classList.toggle('reduced-motion', !!saveData.settings.reducedMotion);
    }
  });
}

function syncToggleUI(btn: HTMLButtonElement, value: boolean) {
  btn.setAttribute('aria-checked', String(value));
  const label = btn.querySelector('.toggle-label');
  if (label) label.textContent = value ? 'On' : 'Off';
}

function syncSettingsUI() {
  syncToggleUI(els.soundToggle(), saveData.settings.sound);
  syncToggleUI(els.motionToggle(), saveData.settings.reducedMotion);
  syncToggleUI(els.contrastToggle(), saveData.settings.highContrast);
}

function showOverlay(id: string) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function hideOverlay(id: string) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

async function startLevel(levelId: string) {
  currentLevelId = levelId;
  saveData.currentLevel = levelId;
  persistSave();
  keyboardIndex = 0;

  els.levelLabel().textContent = getLevelLabel(levelId);

  const level = await getLevelById(levelId);
  if (!level) {
    // Fallback: load bank and pick first available
    const tier = deriveTier(levelId);
    const bank = await fetchPuzzleBank(tier);
    if (bank.length) {
      await startLevel(bank[0].id);
    } else {
      // Last resort: generate a simple 3-color level client-side
      const fallback = makeFallbackLevel();
      state = createGameState(fallback);
    }
    return;
  }

  state = createGameState(level);
  showScreen('game-screen');
  lastAction = null;
  renderBoard();
  syncCatalystUI();
  syncHeader();
  syncMoveCount();

  if (!saveData.hasSeenHelp) {
    saveData.hasSeenHelp = true;
    persistSave();
    renderHelpVisuals();
    showOverlay('help-overlay');
  }
}

function makeFallbackLevel(): LevelData {
  return {
    id: 't1',
    lab: 'Apprentice Bench',
    tier: 'tutorial',
    beakers: [
      { layers: ['crimson', 'crimson', 'amber', 'amber'] },
      { layers: ['amber', 'amber', 'crimson', 'crimson'] },
      { layers: [] },
    ],
    heights: [4, 4, 4],
    catalysts: 3,
    targetMoves: 8,
  };
}

function renderBoard() {
  if (!state) return;
  const container = els.beakerContainer();
  container.innerHTML = '';

  state.beakers.forEach((beaker, idx) => {
    const b = document.createElement('div');
    b.className = 'beaker';
    b.dataset.index = String(idx);
    b.tabIndex = 0;
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', `Beaker ${idx + 1}`);
    if (state!.selectedBeaker === idx) b.classList.add('selected');
    if (keyboardIndex === idx && !isOverlayOpen()) b.classList.add('keyboard-focus');

    b.addEventListener('click', () => handleBeakerTap(idx));

    const animateSolidify = lastAction?.type === 'solidify' && lastAction.beakerIndex === idx;
    const animateCatalyst = lastAction?.type === 'catalyst' && lastAction.beakerIndex === idx;

    // crystals at very bottom
    for (const c of beaker.crystals) {
      const cEl = document.createElement('div');
      cEl.className = 'layer layer-crystal';
      if (animateSolidify) cEl.classList.add('forming');
      cEl.dataset.color = c;
      b.appendChild(cEl);
    }

    for (let li = 0; li < beaker.layers.length; li++) {
      const layer = beaker.layers[li];
      const l = document.createElement('div');
      l.className = 'layer';
      l.dataset.color = layer;
      // The top two layers in a catalyst target are the freshly-split parents.
      if (animateCatalyst && li >= beaker.layers.length - 2) {
        l.classList.add('splitting');
      }
      b.appendChild(l);
    }

    container.appendChild(b);
  });

  renderReactionTable();
}

function renderReactionTable() {
  const container = els.reactionTable();
  container.innerHTML = '';

  const wrap = els.reactionTableWrap();
  if (!state || state.discovered.size === 0) {
    wrap.classList.add('empty');
    return;
  }
  wrap.classList.remove('empty');

  for (const [a, b, result] of REACTION_PAIRS) {
    const forward = state.discovered.has(`${a},${b}`);
    const reverse = state.discovered.has(`${b},${a}`);
    if (!forward && !reverse) continue;

    const row = document.createElement('div');
    row.className = 'reaction-row';

    const dot = (color: string, label: string) => {
      const el = document.createElement('span');
      el.className = 'reaction-dot';
      el.dataset.color = color;
      el.setAttribute('aria-label', label);
      el.title = label;
      return el;
    };

    row.appendChild(dot(a, COLOR_NAME[a] ?? a));

    const plus = document.createElement('span');
    plus.className = 'reaction-operator';
    plus.textContent = '+';
    row.appendChild(plus);

    row.appendChild(dot(b, COLOR_NAME[b] ?? b));

    const arrow = document.createElement('span');
    arrow.className = 'reaction-operator';
    arrow.textContent = '→';
    row.appendChild(arrow);

    const out = document.createElement('span');
    out.className = 'reaction-output';
    out.textContent = COLOR_NAME[result] ?? result;
    out.dataset.color = result;
    row.appendChild(out);

    container.appendChild(row);
  }
}

function handleBeakerTap(idx: number) {
  if (!state) return;
  if (state.won) return;
  keyboardIndex = idx;

  if (state.selectedBeaker === null) {
    if (state.beakers[idx].layers.length === 0) return; // cannot select empty beaker
    state.selectedBeaker = idx;
  } else if (state.selectedBeaker === idx) {
    state.selectedBeaker = null;
  } else {
    const src = state.selectedBeaker;
    const dest = idx;
    const beforeSolidified = state.solidificationOccurred;
    const result = doPour(state, src, dest);
    state.selectedBeaker = null;

    if (result.success) {
      playPour();
      if (!beforeSolidified && state.solidificationOccurred) {
        lastAction = { type: 'solidify', beakerIndex: dest };
      }
      postMove();
    } else {
      playInvalid();
      wobbleBeaker(dest);
    }
  }

  renderBoard();
  syncCatalystUI();
}

function wobbleBeaker(idx: number) {
  const container = els.beakerContainer();
  const b = container.children[idx] as HTMLElement | undefined;
  if (!b) return;
  b.classList.remove('invalid');
  void b.offsetWidth;
  b.classList.add('invalid');
  setTimeout(() => b.classList.remove('invalid'), 400);
}

function handleCatalyst() {
  if (!state) return;
  if (state.selectedBeaker === null) return;
  const beakerIndex = state.selectedBeaker;
  const result = applyCatalyst(state, beakerIndex);
  if (result.success) {
    playCatalyst();
    lastAction = { type: 'catalyst', beakerIndex };
    state.selectedBeaker = null;
    postMove();
    renderBoard();
    syncCatalystUI();
  } else {
    playInvalid();
    wobbleBeaker(state.selectedBeaker);
    state.selectedBeaker = null;
    renderBoard();
  }
}

function handleUndo() {
  if (!state) return;
  if (undo(state)) {
    lastAction = null;
    syncCatalystUI();
    renderBoard();
    syncMoveCount();
  }
}

function postMove() {
  if (!state) return;
  syncMoveCount();
  if (isWin(state.beakers)) {
    state.won = true;
    const stars = computeStars();
    playWin();
    showWin(stars);
    saveData = completeLevel(saveData, state.levelId, stars, state.moves);
    persistSave();
  } else if (!hasValidMoves(state)) {
    showOverlay('stuck-overlay');
    announce('No valid moves remain. Try restarting the level.');
  } else {
    debounceSave();
  }
}

function computeStars(): number {
  if (!state) return 1;
  const target = state.targetMoves ?? 999;
  const stars =
    state.moves <= target && !state.solidificationOccurred ? 3 :
    state.moves <= target ? 2 :
    1;
  return stars;
}

function showWin(stars: number) {
  if (!state) return;
  const starText = ['⭐', '⭐⭐', '⭐⭐⭐'][Math.max(0, Math.min(2, stars - 1))] || '⭐';
  els.lcStars().textContent = starText;
  const lcStarsVal = els.lcStarsVal();
  if (lcStarsVal) lcStarsVal.textContent = String(stars);
  els.lcMoves().textContent = String(state.moves);
  els.lcTarget().textContent = String(state.targetMoves);
  els.lcSolidify().textContent = state.solidificationOccurred ? 'Yes' : 'None';

  const bestMoves = saveData.progress.bestMoves[state.levelId];
  const displayBest = bestMoves === undefined ? state.moves : bestMoves;
  els.lcBest().textContent = String(displayBest);

  if (stars === 3) {
    els.lcMessage().textContent = 'Purity preserved. The Guild is overjoyed. A perfect solve!';
  } else if (stars === 2) {
    els.lcMessage().textContent = 'A solid effort. The Guild nods approvingly.';
  } else {
    els.lcMessage().textContent = 'The transmutation succeeded, albeit messily.';
  }
  announce(`Level complete! ${stars} out of 3 stars.`);
  showOverlay('level-complete-overlay');
}

function syncCatalystUI() {
  if (!state) return;
  els.catalystCount().textContent = String(state.catalystCharges);
  const enabled =
    state.selectedBeaker !== null &&
    state.catalystCharges > 0 &&
    state.beakers[state.selectedBeaker].layers.length > 0 &&
    !!getTopColor(state.beakers[state.selectedBeaker]);
  els.catalystBtn().disabled = !enabled;
}

function syncHeader() {
  els.levelNumber().textContent = currentLevelId ?? 'Level 1';
}

function syncMoveCount() {
  if (!state) return;
  els.moveCount().textContent = String(state.moves);
}

function announce(message: string) {
  const el = els.announcer();
  el.textContent = '';
  // Force DOM reflow so repeated identical messages are re-announced.
  void el.offsetWidth;
  el.textContent = message;
}

function debounceSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persistSave();
  }, SAVE_DEBOUNCE);
}

function persistSave() {
  saveSave(saveData);
}
