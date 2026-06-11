# Shikaku PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal-use Shikaku puzzle PWA, installed to an iPhone home screen, working fully offline after first load.

**Architecture:** Five vanilla-JS ES modules (`solver`, `generator`, `state`, `ui`, `app`) served as static files from GitHub Pages. Canvas-rendered grid with anchor-and-drag interaction. `localStorage` persistence. Service-worker app-shell cache for offline.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules, no build step), Node's built-in test runner for unit tests, GitHub Pages for hosting, ImageMagick for icon generation.

**Spec:** [`../specs/2026-06-11-shikaku-pwa-design.md`](../specs/2026-06-11-shikaku-pwa-design.md)

**Working directory throughout:** `~/projects/shikaku/`

---

## File map

After all tasks:

```
~/projects/shikaku/
├── .gitignore
├── README.md
├── package.json
├── index.html
├── app.css
├── manifest.webmanifest
├── sw.js
├── js/
│   ├── solver.js
│   ├── generator.js
│   ├── state.js
│   ├── ui.js
│   └── app.js
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon.svg
├── tests/
│   ├── solver.test.js
│   ├── generator.test.js
│   └── state.test.js
└── docs/superpowers/{specs,plans}/...   (already exist)
```

---

## Task 1: Project bootstrap

**Files:**
- Create: `package.json`, `.gitignore`, `README.md`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "shikaku",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "serve": "python3 -m http.server 8000"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
.DS_Store
node_modules/
*.log
.vscode/
```

- [ ] **Step 3: Create `README.md`**

```markdown
# Shikaku

Personal-use Shikaku puzzle PWA. Three grid sizes (7×7, 10×10, 15×15), algorithmically generated puzzles, offline-capable.

## Develop

    npm run serve   # static file server at http://localhost:8000
    npm test        # run unit tests

## Spec & plan

See `docs/superpowers/specs/` and `docs/superpowers/plans/`.
```

- [ ] **Step 4: Verify `node --test` runs (with zero tests it should report 0 passed)**

Run: `cd ~/projects/shikaku && npm test`
Expected: exits 0, reports `# tests 0` or similar.

- [ ] **Step 5: Commit**

```bash
cd ~/projects/shikaku
git add package.json .gitignore README.md
git commit -m "chore: bootstrap project (package.json, gitignore, README)"
```

---

## Task 2: Solver — single-clue cases

The solver counts solutions for a puzzle, capped at 2. Used by the generator to verify uniqueness and by the UI's Check button. We build it up across three tasks; this task handles the easy "one clue covers the whole grid" cases.

**Files:**
- Create: `js/solver.js`, `tests/solver.test.js`

- [ ] **Step 1: Write failing tests for the trivial cases**

Create `tests/solver.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countSolutions } from '../js/solver.js';

test('1x1 grid with clue 1 has exactly one solution', () => {
  const puzzle = { width: 1, height: 1, clues: [{ row: 0, col: 0, number: 1 }] };
  assert.equal(countSolutions(puzzle), 1);
});

test('2x2 grid with clue 4 at corner has exactly one solution', () => {
  const puzzle = { width: 2, height: 2, clues: [{ row: 0, col: 0, number: 4 }] };
  assert.equal(countSolutions(puzzle), 1);
});

test('1x4 grid with clue 4 has exactly one solution', () => {
  const puzzle = { width: 4, height: 1, clues: [{ row: 0, col: 0, number: 4 }] };
  assert.equal(countSolutions(puzzle), 1);
});

test('2x2 grid with clue 1 in corner returns 0 (cannot cover all cells)', () => {
  const puzzle = { width: 2, height: 2, clues: [{ row: 0, col: 0, number: 1 }] };
  assert.equal(countSolutions(puzzle), 0);
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `npm test`
Expected: FAIL — `Cannot find module ../js/solver.js`.

- [ ] **Step 3: Implement minimal solver**

Create `js/solver.js`:

```javascript
// Count valid Shikaku solutions for the given puzzle, capped at `cap`.
// A solution is an assignment of one axis-aligned rectangle to each clue such that:
//   - the rectangle contains its clue cell
//   - the rectangle's area equals the clue number
//   - rectangles do not overlap
//   - every cell is covered
export function countSolutions(puzzle, cap = 2) {
  const { width, height, clues } = puzzle;
  const grid = Array.from({ length: height }, () => new Array(width).fill(-1));
  let count = 0;

  function rectanglesForClue(clue) {
    const { row, col, number } = clue;
    const rects = [];
    for (let h = 1; h <= number; h++) {
      if (number % h !== 0) continue;
      const w = number / h;
      // Rectangle of size h x w, must contain (row, col).
      const minTop = Math.max(0, row - h + 1);
      const maxTop = Math.min(height - h, row);
      const minLeft = Math.max(0, col - w + 1);
      const maxLeft = Math.min(width - w, col);
      for (let top = minTop; top <= maxTop; top++) {
        for (let left = minLeft; left <= maxLeft; left++) {
          rects.push({ top, left, bottom: top + h - 1, right: left + w - 1 });
        }
      }
    }
    return rects;
  }

  function fits(rect) {
    for (let r = rect.top; r <= rect.bottom; r++)
      for (let c = rect.left; c <= rect.right; c++)
        if (grid[r][c] !== -1) return false;
    return true;
  }

  function paint(rect, value) {
    for (let r = rect.top; r <= rect.bottom; r++)
      for (let c = rect.left; c <= rect.right; c++)
        grid[r][c] = value;
  }

  function allCovered() {
    for (let r = 0; r < height; r++)
      for (let c = 0; c < width; c++)
        if (grid[r][c] === -1) return false;
    return true;
  }

  function backtrack(idx) {
    if (count >= cap) return;
    if (idx === clues.length) {
      if (allCovered()) count++;
      return;
    }
    for (const rect of rectanglesForClue(clues[idx])) {
      if (!fits(rect)) continue;
      paint(rect, idx);
      backtrack(idx + 1);
      paint(rect, -1);
      if (count >= cap) return;
    }
  }

  backtrack(0);
  return count;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Commit**

```bash
cd ~/projects/shikaku
git add js/solver.js tests/solver.test.js
git commit -m "feat(solver): single-clue puzzle solving with backtracking"
```

---

## Task 3: Solver — multi-clue and uniqueness

The interesting case: multiple clues, ambiguous puzzles return 2 (the cap), uniquely-solvable puzzles return 1.

**Files:**
- Modify: `tests/solver.test.js`

- [ ] **Step 1: Add failing tests**

Append to `tests/solver.test.js`:

```javascript
test('2x2 with two clue-2s (opposite corners) is ambiguous (returns 2)', () => {
  const puzzle = {
    width: 2, height: 2,
    clues: [
      { row: 0, col: 0, number: 2 },
      { row: 1, col: 1, number: 2 },
    ],
  };
  // Two solutions: both horizontal (top/bottom rows) or both vertical (left/right cols).
  assert.equal(countSolutions(puzzle), 2);
});

test('2x3 with two clue-3s on opposite rows is uniquely solvable', () => {
  const puzzle = {
    width: 3, height: 2,
    clues: [
      { row: 0, col: 0, number: 3 },
      { row: 1, col: 2, number: 3 },
    ],
  };
  assert.equal(countSolutions(puzzle), 1);
});

test('3x3 with clue 9 covers whole grid uniquely', () => {
  const puzzle = {
    width: 3, height: 3,
    clues: [{ row: 1, col: 1, number: 9 }],
  };
  assert.equal(countSolutions(puzzle), 1);
});

test('cap parameter bounds the count', () => {
  // 3x1 strip with one clue 1 at the middle leaves two cells uncoverable → 0 solutions.
  // Verify cap=1 still returns 0 (no false short-circuit).
  const puzzle = { width: 3, height: 1, clues: [{ row: 0, col: 1, number: 1 }] };
  assert.equal(countSolutions(puzzle, 1), 0);
});
```

- [ ] **Step 2: Run tests, verify pass (the existing solver should already handle these)**

Run: `npm test`
Expected: PASS — 8 tests passed total.

If any fail, debug the solver before continuing — these cases are core to correctness.

- [ ] **Step 3: Commit**

```bash
cd ~/projects/shikaku
git add tests/solver.test.js
git commit -m "test(solver): cover multi-clue and uniqueness cases"
```

---

## Task 4: Solver — most-constrained-variable heuristic

Naive backtracking will be too slow on 15×15. Sort clues by the number of valid rectangle placements before backtracking, so the most-constrained clues are placed first.

**Files:**
- Modify: `js/solver.js`
- Modify: `tests/solver.test.js`

- [ ] **Step 1: Add a perf test**

Append to `tests/solver.test.js`:

```javascript
test('solver completes a 7x7 puzzle quickly', () => {
  // Four-quadrant partition of a 7x7 grid (uniquely solvable, hand-verified):
  //   top-left  3x3 (area  9), top-right  3x4 (area 12),
  //   bottom-left 4x3 (area 12), bottom-right 4x4 (area 16).
  // Clues placed in the corners.
  const puzzle = {
    width: 7, height: 7,
    clues: [
      { row: 0, col: 0, number: 9 },
      { row: 0, col: 6, number: 12 },
      { row: 6, col: 0, number: 12 },
      { row: 6, col: 6, number: 16 },
    ],
  };
  const t0 = Date.now();
  const n = countSolutions(puzzle);
  const elapsed = Date.now() - t0;
  assert.equal(n, 1);
  assert.ok(elapsed < 200, `solver took ${elapsed}ms, expected <200ms`);
});
```

- [ ] **Step 2: Run tests, verify pass or note failure**

Run: `npm test`
Expected: probably PASS at this grid size, but if perf is slow, the next step optimises.

- [ ] **Step 3: Add most-constrained-variable ordering in `js/solver.js`**

Replace the body of `countSolutions` so that, before backtracking, clues are sorted by their precomputed rectangle count (ascending). Replace lines starting at `function backtrack(idx) {` and below with:

```javascript
  // Precompute rectangles per clue and sort clues by ascending count
  // (most-constrained-variable heuristic).
  const indexed = clues.map((clue, originalIdx) => ({
    originalIdx,
    rects: rectanglesForClue(clue),
  }));
  indexed.sort((a, b) => a.rects.length - b.rects.length);

  function backtrack(idx) {
    if (count >= cap) return;
    if (idx === indexed.length) {
      if (allCovered()) count++;
      return;
    }
    for (const rect of indexed[idx].rects) {
      if (!fits(rect)) continue;
      paint(rect, indexed[idx].originalIdx);
      backtrack(idx + 1);
      paint(rect, -1);
      if (count >= cap) return;
    }
  }

  backtrack(0);
  return count;
}
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `npm test`
Expected: PASS — 9 tests passed.

- [ ] **Step 5: Commit**

```bash
cd ~/projects/shikaku
git add js/solver.js tests/solver.test.js
git commit -m "perf(solver): sort clues by placement count (MCV heuristic)"
```

---

## Task 5: Generator — reverse construction

Generate a uniquely-solvable puzzle by partitioning a grid into random rectangles, placing one clue per rectangle, then using the solver to confirm uniqueness.

**Files:**
- Create: `js/generator.js`, `tests/generator.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/generator.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle } from '../js/generator.js';
import { countSolutions } from '../js/solver.js';

const SIZES = [
  { label: 'easy', width: 7, height: 7 },
  { label: 'medium', width: 10, height: 10 },
  { label: 'hard', width: 15, height: 15 },
];

for (const size of SIZES) {
  test(`generator produces uniquely-solvable ${size.label} puzzle`, () => {
    const puzzle = generatePuzzle(size.width, size.height, 42);
    assert.equal(puzzle.width, size.width);
    assert.equal(puzzle.height, size.height);
    assert.ok(puzzle.clues.length > 0);
    // Sum of clue numbers must equal grid area.
    const sum = puzzle.clues.reduce((s, c) => s + c.number, 0);
    assert.equal(sum, size.width * size.height);
    // Solver confirms exactly one solution.
    assert.equal(countSolutions(puzzle), 1);
  });
}

test('generator is deterministic with the same seed', () => {
  const a = generatePuzzle(7, 7, 12345);
  const b = generatePuzzle(7, 7, 12345);
  assert.deepEqual(a.clues, b.clues);
});

test('generator varies with different seeds', () => {
  const a = generatePuzzle(7, 7, 1);
  const b = generatePuzzle(7, 7, 2);
  assert.notDeepEqual(a.clues, b.clues);
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `npm test`
Expected: FAIL — `Cannot find module ../js/generator.js`.

- [ ] **Step 3: Implement the generator**

Create `js/generator.js`:

```javascript
import { countSolutions } from './solver.js';

// Mulberry32 — deterministic seeded PRNG.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Try to partition the grid into rectangles by repeatedly placing a randomly
// sized rectangle anchored at the first uncovered cell (scanning row-major).
// Returns the list of rectangles, or null if the partition got stuck.
function tryPartition(width, height, rand) {
  const grid = Array.from({ length: height }, () => new Array(width).fill(-1));
  const rects = [];

  function firstUncovered() {
    for (let r = 0; r < height; r++)
      for (let c = 0; c < width; c++)
        if (grid[r][c] === -1) return { r, c };
    return null;
  }

  function maxRunRight(row, col) {
    let n = 0;
    while (col + n < width && grid[row][col + n] === -1) n++;
    return n;
  }

  function maxRunDown(row, col, w) {
    let n = 0;
    while (row + n < height) {
      for (let c = col; c < col + w; c++) if (grid[row + n][c] !== -1) return n;
      n++;
    }
    return n;
  }

  while (true) {
    const cell = firstUncovered();
    if (!cell) break;
    const { r, c } = cell;

    const maxW = maxRunRight(r, c);
    // Bias toward small rectangles to avoid pathological layouts.
    const w = 1 + Math.floor(rand() * Math.min(maxW, 5));
    const maxH = maxRunDown(r, c, w);
    const h = 1 + Math.floor(rand() * Math.min(maxH, 5));
    if (w * h < 1) return null;

    const idx = rects.length;
    for (let rr = r; rr < r + h; rr++)
      for (let cc = c; cc < c + w; cc++)
        grid[rr][cc] = idx;
    rects.push({ top: r, left: c, bottom: r + h - 1, right: c + w - 1 });
  }
  return rects;
}

// Place one clue per rectangle, at a random cell within it, with number = area.
function placeClues(rects, rand) {
  return rects.map((rect) => {
    const h = rect.bottom - rect.top + 1;
    const w = rect.right - rect.left + 1;
    const row = rect.top + Math.floor(rand() * h);
    const col = rect.left + Math.floor(rand() * w);
    return { row, col, number: h * w };
  });
}

export function generatePuzzle(width, height, seed = Date.now() & 0x7fffffff) {
  const rand = mulberry32(seed);
  for (let attempt = 0; attempt < 200; attempt++) {
    const rects = tryPartition(width, height, rand);
    if (!rects) continue;
    const clues = placeClues(rects, rand);
    const puzzle = { width, height, clues };
    if (countSolutions(puzzle) === 1) return puzzle;
  }
  throw new Error(`Failed to generate a unique puzzle for ${width}x${height} after 200 attempts`);
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test`
Expected: PASS — 14 tests passed total. The 15×15 generation may take a few seconds.

- [ ] **Step 5: If 15×15 generation is too slow (>10s) or fails, increase the attempt cap and re-run**

If timing is unacceptable, increase the `200` retry cap in `generatePuzzle` and / or add a `cap: 2` early-exit in solver calls (already the default). If it still fails, add a note to the README and consider a Web Worker (deferred to a follow-up task — not in this plan).

- [ ] **Step 6: Commit**

```bash
cd ~/projects/shikaku
git add js/generator.js tests/generator.test.js
git commit -m "feat(generator): reverse-construction Shikaku puzzle generator"
```

---

## Task 6: State module

The pure model of the player's session: which rectangles they've committed, undo history, completeness check, error detection. No DOM.

**Files:**
- Create: `js/state.js`, `tests/state.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/state.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../js/state.js';

const tinyPuzzle = {
  width: 2, height: 2,
  clues: [
    { row: 0, col: 0, number: 2 },
    { row: 1, col: 1, number: 2 },
  ],
};

test('new state has no rectangles and is not complete', () => {
  const s = createState(tinyPuzzle);
  assert.deepEqual(s.rectangles(), []);
  assert.equal(s.isComplete(), false);
});

test('placeRect adds a rectangle anchored at the given clue', () => {
  const s = createState(tinyPuzzle);
  s.placeRect({ row: 0, col: 0 }, { top: 0, left: 0, bottom: 0, right: 1 });
  assert.equal(s.rectangles().length, 1);
  assert.deepEqual(s.rectangles()[0].anchor, { row: 0, col: 0 });
});

test('placeRect replaces an existing rectangle from the same anchor', () => {
  const s = createState(tinyPuzzle);
  s.placeRect({ row: 0, col: 0 }, { top: 0, left: 0, bottom: 0, right: 1 });
  s.placeRect({ row: 0, col: 0 }, { top: 0, left: 0, bottom: 1, right: 0 });
  assert.equal(s.rectangles().length, 1);
  assert.equal(s.rectangles()[0].right, 0);
  assert.equal(s.rectangles()[0].bottom, 1);
});

test('placeRect on non-clue cell throws', () => {
  const s = createState(tinyPuzzle);
  assert.throws(() => s.placeRect({ row: 0, col: 1 }, { top: 0, left: 1, bottom: 0, right: 1 }));
});

test('removeRect deletes by anchor', () => {
  const s = createState(tinyPuzzle);
  s.placeRect({ row: 0, col: 0 }, { top: 0, left: 0, bottom: 0, right: 1 });
  s.removeRect({ row: 0, col: 0 });
  assert.equal(s.rectangles().length, 0);
});

test('undo reverses the last commit', () => {
  const s = createState(tinyPuzzle);
  s.placeRect({ row: 0, col: 0 }, { top: 0, left: 0, bottom: 0, right: 1 });
  s.placeRect({ row: 1, col: 1 }, { top: 1, left: 0, bottom: 1, right: 1 });
  assert.equal(s.rectangles().length, 2);
  s.undo();
  assert.equal(s.rectangles().length, 1);
});

test('restart clears all rectangles but allows undo back to them', () => {
  const s = createState(tinyPuzzle);
  s.placeRect({ row: 0, col: 0 }, { top: 0, left: 0, bottom: 0, right: 1 });
  s.restart();
  assert.equal(s.rectangles().length, 0);
  s.undo();
  assert.equal(s.rectangles().length, 1);
});

test('isComplete is true when all clues have valid rectangles covering the grid', () => {
  const s = createState(tinyPuzzle);
  s.placeRect({ row: 0, col: 0 }, { top: 0, left: 0, bottom: 0, right: 1 });
  s.placeRect({ row: 1, col: 1 }, { top: 1, left: 0, bottom: 1, right: 1 });
  assert.equal(s.isComplete(), true);
});

test('currentErrors flags rectangles with wrong area', () => {
  const s = createState(tinyPuzzle);
  // Clue is 2 but we place a 1x1 rectangle.
  s.placeRect({ row: 0, col: 0 }, { top: 0, left: 0, bottom: 0, right: 0 });
  const errors = s.currentErrors();
  assert.equal(errors.length, 1);
  assert.equal(errors[0].reason, 'wrong-area');
});

test('currentErrors flags overlapping rectangles', () => {
  const s = createState(tinyPuzzle);
  // Both clues claim the same cell (1,0): wrong shapes but overlap-checkable.
  s.placeRect({ row: 0, col: 0 }, { top: 0, left: 0, bottom: 1, right: 0 });
  s.placeRect({ row: 1, col: 1 }, { top: 1, left: 0, bottom: 1, right: 1 });
  const errors = s.currentErrors();
  assert.ok(errors.some((e) => e.reason === 'overlap'));
});

test('serialize and restore round-trip preserves state', () => {
  const s = createState(tinyPuzzle);
  s.placeRect({ row: 0, col: 0 }, { top: 0, left: 0, bottom: 0, right: 1 });
  const blob = s.serialize();
  const t = createState(tinyPuzzle, blob);
  assert.deepEqual(t.rectangles(), s.rectangles());
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `npm test`
Expected: FAIL — `Cannot find module ../js/state.js`.

- [ ] **Step 3: Implement state module**

Create `js/state.js`:

```javascript
function isClue(puzzle, row, col) {
  return puzzle.clues.some((c) => c.row === row && c.col === col);
}

function clueAt(puzzle, row, col) {
  return puzzle.clues.find((c) => c.row === row && c.col === col);
}

function rectArea(r) {
  return (r.bottom - r.top + 1) * (r.right - r.left + 1);
}

function rectsOverlap(a, b) {
  return !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
}

export function createState(puzzle, restoreBlob = null) {
  // rectangles: array of { anchor: {row, col}, top, left, bottom, right }.
  let rectangles = [];
  // undoStack: array of prior `rectangles` arrays (deep-ish copies).
  const undoStack = [];

  if (restoreBlob && Array.isArray(restoreBlob.rectangles)) {
    rectangles = restoreBlob.rectangles.map((r) => ({ ...r, anchor: { ...r.anchor } }));
  }

  function snapshot() {
    return rectangles.map((r) => ({ ...r, anchor: { ...r.anchor } }));
  }

  function pushHistory() {
    undoStack.push(snapshot());
  }

  function placeRect(anchor, rect) {
    if (!isClue(puzzle, anchor.row, anchor.col)) {
      throw new Error(`No clue at (${anchor.row}, ${anchor.col})`);
    }
    pushHistory();
    rectangles = rectangles.filter(
      (r) => !(r.anchor.row === anchor.row && r.anchor.col === anchor.col),
    );
    rectangles.push({
      anchor: { ...anchor },
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
    });
  }

  function removeRect(anchor) {
    pushHistory();
    rectangles = rectangles.filter(
      (r) => !(r.anchor.row === anchor.row && r.anchor.col === anchor.col),
    );
  }

  function undo() {
    if (undoStack.length === 0) return;
    rectangles = undoStack.pop();
  }

  function restart() {
    pushHistory();
    rectangles = [];
  }

  function currentErrors() {
    const errors = [];
    for (const r of rectangles) {
      const clue = clueAt(puzzle, r.anchor.row, r.anchor.col);
      if (!clue) continue;
      if (rectArea(r) !== clue.number) {
        errors.push({ rect: r, reason: 'wrong-area' });
      }
    }
    for (let i = 0; i < rectangles.length; i++) {
      for (let j = i + 1; j < rectangles.length; j++) {
        if (rectsOverlap(rectangles[i], rectangles[j])) {
          errors.push({ rect: rectangles[i], reason: 'overlap' });
          errors.push({ rect: rectangles[j], reason: 'overlap' });
        }
      }
    }
    return errors;
  }

  function isComplete() {
    if (rectangles.length !== puzzle.clues.length) return false;
    if (currentErrors().length > 0) return false;
    // All cells covered?
    const covered = Array.from({ length: puzzle.height }, () => new Array(puzzle.width).fill(false));
    for (const r of rectangles) {
      for (let row = r.top; row <= r.bottom; row++)
        for (let col = r.left; col <= r.right; col++)
          covered[row][col] = true;
    }
    for (let row = 0; row < puzzle.height; row++)
      for (let col = 0; col < puzzle.width; col++)
        if (!covered[row][col]) return false;
    return true;
  }

  function serialize() {
    return { rectangles: snapshot() };
  }

  return {
    rectangles: () => snapshot(),
    placeRect,
    removeRect,
    undo,
    restart,
    isComplete,
    currentErrors,
    serialize,
  };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test`
Expected: PASS — all state tests pass plus prior 14 = ~25 tests passing.

- [ ] **Step 5: Commit**

```bash
cd ~/projects/shikaku
git add js/state.js tests/state.test.js
git commit -m "feat(state): pure model with placeRect/undo/restart/isComplete/errors"
```

---

## Task 7: HTML shell and CSS

Static markup and styling. No JS behavior yet — that comes in Task 8 and 9. Verify visually.

**Files:**
- Create: `index.html`, `app.css`

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="theme-color" content="#FAF7F0" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#1A1A1A" media="(prefers-color-scheme: dark)" />
  <link rel="manifest" href="manifest.webmanifest" />
  <link rel="apple-touch-icon" href="icons/icon-192.png" />
  <link rel="stylesheet" href="app.css" />
  <title>Shikaku</title>
</head>
<body>
  <header class="topbar">
    <button id="btn-new" type="button" aria-label="New puzzle">New</button>
    <button id="btn-undo" type="button" aria-label="Undo">Undo</button>
    <button id="btn-restart" type="button" aria-label="Restart">Restart</button>
    <button id="btn-check" type="button" aria-label="Check">Check</button>
    <select id="difficulty" aria-label="Difficulty">
      <option value="easy">Easy (7×7)</option>
      <option value="medium" selected>Medium (10×10)</option>
      <option value="hard">Hard (15×15)</option>
    </select>
  </header>
  <main class="board-wrap">
    <canvas id="board" aria-label="Shikaku board"></canvas>
  </main>
  <dialog id="solved-modal">
    <p>Solved! 🎉</p>
    <button id="btn-next" type="button">New puzzle</button>
  </dialog>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `app.css`**

```css
:root {
  --bg: #FAF7F0;
  --fg: #2A2A2A;
  --grid: #2A2A2A;
  --topbar-bg: #F1ECE0;
  --error: #C04A3F;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1A1A1A;
    --fg: #E8E5DE;
    --grid: #E8E5DE;
    --topbar-bg: #232323;
    --error: #E27970;
  }
}

* { box-sizing: border-box; }
html, body {
  margin: 0;
  height: 100%;
  background: var(--bg);
  color: var(--fg);
  font: 16px/1.3 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  overscroll-behavior: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

body {
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

.topbar {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  background: var(--topbar-bg);
  align-items: center;
  flex-wrap: wrap;
}
.topbar button, .topbar select {
  font: inherit;
  color: var(--fg);
  background: transparent;
  border: 1px solid var(--fg);
  border-radius: 6px;
  padding: 6px 10px;
}
.topbar button:active { opacity: 0.6; }

.board-wrap {
  flex: 1 1 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px;
  min-height: 0;
}
#board {
  display: block;
  touch-action: none;     /* prevent scroll during drag */
  max-width: 100%;
  max-height: 100%;
}

dialog {
  border: 1px solid var(--fg);
  border-radius: 12px;
  background: var(--bg);
  color: var(--fg);
  padding: 18px 22px;
  text-align: center;
}
dialog button {
  margin-top: 12px;
  font: inherit;
  padding: 8px 16px;
  border: 1px solid var(--fg);
  border-radius: 6px;
  background: transparent;
  color: var(--fg);
}
```

- [ ] **Step 3: Verify the page loads**

Run: `cd ~/projects/shikaku && python3 -m http.server 8000 &`
Then open `http://localhost:8000` in a desktop browser.

Expected: top bar with New/Undo/Restart/Check buttons + difficulty dropdown, empty grey canvas area below, dark mode flips with OS setting. Browser console will show a 404 for `js/app.js` and missing manifest icons — that's fine for now.

Kill the server: `kill %1`

- [ ] **Step 4: Commit**

```bash
cd ~/projects/shikaku
git add index.html app.css
git commit -m "feat(ui): static HTML shell and base CSS with dark mode"
```

---

## Task 8: UI module — canvas rendering and drag

The interactive layer. Renders the puzzle to canvas, handles pointer events for the anchor-and-drag mechanic, redraws on every state change. Manually verified in browser.

**Files:**
- Create: `js/ui.js`

- [ ] **Step 1: Create `js/ui.js`**

```javascript
const PALETTE = ['#F4D6CC', '#D9E4D0', '#CFDDE8', '#EEDCB5', '#E1D2E8', '#D5E8E0', '#E8D5C7', '#CFD4E8'];

export function createUI({ canvas, getState, getPuzzle, onCommit, onDelete }) {
  const ctx = canvas.getContext('2d');
  let cellSize = 0;
  let originX = 0;
  let originY = 0;
  let drag = null; // { anchor: {row, col}, current: {row, col} }

  function fit() {
    const puzzle = getPuzzle();
    if (!puzzle) return;
    const dpr = window.devicePixelRatio || 1;
    const wrap = canvas.parentElement.getBoundingClientRect();
    const maxW = wrap.width;
    const maxH = wrap.height;
    cellSize = Math.floor(Math.min(maxW / puzzle.width, maxH / puzzle.height));
    const cssW = cellSize * puzzle.width;
    const cssH = cellSize * puzzle.height;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    originX = 0;
    originY = 0;
    draw();
  }

  function cellAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - originX;
    const y = clientY - rect.top - originY;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    const puzzle = getPuzzle();
    if (!puzzle) return null;
    if (row < 0 || row >= puzzle.height || col < 0 || col >= puzzle.width) return null;
    return { row, col };
  }

  function rectFromAnchorTo(anchor, current) {
    return {
      top: Math.min(anchor.row, current.row),
      bottom: Math.max(anchor.row, current.row),
      left: Math.min(anchor.col, current.col),
      right: Math.max(anchor.col, current.col),
    };
  }

  function rectArea(r) {
    return (r.bottom - r.top + 1) * (r.right - r.left + 1);
  }

  function rectsOverlap(a, b) {
    return !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
  }

  function colorForRect(rect, allRects) {
    // Greedy: pick the first palette color not used by an adjacent rectangle.
    const used = new Set();
    for (const other of allRects) {
      if (other === rect) continue;
      // adjacent = share an edge (not just corner)
      const horizAdj = (rect.right + 1 === other.left || other.right + 1 === rect.left)
                   && !(rect.bottom < other.top || other.bottom < rect.top);
      const vertAdj = (rect.bottom + 1 === other.top || other.bottom + 1 === rect.top)
                   && !(rect.right < other.left || other.right < rect.left);
      if (horizAdj || vertAdj) used.add(other.__color);
    }
    for (const color of PALETTE) {
      if (!used.has(color)) return color;
    }
    return PALETTE[0];
  }

  function draw() {
    const puzzle = getPuzzle();
    if (!puzzle) return;
    const state = getState();
    const errors = state.currentErrors();
    const errorRects = new Set(errors.map((e) => e.rect));

    const cssW = cellSize * puzzle.width;
    const cssH = cellSize * puzzle.height;
    const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim();
    const fg = getComputedStyle(document.body).getPropertyValue('--grid').trim();
    const errColor = getComputedStyle(document.body).getPropertyValue('--error').trim();

    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssW, cssH);

    // Assign colors to committed rectangles.
    const rects = state.rectangles();
    for (const r of rects) r.__color = null;
    for (const r of rects) r.__color = colorForRect(r, rects);

    // Fill committed rectangles.
    for (const r of rects) {
      ctx.fillStyle = errorRects.has(r) ? errColor : r.__color;
      ctx.fillRect(r.left * cellSize, r.top * cellSize, (r.right - r.left + 1) * cellSize, (r.bottom - r.top + 1) * cellSize);
    }

    // Drag preview.
    if (drag) {
      const prev = rectFromAnchorTo(drag.anchor, drag.current);
      const anchorClue = puzzle.clues.find((c) => c.row === drag.anchor.row && c.col === drag.anchor.col);
      const otherRects = rects.filter((r) => !(r.anchor.row === drag.anchor.row && r.anchor.col === drag.anchor.col));
      const overlaps = otherRects.some((o) => rectsOverlap(o, prev));
      const wrongArea = rectArea(prev) !== anchorClue.number;
      ctx.fillStyle = (overlaps || wrongArea) ? errColor : (anchorClue.__previewColor || '#D9D9D9');
      ctx.globalAlpha = 0.45;
      ctx.fillRect(prev.left * cellSize, prev.top * cellSize, (prev.right - prev.left + 1) * cellSize, (prev.bottom - prev.top + 1) * cellSize);
      ctx.globalAlpha = 1;
    }

    // Grid lines.
    ctx.strokeStyle = fg;
    ctx.lineWidth = 1;
    for (let i = 0; i <= puzzle.width; i++) {
      ctx.beginPath(); ctx.moveTo(i * cellSize + 0.5, 0); ctx.lineTo(i * cellSize + 0.5, cssH); ctx.stroke();
    }
    for (let i = 0; i <= puzzle.height; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * cellSize + 0.5); ctx.lineTo(cssW, i * cellSize + 0.5); ctx.stroke();
    }

    // Numbers.
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.floor(cellSize * 0.55)}px -apple-system, system-ui, sans-serif`;
    for (const clue of puzzle.clues) {
      ctx.fillText(String(clue.number), clue.col * cellSize + cellSize / 2, clue.row * cellSize + cellSize / 2);
    }
  }

  function onPointerDown(ev) {
    const cell = cellAt(ev.clientX, ev.clientY);
    if (!cell) return;
    const puzzle = getPuzzle();
    const clue = puzzle.clues.find((c) => c.row === cell.row && c.col === cell.col);
    if (!clue) return;
    canvas.setPointerCapture(ev.pointerId);
    drag = { anchor: cell, current: cell };
    draw();
    ev.preventDefault();
  }

  function onPointerMove(ev) {
    if (!drag) return;
    const cell = cellAt(ev.clientX, ev.clientY);
    if (!cell) return;
    if (cell.row === drag.current.row && cell.col === drag.current.col) return;
    drag.current = cell;
    draw();
  }

  function onPointerUp(ev) {
    if (!drag) return;
    const anchor = drag.anchor;
    const rect = rectFromAnchorTo(anchor, drag.current);
    const isJustAnchor =
      rect.top === anchor.row && rect.bottom === anchor.row &&
      rect.left === anchor.col && rect.right === anchor.col;
    drag = null;
    const puzzle = getPuzzle();
    const clue = puzzle.clues.find((c) => c.row === anchor.row && c.col === anchor.col);

    // Delete: release on a 1x1 at the anchor when there's an existing rectangle
    // and the clue number is not 1 (a 1-clue's only valid commit IS a 1x1).
    if (isJustAnchor && clue.number !== 1) {
      const existing = getState().rectangles().find(
        (r) => r.anchor.row === anchor.row && r.anchor.col === anchor.col,
      );
      if (existing && onDelete) {
        onDelete(anchor);
        return;
      }
    }

    if (rectArea(rect) === clue.number) {
      // Check overlap against other committed rectangles.
      const state = getState();
      const others = state.rectangles().filter((r) => !(r.anchor.row === anchor.row && r.anchor.col === anchor.col));
      if (others.every((o) => !rectsOverlap(o, rect))) {
        onCommit(anchor, rect);
        return;
      }
    }
    draw();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', () => { drag = null; draw(); });
  window.addEventListener('resize', fit);

  return { fit, draw };
}
```

- [ ] **Step 2: Stub `js/app.js` so the page can boot for manual testing**

Create `js/app.js`:

```javascript
import { generatePuzzle } from './generator.js';
import { createState } from './state.js';
import { createUI } from './ui.js';

const canvas = document.getElementById('board');
const puzzle = generatePuzzle(10, 10, 1);
const state = createState(puzzle);
const ui = createUI({
  canvas,
  getState: () => state,
  getPuzzle: () => puzzle,
  onCommit: (anchor, rect) => {
    state.placeRect(anchor, rect);
    ui.draw();
  },
  onDelete: (anchor) => {
    state.removeRect(anchor);
    ui.draw();
  },
});
ui.fit();
```

- [ ] **Step 3: Manual test in browser**

Run: `cd ~/projects/shikaku && python3 -m http.server 8000 &`
Open `http://localhost:8000` in a desktop browser.

Expected:
- A 10×10 grid renders with numbered clues.
- Clicking on a number and dragging draws a translucent preview rectangle that grows under the pointer.
- Releasing on a cell whose resulting rectangle has the correct area commits a coloured rectangle.
- Releasing on a wrong size shows red preview during drag and does not commit.

Kill the server: `kill %1`

- [ ] **Step 4: Commit**

```bash
cd ~/projects/shikaku
git add js/ui.js js/app.js
git commit -m "feat(ui): canvas renderer with anchor-and-drag interaction"
```

---

## Task 9: App module — full wiring

Difficulty picker, top-bar buttons, persistence, solved-modal flow. Replaces the Task 8 stub.

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Replace `js/app.js` with the full app**

```javascript
import { generatePuzzle } from './generator.js';
import { createState } from './state.js';
import { createUI } from './ui.js';

const STORAGE_KEY = 'shikaku.v1.state';
const SIZES = { easy: [7, 7], medium: [10, 10], hard: [15, 15] };

const canvas = document.getElementById('board');
const btnNew = document.getElementById('btn-new');
const btnUndo = document.getElementById('btn-undo');
const btnRestart = document.getElementById('btn-restart');
const btnCheck = document.getElementById('btn-check');
const difficultySel = document.getElementById('difficulty');
const solvedModal = document.getElementById('solved-modal');
const btnNext = document.getElementById('btn-next');

let puzzle = null;
let state = null;
let ui = null;
let difficulty = 'medium';

function save() {
  const blob = {
    schema: 'v1',
    difficulty,
    puzzle,
    rectangles: state.rectangles(),
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(blob)); }
  catch (e) { /* ignore quota errors */ }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const blob = JSON.parse(raw);
    if (blob.schema !== 'v1') return null;
    return blob;
  } catch { return null; }
}

function clearSave() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

function startNewPuzzle(diff = difficulty) {
  difficulty = diff;
  difficultySel.value = diff;
  const [w, h] = SIZES[diff];
  puzzle = generatePuzzle(w, h, (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  state = createState(puzzle);
  ui = createUI({
    canvas,
    getState: () => state,
    getPuzzle: () => puzzle,
    onCommit: handleCommit,
    onDelete: handleDelete,
  });
  ui.fit();
  save();
}

function restoreOrNew() {
  const blob = load();
  if (blob && blob.puzzle) {
    difficulty = blob.difficulty || 'medium';
    difficultySel.value = difficulty;
    puzzle = blob.puzzle;
    state = createState(puzzle, { rectangles: blob.rectangles || [] });
    ui = createUI({
      canvas,
      getState: () => state,
      getPuzzle: () => puzzle,
      onCommit: handleCommit,
      onDelete: handleDelete,
    });
    ui.fit();
  } else {
    startNewPuzzle('medium');
  }
}

function handleCommit(anchor, rect) {
  state.placeRect(anchor, rect);
  ui.draw();
  save();
  if (state.isComplete()) {
    clearSave();
    solvedModal.showModal();
  }
}

function handleDelete(anchor) {
  state.removeRect(anchor);
  ui.draw();
  save();
}

btnNew.addEventListener('click', () => {
  if (state.rectangles().length > 0 && !state.isComplete()) {
    if (!confirm('Discard current puzzle?')) return;
  }
  startNewPuzzle(difficulty);
});

btnUndo.addEventListener('click', () => { state.undo(); ui.draw(); save(); });
btnRestart.addEventListener('click', () => { state.restart(); ui.draw(); save(); });
btnCheck.addEventListener('click', () => {
  ui.draw();
  if (state.isComplete()) {
    clearSave();
    solvedModal.showModal();
  } else {
    const n = state.currentErrors().length;
    alert(n === 0 ? 'No errors yet — keep going.' : `${n} rectangle(s) flagged.`);
  }
});
difficultySel.addEventListener('change', (ev) => {
  if (state.rectangles().length > 0 && !state.isComplete()) {
    if (!confirm('Change difficulty and discard current puzzle?')) {
      difficultySel.value = difficulty;
      return;
    }
  }
  startNewPuzzle(ev.target.value);
});
btnNext.addEventListener('click', () => { solvedModal.close(); startNewPuzzle(difficulty); });

restoreOrNew();

// Service worker registration deferred to Task 10.
```

- [ ] **Step 2: Manual test all features in browser**

Run: `cd ~/projects/shikaku && python3 -m http.server 8000 &`
Open `http://localhost:8000`.

Verify:
- New puzzle button generates a fresh 10×10.
- Place a few rectangles; reload the page; same rectangles return.
- Undo reverses the last commit.
- Restart clears all rectangles.
- Check button alerts errors when present.
- Switching difficulty regenerates at the new size.
- Solving a puzzle (test by generating a small 7×7 and playing through) shows the solved modal; clicking "New puzzle" loads a fresh one and the save is cleared.

Kill the server: `kill %1`

- [ ] **Step 3: Commit**

```bash
cd ~/projects/shikaku
git add js/app.js
git commit -m "feat(app): wire up buttons, persistence, solved-modal flow"
```

---

## Task 10: PWA — manifest, service worker, icons

Make the app installable to the iPhone home screen and able to run offline.

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon.svg`, `icons/icon-192.png`, `icons/icon-512.png`
- Modify: `js/app.js` (register service worker)

- [ ] **Step 1: Create `manifest.webmanifest`**

```json
{
  "name": "Shikaku",
  "short_name": "Shikaku",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "background_color": "#FAF7F0",
  "theme_color": "#FAF7F0",
  "orientation": "portrait",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Create `icons/icon.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#FAF7F0"/>
  <g fill="none" stroke="#2A2A2A" stroke-width="6">
    <rect x="56" y="56" width="180" height="180"/>
    <rect x="236" y="56" width="220" height="120"/>
    <rect x="236" y="176" width="100" height="280"/>
    <rect x="336" y="176" width="120" height="160"/>
    <rect x="56" y="236" width="180" height="100"/>
    <rect x="56" y="336" width="100" height="120"/>
    <rect x="156" y="336" width="180" height="120"/>
    <rect x="336" y="336" width="120" height="120"/>
  </g>
  <g fill="#2A2A2A" font-family="-apple-system, system-ui, sans-serif" font-weight="bold" text-anchor="middle">
    <text x="146" y="160" font-size="80">9</text>
    <text x="346" y="130" font-size="60">8</text>
    <text x="286" y="320" font-size="60">7</text>
    <text x="396" y="270" font-size="60">6</text>
    <text x="146" y="300" font-size="60">5</text>
    <text x="106" y="410" font-size="60">3</text>
    <text x="246" y="410" font-size="60">6</text>
    <text x="396" y="410" font-size="60">4</text>
  </g>
</svg>
```

- [ ] **Step 3: Render PNG icons from the SVG**

If ImageMagick is not installed: `brew install imagemagick`

Run:

```bash
cd ~/projects/shikaku
magick -background "#FAF7F0" -density 384 icons/icon.svg -resize 192x192 icons/icon-192.png
magick -background "#FAF7F0" -density 384 icons/icon.svg -resize 512x512 icons/icon-512.png
```

Expected: `icons/icon-192.png` (~5–20 KB) and `icons/icon-512.png` (~20–60 KB) exist.

Verify visually by opening each in Preview or a browser.

- [ ] **Step 4: Create `sw.js`**

```javascript
const CACHE = 'shikaku-v1';
const SHELL = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/generator.js',
  './js/solver.js',
  './js/state.js',
  './js/ui.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      // Update cache for shell resources only.
      const url = new URL(req.url);
      if (SHELL.some((s) => url.pathname.endsWith(s.replace(/^\.\//, '/')))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => cached)),
  );
});
```

- [ ] **Step 5: Register the service worker in `js/app.js`**

Append to the end of `js/app.js`:

```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('SW registration failed', err);
    });
  });
}
```

- [ ] **Step 6: Verify PWA installs locally**

Run: `cd ~/projects/shikaku && python3 -m http.server 8000 &`
Open Chrome → DevTools → Application → Manifest. Confirm: name, icons load, no manifest errors. Application → Service Workers shows `sw.js` activated.

Hard-reload, then turn off Wi-Fi (or DevTools → Network → Offline) and reload — the app must still render.

Kill the server: `kill %1`

- [ ] **Step 7: Commit**

```bash
cd ~/projects/shikaku
git add manifest.webmanifest sw.js icons/ js/app.js
git commit -m "feat(pwa): manifest, service worker, icons; offline-capable"
```

---

## Task 11: Deploy to GitHub Pages and install on iPhone

Final step: ship to GitHub Pages and verify the install flow on a real iPhone. This task contains human-in-the-loop steps the orchestrator (Eddie) must perform on his Mac and phone.

**Files:** None changed.

- [ ] **Step 1: Confirm `gh` CLI is installed and authenticated**

Run: `gh auth status`
Expected: logged in as the GitHub user that will own the repo.

If not installed: `brew install gh && gh auth login`.

- [ ] **Step 2: Create the GitHub repo and push**

Run:

```bash
cd ~/projects/shikaku
gh repo create shikaku --public --source=. --remote=origin --push
```

Expected: repo created at `github.com/<username>/shikaku`, `main` branch pushed.

- [ ] **Step 3: Enable GitHub Pages from `main` branch root**

Run:

```bash
gh api -X POST "repos/{owner}/{repo}/pages" \
  -f source.branch=main -f source.path=/
```

(If the API call fails because Pages is already configured or requires a slightly different shape on your version of `gh`, use the web UI: repo → Settings → Pages → Source = Deploy from a branch, Branch = `main`, Folder = `/ (root)`, Save.)

Wait ~1 minute for the first deploy. Then:

```bash
gh api "repos/{owner}/{repo}/pages" --jq '.html_url'
```

Expected output: the live URL, e.g. `https://<username>.github.io/shikaku/`.

- [ ] **Step 4: Verify the live URL in a desktop browser**

Visit the URL. Expected: app loads, you can play, manifest valid, service worker registers.

- [ ] **Step 5: Install on iPhone**

On the iPhone, open the URL in Safari (not Chrome — Add to Home Screen behaves best from Safari on iOS). Tap the Share button → "Add to Home Screen" → "Add".

Expected: an icon appears on the home screen. Tapping it launches the app fullscreen with no browser chrome.

- [ ] **Step 6: Verify acceptance criteria from the spec on the device**

Run through each criterion from the spec's §14 against the installed PWA:
- Pick each of the three difficulties; each generates a fresh puzzle.
- Drag from numbers to place rectangles; live red-tint feedback during drag.
- Undo, restart, check, get a new puzzle.
- Force-quit the app mid-puzzle and reopen — the in-progress puzzle resumes.
- Solve a puzzle — solved modal appears, "New puzzle" generates a fresh one.
- Enable airplane mode and reopen the app — it still loads.

If any criterion fails, file a follow-up note describing exactly what failed and on which step. Do not silently work around.

- [ ] **Step 7: Final commit if any device-specific tweaks were made**

If you tweaked anything to make criteria pass (e.g. font sizes, safe-area padding, hit-target sizes for fat fingers), commit the changes with a clear message and push.

```bash
cd ~/projects/shikaku
git add -A
git commit -m "fix: device-specific tweaks from acceptance pass" || true
git push
```

---

## Plan complete

After Task 11 passes, the app is live, installed on the user's phone, and meets every acceptance criterion in the spec.

**Deferred follow-ups (not part of this plan):**
- Move generator to a Web Worker if 15×15 generation feels slow in practice.
- Add a manual dark-mode toggle if OS-following proves annoying.
- Custom domain.
