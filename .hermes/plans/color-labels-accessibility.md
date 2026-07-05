# Color-Name Labels Accessibility Setting — Implementation Plan

> **For Hermes:** Use `subagent-driven-development` skill to implement this plan task-by-task, or implement directly following the steps below.

**Goal:** Add a persistent, mobile-friendly setting that overlays every colored layer (liquid + crystal) with its readable name, so players who can't distinguish hues can still match and plan pours on iPad/mobile.

**Architecture:** Add boolean `showLabels` to `SaveData.settings`. Render an optional `.layer-label` span inside each `.layer` (and `.layer-crystal`) that is hidden by default. When `body.show-layer-labels` is active, the label is shown. The setting is toggled from the Settings modal, persisted in `localStorage`, applied on app init, and affects both live beakers and help mini-diagrams.

**Tech Stack:** Vite + TypeScript + vanilla DOM + CSS custom properties.

---

## Task 1: Add `showLabels` to the settings type and default value

**Objective:** Introduce the new persistent setting in the save schema.

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/storage.ts`

**Step 1:** Open `src/engine/types.ts` and add `showLabels: boolean` to `Settings`.

```typescript
export interface SaveData {
  version: number;
  progress: { ... };
  settings: {
    sound: boolean;
    music: boolean;
    reducedMotion: boolean;
    highContrast: boolean;
    showLabels: boolean; // NEW
  };
  grimoire: string[];
  hasSeenIntro: boolean;
  hasSeenHelp: boolean;
  currentLevel: string | null;
}
```

**Step 2:** Open `src/engine/storage.ts` and locate `getDefaultSave()`. Add `showLabels: false`.

```typescript
export function getDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    progress: { ... },
    settings: {
      sound: true,
      music: true,
      reducedMotion: false,
      highContrast: false,
      showLabels: false, // NEW
    },
    grimoire: [],
    hasSeenIntro: false,
    hasSeenHelp: false,
    currentLevel: null,
  };
}
```

**Step 3:** In `loadSave()` in the same file, add migration for old saves that lack `showLabels`.

```typescript
if (typeof parsed.settings.showLabels !== 'boolean') {
  parsed.settings.showLabels = getDefaultSave().settings.showLabels;
}
```

**Verification:** `npx tsc --noEmit` passes with no new type errors.

**Commit:** `git add src/engine/types.ts src/engine/storage.ts && git commit -m "feat: add showLabels setting to save schema"`

---

## Task 2: Add a numeric ID mapping for every game color

**Objective:** Give each primary/intermediate a stable, small numeric ID so labels can display "Amber (2)" for extra clarity.

**Files:**
- Modify: `src/engine/constants.ts`

**Step 1:** After `PRIMARIES` and `INTERMEDIATES`, add a flat `COLORS` array and a `COLOR_ID` map.

```typescript
export const COLORS = [...PRIMARIES, ...INTERMEDIATES] as const;

export const COLOR_ID: Record<string, number> = {};
COLORS.forEach((color, index) => {
  COLOR_ID[color] = index + 1;
});
```

**Step 2:** Export `type Color = Primary | Intermediate` or keep using `GameColor` (no type change needed).

**Verification:** `console.log(COLOR_ID['crimson'])` should print 1; `COLOR_ID['turquoise']` should print 21.

**Commit:** `git add src/engine/constants.ts && git commit -m "feat: assign stable numeric ids to every color"`

---

## Task 3: Add CSS for `.layer-label`

**Objective:** Style the optional label so it is readable on dark and bright colors without breaking layout.

**Files:**
- Modify: `src/style.css`

**Step 1:** Insert a new block right after `.beaker .layer { ... }`.

```css
.layer-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: clamp(7px, 2vw, 10px);
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
  color: #fff;
  text-shadow:
    0 1px 2px rgba(0,0,0,0.85),
    0 0 4px rgba(0,0,0,0.6);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s ease;
}

/* Light-colored layers need dark text shadow */
.layer[data-color="saffron"] .layer-label,
.layer[data-color="amber"] .layer-label,
.layer[data-color="gold"] .layer-label,
.layer[data-color="lime"] .layer-label,
.layer[data-color="chartreuse"] .layer-label {
  text-shadow:
    0 1px 2px rgba(0,0,0,0.95),
    0 0 4px rgba(0,0,0,0.7);
}

/* Crystal variant uses a slightly smaller glyph */
.layer-crystal .layer-label {
  font-size: clamp(6px, 1.8vw, 9px);
}
```

**Step 2:** Add the body class rule near the other `body.*` overrides (e.g. after `body.high-contrast`).

```css
body.show-layer-labels .layer-label,
.layer.show-label {
  opacity: 1;
}
```

**Step 3:** Ensure the existing `::after` layer gloss does not visually cover the text. Inspect `.beaker .layer::after` and add `z-index: 0;` if absent; then `.layer-label { z-index: 1; }`.

**Verification:** Build and open a level; dev-tools toggle `body.show-layer-labels` and confirm labels appear.

**Commit:** `git add src/style.css && git commit -m "style: layer label rendering and show-layer-labels body class"`

---

## Task 4: Render labels in live beakers

**Objective:** Every layer/crystal DOM node gets a `.layer-label` child containing the color name and ID.

**Files:**
- Modify: `src/app.ts`

**Step 1:** Locate `renderBoard()`. Add a helper above it:

```typescript
function createLayerLabel(color: string): HTMLElement {
  const label = document.createElement('span');
  label.className = 'layer-label';
  const name = COLOR_NAME[color] ?? color;
  const id = COLOR_ID[color];
  label.textContent = id !== undefined ? `${name} ${id}` : name;
  label.setAttribute('aria-hidden', 'true');
  return label;
}
```

**Step 2:** In the crystal loop, append the label to `cEl`:

```typescript
for (const c of beaker.crystals) {
  const cEl = document.createElement('div');
  cEl.className = 'layer layer-crystal';
  if (animateSolidify && beakerChanged) cEl.classList.add('forming');
  cEl.dataset.color = c;
  cEl.appendChild(createLayerLabel(c));
  b.appendChild(cEl);
}
```

**Step 3:** In the liquid layer loop, append the label to `l`:

```typescript
for (let li = 0; li < beaker.layers.length; li++) {
  const layer = beaker.layers[li];
  const l = document.createElement('div');
  l.className = 'layer';
  l.dataset.color = layer;
  if (animateCatalyst && beakerChanged && li >= beaker.layers.length - 2) {
    l.classList.add('splitting');
  }
  l.appendChild(createLayerLabel(layer));
  b.appendChild(l);
}
```

**Step 4:** Update `applyBodyClasses()` to set the new body class:

```typescript
function applyBodyClasses() {
  document.body.classList.toggle('high-contrast', !!saveData.settings.highContrast);
  document.body.classList.toggle('reduced-motion', !!saveData.settings.reducedMotion);
  document.body.classList.toggle('show-layer-labels', !!saveData.settings.showLabels);
}
```

**Step 5:** Export/re-open `COLOR_NAME` and `COLOR_ID` imports if needed.

**Verification:** Run `npx tsc --noEmit`. Disable mouse hover; toggling `body.show-layer-labels` in dev-tools shows names on all layers.

**Commit:** `git add src/app.ts && git commit -m "feat: render color-name labels inside every layer"`

---

## Task 5: Add Settings UI toggle

**Objective:** Let players turn labels on/off from the Settings modal.

**Files:**
- Modify: `index.html`
- Modify: `src/app.ts`

**Step 1:** In `index.html`, add a new row inside `#settings-overlay .modal` after High Contrast.

```html
<div class="settings-row">
  <span>Show Color Labels</span>
  <button id="labels-toggle" class="toggle" role="switch" aria-checked="false"><span class="toggle-label">Off</span></button>
</div>
```

**Step 2:** In `index.html`, also add a help hint line right below the new row so users understand why it exists:

```html
<p class="settings-hint">Displays each color's name and number on every layer. Useful if colors look similar.</p>
```

**Step 3:** In `src/app.ts`, add the cached element:

```typescript
labelsToggle: () => document.getElementById('labels-toggle') as HTMLButtonElement,
```

**Step 4:** Bind the toggle in `bindEvents()`:

```typescript
bindToggle(els.labelsToggle(), 'showLabels');
```

**Step 5:** Update the setting-change callback so labels apply immediately. Locate `bindToggle()` and ensure its on-change handler calls `applyBodyClasses()`. Adjust to:

```typescript
function bindToggle(btn: HTMLButtonElement, key: keyof SaveData['settings']) {
  btn.addEventListener('click', () => {
    saveData.settings[key] = !saveData.settings[key] as any;
    syncToggle(btn, Boolean(saveData.settings[key]));
    if (key === 'reducedMotion' || key === 'highContrast' || key === 'showLabels') {
      applyBodyClasses();
    }
    if (key === 'sound' || key === 'music' || key === 'reducedMotion') {
      refreshSettings(saveData.settings);
    }
    persistSave();
  });
}
```

**Step 6:** Update `syncSettingsUI()` to sync the new toggle:

```typescript
syncToggle(els.labelsToggle(), !!saveData.settings.showLabels);
```

**Step 7:** Add CSS for `.settings-hint` if it does not exist.

```css
.settings-hint {
  font-size: 0.82rem;
  color: #a08058;
  margin: 4px 0 8px;
  line-height: 1.4;
}
```

**Verification:** Open Settings, toggle Show Color Labels, close modal, verify labels appear/disappear without reload.

**Commit:** `git add index.html src/app.ts src/style.css && git commit -m "feat: settings toggle for color labels"`

---

## Task 6: Apply labels to help mini-diagrams

**Objective:** Help examples use the same renderer logic so users can learn with labels enabled too.

**Files:**
- Modify: `src/engine/renderHelpVisuals.ts`

**Step 1:** Read the file. Find where `.mini-layer` elements are created. For each mini layer/crystal, append a `.layer-label` span **only when** `saveData.settings.showLabels` is true, or use a shared helper.

Because `renderHelpVisuals.ts` may not import `saveData`, simplest approach: pass a boolean `showLabels` argument to the render function from `app.ts`.

In `renderHelpVisuals.ts`:

```typescript
export function renderHelpVisuals(container: HTMLElement, examples: HelpExample[], showLabels: boolean) {
  // existing setup
  const labelSpan = (color: string) => {
    const span = document.createElement('span');
    span.className = 'layer-label';
    span.textContent = `${COLOR_NAME[color] ?? color} ${COLOR_ID[color] ?? ''}`.trim();
    span.setAttribute('aria-hidden', 'true');
    return span;
  };
  // when creating mini-layers/crystals, if showLabels append labelSpan(color)
}
```

**Step 2:** In `src/app.ts`, update the call sites to pass `saveData.settings.showLabels`.

**Verification:** Open Help, enable Show Color Labels, confirm mini-beakers in the Help modal show labels too.

**Commit:** `git add src/engine/renderHelpVisuals.ts src/app.ts && git commit -m "feat: show color labels in help mini-diagrams"`

---

## Task 7: Polish and QA

**Objective:** Ensure labels are not clipped, remain legible, and do not interfere with taps or animations.

**Step 1:** Verify `.beaker .layer` is `position: relative`. It is already, but double-check.

**Step 2:** Test beakers with 4 layers on iPad-class viewport (768px width). Labels should stay readable; if not, tune `clamp(6px, 1.8vw, 9px)`.

**Step 3:** Verify crystals with labels still show the ✦ glyph clearly. If needed, increase `z-index` of the `::after` star or reduce label opacity.

**Step 4:** Run full build.

```bash
npx tsc --noEmit
npm run build
```

**Step 5:** Run Playwright visual smoke test capturing labels on/off states. Include in `tests/smoke/` or a throwaway script. If Playwright isn't present, create a one-off screenshot script following `references/playwright-pwa-local-smoke.md`.

**Commit:** `git add . && git commit -m "chore: visual QA for color labels"`

---

## Task 8: Documentation update

**Objective:** Keep README/help in sync.

**Files:**
- Modify: `README.md` (if present)
- Optional: add one bullet in the Help > Settings note.

**Step 1:** If `README.md` lists settings, add:

```markdown
- **Show Color Labels** — overlays every liquid layer and crystal with its color name and number, helpful on devices where colors are hard to distinguish.
```

**Verification:** README renders the new bullet.

**Commit:** `git add README.md && git commit -m "docs: document Show Color Labels setting"`

---

## Acceptance Criteria

- [ ] Toggling **Settings → Show Color Labels** immediately shows/hides a name + number on every layer and crystal.
- [ ] The setting persists across reloads.
- [ ] Labels are visible on iPad/mobile without hover.
- [ ] Help mini-diagrams respect the setting.
- [ ] No TypeScript errors and production build succeeds.
- [ ] Visual smoke tests show labels clearly at mobile and desktop sizes.
- [ ] Reduce-motion users still see static labels.

---

## Notes

- The numeric ID is a fixed small integer. Once users learn "Crimson = 1", matching becomes colorblind-friendly.
- We do **not** add hover-based tooltips, satisfying the user's concern about touch devices.
- This feature is intentionally lightweight: one boolean setting, one body class, one span per layer.
