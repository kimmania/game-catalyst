import {
  getTopColor,
  doPour,
  applyCatalyst,
  undo,
  isWin,
  hasValidMoves,
  createGameState,
} from './engine/game-logic';
import { REACTION_PAIRS, COLOR_NAME, REACTION_LORE, getReaction } from './engine/constants';
import type { GameState, SaveData, LevelData, Beaker } from './engine/types';
import { loadSave, saveSave, getDefaultSave, completeLevel, clearSave } from './engine/storage';
import { fetchPuzzleBank, getLevelById, deriveTier } from './engine/puzzles';
import { renderHelpVisuals } from './engine/renderHelpVisuals';
import { play, startMusic, stopMusic, refreshSettings, listenForAudioUnlock } from './engine/audio';

const SAVE_DEBOUNCE = 500;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

let state: GameState | null = null;
let saveData: SaveData = getDefaultSave();
let currentLevelId: string | null = null;
let keyboardIndex = 0;
let previousBeakers: Beaker[] | null = null;

let lastAction: { type: 'solidify' | 'catalyst'; beakerIndex: number } | null = null;

const TIER_ORDER = ['tutorial', 'easy', 'medium', 'hard', 'expert', 'master'];

// Cached DOM elements
const els = {
  introScreen: () => document.getElementById('intro-screen')!,
  mapScreen: () => document.getElementById('map-screen')!,
  mapContainer: () => document.getElementById('map-container')!,
  mapRank: () => document.getElementById('map-rank')!,
  mapSettings: () => document.getElementById('map-settings') as HTMLButtonElement,
  mapGrimoire: () => document.getElementById('map-grimoire') as HTMLButtonElement,
  mapHelp: () => document.getElementById('map-help') as HTMLButtonElement,
  mapReturn: () => document.getElementById('map-return') as HTMLButtonElement,
  grimoireOverlay: () => document.getElementById('grimoire-overlay')!,
  grimoireClose: () => document.getElementById('grimoire-close')!,
  grimoireGrid: () => document.getElementById('grimoire-grid')!,
  grimoireEmpty: () => document.getElementById('grimoire-empty')!,
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
  targetMoves: () => document.getElementById('target-moves')!,
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
  lcStarsVal: () => document.getElementById('lc-stars-val') as HTMLElement | null,
  lcMoves: () => document.getElementById('lc-moves')!.querySelector('.value') as HTMLElement,
  lcTarget: () => document.getElementById('lc-target')!.querySelector('.value') as HTMLElement,
  lcSolidify: () => document.getElementById('lc-solidify')!.querySelector('.value') as HTMLElement,
  lcBest: () => document.getElementById('lc-best')!.querySelector('.value') as HTMLElement,
  lcMessage: () => document.getElementById('lc-message')!,
  lcRetry: () => document.getElementById('lc-retry') as HTMLButtonElement,
  lcMap: () => document.getElementById('lc-map') as HTMLButtonElement,
  lcNext: () => document.getElementById('lc-next') as HTMLButtonElement,
  resetOverlay: () => document.getElementById('reset-overlay')!,
  resetCancel: () => document.getElementById('reset-cancel') as HTMLButtonElement,
  resetConfirm: () => document.getElementById('reset-confirm') as HTMLButtonElement,
  stuckOverlay: () => document.getElementById('stuck-overlay')!,
  stuckCancel: () => document.getElementById('stuck-cancel') as HTMLButtonElement,
  stuckRestart: () => document.getElementById('stuck-restart') as HTMLButtonElement,
  announcer: () => document.getElementById('aria-announcer')!,
};

let mapRenderGeneration = 0;
let puzzleBanksLoaded = false;
const banks: Partial<Record<string, LevelData[]>> = {};
async function preloadPuzzleBanks() {
  if (puzzleBanksLoaded) return;
  await Promise.all(TIER_ORDER.map(async (tier) => {
    banks[tier] = await fetchPuzzleBank(tier);
  }));
  puzzleBanksLoaded = true;
}

async function renderMap() {
  mapRenderGeneration += 1;
  const generation = mapRenderGeneration;
  await preloadPuzzleBanks();
  if (generation !== mapRenderGeneration) return;

  const completed = saveData.progress.completed;
  const unlocked = new Set(saveData.progress.unlocked);
  let totalStars = 0;

  for (const region of TIER_ORDER) {
    const path = document.getElementById(`path-${region}`);
    if (!path) continue;
    path.innerHTML = '';
    path.setAttribute('role', 'list');
    path.setAttribute('aria-label', `${region} levels`);

    const bank = banks[region] ?? [];
    const regionStars = bank.reduce((sum, l) => sum + (completed[l.id] ?? 0), 0);
    totalStars += regionStars;
    const regionUnlocked = bank.some(l => unlocked.has(l.id));

    for (const level of bank) {
      const node = document.createElement('button');
      node.className = 'map-node';
      node.setAttribute('role', 'listitem');
      const nodeStars = completed[level.id] ?? 0;
      const status = !unlocked.has(level.id)
        ? 'Locked'
        : level.id === currentLevelId
        ? 'Current'
        : nodeStars === 3
        ? 'Perfect'
        : `${nodeStars} of 3 stars`;
      const ariaLabel = `${getLevelLabel(level.id)}: Level ${level.id}, ${status}`;

      node.setAttribute('aria-label', ariaLabel);

      if (!unlocked.has(level.id)) {
        node.classList.add('locked');
        node.setAttribute('aria-disabled', 'true');
        node.setAttribute('tabindex', '-1');
        node.title = 'Locked';
      } else {
        node.title = `Play level ${level.id}`;
        node.addEventListener('click', () => startLevel(level.id));
        if (level.id === currentLevelId) {
          node.classList.add('current');
        }
        if (nodeStars === 3) {
          node.classList.add('perfect');
        }
      }

      node.innerHTML = `
        <span class="node-id">${level.id}</span>
        <span class="node-stars" aria-hidden="true">${'★'.repeat(nodeStars)}${'☆'.repeat(3 - nodeStars)}</span>
      `;
      path.appendChild(node);
    }

    const title = document.querySelector(`.map-region[data-region="${region}"] .region-title`) as HTMLElement | null;
    if (title) {
      title.dataset.locked = String(!regionUnlocked);
      const starsLabel = regionStars > 0 ? ` (${regionStars} / ${bank.length * 3} ★)` : '';
      title.textContent = `${getLevelLabel(bank[0]?.id ?? `${region}1`)}${starsLabel}`;
    }
  }

  els.mapRank().textContent = `Rank: ${getRankTitle(totalStars)}`;
}

function getLevelLabel(levelId: string): string {
  const tier = deriveTier(levelId);
  switch (tier) {
    case 'tutorial': return 'Neophyte Narthex';
    case 'easy': return 'Vitriol Vault';
    case 'medium': return 'Sulfur Crucible';
    case 'hard': return 'Mercury Alembic';
    case 'expert': return 'Athanor Heart';
    case 'master': return 'Azoth Chamber';
    default: return 'Apprentice Bench';
  }
}

function getRankTitle(stars: number): string {
  if (stars >= 50) return 'Archon Alchemist';
  if (stars >= 35) return 'Master Alchemist';
  if (stars >= 20) return 'Journeyman Alchemist';
  if (stars >= 8) return 'Apprentice Alchemist';
  return 'Novice';
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
  listenForAudioUnlock();

  const introSeen = saveData.hasSeenIntro;
  if (introSeen) {
    showMap();
  } else {
    showScreen('intro-screen');
  }
}

function showMap() {
  const region = deriveTier(currentLevelId ?? saveData.currentLevel ?? 't1');
  document.body.dataset.region = region;
  showScreen('map-screen');
  renderMap();
}

function applyBodyClasses() {
  document.body.classList.toggle('high-contrast', !!saveData.settings.highContrast);
  document.body.classList.toggle('reduced-motion', !!saveData.settings.reducedMotion);
}

function bindEvents() {
  els.startAdventure().addEventListener('click', () => {
    saveData.hasSeenIntro = true;
    persistSave();
    showMap();
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
  els.mapReturn().addEventListener('click', () => {
    saveData.currentLevel = currentLevelId ?? saveData.currentLevel;
    persistSave();
    showMap();
  });
  els.mapSettings().addEventListener('click', () => {
    syncSettingsUI();
    showOverlay('settings-overlay');
  });
  els.mapHelp().addEventListener('click', () => {
    showOverlay('help-overlay');
  });

  els.mapGrimoire().addEventListener('click', () => {
    renderGrimoire();
    showOverlay('grimoire-overlay');
  });

  els.helpClose().addEventListener('click', () => hideOverlay('help-overlay'));
  els.helpDismiss().addEventListener('click', () => {
    hideOverlay('help-overlay');
    saveData.hasSeenHelp = true;
    persistSave();
  });

  els.settingsClose().addEventListener('click', () => hideOverlay('settings-overlay'));

  els.grimoireClose().addEventListener('click', () => hideOverlay('grimoire-overlay'));

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

  els.stuckCancel().addEventListener('click', () => hideOverlay('stuck-overlay'));
  els.stuckRestart().addEventListener('click', () => {
    hideOverlay('stuck-overlay');
    startLevel(currentLevelId ?? 't1');
  });

  els.lcRetry().addEventListener('click', () => {
    hideOverlay('level-complete-overlay');
    startLevel(currentLevelId ?? 't1');
  });
  els.lcMap().addEventListener('click', () => {
    hideOverlay('level-complete-overlay');
    showMap();
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
    if (key === 'music') {
      updateMusicState();
    }
  });
}

function updateMusicState() {
  if (saveData.settings.music) {
    void startMusic();
  } else {
    stopMusic();
  }
}

function syncToggleUI(btn: HTMLButtonElement, value: boolean) {
  btn.setAttribute('aria-checked', String(value));
  const label = btn.querySelector('.toggle-label');
  if (label) label.textContent = value ? 'On' : 'Off';
}

function syncSettingsUI() {
  refreshSettings();
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
  // Ensure the level we are about to play is replayable from the map.
  const wasUnlocked = saveData.progress.unlocked.includes(levelId);
  if (!wasUnlocked) {
    saveData.progress.unlocked.push(levelId);
  }
  saveData = { ...saveData, progress: { ...saveData.progress, unlocked: Array.from(new Set(saveData.progress.unlocked)) } };
  persistSave();
  keyboardIndex = 0;

  startMusic();

  const tier = deriveTier(levelId);
  document.body.dataset.tier = tier;
  els.levelLabel().textContent = getLevelLabel(levelId);

  const level = await getLevelById(levelId);
  if (!level) {
    // Fallback: load bank and pick first available
    const fallbackTier = deriveTier(levelId);
    const bank = await fetchPuzzleBank(fallbackTier);
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
  const previous = previousBeakers;
  previousBeakers = state.beakers.map((b) => ({ layers: [...b.layers], crystals: [...b.crystals] }));
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
    const beakerChanged = !previous || beakerChangedSince(previous[idx], beaker);

    // crystals at very bottom
    for (const c of beaker.crystals) {
      const cEl = document.createElement('div');
      cEl.className = 'layer layer-crystal';
      if (animateSolidify && beakerChanged) cEl.classList.add('forming');
      cEl.dataset.color = c;
      b.appendChild(cEl);
    }

    for (let li = 0; li < beaker.layers.length; li++) {
      const layer = beaker.layers[li];
      const l = document.createElement('div');
      l.className = 'layer';
      l.dataset.color = layer;
      // The top two layers in a catalyst target are the freshly-split parents.
      if (animateCatalyst && beakerChanged && li >= beaker.layers.length - 2) {
        l.classList.add('splitting');
      }
      b.appendChild(l);
    }

    container.appendChild(b);
  });

  renderReactionTable();
}

function beakerChangedSince(prev: Beaker | undefined, curr: Beaker): boolean {
  if (!prev) return true;
  if (prev.layers.length !== curr.layers.length) return true;
  if (prev.crystals.length !== curr.crystals.length) return true;
  for (let i = 0; i < prev.layers.length; i++) {
    if (prev.layers[i] !== curr.layers[i]) return true;
  }
  for (let i = 0; i < prev.crystals.length; i++) {
    if (prev.crystals[i] !== curr.crystals[i]) return true;
  }
  return false;
}

function renderGrimoire() {
  const grid = els.grimoireGrid();
  const empty = els.grimoireEmpty();
  grid.innerHTML = '';

  const known = new Set<string>();
  const sessionDiscovered = state?.discovered ?? new Set<string>();
  for (const key of saveData.grimoire) known.add(key);
  for (const key of sessionDiscovered) {
    const [a, b] = key.split(',');
    if (a && b) {
      known.add([a, b].sort().join(','));
    }
  }

  if (known.size === 0) {
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  grid.classList.remove('hidden');
  empty.classList.add('hidden');

  const sorted = Array.from(known).sort();
  for (const key of sorted) {
    const [a, b] = key.split(',');
    if (!a || !b) continue;
    const result = getReaction(a, b);
    if (!result) continue;
    const meta = REACTION_LORE[result];
    const title = meta?.title ?? `${COLOR_NAME[result] ?? result} Distillate`;
    const flavor = meta?.flavor ?? '';

    const card = document.createElement('div');
    card.className = 'grimoire-card';

    const recipe = document.createElement('div');
    recipe.className = 'grimoire-recipe';
    const dot = (color: string, label: string) => {
      const el = document.createElement('span');
      el.className = 'grimoire-dot';
      el.dataset.color = color;
      el.setAttribute('aria-label', label);
      el.title = label;
      return el;
    };
    recipe.appendChild(dot(a, COLOR_NAME[a] ?? a));
    const plus = document.createElement('span');
    plus.className = 'grimoire-op';
    plus.textContent = '+';
    recipe.appendChild(plus);
    recipe.appendChild(dot(b, COLOR_NAME[b] ?? b));
    const arrow = document.createElement('span');
    arrow.className = 'grimoire-op';
    arrow.textContent = '→';
    recipe.appendChild(arrow);
    const out = document.createElement('span');
    out.className = 'grimoire-output';
    out.dataset.color = result;
    out.textContent = COLOR_NAME[result] ?? result;
    recipe.appendChild(out);

    const name = document.createElement('h3');
    name.className = 'grimoire-title';
    name.textContent = title;

    const note = document.createElement('p');
    note.className = 'grimoire-flavor';
    note.textContent = flavor;

    card.appendChild(recipe);
    card.appendChild(name);
    card.appendChild(note);
    grid.appendChild(card);
  }
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
    out.title = `${REACTION_LORE[result]?.title ?? 'Reaction'}: ${a} + ${b} → ${result}`;
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
    const srcTop = getTopColor(state.beakers[src]);
    const destTop = getTopColor(state.beakers[dest]);
    const beforeSolidified = state.solidificationOccurred;
    const result = doPour(state, src, dest);
    state.selectedBeaker = null;

    if (result.success) {
      play('pour');
      navigator.vibrate?.(10);
      if (result.reacted && srcTop && destTop) {
        const resultName = COLOR_NAME[getReaction(srcTop, destTop) ?? ''] ?? 'new color';
        const isNew = persistDiscovery(`${srcTop},${destTop}`);
        announce(`Discovered ${resultName}!`);
        if (isNew) celebrateReaction(dest, getReaction(srcTop, destTop) ?? '');
      }
      state.selectedBeaker = null;
      renderBoard();
      syncCatalystUI();
      animatePour(src, dest, result);
      if (result.reacted || result.reactionColor) {
        animateReactionFlash(dest, result.reactionColor ?? getComputedColor(dest));
      }
      if (!beforeSolidified && state.solidificationOccurred) {
        lastAction = { type: 'solidify', beakerIndex: dest };
        setTimeout(() => {
          play('crystal');
          renderBoard();
          syncCatalystUI();
        }, 180);
      }
      postMove();
    } else {
      play('invalid');
      announce(`Invalid move. ${result.message ?? ''}`);
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
    play('catalyst');
    navigator.vibrate?.(15);
    announce('Catalyst used. The layer splits into its primaries.');
    animateReactionFlash(beakerIndex, getComputedColor(beakerIndex));
    spawnParticles(beakerIndex, 8);
    lastAction = { type: 'catalyst', beakerIndex };
    state.selectedBeaker = null;
    postMove();
    renderBoard();
    syncCatalystUI();
  } else {
    play('invalid');
    announce(`Cannot use catalyst. ${result.message ?? ''}`);
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
    play('win');
    setTimeout(() => showWin(stars), 350);
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
  if (state.moves <= target && !state.solidificationOccurred && !state.catalystUsed) {
    return 3;
  }
  if (state.moves <= target * 1.5) {
    return 2;
  }
  return 1;
}

function showWin(stars: number) {
  if (!state) return;
  const starContainer = els.lcStars();
  const starSpans = starContainer.querySelectorAll('.star');
  starSpans.forEach((span, idx) => {
    const earned = idx < stars;
    (span as HTMLElement).style.opacity = earned ? '1' : '0.25';
    (span as HTMLElement).style.animationDelay = earned ? `${idx * 120}ms` : '0ms';
    span.classList.toggle('pop-in', earned);
  });
  const lcStarsVal = els.lcStarsVal();
  if (lcStarsVal) lcStarsVal.textContent = String(stars);
  els.lcMoves().textContent = String(state.moves);
  els.lcTarget().textContent = String(state.targetMoves);
  els.lcSolidify().textContent = state.solidificationOccurred ? 'Yes' : 'None';

  const bestMoves = saveData.progress.bestMoves[state.levelId];
  const displayBest = bestMoves === undefined ? state.moves : bestMoves;
  els.lcBest().textContent = String(displayBest);

  if (stars === 3) {
    els.lcMessage().textContent = 'Purity preserved. The Guild is overjoyed. A flawless solve!';
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
  const target = state.targetMoves ?? state.beakers.length * 3;
  els.targetMoves().textContent = `/ ${target}`;
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

function persistDiscovery(rawKey: string): boolean {
  const [a, b] = rawKey.split(',');
  if (!a || !b) return false;
  const key = [a.trim(), b.trim()].sort().join(',');
  if (!saveData.grimoire.includes(key)) {
    saveData.grimoire.push(key);
    persistSave();
    return true;
  }
  return false;
}

function persistSave() {
  saveSave(saveData);
}

/* VFX helpers */
function getComputedColor(idx: number): string {
  const b = els.beakerContainer().children[idx] as HTMLElement | undefined;
  if (!b) return 'white';
  const layer = b.querySelector('.layer') as HTMLElement | null;
  if (!layer) return 'white';
  return window.getComputedStyle(layer).backgroundColor || 'white';
}

function beakerCenter(idx: number): { x: number; y: number } {
  const b = els.beakerContainer().children[idx] as HTMLElement | undefined;
  if (!b) { return { x: 0, y: 0 }; }
  const rect = b.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.35 };
}

function animatePour(src: number, dest: number, result: { transferred?: number; reacted?: boolean }) {
  if (document.body.classList.contains('reduced-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  const from = beakerCenter(src);
  const to = beakerCenter(dest);
  const count = Math.min(result.transferred ?? 1, 12);
  const color = getComputedColor(dest);
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const dot = document.createElement('div');
      dot.className = 'pour-dot';
      dot.style.backgroundColor = color;
      dot.style.left = `${from.x}px`;
      dot.style.top = `${from.y}px`;
      dot.style.opacity = '0.95';
      document.body.appendChild(dot);
      const duration = 400 + Math.random() * 150;
      const offsetX = (Math.random() - 0.5) * 24;
      dot.animate([
        { transform: `translate(-50%, -50%)`, opacity: 0.95 },
        { transform: `translate(${to.x - from.x + offsetX}px, ${to.y - from.y}px)`, opacity: 0.6 },
      ], { duration, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'forwards' })
        .onfinish = () => dot.remove();
    }, i * 30);
  }
}

function animateReactionFlash(idx: number, color: string) {
  if (document.body.classList.contains('reduced-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  const center = beakerCenter(idx);
  const flash = document.createElement('div');
  flash.className = 'reaction-flash';
  flash.style.backgroundColor = color;
  flash.style.left = `${center.x}px`;
  flash.style.top = `${center.y}px`;
  document.body.appendChild(flash);
  flash.addEventListener('animationend', () => flash.remove());
}

function spawnParticles(idx: number, count: number) {
  if (document.body.classList.contains('reduced-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  const center = beakerCenter(idx);
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.backgroundColor = getComputedColor(idx);
    p.style.left = `${center.x}px`;
    p.style.top = `${center.y}px`;
    document.body.appendChild(p);
    const angle = Math.random() * Math.PI * 2;
    const dist = 24 + Math.random() * 40;
    const duration = 350 + Math.random() * 250;
    p.animate([
      { transform: `translate(-50%, -50%) scale(1)`, opacity: 1 },
      { transform: `translate(${Math.cos(angle) * dist - 50}%, ${Math.sin(angle) * dist - 50}%) scale(0)`, opacity: 0 },
    ], { duration, easing: 'ease-out', fill: 'forwards' })
      .onfinish = () => p.remove();
  }
}

function celebrateReaction(idx: number, color: string) {
  if (document.body.classList.contains('reduced-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  play('reaction');
  navigator.vibrate?.([15, 25, 35]);
  spawnParticles(idx, 24);

  const center = beakerCenter(idx);
  const toast = document.createElement('div');
  toast.className = 'reaction-toast';
  toast.innerHTML = `
    <span class="reaction-toast-label">New Reaction!</span>
    <span class="reaction-toast-color" data-color="${color}">${COLOR_NAME[color] ?? color}</span>
  `;
  toast.style.left = `${center.x}px`;
  toast.style.top = `${center.y}px`;
  toast.style.opacity = '0';
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 350);
  }, 1400);
}

