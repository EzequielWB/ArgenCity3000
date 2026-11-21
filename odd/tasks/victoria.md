# La pantalla de victoria

El modo clásico no terminaba: los hitos seguían hasta 200.000 y una ciudad de medio millón
seguía jugando como si nada. El roguelike sí cierra con pantalla; el clásico no, y esa fue
la deuda más vieja del proyecto.

## Specs

- **S1 — La meta del clásico es medio millón.** El último hito es `500.000` habitantes y se
  llama «Medio millón». Es el mismo número que la meta del roguelike (`RUN_GOAL`): una sola
  ciudad, una sola vara.
- **S2 — Ganar tiene pantalla.** Al llegar a la meta, la partida se detiene y aparece la
  pantalla de fin, con el nombre que ya existe en el roguelike: **«Medio millón»**. No es una
  noticia ni una plaqueta de hito: es la pantalla, la misma que usa el roguelike.
- **S3 — En clásico se puede seguir mirando.** A diferencia del roguelike, la victoria clásica
  se cierra con «Seguir mirando»: ganar no te saca de tu ciudad. El otro botón vuelve al menú.
- **S4 — El resumen es de la ciudad, no de la run.** En clásico la pantalla no habla de mejoras
  ni de drafts (no hay): dice habitantes, año, caja y aprobación. En roguelike sigue mostrando
  las mejoras elegidas.
- **S5 — Se muestra una sola vez.** Volver a «Seguir mirando», guardar y cargar no la reabre.

## Tasks

- T1 · `CITY_GOAL` y el último hito `500.000` «Medio millón» — `src/config.ts`, `src/sim/milestones.ts` — commit `82ed439`
- T2 · `openEndScreen`: una sola pantalla para el roguelike y el clásico, con rama de resumen — `src/ui/upgrades.ts` — commit `82ed439`
- T3 · `game.ts`: victoria clásica y el hito final — `src/game.ts` — commit `82ed439`
- T4 · Contraste de la plaqueta: el kicker, la fecha y el `h3` se leen sobre el marrón — `src/ui/style.css` — commit `82ed439`
- T5 · Tests (5 de la meta + 3 de la pantalla) — `tests/victoria.test.ts`, `tests/hitos-grandes.test.ts` — commit `82ed439`

## Log

- **L1** — «Me gustó eso de atar los sistemas, vamos a tener que armarlo con paciencia la idea,
  pero por ahora hagamos eso de la pantalla de victoria. Que sea medio millón de habitantes y
  listo.»
- **L2** — Lo que ya existía y no hay que tocar: la derrota electoral en clásico abre
  `openElectionLost` (ofrece modo libre) y la quiebra tiene noticia, contador y titular de
  intervención. El hueco era únicamente la victoria.
- **L3** — Verificado en el juego con un save de prueba de 780.000 habitantes: la pantalla abre en el
  primer tick con «FIN DE LA PARTIDA · GANADA», el título «Medio millón», el resumen de la ciudad y los
  botones «Seguir mirando» / «Volver al menú». «Seguir mirando» cierra, devuelve el reloj a su velocidad
  y el juego continúa: se ve en la fecha, que pasa a «Sem 2 · Ene 1990».
- **L4** — La primera versión decía «Ganaste la run» en una partida clásica: el texto de la pantalla era el
  del roguelike. Ahora la línea se elige por modo, y un test prohíbe la palabra «run» en la pantalla clásica.
- **L5** — Trampa del save de prueba: una ciudad recién abierta arranca con el reloj parado esperando la
  primera calle (`waitingForFirstWork`), así que sin darle play el hito no sube nunca. Y una ciudad pintada
  sin luz ni agua se descuenta sola en el primer mes, así que hay que pintar con colchón para que el pico
  aguante arriba de la meta.
