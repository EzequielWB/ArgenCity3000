# El tendido eléctrico y los árboles del mapa

Las dos últimas piezas que quedaban en arte de canvas. El **tendido** es la otra mitad de la
electricidad: las usinas ya están en píxel pero el poste y los cables siguen siendo canvas. Los
**árboles sueltos** son los del terreno (`terrain.trees`), los que están en el campo y en las lomas;
los de las plazas ya los pinta el pase de plazas.

## Specs

- **S1 — El poste es un dibujo y los cables también.** El poste de `TILE.LINE` pasa a un sprite de
  píxel duro: poste de hormigón, cruceta, dos aisladores y, según la variante del lote, un
  transformador colgado o una cruceta doble. Los cables se dibujan con píxeles duros y conservan la
  geometría de hoy: **dos** cables, la caída que crece con el tramo, y el punto de enganche del sprite
  (`attach`), que es lo que lee el grafo de la red. La simulación no se toca.
  Aceptación: con `?pixel=energia` el poste dibuja un sprite nuevo y los cables son de 1 px duro, sin
  el trazo suave de canvas; con `?pixel=off` vuelve el poste y el trazo de siempre; los cables siguen
  saliendo del mismo punto del poste y llegan a los mismos vecinos.
- **S2 — Cuatro especies, las mismas de siempre.** Los árboles sueltos mantienen las cuatro especies
  del juego (jacarandá, palo borracho, ombú, eucalipto) y la densidad de hoy: de uno a tres árboles
  por celda según la variante. Cada especie se reconoce por la silueta y no por el color: el
  eucalipto es alto y angosto, el ombú ancho y bajo, el palo borracho es su tronco hinchado, el
  jacarandá la copa redonda con sus flores caídas en el piso.
  Aceptación: `treePixelSprite(kind, variant)` devuelve un dibujo distinto por especie, el árbol no se
  sale de su rombo, y la sombra es el único píxel con alfa parcial.
- **S3 — Palancas.** El tendido va con `?pixel=energia` (es la electricidad); los árboles con
  `?pixel=arboles`; `?pixel=off` devuelve el arte de canvas en los dos. Sin parámetro, las dos
  familias están puestas, como el resto.

## Tasks

| ID | Tarea | Specs | Archivos | Estado |
|---|---|---|---|---|
| T1 | El poste en píxel, con su punto de enganche | S1 | `src/render/pixelArt.ts`, `spriteOf` | hecho |
| T2 | Los cables con píxeles duros, misma geometría | S1 | `src/render/mapRenderer.ts` | hecho |
| T3 | Las cuatro especies de árbol, con su densidad y su sombra | S2 | `src/render/pixelArt.ts` | hecho |
| T4 | Enganche en el renderer y la palanca `arboles` | S1, S2, S3 | `src/render/artSwitch.ts`, `src/render/mapRenderer.ts` | hecho |
| T5 | Tablero: una sección con el poste y las especies; un tramo de tendido en la manzana | S1, S2 | `scripts/arte-board.ts`, `scripts/board-city.ts` | hecho |
| T6 | Tests: píxel duro, especies distintas, el poste con su enganche, la densidad | S1–S3 | `tests/arte-pixel.test.ts` (98) | hecho |

## Log

- **L1.** Pedido del usuario, verbatim: *"Dale, sigamos con eso"*, sobre lo que había quedado dicho:
  el tendido eléctrico (`TILE.LINE`: poste y cables) y los árboles sueltos del mapa.
- **L2.** Estado del que se parte: `poleSprite()` dibuja el poste con `fillRect` sobre un canvas de
  36 px y `done(p, [0, 8-17])` fija el punto de enganche; `drawWires` traza los cables con
  `quadraticCurveTo` y `lineWidth 0.6`, que es lo que se ve como una línea gris suave. Los árboles
  salen de `treeSprite(kind, v)` con `kind` 1..4 y hasta tres copas por celda.
- **L3.** El punto de enganche no se toca: `Sprite.attach` ya existía (lo lee `drawWires`), así que
  `paintPole` devuelve `attach` relativo al ancla del sprite y `spriteOf` lo arrastra. Los tres postes
  (pelado, con transformador, cruceta doble) **enganchan en el mismo píxel**, y eso es un test: una línea
  de postes distintos tiene que seguir siendo un cable derecho.
- **L4.** Los cables: la misma curva de canvas (cuadrática, control en el medio más la caída), muestreada
  cada píxel y escrita con `fillRect` de 1×1. No se cambió la geometría ni el `sag`, sólo el trazo: es la
  diferencia entre una línea gris difusa y un cable.
- **L5.** Lo que se arregló mirando la lámina:
  - Un poste sin pie **flota**: 3 px de ancho con la columna iluminada a la izquierda y en sombra a la
    derecha, más una base de 7 px, y recién ahí se para sobre el pasto.
  - La densidad de árboles ya la daba la variante (1 a 3 por celda), pero con la copa sobre el piso el ombú
    se leía como un arbusto: la copa se levantó y el tronco quedó a la vista.
  - El eucalipto angosto se leía como un poste verde: la copa arranca por encima del tronco y tiene un
    lóbulo arriba, que es lo que lo hace un árbol alto y no una columna.
- **L6.** Un bug latente del armado del tablero, que apareció acá: `page.replace('/*BUNDLE*/', js)` con el
  bundle como **string** hace que `$&`, `$1` o `` $` `` dentro del bundle se lean como patrones de
  reemplazo. Un `$&` en el código minificado metió el marcador `/*BUNDLE*/` en medio del bundle y la página
  quedó con un `SyntaxError` que no decía nada del origen. Ahora el reemplazo va con una función
  (`replace(marca, () => js)`), en los dos tableros.
- **L7.** Medido: 98 tests en `tests/arte-pixel.test.ts` (4 nuevos) y **1081** en la suite; el poste y los
  árboles no tocan la simulación ni el guardado, así que no hubo formato que subir.
