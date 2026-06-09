// Motor de Sudoku (puro, sin dependencias). Un tablero es un Array(81) de enteros
// 0..9 (0 = vacío), índice i → fila (i/9), columna (i%9). La generación es
// DETERMINISTA por semilla: el mismo (dificultad, semilla) produce el mismo puzzle,
// así un enlace #fragment lo reproduce exacto y el reto diario es igual para todos.

export const SIZE = 81;
const BOX = 3;
const ALL = 0x3FE; // bits 1..9 encendidos (bit v = 1<<v)

const boxOf = (r, c) => ((r / BOX) | 0) * BOX + ((c / BOX) | 0);
const rowOf = i => (i / 9) | 0;
const colOf = i => i % 9;

// Número de clues por dificultad (con simetría central puede sobrar ±1).
export const CLUES = { easy: 45, medium: 36, hard: 30, expert: 26 };
export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'];

// --- RNG determinista (mulberry32) ---
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

const popcount = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
const bitToDigit = bit => 31 - Math.clz32(bit); // bit = 1<<v → v

// Construye las máscaras fila/col/caja de un tablero.
function masks(board) {
  const rows = new Int16Array(9), cols = new Int16Array(9), boxes = new Int16Array(9);
  for (let i = 0; i < SIZE; i++) {
    const v = board[i];
    if (v) {
      const bit = 1 << v;
      rows[rowOf(i)] |= bit; cols[colOf(i)] |= bit; boxes[boxOf(rowOf(i), colOf(i))] |= bit;
    }
  }
  return { rows, cols, boxes };
}

// Backtracking con bitmasks + MRV (mínimos candidatos primero). `limit` corta el
// conteo de soluciones (2 basta para verificar unicidad). Devuelve { count, fill }
// donde fill es la primera solución hallada (Array(81)) o null.
function search(board, limit) {
  const work = board.slice();
  const { rows, cols, boxes } = masks(work);
  let count = 0;
  let firstFill = null;

  function rec() {
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < SIZE; i++) {
      if (work[i]) continue;
      const r = rowOf(i), c = colOf(i), b = boxOf(r, c);
      const avail = (~(rows[r] | cols[c] | boxes[b])) & ALL;
      if (avail === 0) return;        // celda sin candidatos → poda
      const n = popcount(avail);
      if (n < bestN) { bestN = n; best = i; bestMask = avail; if (n === 1) break; }
    }
    if (best === -1) {                // tablero completo → solución
      count++;
      if (!firstFill) firstFill = work.slice();
      return;
    }
    const r = rowOf(best), c = colOf(best), b = boxOf(r, c);
    let m = bestMask;
    while (m) {
      const bit = m & -m; m &= m - 1;
      const v = bitToDigit(bit);
      work[best] = v; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      rec();
      work[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
      if (count >= limit) return;
    }
  }
  rec();
  return { count, fill: firstFill };
}

export function countSolutions(board, limit = 2) { return search(board, limit).count; }
export function isUnique(board) { return search(board, 2).count === 1; }

// Resuelve un tablero; devuelve la (primera) solución completa o null.
export function solve(board) { return search(board, 1).fill; }

// Genera una rejilla completa válida de forma determinista.
export function generateSolved(rng) {
  const board = new Array(SIZE).fill(0);
  const { rows, cols, boxes } = masks(board);
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  function place(i) {
    if (i === SIZE) return true;
    if (board[i]) return place(i + 1);
    const r = rowOf(i), c = colOf(i), b = boxOf(r, c);
    const used = rows[r] | cols[c] | boxes[b];
    for (const v of shuffle(digits.slice(), rng)) {
      const bit = 1 << v;
      if (used & bit) continue;
      board[i] = v; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      if (place(i + 1)) return true;
      board[i] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
    }
    return false;
  }
  place(0);
  return board;
}

// Genera un puzzle: rejilla completa + huecos (simetría central) manteniendo
// solución ÚNICA, hasta acercarse al número de clues objetivo de la dificultad.
export function generate(difficulty = 'medium', seed) {
  const s = (seed >>> 0) || 1;
  const rng = mulberry32(s);
  const solution = generateSolved(rng);
  const puzzle = solution.slice();
  const target = CLUES[difficulty] ?? CLUES.medium;

  const cells = shuffle([...Array(SIZE).keys()], rng);
  let clues = SIZE;
  for (const i of cells) {
    if (clues <= target) break;
    if (puzzle[i] === 0) continue;
    const sym = SIZE - 1 - i; // simetría central (rotación 180°)
    const backupI = puzzle[i], backupSym = puzzle[sym];
    puzzle[i] = 0;
    let removed = 1;
    if (sym !== i && puzzle[sym] !== 0) { puzzle[sym] = 0; removed = 2; }
    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[i] = backupI;
      if (removed === 2) puzzle[sym] = backupSym;
    } else {
      clues -= removed;
    }
  }
  return { puzzle, solution, seed: s, difficulty, clues };
}

// --- Helpers de juego ---

// Índices que comparten fila, columna o caja con `i` (sin incluir a `i`).
export function peers(i) {
  const r = rowOf(i), c = colOf(i), b = boxOf(r, c);
  const set = new Set();
  for (let k = 0; k < SIZE; k++) {
    if (k === i) continue;
    if (rowOf(k) === r || colOf(k) === c || boxOf(rowOf(k), colOf(k)) === b) set.add(k);
  }
  return set;
}

// Conjunto de índices en conflicto (mismo dígito repetido en fila/col/caja).
export function conflicts(board) {
  const bad = new Set();
  const groups = [];
  for (let r = 0; r < 9; r++) { const g = []; for (let c = 0; c < 9; c++) g.push(r * 9 + c); groups.push(g); }
  for (let c = 0; c < 9; c++) { const g = []; for (let r = 0; r < 9; r++) g.push(r * 9 + c); groups.push(g); }
  for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
    const g = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g.push((br * 3 + r) * 9 + (bc * 3 + c));
    groups.push(g);
  }
  for (const g of groups) {
    const seen = new Map();
    for (const i of g) {
      const v = board[i];
      if (!v) continue;
      if (seen.has(v)) { bad.add(i); bad.add(seen.get(v)); }
      else seen.set(v, i);
    }
  }
  return bad;
}

export function isComplete(board) {
  for (let i = 0; i < SIZE; i++) if (!board[i]) return false;
  return conflicts(board).size === 0;
}

// Cuántas veces aparece cada dígito (para el contador del teclado numérico).
export function digitCounts(board) {
  const counts = new Array(10).fill(0);
  for (let i = 0; i < SIZE; i++) if (board[i]) counts[board[i]]++;
  return counts;
}

// --- Codificación para compartir / persistir ---
// Givens como cadena de 81 dígitos (0 = vacío). Compacta e indexable-segura.
export function encodeGivens(board) {
  let s = '';
  for (let i = 0; i < SIZE; i++) s += (board[i] || 0);
  return s;
}
export function decodeGivens(str) {
  if (!str || !/^[0-9]{81}$/.test(str)) return null;
  const board = new Array(SIZE);
  for (let i = 0; i < SIZE; i++) board[i] = str.charCodeAt(i) - 48;
  return board;
}
