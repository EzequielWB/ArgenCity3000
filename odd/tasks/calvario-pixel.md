# El Calvario, en píxel

El primer edificio único que sale de canvas. Es 3×6, el lote más grande del juego, y el único cuyo
terreno es parte del dibujo: la loma no se apoya en el relieve, la pinta el sprite.

## Specs

- **S1.** *"que haga una pequeña escalinata con un poco de montecito y bosque, toma d ereferencia el
  calvario de Tandil"* — el dibujo tiene que tener tres cosas y en ese orden de importancia: la
  **escalinata**, un **montecito** (chico, no la sierra entera) y **bosque** alrededor.
- **S2.** Referencia: el Calvario de Tandil — la Vía Crucis de piedra que sube la ladera, las tres
  cruces en la cima, y el monte de pinos y eucaliptos alrededor. Nada de arte de SimCity 2000: sólo el
  género.
- **S3.** Píxel a 1×, píxeles duros; la única transparencia parcial permitida es la sombra (alfa ≤ 96).
- **S4.** El sprite se pinta para el lote como se ve: 3×6 y 6×3 según gire la cámara. Un dibujo por
  orientación, del mismo tamaño, y en las dos la escalinata sube hacia la cresta.
- **S5.** La simulación no cambia: costo 12.000, mantenimiento 220, turismo 2 %, pico 18 % en
  septiembre, y la regla de que va en lo más alto del mapa (`margin: 4`).
- **S6.** El canvas viejo (`calvarioArt`) se borra, como se borraron los doce de las familias.

### Criterios de aceptación

- Se reconoce de un vistazo como **un cerro con una escalera y tres cruces**, no como un edificio.
- El bosque está en la base y en las laderas, y los árboles **se apoyan** en la pendiente: ninguno
  flota ni se hunde.
- La escalinata llega de la base a la cresta sin cortarse, y la cara de la loma no se lee como una
  pared plana.
- En el juego se ve en la loma que el jugador eligió, sin acantilados ni huecos al pie.

### Checks

`npx vitest run`, `npx tsc --noEmit`, `npm run board` (edificios-unicos.html), y el mapa real con
`arte.html?solo=city`.

## Tasks

| ID | Tarea | Specs | Archivos | Commit |
|---|---|---|---|---|
| T1 | El monte: la loma, su perfil y los recortes de roca | S1, S3 | `src/render/pixelArt.ts` | `c251ce1` |
| T2 | La escalinata de piedra que sube la cara de la loma | S1, S2 | `src/render/pixelArt.ts` | `c251ce1` |
| T3 | Las tres cruces en la cresta, con su plataforma | S2 | `src/render/pixelArt.ts` | `c251ce1` |
| T4 | El bosque: pinos y eucaliptos en la base y la ladera | S1, S2 | `src/render/pixelArt.ts` | `c251ce1` |
| T5 | El renderer usa el píxel y se borra el canvas | S4, S6 | `src/render/sprites.ts` | `c251ce1` |
| T6 | Tests y tablero | S3, S5 | `tests/calvario-pixel.test.ts`, `scripts/unicos-board.ts` | `c251ce1` |

## Log

- **L1.** Pedido, textual: *"Osea, que haga una pequeña escalinata con un poco de montecito y bosque,
  toma d ereferencia el calvario de Tandil"*. Antes había preguntado si el Calvario traía su propia
  sierra pintada o si era la cresta apoyada en el terreno del jugador; la respuesta es la primera, con
  una loma chica en vez de la sierra.
- **L2.** Se portó la estructura del canvas (perfil de sierra, cara cortada, doce tramos de escalinata,
  esplanada y tres cruces) al `Pen` de píxel, con `penRect` para el lote rectangular y `boxAC` para dar
  las cajas en coordenadas del monumento y no de la vista. La loma va en 44 de alto y el monte alrededor.
- **L3.** Las vueltas que necesitó, y por qué:
  - Los árboles salieron **lilas**: el monte usaba las cuatro especies del terreno y el jacarandá leía
    como una pirulita. Ahora son pino y eucalipto, que es lo que hay en la loma de Tandil.
  - La escalinata era una **escalera de manojos blancos**: dos tonos de piedra casi iguales y dithering
    en los dos. Se sacó el dithering y se abrió el contraste —riser en sombra, huella en luz—, y ahí
    aparecieron los peldaños.
  - La baranda continua dibujada con `ceil` **serpenteaba** al lado de la escalinata como un rayón.
    Ahora es un tramo de baranda por tramo de escalón, paralelo a la huella.
  - La ladera y la cara se encontraban en un **borde duro** y la loma leía como una porción de torta.
    Se agregó el filo de pasto iluminado arriba de la cara.
  - Las tres cruces eran enormes y se tocaban entre sí; bajaron a 15 y 22 y se separaron 0,72 celdas.
- **L4.** La orientación girada sale **espejada**, y está bien: es la misma pintura con el lote de 6×3, y
  el renderer ya hacía lo mismo con los aeropuertos. El tablero ahora muestra las dos, que era la única
  forma de verlo sin girar la cámara en el juego.
- **L5.** Pendiente y dicho: **no hay chequeo en el mapa real**. `edificios-unicos.html` muestra las dos
  orientaciones con el sprite de verdad, pero la plancha de la ciudad no tiene un bloque libre de 3×6 y
  agrandarla cambiaría el terreno de todo el tablero. La geometría del anclaje es la misma de los otros
  nueve (`penRect` replica el `rectPainter` del canvas: mismo ancho, misma altura sobre la línea de
  base), así que el riesgo es bajo, pero no está observado.
- **L6.** Evidencia: `npx vitest run` **1139 / 67 archivos** verdes · `tsc --noEmit` limpio ·
  `npm run board` 38 kB · seis tests nuevos en `tests/calvario-pixel.test.ts`.
- **L7.** `sprites.ts` perdió `calvarioArt` y quedó en 1.135 líneas. Lo que resta en canvas son nueve
  monumentos: obelisco, puente, teatro, estadio, cabildo, regimiento, planetario, santuario y sindicato.
