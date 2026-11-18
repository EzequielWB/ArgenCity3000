# El Calvario, en píxel

El primer edificio único que sale de canvas. Es 3×6, el lote más grande del juego, y el único cuyo
terreno es parte del dibujo: la loma no se apoya en el relieve, la pinta el sprite.

## Specs

- **S1.** *"que haga una pequeña escalinata con un poco de montecito y bosque, toma d ereferencia el
  calvario de Tandil"* — el dibujo tiene que tener tres cosas y en ese orden de importancia: la
  **escalinata**, un **montecito** (chico, no la sierra entera) y **bosque** alrededor.
- **S2.** Referencia: el Calvario de Tandil — la Vía Crucis de piedra que sube la ladera, **una sola
  cruz** en la cima, y el monte de pinos y eucaliptos alrededor. Nada de arte de SimCity 2000: sólo el
  género. *(Reescrito por L10: eran tres cruces y el usuario pidió una sola, más grande.)*
- **S7.** *"Preferiria quizá un poco menos de altura, que haya algunas piedritas en la zona verde y que
  haya una sola cruz mas grande"* — la loma baja, el pasto con piedritas sueltas y una cruz sola, que
  sea el remate del monumento.
- **S8.** *"Si a mi tampoco me gusta la loma como baja ni los costados, podrias darle como 'volumen' que
  este en una loma esto"* — la loma tiene que tener **volumen**: un monte con cuerpo a los cuatro lados,
  no una cuña con una ladera y una cara cortada que se juntan en un filo.
- **S9.** *"yo tiraría el 'centro', es decir la cruz más al 3/4 final de la base y que esté más en un
  'slope' con estos desniveles … y que tenga más base ya que ahora queda raro"* — la cumbre **no va en el
  medio**: va a tres cuartos de la base, con la escalinata subiendo la ladera larga, y la loma tiene que
  ocupar más base, no quedar como un montículo suelto en el medio del lote.
- **S3.** Píxel a 1×, píxeles duros; la única transparencia parcial permitida es la sombra (alfa ≤ 96).
- **S4.** El sprite se pinta para el lote como se ve: 3×6 y 6×3 según gire la cámara. Un dibujo por
  orientación, del mismo tamaño, y en las dos la escalinata sube hacia la cresta.
- **S5.** La simulación no cambia: costo 12.000, mantenimiento 220, turismo 2 %, pico 18 % en
  septiembre, y la regla de que va en lo más alto del mapa (`margin: 4`).
- **S6.** El canvas viejo (`calvarioArt`) se borra, como se borraron los doce de las familias.

### Criterios de aceptación

- Se reconoce de un vistazo como **un cerro con una escalera y una cruz**, no como un edificio.
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
- **L8.** La escalinata necesitó dos vueltas más después del primer visto bueno, y las dos enseñan lo
  mismo: **el contraste es el dibujo**. La primera era un sendero de piedra porque los dos tonos estaban
  a un paso; se abrió el contraste. La segunda, ya con peldaños, quedó con un **fleco pálido a los
  costados**: eran las barandas, y una baranda dibujada como línea clara sobre pasto oscuro se lee como
  un rayón. Se borraron. La tercera intentó simplificar a una banda con líneas transversales y volvió a
  ser un camino gris: la banda tenía los bordes limpios pero perdió los peldaños, que es lo único que
  hay que leer. Quedó la versión de siempre —**un tramo por escalón, riser en sombra y huella en luz, sin
  barandas**— porque es la única de las cuatro que se lee como escalinata.
- **L9.** Los tests tuvieron que cambiar con el dibujo, y está bien: lo que prueban es que hay piedra,
  que aparece en toda la altura de la loma y que son varios peldaños, no un número de píxeles que se
  movía con cada vuelta del dibujo.
- **L10.** Pedido, textual: *"Preferiria quizá un poco menos de altura, que haya algunas piedritas en la
  zona verde y que haya una sola cruz mas grande"*. Se reescribió S2 (una cruz en vez de tres) y se
  agregó S7; se reabrió la tarea de la cresta.
- **L11.** Lo que cambió: la loma bajó de 44 a 34 y con ella los tramos de la escalinata de siete a seis,
  porque a 34 el tramo de siete se quedaba sin píxeles y volvía a leerse como rampa; el filo del peldaño
  pasó a ser lo que sostiene la lectura. La esplanada se achicó al tamaño de una cruz y no de la cresta
  entera. Aparecieron dieciséis piedritas sueltas sobre el pasto, en gris claro y con una sola línea de
  sombra abajo —al revés se leían como manchas—, pintadas antes del monte para que un árbol de adelante
  las tape. Y la cruz quedó sola, de 28 de alto y 13 de ancho, con el palo de tres píxeles y un pie de
  piedra.
- **L12.** Pedido, textual: *"Si a mi tampoco me gusta la loma como baja ni los costados, podrias darle
  como 'volumen' que este en una loma esto"*. Se agregó S8 y reabrió la tarea del monte.
- **L13.** La loma dejó de ser un perfil con cara cortada y pasó a ser un **monte de terrazas**: ocho
  anillos que se cierran con la altura, cada uno con su **pared en sombra mirando a la cámara** y su
  **huella iluminada arriba**, más la sombra que tira sobre el prado. La punta es una meseta (el radio no
  baja de 0,26 del pie) y ahí se para la esplanada con la cruz, que antes flotaba sobre un pico.
- **L14.** Las cuatro vueltas que necesitó el volumen, y qué enseñan:
  - Apilar anillos de un píxel con un degradé parejo dio un **mapa topográfico plano**: sin pared no hay
    cuerpo, por más que la luz esté bien.
  - Las terrazas con la pared en verde oscuro quedaron un **pastel de bodas**: la pared se comía la
    huella. La huella tiene que ir con el radio de **abajo**, que es el anillo que se ve entre una pared y
    la siguiente.
  - Con la huella bien, la escalinata eran **tablones sueltos** apoyados en la loma. Ahora primero se
    dibuja el cuerpo de la escalera —una cinta de cuatro píxeles que une peldaño con peldaño— y después la
    huella de cada peldaño encima.
  - El monte tiene que ser **más claro y más chico** que el lote, y el prado un verde distinto: con los
    mismos tonos, la loma no se despega del piso.
- **L15.** Evidencia: `npx vitest run` **1139 / 67 archivos** verdes · `tsc --noEmit` limpio ·
  `npm run board` · las dos orientaciones en el tablero.
- **L16.** Pedido, textual: *"Esta raro igual, yo tiraria el 'centro' es decir la cruz mas al 3/4 final
  de la base y que este mas en un 'slope' con estos desniveles, me explico? y que tenga mas base ya que
  ahora queda raro"*. Se agregó S9 y el monte pasó a ser asimétrico: `PEAK_AT = 0.66`, base de `0.06` a
  `L - 0.06`, y las dos laderas se cierran con curvas distintas (`(1-t)^1.15` adelante, `(1-t)^1.7`
  atrás) para que el lado que no se ve conserve cuerpo — con la misma curva a los dos lados el monte se
  leía como una rampa. La escalinata y las estaciones se apoyan ahora en los anillos de la cumbre
  corrida (`stepAt`), no en el centro geométrico.
- **L17.** El atrio de la cumbre se peleó tres veces, y las tres enseñan lo mismo: **ninguna losa con
  altura sobre una meseta angosta se puede leer como apoyada**. Una caja de 1,24 de lado "volaba", dos
  escalones de piedra hacían una mesa con mantel. Quedó un **atrio plano**: un rectángulo de 0,9 × 0,5
  pintado a la altura de la cumbre, sin volumen, con la cruz parada arriba. Y la cumbre se despeja de
  monte (`nearStair` la rechaza en un radio de 2,1): un pino al lado de la cruz le pelea el remate.
- **L18.** Evidencia: `npx vitest run` **1139 / 67 archivos** verdes · `tsc --noEmit` limpio · las dos
  orientaciones en el tablero.
