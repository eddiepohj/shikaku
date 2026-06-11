export function createUI({ canvas, getState, getPuzzle, onCommit, onDelete }) {
  const ctx = canvas.getContext('2d');
  let cellSize = 0;
  let originX = 0;
  let originY = 0;
  let drag = null; // { anchor: {row, col}, current: {row, col} }

  function fit() {
    const puzzle = getPuzzle();
    if (!puzzle) return;
    const dpr = window.devicePixelRatio || 1;
    const wrap = canvas.parentElement.getBoundingClientRect();
    const maxW = wrap.width;
    const maxH = wrap.height;
    cellSize = Math.floor(Math.min(maxW / puzzle.width, maxH / puzzle.height));
    const cssW = cellSize * puzzle.width;
    const cssH = cellSize * puzzle.height;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    originX = 0;
    originY = 0;
    draw();
  }

  function cellAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - originX;
    const y = clientY - rect.top - originY;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    const puzzle = getPuzzle();
    if (!puzzle) return null;
    if (row < 0 || row >= puzzle.height || col < 0 || col >= puzzle.width) return null;
    return { row, col };
  }

  function rectFromAnchorTo(anchor, current) {
    return {
      top: Math.min(anchor.row, current.row),
      bottom: Math.max(anchor.row, current.row),
      left: Math.min(anchor.col, current.col),
      right: Math.max(anchor.col, current.col),
    };
  }

  function rectArea(r) {
    return (r.bottom - r.top + 1) * (r.right - r.left + 1);
  }

  function rectsOverlap(a, b) {
    return !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
  }

  function draw() {
    const puzzle = getPuzzle();
    if (!puzzle) return;
    const state = getState();
    const errors = state.currentErrors();
    const errorAnchorKeys = new Set(
      errors.map((e) => `${e.rect.anchor.row},${e.rect.anchor.col}`),
    );

    const cssW = cellSize * puzzle.width;
    const cssH = cellSize * puzzle.height;
    const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim();
    const fg = getComputedStyle(document.body).getPropertyValue('--grid').trim();
    const errColor = getComputedStyle(document.body).getPropertyValue('--error').trim();
    // Derive a soft theme-aware grey overlay from --grid (#RRGGBB + low alpha).
    const overlay = fg + '20';

    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssW, cssH);

    // Fill committed rectangles with neutral grey overlay + dark border (errors red).
    const rects = state.rectangles();
    for (const r of rects) {
      const isError = errorAnchorKeys.has(`${r.anchor.row},${r.anchor.col}`);
      const x = r.left * cellSize;
      const y = r.top * cellSize;
      const w = (r.right - r.left + 1) * cellSize;
      const h = (r.bottom - r.top + 1) * cellSize;
      ctx.fillStyle = isError ? errColor : overlay;
      ctx.fillRect(x, y, w, h);
      if (!isError) {
        ctx.strokeStyle = fg;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      }
    }

    // Drag preview: soft fill + dashed border.
    if (drag) {
      const prev = rectFromAnchorTo(drag.anchor, drag.current);
      const cluesInside = puzzle.clues.filter(
        (c) => c.row >= prev.top && c.row <= prev.bottom && c.col >= prev.left && c.col <= prev.right,
      );
      const otherRects = rects.filter(
        (r) => !(cluesInside.length === 1 && r.anchor.row === cluesInside[0].row && r.anchor.col === cluesInside[0].col),
      );
      const overlaps = otherRects.some((o) => rectsOverlap(o, prev));
      const wrongArea = cluesInside.length !== 1 || rectArea(prev) !== cluesInside[0].number;
      const isError = overlaps || wrongArea;
      const x = prev.left * cellSize;
      const y = prev.top * cellSize;
      const w = (prev.right - prev.left + 1) * cellSize;
      const h = (prev.bottom - prev.top + 1) * cellSize;
      // Soft fill (~6% alpha on the ink overlay base, error tint at 35%).
      ctx.fillStyle = isError ? errColor : fg;
      ctx.globalAlpha = isError ? 0.35 : 0.06;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      // Dashed border, ink (or error) colour.
      ctx.strokeStyle = isError ? errColor : fg;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.setLineDash([]);
    }

    // Grid lines.
    ctx.strokeStyle = fg;
    ctx.lineWidth = 1;
    for (let i = 0; i <= puzzle.width; i++) {
      ctx.beginPath(); ctx.moveTo(i * cellSize + 0.5, 0); ctx.lineTo(i * cellSize + 0.5, cssH); ctx.stroke();
    }
    for (let i = 0; i <= puzzle.height; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * cellSize + 0.5); ctx.lineTo(cssW, i * cellSize + 0.5); ctx.stroke();
    }

    // Numbers.
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${Math.floor(cellSize * 0.55)}px -apple-system, system-ui, sans-serif`;
    for (const clue of puzzle.clues) {
      ctx.fillText(String(clue.number), clue.col * cellSize + cellSize / 2, clue.row * cellSize + cellSize / 2);
    }
  }

  function onPointerDown(ev) {
    const cell = cellAt(ev.clientX, ev.clientY);
    if (!cell) return;
    canvas.setPointerCapture(ev.pointerId);
    drag = { anchor: cell, current: cell };
    draw();
    ev.preventDefault();
  }

  function onPointerMove(ev) {
    if (!drag) return;
    const cell = cellAt(ev.clientX, ev.clientY);
    if (!cell) return;
    if (cell.row === drag.current.row && cell.col === drag.current.col) return;
    drag.current = cell;
    draw();
  }

  function onPointerUp(ev) {
    if (!drag) return;
    const anchor = drag.anchor;
    const current = drag.current;
    const rect = rectFromAnchorTo(anchor, current);
    const isJustAnchor =
      rect.top === rect.bottom && rect.left === rect.right &&
      rect.top === anchor.row && rect.left === anchor.col;
    drag = null;
    const puzzle = getPuzzle();
    const state = getState();

    // Tap-to-delete: zero-distance pointerup on a NUMBERED CELL whose clue has a
    // committed rectangle. Tapping anywhere else (empty cell, or numbered cell
    // with no committed rectangle) does nothing.
    if (isJustAnchor) {
      const clueAtTap = puzzle.clues.find((c) => c.row === anchor.row && c.col === anchor.col);
      if (clueAtTap) {
        const existing = state.rectangles().find(
          (r) => r.anchor.row === clueAtTap.row && r.anchor.col === clueAtTap.col,
        );
        if (existing && onDelete) {
          onDelete({ row: clueAtTap.row, col: clueAtTap.col });
          return;
        }
      }
      draw();
      return;
    }

    // Otherwise: commit if the preview contains exactly one clue, with matching
    // area, and does not overlap any other committed rectangle.
    const cluesInside = puzzle.clues.filter(
      (c) => c.row >= rect.top && c.row <= rect.bottom && c.col >= rect.left && c.col <= rect.right,
    );
    if (cluesInside.length === 1 && rectArea(rect) === cluesInside[0].number) {
      const clueAnchor = { row: cluesInside[0].row, col: cluesInside[0].col };
      const others = state.rectangles().filter(
        (r) => !(r.anchor.row === clueAnchor.row && r.anchor.col === clueAnchor.col),
      );
      if (others.every((o) => !rectsOverlap(o, rect))) {
        onCommit(clueAnchor, rect);
        return;
      }
    }
    draw();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', () => { drag = null; draw(); });
  window.addEventListener('resize', fit);

  return { fit, draw };
}
