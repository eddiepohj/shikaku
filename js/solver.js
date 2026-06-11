// Count valid Shikaku solutions for the given puzzle, capped at `cap`.
//
// A solution assigns one axis-aligned rectangle to each clue such that:
//   - the rectangle contains its clue cell
//   - the rectangle's area equals the clue number
//   - rectangles do not overlap
//   - every cell of the grid is covered
//
// This reduces to EXACT COVER. The universe (columns) has two parts:
//   1. One column per clue  — must be covered exactly once (the clue gets
//      exactly one rectangle).
//   2. One column per grid cell — must be covered exactly once (the cell
//      belongs to exactly one rectangle).
// Each candidate rectangle for a clue becomes a row that covers the clue's
// column plus one column per cell inside the rectangle.
//
// The solver is Knuth's Algorithm X with the Dancing Links data structure
// (DLX), branching on the column with the smallest size (S-heuristic).

// Enumerate every axis-aligned rectangle that
//   - contains (clue.row, clue.col),
//   - has area exactly clue.number,
//   - fits inside the width x height grid.
function rectanglesForClue(clue, width, height) {
  const { row, col, number } = clue;
  const rects = [];
  for (let h = 1; h <= number; h++) {
    if (number % h !== 0) continue;
    const w = number / h;
    if (w > width || h > height) continue;
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

// Build the exact-cover matrix as a list of rows. Each row is an array of
// column indices (the columns that contain a 1 in that row).
//
// Column layout:
//   [0 .. numClues-1]                   — one per clue
//   [numClues .. numClues+W*H-1]        — one per cell, indexed as
//                                          numClues + r*width + c
function buildMatrix(puzzle) {
  const { width, height, clues } = puzzle;
  const numClues = clues.length;
  const numCells = width * height;
  const numCols = numClues + numCells;

  const rows = [];
  for (let i = 0; i < numClues; i++) {
    const rects = rectanglesForClue(clues[i], width, height);
    for (const rect of rects) {
      const cols = [i]; // clue column
      for (let r = rect.top; r <= rect.bottom; r++) {
        for (let c = rect.left; c <= rect.right; c++) {
          cols.push(numClues + r * width + c);
        }
      }
      rows.push(cols);
    }
  }
  return { rows, numCols };
}

// Construct the DLX linked-list structure from a matrix description.
//
// Nodes are plain object literals (allocating classes adds measurable
// overhead in the hot loop). Each node has:
//   - L, R: left/right siblings in the same row (circular)
//   - U, D: up/down siblings in the same column (circular)
//   - C   : column header for the column the node lives in
//   - S   : (column headers only) current node count in that column
// A single sentinel `root` is the head of the column-header list.
function buildDLX(rows, numCols) {
  const root = { L: null, R: null, U: null, D: null, C: null, S: 0 };
  root.L = root;
  root.R = root;

  // Column headers, all linked into the horizontal list off root.
  const headers = new Array(numCols);
  for (let i = 0; i < numCols; i++) {
    const h = { L: root.L, R: root, U: null, D: null, C: null, S: 0 };
    h.C = h;
    h.U = h;
    h.D = h;
    root.L.R = h;
    root.L = h;
    headers[i] = h;
  }

  // For each row, build a horizontal circular list of data nodes, splicing
  // each node into the bottom of its column.
  for (const cols of rows) {
    let first = null;
    for (const colIdx of cols) {
      const col = headers[colIdx];
      const node = { L: null, R: null, U: col.U, D: col, C: col, S: 0 };
      col.U.D = node;
      col.U = node;
      col.S++;
      if (first === null) {
        node.L = node;
        node.R = node;
        first = node;
      } else {
        node.L = first.L;
        node.R = first;
        first.L.R = node;
        first.L = node;
      }
    }
  }

  return { root, headers };
}

// Cover a column: detach its header from the horizontal list, then for every
// row that has a 1 in this column, detach that row from each of its other
// columns. This is the core "dancing links" trick — pointers are not erased,
// they remain inside the removed nodes so we can splice them back later.
function coverColumn(c) {
  c.R.L = c.L;
  c.L.R = c.R;
  for (let r = c.D; r !== c; r = r.D) {
    for (let j = r.R; j !== r; j = j.R) {
      j.D.U = j.U;
      j.U.D = j.D;
      j.C.S--;
    }
  }
}

// Uncover is the exact reverse: re-splice rows back into their columns, then
// re-splice the column header into the horizontal list. Order matters —
// must mirror coverColumn in reverse direction.
function uncoverColumn(c) {
  for (let r = c.U; r !== c; r = r.U) {
    for (let j = r.L; j !== r; j = j.L) {
      j.C.S++;
      j.D.U = j;
      j.U.D = j;
    }
  }
  c.R.L = c;
  c.L.R = c;
}

export function countSolutions(puzzle, cap = 2) {
  const { width, height, clues } = puzzle;

  // Quick sanity: clue areas must sum to grid area, else 0 solutions.
  let sum = 0;
  for (const c of clues) sum += c.number;
  if (sum !== width * height) return 0;

  const { rows, numCols } = buildMatrix(puzzle);
  if (rows.length === 0) return 0;

  const { root } = buildDLX(rows, numCols);

  let count = 0;

  function search() {
    if (root.R === root) {
      count++;
      return;
    }

    // S-heuristic: choose the column with the smallest size. This fails fast
    // when a column has zero rows (dead branch) and minimises the branching
    // factor at every level.
    let c = root.R;
    let best = c.S;
    for (let n = c.R; n !== root; n = n.R) {
      if (n.S < best) {
        best = n.S;
        c = n;
        if (best <= 1) break;
      }
    }

    coverColumn(c);
    for (let r = c.D; r !== c; r = r.D) {
      for (let j = r.R; j !== r; j = j.R) coverColumn(j.C);
      search();
      for (let j = r.L; j !== r; j = j.L) uncoverColumn(j.C);
      if (count >= cap) {
        uncoverColumn(c);
        return;
      }
    }
    uncoverColumn(c);
  }

  search();
  return count;
}
