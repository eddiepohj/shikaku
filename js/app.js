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
