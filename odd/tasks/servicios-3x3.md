# El hospital y la universidad son de 3×3

Los dos servicios grandes pasan de una celda a `SERVICE_SIZE` lotes de lado: el hospital y la
universidad ocupan 3×3, el resto sigue en uno. No es un retoque de dibujo: hoy los servicios son
**celdas sueltas**, sin ancla, y tres sistemas las cuentan una por una. Un hospital de 3×3 dibujado
sin cambiar eso son nueve hospitales que cubren nueve veces, cuestan nueve veces y piden nueve veces
la luz.

## Specs

- **S1 — El edificio es la unidad, la celda es el dato.** Un hospital o una universidad es *un*
  edificio sobre 3×3 lotes: **un** mantenimiento por mes, **un** disco de cobertura (centrado en su
  ancla), **una** demanda de luz, **un** globito de aviso. Demoler cualquier lote se lleva el bloque
  entero, y el costo de construcción se cobra una vez.
  Aceptación: con un hospital plantado, `monthlyBudget` cobra `serviceUpkeep('hospital', …)` una vez y
  no nueve; `computeServices` suma un disco y no nueve; `computePower.use` cuenta
  `SERVICES.hospital.power` una vez; un solo clic de bulldoze deja los nueve lotes vacíos.
- **S2 — El resto no se mueve.** Escuela, salita, comisaría y bomberos siguen de una celda, con su
  costo, su radio y su mantenimiento de siempre, y `?pixel=off` sigue devolviendo el arte viejo.
- **S3 — El bloque es lo que se planta.** La herramienta pide el bloque completo: si un solo lote está
  ocupado, con agua o sobre la ruta, no se planta nada y no se cobra nada. El ancla es el lote de índice
  más bajo del bloque (arriba a la izquierda), y el bloque se recorta dentro del mapa como las usinas.
- **S4 — Una partida vieja crece.** Un guardado escrito cuando todos los servicios eran de una celda
  tiene un solo lote de hospital: al cargar crece a 3×3 sobre el terreno libre de al lado. Si el terreno
  está tomado, la partida se rechaza con un mensaje que dice qué edificio no tiene lugar y de qué
  tamaño es. No se encoge nada en silencio.
- **S5 — Se dibuja una vez.** El edificio se dibuja una sola vez, en el lote de adelante del bloque,
  anclado en la esquina de atrás con la altura de todo el bloque (la regla de los hubs y de la cochera).
  Y se sigue reconociendo por lo que hace: el hospital por la cruz roja y la helisuperficie, la
  universidad por el claustro y el reloj.

## Tasks

| ID | Tarea | Specs | Archivos | Estado |
|---|---|---|---|---|
| T1 | `SERVICE_SIZE` y el módulo de bloques (`serviceFootprint`, `serviceBlocks`, `serviceAt`, `serviceAnchorIndex`) | S1, S3 | `src/config.ts`, `src/world/services.ts` | hecho |
| T2 | Herramienta, costo único y demolición por bloque | S3, S1 | `src/world/tools.ts` | hecho |
| T3 | Cobertura, mantenimiento, luz y reporte cuentan el edificio una vez | S1 | `src/sim/fields.ts`, `src/sim/budget.ts`, `src/sim/power.ts`, `src/sim/report.ts` | hecho |
| T4 | Guardado: crece el bloque incompleto o se rechaza la partida | S4 | `src/save/save.ts` | hecho |
| T5 | Renderer: una sola vez, en el lote de adelante | S5, S2 | `src/render/mapRenderer.ts` | hecho |
| T6 | Arte 3×3 del hospital y de la universidad | S5 | `src/render/pixelArt.ts` | hecho |
| T7 | Tablero: los dos grandes en su tamaño y en la manzana | S5 | `scripts/arte-board.ts`, `scripts/board-city.ts` | hecho |
| T8 | Tests de la regla y del dibujo | S1–S5 | `tests/servicios-3x3.test.ts` (9), `tests/arte-pixel.test.ts` (94) | hecho |

## Log

- **L1.** Pedido del usuario, verbatim: *"Y si hacemos el hospital 3x3 y la universidad 3x3?"* y después
  *"Dale, si por que dan mucha area me parece razonable que algo asi sea tan grande"*.
- **L2.** Lo que se verificó antes de aceptar: `SERVICE_TILES` guarda los servicios como celdas y no hay
  lista de edificios; `computeServices` proyecta un disco por celda con `residentsServed` y eficiencia
  propias; `monthlyBudget` cobra `serviceUpkeep` por celda; `powerNeed` devuelve `SERVICES[kind].power`
  por celda. Dibujar 3×3 sin tocar eso eran nueve hospitales, no uno grande.
- **L3.** Se elige el mismo camino que la cochera de colectivos: las celdas siguen siendo la verdad
  (el guardado las escribe y las lee sin cambio de formato) y el bloque se **reconstruye** desde ellas
  en orden de índice: el primer lote de un tipo que ningún bloque reclamó abre un bloque de su tamaño y
  reclama su footprint. Así dos hospitales pegados siguen siendo dos edificios y un lote suelto sigue
  siendo un edificio de uno.
- **L4.** El arte viejo (`serviceSprite`) queda como está: la palanca `?pixel=off` dibuja el hospital de
  una celda en el lote de adelante del bloque. Es la partida vieja, no una segunda versión del edificio.
- **L5.** Lo que se aprendió implementándolo:
  - `serviceBlocks` reconstruye los bloques **en orden de índice**, no con una lista: dos hospitales pegados
    siguen siendo dos edificios y un lote suelto sigue siendo un edificio de uno. La lista se memoiza por
    `networkVersion`, porque el renderer pregunta una vez por lote visible.
  - `serviceAnchorIndex` es lo que hace que el conteo sea uno solo: mantenimiento y `utilization` se cobran
    en el ancla, y el reporte del mouse lee el ancla y no el lote que esté bajo el cursor.
  - La luz se reparte: el ancla pide `SERVICES[kind].power`, los otros ocho lotes piden cero, y al final del
    pase de red el bloque entero hereda el estado del ancla. Sin eso, un hospital iluminado tenía ocho
    esquinas a oscuras con su globito.
  - `bus` fue el precedente y sirvió tal cual: `COSTS.bulldozePlant` para demoler el bloque, `hubHeight` para la
    altura, y el guardado que crece sobre el terreno libre o rechaza la partida con el nombre del edificio y
    el tamaño del lote.
- **L6.** Lo que se arregló mirando la lámina, y que es regla de arte y no detalle de este edificio:
  - **En una cara, el primer parche que coincide gana.** La cruz del hospital estaba escrita después de las
    bandas de ventanas y las bandas la cortaban en pedazos: parecía una bandera rota. Va primero.
  - **Dos cruces en dos caras vecinas se leen como una cinta roja**, porque las dos barras horizontales se
    encuentran en la arista. Una sola cruz, grande y centrada en la cara del frente.
  - El ancho útil de una cara es `16 × (el lado)`: 21 px la torre de 1,3 lotes. Una barra que se pasa de ahí
    se escribe sobre toda la cara.
  - El tablero colocaba el sprite con la línea del suelo fija en `17 * k`: con un dibujo de 3×3 eso lo corta
    arriba. Va en `sprite.ay * k`.
  - Dentro del `entry` que arma esbuild no se pueden usar backticks: el `entry` ya es una plantilla.
- **L7.** El tablero de la ciudad venía diciendo que sí a un aeropuerto de dos piezas que en realidad estaba
  rechazado: la columna de calle en `x = 5` cortaba el bloque justo donde iba la segunda pieza, y `plan` era
  un no-op silencioso. Ahora el tablero junta los rechazos y los escribe en el título (`sin lugar: …`), y el
  corte de la avenida se corre una cuadra para que las dos piezas se toquen de verdad.
- **L8.** El ayudante `cityOf` de `tests/roguelike.test.ts` plantaba los servicios lote por lote y la partida
  ya no abría (`Hospital: no tiene lugar para su lote de 3×3`). Se arregló el ayudante para plantar bloques
  del tamaño real: que el test viejo se rompiera es la prueba de que la regla muerde de verdad.
- **L9.** El arte de canvas queda como respaldo honesto: con `?pixel=off` el hospital de una celda se dibuja en
  el lote de adelante del bloque de 3×3. No es una segunda versión del edificio, es la partida de antes.
