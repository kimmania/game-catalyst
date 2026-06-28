import type { LevelData } from './types';

let cache: Map<string, LevelData[]> = new Map();

export async function fetchPuzzleBank(tier: string): Promise<LevelData[]> {
  if (cache.has(tier)) return cache.get(tier)!;
  try {
    const res = await fetch(`puzzles/${tier}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as LevelData[];
    cache.set(tier, data);
    return data;
  } catch {
    return [];
  }
}

export async function getLevelById(levelId: string): Promise<LevelData | null> {
  const tier = deriveTier(levelId);
  const bank = await fetchPuzzleBank(tier);
  return bank.find((l) => l.id === levelId) ?? null;
}

function deriveTier(levelId: string): string {
  const prefix = levelId.charAt(0).toLowerCase();
  switch (prefix) {
    case 't':
      return 'tutorial';
    case 'e':
      return 'easy';
    case 'm':
      return 'medium';
    case 'h':
      return 'hard';
    case 'x':
      return 'expert';
    case 'a':
      return 'master';
    default:
      return 'tutorial';
  }
}

export { deriveTier };
