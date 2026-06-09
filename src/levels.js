// Mapa de la aventura: un GRAFO de nodos (niveles de Sudoku) con CAMINOS QUE SE
// BIFURCAN y convergen en un JEFE por región; las ESTRELLAS son la LLAVE que abre
// los jefes y las regiones (gamificación, ver CONVENCIONES-APPS.md §12). Patrón
// hermano del de Critters (campaña por estrellas), aquí curado y finito.
//
// Cada región: una entrada → dos ramas paralelas (caminos alternativos) → un JEFE
// que las une. Vencer al jefe (y reunir las estrellas exigidas) abre la entrada de
// la siguiente región. El seed por nodo es DETERMINISTA: el mismo nodo es el mismo
// puzzle para todos, y un nivel se puede compartir por #fragment.

// Región: etiqueta de dificultad, puertas de estrellas (entrar / jefe) y la RAMPA.
// Cada nivel se gradúa por TÉCNICA: `max`/`min` = técnica humana permitida (1 single
// desnudo … 5 trío, 99 avanzado). La región EASY es de iniciación: niveles "casi
// completos" → se cava por TOPE DE HUECOS `caps[depth]` (9, 16, 24…) y solo singles.
// Las demás cavan HONDO hasta exigir su técnica → se controla por `minClues[depth]`
// (menos pistas = más difícil). El jefe sube un escalón respecto a su región.
//   depth 0 = entrada, 1 = ramas fila 1, 2 = ramas fila 2.
const REGIONS = [
  { key: 'easy', bossKey: 'medium', gate: 0, bossGate: 6,
    normal: { max: 2, min: 1, caps: [9, 16, 24] },          // casi completos, solo singles
    boss:   { max: 2, min: 1, cap: 30 } },
  { key: 'medium', bossKey: 'hard', gate: 9, bossGate: 20,
    normal: { max: 3, min: 2, minClues: [34, 32, 31] },     // singles + candidatos bloqueados, sin pares
    boss:   { max: 4, min: 2, minClues: 30 } },
  { key: 'hard', bossKey: 'expert', gate: 24, bossGate: 38,
    normal: { max: 99, min: 3, minClues: [28, 27, 26] },    // candidatos bloqueados / pares, menos pistas
    boss:   { max: 99, min: 3, minClues: 25 } },
  { key: 'expert', bossKey: 'expert', gate: 44, bossGate: 60,
    normal: { max: 99, min: 4, minClues: [24, 23, 23] },    // pares en adelante / búsqueda, mínimas pistas
    boss:   { max: 99, min: 4, minClues: 22 } },
];

const seedFor = (idx) => (100003 + idx * 7919) >>> 0;

// Spec de generación de un nivel: técnica + (tope de huecos | suelo de pistas).
function normalSpec(reg, depth) {
  const n = reg.normal;
  const s = { maxLevel: n.max, minLevel: n.min };
  if (n.caps) s.cap = n.caps[depth];           // iniciación: casi completo
  else s.minClues = n.minClues[depth];         // difícil: cava hondo
  return s;
}
function bossSpec(reg) {
  const b = reg.boss;
  const s = { maxLevel: b.max, minLevel: b.min };
  if (b.cap != null) s.cap = b.cap; else s.minClues = b.minClues;
  return s;
}

// Construye el grafo una sola vez (es estático).
function build() {
  const nodes = [];
  let idx = 0, row = 0, prevBoss = null;

  const add = (n) => { nodes.push(n); idx++; return n.id; };
  const mk = (type, reg, x, requires, requireMode, gate, region, label, spec) => ({
    id: 'n' + idx, type, diff: type === 'boss' ? reg.bossKey : reg.key,
    x, row, seed: seedFor(idx), requires, requireMode, gate, region, label, spec,
  });

  REGIONS.forEach((reg, ri) => {
    // Entrada de la región (abre con su puerta de estrellas + jefe anterior vencido)
    const entry = mk('normal', reg, 0.5, prevBoss ? [prevBoss] : [], 'all', reg.gate, ri, 1, normalSpec(reg, 0));
    add(entry); row++;

    // Bifurcación: dos ramas paralelas desde la entrada (caminos alternativos)
    const L1 = mk('normal', reg, 0.24, [entry.id], 'all', 0, ri, 2, normalSpec(reg, 1)); add(L1);
    const R1 = mk('normal', reg, 0.76, [entry.id], 'all', 0, ri, 2, normalSpec(reg, 1)); add(R1);
    row++;
    const L2 = mk('normal', reg, 0.24, [L1.id], 'all', 0, ri, 3, normalSpec(reg, 2)); add(L2);
    const R2 = mk('normal', reg, 0.76, [R1.id], 'all', 0, ri, 3, normalSpec(reg, 2)); add(R2);
    row++;

    // El jefe une las dos ramas: basta despejar UNA para enfrentarlo, pero la otra
    // da más estrellas. Exige su puerta de estrellas (las estrellas como llave) y
    // sube un escalón de dificultad respecto a la región.
    const boss = mk('boss', reg, 0.5, [L2.id, R2.id], 'any', reg.bossGate, ri, 0, bossSpec(reg));
    add(boss); row++;

    prevBoss = boss.id;
  });

  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const maxRow = row;
  return { nodes, byId, maxRow, regions: REGIONS };
}

const MAP = build();

export const allNodes = () => MAP.nodes;
export const nodeById = (id) => MAP.byId[id] || null;
export const maxRow = () => MAP.maxRow;
export const regions = () => MAP.regions;
export const firstNodeId = () => MAP.nodes[0].id;
export const regionName = (ri) => MAP.regions[ri]?.key;

// Aristas (para dibujar los caminos del mapa): de cada prerrequisito al nodo.
export function edges() {
  const out = [];
  for (const n of MAP.nodes) for (const req of n.requires) out.push([req, n.id]);
  return out;
}

// --- Progreso y estrellas ---
// progress = { [nodeId]: { done:bool, stars:0..3, bestMs:number, shared:bool },
//              hints:number (consumibles globales), daily:{ last, streak } }
// Las ESTRELLAS se ganan completando (1..3) y son la LLAVE de gates/jefes.
// Los SHARES NO dan estrellas: dan PISTAS consumibles (progress.hints), ver main.js.

export function nodeStars(progress, id) {
  const p = progress && progress[id];
  return p ? (p.stars || 0) : 0;
}

export function totalStars(progress) {
  let s = 0;
  for (const n of MAP.nodes) s += nodeStars(progress, n.id);
  return s;
}

export function maxStars() { return MAP.nodes.length * 3; }

export const isDone = (progress, id) => !!(progress && progress[id] && progress[id].done);

// 1..3 estrellas según el rendimiento (sin contar la estrella de compartir).
export function computeStars({ mistakes = 0, hintsUsed = 0 } = {}) {
  if (mistakes === 0 && hintsUsed === 0) return 3;
  if (mistakes <= 2 && hintsUsed <= 1) return 2;
  return 1;
}

// ¿Está desbloqueado el nodo? Puerta de estrellas + prerrequisitos del camino.
export function isUnlocked(progress, id) {
  const n = nodeById(id);
  if (!n) return false;
  if (n.gate && totalStars(progress) < n.gate) return false;
  if (!n.requires.length) return true;
  const done = (rid) => isDone(progress, rid);
  return n.requireMode === 'any' ? n.requires.some(done) : n.requires.every(done);
}

// Estrellas que aún faltan para abrir un nodo bloqueado por puerta (0 si no es por estrellas).
export function starsMissing(progress, id) {
  const n = nodeById(id);
  if (!n || !n.gate) return 0;
  return Math.max(0, n.gate - totalStars(progress));
}

// Primer nodo desbloqueado y no terminado (para resaltar "tu próximo nivel").
export function nextNodeId(progress) {
  for (const n of MAP.nodes) {
    if (!isDone(progress, n.id) && isUnlocked(progress, n.id)) return n.id;
  }
  return null;
}

// El siguiente nodo jugable tras completar `id` (para "Siguiente nivel").
export function followingNodeId(progress, id) {
  const here = nodeById(id);
  if (!here) return null;
  // candidatos: nodos que dependen de este, ya desbloqueados
  for (const n of MAP.nodes) {
    if (n.requires.includes(id) && isUnlocked(progress, n.id) && !isDone(progress, n.id)) return n.id;
  }
  return nextNodeId(progress);
}
