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
    ("amber",   "viridian","chartreuse"),
    ("viridian","cobalt",  "teal"),
    ("cobalt",  "saffron", "indigo"),
    ("saffron", "violet",  "magenta"),
    ("violet",  "crimson","fuchsia"),
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
        if same_color and rng.random() < 0.45:
            j = rng.choice(same_color)
        else:
            j = rng.choice(available)
        # In the engine, layers are bottom-to-top, so append in order they are built bottom-up
        bs[j].layers.append(color)

    if is_trivially_solved(bs):
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
        "id": f"{tier[0]}{num + 1}",
        "lab": lab,
        "tier": tier,
        "beakers": serial_beakers,
        "heights": [height] * beakers_total,
        "catalysts": catalysts,
        "targetMoves": estimated,
    }


TIER_SPECS = {
    "tutorial": {"primaries": 3, "beakers": 4, "height": 4, "catalysts": 3, "target_moves": (4, 16), "lab": "Apprentice Bench", "count": 15},
    "easy": {"primaries": 4, "beakers": 6, "height": 4,  "catalysts": 2, "target_moves": (8, 28), "lab": "Apprentice Bench", "count": 40},
    "medium": {"primaries": 5, "beakers": 8, "height": 5, "catalysts": 2, "target_moves": (12, 42), "lab": "Master’s Altar", "count": 60},
    "hard": {"primaries": 6, "beakers": 10, "height": 5, "catalysts": 1, "target_moves": (20, 65), "lab": "Master’s Altar", "count": 80},
    "expert": {"primaries": 6, "beakers": 11, "height": 6, "catalysts": 1, "target_moves": (30, 90), "lab": "Forbidden Vault", "count": 60},
    "master": {"primaries": 6, "beakers": 12, "height": 6, "catalysts": 0, "target_moves": (40, 120), "lab": "Forbidden Vault", "count": 45},
}


def main():
    out_dir = "public/puzzles"
    os.makedirs(out_dir, exist_ok=True)
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


if __name__ == "__main__":
    main()
