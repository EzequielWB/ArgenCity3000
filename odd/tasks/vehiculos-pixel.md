# Los vehículos en píxel

El auto, el colectivo, el bote, el crucero y el avión son lo último que se dibuja con trazos de canvas.
En una ciudad de píxel duro —el mapa va con `imageSmoothingEnabled = false` en todo zoom mayor a 1— se
leen como manchas suaves: bordes anti-aliaseados, una sola cara plana por vehículo y ni una rueda ni una
sombra. Esta pasada los dibuja con el mismo taller que el resto y con **cuatro rumbos de verdad**.

## Specs

- **S1 — Familia propia.** Todo lo de acá entra con `?pixel=vehiculos`, prendido por defecto como el
  resto; con `?pixel=off` vuelven los trazos de canvas tal como están hoy. Sin la familia, ni un píxel
  del juego cambia.
- **S2 — Cuatro rumbos dibujados, no rotados.** Una dirección se dibuja cuatro veces, una por rumbo
  (`(1,0)`, `(0,1)`, `(-1,0)`, `(0,-1)` en coordenadas de vista). Rotar un sprite de 1× rompe el pixel:
  cada rumbo tiene su dibujo, y el frente del vehículo (parabrisas, luces) va sobre la cara que la cámara
  ve de ese rumbo. Un auto que se aleja muestra las luces traseras en la cara visible.
- **S3 — Volumen y piso.** Cada vehículo tiene cara superior iluminada, lateral en sombra, ruedas (o
  línea de flotación, en el agua) y **sombra en el piso** con alfa ≤ 96, como el resto del pase. El avión
  en vuelo mantiene la sombra abajo mientras el cuerpo sube.
- **S4 — El tamaño del mundo no cambia.** Las medidas se mantienen al lado de las de hoy (auto ~6 px de
  largo, colectivo ~11, crucero ~18, avión por nivel hasta ~18): lo que cambia es la forma, no la escala
  de la ciudad. El auto crece lo mínimo para que entren parabrisas y ruedas.
- **S5 — Se mueven en píxeles enteros.** El sprite se apoya en el punto del piso redondeado, así no vibra
  ni se embarria a ningún zoom; la capa de oclusión de `traffic.ts` sigue igual (sólo cambia lo que se
  dibuja dentro, no cómo se recorta).
- **S6 — Nada de la simulación se toca.** Ni tráfico, ni rutas, ni botes, ni aviones: esto es dibujo,
  una familia y un blit.

## Tasks

| ID | Tarea | Specs | Archivos | Estado |
|---|---|---|---|---|
| T1 | Familia `vehiculos` en el interruptor | S1 | `src/render/artSwitch.ts` | hecho |
| T2 | El taller de vehículos y los tres rodados (auto, taxi, colectivo) | S2–S4 | `src/render/vehicleArt.ts`, `src/config.ts` | hecho |
| T3 | El tráfico dibuja los rodados | S5, S6 | `src/render/traffic.ts` | hecho |
| T4 | Botes: de pesca, de paseo y crucero | S2–S4 | `src/render/vehicleArt.ts`, `src/render/vessels.ts` | hecho |
| T5 | Aviones, con su sombra en la pista | S2–S4 | `src/render/vehicleArt.ts`, `src/render/vessels.ts` | hecho |
| T6 | Tablero: los rumbos de cada vehículo a 6× | – | `scripts/arte-board.ts` | hecho |
| T7 | Tests: un sprite por rumbo, píxel duro, sombra permitida y sin tocar la simulación | S1–S6 | `tests/vehiculos.test.ts` | hecho |

## Log

- **L1.** Pedido del usuario, verbatim: *"Queres revisar el tema de los vehiculos dibujados? avión, auto,
  barco, crucero, etc... Siento que al ser planos pierden mucho y no tienen mucha forma en general"*.
- **L2.** Diagnóstico medido, no supuesto: el auto son 4,2 × 1,8 px de pantalla contra un lote de 32 px
  (`traffic.ts` usa `len = 2.1` en píxeles de pantalla, no en lotes), el colectivo 10,8 × 3,4, el crucero
  17 × 8; y los tres son un paralelogramo con `fillStyle` mientras el mapa se dibuja sin suavizado
  (`view.ts:214`). Tres causas: vector entre píxeles, una sola cara, y tamaño sin lugar para forma.
- **L3.** Se dibuja en **unidades de lote** con el mismo `Pen.P(u, v, z)` que los edificios, y no en
  píxeles de pantalla: así los cuatro rumbos salen de una sola fórmula y el vehículo se apoya en la misma
  grilla que la calle. Para los cuatro rumbos alcanza porque el rumbo siempre cae sobre un eje de (u, v),
  o sea que la huella sigue siendo un rectángulo alineado y `box`/`poly` la proyectan bien.
- **L4.** El orden es por lo que más se ve: rodados primero, después botes y crucero, y los aviones al
  final, que son los únicos que ya tenían tamaño resuelto.
- **L5.** Los rodados ya están. El auto es una **plataforma con cabina**: a seis píxeles de largo, un solo
  volumen se lee como un pan, y la cabina de vidrio sobre la carrocería es lo que lo vuelve un auto. El
  colectivo es una caja de tres píxeles con la banda de ventanillas en el medio y el cartel sobre el
  parabrisas. Las luces van **adentro** de la cara (a 6% y 94% del ancho): puestas en las esquinas, a 1×
  una de ellas cae fuera del sprite y queda flotando.
- **L6.** El tablero de la ciudad dibuja ahora también el tráfico con el `drawTraffic` real, con seis
  vehículos sembrados en las calles del bloque: es la única forma de juzgar un auto de seis píxeles, entre
  edificios y asfalto. Un sprite solo a 8× engaña.
- **L7.** Evidencia: `npx vitest run tests/vehiculos-pixel.test.ts` (5) · `npx vitest run` (**1101 / 64
  archivos**) · `npx tsc --noEmit` limpio · `npm run arte` (182 kB).
