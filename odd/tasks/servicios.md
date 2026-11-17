# Servicios: los seis edificios de 1×1 en píxel

La sección Servicios son seis edificios de una celda, sin niveles: escuela, salita, comisaría,
bomberos, hospital y universidad. Son los que más aparecen en una ciudad, y hasta ahora seguían en
el arte de canvas.

## Specs

- **S1 — El retoque de los servicios (verbatim):** "Ah si si, servicios, me habia olvidado, queres darle ese retoque entonces".
  - Criterios:
    - Los seis se pintan sobre la celda que ya ocupan, con la disciplina del resto: píxel duro y la sombra como única alfa parcial.
    - Cada uno se reconoce por lo que hace, no por el color: la escuela por el mástil con la bandera y el patio con reja, la salita por la cruz verde, la comisaría por la baliza del techo, los bomberos por la torre de secado y las dos puertas de garaje, el hospital por la cruz roja y la helisuperficie, la universidad por el pórtico de columnas y la torre del reloj.
    - Los seis no comparten silueta: alturas y plantas distintas, con el hospital y la universidad como los dos grandes.
    - Nada se dibuja fuera de la celda: el edificio, el patio y los detalles entran en el lote de 1×1.
    - Entra con su palanca, `?pixel=servicios`; apagada, el juego dibuja exactamente lo de antes.
  - Checks: `tests/arte-pixel.test.ts` (píxel duro, seis dibujos distintos, alturas, dentro del lote); `npx tsc --noEmit`; tablero `?solo=servicios` y `?solo=city`.

## Tasks

| ID | Tarea | Specs | Archivos | Estado |
|---|---|---|---|---|
| T1 | Escuela: dos plantas, techo a dos aguas, patio con reja y el mástil con la bandera | S1 | `src/render/pixelArt.ts` | `paintSchool` |
| T2 | Salita: planta baja, banda verde y la cruz del techo | S1 | `src/render/pixelArt.ts` | `paintClinic` |
| T3 | Comisaría: dos plantas, banda blanca, baliza y patrullero en el patio | S1 | `src/render/pixelArt.ts` | `paintPolice` |
| T4 | Bomberos: dos puertas de garaje y la torre de secado con la sirena | S1 | `src/render/pixelArt.ts` | `paintFirehouse` |
| T5 | Hospital: cuatro plantas de vidrio, cruz roja y helisuperficie | S1 | `src/render/pixelArt.ts` | `paintHospital` |
| T6 | Universidad: ladrillo, pórtico de columnas y torre del reloj | S1 | `src/render/pixelArt.ts` | `paintUniversity` |
| T7 | Palanca y enganche en el renderer | S1 | `src/render/artSwitch.ts`, `src/render/mapRenderer.ts` | hecho |
| T8 | Tablero: sección Servicios y los seis en la manzana | S1 | `scripts/arte-board.ts`, `scripts/board-city.ts` | hecho |
| T9 | Tests de los servicios | S1 | `tests/arte-pixel.test.ts` | 3 tests, 93 en el archivo |

## Log

- **L1 (2026-11-17), pedido original (verbatim):** "Ah si si, servicios, me habia olvidado, queres darle ese retoque entonces".
- **L2.** No se toca la simulación: los servicios son de una celda y sin niveles, así que esto es arte y una palanca, nada más. `serviceSprite(kind)` sigue siendo la puerta de entrada y el pase de píxel se engancha ahí.
- **Pendiente de otras pasadas:** el tendido eléctrico (`TILE.LINE`) y los árboles sueltos del mapa siguen en canvas.
- **L3.** No se tocó la simulación: los seis son de una celda y sin niveles, así que el pase es arte, una palanca y el enganche en `serviceSprite`. `paintService(kind)` devuelve los píxeles y `servicePixelSprite` los convierte en sprite, igual que en los hubs, para que los tests puedan mirar el dibujo sin DOM.
- **L4.** Lo que se arregló mirando la lámina: la torre de secado de los bomberos desaparecía contra la pared de ladrillo porque era del mismo color (quedó el techo de pizarra y una banda blanca); la cruz de la salita era un punto (más grande y con la caja del equipo en el techo); la cruz del hospital caía contra el borde de la fachada (centrada y con los brazos de dos píxeles); y el reloj de la universidad era una mancha oscura (esfera blanca con su aguja).
- **L5.** Gotcha del tablero: si una familia no está en la lista de importes de `arte-board.ts`, los canvas salen **vacíos** y el único aviso es un `Uncaught ReferenceError` en la consola del navegador. Cuando una sección queda en blanco, lo primero es mirar la consola, no el pintor.
- **Pendiente de otras pasadas:** el tendido eléctrico (`TILE.LINE`) y los árboles sueltos del mapa siguen en canvas.
