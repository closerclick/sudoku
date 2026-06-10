// Modelo de la partida y operaciones puras sobre el estado. Nada de DOM aquí.
import {
  generate, solve, countSolutions, decodeGivens, encodeGivens, conflicts, isComplete, peers,
} from './sudoku.js';

function buildState({ puzzle, solution, difficulty, seed, source, daily, unique }) {
  return {
    difficulty,
    seed: seed || 0,
    source: source || 'normal',     // 'normal' | 'daily' | 'shared'
    daily: daily || null,           // YYYYMMDD si es reto diario
    // ¿solución ÚNICA? Solo entonces "no coincide con la solución" es un error real.
    // Los niveles/diario generados siempre son únicos; un enlace #g= hecho a mano
    // podría no serlo, y ahí solo cuentan los errores de REGLA (duplicados).
    unique: unique !== false,
    given: puzzle.map(v => (v ? 1 : 0)),
    hinted: new Array(81).fill(0),  // 1 = celda revelada por pista (bloqueada)
    cells: puzzle.slice(),          // valores actuales (0 = vacío)
    solution: solution.slice(),
    notes: new Array(81).fill(0),   // bitmask de marcas a lápiz (bit v = 1<<v)
    selected: -1,
    activeDigit: 0,                 // dígito "en la mano" (modo número primero)
    prevDigit: 0,                   // número recordado mientras la goma está activa
    eraseMode: false,              // goma activada: tocar una casilla la borra
    notesMode: false,
    mistakes: 0,
    hintsUsed: 0,                   // pistas usadas en ESTA partida (para las estrellas)
    elapsedMs: 0,
    completed: false,
    history: [],
    givensStr: encodeGivens(puzzle),
  };
}

// `spec` puede ser un nombre de banda ('easy'..'expert') o un objeto por nivel
// ({ maxLevel, minLevel, holes }); `opts.label` es la etiqueta de dificultad que
// se muestra (easy/medium/hard/expert) y se usa para las estrellas/HUD.
export function newGame(spec, seed, opts = {}) {
  const g = generate(spec, seed);
  return buildState({
    puzzle: g.puzzle, solution: g.solution,
    difficulty: opts.label || (typeof spec === 'string' ? spec : 'medium'),
    seed: g.seed, source: opts.source || 'normal', daily: opts.daily || null,
  });
}

// Reconstruye una partida desde una cadena de givens (puzzle compartido).
export function gameFromGivens(givens, opts = {}) {
  const board = decodeGivens(givens);
  if (!board) return null;
  if (conflicts(board).size) return null;     // givens inconsistentes
  const count = countSolutions(board, 2);     // 0 = sin solución, 1 = única, 2+ = varias
  if (count === 0) return null;               // no se puede resolver → rechazar
  const solution = solve(board);
  if (!solution) return null;
  return buildState({
    puzzle: board, solution, difficulty: opts.difficulty || 'custom',
    seed: 0, source: 'shared', unique: count === 1,
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

// Núcleo común: coloca/alterna el valor v en la celda i. En notesMode alterna la
// nota; fuera de notas, si la celda ya tiene v lo BORRA (tocar otra vez = quitar).
// Devuelve true si cambió el tablero.
function putValue(s, i, v) {
  if (i < 0 || locked(s, i) || s.completed) return false;
  if (s.notesMode) {
    if (s.cells[i]) return false;             // no hay notas sobre un valor
    pushHistory(s, i);
    s.notes[i] ^= (1 << v);
    return true;
  }
  if (s.cells[i] === v) {                      // mismo valor → quitar
    pushHistory(s, i);
    s.cells[i] = 0;
    return true;
  }
  pushHistory(s, i);
  s.cells[i] = v;
  s.notes[i] = 0;
  // Solo cuenta como error contra la solución si el puzzle es de solución única.
  if (s.unique && s.solution[i] && v !== s.solution[i]) s.mistakes++;
  else clearPeerNotes(s, i, v);
  if (isComplete(s.cells)) s.completed = true;
  return true;
}

// Teclado: escribe el dígito en la celda seleccionada (modo casilla primero).
export function inputDigit(s, v) { return putValue(s, s.selected, v); }

// Modo NÚMERO PRIMERO: elige el dígito "en la mano" (toca el mismo para soltarlo).
// Elegir un dígito apaga la goma.
export function setActiveDigit(s, v) {
  s.activeDigit = s.activeDigit === v ? 0 : v;
  if (s.activeDigit) s.eraseMode = false;
  return s.activeDigit;
}

// Goma como TOGGLE, exclusiva con número y notas. Al ENCENDER recuerda el número
// que tenías en la mano; al APAGAR lo vuelve a seleccionar (así sigues colocando
// sin re-elegirlo). Borra siempre valor + notas (ver eraseAt).
export function setEraseMode(s) {
  s.eraseMode = !s.eraseMode;
  if (s.eraseMode) {
    s.prevDigit = s.activeDigit;   // recordar el número en la mano
    s.activeDigit = 0;
    s.notesMode = false;           // exclusivo con notas
  } else {
    s.activeDigit = s.prevDigit || 0;   // reseleccionar el último número
  }
  return s.eraseMode;
}

// Aplica el dígito en la mano a la celda i (al tocar una casilla). Sin dígito
// activo no hace nada (solo se seleccionó la casilla).
export function applyActiveDigit(s, i) {
  return s.activeDigit ? putValue(s, i, s.activeDigit) : false;
}

// Soltar (drag & drop) el dígito v sobre la casilla i: en notas alterna la nota;
// si no, COLOCA el valor (reemplaza). Arrastrar nunca borra (no es toggle).
export function dropAt(s, i, v) {
  if (i < 0 || locked(s, i) || s.completed) return false;
  if (s.notesMode) {
    if (s.cells[i]) return false;
    pushHistory(s, i);
    s.notes[i] ^= (1 << v);
    return true;
  }
  if (s.cells[i] === v) return false;          // ya está ese número → no-op
  pushHistory(s, i);
  s.cells[i] = v;
  s.notes[i] = 0;
  if (s.unique && s.solution[i] && v !== s.solution[i]) s.mistakes++;
  else clearPeerNotes(s, i, v);
  if (isComplete(s.cells)) s.completed = true;
  return true;
}

// Borra la casilla i: quita el valor Y todas sus notas.
export function eraseAt(s, i) {
  if (i < 0 || locked(s, i) || s.completed) return false;
  if (!s.cells[i] && !s.notes[i]) return false;
  pushHistory(s, i);
  s.cells[i] = 0;
  s.notes[i] = 0;
  return true;
}
export function erase(s) { return eraseAt(s, s.selected); }

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

export function toggleNotes(s) {
  s.notesMode = !s.notesMode;
  if (s.notesMode && s.eraseMode) { s.activeDigit = s.prevDigit || 0; s.eraseMode = false; } // notas apaga la goma
  return s.notesMode;
}

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
    difficulty: s.difficulty, seed: s.seed, source: s.source, daily: s.daily, unique: s.unique,
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
    source: o.source || 'normal', daily: o.daily || null, unique: o.unique !== false,
    given: o.given, hinted: o.hinted || new Array(81).fill(0),
    cells: o.cells, solution: o.solution, notes: o.notes || new Array(81).fill(0),
    selected: typeof o.selected === 'number' ? o.selected : -1,
    activeDigit: 0, prevDigit: 0, eraseMode: false,
    notesMode: !!o.notesMode, mistakes: o.mistakes || 0,
    hintsUsed: o.hintsUsed || 0,
    elapsedMs: o.elapsedMs || 0, completed: !!o.completed,
    history: [], givensStr: o.givensStr || encodeGivens(o.given.map((g, i) => (g ? o.cells[i] : 0))),
  };
}
