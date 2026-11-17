# Energía: las tres usinas en píxel

La electricidad del juego son dos cosas: las usinas (bloques de 2×2 con su propia arte) y el tendido
de postes y cables. Esta feature hace las usinas; el tendido queda anotado abajo como pendiente.

## Specs

- **S1 — Cada usina con su estilo (verbatim):** "ahora me gustaria tambien rearmar lo que son la electricidad, la parte de usinas, cada usina con estilos nuevos en base a lo que estamos haciendo".
  - Criterios:
    - Las tres (`coal`, `gas`, `wind`) se pintan sobre el bloque de 2×2 que ya ocupan, con la misma disciplina de píxel: píxel duro y la sombra como única alfa parcial.
    - Cada una se reconoce por su silueta, no por el color: la térmica por las dos chimeneas y el carbón, la de gas por las esferas y la nave de vidrio, el parque eólico por los molinos sobre pasto.
    - El humo sale de donde el juego dice que sale: dos bocas la térmica, una la de gas, ninguna la eólica; lo anima el renderer con el `smoke` del sprite, sin tocar la simulación.
    - Las chimeneas arrancan sobre un techo y se pintan antes del volumen que las tapa por delante, para que no queden flotando ni salgan del patio.
    - La familia entra con su palanca (`?pixel=energia`) y apagada el juego dibuja exactamente lo de antes.
  - Checks: `tests/arte-pixel.test.ts` (píxel duro, bloque cubierto, bocas de humo por tipo, tres dibujos distintos); `npx tsc --noEmit`; tablero `?solo=energia` y `?solo=city`.

## Tasks

| ID | Tarea | Specs | Archivos | Commit |
|---|---|---|---|---|
| T1 | Térmica: casa de calderas, dos chimeneas y patio de carbón | S1 | `src/render/pixelArt.ts` | hecho |
| T2 | A gas: esferas, nave de turbinas en vidrio y chimenea flaca | S1 | `src/render/pixelArt.ts` | hecho |
| T3 | Parque eólico: tres molinos, pasto, camino de tierra y caseta | S1 | `src/render/pixelArt.ts` | hecho |
| T4 | Palanca y enganche en el renderer | S1 | `src/render/artSwitch.ts`, `src/render/mapRenderer.ts` | hecho |
| T5 | Tablero: sección Usinas y una usina en la manzana | S1 | `scripts/arte-board.ts`, `scripts/board-city.ts` | hecho |
| T6 | Tests de las usinas | S1 | `tests/arte-pixel.test.ts` | hecho |

## Log

- **L1 (2026-11-17), pedido original (verbatim):** "Bien, ahora me gustaria tambien rearmar lo que son la electricidad, la parte de usinas, cada usina con estilos nuevos en base a lo que estamos haciendo".
- **L2.** El bloque de 2×2 no se toca: las tres ya lo ocupan en la simulación (`PLANT_SIZE`), así que esto es arte y enganche, no reglas. El humo tampoco se inventa: las chimeneas de píxel registran su boca en el sprite y el renderer anima lo mismo que animaba el arte viejo.
- **L3.** Dos cosas que solo se ven mirando la lámina: el carbón amontonado quedaba **detrás** de la nave de turbinas y la nave lo tapaba entero, así que el patio se mudó al rincón delantero; y el parque eólico sobre una platea gris parecía flotar, así que va sobre pasto con un camino de tierra.
- **L4.** El molino se probó con aspas de una línea y no se leían: quedaron de tres píxeles en la raíz, con el buje rojo. La torre es de tres píxeles al pie y uno arriba, que es todo lo que hace falta para que se lea como torre y no como antena.
- **Pendiente (no de esta feature):** el tendido eléctrico (`TILE.LINE`): poste y cables siguen en canvas.
