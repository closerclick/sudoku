import { test, expect } from '@playwright/test'

// Marca el tutorial como visto (storage `${key}:seen:${id}`) y fija idioma, para
// que ninguna burbuja intercepte los clics. Arranca limpio en cada test.
async function open(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sudoku.lang', 'es')
      for (const id of ['stars', 'pick', 'play', 'notes', 'hint', 'share']) {
        localStorage.setItem('sudoku.tutorial:seen:' + id, '1')
      }
    } catch {}
  })
  await page.goto('/')
  await page.waitForFunction(() => !!window.__sudoku)
}

// Arranca un nivel concreto y devuelve el estado; espera a que el tablero exista.
async function startLevel(page, id = 'n0') {
  await page.evaluate((nid) => { window.__sudoku.renderMap(); window.__sudoku.startNode(nid) }, id)
  await expect(page.locator('[data-testid="board"]')).toBeVisible()
}

const cells = (page) => page.evaluate(() => window.__sudoku.getGame().cells.slice())
const emptyEditable = (page) => page.evaluate(() => {
  const g = window.__sudoku.getGame(); const out = []
  for (let i = 0; i < 81; i++) if (!g.given[i] && !g.cells[i]) out.push(i)
  return out
})

test('número primero: coloca el dígito en la mano al tocar casillas', async ({ page }) => {
  await open(page); await startLevel(page)
  const [a, b] = await emptyEditable(page)
  await page.locator('[data-testid="num-3"]').click()
  // el botón del dígito queda resaltado (en la mano)
  await expect(page.locator('.pad-btn[data-n="3"]')).toHaveClass(/active/)
  await page.locator(`[data-testid="cell-${a}"]`).click()
  await page.locator(`[data-testid="cell-${b}"]`).click()
  const c = await cells(page)
  expect(c[a]).toBe(3)
  expect(c[b]).toBe(3)
})

test('CAMBIAR de número NO pisa las casillas ya puestas', async ({ page }) => {
  await open(page); await startLevel(page)
  const [a, b, d] = await emptyEditable(page)
  await page.locator('[data-testid="num-3"]').click()
  await page.locator(`[data-testid="cell-${a}"]`).click()
  await page.locator(`[data-testid="cell-${b}"]`).click()
  // cambio de número: NO debe alterar a ni b
  await page.locator('[data-testid="num-5"]').click()
  let c = await cells(page)
  expect(c[a]).toBe(3)
  expect(c[b]).toBe(3)
  // colocar el nuevo número en otra casilla vacía sí funciona
  await page.locator(`[data-testid="cell-${d}"]`).click()
  c = await cells(page)
  expect(c[d]).toBe(5)
  expect(c[a]).toBe(3)
  expect(c[b]).toBe(3)
})

test('tocar una casilla: mismo número borra, otro cambia', async ({ page }) => {
  await open(page); await startLevel(page)
  const [a] = await emptyEditable(page)
  await page.locator('[data-testid="num-4"]').click()
  await page.locator(`[data-testid="cell-${a}"]`).click()
  expect((await cells(page))[a]).toBe(4)
  // otro número → cambia
  await page.locator('[data-testid="num-7"]').click()
  await page.locator(`[data-testid="cell-${a}"]`).click()
  expect((await cells(page))[a]).toBe(7)
  // mismo número → borra
  await page.locator(`[data-testid="cell-${a}"]`).click()
  expect((await cells(page))[a]).toBe(0)
})

test('la goma es un toggle: borra al tocar', async ({ page }) => {
  await open(page); await startLevel(page)
  const [a] = await emptyEditable(page)
  await page.locator('[data-testid="num-6"]').click()
  await page.locator(`[data-testid="cell-${a}"]`).click()
  expect((await cells(page))[a]).toBe(6)
  await page.locator('[data-testid="tool-erase"]').click()
  await expect(page.locator('[data-testid="tool-erase"]')).toHaveClass(/active/)
  await page.locator(`[data-testid="cell-${a}"]`).click()
  expect((await cells(page))[a]).toBe(0)
})

test('notas: candidato imposible se marca en rojo', async ({ page }) => {
  await open(page); await startLevel(page)
  // busca una casilla vacía donde el 5 sea ilegal (un par ya tiene 5)
  const target = await page.evaluate(() => {
    const g = window.__sudoku.getGame()
    const peers = (i) => { const r = (i / 9) | 0, c = i % 9, b = ((r / 3) | 0) * 3 + ((c / 3) | 0); const s = []; for (let k = 0; k < 81; k++) { if (k === i) continue; const rr = (k / 9) | 0, cc = k % 9, bb = ((rr / 3) | 0) * 3 + ((cc / 3) | 0); if (rr === r || cc === c || bb === b) s.push(k) } return s }
    for (let i = 0; i < 81; i++) { if (g.given[i] || g.cells[i]) continue; if (peers(i).some(p => g.cells[p] === 5)) return i }
    return -1
  })
  test.skip(target < 0, 'no hay casilla con 5 ilegal en este puzzle')
  await page.locator('[data-testid="tool-notes"]').click()
  await page.locator('[data-testid="num-5"]').click()
  await page.locator(`[data-testid="cell-${target}"]`).click()
  const note = page.locator(`[data-testid="cell-${target}"] .notes`).locator('.note').nth(4) // dígito 5
  await expect(note).toHaveText('5')
  await expect(note).toHaveClass(/bad/)
})

test('notas: cambiar de número NO toca las notas ya puestas', async ({ page }) => {
  await open(page); await startLevel(page)
  const [a, b] = await emptyEditable(page)
  const note = (i, n) => page.locator(`[data-testid="cell-${i}"] .notes`).locator('.note').nth(n - 1)
  await page.locator('[data-testid="tool-notes"]').click()
  await page.locator('[data-testid="num-3"]').click()
  await page.locator(`[data-testid="cell-${a}"]`).click()           // nota 3 en a
  await expect(note(a, 3)).toHaveText('3')
  // cambiar de número NO debe alterar las notas de a
  await page.locator('[data-testid="num-5"]').click()
  await expect(note(a, 3)).toHaveText('3')
  await expect(note(a, 5)).toHaveText('')
  // anotar en otra casilla funciona; a sigue intacta
  await page.locator(`[data-testid="cell-${b}"]`).click()
  await expect(note(b, 5)).toHaveText('5')
  await expect(note(a, 3)).toHaveText('3')
  await expect(note(a, 5)).toHaveText('')
})

test('persistencia por nivel: salir y volver mantiene lo puesto', async ({ page }) => {
  // n0 está siempre desbloqueado (en un contexto de test el progreso arranca vacío).
  await open(page); await startLevel(page, 'n0')
  const [a] = await emptyEditable(page)
  await page.locator('[data-testid="num-2"]').click()
  await page.locator(`[data-testid="cell-${a}"]`).click()
  expect((await cells(page))[a]).toBe(2)
  // volver al mapa y reentrar al MISMO nivel
  await page.evaluate(() => window.__sudoku.renderMap())
  await expect(page.locator('[data-testid="map"]')).toBeVisible()
  await page.evaluate(() => window.__sudoku.startNode('n0'))
  await expect(page.locator('[data-testid="board"]')).toBeVisible()
  expect((await cells(page))[a]).toBe(2)
})
