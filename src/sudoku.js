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

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'];

// La dificultad se mide por la TÉCNICA humana más difícil que exige el puzzle (no
// por el número de pistas, que es mal indicador: un tablero con muchos huecos
// puede seguir siendo de singles). Niveles del grader:
//   1 single desnudo · 2 single oculto · 3 candidatos bloqueados (pointing/claiming)
//   4 par desnudo · 5 trío desnudo · 99 requiere algo más (avanzado / búsqueda)
// Cada banda: técnica [min, max], un TOPE de huecos `capEmpties` (para los niveles
// "casi completos" de iniciación) y un suelo de pistas `minClues` (hasta dónde
// cavar en profundidad cuando se busca exigir una técnica más difícil).
const BANDS = {
  easy:   { min: 1, max: 2,  capEmpties: 28, minClues: 40 }, // singles → casi trivial
  medium: { min: 2, max: 3,  capEmpties: 64, minClues: 32 }, // singles + candidatos bloqueados
  hard:   { min: 3, max: 99, capEmpties: 64, minClues: 27 }, // candidatos bloqueados / pares
  expert: { min: 4, max: 99, capEmpties: 64, minClues: 23 }, // pares en adelante / búsqueda
};
const GEN_ATTEMPTS = 24;

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

// ---- Grader humano: técnica más difícil necesaria para resolver con lógica ----

// 27 unidades (9 filas, 9 columnas, 9 cajas) y los 20 pares de cada celda.
const UNITS = (() => {
  const u = [];
  for (let r = 0; r < 9; r++) { const a = []; for (let c = 0; c < 9; c++) a.push(r * 9 + c); u.push(a); }
  for (let c = 0; c < 9; c++) { const a = []; for (let r = 0; r < 9; r++) a.push(r * 9 + c); u.push(a); }
  for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
    const a = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) a.push((br * 3 + r) * 9 + (bc * 3 + c));
    u.push(a);
  }
  return u;
})();
const PEERLIST = (() => {
  const p = Array.from({ length: SIZE }, () => []);
  for (let i = 0; i < SIZE; i++) {
    const set = new Set();
    for (const u of UNITS) if (u.indexOf(i) !== -1) for (const j of u) if (j !== i) set.add(j);
    p[i] = [...set];
  }
  return p;
})();
const _combos = new Map();
function kcombos(n, k) {
  const key = n * 10 + k;
  if (_combos.has(key)) return _combos.get(key);
  const res = [], c = [];
  (function rec(start) {
    if (c.length === k) { res.push(c.slice()); return; }
    for (let i = start; i < n; i++) { c.push(i); rec(i + 1); c.pop(); }
  })(0);
  _combos.set(key, res);
  return res;
}
function candMaskFor(cells, i) {
  let used = 0;
  for (const j of PEERLIST[i]) if (cells[j]) used |= 1 << cells[j];
  return (~used) & ALL;
}

function nakedSubset(cells, cand, size) {
  for (const u of UNITS) {
    const empties = u.filter(i => !cells[i]);
    if (empties.length <= size) continue;
    for (const combo of kcombos(empties.length, size)) {
      let union = 0;
      for (const k of combo) union |= cand[empties[k]];
      if (popcount(union) !== size) continue;
      let changed = false;
      const inset = combo.map(k => empties[k]);
      for (const i of empties) {
        if (inset.indexOf(i) === -1 && (cand[i] & union)) { cand[i] &= ~union; changed = true; }
      }
      if (changed) return true;
    }
  }
  return false;
}

function lockedCandidates(cells, cand) {
  // Pointing: en una caja, si todos los candidatos de v caen en una fila/col → eliminar fuera de la caja.
  for (let b = 0; b < 9; b++) {
    const box = UNITS[18 + b];
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      const cw = box.filter(i => !cells[i] && (cand[i] & bit));
      if (cw.length < 2) continue;
      const rows = new Set(cw.map(i => (i / 9) | 0)), cols = new Set(cw.map(i => i % 9));
      if (rows.size === 1) {
        const r = [...rows][0]; let ch = false;
        for (let c = 0; c < 9; c++) { const i = r * 9 + c; if (box.indexOf(i) === -1 && (cand[i] & bit)) { cand[i] &= ~bit; ch = true; } }
        if (ch) return true;
      }
      if (cols.size === 1) {
        const c = [...cols][0]; let ch = false;
        for (let r = 0; r < 9; r++) { const i = r * 9 + c; if (box.indexOf(i) === -1 && (cand[i] & bit)) { cand[i] &= ~bit; ch = true; } }
        if (ch) return true;
      }
    }
  }
  // Claiming: en una fila/col, si todos los candidatos de v caen en una caja → eliminar resto de la caja.
  for (let li = 0; li < 18; li++) {
    const line = UNITS[li];
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      const cw = line.filter(i => !cells[i] && (cand[i] & bit));
      if (cw.length < 2) continue;
      const boxes = new Set(cw.map(i => boxOf((i / 9) | 0, i % 9)));
      if (boxes.size === 1) {
        const box = UNITS[18 + [...boxes][0]]; let ch = false;
        for (const i of box) { if (line.indexOf(i) === -1 && !cells[i] && (cand[i] & bit)) { cand[i] &= ~bit; ch = true; } }
        if (ch) return true;
      }
    }
  }
  return false;
}

// Resuelve aplicando técnicas humanas de menor a mayor; devuelve la técnica más
// difícil usada, o 99 si se atasca (requiere algo más avanzado / búsqueda).
export function grade(puzzle) {
  const cells = puzzle.slice();
  const cand = new Int16Array(SIZE);
  for (let i = 0; i < SIZE; i++) cand[i] = cells[i] ? 0 : candMaskFor(cells, i);
  let maxLevel = 0;
  const place = (i, v) => { cells[i] = v; cand[i] = 0; const bit = 1 << v; for (const p of PEERLIST[i]) cand[p] &= ~bit; };

  for (;;) {
    let filled = true;
    for (let i = 0; i < SIZE; i++) if (!cells[i]) { filled = false; if (cand[i] === 0) return { solved: false, maxLevel: 99 }; }
    if (filled) return { solved: true, maxLevel };

    // L1 — single desnudo (única opción en la celda)
    let prog = false;
    for (let i = 0; i < SIZE; i++) if (!cells[i] && popcount(cand[i]) === 1) { place(i, bitToDigit(cand[i])); prog = true; }
    if (prog) { maxLevel = Math.max(maxLevel, 1); continue; }

    // L2 — single oculto (un dígito con un único hueco posible en su unidad)
    for (const u of UNITS) {
      for (let v = 1; v <= 9; v++) {
        const bit = 1 << v;
        let cell = -1, cnt = 0, present = false;
        for (const i of u) { if (cells[i] === v) { present = true; break; } if (!cells[i] && (cand[i] & bit)) { cnt++; cell = i; } }
        if (!present && cnt === 1) { place(cell, v); prog = true; }
      }
    }
    if (prog) { maxLevel = Math.max(maxLevel, 2); continue; }

    if (lockedCandidates(cells, cand)) { maxLevel = Math.max(maxLevel, 3); continue; }
    if (nakedSubset(cells, cand, 2)) { maxLevel = Math.max(maxLevel, 4); continue; }
    if (nakedSubset(cells, cand, 3)) { maxLevel = Math.max(maxLevel, 5); continue; }

    return { solved: false, maxLevel: 99 }; // atascado → más allá de lo implementado
  }
}

// Cava huecos (simetría central) manteniendo solución ÚNICA y sin pasarse de la
// técnica máxima de la banda. Se detiene al alcanzar el TOPE de huecos (niveles de
// iniciación: quedan "casi completos") o el SUELO de pistas (bandas difíciles:
// cava hondo para exigir técnicas más duras). El tope de técnica hace que cavar
// más no vuelva el puzzle "imposible" para la banda.
function digToBand(solution, band, rng) {
  const puzzle = solution.slice();
  const cells = shuffle([...Array(SIZE).keys()], rng);
  let clues = SIZE;
  for (const i of cells) {
    if (SIZE - clues >= band.capEmpties) break;   // tope de huecos (iniciación)
    if (clues <= band.minClues) break;            // suelo de pistas (cava hondo)
    if (puzzle[i] === 0) continue;
    const sym = SIZE - 1 - i;
    const bI = puzzle[i], bS = puzzle[sym];
    puzzle[i] = 0;
    let removed = 1;
    if (sym !== i && puzzle[sym] !== 0) { puzzle[sym] = 0; removed = 2; }
    let ok = countSolutions(puzzle, 2) === 1;
    if (ok && band.max < 99) ok = grade(puzzle).maxLevel <= band.max;
    if (ok) clues -= removed;
    else { puzzle[i] = bI; if (removed === 2) puzzle[sym] = bS; }
  }
  return { puzzle, clues };
}

// Resuelve `spec` (nombre de banda 'easy'..'expert' o un objeto por nivel
// { maxLevel, minLevel, holes }) a una banda { min, max, floor }. `holes` = nº de
// casillas vacías objetivo (floor de pistas = 81 − holes); así un nivel "casi
// completo" se pide con pocos holes.
function resolveBand(spec) {
  if (typeof spec === 'string') return BANDS[spec] || BANDS.medium;
  return {
    min: spec.minLevel ?? 1,
    max: spec.maxLevel ?? 99,
    capEmpties: spec.cap ?? 64,             // tope de huecos (niveles de iniciación)
    minClues: spec.minClues ?? 23,          // suelo de pistas (bandas difíciles)
  };
}

// Genera un puzzle de la dificultad pedida (graduado por técnica y por nº de
// huecos), determinista por semilla: prueba sub-semillas hasta caer en la banda;
// si ninguna encaja, devuelve la más cercana.
export function generate(spec = 'medium', seed) {
  const band = resolveBand(spec);
  const s = (seed >>> 0) || 1;
  let best = null, bestScore = -Infinity;
  for (let a = 0; a < GEN_ATTEMPTS; a++) {
    const rng = mulberry32((s + a * 0x9e3779b1) >>> 0);
    const solution = generateSolved(rng);
    const { puzzle, clues } = digToBand(solution, band, rng);
    const g = grade(puzzle);
    if (g.maxLevel >= band.min && g.maxLevel <= band.max) {
      return { puzzle, solution, seed: s, clues, level: g.maxLevel };
    }
    const over = g.maxLevel > band.max ? (g.maxLevel === 99 ? 8 : g.maxLevel - band.max) : 0;
    const under = g.maxLevel < band.min ? band.min - g.maxLevel : 0;
    const score = -(over * 2 + under);
    if (score > bestScore) { bestScore = score; best = { puzzle, solution, clues, level: g.maxLevel }; }
  }
  return { puzzle: best.puzzle, solution: best.solution, seed: s, clues: best.clues, level: best.level };
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
