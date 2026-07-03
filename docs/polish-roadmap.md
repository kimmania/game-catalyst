# Catalyst Polish Roadmap

## Goal
Make `game-catalyst` feel like a cohesive, polished alchemy-lab puzzle game. Keep puzzles as static committed assets, avoid external sprite/audio dependencies, and respect `prefers-reduced-motion` / `.reduced-motion`.

## Priority ordering
We'll tackle the smallest high-impact/foundation items first, then chain into the larger UI features.

---

## Phase 1 — Foundational polish (small, safe)

### 1.1 Remove scaffolded/unused assets and dead CSS
- Remove any CSS rules from `src/style.css` that have no element (e.g. old `.mini-cap`, `.mini-crystals` if still present; use `git grep` / DevTools to confirm).
- Ensure no leftover references to removed IDs/classes in `index.html` or `src/app.ts`.
- Verify build stays green.
- **Files:** `src/style.css`, `index.html`, `src/app.ts`
- **Test:** `npm run build` passes; grep for removed selectors returns nothing.

### 1.2 Better `:focus-visible` rings
- Replace browser default outlines with a gold/glow `outline` or `box-shadow` that matches the parchment/brass theme.
- Apply to `.btn`, `.beaker`, `.map-node`, toggle buttons.
- Respect `.reduced-motion` and `prefers-reduced-motion`.
- **Files:** `src/style.css`
- **Test:** Tab through UI in a desktop browser and visually verify consistent focus rings.

### 1.3 Skip intro for returning players
- Change bootstrap: if `hasSeenIntro` is already true, do not show `#intro-screen` at all; show `#map-screen` directly.
- Keep the intro reachable via a button from the map topbar (e.g. “Credits / Intro”) or by clearing progress.
- **Files:** `src/app.ts`
- **Test:** With existing save (`hasSeenIntro: true`), reload → map appears immediately. Clear save → intro appears.

---

## Phase 2 — In-game feedback & clarity

### 2.1 Target moves display
- Add a `#target-moves` readout near the moves counter (e.g., "12 / 18" or separate "Target: 18").
- Use `state.targetMoves` which already exists in `LevelData`/`GameState`.
- Update on `renderBoard`/`postMove`.
- **Files:** `index.html`, `src/app.ts`, `src/style.css`
- **Test:** Start level `t1`; confirm target moves shown. Compare against `public/puzzles/tutorial.json` `targetMoves`.

### 2.2 Animated star reveal on victory
- In `#level-complete-overlay`, add CSS keyframes for `.star` to scale from 0 → 1.1 → 1 with a small rotation.
- Stagger via `animation-delay` from inline styles (e.g. 0ms, 120ms, 240ms).
- Gate behind reduced-motion.
- **Files:** `src/style.css`, `src/app.ts` (or inline styles in `showWin`)
- **Test:** Win a level; stars pop in sequentially. With reduced motion enabled, stars appear instantly.

### 2.3 Empty-beaker glass styling
- Give an empty `.beaker` an inner gradient or faint horizon line so it reads as a clean flask rather than a dark void.
- Keep existing selected/hover states working.
- **Files:** `src/style.css`
- **Test:** Load a level, observe an empty beaker.

### 2.4 Haptic feedback (optional but small)
- On valid pour and valid catalyst, call `navigator.vibrate?.(10)` or `(navigator as Navigator).vibrate?.(8)`.
- Guard so it never throws on unsupported platforms.
- Add a settings toggle if desired; minimal first pass is just a safe call guarded by `navigator.vibrate`.
- **Files:** `src/app.ts`
- **Test:** On Android, feel a tiny bump on pour.

---

## Phase 3 — Map atmosphere & transitions

### 3.1 Region-specific page tint
- Add CSS custom properties for each region (e.g. `--region-glow`, `--region-accent`) and set them on `body[data-region="..."]` or on `#map-screen`.
- Use a subtle radial gradient behind the map header and a 1–2px accent on region titles/path dividers.
- Suggested palette:
  - tutorial: warm candlelight `#a08050`
  - easy (Vitriol Vault): amber `#b87830`
  - medium (Sulfur Crucible): sulfur yellow-green `#8a9a30`
  - hard (Mercury Alembic): pale teal/silver `#409090`
  - expert (Athanor Heart): furnace orange `#a85028`
  - master (Azoth Chamber): iridescent violet `#7848a0`
- **Files:** `src/style.css`, `src/app.ts` (set `body.dataset.region` in `showMap` / `startLevel`)
- **Test:** Navigate to each region; header/path color subtly shifts.

### 3.2 Screen transitions
- Add small fade/slide classes (e.g. `.screen-enter`, `.screen-leave`) and transition `opacity` + `transform` for 200–250ms.
- Apply when switching between intro/map/game.
- Use reduced-motion guard.
- **Files:** `src/style.css`, helper in `src/app.ts` (`showScreen(name)`)
- **Test:** Move between map and game; transition feels smooth but not slow.

### 3.3 Better map node unlocked/locked visuals
- Locked nodes: desaturated, lower opacity, maybe a small padlock glyph.
- Unlocked completed nodes: show star count inside the node or as a ring.
- Current node: a pulsing ring instead of just bold text.
- **Files:** `src/style.css`, `src/app.ts` (`renderMap` classes)
- **Test:** View map with mix of locked/unlocked/completed levels.

---

## Phase 4 — Discovery / Grimoire feature

### 4.1 Add a grimoire data model
- Persist newly discovered colors in `SaveData.grimoire` when a reaction first occurs.
- In `src/engine/constants.ts`, add a `REACTION_LORE: Record<string, { title: string; flavor: string }>` mapping result colors to alchemy-themed names (e.g. orange → “Sun-Kissed Tincture”).
- **Files:** `src/engine/constants.ts`, `src/engine/storage.ts` (if migration needed; likely not)
- **Test:** Unit-check that reaction lore exists for every result color reachable in the puzzle banks.

### 4.2 Add Grimoire screen
- New `#grimoire-overlay` or `#grimoire-screen` listing discovered reactions as recipe cards.
- Each card shows parent-color dots, result pill, lore title, and short flavor text.
- Add a map topbar button (“Grimoire”) and, if desired, a toolbar button in game.
- **Files:** `index.html`, `src/app.ts`, `src/style.css`
- **Test:** Make a reaction in game, open Grimoire; new recipe appears. Reload; persisted.

### 4.3 Inline reaction preview styling
- In the existing `#reaction-table`, show a tiny “spark” icon or plus/equals pattern between parent colors and result instead of plain text.
- Use existing color classes; keep table compact.
- **Files:** `src/app.ts` (rendering), `src/style.css`
- **Test:** Make a reaction; table row renders clear visual equation.

---

## Phase 5 — Accessibility & final cleanup

### 5.1 Map node ARIA + focus
- Ensure each `.map-node` is a `<button>` or has `role="button"`, `tabindex="0"`, `aria-label` describing region, level number, and star count.
- Add keyboard activation (Enter/Space) if not already buttons.
- **Files:** `src/app.ts` (`renderMap`), `src/style.css`
- **Test:** Tab through map nodes; screen reader announces level info correctly.

### 5.2 Live region for move/reaction announcements
- Add `aria-live="polite"` region that briefly announces:
  - invalid move reason,
  - reaction discovered name,
  - star rating on win.
- Keep visually hidden.
- **Files:** `index.html`, `src/app.ts`
- **Test:** Turn on VoiceOver/TalkBack; hear key events announced.

### 5.3 Reduce accidental mobile double-tap / long-press menus
- Already has `touch-action: manipulation` globally; verify no image or button triggers context menu with `oncontextmenu="return false;"` if desired.
- **Files:** `src/app.ts`/`index.html` maybe
- **Test:** Long-press a beaker on iOS; no context menu.

### 5.4 Final cleanup & docs
- Update `README.md` with new features (Grimoire, target moves, region tints).
- Run full typecheck/build/audit.
- Commit each phase separately.
- **Files:** `README.md`
- **Test:** `npm run build` passes; README accurately describes current behavior.

---

## Execution plan

We can implement in the order above. Each phase is a commit-sized chunk. If you want me to start immediately, say **“Execute Phase 1”** (or list phase numbers) and I'll do them one at a time, typechecking and building after each.
