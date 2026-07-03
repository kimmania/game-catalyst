export const SAVE_KEY = 'catalyst-save';
export const SAVE_VERSION = 2;

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

export const REACTION_PAIRS: [Primary, Primary, Intermediate][] = [
  ['crimson', 'amber', 'orange'],
  ['amber', 'viridian', 'chartreuse'],
  ['viridian', 'cobalt', 'teal'],
  ['cobalt', 'saffron', 'indigo'],
  ['saffron', 'violet', 'magenta'],
  ['violet', 'crimson', 'fuchsia'],
];

const reactionLookup = new Map<string, Intermediate>();
const loreBuilder = new Map<string, { title: string; flavor: string }>();

(function buildReactionMeta() {
  const titleMap: Record<string, string> = {
    orange: 'Sun-Kissed Tincture',
    chartreuse: 'Verdant Sparksalt',
    teal: 'Deepsight Draught',
    indigo: 'Midnight Phial',
    magenta: 'Heart-of-Rose Elixir',
    fuchsia: 'Sanguine Aureole',
  };
  const flavorMap: Record<string, string> = {
    orange: 'The fire of crimson kissed by golden amber yields the warmth of a setting sun.',
    chartreuse: 'Amber brightness stirs viridian life into a volatile green that flickers like spring lightning.',
    teal: 'Viridian root plunges into cobalt depths, drawing up a brine that sees through stone.',
    indigo: 'Cobalt dusk and saffron ember fuse into the color just before true night falls.',
    magenta: 'Saffron flame entwines violet shadow in the exact shade of a lover’s flush.',
    fuchsia: 'Violet brood awakens crimson rage, leaving a halo only the brave dare sip.',
  };
  for (const [a, b, res] of REACTION_PAIRS) {
    reactionLookup.set(`${a},${b}`, res);
    reactionLookup.set(`${b},${a}`, res);
    loreBuilder.set(res, {
      title: titleMap[res] ?? `${COLOR_NAME[res] ?? res} Distillate`,
      flavor: flavorMap[res] ?? `The union of ${COLOR_NAME[a]} and ${COLOR_NAME[b]} produces ${COLOR_NAME[res]}.`,
    });
  }
})();

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

export const REACTION_LORE: Record<string, { title: string; flavor: string; parents: [string, string] }> = {};

for (const [a, b, res] of REACTION_PAIRS) {
  const meta = loreBuilder.get(res);
  REACTION_LORE[res] = {
    title: meta?.title ?? `${COLOR_NAME[res] ?? res} Distillate`,
    flavor: meta?.flavor ?? `The union of ${COLOR_NAME[a]} and ${COLOR_NAME[b]} produces ${COLOR_NAME[res]}.`,
    parents: [a, b],
  };
}
