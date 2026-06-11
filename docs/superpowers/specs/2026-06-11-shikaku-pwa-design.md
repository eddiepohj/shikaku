# Shikaku PWA — Design

**Date:** 2026-06-11
**Owner:** Eddie Pohjavirta (orchestrator)
**Status:** Design approved, pending user review of written spec

---

## 1. Scope

A personal-use Shikaku puzzle game, installed to an iPhone home screen as a
Progressive Web App. Single user, single device. No accounts, no sharing, no
analytics, no monetisation. Three grid sizes. Infinite puzzles via algorithmic
generation. Works fully offline after first load.

The app is "done" when:

- Puzzles at all three sizes are reliably generated and uniquely solvable.
- Drag-from-number interaction feels good on a real iPhone.
- In-progress state survives closing and re-opening the app.
- The PWA is installed on the user's home screen and launches without browser
  chrome.

## 2. Game model (Shikaku rules)

- Rectangular grid of cells.
- Some cells contain a positive integer.
- The player partitions the entire grid into axis-aligned rectangles such that:
  1. Every rectangle contains exactly one numbered cell.
  2. The area of the rectangle equals that number.
  3. Rectangles do not overlap.
  4. Every cell belongs to exactly one rectangle.
- A puzzle is *valid* iff exactly one such partition exists.

## 3. Tech stack

- Vanilla HTML, CSS, JavaScript (ES modules). No framework. No build step.
- One service worker (`sw.js`) for offline caching of the app shell.
- One `manifest.webmanifest` declaring icon, theme colour, fullscreen display
  mode, and the app's start URL.
- `localStorage` for persistence.
- Hosted on GitHub Pages from the `main` branch of a public repo at
  `github.com/<your-github-username>/shikaku`. The exact username is filled
  in at repo-creation time during plan execution.

Rationale for no framework: app is small (~5 modules), no team, no shared
component library to integrate with, no SEO concern. A framework adds a build
step and runtime overhead for zero benefit at this scale.

## 4. Grid sizes and difficulty

Three sizes, each its own difficulty bucket:

| Label  | Size   | Approx. play time |
|--------|--------|-------------------|
| Easy   | 7×7    | 1–3 min           |
| Medium | 10×10  | 5–10 min          |
| Hard   | 15×15  | 15–25 min         |

All sizes fit an iPhone screen in portrait at native resolution without
pinch-zoom. The hard grid uses small cells; this is acceptable for a personal
app where the user controls their own device.

## 5. Code structure

Five modules, each with a single responsibility. All are pure ES modules; no
globals.

### `generator.js`
- **Input:** grid width, grid height, optional seed.
- **Output:** `{ width, height, clues: [{row, col, number}], solution: rectangles[] }`
- Produces a valid, uniquely solvable puzzle.

### `solver.js`
- **Input:** grid dimensions + clues.
- **Output:** count of valid solutions (caps at 2 — we only need to know
  "unique" vs "ambiguous").
- Used by the generator to filter ambiguous puzzles. Also used at runtime by
  the Check button.

### `state.js`
- Pure model. No DOM.
- Holds: current puzzle (from generator), player's committed rectangles,
  undo stack.
- Exposes mutations: `placeRect`, `removeRect`, `undo`, `restart`,
  `isComplete`, `currentErrors`.

### `ui.js`
- Renders the grid as an HTML `<canvas>` (chosen over DOM cells for fast redraw
  during drag preview, and clean rendering on retina).
- Owns the pointer event loop: pointerdown on a numbered cell → pointermove
  updates a preview rectangle → pointerup commits via `state.js`.
- Calls back into `app.js` on commit so persistence and solve-detection run.

### `app.js`
- Entry point. Boots from `localStorage` if a saved puzzle exists, otherwise
  shows a difficulty picker.
- Wires up Undo, Restart, Check, New Puzzle, difficulty change.
- Subscribes to `state` changes; on every change, writes to `localStorage` and
  checks `isComplete`.
- Registers the service worker.

### Files at root
- `index.html`, `app.css`, `manifest.webmanifest`, `sw.js`, `icon-*.png`.

## 6. Generator algorithm

Reverse construction (the standard Nikoli approach):

1. Start with a fresh empty grid of the requested dimensions.
2. Randomly partition the grid into axis-aligned rectangles. One workable
   method: repeatedly pick a random uncovered cell, pick a random rectangle
   size that fits without overlap (biased toward small areas to avoid
   pathological layouts), place it. Continue until the grid is fully covered.
   Re-roll the whole partition if covering gets stuck.
3. For each rectangle, choose a random cell within it; place a clue equal to
   the rectangle's area.
4. Run `solver.js` on the resulting puzzle.
5. If exactly one solution exists, return the puzzle.
6. Otherwise discard and retry from step 1.

Solver is a backtracking search: for each clue in order of fewest possible
rectangle placements, try every valid rectangle that contains the clue and
matches its area, recurse, prune on overlap with already-placed rectangles.
Cap solution-counting at 2.

Expected time per puzzle on a modern phone: well under 100 ms for 7×7 and
10×10, under 1 s for 15×15. If real-world measurement disagrees, generation
moves to a Web Worker; design is structured so this is a localised change in
`app.js` only.

## 7. Interaction model

**Anchor-and-drag from a numbered cell.**

- `pointerdown` on a numbered cell starts a drag. The number is the anchor
  corner; no rectangle is committed yet.
- `pointermove` extends a preview rectangle from the anchor to the cell under
  the pointer. The preview tints red if it would overlap another committed
  rectangle or its area is not equal to the anchor's number.
- `pointerup` commits the rectangle via `state.placeRect`. If the rectangle is
  invalid (overlap or wrong area), the commit is rejected and the prior
  rectangle for that anchor (if any) stays.
- Re-dragging from the same number replaces its rectangle.
- Dragging back to a 1×1 on the number and releasing deletes it (when the
  number is not 1).

`pointerdown` on a non-numbered cell is a no-op. There is no other way to
create or modify rectangles. This enforces rule (1) — exactly one rectangle
per number — at the interaction layer.

The canvas is sized for the device's CSS pixel grid; cells are square; the
whole grid is centred with safe-area padding for the iPhone notch and home
indicator.

## 8. Features

- **Difficulty picker.** Shown on first launch and via a small button in the
  top bar. Picking a new difficulty generates a new puzzle.
- **New puzzle.** Button in the top bar. If a puzzle is in progress, shows a
  confirmation dialog before discarding it; otherwise generates immediately.
- **Undo.** Reverts the last commit. Unlimited depth within the current
  puzzle.
- **Restart.** Clears all rectangles. Keeps the current puzzle.
- **Live error highlight.** Already covered in §7 — preview tints red when
  the in-flight rectangle would be invalid.
- **Check button.** Validates the current board; tints any committed
  rectangle that overlaps another or has area ≠ its number. Redundant given
  live errors and solve-detection but trivial to implement and keep.
- **Dark mode.** CSS `prefers-color-scheme` switch. No in-app toggle.
- **Solve detection.** After every commit, `state.isComplete` runs. On
  completion: a brief flourish animation, then a modal offering a fresh
  puzzle at the same difficulty (with a difficulty-change option). Closing
  the modal generates the new puzzle.
- **Persistence.** Auto-save on every state change. App boots straight into
  the saved puzzle. Clearing a puzzle on solve removes the save.

## 9. Persistence schema

One `localStorage` key: `shikaku.v1.state`.

```json
{
  "difficulty": "medium",
  "puzzle": { "width": 10, "height": 10, "clues": [...], "solution": [...] },
  "rectangles": [
    { "anchor": {"row": 2, "col": 3}, "top": 2, "left": 3, "bottom": 4, "right": 5 }
  ],
  "undoStack": [ /* prior rectangle arrays */ ]
}
```

The `v1` in the key allows a future schema migration to coexist with old
saves. No migration is shipped in v1; old saves on schema mismatch are
discarded.

## 10. Visual style

- Minimalist, paper-feeling.
- Light mode: cream `#FAF7F0` background, charcoal `#2A2A2A` grid lines and
  numbers.
- Dark mode: `#1A1A1A` background, `#E8E5DE` grid lines and numbers.
- Committed rectangles: filled with a low-saturation hue from a palette of
  eight pastels (light mode) or muted jewel tones (dark mode), assigned so
  adjacent rectangles never share a hue (four-colour theorem makes this always
  achievable; we use a greedy assignment).
- Numbers: bold sans-serif, ~60% of cell height, centred.
- Solved-puzzle flourish: brief (≤500 ms) pulse on each rectangle.

Exact palette values land in the implementation plan, not here.

## 11. Hosting and deploy

- Repo: `github.com/<your-github-username>/shikaku`, public.
- GitHub Pages serves from `main` branch, root.
- Custom domain: none in v1. The default `*.github.io` URL is acceptable for
  personal use.
- Deploy = `git push`. No CI; the static files are the source of truth.
- The user installs the app once by visiting the URL on iPhone Safari and
  tapping Share → Add to Home Screen. Subsequent updates: pull to refresh
  inside the running app, or relaunch — the service worker fetches the new
  shell on next start.

## 12. Out of scope (explicit YAGNI)

The following are deliberately excluded from v1. If any becomes desirable later
it becomes a new spec.

- Timer
- Hints
- Stats / completion history
- Multiplayer or sharing
- Accounts / cloud sync
- Sound effects
- Animations beyond the solved-puzzle flourish
- In-app settings beyond difficulty
- Manual dark-mode toggle (OS setting only)
- Tutorial / how-to-play screen (the user knows Shikaku)
- Native iOS port
- Custom domain
- Telemetry / crash reporting
- More than three grid sizes
- Custom palettes / themes
- Internationalisation

## 13. Risks and open questions

| Risk | Mitigation |
|------|-----------|
| Generator slow on 15×15 | Move to Web Worker; design supports this without restructuring. |
| Generator produces boring puzzles | Acceptable for personal use in v1; tuneable later via clue-density bias. |
| iOS Safari quirks with `pointer` events on canvas | Use the `pointer` events polyfill or fall back to `touch`+`mouse`; verify on a real device early. |
| `localStorage` cleared by iOS under storage pressure | Acceptable loss; user just gets a fresh puzzle. |
| GitHub Pages caching of `sw.js` causes stale shells | Add a versioned cache name; bump on deploy. |

## 14. Acceptance criteria

The implementation is complete when:

1. `npm test` (or equivalent — see plan) passes a generator/solver test suite
   that produces 100 puzzles per size and confirms uniqueness for each.
2. On a real iPhone running iOS 17+ with the PWA installed, the user can:
   - Pick a difficulty.
   - Drag from numbers to place rectangles, with live red-tint feedback.
   - Undo, restart, check, get a new puzzle.
   - Force-quit the app mid-puzzle and resume on next launch.
   - Solve a puzzle and be offered a fresh one.
   - Play with the device in airplane mode after first install.
3. Lighthouse PWA audit reports installable, offline-capable, manifest valid.
