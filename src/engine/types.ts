import type { GameColor } from './constants';

export interface Beaker {
  layers: GameColor[]; // bottom to top
  crystals: GameColor[]; // bottom to top
}

export interface LevelData {
  id: string;
  lab: string;
  tier: string;
  beakers: Omit<Beaker, 'crystals'>[];
  heights: number[];
  catalysts: number;
  targetMoves: number;
}

export interface HistoryEntry {
  beakers: Beaker[];
  catalystCharges: number;
  solidificationOccurred: boolean;
  catalystUsed: boolean;
}

export interface GameState {
  levelId: string;
  lab: string;
  tier: string;
  beakers: Beaker[];
  heights: number[];
  catalystCharges: number;
  moves: number;
  history: HistoryEntry[];
  solidificationOccurred: boolean;
  catalystUsed: boolean;
  selectedBeaker: number | null;
  discovered: Set<string>;
  won: boolean;
  targetMoves: number;
}

export interface SaveData {
  version: number;
  progress: {
    completed: Record<string, number>; // highest star rating
    bestMoves: Record<string, number>; // fewest moves to complete
    unlocked: string[];
  };
  settings: {
    sound: boolean;
    reducedMotion: boolean;
    highContrast: boolean;
    showLabels: boolean;
  };
  grimoire: string[];
  hasSeenIntro: boolean;
  hasSeenHelp: boolean;
  currentLevel: string | null;
}

export type Settings = SaveData['settings'];

export interface ActionResult {
  success: boolean;
  message?: string;
}
