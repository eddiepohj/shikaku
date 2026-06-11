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
