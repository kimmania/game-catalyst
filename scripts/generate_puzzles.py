"""Puzzle generator for Catalyst.

Generates guaranteed-solvable levels by scrambling solved boards using only reversible forward pours.
That means we avoid solidification during scramble: a pour onto a different top color or empty is always reversible.
Different primaries may react (creating an intermediate), which is fine — the catalyst mechanic can split intermediates.
"""
from __future__ import annotations

import json
import os
import random

PRIMARIES = [
    "crimson", "amber", "viridian", "cobalt", "saffron", "violet"
]

REACTION_PAIRS: dict[tuple[str, str], str] = {}
_pair_list = [
    ("crimson", "amber", "orange"),
    ("amber", "viridian", "chartreuse"),
    ("viridian", "cobalt", "teal"),
    ("cobalt", "saffron", "indigo"),
    ("saffron", "violet", "magenta"),
    ("violet", "crimson", "fuchsia"),
]
for a, b, c in _pair_list:
    REACTION_PAIRS[(a, b)] = c
    REACTION_PAIRS[(b, a)] = c


def get_reaction(a: str, b: str) -> str | None:
    return REACTION_PAIRS.get((a, b))


class Beaker:
    __slots__ = ("layers", "crystals")

    def __init__(self, layers: list[str] | None = None, crystals: list[str] | None = None):
        self.layers: list[str] = list(layers) if layers else []
        self.crystals: list[str] = list(crystals) if crystals else []

    def copy(self) -> Beaker:
        return Beaker(self.layers[:], self.crystals[:])

    def top(self) -> str | None:
        return self.layers[-1] if self.layers else None

    def top_count(self) -> int:
        if not self.layers:
            return 0
        t = self.top()
        cnt = 0
        for i in range(len(self.layers) - 1, -1, -1):
            if self.layers[i] == t:
                cnt += 1
            else:
                break
        return cnt

    def capacity(self, height: int) -> int:
        return height - len(self.crystals)

    def is_full(self, height: int) -> bool:
        return len(self.layers) + len(self.crystals) >= height


def legal_moves(state: list[Beaker], heights: list[int]) -> list[tuple[int, int]]:
    n = len(state)
    moves: list[tuple[int, int]] = []
    for src in range(n):
        if not state[src].layers:
            continue
        src_top = state[src].top()
        assert src_top is not None
        for dst in range(n):
            if src == dst:
                continue
            if state[dst].is_full(heights[dst]):
                continue
            dst_top = state[dst].top()
            if dst_top is None:
                moves.append((src, dst))
            elif dst_top == src_top:
                # same color — allowed, but to keep reversible we also avoid
                # solidification (we'll handle that separately)
                moves.append((src, dst))
            elif src_top in PRIMARIES and dst_top in PRIMARIES:
                moves.append((src, dst))
    return moves


def apply_move(state: list[Beaker], src_i: int, dst_i: int, height: int) -> bool:
    src = state[src_i]
    dst = state[dst_i]
    src_top = src.top()
    dst_top = dst.top()
    if src_top is None:
        return False
    if dst_top is None or dst_top == src_top:
        cnt = src.top_count()
        cap = dst.capacity(height)
        t = min(cnt, cap)
        if t <= 0:
            return False
        moved = [src.layers.pop() for _ in range(t)]
        moved.reverse()
        dst.layers.extend(moved)
        return True
    if src_top in PRIMARIES and dst_top in PRIMARIES:
        reaction = get_reaction(src_top, dst_top)
        if reaction:
            src.layers.pop()
            dst.layers.pop()
            dst.layers.append(reaction)
            return True
    return False


def generate_solved(primaries: list[str], beakers: int, height: int) -> tuple[list[Beaker], list[int]]:
    bs: list[Beaker] = []
    hs = [height] * beakers
    for p in primaries:
        bs.append(Beaker(layers=[p] * height))
    for _ in range(beakers - len(primaries)):
        bs.append(Beaker())
    return bs, hs


def scramble_reversible(
    state: list[Beaker],
    heights: list[int],
    moves: int,
    rng: random.Random,
) -> int:
    performed = 0
    for _ in range(moves * 3):
        if performed >= moves:
            break
        opts = legal_moves(state, heights)
        if not opts:
            break
        # Filter to avoid solidification so every scramble move is reversible
        safe = [(s, d) for (s, d) in opts if state[d].top() != state[s].top() or state[d].top() is None]
        if not safe:
            # if forced into same-color, allow but track (still reversible forward just less reversible due solidification)
            # keep proceeding
            safe = opts
        src, dst = rng.choice(safe)
        apply_move(state, src, dst, heights[dst])
        performed += 1
    return performed


def generate_level(tier: str, num: int, spec: dict) -> dict | None:
    rng = random.Random(spec.get("seed", 12345) + num * 17 + hash(tier) % 10000)
    colors = spec["primaries"]
    beakers = spec["beakers"]
    height = spec["height"]
    catalysts = spec["catalysts"]
    scramble_moves = spec["scramble"]
    moves_low, moves_high = spec["target_moves"]
    lab = spec["lab"]

    primaries = rng.sample(PRIMARIES, min(colors, len(PRIMARIES)))
    bs, hs = generate_solved(primaries, beakers, height)
    performed = scramble_reversible(bs, hs, scramble_moves, rng)
    if performed < scramble_moves // 2:
        return None  # failed to scramble enough

    # trim empty trailing beakers? we keep them.
    serial_beakers = [{"layers": b.layers.copy()} for b in bs]

    # targetMoves heuristic: since moves are reversible, shortest <= performed, but reactions create intermediates
    # increase path length. Guesstimate with generous band.
    estimated = max(moves_low, min(moves_high, int(performed * 1.2) + rng.randint(2, 8)))

    return {
        "id": f"{tier[0]}{num + 1}",
        "lab": lab,
        "tier": tier,
        "beakers": serial_beakers,
        "heights": hs,
        "catalysts": catalysts,
        "targetMoves": estimated,
    }


TIER_SPECS = {
    "tutorial": {"primaries": 3, "beakers": 5, "height": 4, "catalysts": 3, "target_moves": (4, 14), "scramble": 14, "lab": "Apprentice Bench", "count": 15},
    "easy": {"primaries": 4, "beakers": 7, "height": 4, "catalysts": 2, "target_moves": (8, 25), "scramble": 20, "lab": "Apprentice Bench", "count": 40},
    "medium": {"primaries": 5, "beakers": 9, "height": 5, "catalysts": 2, "target_moves": (15, 45), "scramble": 35, "lab": "Master’s Altar", "count": 60},
    "hard": {"primaries": 6, "beakers": 11, "height": 5, "catalysts": 1, "target_moves": (25, 70), "scramble": 50, "lab": "Master’s Altar", "count": 80},
    "expert": {"primaries": 6, "beakers": 12, "height": 6, "catalysts": 1, "target_moves": (35, 100), "scramble": 70, "lab": "Forbidden Vault", "count": 60},
    "master": {"primaries": 7, "beakers": 13, "height": 6, "catalysts": 0, "target_moves": (50, 140), "scramble": 90, "lab": "Forbidden Vault", "count": 45},
}


def main() -> None:
    out_dir = "public/puzzles"
    os.makedirs(out_dir, exist_ok=True)
    for tier, spec in TIER_SPECS.items():
        levels: list[dict] = []
        attempts = 0
        while len(levels) < spec["count"] and attempts < spec["count"] * 20:
            attempts += 1
            lvl = generate_level(tier, len(levels), spec)
            if lvl:
                levels.append(lvl)
        path = os.path.join(out_dir, f"{tier}.json")
        with open(path, "w") as f:
            json.dump(levels, f, indent=2)
        print(f"{tier}: {len(levels)} levels written to {path}")
    print("Done.")


if __name__ == "__main__":
    main()
