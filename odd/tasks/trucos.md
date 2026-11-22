# Trucos de la versión local

Atajos para probar sin jugar una partida entera. **Sólo existen en la versión local**: el build publicado no los
lleva ni como código muerto.

## Specs

- **S1** — Shift + 1..5 corre un truco, pero sólo si `import.meta.env.DEV`. En el build de producción no se
  instala el oyente y el módulo no entra al bundle (verificado: 0 apariciones de `Truco:` en `dist`).
  Criterio: `npm run build` y `grep -c "Truco:" dist/assets/*.js` da 0.
- **S2** — Los trucos tocan el mundo que el juego ya usa, no una cifra paralela. La población no es un número
  guardado: sale de los edificios, así que +vecinos hace crecer los edificios de verdad. Criterio: después del
  truco, `world.level` subió en algún lote y `sim.totals.pop` lo refleja.
- **S3** — Shift + 2 suma alrededor de mil y no se lleva la ciudad por delante; se corta al llegar, contando con
  `cityTotals` —la misma función que usa el juego— después de cada lote. Medido en una ciudad de 4.256: +1.017.
- **S4** — Shift + 4 borra `anger`, `troubleMonths`, `abandoned` y `state.grief`, y refresca. Medido: 202 lotes
  enojados → 0.
- **S5** — El aviso dice lo que pasó, con el número real (`Truco: +1.017 vecinos`), no lo que el truco pretendía.
- **S6** — Escribiendo en un campo (el nombre del intendente, la ciudad) Shift + número es un número. Criterio:
  el oyente ignora `INPUT`, `TEXTAREA`, `SELECT` y `contentEditable`.
- **S7** — Al cambiar de partida se desengancha el oyente anterior; si no, un atajo correría dos veces.

## Tasks

- **T1** — `src/ui/cheats.ts`: `giveCash`, `raisePopulation`, `maxApproval`, `clearGripes`, `maxServices`,
  `CHEATS`, `installCheats`, `cheatsHelp`. Commit `pendiente`.
- **T2** — `src/main.ts`: instalación dentro de `import.meta.env.DEV` con `import()` dinámico, y
  `killCheats` al lanzar una partida. Commit `pendiente`.
- **T3** — `tests/trucos.test.ts`: 8 casos sobre el efecto observable. Commit `pendiente`.

## Log

**L1** — Pedido del usuario: «me podés poner como "trucos" pero en la versión SOLO local? por ejemplo que funcione
con Shift + un número y que sean tipo +100k de plata, +1000 habitantes, + aprobación, eliminar quejas y así? para
ir probando».

**L2** — La aprobación y la población no son números guardados: `computeApproval` y `cityTotals` los derivan del
mundo. Un truco que escribiera `#approval = 100` mentiría y el mes siguiente lo pisaría. Se implementaron sobre
las causas: hacer crecer los lotes de verdad y poner los presupuestos al mango.

**L3** — Primera versión de `raisePopulation` subía un nivel a todos los lotes residenciales de una: +8.615
vecinos. Se cambió a lote por lote cortando en el objetivo.

**L4** — El import estático dejaba el módulo en el bundle de producción aunque la llamada estuviera dentro de
`if (DEV)`. Se pasó a `import()` dinámico dentro de la rama: Vite la borra y el módulo no se genera. Verificado
con el build.
