# Sudoku — CloserClick

Sudoku del ecosistema **[CloserClick](https://closer.click/)**: *tu información, en
tu servidor, bajo tus reglas*. PWA instalable, **funciona sin conexión** y **sin
trackers de terceros**.

🔗 **https://sudoku.closer.click/**

## Qué tiene

- **Generador propio determinista** con **solución única** garantizada (backtracking
  con bitmasks + verificación de unicidad). El mismo nivel es el mismo reto para
  todos y se puede compartir por enlace.
- **Aventura con mapa de niveles**: caminos que **se bifurcan** y convergen en
  **jefes**, niveles que se **desbloquean con estrellas** (1–3 por nivel según tu
  rendimiento). Cuatro regiones: Fácil → Medio → Difícil → Experto.
- **Reto diario** determinista (el mismo para todo el mundo) con **racha**.
- **Pistas consumibles**: gánalas **compartiendo** un nivel (reta a un amigo y te
  llevas una pista) y gástalas cuando te atasques.
- Juego completo: **notas a lápiz**, **borrar**, **deshacer**, detección de
  **conflictos**, resaltado de fila/columna/caja y del mismo número, contador del
  teclado, **cronómetro** y pausa. Soporte de **teclado** (números, flechas, etc.).
- **Bilingüe es/en**, tema oscuro, responsive y amigable con el táctil.

## Privacidad

El SEO describe **la herramienta**, nunca tu contenido. Tus partidas, tiempos y
estrellas viven en tu **[store.closer.click](https://store.closer.click/)** (vault
del ecosistema); los puzzles compartidos viajan por **`#fragment`**, que no llega
al servidor ni es indexable. Analítica: **GoatCounter cookieless** autohospedado,
solo en producción.

## Stack

Vite (sin framework) + paquetes del ecosistema:
[`closer-click-store`](https://github.com/closerclick/closer-click-store),
[`closer-click-share`](https://github.com/closerclick/closer-click-share),
[`closer-click-install`](https://github.com/closerclick/closer-click-install),
[`closer-click-nav`](https://github.com/closerclick/closer-click-nav) y el Web
Component de soporte `closer-click-support`.

```bash
npm install
npm run dev      # desarrollo
npm run build    # build a dist/
```

Despliegue: **GitHub Pages** vía GitHub Actions (`.github/workflows/deploy.yml`).

## Apoya al proyecto

Ko-fi: <https://ko-fi.com/closerclick> · Discord: <https://discord.gg/D648uq7cth>

---

Parte del ecosistema **CloserClick** — apps cliente autohosteadas que comparten
identidad, transporte y almacenamiento. Hecho con software libre.
