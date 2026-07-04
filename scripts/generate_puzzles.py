"""Puzzle generator for Catalyst.

Generates mixed boards by distributing total color units randomly into beakers,
ensuring boards are non-trivially mixed (not already uniform).
"""
from __future__ import annotations

import json
import os
import random

PRIMARIES = [
    "crimson", "amber", "viridian", "cobalt", "saffron", "violet"
]

REACTION_PAIRS: dict = {}
_pair_list = [
    ("crimson", "amber",   "orange"),
    ("crimson", "viridian", "chartreuse"),
    ("crimson", "cobalt",   "scarlet"),
    ("crimson", "saffron",  "vermilion"),
    ("crimson", "violet",   "fuchsia"),
    ("amber",   "viridian", "lime"),
    ("amber",   "cobalt",   "gold"),
    ("amber",   "saffron",  "maroon"),
    ("amber",   "violet",   "rose"),
    ("viridian","cobalt",   "teal"),
    ("viridian","saffron",  "emerald"),
    ("viridian","violet",   "azure"),
    ("cobalt",  "saffron",  "indigo"),
    ("cobalt",  "violet",   "turquoise"),
    ("saffron", "violet",   "magenta"),
]
for a, b, c in _pair_list:
    REACTION_PAIRS[(a, b)] = c
    REACTION_PAIRS[(b, a)] = c


class Beaker:
    __slots__ = ("layers", "crystals")

    def __init__(self, layers=None, crystals=None):
        self.layers = list(layers) if layers else []
        self.crystals = list(crystals) if crystals else []

    def capacity(self, height: int):
        return height - len(self.crystals) - len(self.layers)

    def is_uniform(self):
        if not self.layers:
            return True
        return len(set(self.layers)) == 1


def is_trivially_solved(bs):
    for b in bs:
        if b.layers and not b.is_uniform():
            return False
    return True


def has_solid_color_beaker(bs, height):
    """Return True if any non-empty beaker is filled entirely with one color.

    A starting board with a solid-color beaker is usually a free gift;
    reject it so every beaker needs some decision-making.
    """
    for b in bs:
        if not b.layers:
            continue
        # A beaker with more than one layer all the same color is "solid".
        if len(b.layers) > 1 and b.is_uniform():
            return True
    return False


def beaker_uniform_color(b: Beaker):
    if not b.layers:
        return None
    if b.is_uniform():
        return b.layers[0]
    return None


def _swap_layers(bs, i, idx_i, j, idx_j):
    bs[i].layers[idx_i], bs[j].layers[idx_j] = bs[j].layers[idx_j], bs[i].layers[idx_i]


def repair_solid_beakers(bs, rng, max_attempts: int = 200):
    """Swap tokens until no non-empty beaker is filled entirely with one color."""
    for _ in range(max_attempts):
        solids = [i for i, b in enumerate(bs) if len(b.layers) > 1 and b.is_uniform()]
        if not solids:
            return True
        i = rng.choice(solids)
        color_i = bs[i].layers[0]
        candidates = []
        for j in range(len(bs)):
            if j == i:
                continue
            if not bs[j].layers:
                continue
            for idx_j, c in enumerate(bs[j].layers):
                if c == color_i:
                    continue
                # Try swapping one layer of color_i from i with this candidate layer.
                # Pick any layer in i (they are all color_i).
                for idx_i in range(len(bs[i].layers)):
                    # Simulate swap without mutating
                    new_i = bs[i].layers[:idx_i] + [c] + bs[i].layers[idx_i + 1:]
                    new_j = bs[j].layers[:idx_j] + [color_i] + bs[j].layers[idx_j + 1:]
                    if len(new_i) > 1 and len(set(new_i)) == 1:
                        continue
                    if len(new_j) > 1 and len(set(new_j)) == 1:
                        continue
                    candidates.append((idx_i, j, idx_j))
                    break
        if not candidates:
            return False
        idx_i, j, idx_j = rng.choice(candidates)
        _swap_layers(bs, i, idx_i, j, idx_j)
    return False
TIER_PREFIX = {
    "tutorial": "t",
    "easy": "e",
    "medium": "m",
    "hard": "h",
    "expert": "x",
    "master": "a",
}


def generate_level(tier, num, spec):
    rng = random.Random(spec.get("seed", 12345) + num * 17 + hash(tier) % 10000)
    colors_count = min(spec["primaries"], len(PRIMARIES))
    beakers_total = spec["beakers"]
    height = spec["height"]
    catalysts = spec["catalysts"]
    lab = spec["lab"]
    moves_low, moves_high = spec["target_moves"]

    # Pick contiguous colors
    start = rng.randint(0, len(PRIMARIES) - 1)
    primaries = [PRIMARIES[(start + i) % len(PRIMARIES)] for i in range(colors_count)]

    # Build total color tokens
    tokens = [p for p in primaries for _ in range(height)]
    rng.shuffle(tokens)

    # Distribute into beakers randomly
    bs = [Beaker() for _ in range(beakers_total)]
    for color in tokens:
        available = [j for j in range(beakers_total) if bs[j].capacity(height) > 0]
        if not available:
            return None
        # Prefer putting into beakers that already have this color to reduce mixing slightly
        same_color = [j for j in available if bs[j].layers and bs[j].layers[-1] == color]
        if same_color and rng.random() < 0.30:
            j = rng.choice(same_color)
        else:
            j = rng.choice(available)
        # In the engine, layers are bottom-to-top, so append in order they are built bottom-up
        bs[j].layers.append(color)

    if is_trivially_solved(bs):
        return None

    # Repair accidental solid-color beakers before rejecting the board.
    if not repair_solid_beakers(bs, rng):
        return None

    serial_beakers = [{"layers": b.layers.copy()} for b in bs]

    # Estimate target moves by counting misplaced tokens
    misplaced = 0
    for b in bs:
        if not b.layers:
            continue
        # If beaker is not uniform, count all tokens
        if not b.is_uniform():
            misplaced += len(b.layers)
        else:
            # Even uniform beakers might need moving if there are extra empty beakers
            pass
    estimated = max(moves_low, min(moves_high, misplaced + rng.randint(2, 6)))

    return {
        "id": f"{TIER_PREFIX[tier]}{num + 1}",
        "lab": lab,
        "tier": tier,
        "beakers": serial_beakers,
        "heights": [height] * beakers_total,
        "catalysts": catalysts,
        "targetMoves": estimated,
    }


TIER_SPECS = {
    "tutorial": {"primaries": 3, "beakers": 4, "height": 4, "catalysts": 3, "target_moves": (4, 16), "lab": "Apprentice Bench", "count": 15},
    "easy":     {"primaries": 4, "beakers": 6, "height": 4, "catalysts": 2, "target_moves": (6, 22), "lab": "Apprentice Bench", "count": 40},
    "medium":   {"primaries": 5, "beakers": 8, "height": 5, "catalysts": 1, "target_moves": (10, 32), "lab": "Master’s Altar", "count": 60},
    "hard":     {"primaries": 6, "beakers": 9, "height": 6, "catalysts": 1, "target_moves": (18, 45), "lab": "Master’s Altar", "count": 80},
    "expert":   {"primaries": 6, "beakers": 9, "height": 7, "catalysts": 1, "target_moves": (26, 70), "lab": "Forbidden Vault", "count": 60},
    "master":   {"primaries": 6, "beakers": 10, "height": 7, "catalysts": 0, "target_moves": (35, 95), "lab": "Forbidden Vault", "count": 45},
}


def main():
    out_dir = "public/puzzles"
    os.makedirs(out_dir, exist_ok=True)
    all_ids = set()
    for tier, spec in TIER_SPECS.items():
        levels = []
        attempts = 0
        while len(levels) < spec["count"] and attempts < spec["count"] * 100:
            attempts += 1
            lvl = generate_level(tier, len(levels), spec)
            if lvl:
                levels.append(lvl)
        path = os.path.join(out_dir, f"{tier}.json")
        with open(path, "w") as f:
            json.dump(levels, f, indent=2)
        for lvl in levels:
            if lvl["id"] in all_ids:
                print(f"ERROR: duplicate id {lvl['id']} across tiers")
                raise SystemExit(1)
            all_ids.add(lvl["id"])
        print(f"{tier}: {len(levels)} levels ({path})")


if __name__ == "__main__":
    main()
