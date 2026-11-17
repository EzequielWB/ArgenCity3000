# Transporte: la cochera de colectivos

La sección Transporte del juego tiene tres piezas: la línea de colectivos (una celda), el aeropuerto
(3×2 con tres niveles por piezas pegadas) y el puerto de paseos (2×2, también por piezas). Esta
feature empieza por la primera y deja las otras dos para su propio pase.

## Specs

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
