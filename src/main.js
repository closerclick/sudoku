import './style.css';
import { h, clear } from './dom.js';
import { t, getLang, setLang } from './i18n.js';
import {
  newGame, gameFromGivens, select, inputDigit, erase, eraseAt, undo, hint, toggleNotes,
  setActiveDigit, setEraseMode, applyActiveDigit, dropAt, serialize, deserialize,
} from './game.js';
import {
  loadSaves, saveSaves, loadProgress, saveProgress,
} from './store.js';
import {
  allNodes, nodeById, edges, maxRow, regions, totalStars, maxStars, nodeStars,
  isDone, isUnlocked, starsMissing, computeStars, nextNodeId, followingNodeId,
  firstNodeId,
} from './levels.js';
import { createBoard } from './board.js';
import { createBackNav } from '@closerclick/closer-click-nav';
import { createTutorial } from '@closerclick/closer-click-tutorial';
import '@closerclick/closer-click-install';
import '@closerclick/closer-click-share';

// ---------- Iconos (SVG de confianza) ----------
const SVG = (p, fill) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="${fill || 'none'}" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC = {
  notes: SVG('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  erase: SVG('<path d="M3 16 13 6a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-5 5H9z"/><path d="M9 22h11"/>'),
  hint: SVG('<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>'),
  undo: SVG('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  pause: SVG('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'),
  play: SVG('<path d="M7 4v16l13-8z"/>', 'currentColor'),
  share: SVG('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
  star: SVG('<path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 9.5l6.9-.6z"/>', 'currentColor'),
  lock: SVG('<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>'),
  crown: SVG('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>', 'currentColor'),
  calendar: SVG('<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>'),
};
const STARTING_HINTS = 3;

// ---------- Estado ----------
const app = document.getElementById('app');
const screen = h('div', { class: 'screen' });
const toastEl = h('div', { class: 'toast' });
clear(app).append(screen, toastEl);

const support = h('closer-click-support', {
  href: 'https://ko-fi.com/closerclick', repo: 'closerclick/sudoku', discord: 'https://discord.gg/D648uq7cth',
});
const shareEl = h('closer-click-share', { lang: getLang() });
shareEl.addEventListener('cc-share-close', () => { shareEl.open = false; });
shareEl.addEventListener('cc-share-shared', onShared);
app.append(shareEl);

const nav = createBackNav();
let gameLayer = null;
let mapTour = null, gameTour = null;

// Tutorial guiado (burbujas del ecosistema, una sola vez). Una tanda en el mapa
// y otra la primera vez que entras a una partida; comparten storageKey.
function ensureMapTutorial() {
  if (mapTour) return;
  mapTour = createTutorial({
    lang: getLang(), storageKey: 'sudoku.tutorial', startDelay: 350,
    steps: [
      { id: 'stars', target: '[data-testid="stars-total"]', placement: 'bottom',
        title: { es: 'Estrellas', en: 'Stars' },
        text: { es: 'Ganas estrellas al completar niveles (1 a 3 según tu rendimiento). Son la llave para abrir jefes y nuevas regiones.', en: 'Earn stars by completing levels (1–3 by performance). They are the key to unlock bosses and new regions.' } },
      { id: 'pick', target: '[data-testid="node-n0"]', placement: 'top',
        title: { es: 'Empieza aquí', en: 'Start here' },
        text: { es: 'Toca el primer nivel para jugar. El mapa sube: avanzas hacia arriba por caminos que se bifurcan y enfrentas jefes.', en: 'Tap the first level to play. The map climbs upward along branching paths toward bosses.' } },
    ],
  });
}
function ensureGameTutorial() {
  if (gameTour) return;
  gameTour = createTutorial({
    lang: getLang(), storageKey: 'sudoku.tutorial', startDelay: 350,
    steps: [
      { id: 'play', target: '[data-testid="board"]', placement: 'top',
        title: { es: 'Cómo jugar', en: 'How to play' },
        text: { es: 'Elige un número y toca las casillas para colocarlo; tócala otra vez con el mismo número para borrarlo, o usa la goma. Tus números van en azul, las pistas en blanco y los errores en rojo.', en: 'Pick a number, then tap cells to place it; tap again with the same number to remove it, or use the eraser. Your numbers are blue, clues white, mistakes red.' } },
      { id: 'notes', target: '[data-testid="tool-notes"]', placement: 'top',
        title: { es: 'Notas', en: 'Notes' },
        text: { es: 'Activa las notas, elige un número y tócalo en las casillas como candidato. Los candidatos imposibles salen en rojo.', en: 'Turn on notes, pick a number and tap cells to pencil it as a candidate. Impossible candidates show in red.' } },
      { id: 'hint', target: '[data-testid="tool-hint"]', placement: 'top',
        title: { es: 'Pistas', en: 'Hints' },
        text: { es: 'Una pista revela una casilla. El número es tu saldo: consigues más pistas compartiendo niveles.', en: 'A hint reveals a cell. The number is your balance: get more hints by sharing levels.' } },
      { id: 'share', target: '[data-testid="tool-share"]', placement: 'top',
        title: { es: 'Reta a un amigo', en: 'Challenge a friend' },
        text: { es: 'Comparte este nivel: tu amigo juega el mismo reto y tú ganas una pista.', en: 'Share this level: your friend plays the same puzzle and you earn a hint.' } },
    ],
  });
}

let progress = {};
let saves = { map: {}, last: null };   // partidas en curso por nivel (reanudar)
let game = null;          // estado de la partida actual (o null)
let board = null;         // controlador del tablero (perezoso)
let view = 'map';         // 'map' | 'game'
let timer = null;
let lastTick = 0;
let saveTimer = null;

// ---------- Utilidades ----------
function showToast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(showToast._t); showToast._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
}
function fmtTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}
const hintsBalance = () => (typeof progress.hints === 'number' ? progress.hints : STARTING_HINTS);

function todayKey() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function dayKeyFrom(ms) {
  const d = new Date(ms);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function dailyDifficulty() {
  const diffs = ['easy', 'medium', 'medium', 'hard', 'medium', 'hard', 'expert'];
  return diffs[new Date().getDay()];
}

function coinInTopbar(container) {
  support.removeAttribute('floating'); support.className = 'topbar-coin'; container.append(support);
}
function coinFloating() {
  support.className = ''; support.setAttribute('floating', ''); app.append(support);
}

// ---------- Persistencia ----------
// Clave estable por partida: nivel (nodo), reto diario o puzzle compartido.
function ctxKey(ctx) {
  if (!ctx) return 'X';
  if (ctx.kind === 'daily') return 'D:' + ctx.date;
  if (ctx.kind === 'shared') return 'S:' + ctx.givens;
  return 'L:' + ctx.nodeId;
}
function persistGame() {
  if (!game) return;
  const key = ctxKey(game.ctx);
  saves.map[key] = { ...serialize(game), ctx: game.ctx };
  saves.last = key;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveSaves(saves).catch(() => {}); }, 350);
}
// Al resolver un nivel ya no se reanuda: se borra su partida guardada.
function clearSave(key) {
  if (saves.map[key]) {
    delete saves.map[key];
    if (saves.last === key) saves.last = null;
    saveSaves(saves).catch(() => {});
  }
}
function lastSave() { return saves.last ? saves.map[saves.last] : null; }
function resumeRecord(rec, ctx) {
  game = deserialize(rec);
  if (!game) return false;
  game.ctx = ctx || rec.ctx;
  game.paused = false;
  game.activeDigit = 0; game.eraseMode = false;   // sin pen/goma colgando al reanudar
  openGame();
  return true;
}
async function persistProgress() { try { await saveProgress(progress); } catch {} }

// ---------- Timer ----------
function startTimer() {
  stopTimer();
  lastTick = Date.now();
  timer = setInterval(() => {
    if (!game || game.paused || game.completed) return;
    const now = Date.now();
    game.elapsedMs += now - lastTick; lastTick = now;
    const tEl = document.getElementById('timeVal');
    if (tEl) tEl.textContent = fmtTime(game.elapsedMs);
  }, 500);
}
function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

// =====================================================================
//  MAPA (aventura)
// =====================================================================
function renderMap() {
  view = 'map';
  closeGameLayer();
  stopTimer();
  coinFloating();
  document.body.classList.remove('mode-game');

  const top = h('header', { class: 'topbar' },
    h('div', { class: 'brand' }, h('img', { src: 'icon.svg', alt: '', width: 30, height: 30 }), h('span', {}, t('brand'))),
    h('div', { class: 'spacer' }),
    h('div', { class: 'actions' },
      langSelector(() => renderMap()),
      h('closer-click-install', { class: 'cc-install sm', 'data-testid': 'install-btn', lang: getLang() }),
    ),
  );

  const total = totalStars(progress);
  const starsBar = h('div', { class: 'stars-bar' },
    h('div', { class: 'stars-total', 'data-testid': 'stars-total' },
      h('span', { class: 'ic star', html: IC.star }), h('b', {}, String(total)), h('span', { class: 'muted' }, '/ ' + maxStars())),
    h('div', { class: 'tips-total', title: t('tips') },
      h('span', { class: 'ic', html: IC.hint }), h('b', { 'data-testid': 'tips-total' }, String(hintsBalance()))),
  );

  // tarjeta de partida en curso (reanudar la última jugada)
  const cards = h('div', { class: 'map-cards' });
  const ls = lastSave();
  if (ls && !ls.completed) {
    cards.append(h('button', {
      class: 'card resume', 'data-testid': 'resume', onclick: () => resumeRecord(ls),
    },
      h('span', { class: 'ic', html: IC.play }),
      h('div', { class: 'card-txt' }, h('b', {}, t('resumeGame')), h('span', { class: 'muted' }, ctxLabel(ls.ctx) + ' · ' + fmtTime(ls.elapsedMs))),
    ));
  }
  // reto diario
  const daily = progress.daily || { last: 0, streak: 0 };
  const doneToday = daily.last === todayKey();
  cards.append(h('button', {
    class: 'card daily', 'data-testid': 'daily', disabled: doneToday,
    onclick: () => startDaily(),
  },
    h('span', { class: 'ic', html: IC.calendar }),
    h('div', { class: 'card-txt' },
      h('b', {}, t('dailyChallenge')),
      h('span', { class: 'muted' }, doneToday ? t('dailyDone') : (daily.streak ? t('dailyStreak', { n: daily.streak }) : t(dailyDifficulty()))),
    ),
    daily.streak ? h('span', { class: 'streak-badge' }, '🔥 ' + daily.streak) : null,
  ));

  const mapWrap = renderMapGraph();

  clear(screen).append(top, starsBar, cards, mapWrap);
  coinInTopbar(top.querySelector('.actions'));

  // El mapa sube: enfocar el nodo actual (o el fondo, donde está el nivel 1) para
  // que el jugador vea dónde está sin tener que desplazarse.
  requestAnimationFrame(() => {
    const nextEl = screen.querySelector('.node-wrap.next') || screen.querySelector('.node-wrap.done:last-of-type');
    if (nextEl) nextEl.scrollIntoView({ block: 'center', behavior: 'auto' });
    else window.scrollTo(0, document.body.scrollHeight);
    ensureMapTutorial();
  });
}

function ctxLabel(ctx) {
  if (!ctx) return t('custom');
  if (ctx.kind === 'daily') return t('dailyChallenge');
  if (ctx.kind === 'shared') return t('sharedPuzzle');
  const n = nodeById(ctx.nodeId);
  if (!n) return t('custom');
  return n.type === 'boss' ? t('boss') + ' · ' + t(n.diff) : t('level') + ' · ' + t(n.diff);
}

const MAP_W = 320, ROW_H = 96, PAD_Y = 48, R_NORM = 27, R_BOSS = 33;
function renderMapGraph() {
  const rows = maxRow();
  const H = PAD_Y * 2 + (rows - 1) * ROW_H;
  const nextId = nextNodeId(progress);

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'map-edges');
  svg.setAttribute('width', MAP_W); svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${MAP_W} ${H}`);
  const cx = n => n.x * MAP_W;
  // El mapa SUBE: el nivel 1 (row 0) queda abajo y se asciende hacia las regiones
  // más difíciles arriba. Se invierte la fila respecto al total.
  const cy = n => PAD_Y + (rows - 1 - n.row) * ROW_H;
  for (const [a, b] of edges()) {
    const na = nodeById(a), nb = nodeById(b);
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', cx(na)); line.setAttribute('y1', cy(na));
    line.setAttribute('x2', cx(nb)); line.setAttribute('y2', cy(nb));
    const travelled = isDone(progress, a) && (isDone(progress, b) || isUnlocked(progress, b));
    line.setAttribute('class', 'edge' + (travelled ? ' on' : ''));
    svg.appendChild(line);
  }

  const inner = h('div', { class: 'map-inner', style: { width: MAP_W + 'px', height: H + 'px' } });
  inner.appendChild(svg);

  for (const n of allNodes()) {
    const unlocked = isUnlocked(progress, n.id);
    const done = isDone(progress, n.id);
    const stars = nodeStars(progress, n.id);
    const isBoss = n.type === 'boss';
    const r = isBoss ? R_BOSS : R_NORM;
    const left = cx(n) - 40, top = cy(n) - r;

    const cls = ['node-wrap'];
    if (isBoss) cls.push('boss');
    if (done) cls.push('done');
    if (!unlocked) cls.push('locked');
    if (n.id === nextId) cls.push('next');

    const circle = h('button', {
      class: 'node diff-' + n.diff, 'data-testid': 'node-' + n.id, 'data-node': n.id,
      style: { width: r * 2 + 'px', height: r * 2 + 'px' },
      disabled: !unlocked,
      'aria-label': (isBoss ? t('boss') : t('level')) + ' ' + (n.region + 1),
      onclick: () => startNode(n.id),
    },
      !unlocked ? h('span', { class: 'ic lock', html: IC.lock })
        : isBoss ? h('span', { class: 'ic crown', html: IC.crown })
          : h('span', { class: 'node-num' }, String(n.label || '')),
    );

    const wrap = h('div', { class: cls.join(' '), style: { left: left + 'px', top: top + 'px' } }, circle);

    // estrellas ganadas (debajo)
    if (done) {
      const st = h('div', { class: 'node-stars' });
      for (let k = 1; k <= 3; k++) st.append(h('span', { class: 'ns' + (k <= stars ? ' on' : ''), html: IC.star }));
      wrap.append(st);
    } else if (!unlocked) {
      const miss = starsMissing(progress, n.id);
      if (miss > 0) wrap.append(h('div', { class: 'node-gate' }, h('span', { class: 'ic', html: IC.star }), String(miss)));
    }
    inner.appendChild(wrap);
  }

  return h('div', { class: 'map-scroll', 'data-testid': 'map' }, inner);
}

function langSelector(after) {
  return h('div', { class: 'lang-selector', role: 'group', 'aria-label': 'es / en' },
    h('button', { class: getLang() === 'es' ? 'on' : '', onclick: () => { setLang('es'); shareEl.lang = 'es'; after(); } }, 'ES'),
    h('button', { class: getLang() === 'en' ? 'on' : '', onclick: () => { setLang('en'); shareEl.lang = 'en'; after(); } }, 'EN'),
  );
}

// =====================================================================
//  Arranque de partidas
// =====================================================================
function startNode(id) {
  const n = nodeById(id);
  if (!n || !isUnlocked(progress, id)) return;
  const ctx = { kind: 'level', nodeId: id, boss: n.type === 'boss', region: n.region };
  const saved = saves.map['L:' + id];
  // Reanudar el nivel lleno si quedó a medias; si no, generarlo nuevo.
  if (saved && !saved.completed && resumeRecord(saved, ctx)) return;
  game = newGame(n.spec, n.seed, { source: 'normal', label: n.diff });
  game.ctx = ctx;
  game.selected = -1;   // sin casilla preseleccionada: número primero limpio
  openGame();
}
function startDaily() {
  if ((progress.daily || {}).last === todayKey()) return;
  const date = todayKey();
  const ctx = { kind: 'daily', date };
  const saved = saves.map['D:' + date];
  if (saved && !saved.completed && resumeRecord(saved, ctx)) return;
  const diff = dailyDifficulty();
  game = newGame(diff, date, { source: 'daily', daily: date, label: diff });
  game.ctx = ctx;
  game.selected = -1;   // sin casilla preseleccionada: número primero limpio
  openGame();
}
function startShared(givens) {
  const ctx = { kind: 'shared', givens };
  const saved = saves.map['S:' + givens];
  if (saved && !saved.completed && resumeRecord(saved, ctx)) return;
  const g = gameFromGivens(givens);
  if (!g) { showToast(t('badLink')); renderMap(); return; }
  game = g;
  game.ctx = ctx;
  game.selected = -1;   // sin casilla preseleccionada: número primero limpio
  openGame();
  // Aviso transparente: si el enlace trae un puzzle con varias soluciones, solo se
  // marcan los errores de regla (no hay una solución única contra la cual comparar).
  if (!game.unique) showToast(t('multiSolution'));
}

// =====================================================================
//  Vista de juego
// =====================================================================
function openGame() {
  view = 'game';
  document.body.classList.add('mode-game');
  coinFloating();
  if (!board) board = createBoard({ onSelect: onSelect, onDigit: onDigit, onDrop: onDrop });
  renderGame();
  startTimer();
  persistGame();
  ensureGameTutorial();
  // capa de navegación: el botón físico "atrás" vuelve al mapa
  if (!gameLayer) gameLayer = nav.open(() => renderMap());
}
function closeGameLayer() { if (gameLayer) { const l = gameLayer; gameLayer = null; l.close(); } }

function renderGame() {
  const ctx = game.ctx;
  const isBoss = ctx && ctx.boss;
  const head = h('div', { class: 'game-head' },
    h('closer-click-back', {
      class: 'cc-back', floating: '', lang: getLang(),
      style: 'top:calc(env(safe-area-inset-top) + 10px);left:calc(env(safe-area-inset-left) + 10px);color:var(--text);--cc-back-size:42px;--cc-back-radius:11px;--cc-back-bg:color-mix(in srgb, var(--surface) 84%, transparent);--cc-back-bg-hover:var(--surface2)',
    }),
    h('div', { class: 'diff-badge ' + (isBoss ? 'boss' : '') + ' d-' + game.difficulty },
      isBoss ? h('span', { class: 'ic', html: IC.crown }) : null,
      isBoss ? t('boss') : (ctx && ctx.kind === 'daily' ? t('dailyChallenge') : ctx && ctx.kind === 'shared' ? t('sharedPuzzle') : t(game.difficulty)),
    ),
  );

  const hud = h('div', { class: 'hud' },
    h('div', { class: 'meta' },
      stat('time', h('span', { id: 'timeVal' }, fmtTime(game.elapsedMs))),
      stat('mistakes', h('span', { class: game.mistakes ? 'bad' : '' }, String(game.mistakes))),
    ),
    h('button', { class: 'btn btn-ghost icon-btn pause-btn', 'data-testid': 'pause', title: t('pause'), 'aria-label': t('pause'), onclick: togglePause, html: game.paused ? IC.play : IC.pause }),
  );

  const boardWrap = h('div', { class: 'board-wrap' }, board.grid);
  if (game.paused) boardWrap.append(h('div', { class: 'pause-overlay' }, h('span', {}, t('paused'))));

  const controls = h('div', { class: 'controls' },
    tool('undo', IC.undo, doUndo, { disabled: !game.history.length }),
    tool('erase', IC.erase, doErase, { active: game.eraseMode }),
    tool('notes', IC.notes, doToggleNotes, { active: game.notesMode }),
    tool('hint', IC.hint, doHint, { badge: hintsBalance() }),
    tool('share', IC.share, () => shareCurrent(), {}),
  );

  clear(screen).append(head, hud, boardWrap, controls, board.pad);
  board.update(game);
}

function stat(key, valEl) {
  return h('div', { class: 'stat' }, h('span', { class: 'k' }, t(key)), h('span', { class: 'v' }, valEl));
}
function tool(key, icon, onclick, opts = {}) {
  const btn = h('button', {
    class: 'tool' + (opts.active ? ' active' : ''), 'data-testid': 'tool-' + key,
    disabled: !!opts.disabled, title: t(key), 'aria-label': t(key), onclick,
  }, h('span', { class: 'ic', html: icon }), h('span', { class: 'tool-lbl' }, t(key)));
  if (opts.badge != null) btn.append(h('span', { class: 'badge' }, String(opts.badge)));
  return btn;
}

// ---------- Acciones del juego (modo NÚMERO PRIMERO) ----------
// Tocar una casilla: si la goma está activa, la borra; si hay un dígito "en la
// mano", lo coloca (o lo quita si ya estaba); si no, solo la selecciona.
function onSelect(i) {
  if (game.paused || game.completed) return;
  select(game, i);
  let changed = false;
  if (game.eraseMode) changed = eraseAt(game, i);
  else if (game.activeDigit) changed = applyActiveDigit(game, i);
  if (changed) afterMove();
  else { board.update(game); persistGame(); }
}
// Tocar un número del teclado: lo toma "en la mano" (toggle). Si ya hay una casilla
// seleccionada, lo coloca también ahí.
function onDigit(v) {
  if (game.paused || game.completed) return;
  // Elegir un número SOLO lo toma "en la mano" (pen). Nunca modifica una casilla:
  // ni valores ni notas cambian al cambiar de número. Colocar/anotar/borrar es
  // SIEMPRE tocando la casilla. Así notas y asignación funcionan igual.
  setActiveDigit(game, v);
  select(game, -1);   // sin casilla enfocada: cambiar de número no deja fondos colgando
  renderGame();
}
// Soltar un número arrastrado sobre una casilla: lo coloca y lo deja "en la mano".
function onDrop(i, v) {
  if (game.paused || game.completed) return;
  game.eraseMode = false;
  game.activeDigit = v;            // el número soltado queda en la mano
  const changed = dropAt(game, i, v);
  select(game, i);
  renderGame();
  if (changed) { persistGame(); if (game.completed) onWin(); }
}
// Goma como toggle puro: solo enciende/apaga; borrar requiere tocar la casilla.
function doErase() {
  if (game.paused || game.completed) return;
  setEraseMode(game);
  select(game, -1);
  renderGame();
}
function doUndo() { if (game.paused) return; if (undo(game)) { renderGame(); persistGame(); } else showToast(t('noUndo')); }
function doToggleNotes() { if (game.paused) return; toggleNotes(game); renderGame(); persistGame(); }
function doHint() {
  if (game.paused || game.completed) return;
  if (hintsBalance() <= 0) { showToast(t('noHints')); return; }
  if (hint(game)) {
    progress.hints = hintsBalance() - 1;
    persistProgress();
    afterMove();
  }
}
function togglePause() {
  if (game.completed) return;
  game.paused = !game.paused;
  if (!game.paused) lastTick = Date.now();
  renderGame();
}
function afterMove() {
  board.update(game);
  persistGame();
  // refrescar badge de pistas / botón undo sin re-render completo
  const hb = screen.querySelector('[data-testid="tool-hint"] .badge');
  if (hb) hb.textContent = String(hintsBalance());
  const undoBtn = screen.querySelector('[data-testid="tool-undo"]');
  if (undoBtn) undoBtn.disabled = !game.history.length;
  const mEl = screen.querySelector('.hud .meta .stat:nth-child(2) .v span');
  if (mEl) { mEl.textContent = String(game.mistakes); mEl.className = game.mistakes ? 'bad' : ''; }
  if (game.completed) onWin();
}

// =====================================================================
//  Compartir (motivado: da PISTAS consumibles)
// =====================================================================
function buildShareLink(givens) {
  return location.origin + location.pathname + '#g=' + givens;
}
function shareCurrent() {
  if (!game) return;
  shareEl.url = buildShareLink(game.givensStr);
  shareEl.text = t('shareText');
  shareEl.lang = getLang();
  shareEl.open = true;
}
function onShared() {
  if (!game || !game.ctx || game.ctx.kind !== 'level') return;
  const id = game.ctx.nodeId;
  const p = progress[id] || (progress[id] = {});
  if (p.shared) return;            // una pista por nivel
  p.shared = true;
  progress.hints = hintsBalance() + 1;
  persistProgress();
  showToast(t('shareReward'));
  // refrescar saldos visibles
  const hb = screen.querySelector('[data-testid="tool-hint"] .badge');
  if (hb) hb.textContent = String(hintsBalance());
  const winHint = document.getElementById('winShareHint');
  if (winHint) winHint.textContent = t('shareAlready');
}

// =====================================================================
//  Victoria
// =====================================================================
async function onWin() {
  stopTimer();
  game.paused = false;
  const ctx = game.ctx || {};
  let earned = 0, record = false, regionMsg = null;

  if (ctx.kind === 'level') {
    earned = computeStars(game);
    const prev = progress[ctx.nodeId] || {};
    record = !prev.bestMs || game.elapsedMs < prev.bestMs;
    progress[ctx.nodeId] = {
      done: true,
      stars: Math.max(prev.stars || 0, earned),
      bestMs: record ? game.elapsedMs : prev.bestMs,
      shared: prev.shared || false,
    };
    await persistProgress();
    // ¿se abrió una región nueva al vencer a un jefe?
    if (ctx.boss) {
      const here = nodeById(ctx.nodeId);
      const nextEntry = allNodes().find(n => n.requires.includes(ctx.nodeId) && n.row > here.row);
      if (nextEntry && isUnlocked(progress, nextEntry.id)) regionMsg = t('regionUnlocked', { r: nextEntry.region + 1 });
    }
  } else if (ctx.kind === 'daily') {
    const d = progress.daily || { last: 0, streak: 0 };
    const y = dayKeyFrom(Date.now() - 86400000);
    d.streak = d.last === y ? d.streak + 1 : (d.last === ctx.date ? d.streak : 1);
    d.last = ctx.date;
    progress.daily = d;
    await persistProgress();
  }
  clearSave(ctxKey(ctx));          // partida terminada: ya no se reanuda
  showWinModal({ ctx, earned, record, regionMsg });
}

function showWinModal({ ctx, earned, record, regionMsg }) {
  const isLevel = ctx.kind === 'level';
  const isBoss = !!ctx.boss;
  const starsRow = h('div', { class: 'win-stars', 'data-testid': 'win-stars' });
  if (isLevel) for (let k = 1; k <= 3; k++) {
    const on = k <= earned;
    starsRow.append(h('span', { class: 'ws' + (on ? ' on' : ''), html: IC.star, style: { animationDelay: (k * 0.12) + 's' } }));
  }

  const next = isLevel ? followingNodeId(progress, ctx.nodeId) : null;
  const alreadyShared = isLevel && progress[ctx.nodeId] && progress[ctx.nodeId].shared;

  const modal = h('div', { class: 'modal win' },
    h('div', { class: 'win-emoji' }, isBoss ? '👑' : '🎉'),
    h('h2', {}, isBoss ? t('bossWin') : t('win')),
    isLevel ? starsRow : null,
    regionMsg ? h('div', { class: 'record-tag' }, regionMsg) : null,
    h('div', { class: 'win-meta' },
      h('div', { class: 's' }, h('div', { class: 'k' }, t('yourTime')), h('div', { class: 'v' }, fmtTime(game.elapsedMs))),
      isLevel ? h('div', { class: 's' }, h('div', { class: 'k' }, t('difficulty')), h('div', { class: 'v' }, t(game.difficulty))) : null,
    ),
    record && isLevel ? h('div', { class: 'record-tag' }, t('newRecord')) : null,
    // share motivado
    h('div', { class: 'win-share' },
      h('button', { class: 'btn primary block', 'data-testid': 'win-share', onclick: () => shareCurrent() },
        h('span', { class: 'ic', html: IC.share }), t('challengeFriend')),
      isLevel ? h('div', { class: 'share-hint', id: 'winShareHint' }, alreadyShared ? t('shareAlready') : t('shareToEarn')) : null,
    ),
    h('div', { class: 'row' },
      next ? h('button', { class: 'btn', 'data-testid': 'win-next', onclick: () => { closeOverlay(); startNode(next); } }, t('nextLevel')) : null,
      h('button', { class: 'btn primary', 'data-testid': 'win-map', onclick: () => { closeOverlay(); game = null; renderMap(); } }, t('backToMap')),
    ),
  );
  openOverlay(modal);
}

// ---------- Overlay genérico ----------
let overlayEl = null;
function openOverlay(modal) {
  closeOverlay();
  overlayEl = h('div', { class: 'overlay', onclick: (e) => { if (e.target === overlayEl) {} } }, modal);
  app.append(overlayEl);
}
function closeOverlay() { if (overlayEl) { overlayEl.remove(); overlayEl = null; } }

// =====================================================================
//  Teclado
// =====================================================================
window.addEventListener('keydown', (e) => {
  if (view !== 'game' || !game || game.paused || game.completed || overlayEl) return;
  // Teclado = casilla primero: el dígito escribe en la casilla seleccionada.
  if (e.key >= '1' && e.key <= '9') { if (inputDigit(game, +e.key)) afterMove(); e.preventDefault(); return; }
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { if (erase(game)) afterMove(); e.preventDefault(); return; }
  if (e.key === 'n' || e.key === 'N') { doToggleNotes(); return; }
  if (e.key === 'h' || e.key === 'H') { doHint(); return; }
  if (e.key === 'u' || e.key === 'U') { doUndo(); return; }
  if (e.key === 'Escape') { renderMap(); return; }
  const sel = game.selected < 0 ? 0 : game.selected;
  let r = (sel / 9) | 0, c = sel % 9;
  if (e.key === 'ArrowUp') r = (r + 8) % 9;
  else if (e.key === 'ArrowDown') r = (r + 1) % 9;
  else if (e.key === 'ArrowLeft') c = (c + 8) % 9;
  else if (e.key === 'ArrowRight') c = (c + 1) % 9;
  else return;
  // Las flechas solo NAVEGAN (no pintan aunque haya un dígito en la mano).
  select(game, r * 9 + c); board.update(game); persistGame(); e.preventDefault();
});

// guardar/pausar al ocultar la pestaña
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game && view === 'game') { game.paused = true; persistGame(); }
});

// =====================================================================
//  Boot
// =====================================================================
function parseHash() {
  const m = /(?:^#|[#&])g=([0-9]{81})/.exec(location.hash || '');
  return m ? m[1] : null;
}

async function boot() {
  document.documentElement.lang = getLang();
  [progress, saves] = await Promise.all([loadProgress(), loadSaves()]);
  if (typeof progress.hints !== 'number') progress.hints = STARTING_HINTS;
  if (!saves || !saves.map) saves = { map: {}, last: null };

  const givens = parseHash();
  if (givens) { startShared(givens); return; }

  // Reanudar la última partida en curso (si quedó a medias).
  const ls = lastSave();
  if (ls && !ls.completed && resumeRecord(ls)) return;
  renderMap();
}
boot();

window.addEventListener('hashchange', () => {
  const givens = parseHash();
  if (givens) startShared(givens);
});

// service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

// expuesto para E2E
window.__sudoku = { getGame: () => game, getProgress: () => progress, startNode, renderMap };
