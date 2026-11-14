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

### S3 — El bulevar compra valor del suelo y seguridad

- Una celda de bulevar suma valor del suelo y resta delito a las celdas a 2 o menos de distancia,
  con tope (no se acumula sin límite por cada celda de bulevar vecina).
- Aceptación: con el resto de la ciudad igual, un barrio con bulevar tiene más valor del suelo y
  menos delito que el mismo barrio con asfalto.

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
- Bulevar: cantero central y farolas cada pocas celdas.
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
| T4 Valor del suelo y delito del bulevar | S3 | `src/sim/fields.ts` | hecho | RED visto (2 rojos); dentro del radio baja el delito y sube el valor, fuera quedan igual |
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
