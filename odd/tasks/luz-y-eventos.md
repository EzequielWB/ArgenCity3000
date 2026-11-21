# Eventos en una ciudad vacía y la luz que no se explica

Dos cosas que el jugador reportó después de la pantalla de victoria:

1. Con la ciudad recién empezada —y sin un solo habitante— salta un evento festivo. Estás
   planificando el trazado y te interrumpe un feriado de un pueblo que no existe.
2. La usina «alcanza por volumen» y sin embargo hay edificios sin luz; poner una usina al lado
   lo arregla. El consultar no dice si el problema es que no llega el tendido o que la red no
   da abasto.

## Lo que se midió

| caso | capacidad | demanda | apagados |
|---|---|---|---|
| ciudad vacía, 30 meses | — | — | salta `feriado-1` «Año Nuevo en el pueblo» a los 12 meses con **pop = 0** |
| usina lejos de la cadena | 600 MW | 160 MW | **18 de 34 casas sin luz**: están fuera del alcance de 3 lotes del tendido |
| presupuesto de usinas al 40 % | 420 MW | 520 MW | **10 de 52**, y son las más lejanas (24 a 28 lotes de la usina) |

Conclusiones:

- El reparto por capacidad **funciona como está escrito**: se enciende por orden de cercanía y
  los últimos se quedan a oscuras. No es un bug de la simulación.
- El caso del jugador (sobra capacidad y hay apagados) es **tendido, no capacidad**: esos
  edificios no están en ninguna red.
- El consultar no distingue las dos causas, y ahí está el bug de verdad: con déficit en
  cualquier red del mapa, **todos** los apagados dicen «la usina no da abasto», aunque estén
  fuera de toda red y sobre capacidad.

## Specs

- **S1 — Ningún evento sin vecinos.** Una ciudad con menos de `EVENT.minPop` habitantes no
  recibe eventos ni feriados. Vale para las dos ramas de `eventOfMonth`: el feriado entra por
  calendario y hoy se saltea el gate de `pickEvent`.
- **S2 — El consultar dice cuál de las dos cosas es.** Un edificio sin luz informa una de tres
  causas, y la que corresponde a su caso, no la global:
  1. no hay ninguna usina en la ciudad → «construí una usina»;
  2. el edificio **no está en ninguna red** → «no le llega el tendido», con el alcance de
     `POWER_REACH` y la salida (acercarlo o tender una línea);
  3. está en una red **que no da abasto** → «la red no da abasto», con los MW que pide y los que
     hay.
- **S3 — La regla del reparto no cambia.** Se sigue encendiendo por orden de cercanía y apagando
  los últimos. Lo único que cambia es lo que el consultar cuenta.
- **S4 — La usina dice si alcanza.** El consultar de una usina o de un tendido sigue mostrando
  «Red de la ciudad: uso de capacidad», y cuando falta, agrega cuántos MW faltan.

## Tasks

- T1 · `EVENT.minPop` y el gate en `eventOfMonth` — `src/config.ts`, `src/sim/events.ts` — commit `e567688`
- T2 · `World.powerNet` / `World.powerShort`, marcados en `computePower` — `src/world/world.ts`, `src/sim/power.ts` — commit `e567688`
- T3 · `noLightHint` por celda, con las tres causas y los números — `src/sim/report.ts` — commit `e567688`
- T4 · Tests de las dos cosas — `tests/eventos-vacio.test.ts`, `tests/luz-causas.test.ts` — commit `e567688`

## Log

- **L1** — «primero que ni bien arrancas el juego, incluso en pausa pasa que eventos festivos o
  feriados se activan igual? pasa que estas planificando la ciudad y te salta un evento cuando
  no tenes ni gente.»
- **L2** — «noto que hay zonas que llega la luz, el volumen de la usina deberia dar (por ejemplo
  1500 de 1800) y sin embargo hay edificios sin luz, al colocarles una usina cerca se soluciona,
  puede ser por capacidad? (...) en todo caso que el consultar explique bien que o no alcanza la
  luz o supera la capacidad.»
- **L3** — Medido con `scripts/.diag.ts` (descartable): el feriado salta a los 719 ticks con
  `pop = 0`; el reparto por capacidad deja a oscuras a los más lejanos, que es lo que el código
  promete; y el caso «sobra y no hay luz» es alcance, no capacidad.
