# El tendido de madera y el de hormigón

El poste de hormigón del pase de píxel deja de ser *el* poste y pasa a ser la **mejora** del tendido:
vuelve el de madera como tendido base y el de hormigón es el que llega más lejos. La diferencia no es
decorativa: el de madera alumbra 3 lotes, el de hormigón alumbra **5**, y como el alcance es también el
paso entre postes, el tendido mejor usa menos postes para el mismo recorrido.

## Specs

- **S1 — Dos calidades de tendido.** `LINE_TIERS` guarda las dos, en el orden en que se construyen:
  madera (alcance 3, $5, $0,30/mes) y hormigón (alcance 5, $18, $1/mes). El índice es lo que se
  guarda en `World.lineTier`, celda por celda, como la calidad de las calles.
  Aceptación: un poste de madera y uno de hormigón a la misma distancia de una casa sin luz dan
  resultados distintos — el de hormigón la alcanza a 5 lotes y el de madera no.
- **S2 — El alcance es el del poste.** La luz de una celda de tendido usa el disco de **su** calidad
  (`lineReach(tier)`), y el paso entre postes de una tirada usa el alcance de lo que se está
  construyendo.
  Aceptación: arrastrar el tendido de hormigón 10 lotes deja menos postes que el de madera sobre el
  mismo recorrido, y cada poste alumbra 5 lotes a la redonda.
- **S3 — Se mejora en el lugar pagando la diferencia.** Arrastrar hormigón sobre un tendido de madera
  lo mejora sin levantar postes nuevos y cobra `costo_hormigón − costo_madera`; arrastrar madera sobre
  hormigón no hace nada (no se degrada). Igual que las calles.
  Aceptación: el plan de mejora trae las celdas de la línea existente (no las vacías de alrededor), el
  costo es la diferencia y después de aplicarlo `lineTier` quedó en 1 sin cambiar el tile.
- **S4 — El poste de madera vuelve, en píxel.** La calidad base se dibuja con el mismo lenguaje que el
  resto del pase: poste de madera torcido y más bajo, cruceta de madera, aisladores, y variantes (con
  transformador rural, con rienda). El de hormigón queda como está, con sus tres variantes.
  Aceptación: `polePixelSprite(0, v)` y `polePixelSprite(1, v)` son dibujos distintos y ambos de píxel
  duro; el punto de enganche lo publica cada calidad, y un tramo mixto cuelga el cable a la altura del
  poste que corresponde en cada punta.
- **S5 — Nada se rompe.** Sin `lineTier` en el guardado (partidas viejas) todo el tendido es de madera
  y el formato sube a 21. `?pixel=off` sigue devolviendo el poste de canvas y el trazo suave.

## Tasks

| ID | Tarea | Specs | Archivos | Estado |
|---|---|---|---|---|
| T1 | `LINE_TIERS`, `lineReach`, `lineRank` y los costos derivados | S1 | `src/config.ts` | hecho |
| T2 | `World.lineTier` y el guardado 21 | S1, S5 | `src/world/world.ts`, `src/save/save.ts` | hecho |
| T3 | La herramienta nueva, la mejora en el lugar y los textos | S1, S3 | `src/world/tools.ts`, `src/ui/toolbar.ts`, `src/sim/outlook.ts`, `src/sim/report.ts`, `src/sim/milestones.ts` | hecho |
| T4 | La luz por calidad, en el simulador | S2 | `src/sim/power.ts` | hecho |
| T5 | El poste de madera en píxel y el enganche por calidad | S4 | `src/render/pixelArt.ts`, `src/render/mapRenderer.ts`, `src/render/wire.ts` | hecho |
| T6 | Tablero: los dos postes y un tramo de cada uno | S4 | `scripts/arte-board.ts`, `scripts/board-city.ts` | hecho |
| T7 | Tests de la mejora, del alcance y del dibujo | S1–S5 | `tests/tendido.test.ts`, `tests/arte-pixel.test.ts` | hecho |

## Log

- **L1.** Pedido del usuario, verbatim: *"Me gusta tu tendido electrico, pero tambien me gusta el de
  madera, este que hicistes podria ser una mejora que llegue mas lejos? y devolvemos el de madera
  anterior. Este podria llegar a 5 bloques"*.
- **L2.** Se toma el mismo camino que las calles, que ya tienen cuatro calidades en una celda
  (`ROAD_TIERS` + `World.roadTier` + mejora en el lugar pagando la diferencia): una segunda calidad de
  tendido, no un segundo tipo de celda. El alcance se lee de la calidad, no de la constante.
- **L3.** El poste de madera vuelve dibujado en píxel y no como el sprite de canvas: el pase entero está
  en el mismo lenguaje y mezclar un poste de canvas entre edificios de píxel se vería como un error.
  Lo que vuelve es la **silueta** del de madera (poste bajo, torcido, cruceta de madera), que es lo que
  al usuario le gustaba.
- **L4.** El de madera es el índice 0 y el de hormigón el 1, como las calles: `roadTier`/`lineTier` se
  guardan igual y la mejora en el lugar es el mismo mecanismo (`planTool` empuja la celda con la
  diferencia de precio). Recorrer el tendido de hormigón sobre uno de madera **mejora los postes y no
  planta ninguno nuevo**: la celda del poste cuenta como referencia de paso, así que las nueve celdas
  del arrastre no se convierten en tres postes agregados en los huecos.
- **L5.** Un arrastre de madera sobre hormigón no degrada nada (la línea no se tira para abajo) pero sí
  puede plantar postes de madera en los huecos de cinco lotes que deja la de hormigón: pediste una línea
  de madera por ahí y eso es lo que se hace. El test lo fija así para que nadie lo "arregle" a un no-op.
- **L6.** El `reach` se lee de la calidad en los tres lugares donde antes estaba la constante `LINE_REACH`:
  el disco de luz (`power.ts`), el paso entre postes (`tools.ts`) y el tramo que cuelga un cable
  (`wire.ts`). `LINE_REACH` sigue existiendo como el alcance de la madera, para los textos y los tests
  viejos, pero ya nadie lo usa para decidir.
- **L7.** Cada punta del cable cuelga de la altura de **su** poste: el punto de enganche lo publica el
  pintor (`POLE_ATTACH`, que se calcula llamando a los dos pintores una vez, no a mano) y el renderer lo
  consulta para el extremo lejano. Un tramo mixto queda escalonado, como en la realidad. Un test
  verifica que lo publicado coincida con lo dibujado en las tres variantes de las dos calidades.
- **L8.** El poste de madera salió mal dos veces: primero partido en dos porque el tramo de arriba y el
  de abajo se tocaban en una arista y el escalón de 1 px se leía como dos piezas; después con la rienda
  como una segunda pata paralela porque a 1× cualquier viento de retenida que llegue al piso es casi
  vertical. Queda poste derecho de 2 px, cruceta ancha con dos tornapuntas, insuladores de cerámica,
  pie más ancho y el shadow de siempre; las variantes son transformador rural y tresbolillo (segunda
  cruceta corta y corrida), no la rienda.
- **L9.** Evidencia: `npx vitest run tests/tendido.test.ts` (15) · `npx vitest run` (**1096 / 63
  archivos**) · `npx tsc --noEmit` limpio · `npm run arte` (172 kB) con las seis variantes de poste y la
  ciudad con un tramo de cada calidad · capturas con `?pixel=todo` y `?pixel=off`, donde el pase apagado
  vuelve al poste de canvas y al trazo suave de siempre.
