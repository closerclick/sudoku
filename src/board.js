// Render del tablero 9×9 y del teclado numérico. Construye el DOM una vez y expone
// update(state) que refresca clases/valores por celda (81 celdas → barato).
import { h } from './dom.js';
import { conflicts, peers, digitCounts } from './sudoku.js';

export function createBoard(handlers) {
  const cellEls = [];
  const grid = h('div', { class: 'board', 'data-testid': 'board' });
  for (let i = 0; i < 81; i++) {
    const cell = h('div', {
      class: 'cell', 'data-i': i, 'data-testid': 'cell-' + i,
      role: 'button', 'aria-label': 'cell-' + i,
      onclick: () => handlers.onSelect(i),
    });
    const notes = h('div', { class: 'notes' });
    const noteEls = [];
    for (let n = 1; n <= 9; n++) { const ne = h('span', { class: 'note' }); noteEls.push(ne); notes.append(ne); }
    const val = h('span', { class: 'val' });
    cell.append(notes, val);
    cellEls.push({ cell, val, notes, noteEls });
    grid.append(cell);
  }

  // --- Arrastrar (drag & drop) números del teclado a las casillas ---
  // Basado en pointer events → funciona con ratón Y con el dedo (táctil).
  let drag = null;        // { v, x0, y0, moved, ghost }
  let justDragged = false; // suprime el click que sigue a un arrastre
  const cellUnder = (x, y) => { const el = document.elementFromPoint(x, y); return el ? el.closest('.cell') : null; };
  const clearDropTarget = () => { const t = grid.querySelector('.cell.drop-target'); if (t) t.classList.remove('drop-target'); };
  function endDrag() {
    if (drag && drag.ghost) drag.ghost.remove();
    clearDropTarget();
    document.body.classList.remove('dragging-num');
    drag = null;
  }

  const padBtns = [];
  const pad = h('div', { class: 'pad', 'data-testid': 'pad' });
  for (let n = 1; n <= 9; n++) {
    const count = h('span', { class: 'pad-count' });
    const btn = h('button', {
      class: 'pad-btn', 'data-n': n, 'data-testid': 'num-' + n, 'aria-label': String(n),
      onclick: () => { if (justDragged) { justDragged = false; return; } handlers.onDigit(n); },
    }, h('span', { class: 'pad-n' }, String(n)), count);

    btn.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      justDragged = false;
      drag = { v: n, x0: e.clientX, y0: e.clientY, moved: false, ghost: null };
      try { btn.setPointerCapture(e.pointerId); } catch {}
    });
    btn.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
        drag.moved = true;
        drag.ghost = h('div', { class: 'num-ghost' }, String(drag.v));
        document.body.appendChild(drag.ghost);
        document.body.classList.add('dragging-num');
      }
      drag.ghost.style.left = e.clientX + 'px';
      drag.ghost.style.top = e.clientY + 'px';
      clearDropTarget();
      const cell = cellUnder(e.clientX, e.clientY);
      if (cell) cell.classList.add('drop-target');
      e.preventDefault();
    });
    btn.addEventListener('pointerup', (e) => {
      if (!drag) return;
      if (drag.moved) {
        const cell = cellUnder(e.clientX, e.clientY);
        if (cell && cell.dataset.i != null) handlers.onDrop(+cell.dataset.i, drag.v);
        justDragged = true;
        e.preventDefault();
      }
      try { btn.releasePointerCapture(e.pointerId); } catch {}
      endDrag();
    });
    btn.addEventListener('pointercancel', endDrag);

    padBtns.push({ btn, count });
    pad.append(btn);
  }

  function update(s) {
    const conf = conflicts(s.cells);
    const sel = s.selected;
    // Resaltar el número "en la mano" (modo número primero); si no hay, el de la
    // casilla seleccionada.
    const activeV = s.activeDigit || (sel >= 0 ? s.cells[sel] : 0);
    const peerSet = sel >= 0 ? peers(sel) : null;

    for (let i = 0; i < 81; i++) {
      const { cell, val, notes, noteEls } = cellEls[i];
      const v = s.cells[i];
      if (v) {
        val.textContent = v;
        val.style.display = '';
        notes.style.display = 'none';
      } else {
        val.textContent = '';
        val.style.display = 'none';
        const hasNotes = !!s.notes[i];
        notes.style.display = hasNotes ? '' : 'none';
        // dígitos ya usados por los pares (fila/col/caja) → nota ILEGAL (roja)
        let used = 0;
        if (hasNotes) for (const p of peers(i)) { const pv = s.cells[p]; if (pv) used |= 1 << pv; }
        // Siempre se sincroniza el texto (también al borrar, para no dejar notas viejas).
        for (let n = 1; n <= 9; n++) {
          const on = s.notes[i] & (1 << n);
          const el = noteEls[n - 1];
          el.textContent = on ? n : '';
          el.classList.toggle('bad', !!on && !!(used & (1 << n)));   // candidato imposible
          el.classList.toggle('hi', !!on && n === activeV);          // resalta el nº en la mano
        }
      }
      const isUser = !s.given[i] && !s.hinted[i] && !!v;
      // "Equivocado vs la solución" solo tiene sentido si la solución es única;
      // si no, solo los conflictos de regla (duplicados) marcan error.
      const isWrong = s.unique && isUser && s.solution[i] && v !== s.solution[i];
      cell.classList.toggle('given', s.given[i] === 1);
      cell.classList.toggle('hinted', s.hinted[i] === 1);
      cell.classList.toggle('user', isUser);
      cell.classList.toggle('wrong', isWrong);
      cell.classList.toggle('selected', i === sel);
      cell.classList.toggle('peer', peerSet ? peerSet.has(i) : false);
      cell.classList.toggle('same', !!v && v === activeV && i !== sel);
      cell.classList.toggle('conflict', conf.has(i));
    }

    const counts = digitCounts(s.cells);
    for (let n = 1; n <= 9; n++) {
      const remaining = 9 - counts[n];
      const { btn, count } = padBtns[n - 1];
      count.textContent = remaining > 0 ? remaining : '';
      btn.classList.toggle('done', remaining <= 0);
      btn.classList.toggle('active', n === s.activeDigit);   // dígito "en la mano"
    }
    pad.classList.toggle('notes-mode', s.notesMode);
  }

  return { grid, pad, update };
}
