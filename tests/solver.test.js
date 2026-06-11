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
