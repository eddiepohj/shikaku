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
