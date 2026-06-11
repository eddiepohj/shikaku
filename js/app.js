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
