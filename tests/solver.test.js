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
