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

  const padBtns = [];
  const pad = h('div', { class: 'pad', 'data-testid': 'pad' });
  for (let n = 1; n <= 9; n++) {
    const count = h('span', { class: 'pad-count' });
    const btn = h('button', {
      class: 'pad-btn', 'data-n': n, 'data-testid': 'num-' + n, 'aria-label': String(n),
      onclick: () => handlers.onDigit(n),
    }, h('span', { class: 'pad-n' }, String(n)), count);
    padBtns.push({ btn, count });
    pad.append(btn);
  }

  function update(s) {
    const conf = conflicts(s.cells);
    const sel = s.selected;
    const selVal = sel >= 0 ? s.cells[sel] : 0;
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
        if (hasNotes) for (let n = 1; n <= 9; n++) noteEls[n - 1].textContent = (s.notes[i] & (1 << n)) ? n : '';
      }
      const isUser = !s.given[i] && !s.hinted[i] && !!v;
      const isWrong = isUser && s.solution[i] && v !== s.solution[i];
      cell.classList.toggle('given', s.given[i] === 1);
      cell.classList.toggle('hinted', s.hinted[i] === 1);
      cell.classList.toggle('user', isUser);
      cell.classList.toggle('wrong', isWrong);
      cell.classList.toggle('selected', i === sel);
      cell.classList.toggle('peer', peerSet ? peerSet.has(i) : false);
      cell.classList.toggle('same', !!v && v === selVal && i !== sel);
      cell.classList.toggle('conflict', conf.has(i));
    }

    const counts = digitCounts(s.cells);
    for (let n = 1; n <= 9; n++) {
      const remaining = 9 - counts[n];
      const { btn, count } = padBtns[n - 1];
      count.textContent = remaining > 0 ? remaining : '';
      btn.classList.toggle('done', remaining <= 0);
    }
    pad.classList.toggle('notes-mode', s.notesMode);
  }

  return { grid, pad, update };
}
