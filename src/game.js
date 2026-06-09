// Modelo de la partida y operaciones puras sobre el estado. Nada de DOM aquí.
import {
  generate, solve, decodeGivens, encodeGivens, conflicts, isComplete, peers,
} from './sudoku.js';

function buildState({ puzzle, solution, difficulty, seed, source, daily }) {
  return {
    difficulty,
    seed: seed || 0,
    source: source || 'normal',     // 'normal' | 'daily' | 'shared'
    daily: daily || null,           // YYYYMMDD si es reto diario
    given: puzzle.map(v => (v ? 1 : 0)),
    hinted: new Array(81).fill(0),  // 1 = celda revelada por pista (bloqueada)
    cells: puzzle.slice(),          // valores actuales (0 = vacío)
    solution: solution.slice(),
    notes: new Array(81).fill(0),   // bitmask de marcas a lápiz (bit v = 1<<v)
    selected: -1,
    notesMode: false,
    mistakes: 0,
    hintsUsed: 0,                   // pistas usadas en ESTA partida (para las estrellas)
    elapsedMs: 0,
    completed: false,
    history: [],
    givensStr: encodeGivens(puzzle),
  };
}

export function newGame(difficulty, seed, opts = {}) {
  const g = generate(difficulty, seed);
  return buildState({
    puzzle: g.puzzle, solution: g.solution, difficulty, seed: g.seed,
    source: opts.source || 'normal', daily: opts.daily || null,
  });
}

// Reconstruye una partida desde una cadena de givens (puzzle compartido).
export function gameFromGivens(givens, opts = {}) {
  const board = decodeGivens(givens);
  if (!board) return null;
  if (conflicts(board).size) return null;     // givens inconsistentes
  const solution = solve(board);
  if (!solution) return null;                 // sin solución
  return buildState({
    puzzle: board, solution, difficulty: opts.difficulty || 'custom',
    seed: 0, source: 'shared',
  });
}

const locked = (s, i) => s.given[i] === 1 || s.hinted[i] === 1;

export function select(s, i) { s.selected = i; }

function pushHistory(s, i) {
  s.history.push({ i, value: s.cells[i], notes: s.notes[i] });
  if (s.history.length > 300) s.history.shift();
}

// Quita el dígito v de las notas de los pares (limpieza automática de lápiz).
function clearPeerNotes(s, i, v) {
  const bit = 1 << v;
  for (const p of peers(i)) if (s.notes[p] & bit) s.notes[p] &= ~bit;
}

// Coloca un dígito (1..9) en la celda seleccionada, o togglea nota si notesMode.
// Devuelve true si la jugada cambió el tablero.
export function inputDigit(s, v) {
  const i = s.selected;
  if (i < 0 || locked(s, i) || s.completed) return false;
  if (s.notesMode) {
    if (s.cells[i]) return false;             // no hay notas sobre un valor
    pushHistory(s, i);
    s.notes[i] ^= (1 << v);
    return true;
  }
  if (s.cells[i] === v) return false;         // mismo valor → no-op
  pushHistory(s, i);
  s.cells[i] = v;
  s.notes[i] = 0;
  if (s.solution[i] && v !== s.solution[i]) s.mistakes++;
  else clearPeerNotes(s, i, v);
  if (isComplete(s.cells)) s.completed = true;
  return true;
}

export function erase(s) {
  const i = s.selected;
  if (i < 0 || locked(s, i) || s.completed) return false;
  if (!s.cells[i] && !s.notes[i]) return false;
  pushHistory(s, i);
  s.cells[i] = 0;
  s.notes[i] = 0;
  return true;
}

export function undo(s) {
  if (s.completed || !s.history.length) return false;
  const last = s.history.pop();
  s.cells[last.i] = last.value;
  s.notes[last.i] = last.notes;
  s.selected = last.i;
  return true;
}

// Revela la celda seleccionada (o la primera vacía) con su valor correcto.
// El presupuesto de pistas es un consumible GLOBAL (se gana compartiendo); el
// llamador comprueba el saldo y lo descuenta. Aquí solo se revela.
export function hint(s) {
  if (s.completed) return false;
  let i = s.selected;
  if (i < 0 || locked(s, i) || s.cells[i] === s.solution[i]) {
    i = -1;
    for (let k = 0; k < 81; k++) {
      if (!s.given[k] && !s.hinted[k] && s.cells[k] !== s.solution[k]) { i = k; break; }
    }
  }
  if (i < 0) return false;
  s.cells[i] = s.solution[i];
  s.notes[i] = 0;
  s.hinted[i] = 1;
  s.selected = i;
  s.hintsUsed++;
  clearPeerNotes(s, i, s.solution[i]);
  if (isComplete(s.cells)) s.completed = true;
  return true;
}

export function toggleNotes(s) { s.notesMode = !s.notesMode; return s.notesMode; }

// Vuelve el tablero a su estado inicial (solo los givens).
export function restart(s) {
  for (let i = 0; i < 81; i++) {
    if (!s.given[i]) { s.cells[i] = 0; s.hinted[i] = 0; }
    s.notes[i] = 0;
  }
  s.mistakes = 0;
  s.hintsUsed = 0;
  s.completed = false;
  s.history = [];
}

// Serializa lo necesario para reanudar (arrays planos; sin métodos).
export function serialize(s) {
  return {
    difficulty: s.difficulty, seed: s.seed, source: s.source, daily: s.daily,
    given: s.given, hinted: s.hinted, cells: s.cells, solution: s.solution,
    notes: s.notes, selected: s.selected, notesMode: s.notesMode,
    mistakes: s.mistakes, hintsUsed: s.hintsUsed,
    elapsedMs: s.elapsedMs, completed: s.completed, givensStr: s.givensStr,
  };
}

export function deserialize(o) {
  if (!o || !Array.isArray(o.cells) || o.cells.length !== 81) return null;
  return {
    difficulty: o.difficulty || 'medium', seed: o.seed || 0,
    source: o.source || 'normal', daily: o.daily || null,
    given: o.given, hinted: o.hinted || new Array(81).fill(0),
    cells: o.cells, solution: o.solution, notes: o.notes || new Array(81).fill(0),
    selected: typeof o.selected === 'number' ? o.selected : -1,
    notesMode: !!o.notesMode, mistakes: o.mistakes || 0,
    hintsUsed: o.hintsUsed || 0,
    elapsedMs: o.elapsedMs || 0, completed: !!o.completed,
    history: [], givensStr: o.givensStr || encodeGivens(o.given.map((g, i) => (g ? o.cells[i] : 0))),
  };
}
