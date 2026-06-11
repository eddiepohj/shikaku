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
