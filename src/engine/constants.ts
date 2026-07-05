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
  'scarlet',
  'lime',
  'azure',
  'vermilion',
  'gold',
  'maroon',
  'emerald',
  'rose',
  'turquoise',
] as const;

export type Intermediate = typeof INTERMEDIATES[number];

export type GameColor = Primary | Intermediate | string;

export const COLORS = [...PRIMARIES, ...INTERMEDIATES] as const;

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
  scarlet: 'Scarlet',
  lime: 'Lime',
  azure: 'Azure',
  vermilion: 'Vermilion',
  gold: 'Gold',
  maroon: 'Maroon',
  emerald: 'Emerald',
  rose: 'Rose',
  turquoise: 'Turquoise',
};

export const COLOR_ID: Record<string, number> = {};
COLORS.forEach((color, index) => {
  COLOR_ID[color] = index + 1;
});

export function isPrimary(color: string): color is Primary {
  return PRIMARIES.includes(color as Primary);
}

export function isIntermediate(color: string): color is Intermediate {
  return INTERMEDIATES.includes(color as Intermediate);
}

export const REACTION_PAIRS: [Primary, Primary, Intermediate][] = [
  ['crimson', 'amber', 'orange'],
  ['crimson', 'viridian', 'chartreuse'],
  ['crimson', 'cobalt', 'scarlet'],
  ['crimson', 'saffron', 'vermilion'],
  ['crimson', 'violet', 'fuchsia'],
  ['amber', 'viridian', 'lime'],
  ['amber', 'cobalt', 'gold'],
  ['amber', 'saffron', 'maroon'],
  ['amber', 'violet', 'rose'],
  ['viridian', 'cobalt', 'teal'],
  ['viridian', 'saffron', 'emerald'],
  ['viridian', 'violet', 'azure'],
  ['cobalt', 'saffron', 'indigo'],
  ['cobalt', 'violet', 'turquoise'],
  ['saffron', 'violet', 'magenta'],
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
    scarlet: 'Emberblood Dye',
    lime: 'Springtide Salt',
    azure: 'Skyglass Essence',
    vermilion: 'Chimera Scale',
    gold: "King's Aureate",
    maroon: 'Dried Vineyard',
    emerald: 'Forestheart Resin',
    rose: 'Thornpetal Nectar',
    turquoise: 'Serpentwave Tears',
  };
  const flavorMap: Record<string, string> = {
    orange: 'The fire of crimson kissed by golden amber yields the warmth of a setting sun.',
    chartreuse: 'Amber brightness stirs viridian life into a volatile green that flickers like spring lightning.',
    teal: 'Viridian root plunges into cobalt depths, drawing up a brine that sees through stone.',
    indigo: 'Cobalt dusk and saffron ember fuse into the color just before true night falls.',
    magenta: 'Saffron flame entwines violet shadow in the exact shade of a lover’s flush.',
    fuchsia: 'Violet brood awakens crimson rage, leaving a halo only the brave dare sip.',
    scarlet: 'Crimson exposed to cobalt coolness burns a sharper, brighter red than before.',
    lime: 'Amber warmth drawn through viridian leaf yields a green so sharp it could cut glass.',
    azure: 'Viridian life leached into violet dusk leaves the pale blue of a cloudless dawn.',
    vermilion: 'Saffron sun poured over crimson blood produces the hue of a familiar poison.',
    gold: 'Amber and cobalt divine a treasure that shines only in the alchemist’s mind.',
    maroon: 'Amber dried by saffron heat deepens into the color of old wine and old regrets.',
    emerald: 'Viridian fortified by saffron ripens into a green that remembers forests.',
    rose: 'Amber light filtered through violet petals becomes the blush of a fading bloom.',
    turquoise: 'Cobalt sea stirred by violet night yields the color of a sheltered lagoon.',
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
