# Colectivos: alivio global con techo poblacional

## Specs

- S1 (verbatim): «primero que no tengan mas rango de cuanto alivian sinó que directamente hagan un alivio de transito general»
- S2 (verbatim): «Para limitar esto tienen que ir en base a población, ya que no tiene sentido tener mil habitantes y 10 lineas de colectivo»
- S3: fórmula acordada con el usuario — `alivio = min(capacidad física, techo poblacional)` con `capacidad física = líneas × BUS.trips × presupuesto%` y `techo poblacional = commuters × BUS.share (0.35)`; el alivio se reparte proporcional a la carga de todas las calles de la ciudad.
- S4: el rombo (`busArea`, halo de colocación) y los textos que mencionan el radio desaparecen; los colectivos dibujados siguen vagando cerca de la cochera (visual, sin cambio).

Criterios de aceptación:

- Un depósito con calle alivia calles en toda la ciudad, incluida la esquina opuesta.
- Con 1280 vecinos (commuterTown), una o diez líneas alivian como mucho `1280 × 0.35 = 448` viajeros.
- Dos líneas alivian el doble que una (sin techo activo); presupuesto escala el alivio; 0 % no alivia nada.
- Depósito sin calle cerca: `taken = 0`, `idle = BUS.trips × factor` (comportamiento previo intacto).
- Los tests que describían el rombo se reescriben al nuevo modelo, no se borran sin reemplazo.

## Tasks

- B1 — `applyTransit` global + techo poblacional: `src/sim/transit.ts`, `src/sim/congestion.ts` (pasa `trips`), `src/config.ts` (`BUS.share`), tests en `tests/colectivos-global.test.ts` (4) + reescrituras en `tests/transporte.test.ts`. Commit: pendiente.
- B2 — quitar `busArea`, halo de colocación y textos de radio: `src/world/transport.ts`, `src/game.ts`, `src/sim/outlook.ts`, `src/sim/report.ts`, tests actualizados. Commit: pendiente.

Verificación: `npx tsc --noEmit` limpio; suite 1470 tests / 102 archivos en verde; app carga sin errores de consola (vite :5273).

## Log

- L1 (verbatim): «Me gustaria modificar los colectivos, primero que no tengan mas rango de cuanto alivian sinó que directamente hagan un alivio de transito general. Para limitar esto tienen que ir en base a población, ya que no tiene sentido tener mil habitantes y 10 lineas de colectivo, que milestones propones? un valor fijo o en %? o como lo harias? con algun calculo'»
- L2: el usuario eligió la fórmula propuesta (techo 35 % de los viajeros) con «Me parece bien». Sin hitos fijos: la fórmula es continua y se autoregula.
