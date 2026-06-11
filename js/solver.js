// Count valid Shikaku solutions for the given puzzle, capped at `cap`.
// A solution is an assignment of one axis-aligned rectangle to each clue such that:
//   - the rectangle contains its clue cell
//   - the rectangle's area equals the clue number
//   - rectangles do not overlap
//   - every cell is covered
export function countSolutions(puzzle, cap = 2) {
  const { width, height, clues } = puzzle;
  const grid = Array.from({ length: height }, () => new Array(width).fill(-1));
  let count = 0;

  function rectanglesForClue(clue) {
    const { row, col, number } = clue;
    const rects = [];
    for (let h = 1; h <= number; h++) {
      if (number % h !== 0) continue;
      const w = number / h;
      // Rectangle of size h x w, must contain (row, col).
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

  function fits(rect) {
    for (let r = rect.top; r <= rect.bottom; r++)
      for (let c = rect.left; c <= rect.right; c++)
        if (grid[r][c] !== -1) return false;
    return true;
  }

  function paint(rect, value) {
    for (let r = rect.top; r <= rect.bottom; r++)
      for (let c = rect.left; c <= rect.right; c++)
        grid[r][c] = value;
  }

  function allCovered() {
    for (let r = 0; r < height; r++)
      for (let c = 0; c < width; c++)
        if (grid[r][c] === -1) return false;
    return true;
  }

  // Precompute rectangles per clue and sort clues by ascending count
  // (most-constrained-variable heuristic).
  const indexed = clues.map((clue, originalIdx) => ({
    originalIdx,
    rects: rectanglesForClue(clue),
  }));
  indexed.sort((a, b) => a.rects.length - b.rects.length);

  function backtrack(idx) {
    if (count >= cap) return;
    if (idx === indexed.length) {
      if (allCovered()) count++;
      return;
    }
    for (const rect of indexed[idx].rects) {
      if (!fits(rect)) continue;
      paint(rect, indexed[idx].originalIdx);
      backtrack(idx + 1);
      paint(rect, -1);
      if (count >= cap) return;
    }
  }

  backtrack(0);
  return count;
}
