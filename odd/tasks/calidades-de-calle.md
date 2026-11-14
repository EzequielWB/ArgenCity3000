# Calidades de calle (asfalto, pavimento reforzado, bulevar)

Hoy hay un solo tipo de calle (`TILE.ROAD`) y el ancho de la avenida sale de pegar calles. Esta
feature le agrega una segunda dimensión: cada celda de calle tiene una calidad, se elige al
trazarla y se puede mejorar en el lugar pagando la diferencia.

## Specs

### S1 — Las tres calidades se eligen de una

> "me gustaria que uno pueda elegir cualquiera de las 3 versiones de una"

- Tres herramientas de calle en la barra, una por calidad, disponibles desde el primer minuto:
  **Asfalto** (`3`), **Pavimento reforzado** (`r`), **Bulevar** (`b`).
- Cada una construye su calidad directamente: no hay escalera obligatoria ni desbloqueo.
- Una calle nueva es de la calidad de la herramienta con la que se trazó.

### S2 — Construir sobre una calle la mejora

> "sinó al elegir por ejemplo la 3 y colocarlo encima de la 1, se mejora a 3"

- Arrastrar una herramienta de calle sobre una celda que ya es calle la **mejora en el lugar** si
  la calidad nueva es mayor, y cobra **solo la diferencia** entre las dos calidades.
- Misma calidad o menor: no cambia nada y no se cobra nada.
- No hay degradado ni devolución: para bajar se demuele y se vuelve a trazar.
- La mejora conserva todo lo demás: acceso a calle, luz, tránsito, el flag de calle heredada de
  los mapas reales y el terreno. No demuele ni crea lotes libres.

### S3 — El bulevar: cantero de pasto y farolas, sin valor del suelo

> "el bulevar con farolas la verdad que no se nota mucho y no se entiende el bulevar, podrias hacer que la linea del medio sea 3 de ancho? con distintos tonos de verde para notar el pasto, y sacá el nombre "con farolas", y que deje de subir el precio de la tierra alrededor"

- Se llama **Bulevar**, sin "con farolas", en la barra, la ayuda y los documentos.
- El bulevar se dibuja con un **cantero de cemento de un píxel** en el medio del camino, y **no
  crece con el ancho**: en una avenida de ancho par va sobre el límite entre las dos manos, en una
  de ancho impar por el medio del carril central, y en una calle de una sola celda por el medio de
  la celda (siguiendo el trazado). Es la única marca del bulevar además de las farolas.
- El bulevar **ya no sube el valor del suelo**. Lo único que sigue dando aparte de capacidad son sus
  farolas, que restan delito a 2 celdas o menos (con tope).
- Aceptación: con el resto de la ciudad igual, un barrio con bulevar tiene menos delito y **el mismo
  valor del suelo** que el mismo barrio con asfalto.

### S4 — Capacidad: 1,0 / 1,6 / 1,8 y manda el eslabón más débil

> "Subiria la capacidad del bulevar a x1,8"

- Multiplicador de capacidad por celda: asfalto ×1, pavimento reforzado ×1,6, bulevar ×1,8.
- Una banda (avenida) usa **la calidad más baja de sus celdas**. La misma regla vale para el
  dibujo y para la congestión: si el jugador ve una banda de asfalto, se comporta como asfalto.
- Aceptación: una banda de 2 con una celda de bulevar y una de asfalto carga como 2 carriles de
  asfalto; una banda de 2 bulevares carga como 2 × 1,8.

### S5 — Números

| Calidad | Construir | Mantenimiento | Capacidad |
|---|---|---|---|
| Asfalto | $10 | $1 | ×1,0 |
| Pavimento reforzado | $30 | $3 | ×1,6 |
| Bulevar | $75 | $8 | ×1,8 |

> "el coste a 75"

- La mejora cobra `cost(nuevo) - cost(actual)`.
- Los puentes conservan su recargo: una calle nueva sobre agua cuesta `COSTS.bridge` más el
  adicional de la calidad por encima del asfalto (`bridge + tier - asfalto`), así el puente de
  asfalto sigue costando exactamente $60 como hoy. El mantenimiento de puente recibe el mismo
  trato sobre `UPKEEP.bridge`.

### S6 — Guardado formato 9

- Nuevo arreglo `roadTier` (un byte por celda, 0 = asfalto, 1 = reforzado, 2 = bulevar).
- Las partidas de las versiones 1 a 8 abren con todas las calles en asfalto.
- Se rechaza una partida cuya `roadTier` no mida `n × n`, tenga valores fuera de 0 a 2, o marque
  calidad distinta de asfalto en una celda que no es calle.

### S7 — La ruta provincial no cambia

- La ruta sigue intocable: ninguna herramienta de calle la mejora, la demuele ni la reemplaza, y
  el cartel dice por qué.
- Se dibuja con la calidad de pavimento reforzado y no paga construcción ni mantenimiento.

### S8 — Se ven distintas

- Asfalto: como hoy.
- Pavimento reforzado: asfalto más oscuro y líneas más marcadas.
- Pavimento reforzado: el medio del camino se marca con **lucecitas amarillas punteadas** (trazo de
  un píxel con huecos), como los topes de algunas avenidas, en vez de la línea crema del asfalto.
  La regla es `centreMark(tier)` (`src/render/avenue.ts`), pura y probada.
- Bulevar: cantero de cemento de un píxel en el medio del camino, a cualquier ancho, y farolas cada
  pocas celdas. La regla es `boulevardMedian(lanes, lane)` (`src/render/avenue.ts`), pura y probada:
  `'boundary'` en el límite entre las dos manos (ancho par), `'through'` por el medio de la celda
  (ancho impar y calle de una celda), `'none'` en el resto.
- El minimapa distingue las calidades.
- Aceptación: en una captura con las tres calidades en el mapa, se distinguen sin leyenda.

### S9 — La calidad se lee en la interfaz

- La ficha de Consulta de una celda de calle dice de qué calidad es.
- El presupuesto cobra cada calle según su calidad, en la misma línea "Calles y puentes" que ya
existe: no se agregan líneas nuevas al presupuesto guardado. (Spec ajustado en L7: separar la
línea obligaba a cambiar el formato del presupuesto en el guardado sin que el jugador gane nada.)

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|----|-------|------|--------|-----------|
| T1 Mundo y guardado: `roadTier`, formato 9, validación | S6 | `src/world/world.ts`, `src/save/save.ts`, `tests/roadtier.test.ts` | hecho | RED visto (7 tests del archivo nuevo sin `roadTier`); 7 tests verdes; `save.test.ts` sigue verde |
| T2 Herramientas: tres calidades, costos, mejora en el lugar, ruta | S1, S2, S5, S7 | `src/config.ts`, `src/world/tools.ts`, `src/game.ts`, `src/ui/toolbar.ts` | hecho | RED visto; 7 tests de construcción/mejora; `toolgroups`, `outlook`, `coast` (la tecla `b` estaba tomada por el tamaño de bloque: el bulevar usa `t`) y `route` (versión 9) actualizados |
| T3 Congestión: multiplicador y eslabón más débil | S4 | `src/sim/congestion.ts` | hecho | RED visto (2 de 9 rojos); 3 tests nuevos, los 6 viejos siguen verdes |
| T4 Delito del bulevar (el valor del suelo se sacó en T7) | S3 | `src/sim/fields.ts` | hecho | RED visto (2 rojos); dentro del radio baja el delito, fuera queda igual; el valor del suelo ya no cambia |
| T10 Pavimento reforzado con lucecitas amarillas al medio | S8 | `src/render/avenue.ts`, `src/render/mapRenderer.ts`, `tests/roadtier.test.ts`, `README.md`, `src/ui/panels.ts`, `src/world/tools.ts` | hecho | ver L15 |
| T9 El mapa repinta una calle que solo cambió de calidad | S2, S8 | `src/render/mapRenderer.ts`, `tests/roadtier.test.ts` | hecho | ver L14 |
| T8 Bulevar con cantero de cemento de un píxel, sin pasto | S3, S8 | `src/render/avenue.ts`, `src/render/mapRenderer.ts`, `tests/roadtier.test.ts`, `README.md`, `src/ui/panels.ts`, `src/world/tools.ts` | hecho | ver L12 |
| T7 Bulevar sin "con farolas", sin valor del suelo | S3, S8 | `src/config.ts`, `src/world/tools.ts`, `src/render/avenue.ts`, `src/render/mapRenderer.ts`, `src/sim/fields.ts`, `src/ui/panels.ts`, `README.md`, `tests/roadtier.test.ts` | hecho | ver L11 |
| T5 Dibujo, minimapa, ficha y presupuesto | S8, S9 | `src/render/*`, `src/sim/report.ts`, `src/sim/budget.ts` | hecho | `tierOf` en `avenue.ts` probado (banda por su celda más débil); las tres calidades miradas en el navegador con el `MapRenderer` real: asfalto más claro, reforzado más oscuro, bulevar con cantero verde y farolas |
| T6 Documentación: README, plan, ayuda en pantalla | S1, S5 | `README.md`, `PLAN-DE-TRABAJO.txt`, `src/ui/panels.ts` | hecho | — |

Runner: `npm test` (Vitest) y `npm run build`. Balance: `npm run probe`.

## Log

- **L1 (2026-11-13), pedido original (verbatim):** "Me interesaria mejorar lo que es el sistema de calles, actualmente hay un solo tipo de calle y al agregar otra al lado se vuelve avenidas de ancho que uno elija, me gustaria poder "mejorar" la calidad de estas? o que opinas que podemos hacer? esta bueno tomar de referencia a juegos puntero de este genero para ver como resuelven eso"
- **L2:** el padre verificó el código antes de opinar: la avenida no es solo visual, `sim/congestion.ts` ya cuenta carriles y la capacidad es `lanes × TRAFFIC.laneCapacity`. Se propuso calidad como eje aparte del ancho, con escalera tierra → asfalto → reforzado, y "Mejorar" al estilo Cities: Skylines.
- **L3 (2026-11-13), corrección del usuario:** la "ruta provincial" solo existe para delimitar dónde arranca el juego, no es un escalón de calidad; no hace falta arrancar en tierra; quiere **tres calidades** y que la tercera tenga farolas. Verbatim: "La "ruta provincial" solo existe o va a existir solo para delimitar de donde se arranca el juego, la idea seria dar yo que se, 3 calidades de calle mejores? y no necesariamente arrancar con tierra, yo diria asfalto, pavimento reforzado y despues algo mas? que tenga farolas o algo asi?"
- **L4 (2026-11-13), números y reglas del usuario:** bulevar ×1,8 y $75; las tres calidades elegibles de una; construir la 3 encima de la 1 mejora a 3. El padre decide, y queda como spec: la mejora cobra la diferencia, no hay degradado ni devolución, la banda manda por su celda más débil, y la ruta se dibuja como reforzado sin pagar. El mantenimiento (1 / 3 / 8) es propuesta del padre: un solo número en `config.ts` si no cierra.
- **L5:** corrección de alcance sobre v1: el bulevar **no** se baja a números puros; el usuario aceptó el resto de la propuesta sin objetar el efecto de valor del suelo y delito (S3), que queda implementado.
- **L6 (2026-11-13), implementación T1–T2.** Se guarda un byte por celda en `World.roadTier`, que `setTile` limpia como `inherited`; la mejora escribe el byte y marca sucio en vez de volver a poner el tile, así conserva el flag de calle heredada y los árboles. La tecla del bulevar es `t`: el test de `coast.test.ts` avisó que `b` es el atajo del tamaño de bloque. Los precios y mantenimientos viven en `ROAD_TIERS` (`src/config.ts`) y `COSTS.road`/`UPKEEP.road` se derivan de la primera calidad para no tener dos fuentes de verdad.
- **L7 (2026-11-13), cambio de spec.** S9 pedía separar el mantenimiento de calles por calidad en el presupuesto. Se reescribió ese ítem: el presupuesto cobra cada celda según su calidad dentro de la línea "Calles y puentes" que ya existe. Motivo: separar la línea obliga a agregar campos al presupuesto guardado y a una migración más, y el jugador no gana nada que no pueda leer en la ficha de la celda.
- **L8 (2026-11-13), verificación del dibujo.** La automatización del navegador de la app dio timeout en `snapshot` y `evaluate` sobre la página del juego, así que la comprobación visual se hizo con una página temporal (`calles-lab.html` + `src/lab/calles.ts`) que arma un mapa con las tres calidades y lo pinta con el `MapRenderer` real; se miró la captura y después se borraron los dos archivos. Resultado: el asfalto es el gris de siempre, el pavimento reforzado es visiblemente más oscuro y el bulevar se distingue por el cantero verde y las farolas. Lo que **no** quedó verificado es el gesto de mejora arrastrando el mouse sobre el mapa con la interfaz real: eso está cubierto por tests de `planTool`/`applyPlan`, no por una prueba manual.
- **L9 (2026-11-13), cierre.** Commits: `7cbb9fb` (mundo, guardado, herramientas, congestión, campos y sus tests) y `2ebbd19` (dibujo, minimapa, ficha, ayuda y docs). `npm test`: 533 tests en 36 archivos, todos verdes (eran 513 antes; los 20 nuevos están en `tests/roadtier.test.ts`). `npx tsc --noEmit` limpio y `npm run build` en 1,07 s. Pendiente para una próxima: pasar el ojo por el gesto de mejora arrastrando en la interfaz real, y ver si el mantenimiento del bulevar ($8) duele lo suficiente corriendo `npm run probe` con y sin bulevares.
- **L10 (2026-11-13), pedido del usuario (verbatim):** "el bulevar con farolas la verdad que no se nota mucho y no se entiende el bulevar, podrias hacer que la linea del medio sea 3 de ancho? con distintos tonos de verde para notar el pasto, y sacá el nombre "con farolas", y que deje de subir el precio de la tierra alrededor". Se reescribió S3 y el ítem de dibujo de S8.
- **L11 (2026-11-13), T7.** El cantero es una regla pura en `avenue.ts`: `medianCells(lanes)` devuelve `min(3, lanes - 2)` con 3 carriles o más y 0 con 2; `isMedianLane` reparte ese ancho en el medio. El renderer pinta la celda entera con uno de cuatro verdes según `world.variant` y dibuja cordón en los bordes que dan al asfalto; las líneas de carril se saltan los bordes que tocan cantero. Con 2 carriles queda la línea verde de antes, porque no hay lugar para el cantero (decisión del padre, no del spec: si el usuario quiere cantero también ahí, hay que ensanchar la avenida).
  - Los faroles y su efecto sobre el delito quedan; lo que se fue es el valor del suelo: `BOULEVARD.value` desapareció de `config.ts` y de `computeLandValue`, y el test que exigía "sube el valor" ahora exige que **no** lo mueva.
  - Medido en el navegador headless con el `MapRenderer` real sobre una avenida de 5 carriles de bulevar, muestreando el centro de cada carril: `[[52,51,59],[106,154,78],[121,167,87],[92,139,70],[52,51,59]]` → asfalto, pasto, pasto, pasto, asfalto, con tres verdes distintos. Los archivos temporales se borraron.
  - Consecuencia de diseño, anotada a propósito: sin valor del suelo, el bulevar solo compra +0,2 de capacidad sobre el pavimento reforzado por $45 de construcción y $5 de mantenimiento más. **Puede quedar dominado**; si al jugarlo no se elige nunca, la palanca es bajar el mantenimiento o subir la capacidad.
- **L12 (2026-11-13), pedido del usuario (verbatim):** "No, claro, el tema que por como lo hiciste, al ensanchar la calle el bulevar se vuelve gigante y no tiene sentido, en todo caso que al alargar la calle este deberia agregar bulevares, y hacelos de cemento y listo, de 1 pixel y ya está (1 pixel en el medio contiguo en una sola calle)". Se reescribieron S3 y el ítem de dibujo de S8: el cantero deja de ser pasto de hasta 3 carriles (crecía con el ancho de la avenida) y pasa a ser **una sola línea de cemento de 1 píxel** en el medio del camino, igual en cualquier ancho.
- **L13 (2026-11-13), T8.** `boulevardMedian(lanes, lane)` (`avenue.ts`) devuelve `'boundary'` para el carril bajo del límite central de una banda par, `'through'` para el carril central de una impar y para una calle de una celda, y `'none'` para los demás. En `drawWideAsphalt`, cuando el estilo de la línea es `double` y la calidad es bulevar, se pinta **una** línea de cemento (`MEDIAN_CONCRETE`, `lineWidth 1`) en vez de las dos amarillas; para `'through'` se dibuja del medio de un lado de la celda al medio del opuesto, siguiendo el eje de la calle (se detecta por el vecino de la misma banda y el mismo carril). En `drawAsphalt` (calle de una celda) las líneas del medio hacia cada conexión pasan de punteadas crema a **sólidas de cemento**. Se fueron `medianCells`, `isMedianLane`, los cuatro verdes y los cordones: el cantero ya no ocupa celdas, así que el ancho de la avenida no lo agranda.
  - Medido en el navegador headless con el `MapRenderer` real, muestreando el píxel exacto. Calle de una celda, centro: `[164,160,151]`. Avenida de 2: centro de carril `[52,51,59]` (asfalto) y límite `[163,159,151]` (cemento). Avenida de 4: centro de carril `[52,51,59]`, límite 0|1 `[165,158,132]` (punteado crema, el de las avenidas), límite 1|2 `[163,159,151]` (cantero). Los temporales se borraron.
- **L14 (2026-11-13), bug reportado por el usuario (verbatim):** "cuando hago el cambio de mejora, esta no cambia, queda visualmente igual indiferente de lo que hice, aunque pareciera ser que si se mejora por debajo ya que no puedo volver a poner la misma mejora". Causa: la calidad viaja **dentro** del código de banda que arma `analyzeRoads` (`tierOf`), y `MapRenderer.syncBands` solo recalculaba ese análisis cuando una celda cambiaba entre calle y no calle (`roadSnap`). Una mejora deja la celda siendo calle, así que el análisis quedaba viejo y se seguía dibujando la calidad anterior; el dato sí cambiaba, por eso no se podía volver a mejorar. Arreglo: `tierSnap` junto a `roadSnap`, y `syncBands` recalcula si cambió el trazado **o** la calidad de alguna celda sucia. Como después compara el análisis antes/después, la banda entera se repinta sola.
  - Test de regresión: `the map redraws a street that was only upgraded` en `tests/roadtier.test.ts`, con `MapRenderer` real sobre un mapa generado; verificado en rojo (sin el arreglo da `expected +0 to be 1`) y en verde con él.
  - Verificación de punta a punta en el navegador headless: se pinta una calle, se muestrea su píxel `[85,84,90]` (asfalto), se aplica la mejora a pavimento reforzado, se llama a `map.update` y el mismo píxel pasa a `[64,63,71]` (pavimento). Antes del arreglo ese píxel se quedaba en el asfalto.
  - Queda como está, a propósito: en una avenida ancha, mejorar **un solo carril** no cambia el dibujo hasta que se mejora el carril más flojo de la banda, porque la banda se dibuja por su celda más débil (S4). En una calle de una celda, o mejorando la avenida entera, el cambio se ve al instante.
- **L15 (2026-11-13), pedido del usuario (verbatim):** "podrias hacer que la separación de la calle "pavimento reforzado" que sea una linea punteada amarilla? como que son las tipicas lucecitas/tope que hay en algunas calles y avenidas en vez de linea". `centreMark(tier)` (`avenue.ts`) devuelve `'plain'` (asfalto: dos amarillas en una avenida, crema punteada en una calle), `'lights'` (reforzado) y `'concrete'` (bulevar). Con `'lights'` el centro se dibuja en amarillo (`AVENUE_LINE`, ancho 1,2) con `setLineDash([1, 2])`: los huecos son los que dan la lectura de lucecitas en vez de línea.
  - Medido en el navegador headless recorriendo el medio de cada calle y clasificando los píxeles: **asfalto** amarillo 0 / crema 30 (línea crema punteada de siempre), **reforzado** amarillo 20 / crema 0 (lucecitas con huecos a la vista), **bulevar** amarillo 0 / crema 40 (el cemento cae en la clase "crema" porque es un gris claro). Los temporales se borraron.
