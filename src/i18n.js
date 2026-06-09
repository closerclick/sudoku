// Bilingüe es/en (§9). El idioma es una preferencia efímera de UI → localStorage.
// Español neutro / de Ecuador: TUTEO (tú), nunca voseo ni argentinismos.
const DICT = {
  es: {
    brand: 'Sudoku',

    // Mapa / aventura
    journey: 'Aventura', map: 'Mapa', stars: 'estrellas',
    region: 'Región', level: 'Nivel', boss: 'Jefe',
    locked: 'Bloqueado', needStars: 'Necesitas {n} ⭐',
    lockedHint: 'Gana o comparte niveles para conseguir estrellas.',
    play: 'Jugar', continue: 'Continuar', resumeGame: 'Reanudar partida',
    dailyChallenge: 'Reto diario', dailyDone: 'Reto de hoy resuelto', dailyStreak: 'Racha {n}',
    bossIntro: 'Vence al jefe para abrir la siguiente región',
    easy: 'Fácil', medium: 'Medio', hard: 'Difícil', expert: 'Experto',

    // Juego
    notes: 'Notas', erase: 'Borrar', hint: 'Pista', undo: 'Deshacer',
    pause: 'Pausa', resume: 'Reanudar', paused: 'En pausa',
    share: 'Compartir', shareText: 'Te reto a resolver este Sudoku',
    restart: 'Reiniciar',
    time: 'Tiempo', mistakes: 'Errores', best: 'Mejor', hintsLeft: 'Pistas',
    noHints: 'Sin pistas — comparte un nivel para ganar', noUndo: 'Nada que deshacer',
    tips: 'Pistas', sharedPuzzle: 'Puzzle compartido', custom: 'Puzzle',

    // Victoria
    win: '¡Resuelto!', bossWin: '¡Jefe vencido!',
    levelComplete: 'Nivel completado', yourTime: 'Tu tiempo', difficulty: 'Dificultad',
    newRecord: '¡Nuevo récord!', starsEarned: 'Estrellas',
    nextLevel: 'Siguiente nivel', backToMap: 'Volver al mapa', playAgain: 'Jugar de nuevo',
    regionUnlocked: '¡Región {r} desbloqueada!',

    // Share motivado → da PISTAS consumibles
    shareToEarn: 'Comparte este nivel y gana 1 pista',
    shareReward: '¡+1 pista por compartir!',
    shareAlready: 'Ya conseguiste la pista de este nivel',
    challengeFriend: 'Reta a un amigo',
    getMoreTips: 'Comparte para ganar pistas',

    // Stats / varios
    stats: 'Estadísticas', solved: 'Resueltos', totalStars: 'Estrellas totales',
    close: 'Cerrar', cancel: 'Cancelar',
    confirmNewTitle: '¿Abandonar la partida?',
    confirmNewBody: 'Tienes una partida en curso; si sales se guarda para reanudar.',
    linkCopied: '¡Enlace copiado!',
    badLink: 'Ese enlace no tiene un Sudoku válido.',
    multiSolution: 'Este puzzle tiene varias soluciones; solo se marcan los errores de regla.',
  },
  en: {
    brand: 'Sudoku',

    journey: 'Journey', map: 'Map', stars: 'stars',
    region: 'Region', level: 'Level', boss: 'Boss',
    locked: 'Locked', needStars: 'You need {n} ⭐',
    lockedHint: 'Win or share levels to earn stars.',
    play: 'Play', continue: 'Continue', resumeGame: 'Resume game',
    dailyChallenge: 'Daily challenge', dailyDone: "Today's challenge solved", dailyStreak: 'Streak {n}',
    bossIntro: 'Beat the boss to open the next region',
    easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert',

    notes: 'Notes', erase: 'Erase', hint: 'Hint', undo: 'Undo',
    pause: 'Pause', resume: 'Resume', paused: 'Paused',
    share: 'Share', shareText: 'I challenge you to solve this Sudoku',
    restart: 'Restart',
    time: 'Time', mistakes: 'Mistakes', best: 'Best', hintsLeft: 'Hints',
    noHints: 'No hints — share a level to earn', noUndo: 'Nothing to undo',
    tips: 'Hints', sharedPuzzle: 'Shared puzzle', custom: 'Puzzle',

    win: 'Solved!', bossWin: 'Boss defeated!',
    levelComplete: 'Level complete', yourTime: 'Your time', difficulty: 'Difficulty',
    newRecord: 'New record!', starsEarned: 'Stars',
    nextLevel: 'Next level', backToMap: 'Back to map', playAgain: 'Play again',
    regionUnlocked: 'Region {r} unlocked!',

    shareToEarn: 'Share this level and earn 1 hint',
    shareReward: '+1 hint for sharing!',
    shareAlready: "You already got this level's hint",
    challengeFriend: 'Challenge a friend',
    getMoreTips: 'Share to earn hints',

    stats: 'Statistics', solved: 'Solved', totalStars: 'Total stars',
    close: 'Close', cancel: 'Cancel',
    confirmNewTitle: 'Leave the game?',
    confirmNewBody: 'You have a game in progress; leaving saves it so you can resume.',
    linkCopied: 'Link copied!',
    badLink: "That link isn't a valid Sudoku.",
    multiSolution: 'This puzzle has multiple solutions; only rule errors are flagged.',
  },
};

const LS_LANG = 'sudoku.lang';
let lang = (() => {
  try { const s = localStorage.getItem(LS_LANG); if (s === 'es' || s === 'en') return s; } catch {}
  return (navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es';
})();

export function getLang() { return lang; }
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'es';
  try { localStorage.setItem(LS_LANG, lang); } catch {}
  try { document.documentElement.lang = lang; } catch {}
}

export function t(key, params) {
  let s = (DICT[lang] && DICT[lang][key]) ?? DICT.es[key] ?? key;
  if (params) for (const k in params) s = s.replaceAll('{' + k + '}', params[k]);
  return s;
}
