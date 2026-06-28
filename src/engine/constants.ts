export const SAVE_KEY = 'catalyst-save';
export const SAVE_VERSION = 1;

export const PRIMARIES = [
  'crimson',
  'amber',
  'viridian',
  'cobalt',
  'saffron',
  'violet',
] as const;

export type Primary = typeof PRIMARIES[number];

export const INTERMEDIATES = [
  'orange',
  'chartreuse',
  'teal',
  'indigo',
  'magenta',
  'fuchsia',
] as const;

export type Intermediate = typeof INTERMEDIATES[number];

export type GameColor = Primary | Intermediate | string;

export const COLOR_NAME: Record<string, string> = {
  crimson: 'Crimson',
  amber: 'Amber',
  viridian: 'Viridian',
  cobalt: 'Cobalt',
  saffron: 'Saffron',
  violet: 'Violet',
  orange: 'Orange',
  chartreuse: 'Chartreuse',
  teal: 'Teal',
  indigo: 'Indigo',
  magenta: 'Magenta',
  fuchsia: 'Fuchsia',
};

export function isPrimary(color: string): color is Primary {
  return PRIMARIES.includes(color as Primary);
}

export function isIntermediate(color: string): color is Intermediate {
  return INTERMEDIATES.includes(color as Intermediate);
}

const REACTION_PAIRS: [Primary, Primary, Intermediate][] = [
  ['crimson', 'amber', 'orange'],
  ['amber', 'viridian', 'chartreuse'],
  ['viridian', 'cobalt', 'teal'],
  ['cobalt', 'saffron', 'indigo'],
  ['saffron', 'violet', 'magenta'],
  ['violet', 'crimson', 'fuchsia'],
];

const reactionLookup = new Map<string, Intermediate>();
for (const [a, b, res] of REACTION_PAIRS) {
  reactionLookup.set(`${a},${b}`, res);
  reactionLookup.set(`${b},${a}`, res);
}

export function getReaction(a: string, b: string): string | null {
  if (a === b) return null;
  return reactionLookup.get(`${a},${b}`) ?? null;
}

export function getReactionParents(intermediate: string): [Primary, Primary] | null {
  for (const [a, b, res] of REACTION_PAIRS) {
    if (res === intermediate) return [a, b];
  }
  return null;
}
