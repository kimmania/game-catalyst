import type { SaveData, Settings } from './types';
import { SAVE_KEY, SAVE_VERSION } from './constants';

export function getDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    progress: {
      completed: {},
      bestMoves: {},
      unlocked: ['t1'],
    },
    settings: {
      sound: true,
      music: true,
      reducedMotion: false,
      highContrast: false,
    },
    grimoire: [],
    hasSeenIntro: false,
    hasSeenHelp: false,
    currentLevel: 't1',
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return getDefaultSave();
    const data = JSON.parse(raw) as SaveData;
    if (!data || typeof data !== 'object') return getDefaultSave();
    if (data.version !== SAVE_VERSION) {
      return migrateSave(data);
    }
    return { ...getDefaultSave(), ...data };
  } catch {
    return getDefaultSave();
  }
}

export function saveSave(data: SaveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

function migrateSave(old: SaveData): SaveData {
  const fresh = getDefaultSave();
  fresh.progress = {
    completed: old.progress?.completed ?? {},
    bestMoves: old.progress?.bestMoves ?? {},
    unlocked: Array.from(new Set(old.progress?.unlocked ?? ['t1'])),
  };
  // Restore any completed levels that somehow lost their replay unlock.
  for (const levelId of Object.keys(fresh.progress.completed)) {
    fresh.progress.unlocked.push(levelId);
  }
  fresh.progress.unlocked = Array.from(new Set(fresh.progress.unlocked));
  fresh.settings = { ...fresh.settings, ...old.settings };
  fresh.grimoire = old.grimoire ?? fresh.grimoire;
  fresh.hasSeenIntro = old.hasSeenIntro ?? old.hasSeenHelp ?? false;
  fresh.hasSeenHelp = old.hasSeenHelp ?? false;
  fresh.currentLevel = old.currentLevel ?? fresh.currentLevel;
  fresh.version = SAVE_VERSION;
  return fresh;
}

export function patchSettings(data: SaveData, patch: Partial<Settings>): SaveData {
  return { ...data, settings: { ...data.settings, ...patch } };
}

export function completeLevel(data: SaveData, levelId: string, stars: number, moves: number): SaveData {
  const completed = { ...data.progress.completed };
  const bestMoves = { ...data.progress.bestMoves };
  const prevStars = completed[levelId] ?? 0;
  completed[levelId] = Math.max(prevStars, stars);
  const prevMoves = bestMoves[levelId];
  if (prevMoves === undefined || moves < prevMoves) {
    bestMoves[levelId] = moves;
  }

  const unlocked = new Set(data.progress.unlocked);
  // Always keep the completed level replayable.
  unlocked.add(levelId);

  // Unlock next level in sequence if adjacent.
  const nextId = deriveNextLevelId(levelId);
  if (nextId) unlocked.add(nextId);

  // Merge grimoire
  const mergedGrimoire = new Set(data.grimoire);

  return {
    ...data,
    progress: { completed, bestMoves, unlocked: Array.from(unlocked) },
    grimoire: Array.from(mergedGrimoire),
  };
}

function deriveNextLevelId(current: string): string | null {
  const m = current.match(/^([a-z]*)(\d+)$/i);
  if (!m) return null;
  const prefix = m[1] || 't';
  const num = parseInt(m[2], 10);
  // only auto-unlock within same tier; lab progression handled by lab selection later
  return `${prefix}${num + 1}`;
}
