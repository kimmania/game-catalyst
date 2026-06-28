import {
  getTopColor,
  doPour,
  applyCatalyst,
  undo,
  isWin,
  createGameState,
} from './engine/game-logic';
import { PRIMARIES, getReaction } from './engine/constants';
import type { GameState, SaveData } from './engine/types.js';
import { loadSave, saveSave, getDefaultSave, completeLevel, clearSave } from './engine/storage';
import { getLevelById, fetchPuzzleBank, deriveTier } from './engine/puzzles';

const SAVE_DEBOUNCE = 500;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

let state: GameState | null = null;
let saveData: SaveData = getDefaultSave();
let currentLevelId: string | null = null;
let _levelLabel = 'Apprentice Bench';

// Cached DOM elements
const els = {
  introScreen: () => document.getElementById('intro-screen')!,
  gameScreen: () => document.getElementById('game-screen')!,
  startAdventure: () => document.getElementById('start-adventure')!,
  beakerContainer: () => document.getElementById('beaker-container')!,
  catalystBtn: () => document.getElementById('catalyst-btn') as HTMLButtonElement,
  catalystCount: () => document.getElementById('catalyst-count')!,
  reactionTable: () => document.getElementById('reaction-table')!,
  undoBtn: () => document.getElementById('undo-btn') as HTMLButtonElement,
  resetBtn: () => document.getElementById('reset-btn') as HTMLButtonElement,
  settingsBtn: () => document.getElementById('settings-btn') as HTMLButtonElement,
  helpBtn: () => document.getElementById('help-btn') as HTMLButtonElement,
  levelLabel: () => document.getElementById('level-label')!,
  levelNumber: () => document.getElementById('level-number')!,
  helpOverlay: () => document.getElementById('help-overlay')!,
  helpClose: () => document.getElementById('help-close')!,
  helpDismiss: () => document.getElementById('help-dismiss') as HTMLButtonElement,
  settingsOverlay: () => document.getElementById('settings-overlay')!,
  settingsClose: () => document.getElementById('settings-close')!,
  soundToggle: () => document.getElementById('sound-toggle') as HTMLButtonElement,
  musicToggle: () => document.getElementById('music-toggle') as HTMLButtonElement,
  motionToggle: () => document.getElementById('motion-toggle') as HTMLButtonElement,
  contrastToggle: () => document.getElementById('contrast-toggle') as HTMLButtonElement,
  resetProgressBtn: () => document.getElementById('reset-progress-btn') as HTMLButtonElement,
  resetConfirmBtn: () => document.getElementById('reset-confirm-btn') as HTMLButtonElement,
  levelCompleteOverlay: () => document.getElementById('level-complete-overlay')!,
  lcTitle: () => document.getElementById('lc-title')!,
  lcStars: () => document.getElementById('lc-stars')!,
  lcMoves: () => document.getElementById('lc-moves')!.querySelector('.value') as HTMLElement,
  lcBest: () => document.getElementById('lc-best')!.querySelector('.value') as HTMLElement,
  lcMessage: () => document.getElementById('lc-message')!,
  lcRetry: () => document.getElementById('lc-retry') as HTMLButtonElement,
  lcNext: () => document.getElementById('lc-next') as HTMLButtonElement,
  resetOverlay: () => document.getElementById('reset-overlay')!,
  resetCancel: () => document.getElementById('reset-cancel') as HTMLButtonElement,
  resetConfirm: () => document.getElementById('reset-confirm') as HTMLButtonElement,
};

function getLevelLabel(levelId: string): string {
  const tier = deriveTier(levelId);
  switch (tier) {
    case 'tutorial': return 'Apprentice Bench';
    case 'easy': return 'Apprentice Bench';
    case 'medium': return 'Master’s Altar';
    case 'hard': return 'Master’s Altar';
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
  bindEvents();

  const introSeen = saveData.hasSeenIntro;
  if (introSeen) {
    startLevel(saveData.currentLevel ?? 't1');
  } else {
    showScreen('intro-screen');
  }
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
  bindToggle(els.musicToggle(), 'music');
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

  els.lcRetry().addEventListener('click', () => {
    hideOverlay('level-complete-overlay');
    startLevel(currentLevelId ?? 't1');
  });
  els.lcNext().addEventListener('click', async () => {
    const next = nextLevelId(currentLevelId ?? 't1');
    hideOverlay('level-complete-overlay');
    await startLevel(next);
  });

  els.catalystBtn().addEventListener('click', handleCatalyst);
}

function nextLevelId(current: string): string {
  const m = current.match(/^([a-z]*)(\d+)$/i);
  if (!m) return 't1';
  const prefix = m[1] || 't';
  const num = parseInt(m[2], 10);
  return `${prefix}${num + 1}`;
}

function bindToggle(btn: HTMLButtonElement, key: keyof SaveData['settings']) {
  btn.addEventListener('click', () => {
    saveData.settings[key] = !saveData.settings[key];
    persistSave();
    syncToggleUI(btn, saveData.settings[key]);
    if (key === 'highContrast') {
      document.body.classList.toggle('high-contrast', !!saveData.settings.highContrast);
    }
  });
}

function syncToggleUI(btn: HTMLButtonElement, value: boolean) {
  btn.textContent = value ? 'On' : 'Off';
  btn.setAttribute('aria-checked', String(value));
}

function syncSettingsUI() {
  syncToggleUI(els.soundToggle(), saveData.settings.sound);
  syncToggleUI(els.musicToggle(), saveData.settings.music);
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

  _levelLabel = getLevelLabel(levelId);
  els.levelLabel().textContent = _levelLabel;

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
  renderBoard();
  syncCatalystUI();
  syncHeader();

  if (!saveData.hasSeenHelp) {
    requestAnimationFrame(() => {
      showOverlay('help-overlay');
    });
  }
}

function makeFallbackLevel() {
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
    if (state!.selectedBeaker === idx) b.classList.add('selected');

    b.addEventListener('click', () => handleBeakerTap(idx));
    b.addEventListener('pointerdown', (e) => {
      (e.target as HTMLElement).style.transform = 'scale(0.98)';
    });
    b.addEventListener('pointerup', (e) => {
      (e.target as HTMLElement).style.transform = '';
    });

    // crystals at very bottom
    for (const c of beaker.crystals) {
      const cEl = document.createElement('div');
      cEl.className = 'layer layer-crystal';
      cEl.dataset.color = c;
      b.appendChild(cEl);
    }

    for (const layer of beaker.layers) {
      const l = document.createElement('div');
      l.className = 'layer';
      l.dataset.color = layer;
      b.appendChild(l);
    }

    container.appendChild(b);
  });

  renderReactionTable();
}

function renderReactionTable() {
  const container = els.reactionTable();
  container.innerHTML = '';

  for (let i = 0; i < PRIMARIES.length; i++) {
    for (let j = 0; j < PRIMARIES.length; j++) {
      const cell = document.createElement('div');
      cell.className = 'reaction-cell';
      if (i === j) {
        cell.style.opacity = '0';
      } else {
        const reaction = getReaction(PRIMARIES[i], PRIMARIES[j]);
        const discovered = state?.discovered.has(`${PRIMARIES[i]},${PRIMARIES[j]}`);
        if (discovered && reaction) {
          cell.textContent = reaction;
          cell.dataset.color = reaction;
          cell.classList.add('discovered');
        } else if (reaction) {
          cell.textContent = '?';
        }
      }
      container.appendChild(cell);
    }
  }
}

function handleBeakerTap(idx: number) {
  if (!state) return;
  if (state.won) return;

  if (state.selectedBeaker === null) {
    if (state.beakers[idx].layers.length === 0) return; // cannot select empty beaker
    state.selectedBeaker = idx;
  } else if (state.selectedBeaker === idx) {
    state.selectedBeaker = null;
  } else {
    const src = state.selectedBeaker;
    const dest = idx;
    const result = doPour(state, src, dest);
    state.selectedBeaker = null;

    if (result.success) {
      postMove();
    } else {
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
  const result = applyCatalyst(state, state.selectedBeaker);
  if (result.success) {
    state.selectedBeaker = null;
    postMove();
    renderBoard();
    syncCatalystUI();
  } else {
    wobbleBeaker(state.selectedBeaker);
    state.selectedBeaker = null;
    renderBoard();
  }
}

function handleUndo() {
  if (!state) return;
  if (undo(state)) {
    syncCatalystUI();
    renderBoard();
  }
}

function postMove() {
  if (!state) return;
  if (isWin(state.beakers)) {
    state.won = true;
    const stars = computeStars();
    showWin(stars);
    saveData = completeLevel(saveData, state.levelId, stars);
    persistSave();
  } else {
    debounceSave();
  }
}

function computeStars(): number {
  if (!state) return 1;
  const target = (state as GameState & { targetMoves?: number }).targetMoves ?? 999;
  const stars =
    state.moves <= target && !state.solidificationOccurred ? 3 :
    state.moves <= target ? 2 :
    1;
  return stars;
}

function showWin(stars: number) {
  els.lcStars().textContent = ['⭐', '⭐⭐', '⭐⭐⭐'][Math.max(0, Math.min(2, stars - 1))] || '⭐';
  els.lcMoves().textContent = String(state!.moves);
  const best = saveData.progress.completed[state!.levelId] || 0;
  els.lcBest().textContent = best >= stars ? String(best) : String(stars);
  if (stars === 3) {
    els.lcMessage().textContent = 'Purity preserved. The Guild is overjoyed. A perfect solve!';
  } else if (stars === 2) {
    els.lcMessage().textContent = 'A solid effort. The Guild nods approvingly.';
  } else {
    els.lcMessage().textContent = 'The transmutation succeeded, albeit messily.';
  }
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

function debounceSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persistSave();
  }, SAVE_DEBOUNCE);
}

function persistSave() {
  saveSave(saveData);
}
