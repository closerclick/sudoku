// Persistencia OBLIGATORIA vía @closerclick/closer-click-store (store.closer.click,
// §4): las partidas en curso por nivel (para reanudar) y el progreso (estrellas,
// mejores tiempos, pistas, racha diaria) viven en el vault del ecosistema
// (IndexedDB, cuota grande, sync opcional cifrado a Drive). Si el iframe del store
// no carga (offline / bloqueado), caemos a un shim sobre localStorage para no
// perder funcionalidad. localStorage queda solo para prefs de UI (idioma).

const THREAD_GAME = 'sudoku.saves';   // mapa de partidas en curso por nivel
const THREAD_PROGRESS = 'sudoku.progress';

let backendPromise = null;

function shimBackend() {
  const key = t => 'sudoku.shim.' + t;
  const read = t => { try { return JSON.parse(localStorage.getItem(key(t))) || []; } catch { return []; } };
  const write = (t, arr) => { try { localStorage.setItem(key(t), JSON.stringify(arr)); } catch {} };
  return {
    kind: 'localstorage',
    async appendMessage(t, entry) { const a = read(t); a.push(entry); write(t, a); },
    async listThread(t) { return read(t); },
    async removeThread(t) { try { localStorage.removeItem(key(t)); } catch {} },
  };
}

async function getBackend() {
  if (backendPromise) return backendPromise;
  backendPromise = (async () => {
    try {
      const mod = await import('@closerclick/closer-click-store');
      const store = await mod.Store.connect();
      if (store && typeof store.appendMessage === 'function' && typeof store.listThread === 'function') {
        return {
          kind: 'store', store,
          appendMessage: (t, e) => store.appendMessage(t, e),
          listThread: (t, o) => store.listThread(t, o),
          removeThread: t => store.removeThread(t),
        };
      }
      throw new Error('store API mismatch');
    } catch (e) {
      console.warn('[sudoku] store no disponible, usando localStorage:', e?.message || e);
      return shimBackend();
    }
  })();
  return backendPromise;
}

export async function storeKind() { return (await getBackend()).kind; }

// --- Partidas en curso, una por NIVEL (mapa key→partida + último jugado) ---
// Se guarda TODO el objeto de saves en un único registro (se sobrescribe). Así,
// salir de un nivel y volver lo reanuda lleno hasta resolverlo.
export async function loadSaves() {
  const b = await getBackend();
  try {
    const entries = await b.listThread(THREAD_GAME, { limit: 1 });
    if (entries && entries.length) {
      const last = entries[entries.length - 1];
      if (last && last.saves) return last.saves;
    }
  } catch {}
  return { map: {}, last: null };
}

export async function saveSaves(saves) {
  const b = await getBackend();
  try { await b.removeThread(THREAD_GAME); } catch {}
  await b.appendMessage(THREAD_GAME, { id: 'saves', ts: Date.now(), saves });
}

// --- Progreso de la aventura (mapa de niveles: estrellas por nodo) ---
// { [nodeId]: { done, stars, bestMs, shareStar } } — un único registro, se sobrescribe.
export async function loadProgress() {
  const b = await getBackend();
  try {
    const entries = await b.listThread(THREAD_PROGRESS, { limit: 1 });
    if (entries && entries.length) {
      const last = entries[entries.length - 1];
      if (last && last.progress) return last.progress;
    }
  } catch {}
  return {};
}

export async function saveProgress(progress) {
  const b = await getBackend();
  try { await b.removeThread(THREAD_PROGRESS); } catch {}
  await b.appendMessage(THREAD_PROGRESS, { id: 'progress', ts: Date.now(), progress });
}
