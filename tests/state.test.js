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
