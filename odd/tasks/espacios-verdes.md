# Espacios verdes: plazas que cuestan y se descuidan

Las plazas hoy son baratísimas ($2 por celda) y regalan valor de suelo desde la primera celda
(+14 en radio 4, apilable hasta el tope de +30). Se les pone precio, tamaño mínimo y descuido.

## Specs

- **S1 Pedido (verbatim).** "si no me equivoco incluso una sola plaza (1x1) ya mejora los
  alrededores, o no? Lo que se me habia ocurrido es que para que mejore los alrededores tenga que
  ser minimo de 2x2 o 1x3 (se pueden colocar de 1x1 pero no mejora nada). Después que se exponencial,
  una plaza chica no sube tanto el valor como una grande, pero para evitar exploitearlo tenia
  pensado agregar un nuevo presupuesto a "Espacios verdes" para las plazas... Si una plaza no es
  mantenida esta se vuelven "descuidadas"... si no estan cuidadas las plazas estas se descuidan y
  hacen que pierda valor lo aledaño."
- **S2 Confirmado en el código.** Hoy **sí**: una sola celda de plaza ya mejora el valor
  (`computeLandValue` hace `splat(amenities, …, 4, 14)` por cada celda `TILE.PARK`, y el total se
  capea en +30). El mantenimiento era plano: `UPKEEP.park = 2` por celda, sin presupuesto.
- **S3 Tamaño mínimo.** Una plaza solo aporta si su mancha tiene **3 celdas o más** (2×2 = 4 ✓,
  1×3 = 3 ✓, 1×1 y 1×2 ✗). Las chicas se pueden plantar y cuestan mantenimiento, pero no dan nada.
- **S4 Más grande, más vale.** El radio del aporte crece con la mancha (`3 + log2(área)`, tope 8) y
  la fuerza por celda también (`0,4 + log2(área+1)/2`, tope 2,5). El tope global de +30 sigue
  vigente, así que lo que gana una plaza grande es sobre todo **cobertura**.
- **S5 Presupuesto "Espacios verdes".** Nuevo `SimState.green` (0 a 120 %, arranca en 100), con su
  fila en el Presupuesto. El gasto pasa a ser `celdas × UPKEEP.park × green/100`, con `UPKEEP.park`
  de 2 a 5.
- **S6 Descuido.** `care = green` (0 a 100). El aporte se escala por `mood = (care - 50) / 50`:
  con el presupuesto al 100 % da lo de siempre; al 50 % no da nada; por debajo resta como el
  abandono de los edificios (hasta 8 de penalidad en radio, contra los 30 de tope que ya tiene el
  blight). El efecto es continuo, sin escalón.
- **S7 Se ve.** Una plaza descuidada (care < 50) pinta el suelo seco y pierde los árboles de su
  sprite. El reporte de la celda dice el tamaño de la mancha, el cuidado y si está descuidada. El
  diario avisa cuando el presupuesto verde cruza el 50 % para abajo y cuando vuelve.
- **S8 Guardado.** Formato 11. Un guardado viejo abre con `green = 100` (las plazas están cuidadas)
  y no cambia ningún otro campo.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Manchas de plaza y aporte por tamaño | S3, S4 | `src/sim/fields.ts` (`computeParks`, `splatPark`), `src/world/world.ts` (`parkArea`, `parkCare`), `src/config.ts` (`PARK`) | hecho | 1×1 y 1×2 dan 0; 1×3 da +14 en el centro y 2×2 +21; `tests/espacios-verdes.test.ts` (17) y `tests/sim.test.ts` |
| T2 Presupuesto verde en estado, caja y guardado | S5, S8 | `src/sim/simulation.ts` (`state.green`, `setGreen`), `src/sim/budget.ts` (sexto argumento), `src/save/save.ts` (formato 11) | hecho | 9 celdas al 100 % = $45, al 50 % = $23, al 0 % = $0; un guardado sin `green` abre con 100; al 400 % lo rechaza |
| T3 Descuido y penalidad | S6 | `src/sim/fields.ts` (`splatPark` con `mood`) | hecho | al 50 % no aporta, al 25 % resta, al 0 % resta más; nunca pasa el tope de 30 |
| T4 Se ve: suelo seco, reporte y diario | S7 | `src/render/mapRenderer.ts` (`drawPark` seco, `objectAt` sin árboles), `src/render/color.ts` (`parkDry`), `src/render/sprites.ts` (`ParkLook`), `src/sim/report.ts`, `src/sim/news.ts`, `src/world/tools.ts` (ayuda del pincel) | hecho | captura 22 (3 estados) y 25 (en juego, al 0 %); el reporte dice mancha, cuidado y "descuidada"; el diario avisa al cruzar el 50 % |
| T5 Presupuesto en pantalla | S5 | `src/ui/panels.ts` (sección "Espacios verdes" + slider `data-green`) | hecho | captura 24: fila "Plazas 100 %" y renglón "Espacios verdes $45" en el balance |
| T6 Balance con el probe | S1 | `npm run probe` | hecho | año 15: 5.490 habitantes con plazas 2×2 (antes 8.508 con plazas de una celda): la plaza dejó de ser barata y sigue habiendo ciudad |

Runner: `npm test` (Vitest), `npx tsc --noEmit`, `npm run build`, `npm run probe`.

## Log

- **L1 (2026-11-13), lo que dice el código hoy.** Cada celda de plaza aporta
  `splat(amenities, x, y, radius 4, strength 14)` y el valor final suma `min(30, amenities)`, así que
  cuatro celdas ya saturan el tope: **el tamaño hoy no cambia casi nada**, y el costo es $2/celda.
  De ahí que se sientan "demasiado buenas".
- **L2, la forma del cambio.** El "exponencial" que pide el jugador no se logra multiplicando la
  fuerza (el tope de +30 lo corta enseguida) sino con **cobertura**: radio que crece con la mancha.
  Se suma un factor de fuerza suave (logarítmico) para que las celdas cercanas valgan más.
- **L3, el número base del aporte bajó a 4.** Con `PARK.value = 10` la mancha mínima (1×3) ya daba
  +36 en el centro y el tope de +30 se saturaba con tres celdas: la escalera por tamaño no se veía.
  Con 4, medido en un mapa plano de 64 × 64 con el presupuesto al 100 %:

  | plaza | celdas | $/mes | celdas con +5 o más | bonus total |
  |-------|--------|-------|---------------------|-------------|
  | 1×3 | 3 | 15 | 49 | 516 |
  | 2×2 | 4 | 20 | 100 | 1.144 |
  | 3×3 | 9 | 45 | 169 | 3.834 |
  | 4×4 | 16 | 80 | 256 | 6.728 |
  | 6×6 | 36 | 180 | 456 | 11.198 |
  | 10×10 | 100 | 500 | 648 | 17.100 |

  Lo barato por peso está en 3×3–4×4 (85 y 84 por peso) y las plazas gigantes rinden menos por peso
  (34), que es justo lo que evita el exploit: agrandar deja de convenir en algún punto.
- **L4 (2026-11-13), el snowball que no apareció.** Probe con el presupuesto verde al 0 % del año 6
  al 10 y de vuelta al 100 %: la ciudad baja de 5.236 a 5.188 y vuelve a 5.352, sin tocar caja ni
  aprobación. El descuido baja el valor del suelo pero no dispara una espiral: los topes de nivel
  dependen también de servicios y tránsito.
- **L5, el suelo seco no se repintaba.** `view.invalidateLayer()` solo rehace la capa de datos: al
  mover el slider los árboles desaparecían (eso lo decide `objectAt`, que se redibuja) pero el suelo
  seguía verde, porque los chunks del mapa base no se invalidaban. Ahora el panel junta las celdas
  `TILE.PARK` y llama a `map.update(esas celdas)`.
- **L6, lo que quedó afuera.** El árbol de una plaza no desaparece cuando la mancha es chica (solo
  cuando está descuidada): una celda suelta se ve como una plaza con su árbol y su banco, y recién
  el reporte y el valor dicen que no aporta nada.
