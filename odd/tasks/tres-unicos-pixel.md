# Tres monumentos más en píxel

Tres de los nueve únicos que quedaban en canvas —**el Obelisco**, el **Puente Transbordador** y el
**Teatro**— pasan a píxel con la misma lógica que el Calvario: se rediseña el monumento, no se transcribe
el dibujo de canvas, y la prueba mira la estructura, no la tinta.

## Specs

- **S1.** Pedido, textual: *"Hace otros tres que quieras, te dejo elegirlos"*. Los tres elegidos son el
  **Obelisco** (2×2), el **Puente Transbordador** (2×6) y el **Teatro** (3×3): un remate vertical, uno
  horizontal sobre el agua y un bloque grande con cúpula. Entre los tres cubren las tres siluetas que le
  faltan a los uniques, y el puente es el único que pinta su propio río.
- **S2.** El píxel es el único arte: los pintores de canvas de estos tres (`obeliscoArt`, `puenteArt`,
  `teatroArt`) se borran, no quedan detrás de una condición. `tsc --noEmit` con `noUnusedLocals` es el
  árbitro de lo que sobra.
- **S3.** Identidad argentina, sin copiar SimCity 2000: el obelisco de Corrientes y 9 de Julio con su
  plaza y sus cuatro faroles; el transbordador de La Boca, con las dos torres de celosía y la barca
  colgada sobre el Riachuelo; el Colón con el pórtico de seis columnas, el frontón y la cúpula de cobre.
- **S4.** El píxel no rota: el obelisco y el teatro son cuadrados, así que se pintan una sola vez; el
  puente se pinta en las dos orientaciones del lote (2×6 y 6×3).
- **S5.** Píxeles duros a 1×. La única transparencia parcial permitida es la sombra, con alfa ≤ 96.
- **S6.** Verificación: `npx vitest run` verde, `tsc --noEmit` limpio, `npm run board` y una captura del
  tablero antes de dar nada por bueno.
- **S7. Obelisco.** Plaza de la República con dos escalones de piedra y cuatro faroles; fuste recto de
  caras planas —no una escalera de cajas que se angostan—, con puerta al pie y dos ventanitas arriba; y
  el piramidión alto y filoso, con la antena. El fuste no se angosta: el obelisco de verdad son cuatro
  caras planas.
- **S8. Puente.** Dos torres de celosía, el tablero alto entre ellas y la barca colgada de cuatro varas,
  con la baranda y la casilla del operador. **Pocos miembros a propósito**: una celosía densa a 1× se
  convierte en una mancha gris. El agua, los dos muros de piedra en las puntas y el bote del Riachuelo
  son parte del dibujo, porque el puente pinta su propio río dentro del lote.
- **S9. Teatro.** Seis columnas claras contra un plano oscuro —la logia—, entablamento y frontón con el
  tímpano oscuro, ventanas en tres filas sobre la cara lateral, y la cúpula de cobre **ancha y baja** con
  su linterna: una cúpula alta y con remate dorado se lee como mezquita, que es lo que este edificio no es.

## Tasks

- **T1 · Obelisco en píxel** — `pixelArt.ts`: `paintObelisco`/`obeliscoPixelSprite`; `mapRenderer` ya lo
  levanta por `uniqueSprite`. Specs S1, S3, S5, S7. `tests/obelisco-pixel.test.ts`.
- **T2 · Puente Transbordador en píxel** — `pixelArt.ts`: `paintPuente(vw, vh)` en las dos
  orientaciones; `puentePixelSprite`. Specs S1, S3, S4, S5, S8. `tests/puente-pixel.test.ts`.
- **T3 · Teatro en píxel** — `pixelArt.ts`: `paintTeatro`, `teatroPixelSprite`. Specs S1, S3, S5, S9.
  `tests/teatro-pixel.test.ts`.
- **T4 · Borrar los tres pintores de canvas** — `sprites.ts`: `obeliscoArt`, `puenteArt`, `teatroArt` y
  el `longPainter` si queda sin uso; `uniqueSprite` pasa a los tres sprites de píxel. Spec S2.
- **T5 · Tablero** — `scripts/unicos-board.ts`: el puente con la cámara girada, como el Calvario.
- **T6 · Cierre** — suite completa, `tsc`, `npm run board`, captura y documento.

## Log

- **L1.** Pedido, textual: *"Bien, dejalo asi, por ahora esta bueno. Hace otros tres que quieras, te dejo
  elegirlos"*. Se creó este documento antes de la primera escritura de fuente, con la elección y el porqué.
- **L2.** Los tres, en `pixelArt.ts` junto al Calvario, con su caché por forma de lote y su export
  (`paintObelisco`/`obeliscoPixelSprite`, `paintPuente`/`puentePixelSprite`,
  `paintTeatro`/`teatroPixelSprite`). `uniqueSprite` pasa a los tres; `tsc` se llevó puesto
  `obeliscoArt`, `puenteArt`, `teatroArt`, `longPainter` y el import de `PAL` que quedó sin uso.
- **L3.** Lo que enseñó cada uno, que es lo que vale para los seis que faltan:
  - **Obelisco.** El fuste va como dos quads, no como una escalera de cajas. Y hay un farol de la plaza
    que **no se pinta**: cae justo detrás del fuste y no se ve. Pintar lo que la cámara no ve es trabajo
    muerto; la prueba cuenta tres faroles y dice por qué.
  - **Puente.** Una celosía de alambre —sólo líneas— se lee como una escalera colgada en el aire. La viga
    tiene que ser **llena**, con el cordón de arriba iluminado y la celosía marcada encima. El cordón del
    fondo va como una línea: una segunda viga llena convierte el tablero en dos tableros paralelos. Y la
    sombra del tablero sobre el agua es lo que termina de decir que el puente pasa por arriba.
  - **Teatro.** Tres pelean que ganó el dibujo: la losa clara del techo se comía el frontón (la cubierta
    va más oscura y el frontón se pinta con las dos faldas en tonos distintos, no con tres triángulos
    encimados del mismo color); el entablamento como caja con tapa dejaba al teatro con una losa de
    piedra por techo (va como banda del frente, sin tapa); y la cúpula como `blob` entero se lee como una
    piedra apoyada en el techo (va **media naranja**, un semicírculo, con las franjas de luz y sin
    tramado parejo, que la dejaba a cuadros).
- **L4.** Pruebas: `tests/obelisco-pixel.test.ts` (7), `tests/puente-pixel.test.ts` (6) y
  `tests/teatro-pixel.test.ts` (5). Todas miden estructura —anchos por fila, bultos de color, franjas de
  acero por tercio, tajadas de logia— y no cantidad de tinta.
- **L5.** Evidencia: `npx vitest run` **1157 / 70 archivos** verdes · `tsc --noEmit` limpio ·
  `npm run board` 39 kB · las dos orientaciones del puente en el tablero.
