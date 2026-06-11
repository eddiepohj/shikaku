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

test('generator never produces a clue with number 1', () => {
  for (const seed of [1, 7, 42, 123, 999]) {
    const puzzle = generatePuzzle(10, 10, seed);
    for (const clue of puzzle.clues) {
      assert.notEqual(clue.number, 1, `seed ${seed} produced a 1-clue at (${clue.row}, ${clue.col})`);
    }
  }
});
