# Transporte: la cochera de colectivos

La sección Transporte del juego tiene tres piezas: la línea de colectivos (una celda), el aeropuerto
(3×2 con tres niveles por piezas pegadas) y el puerto de paseos (2×2, también por piezas). El primer
pase hizo la cochera de 2×2; el segundo, el aeropuerto y el puerto en píxel.

## Specs — S1: la cochera

- **S1 — La cochera es de 2×2 (verbatim):** "lo que si el deposito de colectivos hacelo que sea siempre 2x2, es decir que de base sea 2x2 asi es mas facil el dibujado y tambien tiene sentido, 1x1 es muy chico".
  - Criterios:
    - El bloque es de `BUS.size`×`BUS.size` lotes y se cobra **una vez**.
    - Una cochera es **una** estación: una en la lista de líneas, un mantenimiento por mes, un número reservado, aunque tenga cuatro celdas.
    - Las cuatro celdas guardan la misma línea; el ancla es la celda de índice más bajo y el dibujo sale una sola vez, en la celda de adelante del bloque.
    - Se dibuja una sola vez: ni cuatro cocheras ni cuatro colectivos por bloque.
    - Se demuele entera desde cualquiera de sus cuatro celdas.
    - El aviso previo muestra el bloque completo, no la celda bajo el cursor.
    - Una partida guardada antes de este cambio se puede cargar: la cochera crece a 2×2 si el terreno de al lado está libre, y si no lo está la partida se rechaza con un mensaje claro.
    - El arte nuevo entra con la palanca `?pixel=transporte`, apagada por defecto en el tablero y prendida en el juego como el resto de las familias; apagada, el dibujo viejo también ocupa el bloque de 2×2.
  - Checks: `tests/transporte.test.ts` (bloque, una estación, un mantenimiento, demolición entera, aviso previo, ida y vuelta al guardado, crecimiento al cargar, rechazo sin lugar); `npx tsc --noEmit`; tablero `?solo=colectivos` y `?solo=city`.

## Specs — S2: el aeropuerto y el puerto

- **S2 — Rediseñar el resto de la sección (verbatim):** "me refiero a rediseñar lo que quedó en la sección de transporte" (con dos láminas de referencia del género: aeropuerto y puerto).
  - Criterios:
    - Una instalación es **un dibujo**, no una pieza repetida: dos piezas contiguas se leen como una sola terminal, un solo edificio y un solo camino de piezas.
    - El nivel sigue siendo la cantidad de piezas pegadas, así que el dibujo **crece** con el rectángulo de la instalación: más superficie, más puertas, más detalle, no el mismo edificio estirado.
    - Las costuras coinciden al píxel: cada pieza pinta su ventana de un dibujo en coordenadas absolutas de la instalación, y nada se dibuja fuera del lote que le toca.
    - El aeropuerto es pista, playa, terminal y torre. El puerto es muelle sobre el agua, grúas y contenedores, sobre el lado del agua que ya calculaba el renderer.
    - Los barcos siguen sin estar en el sprite: navegan (`Boats`).
    - Todo entra por la palanca que ya existe (`?pixel=transporte`), así que `?pixel=off` deja el arte viejo intacto.
  - Checks: `tests/arte-pixel.test.ts` (composición de piezas, píxel duro, crecimiento por nivel); `npx tsc --noEmit`; tablero `?solo=transporte`.

### Tasks de S2

| ID | Tarea | Specs | Archivos | Commit |
|---|---|---|---|---|
| T10 | La pieza es un recorte del dibujo de la instalación, no un dibujo propio | S2 | `src/render/pixelArt.ts` | `paintHub` / `paintHubPiece` |
| T11 | Aeropuerto: pista con rodaje, playa, terminal, torre, aviones y hangar | S2 | `src/render/pixelArt.ts` | `paintAirport` |
| T12 | Puerto: muelle, grúas, contenedores y terminal lejos del agua | S2 | `src/render/pixelArt.ts` | `paintHarbor` |
| T13 | El renderer ubica cada pieza en el rectángulo de la instalación y le pasa el lado del agua de toda la instalación | S2 | `src/render/mapRenderer.ts` | `hubView` |
| T14 | Tablero: lámina de aeropuerto y puerto por nivel, y un aeropuerto de dos piezas en la manzana | S2 | `scripts/arte-board.ts`, `scripts/board-city.ts` | sección Transporte |
| T15 | Tests de composición: las piezas coinciden con el dibujo entero y lo cubren sin huecos | S2 | `tests/arte-pixel.test.ts` | 4 tests |

## Tasks

| ID | Tarea | Specs | Archivos | Commit |
|---|---|---|---|---|
| T1 | Tamaño del bloque en la config y huella de la cochera | S1 | `src/config.ts`, `src/world/tools.ts` | hecho |
| T2 | Una estación por línea: lista de cocheras, ancla y número único | S1 | `src/world/transport.ts` | hecho |
| T3 | Compra y demolición por bloque, una sola línea para las cuatro celdas | S1 | `src/world/tools.ts` | hecho |
| T4 | Guardado: una entrada por cochera, crecimiento al cargar y rechazo sin lugar | S1 | `src/save/save.ts` | hecho |
| T5 | Dibujo: una sola vez, en la celda de adelante, con el bloque de 2×2 | S1 | `src/render/mapRenderer.ts` | hecho |
| T6 | Arte de píxel de la cochera, en el color de la línea | S1 | `src/render/pixelArt.ts`, `src/render/artSwitch.ts` | hecho |
| T7 | El dibujo viejo también ocupa el bloque | S1 | `src/render/sprites.ts` | hecho |
| T8 | Tablero: sección Colectivos y la cochera en la manzana | S1 | `scripts/arte-board.ts`, `scripts/board-city.ts` | hecho |
| T9 | Tests del bloque | S1 | `tests/transporte.test.ts` | hecho |

## Log

- **L1 (2026-11-17), pedido original (verbatim):** "Dale, lo que si el deposito de colectivos hacelo que sea siempre 2x2, es decir que de base sea 2x2 asi es mas facil el dibujado y tambien tiene sentido, 1x1 es muy chico."
- **L2.** El cambio tocó la simulación y no solo el dibujo, porque un bloque de cuatro celdas con una estación por celda rompe tres cosas calladas: el mantenimiento se cobra cuatro veces, el número de línea se reserva cuatro veces y el guardado escribe cuatro entradas para lo que es una sola línea. Las tres se resolvieron haciendo que la **celda** sea el dato y la **línea** la unidad: `busStations` devuelve una por línea, `busLineProblem` compara por línea y no por celda, y el guardado escribe el ancla con la línea.
- **L3.** Dos consecuencias que no se ven hasta probarlas: el dibujo tiene que salir una sola vez, en la celda de adelante del bloque (la misma regla que las usinas y los aeropuertos), y la demolición tiene que llevarse el bloque entero aunque se pida desde cualquier celda. Las dos quedaron con test.
- **L4.** Compatibilidad: los guardados viejos traen una entrada por cochera, así que al cargar se **cultiva** el bloque desde el ancla; si las otras tres celdas no están libres la partida se rechaza con "no tiene lugar para su cochera". Se eligió rechazar antes que recortar en silencio, porque perder una línea sin decirlo es peor que una partida que no abre.
- **L5.** Arte: la cochera se veía como una caja con dos bloques de color, así que los colectivos pasaron a llevar la banda de ventanas oscura, el techo en el tono del cuerpo y el cartel del techo se convirtió en una franja de color sobre la pared del edificio. El patio es asfalto gris y no hormigón claro: con hormigón el edificio blanco se perdía.
- **L6 (2026-11-17), pedido de S2 (verbatim):** "me refiero a rediseñar lo que quedó en la sección de transporte" — con dos láminas de referencia del género, aeropuerto y puerto.
- **L7.** El problema no era el dibujo sino **dónde se corta**. Cada pieza pintaba una instalación completa, así que dos piezas contiguas eran dos aeropuertos pegados. La solución: la instalación se pinta **entera** en coordenadas de la instalación y cada pieza es un **recorte** de ese dibujo. Probé primero lo mismo pero pintando en cada lienzo con las coordenadas corridas, y el test lo cazó: las texturas (`noise`, `bayer`) se calculan sobre coordenadas del lienzo, así que el grano de cada pieza caía distinto y la costura aparecía como un cambio de textura. Recortando el mismo dibujo la costura no existe: son los mismos píxeles.
- **L8.** Orden de pintado, otra vez la lección de las usinas: con los edificios adelante, el techo de la terminal tapaba **toda** la playa (un edificio alto esconde `alto/8` celdas de lo que tiene atrás) y los aviones desaparecían. Se invirtió el orden: pista atrás, edificios en el medio, playa adelante. Ahora los aviones están en la banda delantera, donde no hay nada que los tape, y además es como funciona un aeropuerto de verdad: el lado aire de la terminal da a la playa.
- **L9.** Detalles que solo se ven mirando: las líneas de pista con `px.line` salían **punteadas** (una diagonal de 2:1 en Bresenham deja un píxel cada dos), así que las líneas van como cuadriláteros finos y salen continuas. El hangar gris sobre hormigón gris se perdía: pared clara y marco rojo. Y el avión necesita su sombra en el piso, si no flota.
- **L10.** El lado del agua ahora se calcula sobre **toda** la instalación y no sobre cada pieza: dos piezas de un mismo puerto no pueden mirar a aguas distintas o el dibujo se arma con dos imágenes espejadas. Está con test para los cuatro lados.
