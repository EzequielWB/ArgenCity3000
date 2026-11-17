# Puerto, balneario y faro en píxel

Los tres edificios de la costa que todavía se dibujan en canvas: cada uno es único en el mapa, así
que no los toca la regla de las piezas repetidas. Se pintan una sola vez y miran al agua.

## Specs

- **S1.** Puerto de carga, balneario y faro se pintan en píxel, con el mismo lenguaje que el resto:
  1x, píxeles duros, sombra negra con alfa ≤ 96. `odd/tasks/estetica.md`.
- **S2.** El puerto se lee por **contenedores apilados y una grúa pórtico con un contenedor en el aire**;
  el balneario por el **techo de paja, las sombrillas a rayas y las reposeras sobre arena**; el faro por
  la **torre a franjas rojas y blancas con la luz encendida**, que es lo único que se ve desde lejos.
- **S3.** Los tres **miran al agua**: los lados del lote que dan al río se reciben como la máscara de
  cuatro bits que ya usan la rambla y el muelle (atrás-derecha, adelante-derecha, adelante-izquierda,
  atrás-izquierda). El muelle de carga, la arena con espuma y las rocas se apoyan sobre esos lados. Hoy
  el renderer les pasa 0 y se dibujan a ciegas, iguales en cualquier costa.
- **S4.** Con la máscara como `variant`, cada uno tiene hasta 16 dibujos (los que tengan agua en algún
  lado) y **no cambia de tamaño con la rotación**: la silueta es la misma vista de cualquier lado.
- **S5.** Nada de esto toca la simulación: costos, empleos y reglas de colocación quedan como están.
- **S6.** El canvas viejo de los tres **se borra** (`sprites.ts`), como se hizo con el resto.

Checks: `npx tsc --noEmit` limpio · `npx vitest run` verde · `tests/costa-pixel.test.ts` · las tres
piezas en el tablero `arte.html?solo=costa` y en una manzana del mapa.

## Tasks

| ID | Tarea | Specs | Archivos | Commit |
|---|---|---|---|---|
| T1 | `paintPort`, `paintResort`, `paintLighthouse` + `coastPixelSprite(kind, variant)` | S1, S2, S3 | `src/render/pixelArt.ts` | `0e0bf0b` |
| T2 | El renderer les pasa la máscara de agua y usa el sprite nuevo | S3 | `src/render/mapRenderer.ts` | `0e0bf0b` |
| T3 | Borrar el canvas de los tres | S6 | `src/render/sprites.ts` | `0e0bf0b` |
| T4 | Tests y tablero | S2, S4 | `tests/costa-pixel.test.ts`, `scripts/arte-board.ts`, `scripts/board-city.ts` | `0e0bf0b` |

## Log

- **L1.** Pedido verbátim: *«Bien, queres seguir con los diseños? hace los de puerto, balneario y faro»*.
- **L2.** Son los únicos tres del mapa que quedaban en canvas junto con los diez únicos de los
  gobiernos. Cada uno es **una celda** (`shape: 'point'`), así que no hace falta el patrón de las
  instalaciones dibujadas una vez y recortadas por pieza: es un sprite por celda, como el muelle.
- **L3.** El puerto necesitó tres vueltas. La primera era un marco amarillo: dos patas de dos píxeles y
  una viga, con los contenedores aplastados abajo. La segunda puso las pilas como cuatro manojos de
  cubos. La tercera, `containerStack`, dibuja **una fila larga por piso** —un contenedor es largo, y
  cuatro cajas cortas se leen como una pila de cubos—, y separa la grúa en dos pasadas: la estructura
  (patas, viga, cabina) **detrás** de las pilas y la carga (carro, cables, spreader y el contenedor en
  el aire) **delante**, para que se vea colgando en vez de desaparecer detrás del patio.
- **L4.** El balneario tampoco salió de una: el primer techo de paja era una carpa que tapaba media
  celda y las sombrillas eran confeti. Quedó el bar chico en el rincón de atrás, la arena ocupando el
  lote, tres sombrillas con cúpula a rayas y reposeras con su sombra para que no floten.
- **L5.** El faro salió casi de una: torre que se afina fila por fila, cinco franjas, galería, linterna
  encendida, cono rojo y el haz. El haz necesitó una corrección para que sea sólido contra el vidrio y
  recién después se diente.
- **L6.** **El tablero mostró un problema que no era de estos tres sprites**: el mapa de la plancha se
  aplanaba entero, agua incluida, así que la costa no existía y los botes nunca podían verse. Ahora se
  nivelan los dos planos, la tierra un nivel sobre el agua (nivelar la tierra a la altura de una torre
  dejaba un acantilado de ocho niveles en la orilla), y las calles que quedaban sobre el agua vuelven a
  ser agua. Con eso el puerto, el balneario, el faro y el crucero se ven **en el mapa**, que era la
  verificación que faltaba desde los vehículos.
- **L7.** Evidencia: `npx vitest run` **1125 / 66 archivos** verdes · `tsc --noEmit` limpio ·
  `npm run arte` 173 kB · `arte.html?solo=costa` con las tres piezas y sus máscaras ·
  `arte.html?solo=city` con los tres en la orilla y el crucero en el agua.
- **L8.** `sprites.ts` quedó en 1.213 líneas y sin los tres: lo que resta en canvas son los diez
  edificios únicos de los gobiernos.
