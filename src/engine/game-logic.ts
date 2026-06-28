import type { Beaker, GameState, ActionResult } from './types';
import { isPrimary, getReaction, getReactionParents } from './constants';

export function getTopColor(beaker: Beaker): string | null {
  if (beaker.layers.length === 0) return null;
  return beaker.layers[beaker.layers.length - 1];
}

export function getTopCount(beaker: Beaker): number {
  if (beaker.layers.length === 0) return 0;
  const top = getTopColor(beaker)!;
  let count = 0;
  for (let i = beaker.layers.length - 1; i >= 0; i--) {
    if (beaker.layers[i] === top) count++;
    else break;
  }
  return count;
}

export function getCapacity(beaker: Beaker, height: number): number {
  return height - beaker.crystals.length;
}

function _solidify(beaker: Beaker): number {
  const top = getTopColor(beaker);
  if (!top || !isPrimary(top)) return 0;
  let count = 0;
  for (let i = beaker.layers.length - 1; i >= 0; i--) {
    if (beaker.layers[i] === top) count++;
    else break;
  }
  const pairs = Math.floor(count / 2);
  if (pairs === 0) return 0;
  for (let i = 0; i < pairs * 2; i++) {
    beaker.layers.pop();
  }
  for (let i = 0; i < pairs; i++) {
    beaker.crystals.push(top);
  }
  return pairs;
}

export function applySolidification(beaker: Beaker, _height: number): number {
  return _solidify(beaker);
}

export function canPour(state: GameState, srcIdx: number, destIdx: number): boolean {
  if (srcIdx === destIdx) return false;
  const src = state.beakers[srcIdx];
  const dest = state.beakers[destIdx];
  if (src.layers.length === 0) return false;
  const srcTop = getTopColor(src)!;
  const destTop = getTopColor(dest);
  if (!destTop) return true;
  if (destTop === srcTop) {
    const cap = getCapacity(dest, state.heights[destIdx]);
    const srcCnt = getTopCount(src);
    return srcCnt > 0 && cap > 0;
  }
  if (isPrimary(srcTop) && isPrimary(destTop)) return true;
  return false;
}

function pushHistory(state: GameState) {
  state.history.push({
    beakers: state.beakers.map((b) => ({
      layers: [...b.layers],
      crystals: [...b.crystals],
    })),
    catalystCharges: state.catalystCharges,
    solidificationOccurred: state.solidificationOccurred,
    catalystUsed: state.catalystUsed,
  });
  if (state.history.length > 200) {
    state.history.shift();
  }
}

export function doPour(state: GameState, srcIdx: number, destIdx: number): ActionResult {
  if (!canPour(state, srcIdx, destIdx)) {
    return { success: false, message: 'Invalid move' };
  }
  pushHistory(state);

  const src = state.beakers[srcIdx];
  const dest = state.beakers[destIdx];
  const srcTop = getTopColor(src)!;
  const destTop = getTopColor(dest);

  if (!destTop || destTop === srcTop) {
    const count = getTopCount(src);
    const capacity = getCapacity(dest, state.heights[destIdx]);
    const transfer = Math.min(count, capacity);
    if (transfer <= 0) {
      state.history.pop();
      return { success: false, message: 'No space' };
    }

    const moved: string[] = [];
    for (let i = 0; i < transfer; i++) {
      moved.push(src.layers.pop()!);
    }
    moved.reverse();
    dest.layers.push(...moved);

    if (destTop && isPrimary(srcTop) && isPrimary(destTop)) {
      const solidified = applySolidification(dest, state.heights[destIdx]);
      if (solidified > 0) state.solidificationOccurred = true;
    }

    state.moves++;
    return { success: true };
  }

  if (isPrimary(srcTop) && isPrimary(destTop)) {
    const reaction = getReaction(srcTop, destTop);
    if (!reaction) {
      state.history.pop();
      return { success: false, message: 'No reaction between these colors' };
    }

    src.layers.pop();
    dest.layers.pop();
    dest.layers.push(reaction);

    state.discovered.add(`${srcTop},${destTop}`);
    state.discovered.add(`${destTop},${srcTop}`);

    state.moves++;
    return { success: true };
  }

  state.history.pop();
  return { success: false, message: 'Invalid move' };
}

export function applyCatalyst(state: GameState, beakerIdx: number): ActionResult {
  const beaker = state.beakers[beakerIdx];
  const top = getTopColor(beaker);
  if (!top) return { success: false, message: 'Beaker is empty' };
  const parents = getReactionParents(top);
  if (!parents) return { success: false, message: 'Top layer is not an intermediate' };
  if (state.catalystCharges <= 0) return { success: false, message: 'No catalyst charges remaining' };

  pushHistory(state);

  state.catalystCharges--;
  state.catalystUsed = true;

  beaker.layers.pop();

  const [upper, lower] = parents;
  beaker.layers.push(lower);
  beaker.layers.push(upper);

  state.moves++;
  return { success: true };
}

export function undo(state: GameState): boolean {
  if (state.history.length === 0) return false;
  const entry = state.history.pop()!;
  state.beakers = entry.beakers.map((b) => ({
    layers: [...b.layers],
    crystals: [...b.crystals],
  }));
  state.catalystCharges = entry.catalystCharges;
  state.solidificationOccurred = entry.solidificationOccurred;
  state.catalystUsed = entry.catalystUsed;
  return true;
}

export function isWin(beakers: Beaker[]): boolean {
  for (const beaker of beakers) {
    if (beaker.layers.length === 0) continue;
    const top = getTopColor(beaker)!;
    for (const layer of beaker.layers) {
      if (layer !== top) return false;
    }
  }
  return true;
}

export function createGameState(level: {
  id: string;
  lab: string;
  tier: string;
  beakers: { layers: string[] }[];
  heights: number[];
  catalysts: number;
  targetMoves: number;
}): GameState {
  return {
    levelId: level.id,
    lab: level.lab,
    tier: level.tier,
    beakers: level.beakers.map((b) => ({
      layers: [...b.layers],
      crystals: [],
    })),
    heights: [...level.heights],
    catalystCharges: level.catalysts,
    moves: 0,
    history: [],
    solidificationOccurred: false,
    catalystUsed: false,
    selectedBeaker: null,
    discovered: new Set<string>(),
    won: false,
    targetMoves: level.targetMoves,
  };
}
